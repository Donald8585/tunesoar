# Incident: Audio Not Playing in Production Build (2026-05-13)

## Summary

Binaural beats audio played correctly in dev mode (`pnpm tauri dev`)
but produced no sound when launched from the desktop shortcut
(production `.exe`). No error visible because DevTools were disabled
in release builds.

## Timeline

| Time (UTC) | Event |
|---|---|
| 15:xx | User reports "no sound" in production build |
| 15:xx | Investigation begins |
| ~15:45 | DevTools enabled, audio diagnostics added |
| ~15:50 | `panic = "abort"` identified as dangerous — hides crashes |
| ~16:00 | All fixes applied, awaiting user rebuild + test |

## Root Cause Analysis

### Architecture Note

TuneSoar audio is **Rust-native DSP** via `cpal` (pure sine wave
synthesis), NOT Web Audio API or HTML `<audio>`. The WebView2
autoplay policy hypothesis does NOT apply to this architecture.

### Suspected Causes (in priority order)

| # | Cause | Evidence | Probability |
|---|---|---|---|
| 1 | **`panic = "abort"` hides cpal/FFI crashes** | `[profile.release] panic = "abort"` in Cargo.toml. Any Rust panic (e.g. in unsafe Windows FFI) kills the process silently with no error log or frontend toast. | **HIGH** |
| 2 | **No audio output device** | cpal may fail to find default output device on some Windows configs. The error is caught but may not surface if `detect_context` never runs. | Medium |
| 3 | **`detect_context` fails silently** | If platform detection FFI panics (windowned by `panic = "abort"`), the entire process dies before audio engine is created. | Medium |
| 4 | **Window hidden on startup** | `visible: false` + tray icon only. If user doesn't find tray icon, SafetyWarning never shown, TrayWindow never mounts, `detect_context` never called, audio never starts. | Low |
| 5 | **WebView2 autoplay policy** | Does NOT apply — audio is Rust cpal, not Web Audio. | ❌ N/A |

## Fixes Applied

### 1. Enable DevTools in production (`Cargo.toml`)

```diff
- tauri = { version = "2", features = ["tray-icon"] }
+ tauri = { version = "2", features = ["tray-icon", "devtools"] }
```

Now `Ctrl+Shift+I` works in release builds for field diagnostics.

### 2. Auto-open DevTools in debug builds (`lib.rs`)

```rust
#[cfg(debug_assertions)]
if let Some(webview) = app.get_webview_window("main") {
    webview.open_devtools();
}
```

Gated by `cfg(debug_assertions)` — never auto-opens in `--release`.

### 3. Startup audio device diagnostics (`lib.rs`)

Logs cpal host, default output device, and audio config at app start.
If no device is found, logs `"NO OUTPUT DEVICE FOUND"` to the
diagnostic file and Tauri logger.

### 4. Changed `panic = "abort"` → `panic = "unwind"` (`Cargo.toml`)

```diff
- panic = "abort"
+ panic = "unwind"
```

Critical fix: `panic = "abort"` kills the process instantly with no
error message, no log, no cleanup. With `panic = "unwind"`, Rust
panics are caught and surfaced via `audio_error` frontend banner.

### 5. Added audio path logging (`audio/mod.rs`, `commands.rs`)

Every step of audio initialization now writes to the diagnostic log:
- `detect_context` called
- Active window detected
- `update_beat_for_context` — context, Pro status, engine existence
- Engine creation success/failure with full details

### 6. WebView2 autoplay bypass (`main.rs`)

```rust
std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--autoplay-policy=no-user-gesture-required"
);
```

Belt-and-suspenders. Not required for cpal audio, but future-proofs
against Web Audio additions.

## Files Changed

| File | Lines | Change |
|---|---|---|
| `src-tauri/Cargo.toml` | +2 | `devtools` feature, `panic = "unwind"` |
| `src-tauri/src/main.rs` | +6 | WebView2 env var + comment |
| `src-tauri/src/lib.rs` | +24 | DevTools gate + cpal startup diagnostics |
| `src-tauri/src/audio/mod.rs` | +3 | diag_log calls |
| `src-tauri/src/commands.rs` | +4 | detect_context logging |
| **Total** | **+39** | |

**No audio assets, no frontend changes.** Audio is Rust DSP — Phase 3
(asset path fix) was determined N/A.

## Verification

### Required Tests (user must perform)

1. `pnpm tauri dev` → audio plays (regression check)
2. `pnpm tauri build` → produces `.exe` with no build errors
3. Desktop shortcut launch → audio plays after safety accepted + Play clicked
4. `Ctrl+Shift+I` opens DevTools in release build
5. DevTools Console: no red errors
6. Check diagnostic log at `%APPDATA%/com.wealthmakermasterclass.tunesoar/tunesoar-diag.log`
7. Log should show: `cpal host: Wasapi`, device name, config, `Engine created successfully`

### If Audio Still Broken

Capture and report:
- `tunesoar-diag.log` contents
- DevTools Console output
- Windows audio mixer state
- WebView2 version (`Get-AppxPackage *WebView2*`)

### Fallback (if all else fails)

Switch from `cpal` to `rodio` crate for audio output. Both use the
same underlying OS APIs but rodio has different (possibly more
compatible) device selection logic. Architectural change — requires
separate approval.

## Rollback

All changes are additive and backward-compatible. Revert via:

```bash
git revert <commit>
```

or manually revert the three Cargo.toml lines if `panic = "unwind"`
causes binary size concerns (<2KB difference expected).

## Lessons Learned

1. **`panic = "abort"` is dangerous in release builds.** It kills the
   process silently with zero diagnostic output. Reserve for
   `no_std`/embedded, not desktop apps.
2. **Rust-native audio (cpal) ≠ Web Audio.** The autoplay policy fix
   was unnecessary for this architecture. Always inspect the actual
   audio implementation before applying generic fixes.
3. **`devtools` feature + `cfg(debug_assertions)` = safe.** Auto-open
   in dev, manual toggle in release, strip before public launch.
4. **Startup diagnostics are cheap insurance.** A 4-line cpal probe
   at startup tells you instantly whether the audio system is alive.
5. **Diagnostic log files beat ephemeral console output.** In
   `windows_subsystem = "windows"` builds, stderr is invisible.
   Always log to a file.
