// Loopback auth server — receives token from system browser after OAuth.
//
// Architecture:
//   1. Desktop calls start_auth_server(state) → binds 127.0.0.1:0 → returns port
//   2. Desktop opens browser to tunesoar.com/auth/desktop?state=xxx&port=yyy
//   3. User signs in via Clerk in browser
//   4. Bridge page POSTs to /auth/desktop/token to get JWT
//   5. Bridge page calls GET /auth/desktop/finish?state=xxx → gets {jwt, port}
//   6. Bridge page fetch()es http://127.0.0.1:{port}/callback?token=jwt&state=xxx
//   7. Loopback server validates state, stores token, responds 200, shuts down
//
// This avoids custom protocol registration (tunesoar://) which is fragile on Windows.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};

pub struct LoopbackAuthServer {
    pub port: u16,
    inner: Arc<Mutex<InnerState>>,
}

struct InnerState {
    pub token: Option<String>,
    pub shutdown: bool,
    pub expected_state: String,
    pub error: Option<String>,
}

impl LoopbackAuthServer {
    /// Start a loopback HTTP server on 127.0.0.1:0.
    /// Returns the server handle immediately; the accept loop runs on a background thread.
    /// The server auto-shuts down after first successful callback or 30s timeout.
    pub fn start(expected_state: String) -> Result<Self, String> {
        let listener =
            TcpListener::bind("127.0.0.1:0").map_err(|e| format!("bind loopback: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("get port: {}", e))?
            .port();
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("nonblocking: {}", e))?;

        let inner = Arc::new(Mutex::new(InnerState {
            token: None,
            shutdown: false,
            expected_state,
            error: None,
        }));

        log::info!("[tunesoar:auth] [stage.lb1] loopback thread started port={}", port);
        let inner_clone = inner.clone();
        std::thread::spawn(move || {
            let start = std::time::Instant::now();
            let timeout = std::time::Duration::from_secs(30);
            loop {
                if inner_clone.lock().unwrap().shutdown {
                    break;
                }
                if start.elapsed() > timeout {
                    log::warn!("[tunesoar:auth] loopback server timed out after 30s");
                    inner_clone.lock().unwrap().error =
                        Some("Sign-in timed out. Please try again.".into());
                    break;
                }
                match listener.accept() {
                    Ok((mut stream, addr)) => {
                        log::info!("[tunesoar:auth] [stage.lb2] connection from {}", addr);
                        let mut buf = [0u8; 8192];
                        match stream.read(&mut buf) {
                            Ok(n) if n > 0 => {
                                let req = String::from_utf8_lossy(&buf[..n]);
                                if req.starts_with("GET /callback") {
                                    let response =
                                        handle_callback(&req, &mut inner_clone.lock().unwrap());
                                    let _ = stream.write_all(response.as_bytes());
                                    let _ = stream.flush();
                                } else {
                                    // CORS preflight or unknown path — respond 204
                                    let resp = "HTTP/1.1 204 No Content\r\n\
                                        Access-Control-Allow-Origin: *\r\n\
                                        Access-Control-Allow-Methods: GET, OPTIONS\r\n\
                                        Access-Control-Allow-Headers: Content-Type\r\n\
                                        Content-Length: 0\r\n\r\n";
                                    let _ = stream.write_all(resp.as_bytes());
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        continue;
                    }
                    Err(e) => {
                        log::error!("[tunesoar:auth] loopback accept error: {}", e);
                        break;
                    }
                }
            }
            log::info!("[tunesoar:auth] loopback server thread exiting");
        });

        Ok(Self { port, inner })
    }

    pub fn take_token(&self) -> Option<String> {
        self.inner.lock().unwrap().token.take()
    }

    pub fn error(&self) -> Option<String> {
        self.inner.lock().unwrap().error.clone()
    }

    pub fn shutdown(&self) {
        self.inner.lock().unwrap().shutdown = true;
    }
}

fn handle_callback(req: &str, state: &mut InnerState) -> String {
    let token = extract_query_param(req, "token");
    let req_state = extract_query_param(req, "state");

    log::info!(
        "[tunesoar:auth] [stage.lb3] callback: token_len={} state={:?} expected={}",
        token.as_ref().map(|t| t.len()).unwrap_or(0),
        req_state.as_ref().map(|s| &s[..s.len().min(8)]),
        &state.expected_state[..state.expected_state.len().min(8)]
    );

    if req_state.as_deref() != Some(&state.expected_state) {
        log::warn!("[tunesoar:auth] [stage.lb4] state mismatch — rejecting");
        return build_response(400, r#"{"error":"state_mismatch"}"#);
    }
    match token {
        Some(t) if !t.is_empty() => {
            log::info!("[tunesoar:auth] [stage.lb4] token accepted len={}", t.len());
            state.token = Some(t);
            state.shutdown = true;
            build_response(200, r#"{"status":"ok"}"#)
        }
        _ => {
            log::warn!("[tunesoar:auth] [stage.lb4] missing token — rejecting");
            build_response(400, r#"{"error":"missing_token"}"#)
        }
    }
}

fn build_response(status: u16, body: &str) -> String {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        _ => "Error",
    };
    format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: application/json\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status,
        status_text,
        body.len(),
        body
    )
}

/// Extract a query parameter value from an HTTP request line.
/// Looks for `key=value` in the request path (before the first space after the path).
fn extract_query_param(req: &str, key: &str) -> Option<String> {
    // Find the request path: "GET /callback?token=...&state=... HTTP/1.1"
    let path_start = req.find(' ')? + 1;
    let path_end = req[path_start..].find(' ')?;
    let path = &req[path_start..path_start + path_end];

    // Find key= in path
    let search = format!("{}=", key);
    let kv_start = path.find(&search)? + search.len();
    let kv_end = path[kv_start..]
        .find(|c: char| c == '&' || c == ' ')
        .map(|i| kv_start + i)
        .unwrap_or(path.len());
    let raw = &path[kv_start..kv_end];

    url_decode(raw)
}

fn url_decode(s: &str) -> Option<String> {
    let mut result = String::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
                let byte = u8::from_str_radix(hex, 16).ok()?;
                result.push(byte as char);
                i += 3;
            }
            b'+' => {
                result.push(' ');
                i += 1;
            }
            b => {
                result.push(b as char);
                i += 1;
            }
        }
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_token() {
        let req = "GET /callback?token=abc123&state=deadbeef HTTP/1.1\r\nHost: localhost\r\n\r\n";
        assert_eq!(extract_query_param(req, "token"), Some("abc123".into()));
        assert_eq!(extract_query_param(req, "state"), Some("deadbeef".into()));
    }

    #[test]
    fn test_extract_encoded() {
        let req = "GET /callback?token=eyJh.eyJi.c%2B%2B&state=ff HTTP/1.1\r\n";
        assert_eq!(
            extract_query_param(req, "token"),
            Some("eyJh.eyJi.c++".into())
        );
    }
}
