pub mod defaults;
pub mod defaults;
pub mod detector;
pub mod platform;

use detector::ContextDetector;
use std::sync::Mutex;

/// Shared context state
pub struct ContextState {
    pub detector: Mutex<ContextDetector>,
    pub last_check: Mutex<i64>,
}

impl ContextState {
    pub fn new() -> Self {
        Self {
            detector: Mutex::new(ContextDetector::new()),
            last_check: Mutex::new(0),
        }
    }
}
