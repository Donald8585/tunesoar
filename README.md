# 🎵 TuneSoar — Context-Aware Binaural Beats

Auto-deploys binaural beats based on what you're doing. Coding? Beta waves. Writing? Alpha state. Gaming? Tuned focus. Zero manual switching.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     TuneSoar Desktop App                  │
│  ┌─────────────────┐  IPC  ┌────────────────────────┐    │
│  │  React Frontend │◄─────►│  Rust Backend (Tauri)  │    │
│  │  (Vite + TS)    │       │  - Audio DSP (cpal)    │    │
│  │  - Clerk Auth   │       │  - Context Detection   │    │
│  │  - Dashboard UI │       │  - SQLite Storage      │    │
│  └────────┬────────┘       │  - License Verification │    │
│           │                └────────────┬───────────┘    │
│    Clerk FAPI (fetch)                  │ HTTP            │
│    clerk.tunesoar.com                  │ POST            │
│           │                            ▼                 │
│           ▼              ┌─────────────────────────┐     │
│  ┌──────────────────┐   │  Cloudflare Worker       │     │
│  │  Clerk Edge       │  │  (api.tunesoar.com)      │     │
│  │  (via Cloudflare) │  │  - /checkout (Stripe)    │     │
│  │  - Auth / Sessions│  │  - /webhook (Stripe)     │     │
│  │  - User Management│  │  - /verify-license       │     │
│  └──────────────────┘   │  - /downloads (R2 CDN)   │     │
│                          └──────────┬──────────────┘     │
│                                     │                     │
│                      ┌──────────────┴──────────────┐     │
│                      ▼                              ▼     │
│             ┌──────────────┐              ┌────────────┐ │
│             │  Stripe API  │              │  Clerk API │ │
│             │  (Payments) │              │  (Backend) │ │
│             │              │              │ verifyToken│ │
│             └──────────────┘              └────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Source Tree

```
tunesoar/
├── src-tauri/          # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── audio/      # Binaural beat DSP engine (cpal)
│   │   ├── context/    # Active window detection + context mapping
│   │   ├── storage/    # SQLite (user prefs, mappings, usage logs)
│   │   ├── license/    # License state + Pro feature gates
│   │   ├── safety/     # Safety acknowledgment + session limits
│   │   ├── tray/       # System tray integration
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
│   │   ├── Account.tsx       # Clerk auth (SignIn/SignUp/UserButton)
│   │   └── SafetyWarning.tsx # Mandatory safety acknowledgment
│   ├── lib/constants.ts      # App constants
│   └── types/          # Shared TypeScript types
├── worker/             # Cloudflare Worker (Hono + D1 + R2)
│   ├── src/
│   │   ├── index.ts    # API routes, Stripe webhooks, CDN
│   │   └── pages.ts    # Landing/marketing page HTML
│   ├── schema.sql      # D1 database schema
│   └── wrangler.toml
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
| Auth | Clerk (`@clerk/react` v6 + `@clerk/backend` v1) |
| API & CDN | Cloudflare Worker (Hono) + D1 + R2 |
| Payments | Stripe Checkout + Webhooks |
| License Verification | Device-based HMAC via Cloudflare Worker |

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
| Pro Monthly | $6.99/mo | All 12 contexts, 5 profiles, custom mappings, sleep mode |
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

### Release Smoke Tests

After every `pnpm tauri build`, verify:
1. **Audio plays** — launch from desktop shortcut, click Play, confirm binaural beats audio
2. **DevTools** — `Ctrl+Shift+I` opens in dev builds, still toggleable in release builds (if `devtools` feature enabled)
3. **No console errors** — check DevTools Console tab on app open
4. **Diagnostic log** — check `%APPDATA%/com.wealthmakermasterclass.tunesoar/tunesoar-diag.log` for audio device info

### DevTools Control

- **Dev builds** (`cargo tauri dev`): DevTools auto-open on startup
- **Release builds** (`cargo tauri build`): DevTools do NOT auto-open; `Ctrl+Shift+I` still works if `devtools` feature is in Cargo.toml
- **Strip before public ship**: Remove `devtools` from Cargo.toml features when user count > 1000

### Audio Architecture

TuneSoar uses **Rust-native DSP** (pure sine wave synthesis via `cpal`), NOT Web Audio API or HTML `<audio>` elements. All audio is generated in real-time from the Rust backend — no audio assets, no codec dependencies, no path resolution issues.

- Audio engine: `BinauralEngine` → `cpal::default_host()` → `build_output_stream()` → `stream.play()`
- Triggers on: `detect_context` Tauri command (called every 3s by frontend)
- Diagnostic log: written to `tunesoar-diag.log` in app data directory
- If no sound: check diagnostic log for "NO OUTPUT DEVICE FOUND" or "Failed to create audio engine"

### Browser Extension

1. Open `chrome://extensions` or `about:debugging#/runtime/this-firefox`
2. Enable "Developer mode"

## Auth & API

### Environment Variables

**Frontend (`.env` / Vite):**
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for the Frontend API
- `VITE_CLERK_DOMAIN` — Custom Clerk domain (`clerk.tunesoar.com`)

**Worker (`wrangler.toml` vars + secrets):**
- `CLERK_SECRET_KEY` — Clerk Backend API secret for JWT verification (set via `wrangler secret put CLERK_SECRET_KEY`)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_LIFETIME_PRICE_ID` — Stripe price IDs
- `LICENSE_SECRET` — HMAC key for device fingerprinting

### Auth Flow

1. **Sign-in** — `<SignIn />` component from `@clerk/react` renders in Tauri webview
2. **Session** — Clerk SDK calls Frontend API at `clerk.tunesoar.com` (Cloudflare → Clerk Edge)
3. **Token verification** — Worker uses `@clerk/backend` `verifyToken()` with Bearer token
4. **CSP** — Tauri CSP in `tauri.conf.json` must allow `clerk.tunesoar.com` in:
   - `connect-src` (for Clerk FAPI fetch calls)
   - `script-src` (for Clerk JS bundle)
   - `frame-src` (for Clerk hosted pages)
   - `img-src` (for Clerk profile images)

### Subscription Flow

1. User signs in via Clerk → gets `userId`
2. Frontend POSTs to `/checkout` with Clerk Bearer token
3. Worker creates Stripe Checkout session with `client_reference_id = userId`
4. On `checkout.session.completed` webhook, Worker creates license in D1
5. Tauri app verifies license via `POST /verify-license` with device HMAC

## Safety

⚠️ **Binaural beats may trigger seizures in people with photosensitive epilepsy.**
- Do not use if you have a history of seizures
- Consult a doctor before use
- Start at low volume (<10%)
- Stop immediately if you feel discomfort
- Gamma frequencies (30-40 Hz) disabled by default
- Volume hard-capped at 25% system output

## Parent Brand

**Wealth Maker Masterclass Limited** — Pairs with MindGlow AI.

## License

MIT © Wealth Maker Masterclass Limited
