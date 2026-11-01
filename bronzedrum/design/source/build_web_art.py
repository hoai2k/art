#!/usr/bin/env python3
"""Make the web copies of Bronze Drum's in-game art.

The delivered PNGs in game/assets/art/ are the masters, kept at the requested
sizes. The game draws most of them far smaller (a 1536-pixel figure appears
about 96 pixels tall), so this script writes WebP copies, scaled to twice the
largest size the game draws them at, to game/assets/web/. The game loads only
those, and only those are published.

    python3 bronzedrum/design/source/build_web_art.py           # convert stale copies
    python3 bronzedrum/design/source/build_web_art.py --check   # verify copies exist and are current

Uses ffmpeg with libwebp, or Pillow with WebP support when ffmpeg is absent.
Run build_requests.py afterwards so the manifest
points at the copies.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "game" / "assets" / "art"
WEB = ROOT / "game" / "assets" / "web"

# Game id -> (scale filter, quality). Heights are twice the largest on-screen
# height in render.js (or the full 1440-pixel canvas height at a device pixel
# ratio of 2 for full-screen layers), so the art stays sharp on high-DPI screens.
TARGETS = {
    "sky-dawn": ("scale=-1:1080", 80),
    "sky-day": ("scale=-1:1080", 80),
    "sky-night": ("scale=-1:1080", 80),
    "layer-karst-far": ("scale=-1:1080", 78),
    "layer-karst": ("scale=-1:1080", 78),
    "layer-grove": ("scale=-1:1080", 78),
    "layer-paddy": ("scale=-1:1080", 78),
    "layer-reeds": ("scale=-1:1080", 80),
    "paper-fiber": ("scale=512:512", 80),
    "sister-trac": ("scale=-1:384", 85),
    "sister-nhi": ("scale=-1:384", 85),
    "unit-spear": ("scale=-1:384", 85),
    "unit-spear-cover": ("scale=-1:384", 85),
    "unit-archer-cover": ("scale=-1:384", 85),
    # Four poses by two children, each shown 58 px tall: cells twice that.
    "children-sheet": ("scale=-1:256", 85),
    "unit-archer": ("scale=-1:384", 85),
    "han-spear": ("scale=-1:384", 85),
    "han-crossbow": ("scale=-1:384", 85),
    "drum-bearers": ("scale=-1:400", 85),
    "drummer-chau": ("scale=-1:384", 85),
    "drummer-mo": ("scale=-1:384", 85),
    "war-elephant": ("scale=-1:560", 85),
    "fort-palisade": ("scale=-1:720", 85),
    "straw-target": ("scale=-1:288", 85),
    "hud-drum": ("scale=480:480", 88),
    "touch-buttons": ("scale=480:160", 88),
    # The close-up sticks: about 260 px across at most (the touch drum, lifting).
    "hud-stick-trac": ("scale=512:512", 88),
    "hud-stick-nhi": ("scale=512:512", 88),
    "hud-stick-trac-pestle": ("scale=512:512", 88),
    "hud-stick-trac-lacquer": ("scale=512:512", 88),
    "hud-stick-nhi-bamboo": ("scale=512:512", 88),
    "hud-stick-nhi-horn": ("scale=512:512", 88),
    # Effects: scraps drawn about 30 px, arrows about 50 px, the wake burst up to 420 px.
    "fx-scraps": ("scale=1024:-1", 85),
    "fx-projectiles": ("scale=512:-1", 85),
    "fx-drum-wake": ("scale=640:640", 76),
    "logo": ("scale=1200:-1", 88),
    "ui-panel": ("scale=768:-1", 85),
    "card-garden": ("scale=800:-1", 80),
    "card-outpost": ("scale=800:-1", 80),
    "card-luylau": ("scale=800:-1", 80),
    # Story chapters.
    "sky-dusk": ("scale=-1:1080", 80),
    "sky-foundry": ("scale=-1:1080", 80),
    "sky-ash": ("scale=-1:1080", 80),
    "card-oath": ("scale=800:-1", 80),
    "card-casting": ("scale=800:-1", 80),
    "card-villages": ("scale=800:-1", 80),
    "card-coronation": ("scale=800:-1", 80),
    "card-mavien": ("scale=800:-1", 80),
    "card-elegy": ("scale=800:-1", 80),
    "prop-altar": ("scale=-1:340", 85),
    "prop-mourning-drummer": ("scale=-1:320", 85),
    "prop-festival-drummers": ("scale=-1:340", 85),
    "prop-village-house": ("scale=-1:260", 85),
    "prop-lantern": ("scale=-1:64", 88),
    "prop-bronze-drum": ("scale=-1:180", 85),
    "prop-furnace": ("scale=-1:380", 85),
    "prop-mould": ("scale=-1:200", 85),
    "prop-drum-cast": ("scale=-1:200", 85),
    "han-general": ("scale=-1:360", 85),
    # Drum Practice (stand-ins until delivered).
    "card-practice-free": ("scale=800:-1", 80),
    "card-practice-training": ("scale=800:-1", 80),
    "card-practice-call": ("scale=800:-1", 80),
    "prop-dinh": ("scale=-1:512", 85),
    "dancer-sheet": ("scale=768:1024", 85),
    "kit-faces": ("scale=1536:256", 85),
    "drum-palanquin": ("scale=-1:400", 85),
}

# The water-puppet twins (build_requests.py, BD-W): each at its shadow-puppet image's size.
for _base in list(TARGETS):
    if _base not in ("hud-drum", "touch-buttons", "logo") and not _base.startswith(("hud-stick", "kit-")):
        TARGETS["wp-" + _base] = TARGETS[_base]
TARGETS["wp-water"] = ("scale=2048:-1", 80)


def web_path(asset_id: str) -> Path:
    return WEB / f"{asset_id}.webp"


def stale(asset_id: str) -> bool:
    src, out = ART / f"{asset_id}.png", web_path(asset_id)
    return src.exists() and (not out.exists() or out.stat().st_mtime < src.stat().st_mtime)


def convert(asset_id: str) -> None:
    scale, quality = TARGETS[asset_id]
    src = ART / f"{asset_id}.png"
    WEB.mkdir(parents=True, exist_ok=True)
    if not shutil.which("ffmpeg"):
        from PIL import Image
        width, height = (int(n) for n in scale.removeprefix("scale=").split(":"))
        with Image.open(src) as image:
            if width == -1:
                width = round(image.width * height / image.height)
            if height == -1:
                height = round(image.height * width / image.width)
            image.resize((width, height), Image.Resampling.LANCZOS).save(
                web_path(asset_id), "WEBP", quality=quality, method=6,
            )
        return
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", f"{scale}:flags=lanczos",
         "-c:v", "libwebp", "-pix_fmt", "yuva420p", "-quality", str(quality),
         "-compression_level", "6", str(web_path(asset_id))],
        check=True,
    )


def main() -> int:
    missing_master = [a for a in TARGETS if not (ART / f"{a}.png").exists()]
    if "--check" in sys.argv:
        bad = [a for a in TARGETS if (ART / f"{a}.png").exists() and not web_path(a).exists()]
        for a in bad:
            print(f"missing web copy: assets/web/{a}.webp (run build_web_art.py)")
        # Every image the game loads must have a size here, or it would load an unpublished master.
        manifest = json.loads((ROOT / "game" / "assets" / "manifest.json").read_text(encoding="utf-8"))
        untargeted = [a["id"] for a in manifest["assets"] if a.get("runtime") and a["id"] not in TARGETS]
        for a in untargeted:
            print(f"no web size for game image {a}: add it to TARGETS in build_web_art.py")
        return 1 if bad or untargeted else 0
    for a in TARGETS:
        if a in missing_master:
            continue
        if stale(a) or "--force" in sys.argv:
            convert(a)
            print(f"wrote assets/web/{a}.webp ({web_path(a).stat().st_size // 1024} KB)")
    total = sum(web_path(a).stat().st_size for a in TARGETS if web_path(a).exists())
    print(f"web art: {total / 1e6:.1f} MB for {len(TARGETS) - len(missing_master)} images")
    return 0


if __name__ == "__main__":
    sys.exit(main())
