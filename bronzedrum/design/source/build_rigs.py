#!/usr/bin/env python3
"""Bronze Drum puppet rigs: cut the delivered part sheets into jointed pieces.

    python3 bronzedrum/design/source/build_rigs.py          # write rigs
    python3 bronzedrum/design/source/build_rigs.py --check  # verify they are current

The part sheets (BD-R01..R04, game/assets/art/rig-*.png) are separate cut-paper
pieces with painted pin holes, laid out apart. For each rig, the data below
gives every piece's box on the sheet, the pin hole it turns about (its pivot)
and where that pin sits on its parent, all in sheet pixels, measured from the
sheet. The script crops each piece, scales it down and writes:

    game/assets/rigs/<rig>/<piece>.webp   - the pieces
    game/assets/rigs/<rig>.json           - pivots, parents and draw order

The renderer (Renderer.drawRig) poses the pieces about their pins. A rig with
no pieces built falls back to the whole-figure sprite.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "game" / "assets" / "art"
OUT = ROOT / "game" / "assets" / "rigs"

# Each piece: box (x0, y0, x1, y1), pivot (its own pin), parent, anchor (the
# parent's pin it hangs on), z (draw order, back to front). Coordinates are
# sheet pixels. The root piece has no parent and stands on the ground.
RIGS = {
    "sister-trac": {
        "sheet": "rig-sister-trac.png",
        "height": 320,  # pixels the assembled figure is exported at (crown to feet)
        "pieces": {
            "skirt": {"box": (1048, 2056, 3120, 4044), "pivot": (2080, 2116), "z": 3},
            # The legs pin low under the long skirt so the sandals show below the
            # hem; the left one is mirrored so both feet point the way she faces.
            "legL": {"box": (564, 2840, 1180, 4044), "pivot": (1100, 2910), "parent": "skirt", "anchor": (1880, 3010), "z": 2, "flip": True},
            "legR": {"box": (3000, 2840, 3844, 3980), "pivot": (3080, 2910), "parent": "skirt", "anchor": (2300, 3040), "z": 2},
            "torso": {"box": (1540, 1248, 2620, 2052), "pivot": (2080, 1944), "parent": "skirt", "anchor": (2080, 2116), "z": 5},
            "head": {"box": (1640, 44, 2412, 1220), "pivot": (2076, 1156), "parent": "torso", "anchor": (2076, 1310), "z": 6},
            "cape": {"box": (104, 1564, 1284, 3440), "pivot": (1040, 1634), "parent": "torso", "anchor": (1610, 1380), "z": 0},
            "sashA": {"box": (2912, 1876, 3984, 2728), "pivot": (2980, 1940), "parent": "torso", "anchor": (2330, 1944), "z": 4},
            "sashB": {"box": (2708, 1912, 3872, 3176), "pivot": (2770, 1974), "parent": "torso", "anchor": (2290, 1944), "z": 4},
            # The back arm: a shoulder cap and a forearm with an open hand.
            "capL": {"box": (1036, 452, 1416, 1056), "pivot": (1253, 517), "parent": "torso", "anchor": (1610, 1380), "z": 1},
            "foreL": {"box": (928, 940, 1524, 1920), "pivot": (1016, 1000), "parent": "capL", "anchor": (1249, 993), "z": 1},
            # The drumming arm: shoulder cap, upper arm, forearm with the stick.
            "capR": {"box": (2668, 504, 3068, 1092), "pivot": (2816, 564), "parent": "torso", "anchor": (2554, 1380), "z": 7},
            "armR": {"box": (2956, 960, 3340, 1892), "pivot": (3084, 1020), "parent": "capR", "anchor": (2856, 1030), "z": 8},
            "stick": {"box": (3096, 64, 3828, 1592), "pivot": (3380, 1524), "parent": "armR", "anchor": (3250, 1826), "z": 9},
        },
    },
    "sister-nhi": {
        "sheet": "rig-sister-nhi.png",
        "height": 320,
        "pieces": {
            "skirt": {"box": (888, 2240, 3412, 4068), "pivot": (2200, 2301), "z": 3},
            # Both feet point the way she faces (the right leg is mirrored).
            "legL": {"box": (104, 2544, 684, 3844), "pivot": (580, 2650), "parent": "skirt", "anchor": (1980, 3000), "z": 2},
            "legR": {"box": (3460, 2528, 4000, 3856), "pivot": (3576, 2630), "parent": "skirt", "anchor": (2420, 3020), "z": 2, "flip": True},
            "torso": {"box": (1576, 1200, 2784, 2216), "pivot": (2198, 2154), "parent": "skirt", "anchor": (2200, 2301), "z": 5},
            "head": {"box": (1308, 24, 2544, 1244), "pivot": (2210, 1144), "parent": "torso", "anchor": (2200, 1236), "z": 6},
            # Two drumming arms: the upper arm with its long sleeve, and the
            # forearm with the stick, pinned at the elbow.
            "armL": {"box": (80, 536, 1236, 2316), "pivot": (1146, 600), "parent": "torso", "anchor": (1640, 1526), "z": 1},
            "foreL": {"box": (188, 32, 944, 1216), "pivot": (440, 1100), "parent": "armL", "anchor": (830, 970), "z": 2},
            "armR": {"box": (2844, 556, 4008, 2368), "pivot": (2936, 616), "parent": "torso", "anchor": (2716, 1526), "z": 7},
            "foreR": {"box": (3428, 200, 3996, 1300), "pivot": (3650, 1190), "parent": "armR", "anchor": (3185, 975), "z": 8},
        },
    },
}
# Water rigs retain the joint hierarchy but use independently measured crop boxes.
import copy
for _name in ("sister-trac", "sister-nhi"):
    RIGS[f"wp-{_name}"] = copy.deepcopy(RIGS[_name])
    RIGS[f"wp-{_name}"]["sheet"] = f"wp-rig-{_name}.png"

for _part, _box in {'skirt': [1050, 2092, 3156, 4028], 'legL': [544, 2840, 1190, 4050], 'legR': [2998, 2838, 3894, 4014], 'torso': [1570, 1224, 2664, 2104], 'head': [1630, 70, 2470, 1208], 'cape': [52, 1542, 1258, 3426], 'sashA': [2896, 1900, 4050, 2764], 'sashB': [2690, 1936, 3918, 3194], 'capL': [1032, 446, 1460, 1060], 'foreL': [908, 936, 1544, 1962], 'capR': [2664, 518, 3100, 1116], 'armR': [2972, 968, 3376, 1910], 'stick': [3082, 62, 3882, 1596]}.items():
    RIGS["wp-sister-trac"]["pieces"][_part]["box"] = tuple(_box)

for _part, _box in {'skirt': [890, 2280, 3376, 4078], 'legL': [68, 2516, 704, 3882], 'legR': [3442, 2544, 4024, 3908], 'torso': [1496, 1248, 2782, 2258], 'head': [1318, 20, 2552, 1258], 'armL': [60, 844, 1252, 2548], 'foreL': [164, 26, 964, 1226], 'armR': [2844, 844, 4048, 2548], 'foreR': [3406, 190, 4028, 1360]}.items():
    RIGS["wp-sister-nhi"]["pieces"][_part]["box"] = tuple(_box)
RIGS["wp-sister-nhi"]["pieces"]["armL"]["pivot"] = (1146, 938)
RIGS["wp-sister-nhi"]["pieces"]["armR"]["pivot"] = (2936, 938)

PAD = 6  # sheet pixels kept around each piece's box


def layout(rig):
    """World positions of every pivot at rest (no rotation), root pivot at 0, 0."""
    pieces = rig["pieces"]
    pos = {}

    def place(name):
        if name in pos:
            return pos[name]
        p = pieces[name]
        if "parent" not in p:
            pos[name] = (0.0, 0.0)
        else:
            px, py = place(p["parent"])
            pp = pieces[p["parent"]]["pivot"]
            pos[name] = (px + p["anchor"][0] - pp[0], py + p["anchor"][1] - pp[1])
        return pos[name]

    for n in pieces:
        place(n)
    xs, ys = [], []
    for n, p in pieces.items():
        x0, y0, x1, y1 = p["box"]
        wx, wy = pos[n]
        xs += [wx + x0 - p["pivot"][0], wx + x1 - p["pivot"][0]]
        ys += [wy + y0 - p["pivot"][1], wy + y1 - p["pivot"][1]]
    return pos, (min(xs), min(ys), max(xs), max(ys))


def labels(sheet, half=2):
    """Connected opaque regions of the sheet at 1/half resolution: a label per
    pixel, so each piece can be cut out without bits of its neighbours."""
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(sheet)],
                           capture_output=True, text=True, check=True).stdout.strip().split(",")
    W, H = int(probe[0]) // half, int(probe[1]) // half
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(sheet), "-vf", f"scale={W}:{H}",
                          "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True, check=True).stdout
    alpha = raw[3::4]
    lab = [0] * (W * H)
    n = 0
    for start in range(W * H):
        if alpha[start] < 40 or lab[start]:
            continue
        n += 1
        lab[start] = n
        stack = [start]
        while stack:
            p = stack.pop()
            x = p % W
            for q in (p - 1 if x else -1, p + 1 if x < W - 1 else -1, p - W, p + W):
                if 0 <= q < W * H and not lab[q] and alpha[q] >= 40:
                    lab[q] = n
                    stack.append(q)
    return lab, W, H, half


def piece_mask(lab, W, H, half, box, path):
    """A PGM mask of a piece's box: white where its own region is (the largest
    region in the box), grown by a pixel so the cut edge stays soft."""
    x0, y0, x1, y1 = (v // half for v in box)
    counts = {}
    for y in range(max(0, y0), min(H, y1)):
        for v in lab[y * W + max(0, x0):y * W + min(W, x1)]:
            if v:
                counts[v] = counts.get(v, 0) + 1
    own = max(counts, key=counts.get)
    w, h = x1 - x0, y1 - y0
    m = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            sx, sy = x0 + x, y0 + y
            if 0 <= sx < W and 0 <= sy < H and lab[sy * W + sx] == own:
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if 0 <= x + dx < w and 0 <= y + dy < h:
                            m[(y + dy) * w + x + dx] = 255
    path.write_bytes(f"P5 {w} {h} 255\n".encode() + bytes(m))


def build(name, rig, write=True):
    _, (bx0, by0, bx1, by1) = layout(rig)
    k = rig["height"] / (by1 - by0)
    out = {"rig": name, "scale": k, "ground": round(by1 * k, 2), "top": round(by0 * k, 2), "pieces": {}}
    sheet = ART / rig["sheet"]
    lab = labels(sheet) if write else None
    for pn, p in rig["pieces"].items():
        x0, y0, x1, y1 = p["box"]
        x0, y0, x1, y1 = x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD
        w, h = round((x1 - x0) * k), round((y1 - y0) * k)
        px = (x1 - p["pivot"][0]) if p.get("flip") else (p["pivot"][0] - x0)
        entry = {
            "file": f"rigs/{name}/{pn}.webp",
            "w": w, "h": h,
            "pivot": [round(px * k, 2), round((p["pivot"][1] - y0) * k, 2)],
            "z": p["z"],
        }
        if "parent" in p:
            q = rig["pieces"][p["parent"]]
            qx0, qy0 = q["box"][0] - PAD, q["box"][1] - PAD
            entry["parent"] = p["parent"]
            entry["anchor"] = [round((p["anchor"][0] - qx0) * k, 2), round((p["anchor"][1] - qy0) * k, 2)]
        out["pieces"][pn] = entry
        if write:
            dest = OUT / name / f"{pn}.webp"
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory() as tmp:
                mask = Path(tmp) / "mask.pgm"
                piece_mask(*lab, (x0, y0, x1, y1), mask)
                flip = ",hflip" if p.get("flip") else ""
                # Keep only the piece's own pixels: its alpha times its mask.
                graph = (f"[0:v]crop={x1 - x0}:{y1 - y0}:{x0}:{y0},format=rgba,split[c][d];"
                         f"[d]alphaextract[a];[1:v]scale={x1 - x0}:{y1 - y0}:flags=bilinear,format=gray[m];"
                         f"[a][m]blend=all_mode=multiply[am];[c][am]alphamerge,scale={w}:{h}:flags=lanczos{flip}")
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(sheet), "-i", str(mask), "-filter_complex", graph,
                                "-c:v", "libwebp", "-pix_fmt", "yuva420p", "-quality", "88", str(dest)], check=True)
    return json.dumps(out, indent=2) + "\n"


def main():
    check = "--check" in sys.argv
    stale = []
    for name, rig in RIGS.items():
        text = build(name, rig, write=not check)
        path = OUT / f"{name}.json"
        if check:
            missing = [pn for pn in rig["pieces"] if not (OUT / name / f"{pn}.webp").exists()]
            if not path.exists() or path.read_text(encoding="utf-8") != text or missing:
                stale.append(name)
        else:
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT.parent)} and {len(rig['pieces'])} pieces")
    for n in stale:
        print(f"out of date: rig {n} (run build_rigs.py)")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main())
