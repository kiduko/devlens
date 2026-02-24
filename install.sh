#!/bin/bash
# DevLens installer/updater
# Usage: bash install.sh [install_dir]
#   Default install dir: ~/devlens

set -euo pipefail

REPO="kiduko/devlens"
INSTALL_DIR="${1:-$HOME/devlens}"

echo "Fetching latest release..."
TAG=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)

if [ -z "$TAG" ]; then
  echo "Error: Could not fetch latest release" >&2
  exit 1
fi

ZIP_URL="https://github.com/$REPO/releases/download/$TAG/devlens-$TAG.zip"
echo "Latest: $TAG"

# Check current version
if [ -f "$INSTALL_DIR/manifest.json" ]; then
  CURRENT=$(grep '"version"' "$INSTALL_DIR/manifest.json" | head -1 | cut -d'"' -f4)
  LATEST="${TAG#v}"
  if [ "$CURRENT" = "$LATEST" ]; then
    echo "Already up to date ($CURRENT)"
    exit 0
  fi
  echo "Updating: v$CURRENT → $TAG"
else
  echo "Installing to: $INSTALL_DIR"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -sL "$ZIP_URL" -o "$TMP/devlens.zip"
mkdir -p "$INSTALL_DIR"
unzip -qo "$TMP/devlens.zip" -d "$INSTALL_DIR"

echo "Done! Installed $TAG to $INSTALL_DIR"
echo ""
echo "Next: chrome://extensions → reload DevLens"
