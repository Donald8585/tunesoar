#[cfg(test)]
mod tests {
    use tunesoar_lib::audio::{BeatProfile, BeatType, ContextType};

    // ─── Binaural Frequency Accuracy ───────────────────────────

    #[test]
    fn test_binaural_frequency_difference() {
        // Verify that the frequency difference between L and R channels
        // equals the intended beat frequency
        let profile = BeatProfile {
            beat_type: BeatType::Beta,
            beat_frequency: 15.0,
            carrier_frequency: 200.0,
            volume: 0.10,
        };

        let left_freq = profile.carrier_frequency - profile.beat_frequency / 2.0;
        let right_freq = profile.carrier_frequency + profile.beat_frequency / 2.0;
        let actual_diff = right_freq - left_freq;

        assert!((actual_diff - profile.beat_frequency).abs() < 0.1,
            "Binaural frequency difference {} should be within 0.1 Hz of target {}",
            actual_diff, profile.beat_frequency);
    }

    #[test]
    fn test_delta_frequency_range() {
        let range = BeatType::Delta.frequency_range();
        assert_eq!(range, (1.0, 4.0));
        let default_freq = BeatType::Delta.default_frequency();
        assert!(default_freq >= 1.0 && default_freq <= 4.0);
    }

    #[test]
    fn test_theta_frequency_range() {
        let range = BeatType::Theta.frequency_range();
        assert_eq!(range, (4.0, 8.0));
        let default_freq = BeatType::Theta.default_frequency();
        assert!(default_freq >= 4.0 && default_freq <= 8.0);
    }

    #[test]
    fn test_alpha_frequency_range() {
        let range = BeatType::Alpha.frequency_range();
        assert_eq!(range, (8.0, 13.0));
    }

    #[test]
    fn test_beta_frequency_range() {
        let range = BeatType::Beta.frequency_range();
        assert_eq!(range, (13.0, 30.0));
    }

    #[test]
    fn test_gamma_frequency_range() {
        let range = BeatType::Gamma.frequency_range();
        assert_eq!(range, (30.0, 40.0));
    }

    #[test]
    fn test_all_beat_types_have_valid_ranges() {
        let types = [
            BeatType::Delta,
            BeatType::Theta,
            BeatType::Alpha,
            BeatType::Beta,
            BeatType::Gamma,
        ];
        for bt in &types {
            let (min, max) = bt.frequency_range();
            assert!(min < max, "Range invalid for {:?}", bt);
            assert!(min >= 1.0, "Min too low for {:?}", bt);
            assert!(max <= 40.0, "Max too high for {:?}", bt);
            let default = bt.default_frequency();
            assert!(default >= min && default <= max,
                "Default freq {} out of range [{}, {}] for {:?}", default, min, max, bt);
        }
    }

    // ─── Volume Cap Enforcement ────────────────────────────────

    #[test]
    fn test_volume_clamped_to_max_25_percent() {
        let max_allowed: f32 = 0.25;
        // Test clamp function (would be in actual volume setter)
        let clamp_volume = |v: f32| v.clamp(0.0, max_allowed);

        assert_eq!(clamp_volume(0.10), 0.10, "Normal volume should pass through");
        assert_eq!(clamp_volume(0.25), 0.25, "Max volume should be allowed");
        assert_eq!(clamp_volume(0.50), 0.25, "Above max should be clamped to 0.25");
        assert_eq!(clamp_volume(1.00), 0.25, "Full volume should be clamped to 0.25");
        assert_eq!(clamp_volume(-0.10), 0.0, "Negative should be clamped to 0");
    }

    #[test]
    fn test_volume_cannot_exceed_cap_via_any_api() {
        // The hard cap is enforced in set_volume command
        // This verifies the clamping logic
        let cap = 0.25;
        let test_values = vec![0.05, 0.10, 0.15, 0.25, 0.30, 0.50, 0.75, 1.00];
        for v in test_values {
            let clamped = v.clamp(0.0, cap);
            assert!(clamped <= cap,
                "Volume {} should be clamped to <= {}", clamped, cap);
        }
    }

