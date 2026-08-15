#!/usr/bin/env python3
"""Build a Linear-style DMG without Finder AppleScript (works on GitHub Actions).

Re-seals Ruwt.app with a consistent ad-hoc signature after copy. A broken
bundle seal makes Sequoia say the app is damaged / cannot be verified, with
no Open Anyway path.
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


def adhoc_sign(target: Path) -> None:
    subprocess.call(["xattr", "-cr", str(target)])
    # Ad-hoc seal only. Do not pass --options runtime — hardened runtime
    # needs a Developer ID. Do not --strict verify; that fails on ad-hoc.
    run(["codesign", "--force", "--deep", "--sign", "-", "--timestamp=none", str(target)])
    run(["codesign", "--verify", "--deep", "--verbose=2", str(target)])


def mount_point(attach_output: str) -> str:
    for line in reversed(attach_output.splitlines()):
        if "/Volumes/" in line or "/tmp/" in line:
            idx = line.find("/Volumes/") if "/Volumes/" in line else line.find("/tmp/")
            return line[idx:].strip()
    raise SystemExit(f"could not parse hdiutil attach output:\n{attach_output}")


def reseal_dmg(dmg: Path) -> None:
    rw = dmg.with_name(f"{dmg.stem}-rw.dmg")
    rw.unlink(missing_ok=True)
    run(["hdiutil", "convert", str(dmg), "-format", "UDRW", "-o", str(rw)])
    attached = subprocess.check_output(
        ["hdiutil", "attach", str(rw), "-readwrite", "-nobrowse"],
        text=True,
    )
    print(attached, flush=True)
    volume = Path(mount_point(attached))
    try:
        adhoc_sign(volume / "Ruwt.app")
    finally:
        subprocess.call(["sync"])
        for _ in range(5):
            if subprocess.call(["hdiutil", "detach", str(volume), "-quiet"]) == 0:
                break
            subprocess.call(["sleep", "2"])
        else:
            subprocess.check_call(["hdiutil", "detach", str(volume), "-force"])
    dmg.unlink()
    run(["hdiutil", "convert", str(rw), "-format", "UDZO", "-imagekey", "zlib-level=9", "-o", str(dmg)])
    rw.unlink(missing_ok=True)
    # Leave the DMG unsigned. An ad-hoc signature on the disk image can
    # stop Gatekeeper from mounting a download; the app seal is what matters.


def main() -> None:
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUT
    if not APP.is_dir():
        raise SystemExit(f"missing app bundle: {APP}")
    if not BACKGROUND.is_file():
        raise SystemExit(f"missing DMG background: {BACKGROUND}")
    out.parent.mkdir(parents=True, exist_ok=True)
    adhoc_sign(APP)
    env = os.environ.copy()
    env["RUWT_DESKTOP_ROOT"] = str(ROOT)
    cmd = ["dmgbuild", "-s", str(SETTINGS), "Ruwt", str(out)]
    print(" ".join(cmd), flush=True)
    subprocess.check_call(cmd, env=env)
    reseal_dmg(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
