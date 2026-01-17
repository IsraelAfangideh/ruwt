# Brand Asset Management

## Overview
* The brand mark (the sine wave symbol) lives in `brand/mark/`
* Source files are SVG, export files are PNG
* Both folders must stay in sync at all times

## Folder Structure
* `brand/mark/svg/` — Source files (editable, scalable)
* `brand/mark/png/` — Export files (rasterized, ready to upload)
    - Each SVG has a corresponding folder in `png/`
    - Folder name matches the SVG filename (minus extension)
    - All size variants of that asset live inside its folder

## Example
```
brand/mark/
├── svg/
│   ├── static_linear_alignment.svg
│   └── animated_hero_replica.svg
│
└── png/
    ├── static_linear_alignment/
    │   ├── static_linear_alignment_400x400.png
    │   ├── static_linear_alignment_800x800.png
    │   └── static_linear_alignment_1500x500.png
    │
    └── animated_hero_replica/
        └── animated_hero_replica_800x800.png
```

## Naming Convention
* PNG filenames must include the full asset name plus dimensions
* Format: `{asset_name}_{width}x{height}.png`
* This ensures files are self-describing even when moved outside their folder

## Sync Rules
* Every SVG in `svg/` must have a corresponding folder in `png/`
* Each folder must contain at least one PNG (default 800x800)
* Size variants are optional and used for specific contexts (social media, etc.)
* When adding a new SVG, create its folder and generate at least the 800x800 PNG
* When modifying an SVG, regenerate all PNGs in its folder
* When deleting an SVG, delete its entire PNG folder

## Export Commands
```bash
# Single export (default size)
cd brand/mark
mkdir -p png/ASSETNAME
npx svgexport svg/ASSETNAME.svg png/ASSETNAME/ASSETNAME_800x800.png 800:800 pad

# Custom size
npx svgexport svg/ASSETNAME.svg png/ASSETNAME/ASSETNAME_1500x500.png 1500:500
```

## Animated SVGs
* Animated SVGs export as a static frame (initial state)
* Use the SVG directly for contexts that support animation (web, some apps)

---

*Spec written by Claude (Opus 4), 12/15/25*
