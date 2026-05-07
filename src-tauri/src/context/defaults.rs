//! Default context detection rules.
//!
//! Each rule matches on the combined string `"<process_name>: <window_title>"`
//! using regex.  Rules are tested in order; the first match wins.
//!
//! The format mirrors what `get_active_window()` returns:
//!   process: the executable / app name (e.g. "chrome", "Code", "Figma")
//!   title:   the raw window title bar string

use crate::audio::ContextType;
use regex::Regex;

/// A single detection rule
pub struct ContextRule {
    /// Human label (for debugging / UI)
    #[allow(dead_code)]
    pub label: &'static str,
    /// Regex applied to `"<process>: <window_title>"`
    pub pattern: &'static str,
    /// What context this produces
    pub context: ContextType,
}

/// Return the ordered list of default detection rules.
pub fn default_rules() -> Vec<ContextRule> {
    vec![
        // ── Meeting (auto-pause) ────────────────────────────
        ContextRule {
            label: "Zoom meeting",
            pattern: r"(?i)(zoom|Zoom\.exe|Meet|Teams): .*(Meeting|Call|Conference)",
            context: ContextType::Meeting,
        },
        ContextRule {
            label: "Google Meet / Teams / Zoom web",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Meet —|Teams\.microsoft\.com|zoom\.us)",
            context: ContextType::Meeting,
        },

        // ── Music (auto-pause) ─────────────────────────────
        ContextRule {
            label: "Spotify desktop",
            pattern: r"(?i)Spotify:",
            context: ContextType::Music,
        },
        ContextRule {
            label: "Apple Music / Tidal / VLC",
            pattern: r"(?i)(Music|Tidal|VLC|foobar2000|IINA):",
            context: ContextType::Music,
        },
        ContextRule {
            label: "YouTube Music / playlists / lofi in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(YouTube.*Music|lofi|playlist|ASMR|meditation|relaxing|sleep music|ambient music|study music)",
            context: ContextType::Music,
        },
        ContextRule {
            label: "Spotify Web / SoundCloud / Deezer in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Spotify|SoundCloud|Deezer|Pandora)",
            context: ContextType::Music,
        },

        // ── Passive Watch ──────────────────────────────────
        ContextRule {
            label: "YouTube video (not music)",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*\- YouTube",
            context: ContextType::PassiveWatch,
        },
        ContextRule {
            label: "Twitch / Netflix / streaming",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Twitch|Netflix|Disney\+|Hulu|HBO Max|Prime Video|Crunchyroll)",
            context: ContextType::PassiveWatch,
        },

        // ── Coding ─────────────────────────────────────────
        ContextRule {
            label: "VS Code / Cursor / JetBrains / Terminal",
            pattern: r"(?i)(Code|Cursor|[A-Za-z]+Storm|IntelliJ|Terminal|iTerm2|kitty|Alacritty|Warp|wezterm|Ghostty): ",
            context: ContextType::Coding,
        },
        ContextRule {
            label: "GitHub / GitLab / StackOverflow in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(GitHub|GitLab|Stack Overflow|CodeSandbox|Replit|CodePen)",
            context: ContextType::Coding,
        },
        ContextRule {
            label: "Xcode / Android Studio / Sublime / Vim / Emacs",
            pattern: r"(?i)(Xcode|Android Studio|Sublime|Neovide|Emacs|Fleet): ",
            context: ContextType::Coding,
        },
        ContextRule {
            label: "Jupyter / Colab / RStudio",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Colab|Jupyter|RStudio|Kaggle)",
            context: ContextType::Coding,
        },

        // ── Writing ────────────────────────────────────────
        ContextRule {
            label: "Notion / Obsidian / Word / Pages",
            pattern: r"(?i)(Notion|Obsidian|Word|Pages|LibreOffice|Scrivener|Typora|Craft|Ulysses|Evernote|Logseq): ",
            context: ContextType::Writing,
        },
        ContextRule {
            label: "Google Docs / Office.com / Notion.so in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Google Docs|docs\.google|Notion —|office\.com.*Word|Medium|Substack|WordPress)",
            context: ContextType::Writing,
        },

        // ── Creative / Design ──────────────────────────────
        ContextRule {
            label: "Figma / Photoshop / Illustrator / Blender",
            pattern: r"(?i)(Figma|Photoshop|Illustrator|Blender|After Effects|Premiere Pro|DaVinci|InDesign|Lightroom|Sketch|Affinity): ",
            context: ContextType::Creative,
        },
        ContextRule {
            label: "Figma / Canva / Photopea in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Figma|Canva|Photopea|Excalidraw)",
            context: ContextType::Creative,
        },
        ContextRule {
            label: "GIMP / Krita / Inkscape / Aseprite",
            pattern: r"(?i)(GIMP|Krita|Inkscape|Aseprite): ",
            context: ContextType::Creative,
        },

        // ── Communication ──────────────────────────────────
        ContextRule {
            label: "Gmail / Outlook / Mail client",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Gmail|mail\.google|Outlook|Proton Mail|Superhuman)",
            context: ContextType::Communication,
        },
        ContextRule {
            label: "Slack / Discord / Telegram / Signal desktop",
            pattern: r"(?i)(Slack|Discord|Telegram|Signal|WhatsApp|Messenger|Spark|Thunderbird): ",
            context: ContextType::Communication,
        },
        ContextRule {
            label: "Slack / Discord / WhatsApp Web in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(Slack —|Discord —|web\.whatsapp|Telegram Web)",
            context: ContextType::Communication,
        },

        // ── Gaming ─────────────────────────────────────────
        ContextRule {
            label: "Steam / Epic / Battle.net launchers",
            pattern: r"(?i)(Steam|EpicGamesLauncher|Battle\.net): ",
            context: ContextType::Gaming,
        },
        ContextRule {
            label: "Known game titles (partial)",
            pattern: r"(?i): .*(Roblox|Minecraft|Fortnite|Valorant|League of Legends|Dota 2|CS2|Apex Legends|Call of Duty|Overwatch|World of Warcraft|Genshin Impact|Honkai|Elden Ring|OSRS|RuneLite|GTA|Cyberpunk|Baldur's Gate|Counter-Strike)",
            context: ContextType::Gaming,
        },

        // ── Relaxation / Meditation ────────────────────────
        ContextRule {
            label: "Meditation / mindfulness apps",
            pattern: r"(?i)(Calm|Headspace|Insight Timer|Medito|Balance|Breethe): ",
            context: ContextType::Relaxation,
        },
        ContextRule {
            label: "Meditation / yoga in browser",
            pattern: r"(?i)(chrome|msedge|firefox|safari|brave): .*(meditation|yoga|mindfulness|breathing exercise)",
            context: ContextType::Relaxation,
        },

        // ── Reading / Research (maps to Writing's Alpha) ───
        ContextRule {
            label: "Kindle / Reader / Pocket / Instapaper",
            pattern: r"(?i)(Kindle|Reader|Pocket|Instapaper|Books|Readwise): ",
            context: ContextType::Writing,
        },

        // ── Deep Work / Focus (maps to Coding's Beta) ─────
        ContextRule {
            label: "Focus / productivity apps",
            pattern: r"(?i)(Focus|Pomodoro|Toggl|RescueTime|Forest|Endel): ",
            context: ContextType::Coding,
        },

        // ── Sleep prep window (22:00-06:00 is handled by time-based fallback) ─
    ]
}
