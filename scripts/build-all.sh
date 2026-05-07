#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# TuneSoar — Local build script (Linux)
#
# Builds Linux packages (deb + AppImage) from current source.
# For macOS/Windows, use the GitHub Actions release workflow.
# ──────────────────────────────────────────────────────────
set -euo pipefail

BOLD="\033[1m"; GREEN="\033[0;32m"; NC="\033[0m"
log() { echo -e "${GREEN}==>${NC} ${BOLD}$*${NC}"; }

cd "$(dirname "$0")/.."

log "Installing frontend dependencies..."
pnpm install --frozen-lockfile

log "Building Linux bundles (deb + AppImage)..."
pnpm tauri build --bundles deb,appimage

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""

# Show output files
BUNDLE_DIR="src-tauri/target/release/bundle"
if [ -d "$BUNDLE_DIR/deb" ]; then
  echo "  .deb:"
  ls -lh "$BUNDLE_DIR/deb/"*.deb 2>/dev/null || echo "    (none)"
fi
if [ -d "$BUNDLE_DIR/appimage" ]; then
  echo "  .AppImage:"
  ls -lh "$BUNDLE_DIR/appimage/"*.AppImage 2>/dev/null || echo "    (none)"
fi
echo ""
