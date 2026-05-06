pub mod server;

use server::WebSocketServer;
use std::sync::Mutex;

/// WebSocket state (browser extension bridge)
pub struct WsState {
    pub server: Mutex<Option<WebSocketServer>>,
    pub latest_url: Mutex<Option<String>>,
    pub auth_token: Mutex<String>,
    pub running: Mutex<bool>,
}

impl WsState {
    pub fn new() -> Self {
        // Generate a random auth token for browser extension to use
        let token = uuid::Uuid::new_v4().to_string().replace("-", "");
        Self {
            server: Mutex::new(None),
            latest_url: Mutex::new(None),
            auth_token: Mutex::new(token),
            running: Mutex::new(false),
        }
    }
}
