mod audio;
mod commands;
mod context;
mod license;
mod safety;
mod storage;
mod tray;
mod ws;

// Re-exports for testing
pub use audio::{AudioState, BeatType, ContextType, BeatProfile, DetectedContext};

use audio::AudioState;
use context::ContextState;
use license::LicenseState;
use safety::SafetyState;
use storage::StorageState;
use ws::WsState;
use std::sync::Arc;
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
            // Initialize storage
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            let storage_state = StorageState::new(&app_data_dir)
                .expect("Failed to initialize storage");
            app.manage(storage_state);

            // Initialize states
            app.manage(AudioState::new());
            app.manage(ContextState::new());
            app.manage(WsState::new());
            app.manage(SafetyState::new(APP_VERSION.to_string()));
            app.manage(LicenseState::new());

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("Failed to create tray");

            // Start WebSocket server for browser extension
            let ws_state = app.state::<WsState>();
            let auth_token = ws_state.auth_token.lock().unwrap().clone();
            let (url_tx, mut url_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

            let context_state = app.state::<ContextState>();
            let browser_url = context_state.browser_url.clone();

            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async move {
                    while let Some(url) = url_rx.recv().await {
                        let mut guard = browser_url.lock().unwrap();
                        *guard = Some(url);
                    }
                });
            });

            let ws_token = auth_token;
            let (ws_tx, _ws_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                let server = ws::server::WebSocketServer::new();
                rt.block_on(async move {
                    if let Err(e) = server.start(ws_tx, ws_token).await {
                        log::error!("WebSocket server error: {}", e);
                    }
                });
            });

            // Start periodic context detection (every 3 seconds)
            let handle_clone = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(3));

                    let audio_state = handle_clone.state::<AudioState>();
                    let context_state = handle_clone.state::<ContextState>();
                    let safety_state = handle_clone.state::<SafetyState>();

                    // Check discomfort cooldown
                    if let Some(until) = *safety_state.discomfort_until.lock().unwrap() {
                        let now = chrono::Utc::now().timestamp();
                        if now < until {
                            // Still in cooldown, don't play
                            continue;
                        }
                    }

                    // Check break cooldown
                    if *safety_state.break_required.lock().unwrap() {
                        if let Some(until) = *safety_state.break_cooldown_until.lock().unwrap() {
                            let now = chrono::Utc::now().timestamp();
                            if now < until {
                                continue; // In break
                            } else {
                                *safety_state.break_required.lock().unwrap() = false;
                                *safety_state.break_cooldown_until.lock().unwrap() = None;
                                *safety_state.continuous_play_seconds.lock().unwrap() = 0;
                            }
                        }
                    }

                    // Track continuous play time
                    let mut play_secs = safety_state.continuous_play_seconds.lock().unwrap();
                    *play_secs += 3;

                    // Check 90-minute limit
                    if *play_secs >= safety::gate::MAX_CONTINUOUS_PLAY_SECONDS {
                        *safety_state.break_required.lock().unwrap() = true;
                        let now = chrono::Utc::now().timestamp();
                        *safety_state.break_cooldown_until.lock().unwrap() =
                            Some(now + safety::gate::BREAK_DURATION_SECONDS);

                        // Emit break notification to frontend
                        if let Some(window) = handle_clone.get_webview_window("main") {
                            let _ = window.emit("break-required", ());
                        }

                        // Auto-pause audio
                        if let Some(ref mut engine) = *audio_state.engine.lock().unwrap() {
                            engine.fade_out();
                        }
                        continue;
                    }

                    let detector = context_state.detector.lock().unwrap();
                    let browser_url = context_state.browser_url.lock().unwrap().clone();

                    if let Ok((window_title, app_name)) = context::platform::get_active_window() {
                        let detected = detector.detect(
                            &window_title,
                            &app_name,
                            browser_url.as_deref(),
                        );

                        if detector.is_idle() {
                            let idle_ctx = audio::DetectedContext {
                                context_type: audio::ContextType::Idle,
                                ..detected
                            };
                            audio::update_beat_for_context(&audio_state, &idle_ctx);
                        } else {
                            detector.mark_active();
                            audio::update_beat_for_context(&audio_state, &detected);
                            *detector.current_context.lock().unwrap() = Some(detected);
                        }
                    }
                }
            });

            log::info!("Attunely v{} started successfully", APP_VERSION);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::set_volume,
            commands::toggle_playback,
            commands::detect_context,
            commands::get_prefs,
            commands::save_pref,
            commands::get_mappings,
            commands::save_mapping,
            commands::delete_mapping,
            commands::get_ws_token,
            commands::set_browser_url,
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
