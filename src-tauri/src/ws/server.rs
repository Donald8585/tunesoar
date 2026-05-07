use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

/// WebSocket server that receives active tab URLs from browser extension
pub struct WebSocketServer {
    shutdown_tx: broadcast::Sender<()>,
    port: u16,
}

impl WebSocketServer {
    pub fn new() -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        Self {
            shutdown_tx,
            port: 47821,
        }
    }

    /// Start WebSocket server on localhost:47821
    pub async fn start(
        &self,
        url_tx: tokio::sync::mpsc::UnboundedSender<String>,
        auth_token: String,
    ) -> Result<(), String> {
        let addr: SocketAddr = format!("127.0.0.1:{}", self.port)
            .parse()
            .map_err(|e| format!("Invalid address: {}", e))?;

        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| format!("Failed to bind WebSocket: {}", e))?;

        log::info!("WebSocket server listening on ws://{}", addr);

        let mut shutdown_rx = self.shutdown_tx.subscribe();
        let token = Arc::new(auth_token);

        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((stream, peer_addr)) => {
                            let tx = url_tx.clone();
                            let t = token.clone();
                            tokio::spawn(handle_connection(stream, peer_addr, tx, t));
                        }
                        Err(e) => {
                            log::error!("WebSocket accept error: {}", e);
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    log::info!("WebSocket server shutting down");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Signal the server to shut down
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }

    pub fn get_auth_token_display(&self) -> String {
        // This is set externally via WsState
        String::new()
    }
}

async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    url_tx: tokio::sync::mpsc::UnboundedSender<String>,
    auth_token: Arc<String>,
) {
    log::info!("New WebSocket connection from {}", peer_addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::error!("WebSocket handshake error: {}", e);
            return;
        }
    };

    let (mut write, mut read) = ws_stream.split();

    // First message should be auth token
    match read.next().await {
        Some(Ok(Message::Text(auth_msg))) => {
            if auth_msg != *auth_token {
                log::warn!("Invalid auth token from {}", peer_addr);
                let _ = write.send(Message::Text("ERROR: Invalid auth token".into())).await;
                return;
            }
            let _ = write.send(Message::Text("AUTH_OK".into())).await;
        }
        _ => {
            let _ = write.send(Message::Text("ERROR: Auth required".into())).await;
            return;
        }
    }

    // Process URL updates
    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // Expected format: "URL:https://example.com/page"
                if text.starts_with("URL:") {
                    let url = text[4..].to_string();
                    log::debug!("Browser URL update: {}", url);
                    let _ = url_tx.send(url);
                } else if text == "PING" {
                    let _ = write.send(Message::Text("PONG".into())).await;
                }
            }
            Ok(Message::Ping(data)) => {
                let _ = write.send(Message::Pong(data)).await;
            }
            Ok(Message::Close(_)) => {
                log::info!("WebSocket closed by {}", peer_addr);
                break;
            }
            Err(e) => {
                log::error!("WebSocket error from {}: {}", peer_addr, e);
                break;
            }
            _ => {}
        }
    }
}
