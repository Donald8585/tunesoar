#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Attunely — One-liner installer (macOS / Linux)
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
log "Downloading Attunely..."

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
cd "$TMPDIR"

if [ "$PLATFORM" = "macos" ]; then
  curl -fsSL --progress-bar -o Attunely.dmg "$DOWNLOAD_URL" || die "Download failed"
  log "Mounting DMG..."
  hdiutil attach Attunely.dmg -nobrowse -quiet
  if [ -d "/Volumes/Attunely" ]; then
    cp -R "/Volumes/Attunely/Attunely.app" /Applications/
    hdiutil detach "/Volumes/Attunely" -quiet
    log "Done! Launch from /Applications/Attunely.app"
  else
    die "Could not mount DMG"
  fi
else
  curl -fsSL --progress-bar -o attunely "$DOWNLOAD_URL" || die "Download failed"
  chmod +x attunely
  mkdir -p "$HOME/.local/bin"
  mv attunely "$HOME/.local/bin/attunely"
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/attunely.desktop" << 'DESKTOP'
[Desktop Entry]
Name=Attunely
Comment=Context-Aware Binaural Beats
Exec=$HOME/.local/bin/attunely
Icon=attunely
Terminal=false
Type=Application
Categories=Audio;Utility;
DESKTOP
  log "Done! Run: attunely"
fi

echo ""
echo -e "  ${GREEN}✓ Attunely installed!${NC}"
echo ""
