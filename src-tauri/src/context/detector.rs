pub mod defaults;
pub mod platform;

use crate::audio::{ContextType, DetectedContext};
use chrono::{Local, Timelike};
use defaults::{default_rules, ContextRule};
use regex::Regex;
use std::sync::{Arc, Mutex};

/// Context detector — matches `"<process>: <window_title>"` against regex rules.
pub struct ContextDetector {
    /// Compiled regex rules (ordered, first match wins)
    rules: Vec<(Regex, ContextType)>,
    /// User-defined overrides: a user can lock a specific context
    pub manual_override: Mutex<Option<ContextType>>,
    /// Whether auto-detection is enabled (toggled via manual override)
    pub auto_detect_enabled: Mutex<bool>,
    /// Current detected context
    pub current_context: Mutex<Option<DetectedContext>>,
    /// Last active timestamp (for idle detection)
    pub last_active: Mutex<i64>,
    /// Whether audio from other apps is detected
    pub other_audio_active: Mutex<bool>,
}

impl ContextDetector {
    /// Build with compiled default rules.
    pub fn new() -> Self {
        let raw_rules = default_rules();
        let mut rules = Vec::with_capacity(raw_rules.len());
        for r in &raw_rules {
            match Regex::new(r.pattern) {
                Ok(re) => rules.push((re, r.context)),
                Err(e) => {
                    log::error!("Invalid regex in rule '{}': {}", r.label, e);
                }
            }
        }
        log::info!(
            "ContextDetector loaded {}/{} rules",
            rules.len(),
            raw_rules.len()
        );
        Self {
            rules,
            manual_override: Mutex::new(None),
            auto_detect_enabled: Mutex::new(true),
            current_context: Mutex::new(None),
            last_active: Mutex::new(chrono::Utc::now().timestamp_millis()),
            other_audio_active: Mutex::new(false),
        }
    }

    /// Set a manual override context (disables auto-detection).
    pub fn set_manual_override(&self, ctx: Option<ContextType>) {
        let mut ov = self.manual_override.lock().unwrap();
        let mut auto = self.auto_detect_enabled.lock().unwrap();
        *ov = ctx;
        *auto = ctx.is_none(); // auto-detect resumes when override is cleared
    }

    /// Re-enable auto-detection (clears manual override).
    pub fn enable_auto_detect(&self) {
        *self.manual_override.lock().unwrap() = None;
        *self.auto_detect_enabled.lock().unwrap() = true;
    }

    /// Detect context from process name and window title.
    /// The combined string is `"<process>: <window_title>"`.
    pub fn detect(&self, window_title: &str, app_name: &str) -> DetectedContext {
        let now = chrono::Utc::now().timestamp_millis();

        // Check manual override first
        {
            let ov = self.manual_override.lock().unwrap();
            if let Some(ctx) = *ov {
                return DetectedContext {
                    context_type: ctx,
                    app_name: app_name.to_string(),
                    window_title: window_title.to_string(),
                    detected_at: now,
                };
            }
        }

        let combined = format!("{}: {}", app_name, window_title);

        let context_type = self
            .match_combined(&combined)
            .unwrap_or_else(|| {
                // Time-based fallback: 22:00-06:00 → SleepPrep
                let hour = Local::now().hour();
                if hour >= 22 || hour < 6 {
                    return ContextType::SleepPrep;
                }
                ContextType::Ambient
            });

        DetectedContext {
            context_type,
            app_name: app_name.to_string(),
            window_title: window_title.to_string(),
            detected_at: now,
        }
    }

    /// Run the combined string through the ordered rules.
    fn match_combined(&self, combined: &str) -> Option<ContextType> {
        for (re, ctx) in &self.rules {
            if re.is_match(combined) {
                return Some(*ctx);
            }
        }
        None
    }

    /// Check idle: no activity for >5 minutes.
    pub fn is_idle(&self) -> bool {
        let now = chrono::Utc::now().timestamp_millis();
        let last = *self.last_active.lock().unwrap();
        (now - last) > 300_000
    }

    /// Update last-active timestamp.
    pub fn mark_active(&self) {
        *self.last_active.lock().unwrap() = chrono::Utc::now().timestamp_millis();
    }
}
