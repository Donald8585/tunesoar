# Phase 1.4 — Repository State

**Timestamp:** 2026-05-08T04:33 UTC

## Repo
- **Remote:** `https://github.com/Donald8585/tunesoar.git`
- **Branch:** master
- **Last commits:** 20 recent commits (fixes, features)
- **Status:** Clean (no uncommitted changes)

## CI/CD Files Present
- `.github/workflows/ci.yml` — Build check on push/PR to master
- `.github/workflows/release.yml` — Multi-platform release on `v*` tags + manual dispatch

## Actions Status
- GitHub Actions pages return 404 (private repo, unauthenticated fetch)
- Cannot verify Actions enabled from sandbox — needs user confirmation
- Report: https://github.com/Donald8585/tunesoar/settings/actions

## Rust/Cargo
- ❌ Not installed in sandbox container
- Builds must happen via GitHub Actions runners

## Secrets Required (to be set in repo Settings → Secrets & Variables → Actions)
| Secret | Purpose |
|--------|---------|
| `TAURI_PRIVATE_KEY` | Tauri updater signing key |
| `TAURI_KEY_PASSWORD` | Password for the private key |
| `APPLE_SIGNING_IDENTITY` | macOS code signing (optional, builds work unsigned) |
| `APPLE_CERTIFICATE` | Apple Developer certificate (optional) |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password (optional) |
| `APPLE_TEAM_ID` | Apple Team ID (optional) |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions |

## TO VERIFY (User Action Required)
1. Go to https://github.com/Donald8585/tunesoar/settings/actions
2. Confirm "Allow all actions and reusable workflows" is selected
3. Confirm workflow permissions: "Read and write permissions"
4. Confirm "Allow GitHub Actions to create and approve pull requests" is checked
