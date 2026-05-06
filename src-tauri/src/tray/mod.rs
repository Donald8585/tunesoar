pub mod menu;

use tauri::{
    AppHandle, Runtime,
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Create and configure the system tray icon with full menu
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Main items
    let context_label = MenuItemBuilder::with_id("context_label", "Attunely — Waiting...").build(app)?;
    let separator1 = PredefinedMenuItem::separator(app)?;

    // Pause/Resume
    let toggle_item = MenuItemBuilder::with_id("toggle", "▶ Play/Pause").build(app)?;

    // Override context submenu
    let override_focus = MenuItemBuilder::with_id("override_focus", "🧠 Focus (Beta 15 Hz)").build(app)?;
    let override_relax = MenuItemBuilder::with_id("override_relax", "🌊 Relax (Alpha 10 Hz)").build(app)?;
    let override_creative = MenuItemBuilder::with_id("override_creative", "🎨 Creative (Theta 6 Hz)").build(app)?;
    let override_sleep = MenuItemBuilder::with_id("override_sleep", "🌙 Sleep (Delta 2 Hz)").build(app)?;
    let override_meeting = MenuItemBuilder::with_id("override_meeting", "🔇 Meeting-safe (Pause)").build(app)?;
    let override_off = MenuItemBuilder::with_id("override_off", "⏹ Turn Off").build(app)?;

    let override_menu = SubmenuBuilder::new(app, "Override Context")
        .item(&override_focus)
        .item(&override_relax)
        .item(&override_creative)
        .item(&override_sleep)
        .item(&override_meeting)
        .item(&override_off)
        .build()?;

    let separator2 = PredefinedMenuItem::separator(app)?;

    // Discomfort button (prominent, red)
    let discomfort_item = MenuItemBuilder::with_id("discomfort", "⚠️ I feel unwell — Stop now").build(app)?;

    let separator3 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItemBuilder::with_id("settings", "⚙ Settings...").build(app)?;
    let separator4 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit Attunely").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&context_label)
        .item(&separator1)
        .item(&toggle_item)
        .item(&override_menu)
        .item(&separator2)
        .item(&discomfort_item)
        .item(&separator3)
        .item(&settings_item)
        .item(&separator4)
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Attunely — Context-Aware Binaural Beats")
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "toggle" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("tray-toggle", ());
                    }
                }
                "override_focus" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Focus");
                    }
                }
                "override_relax" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Relax");
                    }
                }
                "override_creative" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Creative");
                    }
                }
                "override_sleep" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Sleep");
                    }
                }
                "override_meeting" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Meeting");
                    }
                }
                "override_off" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("override-context", "Off");
                    }
                }
                "discomfort" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("discomfort-stop", ());
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("navigate", "/settings");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
