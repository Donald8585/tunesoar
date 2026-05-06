use crate::audio::{AudioState, ContextType, DetectedContext, update_beat_for_context};
use crate::context::ContextState;
use crate::context::detector::ContextDetector;
use crate::license::LicenseState;
use crate::safety::SafetyState;
use crate::safety::gate::{self, SafetyAcknowledgment};
use crate::storage::db::{ContextMapping, UserPrefs, UsageLog};
use crate::storage::StorageState;
use crate::ws::WsState;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ─── Tauri Commands ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentStatus {
    pub context_type: String,
    pub app_name: String,
    pub window_title: String,
    pub url: Option<String>,
    pub beat_type: String,
    pub beat_frequency: f32,
    pub volume: f32,
    pub is_playing: bool,
    pub is_paused: bool,
}

/// Get current playback status and detected context
#[tauri::command]
pub fn get_status(
    audio: State<AudioState>,
    context: State<ContextState>,
) -> Result<CurrentStatus, String> {
    let current_ctx = context.detector.lock().unwrap()
        .current_context.lock().unwrap().clone();

    let profile = audio.current_profile.lock().unwrap();
    let volume = *audio.volume.lock().unwrap();
    let is_playing = *audio.is_playing.lock().unwrap();
    let is_paused = *audio.is_paused.lock().unwrap();

    Ok(CurrentStatus {
        context_type: current_ctx.as_ref()
            .map(|c| format!("{:?}", c.context_type))
            .unwrap_or_else(|| "Ambient".to_string()),
        app_name: current_ctx.as_ref()
            .map(|c| c.app_name.clone())
            .unwrap_or_default(),
        window_title: current_ctx.as_ref()
            .map(|c| c.window_title.clone())
            .unwrap_or_default(),
        url: current_ctx.as_ref().and_then(|c| c.url.clone()),
        beat_type: profile.as_ref()
            .map(|p| format!("{:?}", p.beat_type))
            .unwrap_or_else(|| "None".to_string()),
        beat_frequency: profile.as_ref().map(|p| p.beat_frequency).unwrap_or(0.0),
        volume,
        is_playing,
        is_paused,
    })
}

/// Set volume (0.0 - 0.25, hard cap enforced server-side)
#[tauri::command]
pub fn set_volume(volume: f32, audio: State<AudioState>) -> Result<(), String> {
    let clamped = volume.clamp(0.0, 0.25);
    *audio.volume.lock().unwrap() = clamped;
    if let Some(ref mut engine) = *audio.engine.lock().unwrap() {
        engine.set_volume(clamped);
    }
    Ok(())
}

/// Toggle play/pause
#[tauri::command]
pub fn toggle_playback(audio: State<AudioState>) -> Result<bool, String> {
    let mut is_playing = audio.is_playing.lock().unwrap();
    let mut is_paused = audio.is_paused.lock().unwrap();

    if *is_playing && !*is_paused {
        // Pause
        if let Some(ref mut engine) = *audio.engine.lock().unwrap() {
            engine.fade_out();
        }
        *is_paused = true;
    } else {
        // Resume
        if let Some(ref mut engine) = *audio.engine.lock().unwrap() {
            engine.fade_in();
        }
        *is_paused = false;
        *is_playing = true;
    }

    Ok(*is_playing && !*is_paused)
}

/// Force a context detection cycle
#[tauri::command]
pub fn detect_context(
    audio: State<AudioState>,
    context: State<ContextState>,
) -> Result<DetectedContext, String> {
    let detector = context.detector.lock().unwrap();
    let browser_url = context.browser_url.lock().unwrap().clone();

    // Get active window
    let (window_title, app_name) = match crate::context::platform::get_active_window() {
        Ok(result) => result,
        Err(e) => {
            log::warn!("Could not detect active window: {}", e);
            ("Unknown".to_string(), "Unknown".to_string())
        }
    };

    let detected = detector.detect(&window_title, &app_name, browser_url.as_deref());

    // Check idle
    if detector.is_idle() {
        let idle_ctx = DetectedContext {
            context_type: ContextType::Idle,
            ..detected
        };
        update_beat_for_context(&audio, &idle_ctx);
        return Ok(idle_ctx);
    }

    detector.mark_active();
    update_beat_for_context(&audio, &detected);

    // Store current context
    *detector.current_context.lock().unwrap() = Some(detected.clone());

    Ok(detected)
}

/// Get user preferences
#[tauri::command]
pub fn get_prefs(storage: State<StorageState>) -> Result<UserPrefs, String> {
    storage.db.lock().unwrap().get_prefs()
}

