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
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowTextLengthW,
    };
    use windows::Win32::System::Threading::{
        GetWindowThreadProcessId, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_NAME_FORMAT, PROCESS_QUERY_INFORMATION, PROCESS_VMREAD,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return Ok(("Unknown".to_string(), "Unknown".to_string()));
        }

        // Get window title
        let len = GetWindowTextLengthW(hwnd);
        let mut title_buf = vec![0u16; (len + 1) as usize];
        GetWindowTextW(hwnd, &mut title_buf);
        let window_title = String::from_utf16_lossy(&title_buf[..len as usize]);

        // Get app name from process
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        if pid == 0 {
            return Ok((window_title, "Unknown".to_string()));
        }

        let app_name = get_process_name_windows(pid)
            .unwrap_or_else(|| "Unknown".to_string());

        Ok((window_title, app_name))
    }
}

#[cfg(target_os = "windows")]
fn get_process_name_windows(pid: u32) -> Option<String> {
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_INFORMATION, PROCESS_VMREAD,
    };

    unsafe {
        let handle = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VMREAD,
            false,
            pid,
        )
        .ok()?;

        let mut exe_buf = vec![0u16; 260];
        let mut len = exe_buf.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            &mut exe_buf,
            &mut len,
        );

        if result.is_err() {
            return None;
        }

        let path = String::from_utf16_lossy(&exe_buf[..len as usize]);
        // Extract filename from path
        std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    }
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
