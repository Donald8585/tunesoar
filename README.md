# 🎵 TuneSoar — Context-Aware Binaural Beats

Auto-deploys binaural beats based on what you're doing. Coding? Beta waves. Writing? Alpha state. Gaming? Tuned focus. Zero manual switching.

## Architecture

```
tunesoar/
├── src-tauri/          # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── audio/      # Binaural beat DSP engine (cpal)
│   │   ├── context/    # Active window detection + context mapping
│   │   ├── storage/    # SQLite (user prefs, mappings, usage logs)
│   │   ├── tray/       # System tray integration
│   │   ├── ws/         # WebSocket server (browser extension bridge)
│   │   ├── commands.rs # Tauri IPC commands
│   │   ├── lib.rs      # App setup + periodic detection loop
│   │   └── main.rs     # Entry point
│   └── Cargo.toml
├── src/                # React 18 + Vite + TypeScript frontend
│   ├── components/
│   │   ├── ui/         # shadcn-inspired UI primitives
│   │   ├── TrayWindow.tsx    # Main dashboard
│   │   ├── Settings.tsx      # User preferences
│   │   ├── ContextMappings.tsx # Custom mappings editor
│   │   ├── Upgrade.tsx       # Pro pricing page
│   │   └── SafetyWarning.tsx # Mandatory safety acknowledgment
│   └── types/          # Shared TypeScript types
├── browser-extension/  # Chrome + Firefox MV3 extension
│   ├── manifest.json
│   ├── background.js   # WebSocket client, tab monitoring
│   ├── popup.html      # Auth token configuration
│   └── popup.js
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri v2 |
| Backend | Rust |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS 4 |
| Audio Engine | `cpal` — pure DSP sine wave generation |
| Storage | SQLite via `rusqlite` |
| Window Detection | Windows: `windows-rs` / macOS: `core-foundation` / Linux: `x11rb` |
| Browser Bridge | WebSocket server (localhost:47821) + Chrome/Firefox extension |

## Features

- **12 context types** auto-detected from active window title / app name
- **5 brainwave bands**: Delta (1-4Hz), Theta (4-8Hz), Alpha (8-13Hz), Beta (13-30Hz), Gamma (30-40Hz)
- **2-second crossfade** on every context change (no clicks/pops)
- **Volume hard-cap at 25%** with default 10%
- **System tray** primary interface — runs in background
- **Auto-pause** during meetings, music, idle
- **Sleep mode** (22:00-06:00 auto Delta)
- **Custom context mappings** — map any app/URL to any beat profile

## Freemium Pricing

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 contexts, 3 beat profiles, default mappings |
| Pro Monthly | $6.99/mo | All 12 contexts, 5 profiles, custom mappings, sleep mode, browser extension |
| Lifetime | $89 | Everything, forever |

## Getting Started

### Prerequisites

- **Rust** (1.77+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js** (20+): [nodejs.org](https://nodejs.org)
- **pnpm**: `npm install -g pnpm`
- **System dependencies** (Linux):
  ```bash
  sudo apt install build-essential pkg-config libssl-dev \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    libappindicator3-dev librsvg2-dev patchelf \
    libjavascriptcoregtk-4.1-dev libsoup-3.0-dev
  ```

### Development

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

Outputs:
- Windows: `.msi` / `.exe` installer
- macOS: `.dmg` bundle
- Linux: `.deb` / `.AppImage`

### Browser Extension

1. Open `chrome://extensions` or `about:debugging#/runtime/this-firefox`
2. Enable "Developer mode"
3. Load unpacked: select `browser-extension/` folder
4. Paste auth token from TuneSoar Settings → Browser Extension

## Safety

⚠️ **Binaural beats may trigger seizures in people with photosensitive epilepsy.**
- Do not use if you have a history of seizures
- Consult a doctor before use
- Start at low volume (<10%)
- Stop immediately if you feel discomfort
- Gamma frequencies (30-40 Hz) disabled by default
- Volume hard-capped at 25% system output

## Parent Brand

**TranceLab** — Pairs with MindGlow AI.

## License

MIT © TranceLab
