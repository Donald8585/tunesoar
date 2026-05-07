use crate::audio::ContextType;
use regex::Regex;

pub struct ContextRule { pub pattern: &'static str, pub context: ContextType }

pub fn default_rules() -> Vec<(Regex, ContextType)> {
    vec![
        ContextRule{pattern:r"(?i)(zoom|Meet|Teams): .*(Meeting|Call)",context:ContextType::Meeting},
        ContextRule{pattern:r"(?i)Spotify:",context:ContextType::Music},
        ContextRule{pattern:r"(?i)(Music|Tidal|VLC):",context:ContextType::Music},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(YouTube.*Music|lofi|playlist|meditation)",context:ContextType::Music},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*- YouTube",context:ContextType::PassiveWatch},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(Twitch|Netflix|Disney)",context:ContextType::PassiveWatch},
        ContextRule{pattern:r"(?i)(Code|Cursor|Terminal|iTerm2|kitty|Warp|Ghostty|JetBrains): ",context:ContextType::Coding},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(GitHub|GitLab|Stack Overflow)",context:ContextType::Coding},
        ContextRule{pattern:r"(?i)(Xcode|Android Studio|Sublime|Emacs|Fleet): ",context:ContextType::Coding},
        ContextRule{pattern:r"(?i)(Notion|Obsidian|Word|Pages|LibreOffice|Scrivener|Typora|Craft): ",context:ContextType::Writing},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(Google Docs|docs\.google|Medium|Substack)",context:ContextType::Writing},
        ContextRule{pattern:r"(?i)(Figma|Photoshop|Illustrator|Blender|After Effects|Premiere|DaVinci|InDesign|Lightroom): ",context:ContextType::Creative},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(Figma|Canva|Photopea)",context:ContextType::Creative},
        ContextRule{pattern:r"(?i)(chrome|edge|firefox): .*(Gmail|mail\.google|Outlook)",context:ContextType::Communication},
        ContextRule{pattern:r"(?i)(Slack|Discord|Telegram|Signal|WhatsApp): ",context:ContextType::Communication},
        ContextRule{pattern:r"(?i)(Steam|EpicGames|Battle\.net): ",context:ContextType::Gaming},
        ContextRule{pattern:r"(?i)(Calm|Headspace|Insight Timer|Medito): ",context:ContextType::Relaxation},
        ContextRule{pattern:r"(?i)(Kindle|Reader|Pocket|Instapaper|Readwise): ",context:ContextType::Writing},
    ].into_iter().filter_map(|r|Regex::new(r.pattern).ok().map(|re|(re,r.context))).collect()
}