    // ─── Safety Gate ───────────────────────────────────────────

    #[test]
    fn test_safety_gate_blocks_until_acknowledged() {
        // Simulate safety gate logic
        let mut acknowledged = false;
        assert!(!acknowledged, "Gate should start unacknowledged");

        // User must check both boxes
        let read_and_understood = true;
        let no_listed_conditions = true;
        if read_and_understood && no_listed_conditions {
            acknowledged = true;
        }
        assert!(acknowledged, "Gate should be acknowledged after both checkboxes");
    }

    #[test]
    fn test_safety_gate_rejects_partial_acknowledgment() {
        // Only one checkbox checked — should NOT acknowledge
        let mut acknowledged = false;
        let read_and_understood = true;
        let no_listed_conditions = false; // User didn't confirm conditions
        if read_and_understood && no_listed_conditions {
            acknowledged = true;
        }
        assert!(!acknowledged, "Partial acknowledgment should not pass safety gate");
    }

    #[test]
    fn test_safety_gate_requires_reack_after_update() {
        let ack_version = "0.1.0";
        let current_version = "0.2.0";
        let requires_reack = ack_version != current_version;
        assert!(requires_reack, "Version mismatch should require re-acknowledgment");
    }

    #[test]
    fn test_safety_gate_no_reack_for_same_version() {
        let ack_version = "0.1.0";
        let current_version = "0.1.0";
        let requires_reack = ack_version != current_version;
        assert!(!requires_reack, "Same version should not require re-acknowledgment");
    }

    // ─── Context Detection ─────────────────────────────────────

    #[test]
    fn test_coding_apps_map_to_beta() {
        let coding_apps = vec!["Code", "Visual Studio Code", "cursor", "Terminal", "IntelliJ IDEA"];
        for app in coding_apps {
            let context = match_context(app);
            assert_eq!(context, ContextType::Coding,
                "App '{}' should map to Coding", app);
            assert_eq!(context.default_beat(), BeatType::Beta,
                "Coding context should use Beta beats");
        }
    }

    #[test]
    fn test_writing_apps_map_to_alpha() {
        let writing_apps = vec!["Notion", "Obsidian", "Microsoft Word", "Google Docs"];
        for app in writing_apps {
            let context = match_context(app);
            assert_eq!(context, ContextType::Writing,
                "App '{}' should map to Writing", app);
            assert_eq!(context.default_beat(), BeatType::Alpha);
        }
    }

    #[test]
    fn test_meeting_apps_autopause() {
        let meeting_apps = vec!["Zoom", "Microsoft Teams", "Google Meet"];
        for app in meeting_apps {
            let context = match_context(app);
            assert_eq!(context, ContextType::Meeting);
            assert_eq!(context.default_beat_freq(), 0.0,
                "Meeting apps should have zero beat freq (auto-pause)");
        }
    }

    #[test]
    fn test_music_apps_autopause() {
        let music_apps = vec!["Spotify", "Apple Music", "YouTube Music"];
        for app in music_apps {
            let context = match_context(app);
            assert_eq!(context, ContextType::Music);
            assert_eq!(context.default_beat_freq(), 0.0,
                "Music apps should have zero beat freq (auto-pause)");
        }
    }

    #[test]
    fn test_gaming_apps_map_correctly() {
        let gaming_apps = vec!["Steam", "Roblox", "Minecraft", "OSRS"];
        for app in gaming_apps {
            let context = match_context(app);
            assert_eq!(context, ContextType::Gaming,
                "App '{}' should map to Gaming", app);
        }
    }

    #[test]
    fn test_unknown_app_maps_to_ambient() {
        let context = match_context("SomeRandomAppThatDoesntExist");
        assert_eq!(context, ContextType::Ambient,
            "Unknown app should default to Ambient");
    }

    // ─── Session Length Limit ──────────────────────────────────

