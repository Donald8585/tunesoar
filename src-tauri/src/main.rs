// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Bypass WebView2 autoplay policy on Windows desktop builds.
    // Without this, Web Audio API / <audio> calls from Tauri webview
    // fail silently on production builds with no user gesture.
    // See: Tauri issue #4624, #9968
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--autoplay-policy=no-user-gesture-required"
    );

    tunesoar_lib::run();
}