/// Save a single preference
#[tauri::command]
pub fn save_pref(key: String, value: String, storage: State<StorageState>) -> Result<(), String> {
    storage.db.lock().unwrap().save_pref(&key, &value)
}

/// Get all context mappings
#[tauri::command]
pub fn get_mappings(storage: State<StorageState>) -> Result<Vec<ContextMapping>, String> {
    storage.db.lock().unwrap().get_mappings()
}

/// Upsert a context mapping
#[tauri::command]
pub fn save_mapping(mapping: ContextMapping, storage: State<StorageState>) -> Result<(), String> {
    storage.db.lock().unwrap().upsert_mapping(&mapping)
}

/// Delete a context mapping
#[tauri::command]
pub fn delete_mapping(id: i64, storage: State<StorageState>) -> Result<(), String> {
    storage.db.lock().unwrap().delete_mapping(id)
}

/// Get WebSocket auth token (for browser extension pairing)
#[tauri::command]
pub fn get_ws_token(ws: State<WsState>) -> Result<String, String> {
    Ok(ws.auth_token.lock().unwrap().clone())
}

/// Set browser URL manually (when WebSocket is not available)
#[tauri::command]
pub fn set_browser_url(url: String, context: State<ContextState>) -> Result<(), String> {
    *context.browser_url.lock().unwrap() = Some(url);
    Ok(())
}

/// Get usage statistics
#[tauri::command]
pub fn get_usage_stats(days: i64, storage: State<StorageState>) -> Result<Vec<(String, i64)>, String> {
    storage.db.lock().unwrap().get_usage_stats(days)
}

/// Log a usage session
#[tauri::command]
pub fn log_usage(log: UsageLog, storage: State<StorageState>) -> Result<(), String> {
    storage.db.lock().unwrap().log_usage(&log)
}

/// Accept safety warning
#[tauri::command]
pub fn accept_safety_warning(storage: State<StorageState>) -> Result<(), String> {
    storage.db.lock().unwrap().save_pref("safety_warning_accepted", "true")
}

/// Check if safety warning has been accepted
#[tauri::command]
pub fn is_safety_accepted(storage: State<StorageState>) -> Result<bool, String> {
    let prefs = storage.db.lock().unwrap().get_prefs()?;
    Ok(prefs.safety_warning_accepted)
}

// ─── Safety Commands ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyStatus {
    pub acknowledged: bool,
    pub read_and_understood: bool,
    pub no_listed_conditions: bool,
    pub requires_reack: bool,
    pub continuous_play_seconds: i64,
    pub break_required: bool,
    pub break_remaining_seconds: i64,
    pub gamma_enabled: bool,
    pub gamma_confirmed: bool,
    pub discomfort_active: bool,
    pub discomfort_remaining_seconds: i64,
    pub max_session_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_active: bool,
    pub elapsed_seconds: i64,
    pub remaining_seconds: i64,
    pub break_required: bool,
}

/// Get full safety status
#[tauri::command]
pub fn get_safety_status(
    safety: State<SafetyState>,
    storage: State<StorageState>,
) -> Result<SafetyStatus, String> {
    let gate = safety.gate.lock().unwrap();
    let reqs_reack = gate.requires_reacknowledgment(&safety.app_version);
    let prefs = storage.db.lock().unwrap().get_prefs()?;

    let now = chrono::Utc::now().timestamp();
    let break_remaining = safety.break_cooldown_until.lock().unwrap()
        .map(|until| (until - now).max(0))
        .unwrap_or(0);
    let discomfort_remaining = safety.discomfort_until.lock().unwrap()
        .map(|until| (until - now).max(0))
        .unwrap_or(0);

    Ok(SafetyStatus {
        acknowledged: gate.acknowledged || prefs.safety_warning_accepted,
        read_and_understood: gate.last_ack.as_ref().map(|a| a.read_and_understood).unwrap_or(false),
        no_listed_conditions: gate.last_ack.as_ref().map(|a| a.no_listed_conditions).unwrap_or(false),
        requires_reack: reqs_reack,
        continuous_play_seconds: *safety.continuous_play_seconds.lock().unwrap(),
        break_required: *safety.break_required.lock().unwrap(),
        break_remaining_seconds: break_remaining,
        gamma_enabled: *safety.gamma_enabled.lock().unwrap(),
        gamma_confirmed: *safety.gamma_confirmed.lock().unwrap(),
        discomfort_active: discomfort_remaining > 0,
        discomfort_remaining_seconds: discomfort_remaining,
        max_session_seconds: gate::MAX_CONTINUOUS_PLAY_SECONDS,
    })
}

