mod audio;
mod commands;
mod context;
mod license;
mod safety;
mod storage;
mod tray;

pub use audio::{AudioState, BeatType, ContextType, BeatProfile, DetectedContext};
use audio::AudioState;
use context::ContextState;
use license::LicenseState;
use safety::SafetyState;
use storage::StorageState;
use std::time::Duration;
use tauri::Manager;
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Data directory
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let storage_state = StorageState::new(&app_data_dir).expect("Failed to initialize storage");
            app.manage(storage_state);
            // App states
            app.manage(AudioState::new());
            app.manage(ContextState::new());
            app.manage(SafetyState::new(APP_VERSION.to_string()));
            app.manage(LicenseState::new());
            // System tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("Failed to create tray");
            // ── Periodic context detection (every 3 s) ──────
            let h = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(3));
                let audio_state = h.state::<AudioState>();
                let context_state = h.state::<ContextState>();
                let safety_state = h.state::<SafetyState>();
                // Discomfort cooldown
                if let Some(until) = *safety_state.discomfort_until.lock().unwrap() {
                    if chrono::Utc::now().timestamp() < until { continue; }
                }
                // Break cooldown
                if *safety_state.break_required.lock().unwrap() {
                    if let Some(until) = *safety_state.break_cooldown_until.lock().unwrap() {
                        let now = chrono::Utc::now().timestamp();
                        if now < until {
                            continue;
                        }
                        *safety_state.break_required.lock().unwrap() = false;
                        *safety_state.break_cooldown_until.lock().unwrap() = None;
                        *safety_state.continuous_play_seconds.lock().unwrap() = 0;
                    }
                // Track continuous play
                let mut ps = safety_state.continuous_play_seconds.lock().unwrap();
                *ps += 3;
                if *ps >= safety::gate::MAX_CONTINUOUS_PLAY_SECONDS {
                    *safety_state.break_required.lock().unwrap() = true;
                    let now = chrono::Utc::now().timestamp();
                    *safety_state.break_cooldown_until.lock().unwrap() =
                        Some(now + safety::gate::BREAK_DURATION_SECONDS);
                    if let Some(w) = h.get_webview_window("main") { let _ = w.emit("break-required", ()); }
                    if let Some(ref mut e) = *audio_state.engine.lock().unwrap() { e.fade_out(); }
                    continue;
                let detector = context_state.detector.lock().unwrap();
                // Respect manual override — skip auto-detection
                if !*detector.auto_detect_enabled.lock().unwrap() {
                let (window_title, app_name) =
                    match context::platform::get_active_window() {
                        Ok(v) => v,
                        Err(e) => { log::warn!("Window detection error: {}", e); continue; }
                    };
                let detected = detector.detect(&window_title, &app_name);
                if detector.is_idle() {
                    let idle_ctx = audio::DetectedContext {
                        context_type: audio::ContextType::Idle,
                        ..detected
                    audio::update_beat_for_context(&audio_state, &idle_ctx);
                } else {
                    detector.mark_active();
                    audio::update_beat_for_context(&audio_state, &detected);
                    *detector.current_context.lock().unwrap() = Some(detected);
            });
            log::info!("TuneSoar v{} started", APP_VERSION);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::set_manual_override,
            commands::resume_auto_detect,
            commands::set_volume,
            commands::toggle_playback,
            commands::detect_context,
            commands::get_prefs,
            commands::save_pref,
            commands::get_mappings,
            commands::save_mapping,
            commands::delete_mapping,
            commands::get_usage_stats,
            commands::log_usage,
            commands::accept_safety_warning,
            commands::is_safety_accepted,
            commands::acknowledge_safety,
            commands::get_safety_status,
            commands::discomfort_stop,
            commands::enable_gamma,
            commands::confirm_gamma_warning,
            commands::get_session_info,
            commands::verify_license,
            commands::get_license_info,
            commands::set_license_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
