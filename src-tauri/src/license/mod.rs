use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// License state for Pro features
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub key: Option<String>,
    pub plan: Option<String>, // "free", "monthly", "lifetime"
    pub expires_at: Option<i64>,
    pub devices: Vec<String>,
    pub verified: bool,
}

impl Default for LicenseInfo {
    fn default() -> Self {
        Self {
            key: None,
            plan: Some("free".to_string()),
            expires_at: None,
            devices: vec![],
            verified: false,
        }
    }
}

/// Feature gates controlled by license tier
pub struct LicenseState {
    pub info: Mutex<LicenseInfo>,
    pub verification_url: String,
}

unsafe impl Send for LicenseState {}
unsafe impl Sync for LicenseState {}

impl LicenseState {
    pub fn new() -> Self {
        Self {
            info: Mutex::new(LicenseInfo::default()),
            verification_url: "https://api.tunesoar.app/verify-license".to_string(),
        }
    }

    /// Check if a feature is available for current tier
    pub fn can_use(&self, feature: &str) -> bool {
        let info = self.info.lock().unwrap();
        let is_pro = matches!(
            info.plan.as_deref(),
            Some("monthly") | Some("lifetime")
        );

        match feature {
            "unlimited_contexts" => is_pro,
            "delta_band" => is_pro,
            "gamma_band" => is_pro,
            "sleep_mode" => is_pro,
            "custom_mappings" => is_pro,
            "usage_analytics" => is_pro,
            _ => true, // Free features default to available
        }
    }

    /// Check if license is valid and not expired
    pub fn is_valid(&self) -> bool {
        let info = self.info.lock().unwrap();
        if !info.verified {
            return false;
        }
        if let (Some(plan), Some(expires)) = (info.plan.as_deref(), info.expires_at) {
            if plan == "lifetime" {
                return true;
            }
            let now = chrono::Utc::now().timestamp();
            return now < expires;
        }
        false
    }
}
