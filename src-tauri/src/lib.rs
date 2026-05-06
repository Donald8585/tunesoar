mod audio;
mod commands;
mod context;
mod storage;
mod tray;
mod ws;

use audio::AudioState;
use context::ContextState;
use storage::StorageState;
use ws::WsState;
use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;

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

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("Failed to create tray");

            // Start WebSocket server for browser extension
            let ws_state = app.state::<WsState>();
            let auth_token = ws_state.auth_token.lock().unwrap().clone();
            let (url_tx, mut url_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

            // Store URL updates into context state (via Arc)
            let context_state = app.state::<ContextState>();
            let browser_url = context_state.browser_url.clone();

            // Spawn URL receiver
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async move {
                    while let Some(url) = url_rx.recv().await {
                        let mut guard = browser_url.lock().unwrap();
                        *guard = Some(url);
                    }
                });
            });

            // Spawn WebSocket server (separate channel pair)
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

                    let detector = context_state.detector.lock().unwrap();
                    let browser_url = context_state.browser_url.lock().unwrap().clone();

                    if let Ok((window_title, app_name)) = context::platform::get_active_window() {
                        let detected = detector.detect(
                            &window_title,
                            &app_name,
                            browser_url.as_deref(),
                        );

                        // Check idle
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

            log::info!("Attunely started successfully");
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
