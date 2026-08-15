#!/usr/bin/env python3
"""Build a Linear-style DMG without Finder AppleScript (works on GitHub Actions)."""
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


def main() -> None:
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUT
    if not APP.is_dir():
        raise SystemExit(f"missing app bundle: {APP}")
    if not BACKGROUND.is_file():
        raise SystemExit(f"missing DMG background: {BACKGROUND}")
    out.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["RUWT_DESKTOP_ROOT"] = str(ROOT)
    cmd = ["dmgbuild", "-s", str(SETTINGS), "Ruwt", str(out)]
    print(" ".join(cmd), flush=True)
    subprocess.check_call(cmd, env=env)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
