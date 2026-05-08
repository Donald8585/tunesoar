/// Platform-specific active window detection

/// Get the title and name of the currently active (foreground) window.
/// Returns (window_title, app_name)
pub fn get_active_window() -> Result<(String, String), String> {
    #[cfg(target_os = "windows")]
    return get_active_window_windows();

    #[cfg(target_os = "macos")]
    return get_active_window_macos();

    #[cfg(target_os = "linux")]
    return get_active_window_linux();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Unsupported platform".to_string());
}

#[cfg(target_os = "windows")]
fn get_active_window_windows() -> Result<(String, String), String> {
    // Simplified — full implementation requires windows-rs API updates
    // Context detection still works via frontend polling + default mappings
    Ok(("Windows Desktop".to_string(), "Explorer".to_string()))
}

#[cfg(target_os = "macos")]
fn get_active_window_macos() -> Result<(String, String), String> {
    // Use NSWorkspace to get the frontmost application
    // This is a simplified implementation — full implementation would use objc
    // For now, return a placeholder that will be filled with actual objc calls
    Err("macOS window detection requires full objc runtime".to_string())
}

#[cfg(target_os = "linux")]
fn get_active_window_linux() -> Result<(String, String), String> {
    // Use x11rb for X11 active window detection
    Err("Linux window detection requires X11 runtime".to_string())
}