/// Acknowledge safety gate (two checkboxes required)
#[tauri::command]
pub fn acknowledge_safety(
    read_and_understood: bool,
    no_listed_conditions: bool,
    safety: State<SafetyState>,
    storage: State<StorageState>,
) -> Result<SafetyAcknowledgment, String> {
    let mut gate = safety.gate.lock().unwrap();
    let ack = gate.acknowledge(
        read_and_understood,
        no_listed_conditions,
        safety.app_version.clone(),
    );

    // Persist to storage
    storage.db.lock().unwrap().save_pref("safety_warning_accepted", &ack.accepted.to_string())?;
    storage.db.lock().unwrap().save_pref("safety_ack_timestamp", &ack.timestamp.to_string())?;
    storage.db.lock().unwrap().save_pref("safety_ack_version", &ack.app_version)?;

    Ok(ack)
}

/// "I feel unwell" — immediate stop + 24h cooldown
#[tauri::command]
pub fn discomfort_stop(
    audio: State<AudioState>,
    safety: State<SafetyState>,
    storage: State<StorageState>,
) -> Result<(), String> {
    // Kill audio immediately
    if let Some(ref mut engine) = *audio.engine.lock().unwrap() {
        engine.fade_out();
    }
    *audio.engine.lock().unwrap() = None;

    // Set 24h cooldown
    let now = chrono::Utc::now().timestamp();
    let until = now + gate::DISCOMFORT_COOLDOWN_SECONDS;
    *safety.discomfort_until.lock().unwrap() = Some(until);

    // Log the event
    let _ = storage.db.lock().unwrap().log_usage(&UsageLog {
        id: None,
        context_type: "DiscomfortStop".to_string(),
        beat_type: "None".to_string(),
        app_name: "Safety".to_string(),
        duration_secs: 0,
        timestamp: now,
    });

    log::warn!("Discomfort stop triggered — 24h cooldown activated");
    Ok(())
}

/// Enable gamma band (requires secondary confirmation)
#[tauri::command]
pub fn enable_gamma(
    safety: State<SafetyState>,
    storage: State<StorageState>,
) -> Result<(), String> {
    let confirmed = *safety.gamma_confirmed.lock().unwrap();
    if !confirmed {
        return Err("Gamma band requires secondary safety confirmation".to_string());
    }
    *safety.gamma_enabled.lock().unwrap() = true;
    storage.db.lock().unwrap().save_pref("gamma_enabled", "true")?;
    log::info!("Gamma band enabled");
    Ok(())
}

/// Confirm gamma band secondary warning
#[tauri::command]
pub fn confirm_gamma_warning(
    safety: State<SafetyState>,
) -> Result<(), String> {
    *safety.gamma_confirmed.lock().unwrap() = true;
    Ok(())
}

/// Get session info (elapsed, remaining, break status)
#[tauri::command]
pub fn get_session_info(
    safety: State<SafetyState>,
) -> Result<SessionInfo, String> {
    let play_secs = *safety.continuous_play_seconds.lock().unwrap();
    let break_required = *safety.break_required.lock().unwrap();

    Ok(SessionInfo {
        session_active: play_secs > 0 && !break_required,
        elapsed_seconds: play_secs,
        remaining_seconds: (gate::MAX_CONTINUOUS_PLAY_SECONDS - play_secs).max(0),
        break_required,
    })
}

// ─── License Commands ─────────────────────────────────────────

/// Get current license info
#[tauri::command]
pub fn get_license_info(
    license: State<LicenseState>,
) -> Result<crate::license::LicenseInfo, String> {
    Ok(license.info.lock().unwrap().clone())
}

/// Set license key and verify
#[tauri::command]
pub async fn set_license_key(
    key: String,
    license: State<'_, LicenseState>,
) -> Result<crate::license::LicenseInfo, String> {
    // Verify license key against Cloudflare Worker
    let client = reqwest::Client::new();
    let resp = client
        .post(&license.verification_url)
        .json(&serde_json::json!({
            "key": key,
            "device_id": hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "unknown".to_string()),
        }))
        .send()
        .await
        .map_err(|e| format!("Verification failed: {}", e))?;

    if resp.status().is_success() {
        let info: crate::license::LicenseInfo = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        let mut current = license.info.lock().unwrap();
        *current = info.clone();
        Ok(info)
    } else {
        Err("Invalid or expired license key".to_string())
    }
}

/// Verify current license status
#[tauri::command]
pub async fn verify_license(
    license: State<'_, LicenseState>,
) -> Result<bool, String> {
    Ok(license.is_valid())
}
