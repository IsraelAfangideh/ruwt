#!/usr/bin/env bash
set -euo pipefail

echo "Installing Ruwt desktop collector..."
REPO="${RUWT_REPO:-https://github.com/IsraelAfangideh/ruwt.git}"
TARGET="${RUWT_INSTALL_DIR:-$HOME/.ruwt/desktop}"

mkdir -p "$(dirname "$TARGET")"
if [ -d "$TARGET/.git" ]; then
  git -C "$TARGET" pull --ff-only
else
  git clone --depth 1 "$REPO" "$TARGET-repo"
  mkdir -p "$TARGET"
  cp -R "$TARGET-repo/desktop/." "$TARGET/"
  rm -rf "$TARGET-repo"
fi

cd "$TARGET"
npm install --silent

cat <<'MSG'

Ruwt collector installed.

Quick start (no account required for local capture):
  cd ~/.ruwt/desktop
  npm run cli -- doctor
  npm run cli -- import ./your-events.json

When you have an ingestion key from a workspace:
  RUWT_INGESTION_KEY=ruwt_ing_... npm run cli -- sync

Docs: https://ruwt.ai/download
MSG
