pub mod defaults;
pub mod detector;

use detector::ContextDetector;

/// Shared context state (all fields Arc-wrapped for clone-safety)
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
