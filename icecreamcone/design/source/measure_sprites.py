#!/usr/bin/env python3
"""Measure a feature that never changes size on every cell of the posed
sprite sheets of Bin Day, Lucky Dip and Pressing Business (the bin's rim,
the lid, the canary's eye; the Key Crane's key; the iron's handle), so each
game draws every pose at one consistent scale. The rims are measured from the
alpha; the rest are landmarks read by eye from zoomed crops (MANUAL). Writes
design/source/sprite-measures.json; the games' tests read it.

    python3 icecreamcone/design/source/measure_sprites.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPR = ROOT / "game" / "assets" / "sprites"
OUT = Path(__file__).resolve().parent / "sprite-measures.json"


def cell(name, cols, rows, i):
    im = Image.open(SPR / name).convert("RGBA")
    cw, ch = im.width // cols, im.height // rows
    return im.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch))


def rim_box(c, depth=45):
    """The bin's rim: its top, and its left and right over the top rows."""
    a = c.getchannel("A")
    top = a.point(lambda v: 255 if v > 100 else 0).getbbox()[1]
    xs = [x for y in range(top, top + depth) for x in range(c.width) if a.getpixel((x, y)) > 100]
    return {"x0": min(xs), "x1": max(xs), "top": top, "width": max(xs) - min(xs) + 1}


# Landmarks read by eye from zoomed crops of the cells (the shading of the
# eye-whites and the lids' rims defeats a simple threshold), cell px.
MANUAL = {
    # The canary's eye, outer diameter across its ink ring.
    "eye": {"sheet": 57.5, "neck": [44, 41, 41, 41, 41, 41]},
    # Each lid from its front tip to its back corner.
    "lid": {
        "sheet": {"front": [207, 118.5], "back": [766, 319]},
        "call": [{"front": [160, 122], "back": [767, 338.5]}, {"front": [167, 125], "back": [767, 337]}],
        "only": {"front": [242, 165], "back": [758, 349.5]},
    },
    # Lucky Dip: from the middle of the eye to the key's far knob.
    "keycrane": {"hang": [693, 697], "startle": [700]},
    # Pressing Business: the wooden handle's length along the iron.
    "steampressersparrow": {"press": [415, 415], "scorch": [412]},
}


def main():
    m = {
        "garbagecanary": {
            "rim": {
                "sheet": rim_box(cell("garbagecanary-lid.png", 2, 1, 0)),
                "walk": [rim_box(cell("garbagecanary-walk.png", 4, 1, i)) for i in range(4)],
            },
            "eye": MANUAL["eye"],
            "lid": MANUAL["lid"],
        },
        "keycrane": MANUAL["keycrane"],
        "steampressersparrow": MANUAL["steampressersparrow"],
    }
    open(OUT, "w").write(json.dumps(m, indent=2) + "\n")
    print(json.dumps(m, indent=2))


if __name__ == "__main__":
    main()
