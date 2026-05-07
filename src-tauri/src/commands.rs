use crate::audio::{AudioState, ContextType, DetectedContext, update_beat_for_context};
use crate::context::ContextState;
use crate::license::LicenseState;
use crate::safety::SafetyState;
use crate::safety::gate::{self, SafetyAcknowledgment};
use crate::storage::db::{ContextMapping, UserPrefs, UsageLog};
use crate::storage::StorageState;
use serde::{Deserialize, Serialize};
use tauri::State;

// ─── Status ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentStatus {
    pub context_type: String,
    pub app_name: String,
    pub window_title: String,
    pub beat_type: String,
    pub beat_frequency: f32,
    pub volume: f32,
    pub is_playing: bool,
    pub is_paused: bool,
    pub auto_detect_enabled: bool,
    pub manual_override: Option<String>,
}

#[tauri::command]
pub fn get_status(
    audio: State<AudioState>,
    context: State<ContextState>,
) -> Result<CurrentStatus, String> {
    let detector = context.detector.lock().unwrap();
    let current_ctx = detector.current_context.lock().unwrap().clone();
    let auto = *detector.auto_detect_enabled.lock().unwrap();
    let manual = *detector.manual_override.lock().unwrap();

    let profile = audio.current_profile.lock().unwrap();
    let volume = *audio.volume.lock().unwrap();
    let ip = *audio.is_playing.lock().unwrap();
    let ipa = *audio.is_paused.lock().unwrap();

    Ok(CurrentStatus {
        context_type: current_ctx.as_ref().map(|c| format!("{:?}", c.context_type)).unwrap_or_else(|| "Ambient".to_string()),
        app_name: current_ctx.as_ref().map(|c| c.app_name.clone()).unwrap_or_default(),
        window_title: current_ctx.as_ref().map(|c| c.window_title.clone()).unwrap_or_default(),
        beat_type: profile.as_ref().map(|p| format!("{:?}", p.beat_type)).unwrap_or_else(|| "None".to_string()),
        beat_frequency: profile.as_ref().map(|p| p.beat_frequency).unwrap_or(0.0),
        volume, is_playing: ip, is_paused: ipa,
        auto_detect_enabled: auto,
        manual_override: manual.map(|c| format!("{:?}", c)),
    })
}

// ─── Playback ───────────────────────────────────────────────

#[tauri::command]
pub fn set_volume(volume: f32, audio: State<AudioState>) -> Result<(), String> {
    let v = volume.clamp(0.0, 0.25);
    *audio.volume.lock().unwrap() = v;
    if let Some(ref mut e) = *audio.engine.lock().unwrap() { e.set_volume(v); }
    Ok(())
}

#[tauri::command]
pub fn toggle_playback(audio: State<AudioState>) -> Result<bool, String> {
    let mut ip = audio.is_playing.lock().unwrap();
    let mut ipa = audio.is_paused.lock().unwrap();
    if *ip && !*ipa {
        if let Some(ref mut e) = *audio.engine.lock().unwrap() { e.fade_out(); }
        *ipa = true;
    } else {
        if let Some(ref mut e) = *audio.engine.lock().unwrap() { e.fade_in(); }
        *ipa = false; *ip = true;
    }
    Ok(*ip && !*ipa)
}

// ─── Detection ──────────────────────────────────────────────

#[tauri::command]
pub fn detect_context(audio: State<AudioState>, context: State<ContextState>) -> Result<DetectedContext, String> {
    let detector = context.detector.lock().unwrap();
    let (title, app) = crate::context::platform::get_active_window().unwrap_or_else(|e| {
        log::warn!("Window detection error: {}", e);
        ("Unknown".to_string(), "Unknown".to_string())
    });
    let mut detected = detector.detect(&title, &app);
    if detector.is_idle() {
        detected.context_type = ContextType::Idle;
        update_beat_for_context(&audio, &detected);
        return Ok(detected);
    }
    detector.mark_active();
    update_beat_for_context(&audio, &detected);
    *detector.current_context.lock().unwrap() = Some(detected.clone());
    Ok(detected)
}

// ─── Manual Override ────────────────────────────────────────

