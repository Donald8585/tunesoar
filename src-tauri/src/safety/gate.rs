use serde::{Deserialize, Serialize};

/// Safety gate acknowledgment record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyAcknowledgment {
    pub accepted: bool,
    pub read_and_understood: bool,
    pub no_listed_conditions: bool,
    pub timestamp: i64,
    pub app_version: String,
}

/// Safety gate — blocks audio initialization until acknowledged
pub struct SafetyGate {
    pub acknowledged: bool,
    pub last_ack: Option<SafetyAcknowledgment>,
}

impl SafetyGate {
    pub fn new() -> Self {
        Self {
            acknowledged: false,
            last_ack: None,
        }
    }

    /// Check if safety gate needs to be re-shown (e.g., after app update that changes DSP)
    pub fn requires_reacknowledgment(&self, current_version: &str) -> bool {
        if !self.acknowledged {
            return true;
        }
        match &self.last_ack {
            Some(ack) => {
                // Re-prompt if app version changed (indicates DSP may have changed)
                ack.app_version != current_version
            }
            None => true,
        }
    }

    /// Record acknowledgment
    pub fn acknowledge(
        &mut self,
        read_and_understood: bool,
        no_listed_conditions: bool,
        app_version: String,
    ) -> SafetyAcknowledgment {
        let ack = SafetyAcknowledgment {
            accepted: read_and_understood && no_listed_conditions,
            read_and_understood,
            no_listed_conditions,
            timestamp: chrono::Utc::now().timestamp_millis(),
            app_version,
        };
        self.acknowledged = ack.accepted;
        self.last_ack = Some(ack.clone());
        ack
    }
}

/// Safety limits
pub const MAX_CONTINUOUS_PLAY_SECONDS: i64 = 90 * 60; // 90 minutes
pub const BREAK_DURATION_SECONDS: i64 = 10 * 60; // 10 minutes
pub const DISCOMFORT_COOLDOWN_SECONDS: i64 = 24 * 3600; // 24 hours
pub const VOLUME_HARD_CAP: f32 = 0.25;
pub const VOLUME_DEFAULT: f32 = 0.10;

/// Safety checklist items shown in Settings > Safety
pub const SAFETY_CHECKLIST: &[&str] = &[
    "Start at low volume (10% or less) and increase gradually",
    "Use headphones in a quiet environment",
    "Take regular breaks — the app enforces a 10-minute break every 90 minutes",
    "Do not use while driving or operating heavy machinery",
    "Stop immediately if you experience headache, dizziness, nausea, or anxiety",
    "Discontinue use if symptoms persist or recur",
    "Do not use if you have ever experienced a seizure of any kind",
    "Consult a healthcare professional before use if pregnant, have a pacemaker, or any neurological condition",
    "Keep volume below 25% — this is enforced by the app",
    "This is not a medical device and is not intended to diagnose, treat, cure, or prevent any disease",
];
