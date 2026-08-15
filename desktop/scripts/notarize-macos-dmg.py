#!/usr/bin/env python3
"""Sign the Linear-style DMG with Developer ID and notarize it."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DMG = ROOT / "src-tauri/target/release/bundle/dmg/Ruwt.dmg"


def run(args: list[str]) -> None:
    print(" ".join(args), flush=True)
    subprocess.check_call(args)


def main() -> None:
    dmg = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_DMG
    identity = os.environ.get("APPLE_SIGNING_IDENTITY", "").strip()
    if not identity or identity == "-":
        raise SystemExit("APPLE_SIGNING_IDENTITY is missing; refusing to notarize an unsigned DMG.")
    if not dmg.is_file():
        raise SystemExit(f"missing DMG: {dmg}")

    key = os.environ.get("APPLE_API_KEY_PATH", "").strip()
    key_id = os.environ.get("APPLE_API_KEY", "").strip()
    issuer = os.environ.get("APPLE_API_ISSUER", "").strip()
    if not (key and key_id and issuer and Path(key).is_file()):
        raise SystemExit("APPLE_API_KEY_PATH / APPLE_API_KEY / APPLE_API_ISSUER are required for notarytool.")

    run(["xattr", "-cr", str(dmg)])
    run(["codesign", "--force", "--sign", identity, "--timestamp", str(dmg)])
    run(["codesign", "--verify", "--verbose=2", str(dmg)])
    run([
        "xcrun", "notarytool", "submit", str(dmg),
        "--key", key,
        "--key-id", key_id,
        "--issuer", issuer,
        "--wait",
        "--timeout", "15m",
    ])
    run(["xcrun", "stapler", "staple", str(dmg)])
    run(["xcrun", "stapler", "validate", str(dmg)])
    print(f"notarized {dmg} ({dmg.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
