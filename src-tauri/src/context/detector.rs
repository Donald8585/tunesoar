pub mod platform;

use crate::audio::{ContextType, DetectedContext};
use chrono::{Local, Timelike};
use std::collections::HashMap;
use std::sync::Mutex;

/// App name to context mapping
pub struct ContextDetector {
    /// App name patterns → ContextType
    pub app_mappings: Mutex<HashMap<String, ContextType>>,
    /// URL patterns → ContextType (from browser extension)
    /// Current detected context
    pub current_context: Mutex<Option<DetectedContext>>,
    /// Last active timestamp (for idle detection)
    pub last_active: Mutex<i64>,
    /// Whether audio from other apps is detected
    pub other_audio_active: Mutex<bool>,
}

impl ContextDetector {
    pub fn new() -> Self {
        let mut app_mappings = HashMap::new();

        // Default app → context mappings
        // Coding
        for app in &[
            "Code", "Visual Studio Code", "VS Code", "cursor", "Cursor",
            "IntelliJ IDEA", "WebStorm", "PyCharm", "PhpStorm", "Rider",
            "CLion", "GoLand", "DataGrip", "RubyMine", "JetBrains",
            "Terminal", "Windows Terminal", "Alacritty", "iTerm2", "kitty",
            "Warp", "Hyper", "wezterm", "Tabby", "Ghostty",
            "Sublime Text", "Vim", "Neovim", "Emacs", "Atom",
            "Xcode", "Android Studio", "Fleet",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Coding);
        }

        // Writing
        for app in &[
            "Notion", "Obsidian", "Microsoft Word", "Word",
            "Google Docs", "Apple Notes", "Notes",
            "Bear", "Ulysses", "Scrivener", "Typora", "iA Writer",
            "Logseq", "Roam Research", "Craft", "Evernote",
            "Pages", "LibreOffice Writer", "OpenOffice Writer",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Writing);
        }

        // Creative
        for app in &[
            "Figma", "Photoshop", "Adobe Photoshop",
            "Illustrator", "Adobe Illustrator", "Blender",
            "After Effects", "Premiere Pro", "DaVinci Resolve",
            "Affinity Designer", "Affinity Photo", "Sketch",
            "InDesign", "Lightroom", "Procreate",
            "GIMP", "Inkscape", "Krita", "Aseprite",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Creative);
        }

        // Communication
        for app in &[
            "Gmail", "Outlook", "Mail", "Thunderbird",
            "Slack", "Microsoft Teams", "Teams", "Discord",
            "Telegram", "Signal", "WhatsApp", "Messenger",
            "Spark", "Superhuman", "Hey", "Proton Mail",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Communication);
        }

        // Meeting apps (auto-pause)
        for app in &[
            "Zoom", "Google Meet", "Meet", "Skype",
            "FaceTime", "Webex", "GoToMeeting", "BlueJeans",
            "Whereby", "Jitsi", "Around",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Meeting);
        }

        // Relaxation
        for app in &[
            "Calm", "Headspace", "Insight Timer", "Medito",
            "Balance", "Ten Percent Happier", "Breethe",
            "Simple Habit", "Petit Bambou",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Relaxation);
        }

        // Gaming
        for app in &[
            "Steam", "Epic Games", "Battle.net",
            "Roblox", "Minecraft", "Fortnite",
            "Valorant", "League of Legends", "Dota 2",
            "Counter-Strike", "CS2", "Apex Legends",
            "Call of Duty", "Overwatch", "World of Warcraft",
            "Genshin Impact", "Honkai", "Elden Ring",
            "OSRS", "Old School RuneScape", "RuneLite",
            "GTA", "Cyberpunk", "Baldur's Gate",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Gaming);
        }

        // Music apps (auto-pause)
        for app in &[
            "Spotify", "Apple Music", "Music", "Tidal",
            "YouTube Music", "Deezer", "Amazon Music",
            "Pandora", "SoundCloud", "foobar2000",
            "VLC", "IINA", "Winamp", "AIMP",
        ] {
            app_mappings.insert(app.to_string(), ContextType::Music);
        }

        Self {
            app_mappings: Mutex::new(app_mappings),
            current_context: Mutex::new(None),
            last_active: Mutex::new(chrono::Utc::now().timestamp_millis()),
            other_audio_active: Mutex::new(false),
            manual_override: Mutex::new(None),
            auto_detect_enabled: Mutex::new(true),
        }
    }

    /// Detect context from active window title and optional URL
    pub fn detect(&self, window_title: &str, app_name: &str) -> DetectedContext {
        let now = chrono::Utc::now().timestamp_millis();

    }

    /// Exact match app name
    fn match_app(&self, app_name: &str) -> Option<ContextType> {
        let mappings = self.app_mappings.lock().unwrap();
        mappings.get(app_name).copied()
    }

    /// Fuzzy match — check if app name or window title contains known patterns
    fn match_app_fuzzy(&self, app_name: &str, window_title: &str) -> Option<ContextType> {
        let mappings = self.app_mappings.lock().unwrap();
        let lower_app = app_name.to_lowercase();
        let lower_title = window_title.to_lowercase();

        for (pattern, ctx) in mappings.iter() {
            let lower_pat = pattern.to_lowercase();
            if lower_app.contains(&lower_pat) || lower_title.contains(&lower_pat) {
                return Some(*ctx);
            }
        }
        None
    }

    /// Match URL against known patterns

    /// Check if user is idle (no activity for >5 minutes)
    pub fn is_idle(&self) -> bool {
        let now = chrono::Utc::now().timestamp_millis();
        let last = *self.last_active.lock().unwrap();
        (now - last) > 300_000 // 5 minutes
    }

    /// Update last active timestamp
    pub fn mark_active(&self) {
        *self.last_active.lock().unwrap() = chrono::Utc::now().timestamp_millis();
    }
}
impl ContextDetector {
    pub fn set_manual_override(&self, c: Option<ContextType>) {
        *self.manual_override.lock().unwrap() = c;
        *self.auto_detect_enabled.lock().unwrap() = c.is_none();
    }
    pub fn enable_auto_detect(&self) {
        *self.manual_override.lock().unwrap() = None;
        *self.auto_detect_enabled.lock().unwrap() = true;
    }
}
