#!/bin/bash
# Initialize ruwt monorepo workspace on Cloud Mode machine.
# Runs on first boot to clone the repo and install dependencies.
# On subsequent boots, pulls latest changes and reinstalls.

set -e

WORKSPACE="${WORKSPACE:-/home/dev/workspace}"
REPO_URL="${RUWT_REPO:-https://github.com/IsraelAfangideh/ruwt.git}"

echo "==> Ruwt workspace init starting..."

# Clone if workspace is empty
if [ ! -d "$WORKSPACE/.git" ]; then
  echo "==> Cloning ruwt monorepo..."
  git clone "$REPO_URL" "$WORKSPACE"
  cd "$WORKSPACE"

  echo "==> Installing dev/ dependencies..."
  cd dev && npm install && cd ..

  echo "==> Installing social/ dependencies..."
  if command -v bun &> /dev/null; then
    cd social/code/api && bun install && cd ../../..
  else
    echo "    (bun not found, skipping social/ install)"
  fi

  # executor/ doesn't have node_modules — it runs in Docker
  echo "==> Workspace ready!"
else
  echo "==> Workspace already initialized. Pulling latest..."
  cd "$WORKSPACE" && git pull --rebase || true

  echo "==> Reinstalling dev/ dependencies..."
  cd dev && npm install && cd ..

  if command -v bun &> /dev/null; then
    echo "==> Reinstalling social/ dependencies..."
    cd social/code/api && bun install && cd ../../..
  fi

  echo "==> Workspace updated!"
fi
