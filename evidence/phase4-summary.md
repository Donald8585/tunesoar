# Phase 4 — Download Page Wiring (Summary)

**Timestamp:** 2026-05-08T04:33 UTC

## Current State: Release Pipeline Ready, Needs Trigger

The workflow is configured. Installers will be produced when triggered.
Users will NOT need to run command lines — they'll download real installers.

## What Users Will Get
| Platform | Format | User Action |
|----------|--------|-------------|
| Windows | .exe (NSIS installer) + .msi | Double-click → install |
| macOS (M1/M2/M3) | .dmg | Open → drag to /Applications |
| macOS (Intel) | .dmg | Open → drag to /Applications |
| Linux | .deb + .AppImage | Double-click or `dpkg -i` |

## Download Page
After first release, the download page URL will be:
  https://github.com/Donald8585/tunesoar/releases/latest

The release page auto-lists all platform assets with links.

## What You Need To Do
1. **Set secrets** at https://github.com/Donald8585/tunesoar/settings/secrets/actions:
   - `TAURI_PRIVATE_KEY` — generate with: `pnpm tauri signer generate -w ~/.tauri/tunesoar.key`
   - `TAURI_PRIVATE_KEY_PASSWORD` — the password you used above
   - (Optional) Apple signing secrets for notarized macOS builds

2. **Trigger the release:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
   OR go to Actions → "Release Tunesoar" → "Run workflow"

3. **Watch the build** at https://github.com/Donald8585/tunesoar/actions

4. **Download and test** the produced installers from the Release page

## Files Changed
- `src-tauri/tauri.conf.json` — Added category, descriptions, Linux deps
- `.github/workflows/release.yml` — Rewritten to use tauri-action@v0
- `.github/workflows/ci.yml` — Added missing system deps
- `src-tauri/src/{audio,context,storage,tray,ws}/` — Removed accidental brace-expansion dir
