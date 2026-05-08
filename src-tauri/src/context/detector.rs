use crate::audio::{ContextType, DetectedContext};
use chrono::{Local, Timelike};
use std::collections::HashMap;
use std::sync::Mutex;

/// App name to context mapping
pub struct ContextDetector {
    /// App name patterns → ContextType
    pub app_mappings: Mutex<HashMap<String, ContextType>>,
    /// URL patterns → ContextType (from browser extension)
    pub url_mappings: Mutex<HashMap<String, ContextType>>,
    /// Current detected context
    pub current_context: Mutex<Option<DetectedContext>>,
    /// Last active timestamp (for idle detection)
    pub last_active: Mutex<i64>,
    /// Whether audio from other apps is detected
    pub other_audio_active: Mutex<bool>,
    /// Manual context override (user selected)
    pub manual_override: Mutex<Option<ContextType>>,
    /// Whether automatic context detection is enabled
    pub auto_detect_enabled: Mutex<bool>,
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

        let mut url_mappings = HashMap::new();

        // URL patterns → context
        // YouTube / video sites → passive_watch
        url_mappings.insert("youtube.com".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("twitch.tv".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("netflix.com".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("disneyplus.com".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("hulu.com".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("hbomax.com".to_string(), ContextType::PassiveWatch);
        url_mappings.insert("vimeo.com".to_string(), ContextType::PassiveWatch);

        // Auto-pause for music/ASMR content on YouTube
        url_mappings.insert("music.youtube.com".to_string(), ContextType::Music);
        // Detected via URL path matching in detector logic

        // Communication web apps
        url_mappings.insert("gmail.com".to_string(), ContextType::Communication);
        url_mappings.insert("outlook.live.com".to_string(), ContextType::Communication);
        url_mappings.insert("outlook.office.com".to_string(), ContextType::Communication);
        url_mappings.insert("slack.com".to_string(), ContextType::Communication);
        url_mappings.insert("teams.microsoft.com".to_string(), ContextType::Communication);
        url_mappings.insert("discord.com".to_string(), ContextType::Communication);
        url_mappings.insert("web.whatsapp.com".to_string(), ContextType::Communication);
        url_mappings.insert("telegram.org".to_string(), ContextType::Communication);

        // Writing web apps
        url_mappings.insert("docs.google.com".to_string(), ContextType::Writing);
        url_mappings.insert("notion.so".to_string(), ContextType::Writing);
        url_mappings.insert("office.com".to_string(), ContextType::Writing);
        url_mappings.insert("wordpress.com".to_string(), ContextType::Writing);
        url_mappings.insert("medium.com".to_string(), ContextType::Writing);
        url_mappings.insert("substack.com".to_string(), ContextType::Writing);

        // Design web apps
        url_mappings.insert("figma.com".to_string(), ContextType::Creative);
        url_mappings.insert("canva.com".to_string(), ContextType::Creative);
        url_mappings.insert("photopea.com".to_string(), ContextType::Creative);

        // Coding web apps
        url_mappings.insert("github.com".to_string(), ContextType::Coding);
        url_mappings.insert("gitlab.com".to_string(), ContextType::Coding);
        url_mappings.insert("stackoverflow.com".to_string(), ContextType::Coding);
        url_mappings.insert("codesandbox.io".to_string(), ContextType::Coding);
        url_mappings.insert("replit.com".to_string(), ContextType::Coding);
        url_mappings.insert("codepen.io".to_string(), ContextType::Coding);

        Self {
            app_mappings: Mutex::new(app_mappings),
            url_mappings: Mutex::new(url_mappings),
            current_context: Mutex::new(None),
            last_active: Mutex::new(chrono::Utc::now().timestamp_millis()),
            manual_override: Mutex::new(None),
            auto_detect_enabled: Mutex::new(true),
            other_audio_active: Mutex::new(false),
        }
    }

    /// Detect context from active window title and optional URL
    pub fn detect(&self, window_title: &str, app_name: &str, url: Option<&str>) -> DetectedContext {
        let now = chrono::Utc::now().timestamp_millis();

        // Check URL first (most specific signal from browser extension)
        let url_context = url.and_then(|u| self.match_url(u));

        let context_type = if let Some(ctx) = url_context {
            ctx
        } else {
            // Match by app name
            self.match_app(app_name)
                .or_else(|| self.match_app_fuzzy(app_name, window_title))
                .unwrap_or_else(|| {
                    // Check time-based context (sleep prep: 10pm-6am)
                    let hour = Local::now().hour();
                    if hour >= 22 || hour < 6 {
                        // During sleep hours, check for reading/research apps
                        let lower_title = window_title.to_lowercase();
                        if lower_title.contains("kindle") || lower_title.contains("reader")
                            || lower_title.contains("books") || lower_title.contains("pocket")
                            || lower_title.contains("instapaper")
                        {
                            return ContextType::SleepPrep;
                        }
                    }
                    ContextType::Ambient
                })
        };

        DetectedContext {
            context_type,
            app_name: app_name.to_string(),
            window_title: window_title.to_string(),
            url: url.map(|u| u.to_string()),
            detected_at: now,
        }
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
    fn match_url(&self, url: &str) -> Option<ContextType> {
        let mappings = self.url_mappings.lock().unwrap();
        let url_lower = url.to_lowercase();

        // Check for music/ASMR specific patterns on YouTube
        if url_lower.contains("youtube.com") {
            if url_lower.contains("music") || url_lower.contains("playlist")
                || url_lower.contains("asmr") || url_lower.contains("meditation")
                || url_lower.contains("relaxing") || url_lower.contains("sleep")
                || url_lower.contains("lofi") || url_lower.contains("ambient")
            {
                return Some(ContextType::Music);
            }
        }

        for (pattern, ctx) in mappings.iter() {
            if url_lower.contains(pattern) {
                return Some(*ctx);
            }
        }
        None
    }

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
    pub fn set_manual_override(&self, ctx: Option<ContextType>) {
        *self.manual_override.lock().unwrap() = ctx;
        *self.auto_detect_enabled.lock().unwrap() = ctx.is_none();
    }
    pub fn enable_auto_detect(&self) {
        *self.manual_override.lock().unwrap() = None;
        *self.auto_detect_enabled.lock().unwrap() = true;
    }
}
