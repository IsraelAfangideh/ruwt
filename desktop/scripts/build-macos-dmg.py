#!/usr/bin/env python3
"""Build a Linear-style DMG without Finder AppleScript (works on GitHub Actions).

If APPLE_SIGNING_IDENTITY is a Developer ID, leave Tauri's signature on
Ruwt.app and do not ad-hoc re-sign (that would strip notarization).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src-tauri/target/release/bundle/macos/Ruwt.app"
BACKGROUND = ROOT / "src-tauri/dmg/background.png"
SETTINGS = Path(__file__).with_name("dmg-settings.py")
DEFAULT_OUT = ROOT / "src-tauri/target/release/bundle/dmg/Ruwt.dmg"


def run(args: list[str]) -> None:
    print(" ".join(args), flush=True)
    subprocess.check_call(args)


def identity() -> str:
    return os.environ.get("APPLE_SIGNING_IDENTITY", "").strip() or "-"


def prepare_app() -> None:
    subprocess.call(["xattr", "-cr", str(APP)])
    signer = identity()
    if signer == "-":
        run(["codesign", "--force", "--deep", "--sign", "-", "--timestamp=none", str(APP)])
        run(["codesign", "--verify", "--deep", "--verbose=2", str(APP)])
        return
    run(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(APP)])


def main() -> None:
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUT
    if not APP.is_dir():
        raise SystemExit(f"missing app bundle: {APP}")
    if not BACKGROUND.is_file():
        raise SystemExit(f"missing DMG background: {BACKGROUND}")
    out.parent.mkdir(parents=True, exist_ok=True)
    prepare_app()
    env = os.environ.copy()
    env["RUWT_DESKTOP_ROOT"] = str(ROOT)
    cmd = ["dmgbuild", "-s", str(SETTINGS), "Ruwt", str(out)]
    print(" ".join(cmd), flush=True)
    subprocess.check_call(cmd, env=env)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
