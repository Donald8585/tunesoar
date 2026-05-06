use crate::audio::{AudioState, ContextType, DetectedContext, update_beat_for_context};
use crate::context::ContextState;
use crate::context::detector::ContextDetector;
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
