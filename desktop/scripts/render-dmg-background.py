#!/usr/bin/env python3
"""Render the Linear-style DMG background: cream field, gold chevron pointing right."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Finder window is 660x400. Render 4x then downscale for a clean chevron.
WIN_W, WIN_H = 660, 400
SCALE = 4
OUT = Path(__file__).resolve().parents[1] / "src-tauri" / "dmg" / "background.png"

# Icon centers in window coordinates (must match tauri.conf.json).
APP_X, APP_Y = 160, 168
APPS_X, APPS_Y = 500, 168

BG = (245, 243, 240)  # #f5f3f0
GOLD = (132, 106, 48, 190)  # #846a30


def chevron(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    arm = 40 * s
    spread = 46 * s
    width = 11 * s
    path = [
        (cx - arm, cy - spread),
        (cx + int(arm * 0.62), cy),
        (cx - arm, cy + spread),
    ]
    draw.line(path, fill=GOLD, width=width, joint="curve")
    r = width // 2
    for x, y in (path[0], path[-1], path[1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=GOLD)


def main() -> None:
    w, h, s = WIN_W * SCALE, WIN_H * SCALE, SCALE
    img = Image.new("RGBA", (w, h), (*BG, 255))
    draw = ImageDraw.Draw(img)
    cx = ((APP_X + APPS_X) // 2) * s
    cy = ((APP_Y + APPS_Y) // 2) * s
    chevron(draw, cx, cy, s)
    out = img.resize((WIN_W, WIN_H), Image.Resampling.LANCZOS).filter(ImageFilter.SMOOTH)
    rgb = Image.new("RGB", out.size, BG)
    rgb.paste(out, mask=out.split()[-1])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({WIN_W}x{WIN_H})")


if __name__ == "__main__":
    main()
