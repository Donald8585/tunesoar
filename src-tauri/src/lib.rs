mod audio;
mod auth_server;
mod commands;
mod context;
mod license;
mod safety;
mod storage;
mod tray;

use std::io::Write;

// Re-exports for testing
pub use audio::{AudioState, BeatType, ContextType, BeatProfile, DetectedContext};

use context::ContextState;
use cpal::traits::{DeviceTrait, HostTrait};
use license::LicenseState;
use safety::SafetyState;
use storage::StorageState;
use tauri::Manager;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // ── Auto-open DevTools in debug builds ──
            #[cfg(debug_assertions)]
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }

            // ── Audio device diagnostic at startup ──
            {
                let host = cpal::default_host();
                log::info!("[tunesoar:startup] cpal host: {:?}", host.id());
                match host.default_output_device() {
                    Some(dev) => {
                        log::info!("[tunesoar:startup] default output device: {:?}", dev.name());
                        match dev.default_output_config() {
                            Ok(cfg) => log::info!("[tunesoar:startup] config: {} Hz, {} channels, {:?}",
                                cfg.sample_rate().0, cfg.channels(), cfg.sample_format()),
                            Err(e) => log::error!("[tunesoar:startup] failed to get default config: {}", e),
                        }
                    }
                    None => log::error!("[tunesoar:startup] NO OUTPUT DEVICE FOUND — audio will not work!"),
                }
            }

            // Initialize storage
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            let storage_state = StorageState::new(&app_data_dir)
                .expect("Failed to initialize storage");

            // Create diagnostic log file
            let diag_path = app_data_dir.join("tunesoar-diag.log");
            if let Ok(mut f) = std::fs::File::create(&diag_path) {
                let _ = writeln!(f, "=== TuneSoar v{} started at {:?} ===", APP_VERSION, chrono::Utc::now());
            }
            crate::audio::binaural::set_diag_log_path(diag_path.to_string_lossy().to_string());

            app.manage(storage_state);

            // Initialize states
            app.manage(AudioState::new());
            app.manage(ContextState::new());
            app.manage(SafetyState::new(APP_VERSION.to_string()));
            app.manage(LicenseState::new());
            app.manage(commands::DesktopAuthToken::new());
            app.manage(commands::LoopbackServer::new());

            // ── Startup DB sync: restore persisted prefs to live AudioState ──
            let storage = app.state::<StorageState>();
            let audio = app.state::<AudioState>();
            match storage.db.lock().unwrap().get_prefs() {
                Ok(prefs) => {
                    *audio.volume.lock().unwrap() = prefs.volume;
                    *audio.carrier_frequency.lock().unwrap() = prefs.carrier_frequency;
                    log::info!("[tunesoar:audio] Startup sync: volume={:.3} carrier={:.0} Hz",
                        prefs.volume, prefs.carrier_frequency);
                }
                Err(e) => {
                    log::warn!("[tunesoar:audio] Startup sync failed: {}", e);
                }
            }

            // ── Minimize to tray on window close ──
            if let Some(window) = app.get_webview_window("main") {
                let handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let storage = handle.state::<StorageState>();
                        let minimize = storage.db.lock().unwrap()
                            .get_prefs()
                            .map(|p| p.minimize_to_tray)
                            .unwrap_or(true);
                        if minimize {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                log::info!("[tunesoar:audio] Minimized to tray");
                                let _ = w.hide();
                            }
                        }
                    }
                });
            }

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("Failed to create tray");

            // Context detection runs on-demand via frontend polling the
            // `detect_context` Tauri command (every 3s from the React UI).
            // This avoids thread-safety issues with platform-specific
            // window detection code and Tauri v2's runtime types.

            log::info!("TuneSoar v{} started successfully — auth: loopback server", APP_VERSION);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::set_manual_override,
            commands::resume_auto_detect,
            commands::set_volume,
            commands::set_carrier_frequency,
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
            commands::tick_session,
            commands::verify_license,
            commands::get_license_info,
            commands::set_license_key,
            commands::set_desktop_auth,
            commands::clear_desktop_auth,
            commands::ping_audio,
            commands::start_auth_server,
            commands::poll_auth_server,
            commands::stop_auth_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