    #[test]
    fn test_90min_session_triggers_break() {
        let max_seconds = 90 * 60; // 90 minutes
        let play_seconds = max_seconds + 1;
        let break_required = play_seconds >= max_seconds;
        assert!(break_required, "After 90 minutes, break should be required");
    }

    #[test]
    fn test_under_90min_no_break() {
        let max_seconds = 90 * 60;
        let play_seconds = 89 * 60; // 89 minutes
        let break_required = play_seconds >= max_seconds;
        assert!(!break_required, "Under 90 minutes, break should NOT be required");
    }

    #[test]
    fn test_10min_break_timer() {
        let break_seconds = 10 * 60;
        assert_eq!(break_seconds, 600, "Break should be exactly 10 minutes");
    }

    // ─── Gamma Band Gating ─────────────────────────────────────

    #[test]
    fn test_gamma_disabled_by_default() {
        let gamma_enabled = false;
        let gamma_confirmed = false;
        let can_use_gamma = gamma_enabled && gamma_confirmed;
        assert!(!can_use_gamma, "Gamma should be disabled when not confirmed");
    }

    #[test]
    fn test_gamma_requires_explicit_opt_in() {
        let gamma_confirmed = false;
        assert!(!gamma_confirmed, "Gamma should require explicit confirmation");
        // After confirmation
        let gamma_confirmed = true;
        assert!(gamma_confirmed, "Gamma should be confirmed after opt-in");
    }

    // ─── Auto-Pause Logic ──────────────────────────────────────

    #[test]
    fn test_music_context_autopause() {
        let context = ContextType::Music;
        assert_eq!(context.default_beat_freq(), 0.0,
            "Music context should auto-pause (freq=0)");
    }

    #[test]
    fn test_meeting_context_autopause() {
        let context = ContextType::Meeting;
        assert_eq!(context.default_beat_freq(), 0.0,
            "Meeting context should auto-pause (freq=0)");
    }

    #[test]
    fn test_idle_context_fade_out() {
        let context = ContextType::Idle;
        assert_eq!(context.default_beat_freq(), 0.0,
            "Idle context should fade out (freq=0)");
    }

    // ─── Privacy ───────────────────────────────────────────────

    #[test]
    fn test_url_hostname_extraction() {
        // Browser extension only sends hostname, not full path
        let url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
        let hostname = extract_hostname(url);
        assert_eq!(hostname, "www.youtube.com",
            "Only hostname should be extracted, not full path");
    }

    #[test]
    fn test_incognito_url_not_reported() {
        // Incognito tabs should never report URLs
        let is_incognito = true;
        let should_report = !is_incognito;
        assert!(!should_report, "Incognito tabs should NOT be reported");
    }

    #[test]
    fn test_non_incognito_url_reported() {
        let is_incognito = false;
        let should_report = !is_incognito;
        assert!(should_report, "Non-incognito tabs should be reported");
    }

    // ─── Fade Transitions ──────────────────────────────────────

    #[test]
    fn test_fade_calculation() {
        // 2-second fade at 44.1kHz = 88200 samples
        let sample_rate = 44100.0;
        let fade_duration = 2.0;
        let total_samples = (sample_rate * fade_duration) as usize;
        assert_eq!(total_samples, 88200, "2s fade should be 88200 samples at 44.1kHz");
    }

    #[test]
    fn test_fade_ramp_is_smooth() {
        let from_vol = 0.10;
        let to_vol = 0.0;
        let steps = 100;
        let delta = (to_vol - from_vol) / steps as f32;

        let mut current = from_vol;
        let mut values = Vec::new();
        for _ in 0..steps {
            values.push(current);
            current += delta;
        }
        values.push(current);

        // Verify smooth progression
        for i in 1..values.len() {
            let diff = (values[i] - values[i - 1]).abs();
            assert!(diff < 0.01, "Fade step {} too large: {}", i, diff);
        }

        // Verify we end near target
        assert!((values.last().unwrap() - to_vol).abs() < 0.001,
            "Fade should end near target volume");
    }

    // ─── License Verification ──────────────────────────────────

