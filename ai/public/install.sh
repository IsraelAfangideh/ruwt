#!/usr/bin/env bash
# Installs Ruwt Desktop on this Mac and opens it.
# curl does not quarantine downloads, so Gatekeeper will not show
# “Apple could not verify Ruwt is free of malware.”
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS." >&2
  echo "Windows: https://ruwt.ai/downloads/Ruwt-Setup.exe" >&2
  echo "Linux:   https://ruwt.ai/downloads/ruwt-linux-amd64" >&2
  exit 1
fi

DMG_URL="${RUWT_DMG_URL:-https://ruwt.ai/downloads/Ruwt.dmg}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/ruwt.XXXXXX")"
MOUNT=""

cleanup() {
  if [[ -n "${MOUNT}" ]]; then
    hdiutil detach "${MOUNT}" -quiet >/dev/null 2>&1 \
      || hdiutil detach "${MOUNT}" -force -quiet >/dev/null 2>&1 \
      || true
  fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

echo "Downloading Ruwt…"
curl -fL --retry 3 --retry-delay 1 "${DMG_URL}" -o "${TMP}/Ruwt.dmg"

ATTACH="$(hdiutil attach "${TMP}/Ruwt.dmg" -nobrowse -readonly)"
MOUNT="$(printf '%s\n' "${ATTACH}" | awk '/\/Volumes\//{print $NF; exit}')"
APP="${MOUNT}/Ruwt.app"
if [[ -z "${MOUNT}" || ! -d "${APP}" ]]; then
  echo "The download did not contain Ruwt.app." >&2
  exit 1
fi

place() {
  local dest="$1"
  mkdir -p "$(dirname "${dest}")"
  rm -rf "${dest}"
  cp -R "${APP}" "${dest}"
  xattr -cr "${dest}" >/dev/null 2>&1 || true
}

DEST="/Applications/Ruwt.app"
if ! place "${DEST}" 2>/dev/null; then
  DEST="${HOME}/Applications/Ruwt.app"
  place "${DEST}"
fi

echo "Opening Ruwt…"
open "${DEST}"
echo "Installed at ${DEST}"
