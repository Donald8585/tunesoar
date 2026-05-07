#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# TuneSoar — One-liner installer (macOS / Linux)
#
# Usage:
#   curl -fsSL https://api.tunesoar.com/install.sh | bash
# ──────────────────────────────────────────────────────────
set -euo pipefail

BOLD="\033[1m"; GREEN="\033[0;32m"; RED="\033[0;31m"; NC="\033[0m"
log()  { echo -e "${GREEN}==>${NC} ${BOLD}$*${NC}"; }
die()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

OS=$(uname -s); ARCH=$(uname -m)
case "$OS" in
  Darwin) PLATFORM="macos";;
  Linux)  PLATFORM="linux";;
  *)      die "Unsupported OS: $OS";;
esac
case "$ARCH" in
  x86_64|amd64)  ARCH_NORM="x64";;
  arm64|aarch64) ARCH_NORM="arm64";;
  *)             die "Unsupported arch: $ARCH";;
esac

DOWNLOAD_URL="https://api.tunesoar.com/releases/latest/${PLATFORM}/${ARCH_NORM}"

log "Detected: $PLATFORM / $ARCH_NORM"
log "Downloading TuneSoar..."

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
cd "$TMPDIR"

if [ "$PLATFORM" = "macos" ]; then
  curl -fsSL --progress-bar -o TuneSoar.dmg "$DOWNLOAD_URL" || die "Download failed"
  log "Mounting DMG..."
  hdiutil attach TuneSoar.dmg -nobrowse -quiet
  if [ -d "/Volumes/TuneSoar" ]; then
    cp -R "/Volumes/TuneSoar/TuneSoar.app" /Applications/
    hdiutil detach "/Volumes/TuneSoar" -quiet
    log "Done! Launch from /Applications/TuneSoar.app"
  else
    die "Could not mount DMG"
  fi
else
  curl -fsSL --progress-bar -o tunesoar "$DOWNLOAD_URL" || die "Download failed"
  chmod +x tunesoar
  mkdir -p "$HOME/.local/bin"
  mv tunesoar "$HOME/.local/bin/tunesoar"
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/tunesoar.desktop" << 'DESKTOP'
[Desktop Entry]
Name=TuneSoar
Comment=Context-Aware Binaural Beats
Exec=$HOME/.local/bin/tunesoar
Icon=tunesoar
Terminal=false
Type=Application
Categories=Audio;Utility;
DESKTOP
  log "Done! Run: tunesoar"
fi

echo ""
echo -e "  ${GREEN}✓ TuneSoar installed!${NC}"
echo ""
