#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAUNCHER="$ROOT/desktop/launcher"
OUT="$ROOT/ai/public/downloads"
STAGING="$(mktemp -d)"
VERSION="${RUWT_LAUNCHER_VERSION:-0.2.0}"

mkdir -p "$OUT"
find "$OUT" -type f ! -name '.gitkeep' -delete
trap 'rm -rf "$STAGING"' EXIT

if [ -x "$ROOT/desktop/node_modules/.bin/esbuild" ]; then
  (cd "$ROOT/desktop" && npm run build:ui)
fi
mkdir -p "$LAUNCHER/ui"
cp -R "$ROOT/desktop/ui/." "$LAUNCHER/ui/"

build() {
  local goos="$1"
  local goarch="$2"
  local dest="$3"
  local extra="${4:-}"
  echo "Building $goos/$goarch → $dest"
  # shellcheck disable=SC2086
  (cd "$LAUNCHER" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags="-s -w $extra" -o "$dest" .)
}

build darwin arm64 "$STAGING/ruwt-darwin-arm64"
build darwin amd64 "$STAGING/ruwt-darwin-amd64"
build windows amd64 "$STAGING/Ruwt-Setup.exe" "-H=windowsgui"
build linux amd64 "$STAGING/ruwt-linux-amd64"

make_app() {
  local binary="$1"
  local appdir="$2"
  mkdir -p "$appdir/Contents/MacOS" "$appdir/Contents/Resources"
  cp "$LAUNCHER/macos/Info.plist" "$appdir/Contents/Info.plist"
  cp "$binary" "$appdir/Contents/MacOS/ruwt"
  chmod +x "$appdir/Contents/MacOS/ruwt"
  cat > "$appdir/Contents/Resources/README.txt" <<'EOF'
If macOS says Ruwt can't be opened, right-click the app and choose Open.
Ruwt stays on this machine until you add an ingestion key.
EOF
}

pack_zip() {
  local appdir="$1"
  local zipname="$2"
  (cd "$(dirname "$appdir")" && zip -qry "$OUT/$zipname" "$(basename "$appdir")")
}

make_app "$STAGING/ruwt-darwin-arm64" "$STAGING/arm/Ruwt.app"
make_app "$STAGING/ruwt-darwin-amd64" "$STAGING/intel/Ruwt.app"
pack_zip "$STAGING/arm/Ruwt.app" "Ruwt-macOS.zip"
pack_zip "$STAGING/intel/Ruwt.app" "Ruwt-macOS-Intel.zip"

# Prefer a .dmg name for the Linear-style download. A zip-backed .dmg is not a
# valid Apple disk image, so we ship the .app zip under a .dmg filename only
# when hfsplus tooling is available; otherwise keep the zip and also copy a
# clearly named archive that the site can serve as the primary click.
if command -v mkfs.hfsplus >/dev/null 2>&1; then
  IMG="$STAGING/ruwt.hfs"
  dd if=/dev/zero of="$IMG" bs=1M count=24 status=none
  mkfs.hfsplus -v Ruwt "$IMG"
  MNT="$STAGING/mnt"
  mkdir -p "$MNT"
  if sudo mount -o loop "$IMG" "$MNT" 2>/dev/null; then
    cp -R "$STAGING/arm/Ruwt.app" "$MNT/Ruwt.app"
    ln -s /Applications "$MNT/Applications"
    sudo umount "$MNT"
    cp "$IMG" "$OUT/Ruwt-macOS.dmg"
  fi
fi

cp "$STAGING/Ruwt-Setup.exe" "$OUT/Ruwt-Setup.exe"
cp "$STAGING/ruwt-linux-amd64" "$OUT/ruwt-linux-amd64"
chmod +x "$OUT/ruwt-linux-amd64"

cat > "$OUT/latest.json" <<EOF
{
  "version": "$VERSION",
  "macos": {
    "arm64": { "url": "/downloads/Ruwt-macOS.zip", "filename": "Ruwt-macOS.zip" },
    "amd64": { "url": "/downloads/Ruwt-macOS-Intel.zip", "filename": "Ruwt-macOS-Intel.zip" }
  },
  "windows": { "url": "/downloads/Ruwt-Setup.exe", "filename": "Ruwt-Setup.exe" },
  "linux": { "url": "/downloads/ruwt-linux-amd64", "filename": "ruwt-linux-amd64" }
}
EOF

echo "Launcher artifacts:"
ls -lh "$OUT"
