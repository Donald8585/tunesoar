/// Platform-specific active window detection
/// Returns (window_title, app_name) for the currently focused window

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

// ── Windows ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_active_window_windows() -> Result<(String, String), String> {
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::System::ProcessStatus::K32GetModuleBaseNameW;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err("No foreground window".to_string());
        }

        // Window title
        let len = GetWindowTextLengthW(hwnd);
        let mut buf = vec![0u16; (len + 1) as usize];
        let actual = GetWindowTextW(hwnd, &mut buf);
        let title = if actual > 0 {
            String::from_utf16_lossy(&buf[..actual as usize]).trim().to_string()
        } else {
            "Unknown".to_string()
        };

        // Process name from PID → executable
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let app_name = if pid > 0 {
            match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                Ok(h) => {
                    let mut name_buf = vec![0u16; 260];
                    let name_len = K32GetModuleBaseNameW(h, None, &mut name_buf);
                    let _ = windows::Win32::Foundation::CloseHandle(h);
                    if name_len > 0 {
                        let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
                        name.trim_end_matches(".exe").to_string()
                    } else {
                        format!("PID:{}", pid)
                    }
                }
                Err(_) => format!("PID:{}", pid),
            }
        } else {
            "Unknown".to_string()
        };

        // Filter out own process
        let own = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().to_lowercase()))
            .unwrap_or_default();
        if app_name.to_lowercase() == own || title.to_lowercase() == own {
            return Err("Own window is foreground".to_string());
        }

        // Filter out own process and desktop/shell windows
        let own = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().to_lowercase()))
            .unwrap_or_default();
        let app_lower = app_name.to_lowercase();
        if app_lower == own || title.to_lowercase() == own
            || app_lower == "explorer" || title.is_empty()
        {
            return Err("Own or system window is foreground".to_string());
        }

        Ok((title, app_name))
    }
}

// ── macOS ──────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn get_active_window_macos() -> Result<(String, String), String> {
    use objc::{class, msg_send, sel, sel_impl};
    use objc::runtime::Object;
    use std::ffi::CStr;

    unsafe {
        let workspace: *mut Object = msg_send![class!(NSWorkspace), sharedWorkspace];
        let app: *mut Object = msg_send![workspace, frontmostApplication];
        if app.is_null() {
            return Err("No frontmost application".to_string());
        }

        // Get localized app name
        let name_obj: *mut Object = msg_send![app, localizedName];
        let app_name = if !name_obj.is_null() {
            let utf8: *const i8 = msg_send![name_obj, UTF8String];
            if utf8.is_null() {
                "Unknown".to_string()
            } else {
                CStr::from_ptr(utf8).to_string_lossy().to_string()
            }
        } else {
            "Unknown".to_string()
        };

        // Attempt window title via AXUIElement (requires Accessibility permission)
        // Fall back to app name if unavailable
        let pid: i32 = msg_send![app, processIdentifier];
        let title = macos_window_title(pid).unwrap_or_else(|_| app_name.clone());

        // Filter out own process
        let own = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().to_lowercase()))
            .unwrap_or_default();
        if app_name.to_lowercase() == own {
            return Err("Own app is frontmost".to_string());
        }

        Ok((title, app_name))
    }
}

#[cfg(target_os = "macos")]
fn macos_window_title(pid: i32) -> Result<String, String> {
    use std::ffi::{c_void, CStr};

    // Link to ApplicationServices framework at module level is fine
    // We declare these in a module-level extern block

    unsafe {
        // Get AX application element
        let ax = macos_ax_create_application(pid);
        if ax.is_null() {
            return Err("AX not available".to_string());
        }

        // Get focused window
        let mut window: *mut c_void = std::ptr::null_mut();
        let attr: &[u8] = b"AXFocusedWindow\0";
        let code = macos_ax_copy_value(ax, attr.as_ptr() as *const i8, &mut window);
        if code != 0 || window.is_null() {
            macos_cf_release(ax);
            return Err("No focused window".to_string());
        }

        // Get window title
        let mut title_ref: *mut c_void = std::ptr::null_mut();
        let title_attr: &[u8] = b"AXTitle\0";
        let code2 = macos_ax_copy_value(window, title_attr.as_ptr() as *const i8, &mut title_ref);

        let title = if code2 == 0 && !title_ref.is_null() {
            macos_cfstring_to_string(title_ref)
        } else {
            "Unknown".to_string()
        };

        if !title_ref.is_null() { macos_cf_release(title_ref); }
        macos_cf_release(window);
        macos_cf_release(ax);

        Ok(title)
    }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateApplication(pid: i32) -> *mut std::ffi::c_void;
    fn AXUIElementCopyAttributeValue(
        element: *mut std::ffi::c_void,
        attribute: *const i8,
        value: *mut *mut std::ffi::c_void,
    ) -> i32;
}

#[cfg(target_os = "macos")]
unsafe fn macos_ax_create_application(pid: i32) -> *mut std::ffi::c_void {
    AXUIElementCreateApplication(pid)
}

