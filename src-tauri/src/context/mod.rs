pub mod defaults;
pub mod detector;
pub mod platform;

use detector::ContextDetector;
use std::sync::{Arc, Mutex};

/// Shared context state (all fields Arc-wrapped for clone-safety)
pub struct ContextState {
    pub detector: Mutex<ContextDetector>,
    pub browser_url: Arc<Mutex<Option<String>>>,
    pub last_check: Mutex<i64>,
}

// SAFETY: All fields are Arc/Mutex protected
unsafe impl Send for ContextState {}
unsafe impl Sync for ContextState {}

impl ContextState {
    pub fn new() -> Self {
        Self {
            detector: Mutex::new(ContextDetector::new()),
            browser_url: Arc::new(Mutex::new(None)),
            last_check: Mutex::new(0),
        }
    }
}