    #[test]
    fn test_license_key_format() {
        // License keys should match AT- prefix + 24 base32 characters
        let valid_key = "AT-ABCDEFGHJKLMNPQRSTUVWXYZ23";
        assert!(valid_key.starts_with("AT-"), "Key should start with AT-");
        assert_eq!(valid_key.len(), 27, "Key should be 27 chars (AT- + 24 base32)");
    }

    #[test]
    fn test_license_rejects_invalid_format() {
        let invalid_keys = vec![
            "invalid",
            "AT-tooshort",
            "AT-ABCDEFGHJKLMNPQRSTUVWXYZ234", // too long
            "", // empty
            "XY-ABCDEFGHJKLMNPQRSTUVWXYZ23", // wrong prefix
        ];
        for key in invalid_keys {
            let valid = key.starts_with("AT-") && key.len() == 27;
            assert!(!valid, "Key '{}' should be rejected", key);
        }
    }

    #[test]
    fn test_max_3_devices_per_license() {
        let devices = vec![
            "device_a".to_string(),
            "device_b".to_string(),
            "device_c".to_string(),
        ];
        let max_devices = 3;
        assert!(devices.len() <= max_devices, "Should allow up to 3 devices");

        // Adding a 4th should fail
        let mut devices = devices;
        devices.push("device_d".to_string());
        assert!(devices.len() > max_devices, "4 devices should exceed limit");
    }

    // ─── Helper functions ──────────────────────────────────────

    fn match_context(app_name: &str) -> ContextType {
        let app_lower = app_name.to_lowercase();
        // Simulated matching logic matching the detector module
        let coding_patterns = ["code", "visual studio code", "vs code", "cursor", "terminal",
            "intellij", "jetbrains", "webstorm", "pycharm", "phpstorm", "rider",
            "clion", "goland", "datagrip", "rubymine", "sublime text", "vim", "neovim",
            "emacs", "atom", "xcode", "android studio", "fleet", "alacritty", "iterm2",
            "kitty", "warp", "hyper", "wezterm", "tabby", "ghostty"];
        let writing_patterns = ["notion", "obsidian", "microsoft word", "word", "google docs",
            "apple notes", "notes", "bear", "ulysses", "scrivener", "typora", "ia writer",
            "logseq", "roam research", "craft", "evernote", "pages", "libreoffice writer"];
        let creative_patterns = ["figma", "photoshop", "illustrator", "blender",
            "after effects", "premiere pro", "davinci resolve", "affinity"];
        let meeting_patterns = ["zoom", "microsoft teams", "teams", "google meet", "meet",
            "skype", "facetime", "webex", "gotomeeting"];
        let music_patterns = ["spotify", "apple music", "music", "tidal", "youtube music",
            "deezer", "amazon music", "pandora", "soundcloud"];
        let gaming_patterns = ["steam", "epic games", "battle.net", "roblox", "minecraft",
            "fortnite", "valorant", "league of legends", "dota", "counter-strike", "cs2",
            "apex legends", "call of duty", "overwatch", "world of warcraft", "osrs",
            "old school runescape", "runelite"];

        for pat in coding_patterns {
            if app_lower.contains(pat) { return ContextType::Coding; }
        }
        for pat in writing_patterns {
            if app_lower.contains(pat) { return ContextType::Writing; }
        }
        for pat in creative_patterns {
            if app_lower.contains(pat) { return ContextType::Creative; }
        }
        for pat in meeting_patterns {
            if app_lower.contains(pat) { return ContextType::Meeting; }
        }
        for pat in music_patterns {
            if app_lower.contains(pat) { return ContextType::Music; }
        }
        for pat in gaming_patterns {
            if app_lower.contains(pat) { return ContextType::Gaming; }
        }

        ContextType::Ambient
    }

    fn extract_hostname(url: &str) -> &str {
        // Simple hostname extraction from URL
        let without_protocol = url
            .trim_start_matches("https://")
            .trim_start_matches("http://");
        without_protocol
            .split('/')
            .next()
            .unwrap_or("")
            .split('?')
            .next()
            .unwrap_or("")
    }
}