#[tauri::command]
pub fn set_manual_override(context_type: String, context: State<ContextState>) -> Result<String, String> {
    let detector = context.detector.lock().unwrap();
    if context_type.is_empty() || context_type.eq_ignore_ascii_case("auto") {
        detector.enable_auto_detect();
        return Ok("auto".to_string());
    }
    let ct = match context_type.to_lowercase().as_str() {
        "coding" => ContextType::Coding, "writing" => ContextType::Writing,
        "creative" => ContextType::Creative, "passivewatch"|"video" => ContextType::PassiveWatch,
        "communication"|"comm"|"email" => ContextType::Communication, "meeting" => ContextType::Meeting,
        "relaxation"|"relax"|"meditation" => ContextType::Relaxation, "gaming"|"game" => ContextType::Gaming,
        "sleep"|"sleepprep" => ContextType::SleepPrep, "music" => ContextType::Music,
        "ambient"|"default" => ContextType::Ambient,
        _ => return Err(format!("Unknown: {}", context_type)),
    };
    detector.set_manual_override(Some(ct));
    Ok(format!("{:?}", ct))
}

#[tauri::command]
pub fn resume_auto_detect(context: State<ContextState>) -> Result<String, String> {
    context.detector.lock().unwrap().enable_auto_detect();
    Ok("auto".to_string())
}

// ─── Prefs / Mappings ──────────────────────────────────────

#[tauri::command]
pub fn get_prefs(storage: State<StorageState>) -> Result<UserPrefs, String> { storage.db.lock().unwrap().get_prefs() }
#[tauri::command]
pub fn save_pref(key: String, value: String, storage: State<StorageState>) -> Result<(), String> { storage.db.lock().unwrap().save_pref(&key, &value) }
#[tauri::command]
pub fn get_mappings(storage: State<StorageState>) -> Result<Vec<ContextMapping>, String> { storage.db.lock().unwrap().get_mappings() }
#[tauri::command]
pub fn save_mapping(m: ContextMapping, storage: State<StorageState>) -> Result<(), String> { storage.db.lock().unwrap().upsert_mapping(&m) }
#[tauri::command]
pub fn delete_mapping(id: i64, storage: State<StorageState>) -> Result<(), String> { storage.db.lock().unwrap().delete_mapping(id) }
#[tauri::command]
pub fn get_usage_stats(days: i64, storage: State<StorageState>) -> Result<Vec<(String, i64)>, String> { storage.db.lock().unwrap().get_usage_stats(days) }
#[tauri::command]
pub fn log_usage(log: UsageLog, storage: State<StorageState>) -> Result<(), String> { storage.db.lock().unwrap().log_usage(&log) }

// ─── Safety ────────────────────────────────────────────────

#[tauri::command]
pub fn accept_safety_warning(storage: State<StorageState>) -> Result<(), String> { storage.db.lock().unwrap().save_pref("safety_warning_accepted", "true") }
#[tauri::command]
pub fn is_safety_accepted(storage: State<StorageState>) -> Result<bool, String> { Ok(storage.db.lock().unwrap().get_prefs()?.safety_warning_accepted) }

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyStatus { pub acknowledged: bool, pub read_and_understood: bool, pub no_listed_conditions: bool, pub requires_reack: bool, pub continuous_play_seconds: i64, pub break_required: bool, pub break_remaining_seconds: i64, pub gamma_enabled: bool, pub gamma_confirmed: bool, pub discomfort_active: bool, pub discomfort_remaining_seconds: i64, pub max_session_seconds: i64 }

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo { pub session_active: bool, pub elapsed_seconds: i64, pub remaining_seconds: i64, pub break_required: bool }

#[tauri::command]
pub fn get_safety_status(safety: State<SafetyState>, storage: State<StorageState>) -> Result<SafetyStatus, String> {
    let gate = safety.gate.lock().unwrap();
    let rr = gate.requires_reacknowledgment(&safety.app_version);
    let prefs = storage.db.lock().unwrap().get_prefs()?;
    let now = chrono::Utc::now().timestamp();
    let br = safety.break_cooldown_until.lock().unwrap().map(|u| (u - now).max(0)).unwrap_or(0);
    let dr = safety.discomfort_until.lock().unwrap().map(|u| (u - now).max(0)).unwrap_or(0);
    Ok(SafetyStatus { acknowledged: gate.acknowledged || prefs.safety_warning_accepted, read_and_understood: gate.last_ack.as_ref().map(|a| a.read_and_understood).unwrap_or(false), no_listed_conditions: gate.last_ack.as_ref().map(|a| a.no_listed_conditions).unwrap_or(false), requires_reack: rr, continuous_play_seconds: *safety.continuous_play_seconds.lock().unwrap(), break_required: *safety.break_required.lock().unwrap(), break_remaining_seconds: br, gamma_enabled: *safety.gamma_enabled.lock().unwrap(), gamma_confirmed: *safety.gamma_confirmed.lock().unwrap(), discomfort_active: dr > 0, discomfort_remaining_seconds: dr, max_session_seconds: gate::MAX_CONTINUOUS_PLAY_SECONDS })
}

