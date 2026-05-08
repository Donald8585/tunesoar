pub mod gate;

use gate::SafetyGate;
use std::sync::Mutex;

/// Runtime safety state
pub struct SafetyState {
    pub gate: Mutex<SafetyGate>,
    pub session_start: Mutex<Option<i64>>,
    pub continuous_play_seconds: Mutex<i64>,
    pub break_required: Mutex<bool>,
    pub break_cooldown_until: Mutex<Option<i64>>,
    pub gamma_enabled: Mutex<bool>,
    pub gamma_confirmed: Mutex<bool>,
    pub discomfort_until: Mutex<Option<i64>>,  // 24h cooldown after discomfort
    pub app_version: String,
}

unsafe impl Send for SafetyState {}
unsafe impl Sync for SafetyState {}

impl SafetyState {
    pub fn new(app_version: String) -> Self {
        Self {
            gate: Mutex::new(SafetyGate::new()),
            session_start: Mutex::new(None),
            continuous_play_seconds: Mutex::new(0),
            break_required: Mutex::new(false),
            break_cooldown_until: Mutex::new(None),
            gamma_enabled: Mutex::new(false),
            gamma_confirmed: Mutex::new(false),
            discomfort_until: Mutex::new(None),
            app_version,
        }
    }
}