#[cfg(target_os = "macos")]
unsafe fn macos_ax_copy_value(
    element: *mut std::ffi::c_void,
    attr: *const i8,
    value: *mut *mut std::ffi::c_void,
) -> i32 {
    AXUIElementCopyAttributeValue(element, attr, value)
}

#[cfg(target_os = "macos")]
unsafe fn macos_cf_release(cf: *mut std::ffi::c_void) {
    // Call CFRelease from CoreFoundation (linked by default on macOS)
    extern "C" { fn CFRelease(cf: *mut std::ffi::c_void); }
    CFRelease(cf);
}

#[cfg(target_os = "macos")]
unsafe fn macos_cfstring_to_string(cf: *mut std::ffi::c_void) -> String {
    use std::ffi::CStr;
    // CFStringGetCStringPtr is fast if internal representation is UTF-8
    extern "C" {
        fn CFStringGetCStringPtr(
            string: *mut std::ffi::c_void,
            encoding: u32,
        ) -> *const i8;
        fn CFStringGetLength(string: *mut std::ffi::c_void) -> isize;
        fn CFStringGetCString(
            string: *mut std::ffi::c_void,
            buffer: *mut i8,
            buffer_size: isize,
            encoding: u32,
        ) -> i8;
    }

    // kCFStringEncodingUTF8 = 0x08000100
    let utf8_encoding: u32 = 0x08000100;
    let ptr = CFStringGetCStringPtr(cf, utf8_encoding);
    if !ptr.is_null() {
        return CStr::from_ptr(ptr).to_string_lossy().to_string();
    }

    // Fallback: allocate buffer
    let len = CFStringGetLength(cf);
    if len <= 0 {
        return "Unknown".to_string();
    }
    // Estimate max UTF-8 size: 4 bytes per char + NUL
    let buf_size = len * 4 + 1;
    let mut buf: Vec<i8> = vec![0; buf_size as usize];
    if CFStringGetCString(cf, buf.as_mut_ptr(), buf_size, utf8_encoding) != 0 {
        CStr::from_ptr(buf.as_ptr()).to_string_lossy().to_string()
    } else {
        "Unknown".to_string()
    }
}

// ── Linux ──────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn get_active_window_linux() -> Result<(String, String), String> {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::ConnectionExt;
    use x11rb::rust_connection::RustConnection;
    use x11rb::wrapper::ConnectionExt as WrapperExt;
    use x11rb::atom_manager;

    atom_manager! {
        ActiveWindowAtoms: ActiveWindowCookie {
            _NET_ACTIVE_WINDOW,
            _NET_WM_NAME,
            WM_NAME,
            _NET_WM_PID,
            UTF8_STRING,
        }
    }

    let (conn, screen_num) = RustConnection::connect(None)
        .map_err(|e| format!("X11: {}", e))?;

    let atoms = ActiveWindowAtoms::new(&conn)
        .map_err(|e| format!("Atom: {}", e))?
        .reply()
        .map_err(|e| format!("Atom reply: {}", e))?;

    let screen = &conn.setup().roots[screen_num];
    let active = conn
        .get_property(
            false,
            screen.root,
            atoms._NET_ACTIVE_WINDOW,
            x11rb::protocol::xproto::AtomEnum::WINDOW,
            0,
            1,
        )
        .map_err(|e| format!("Prop: {}", e))?
        .reply()
        .map_err(|e| format!("Reply: {}", e))?;

    // value32() returns Option<impl Iterator> in x11rb 0.13
    let raw_vals: Vec<u32> = active.value32().map(|it| it.collect()).unwrap_or_default();
    let raw = if raw_vals.len() >= 1 && raw_vals[0] != 0 {
        raw_vals[0]
    } else {
        return Err("No active window (root or empty)".to_string());
    };

    let window = x11rb::protocol::xproto::Window::from(raw);

    // Window title
    let title = conn
        .get_property(false, window, atoms._NET_WM_NAME, atoms.UTF8_STRING, 0, 1024)
        .ok()
        .and_then(|r| r.reply().ok())
        .and_then(|r| String::from_utf8(r.value).ok())
        .or_else(|| {
            conn.get_property(false, window, atoms.WM_NAME, atoms.UTF8_STRING, 0, 1024)
                .ok()
                .and_then(|r| r.reply().ok())
                .and_then(|r| String::from_utf8(r.value).ok())
        })
        .unwrap_or_else(|| "Unknown".to_string());

    // Process name from /proc/<pid>/comm
    let app_name = conn
        .get_property(false, window, atoms._NET_WM_PID, x11rb::protocol::xproto::AtomEnum::CARDINAL, 0, 1)
        .ok()
        .and_then(|r| r.reply().ok())
        .and_then(|r| {
            let vals: Vec<u32> = r.value32().map(|it| it.collect()).unwrap_or_default();
            if vals.is_empty() { None } else { Some(vals[0]) }
        })
        .and_then(|pid| std::fs::read_to_string(format!("/proc/{}/comm", pid)).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    Ok((title, app_name))
}
