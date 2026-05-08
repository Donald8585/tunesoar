mod audio;
mod commands;
mod context;
mod license;
mod safety;
mod storage;
mod tray;

// Re-exports for testing
pub use audio::{AudioState, BeatType, ContextType, BeatProfile, DetectedContext};

use context::ContextState;
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
            app.manage(SafetyState::new(APP_VERSION.to_string()));
            app.manage(LicenseState::new());

            // Create system tray
            let handle = app.handle().clone();
            tray::create_tray(&handle).expect("Failed to create tray");

            // Context detection runs on-demand via frontend polling the
            // `detect_context` Tauri command (every 3s from the React UI).
            // This avoids thread-safety issues with platform-specific
            // window detection code and Tauri v2's runtime types.

            log::info!("TuneSoar v{} started successfully", APP_VERSION);
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