#[tauri::command]
pub fn acknowledge_safety(read: bool, no_cond: bool, safety: State<SafetyState>, storage: State<StorageState>) -> Result<SafetyAcknowledgment, String> {
    let mut gate = safety.gate.lock().unwrap();
    let ack = gate.acknowledge(read, no_cond, safety.app_version.clone());
    storage.db.lock().unwrap().save_pref("safety_warning_accepted", &ack.accepted.to_string())?;
    storage.db.lock().unwrap().save_pref("safety_ack_timestamp", &ack.timestamp.to_string())?;
    storage.db.lock().unwrap().save_pref("safety_ack_version", &ack.app_version)?;
    Ok(ack)
}

#[tauri::command]
pub fn discomfort_stop(audio: State<AudioState>, safety: State<SafetyState>, storage: State<StorageState>) -> Result<(), String> {
    if let Some(ref mut e) = *audio.engine.lock().unwrap() { e.fade_out(); }
    *audio.engine.lock().unwrap() = None;
    let now = chrono::Utc::now().timestamp();
    *safety.discomfort_until.lock().unwrap() = Some(now + gate::DISCOMFORT_COOLDOWN_SECONDS);
    let _ = storage.db.lock().unwrap().log_usage(&UsageLog { id: None, context_type: "DiscomfortStop".to_string(), beat_type: "None".to_string(), app_name: "Safety".to_string(), duration_secs: 0, timestamp: now });
    Ok(())
}

#[tauri::command]
pub fn enable_gamma(safety: State<SafetyState>, storage: State<StorageState>) -> Result<(), String> {
    if !*safety.gamma_confirmed.lock().unwrap() { return Err("Gamma confirmation required".into()); }
    *safety.gamma_enabled.lock().unwrap() = true;
    storage.db.lock().unwrap().save_pref("gamma_enabled", "true")?;
    Ok(())
}

#[tauri::command]
pub fn confirm_gamma_warning(safety: State<SafetyState>) -> Result<(), String> { *safety.gamma_confirmed.lock().unwrap() = true; Ok(()) }

#[tauri::command]
pub fn get_session_info(safety: State<SafetyState>) -> Result<SessionInfo, String> {
    let ps = *safety.continuous_play_seconds.lock().unwrap();
    let br = *safety.break_required.lock().unwrap();
    Ok(SessionInfo { session_active: ps > 0 && !br, elapsed_seconds: ps, remaining_seconds: (gate::MAX_CONTINUOUS_PLAY_SECONDS - ps).max(0), break_required: br })
}

// ─── License ───────────────────────────────────────────────

#[tauri::command]
pub fn get_license_info(license: State<LicenseState>) -> Result<crate::license::LicenseInfo, String> { Ok(license.info.lock().unwrap().clone()) }

#[tauri::command]
pub async fn set_license_key(key: String, license: State<'_, LicenseState>) -> Result<crate::license::LicenseInfo, String> {
    let c = reqwest::Client::new();
    let r = c.post(&license.verification_url).json(&serde_json::json!({"key":key,"device_id":hostname::get().map(|h|h.to_string_lossy().to_string()).unwrap_or_else(|_|"unknown".into())})).send().await.map_err(|e| format!("Verify failed: {}", e))?;
    if r.status().is_success() {
        let info = r.json().await.map_err(|e| format!("Parse: {}", e))?;
        *license.info.lock().unwrap() = info.clone();
        Ok(info)
    } else { Err("Invalid license key".into()) }
}

#[tauri::command]
pub async fn verify_license(license: State<'_, LicenseState>) -> Result<bool, String> { Ok(license.is_valid()) }
