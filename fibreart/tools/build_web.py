#!/usr/bin/env python3
"""Build the web copies of the Fibre Art art and the scene data the game reads.

    python3 fibreart/tools/build_web.py          # write fibreart/game/web/
    python3 fibreart/tools/build_web.py --check  # verify scenes.json is up to date
    python3 fibreart/tools/build_web.py --data   # rewrite only scenes.json (after moving piece homes)

Needs Pillow, NumPy and SciPy. Reads the delivered sources in game/assets/
(the full-size generated images, with the tableau sheets already cut into
game/assets/tableaux/*/pieces/ by tools/extract_pieces.py) and writes
optimised WebP copies to game/web/, which is what publish.sh ships:

    web/tableaux/<scene>/ground.webp        the layer behind the pieces
    web/tableaux/<scene>/composition.webp   the finished picture (resting state)
    web/tableaux/<scene>/NN.webp            each piece, with alpha
    web/chains/<chain>-N.webp               each stage of a morph chain
    web/textures/<name>.webp, web/masks/<name>.webp, web/ui/*, web/icons/*
    web/audio/aksak-folk-dance.mp3          the song (needs ffmpeg)
    web/scenes.json                         every scene, piece home, kind and chain

Where a request is still undelivered the tool makes a stand-in and says so in
scenes.json ("standin"): pieces cut by colour from the composition (Moons and
hearts, The dancers), a blurred wash of the composition (the Viriditas ground),
the moon chain's first stage on indigo batik (the icon).

Piece homes are placed by eye on each composition (centre x, centre y and width,
as fractions of the picture), because the generated pieces only roughly match
their compositions. Adjust them in SCENES below and rerun.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "game" / "assets"
OUT = ROOT / "game" / "web"

GROUND_W = 1600
PIECE_MAX = 640
CHAIN_MAX = 512

# Morph chains and the piece kinds that can travel along them.
CHAINS = {
    "moon": ["moon", "sun", "heart"],
    "face": ["face"],
    "figure": ["figure"],
    "flower": ["flower", "berries"],
    "tree": ["tree", "bud"],
    "bird": ["bird", "fish", "leaf"],
}

# Per scene: name, the colour of its threads and wash, and each piece as
# (centre x, centre y, width, kind). Order matches the request's piece list.
SCENES = {
    "viriditas": {
        "name": "Viriditas",
        "wash": "#2a1d5c",
        "thread": "#f2c230",
        "pieces": [
            (0.51, 0.34, 0.14, "sun"),
            (0.63, 0.48, 0.30, "tree"),
            (0.14, 0.56, 0.20, "tree"),
            (0.86, 0.50, 0.19, "tree"),
            (0.52, 0.71, 0.10, "tree"),
            (0.32, 0.49, 0.12, "berries"),
            (0.68, 0.55, 0.08, "berries"),
            (0.92, 0.50, 0.06, "berries"),
            (0.55, 0.42, 0.04, "bud"),
            (0.26, 0.12, 0.22, "cloud"),
            (0.74, 0.28, 0.07, "bird"),
            (0.40, 0.90, 0.18, "leaf"),
        ],
    },
    "night-quilt": {
        "name": "Moons and hearts",
        "wash": "#0d1440",
        "thread": "#5fb4ff",
        "pieces": [
            (0.24, 0.27, 0.165, "moon"),
            (0.77, 0.53, 0.235, "moon"),
            (0.44, 0.25, 0.215, "heart"),
            (0.155, 0.67, 0.21, "heart"),
            (0.30, 0.59, 0.175, "hand"),
            (0.285, 0.785, 0.17, "flower"),
            (0.50, 0.63, 0.25, "panel"),
            (0.80, 0.86, 0.22, "band"),
            (0.79, 0.16, 0.10, "star"),
        ],
        # Stand-ins cut from the composition: (box x0, y0, x1, y1, key, kind).
        "cut": [
            (0.155, 0.08, 0.32, 0.46, "yellow", "moon"),
            (0.65, 0.33, 0.885, 0.73, "yellow", "moon"),
            (0.33, 0.085, 0.545, 0.43, "red", "heart"),
            (0.05, 0.48, 0.26, 0.86, "red", "heart"),
            (0.21, 0.47, 0.385, 0.70, "yellow", "hand"),
            (0.20, 0.66, 0.37, 0.91, "warm", "flower"),
            (0.375, 0.415, 0.625, 0.845, "rect", "panel"),
            (0.74, 0.08, 0.84, 0.245, "white", "star"),
        ],
    },
    "golden-lady": {
        "name": "The Golden Lady",
        "wash": "#7a62b8",
        "thread": "#ffbf1f",
        "pieces": [
            (0.362, 0.375, 0.14, "face"),
            (0.356, 0.245, 0.175, "hair"),
            (0.45, 0.80, 0.45, "body"),
            (0.10, 0.50, 0.22, "tree"),
            (0.74, 0.30, 0.14, "cloud"),
            (0.94, 0.32, 0.14, "cloud"),
            (0.55, 0.16, 0.24, "cloud"),
            (0.67, 0.42, 0.05, "sun"),
        ],
    },
    "black-tree": {
        "name": "The black tree",
        "wash": "#5c1408",
        "thread": "#f4e6c8",
        "pieces": [
            (0.40, 0.50, 0.50, "tree"),
            (0.13, 0.21, 0.10, "leaf"),
            (0.43, 0.13, 0.10, "leaf"),
            (0.21, 0.25, 0.09, "leaf"),
            (0.17, 0.60, 0.28, "face"),
            (0.77, 0.36, 0.24, "face"),
            (0.60, 0.63, 0.20, "face"),
            (0.83, 0.80, 0.30, "house"),
            (0.93, 0.33, 0.07, "diamond"),
        ],
    },
    "two-moons": {
        "name": "Two moons over lace mountains",
        "wash": "#0b1f5c",
        "thread": "#3cc8e8",
        "pieces": [
            (0.25, 0.35, 0.18, "moon"),
            (0.70, 0.37, 0.18, "moon"),
            (0.53, 0.35, 0.14, "moon"),
            (0.42, 0.74, 0.76, "mountain"),
            (0.50, 0.17, 0.86, "band"),
            (0.89, 0.74, 0.14, "mountain"),
            (0.87, 0.39, 0.07, "star"),
        ],
    },
    "dancers": {
        "name": "The dancers",
        "wash": "#8c1010",
        "thread": "#2f5fd0",
        "pieces": [
            (0.25, 0.24, 0.375, "figure"),
            (0.575, 0.27, 0.235, "figure"),
            (0.275, 0.685, 0.405, "figure"),
            (0.625, 0.70, 0.105, "figure"),  # the reaching dancer, inside the quilted window
            (0.347, 0.11, 0.099, "sun"),
            (0.826, 0.46, 0.228, "tree"),
            (0.625, 0.705, 0.24, "panel"),
        ],
        "cut": [
            (0.065, 0.02, 0.44, 0.46, "blue", "figure"),
            (0.455, 0.035, 0.69, 0.50, "red", "figure"),
            (0.075, 0.48, 0.48, 0.885, "bluered", "figure"),
            (0.297, 0.03, 0.396, 0.193, "disc", "sun"),
            (0.712, 0.03, 0.94, 0.89, "blue", "tree"),
            (0.505, 0.535, 0.745, 0.875, "rect", "panel"),
        ],
    },
    "man-and-woman": {
        "name": "Man and woman",
        "wash": "#6b2a2a",
        "thread": "#f0a040",
        "pieces": [
            (0.27, 0.61, 0.38, "figure"),
            (0.60, 0.60, 0.26, "figure"),
            (0.33, 0.15, 0.32, "sun"),
            (0.10, 0.30, 0.16, "house"),
            (0.80, 0.40, 0.40, "tree"),
            (0.92, 0.50, 0.17, "tree"),
            (0.74, 0.16, 0.05, "leaf"),
            (0.70, 0.86, 0.52, "ribbon"),
        ],
    },
    "blue-lady": {
        "name": "Blue Lady",
        "wash": "#06141f",
        "thread": "#4fd2d2",
        "pieces": [
            (0.45, 0.39, 0.90, "figure"),
            (0.71, 0.09, 0.09, "moon"),
            (0.38, 0.77, 0.35, "fish"),
            (0.93, 0.56, 0.13, "reeds"),
            (0.30, 0.90, 0.40, "ribbon"),
            (0.70, 0.86, 0.40, "ribbon"),
        ],
    },
    "crowd": {
        "name": "The crowd of faces",
        "wash": "#3a1f14",
        "thread": "#f2b45a",
        "pieces": [
            (0.52, 0.33, 0.20, "face"),
            (0.20, 0.38, 0.18, "eye"),
            (0.28, 0.80, 0.15, "face"),
            (0.38, 0.60, 0.13, "face"),
            (0.68, 0.58, 0.15, "face"),
            (0.67, 0.15, 0.12, "face"),
            (0.88, 0.48, 0.14, "face"),
            (0.57, 0.82, 0.10, "face"),
            (0.80, 0.85, 0.22, "face"),
        ],
    },
    "silk-bird": {
        "name": "The silk bird",
        "wash": "#d8c8a8",
        "thread": "#c0185a",
        "pieces": [
            (0.35, 0.38, 0.60, "bird"),
            (0.45, 0.15, 0.50, "ribbon"),
            (0.78, 0.30, 0.30, "ribbon"),
            (0.55, 0.70, 0.40, "ribbon"),
            (0.20, 0.72, 0.38, "ribbon"),
            (0.78, 0.76, 0.42, "fish"),
            (0.89, 0.17, 0.20, "triangle"),
        ],
    },
}

TEXTURES = ["indigo-batik", "rust-paisley", "gold-damask", "turquoise-satin",
            "black-lace", "brown-netting", "green-silk", "ultramarine-canvas"]
MASKS = ["torn-paper", "watercolour-bloom", "seams", "unravel", "swirl", "stitch-line"]
LINE_DRAWINGS = ["face-closed", "face-open", "embrace", "window", "hand", "needle",
                 "moon", "heart", "tree", "bird", "boots", "spool"]


def chain_of(kind: str) -> str | None:
    for chain, kinds in CHAINS.items():
        if kind in kinds:
            return chain
    return None


def save_webp(im: Image.Image, path: Path, quality: int = 82) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=4)


def fit(im: Image.Image, longest: int) -> Image.Image:
    scale = longest / max(im.size)
    if scale >= 1:
        return im
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


def components(alpha: np.ndarray, min_area: int, dilate: int = 3) -> list[tuple[slice, slice]]:
    labels, _ = ndimage.label(ndimage.binary_dilation(alpha > 32, iterations=dilate))
    out = []
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        if box is None:
            continue
        area = int((labels[box] == i).sum())
        if area >= min_area:
            out.append(box)
    return out


def key_mask(rgb: np.ndarray, key: str) -> np.ndarray:
    r, g, b = (rgb[:, :, i].astype(np.int16) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1)
    if key == "yellow":
        m = (r > 150) & (g > 115) & (b < 170) & (r - b > 40)
    elif key == "red":
        m = (r > 110) & (r > g * 1.45) & (r > b * 1.35)
    elif key == "warm":
        m = ((r > 120) & (r > b * 1.5)) | ((g > 70) & (b > 40) & (g > r) & (sat > 0.25))
    elif key == "white":
        m = (mn > 165)
    elif key == "blue":
        m = (b > r + 25) & (sat > 0.28) & (mx > 40)
    elif key == "bluered":
        m = ((b > r + 25) & (sat > 0.28) & (mx > 40)) | ((r > 110) & (r > g * 1.6) & (r > b * 1.4))
    else:
        raise ValueError(key)
    m = ndimage.binary_opening(m, iterations=1)
    m = ndimage.binary_closing(m, iterations=4)
    m = ndimage.binary_fill_holes(m)
    labels, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, labels, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= max(sizes) * 0.08]
        m = np.isin(labels, keep)
    return m


def cut_piece(comp: Image.Image, box, key: str) -> Image.Image:
    w, h = comp.size
    x0, y0, x1, y1 = round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)
    crop = comp.crop((x0, y0, x1, y1)).convert("RGB")
    if key in ("rect", "disc"):
        alpha = Image.new("L", crop.size, 0)
        shape = ImageDraw.Draw(alpha).rectangle if key == "rect" else ImageDraw.Draw(alpha).ellipse
        shape((4, 4, crop.width - 5, crop.height - 5), fill=255)
    else:
        alpha = Image.fromarray((key_mask(np.array(crop), key) * 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.6))
    out = crop.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 24 else 0).getbbox() or (0, 0, crop.width, crop.height)
    return out.crop(bbox), (x0 + bbox[0], y0 + bbox[1], x0 + bbox[2], y0 + bbox[3])


def build_scene(key: str, spec: dict, write: bool) -> dict:
    src = SRC / "tableaux" / key
    out = OUT / "tableaux" / key
    comp = Image.open(src / "composition.webp").convert("RGB")
    standin = []
    if write:
        save_webp(fit(comp, GROUND_W), out / "composition.webp", 80)
    ground_src = src / "ground.webp"
    if ground_src.exists():
        if write:
            save_webp(fit(Image.open(ground_src).convert("RGB"), GROUND_W), out / "ground.webp", 80)
    else:
        standin.append("ground")
        if write:
            wash = fit(comp, 400).filter(ImageFilter.GaussianBlur(26)).resize((GROUND_W, GROUND_W * 9 // 16), Image.BICUBIC)
            silk = Image.open(SRC / "textures" / "green-silk.webp").convert("RGB").resize(wash.size)
            save_webp(Image.blend(wash, silk, 0.18), out / "ground.webp", 80)
    pieces = []
    extracted = json.loads((SRC / "pieces.json").read_text())
    if "cut" in spec and f"{key}.pieces" not in extracted:
        standin.append("pieces")
        for i, (x0, y0, x1, y1, ckey, kind) in enumerate(spec["cut"], 1):
            im, (px0, py0, px1, py1) = cut_piece(comp, (x0, y0, x1, y1), ckey)
            cw, ch = comp.size
            pieces.append({
                "file": f"tableaux/{key}/{i:02d}.webp",
                "kind": kind,
                "home": [round((px0 + px1) / 2 / cw, 4), round((py0 + py1) / 2 / ch, 4), round((px1 - px0) / cw, 4)],
                "aspect": round(im.height / im.width, 4),
            })
            if write:
                save_webp(fit(im, PIECE_MAX), out / f"{i:02d}.webp", 84)
    else:
        rows = extracted[f"{key}.pieces"]
        assert len(rows) == len(spec["pieces"]), key
        for i, (row, (cx, cy, w, kind)) in enumerate(zip(rows, spec["pieces"]), 1):
            pw, ph = row["size"]
            pieces.append({
                "file": f"tableaux/{key}/{i:02d}.webp",
                "name": row["name"],
                "kind": kind,
                "home": [cx, cy, w],
                "aspect": round(ph / pw, 4),
            })
            if write:
                save_webp(fit(Image.open(ROOT / "game" / row["file"]).convert("RGBA"), PIECE_MAX), out / f"{i:02d}.webp", 84)
    for p in pieces:
        c = chain_of(p["kind"])
        if c:
            p["chain"] = c
    return {
        "key": key,
        "name": spec["name"],
        "wash": spec["wash"],
        "thread": spec["thread"],
        "ground": f"tableaux/{key}/ground.webp",
        "composition": f"tableaux/{key}/composition.webp",
        "standin": standin,
        "pieces": pieces,
    }


def build_chains(write: bool) -> dict:
    chains = {}
    extracted = json.loads((SRC / "pieces.json").read_text())
    for chain in CHAINS:
        path = SRC / "chains" / f"{chain}.png"
        if not path.exists():
            continue
        if f"chain.{chain}" in extracted:
            stages = []
            for n, row in enumerate(extracted[f"chain.{chain}"], 1):
                stage = Image.open(ROOT / "game" / row["file"]).convert("RGBA")
                stages.append({"file": f"chains/{chain}-{n}.webp", "aspect": round(stage.height / stage.width, 4)})
                if write:
                    save_webp(fit(stage, CHAIN_MAX), OUT / "chains" / f"{chain}-{n}.webp", 84)
            chains[chain] = stages
            continue
        im = Image.open(path).convert("RGBA")
        # Five stages evenly spaced along the row; trim each to what is drawn.
        cells = 5
        stages = []
        for n in range(1, cells + 1):
            cell = im.crop((round((n - 1) * im.width / cells), 0, round(n * im.width / cells), im.height))
            bbox = cell.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
            if not bbox:
                continue
            stage = cell.crop(bbox)
            stages.append({"file": f"chains/{chain}-{n}.webp", "aspect": round(stage.height / stage.width, 4)})
            if write:
                save_webp(fit(stage, CHAIN_MAX), OUT / "chains" / f"{chain}-{n}.webp", 84)
        chains[chain] = stages
    return chains


def build_sheet(path: Path, names: list[str], folder: str, write: bool, rows_first: bool) -> list[dict]:
    im = Image.open(path).convert("RGBA")
    boxes = components(np.array(im)[:, :, 3], 300, dilate=12)
    if rows_first:
        boxes.sort(key=lambda b: (b[0].start + b[0].stop) / 2)
    else:
        rows = sorted(boxes, key=lambda b: b[0].start)
        cell = im.height / 3
        boxes = sorted(rows, key=lambda b: (int(((b[0].start + b[0].stop) / 2) // cell), b[1].start))
    boxes = sorted(boxes, key=lambda b: -(b[0].stop - b[0].start) * (b[1].stop - b[1].start))[: len(names)]
    if rows_first:
        boxes.sort(key=lambda b: (b[0].start + b[0].stop) / 2)
    else:
        cell = im.height / 3
        boxes.sort(key=lambda b: (int(((b[0].start + b[0].stop) / 2) // cell), b[1].start))
    out = []
    for name, (ys, xs) in zip(names, boxes):
        crop = im.crop((xs.start, ys.start, xs.stop, ys.stop))
        out.append({"name": name, "file": f"{folder}/{name}.webp", "aspect": round(crop.height / crop.width, 4)})
        if write:
            save_webp(fit(crop, 640), OUT / folder / f"{name}.webp", 86)
    return out


# Life: loose leaves for the gusts, and swaps for blinks and a bird's wings.
# Until a sheet is delivered, the leaves are single leaves from the scenes and
# there are no swaps (the game breathes and tilts the faces instead).
DRIFT_STANDIN = ["tableaux/man-and-woman/07.webp", "tableaux/black-tree/03.webp", "tableaux/black-tree/04.webp"]
# sheet, columns, rows, scene, piece numbers (1-based), field
SWAPS = [
    ("blink-golden-lady.png", 1, 1, "golden-lady", [1], "blink"),
    ("blink-crowd.png", 4, 1, "crowd", [1, 4, 5, 8], "blink"),
    ("blink-black-tree.png", 2, 1, "black-tree", [5, 7], "blink"),
    ("bird-viriditas.png", 3, 1, "viriditas", [11, 11, 11], "poses"),
]


def main_shape(cell: Image.Image) -> Image.Image:
    """Keep the cell's largest shape (with the frays near it); drop slivers of neighbours."""
    alpha = np.array(cell.getchannel("A")) > 32
    labels, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=6))
    if n > 1:
        sizes = ndimage.sum(alpha, labels, range(1, n + 1))
        keep = labels == 1 + int(np.argmax(sizes))
        arr = np.array(cell)
        arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
        cell = Image.fromarray(arr)
    return cell


def align(orig: Image.Image, swap: Image.Image) -> Image.Image:
    """Fit a swap (a blink, a wing pose) onto its original piece: the scale and
    offset that best overlap their silhouettes, on a canvas the original's size,
    so the game can draw it in the original's place without a jump."""
    from scipy.signal import fftconvolve
    small = 160 / max(orig.size)
    oa = np.array(orig.getchannel("A").resize((max(1, round(orig.width * small)), max(1, round(orig.height * small))))) / 255.0
    base = orig.width / swap.width
    best = None
    for k in np.linspace(0.82, 1.22, 21):
        sw = max(1, round(swap.width * base * k * small))
        sh = max(1, round(swap.height * base * k * small))
        sa = np.array(swap.getchannel("A").resize((sw, sh))) / 255.0
        overlap = fftconvolve(oa, sa[::-1, ::-1], mode="full")
        i, j = np.unravel_index(int(np.argmax(overlap)), overlap.shape)
        dice = 2 * overlap[i, j] / (oa.sum() + sa.sum())
        if best is None or dice > best[0]:
            best = (dice, k, (j - (sw - 1)) / small, (i - (sh - 1)) / small)
    _, k, dx, dy = best
    scaled = swap.resize((max(1, round(swap.width * base * k)), max(1, round(swap.height * base * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", orig.size, (0, 0, 0, 0))
    canvas.paste(scaled, (round(dx), round(dy)), scaled)
    return canvas


def cut_grid(path: Path, cols: int, rows: int, folder: str, write: bool, fit_to: list | None = None) -> list[dict]:
    im = Image.open(path).convert("RGBA")
    out = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((round(c * im.width / cols), round(r * im.height / rows), round((c + 1) * im.width / cols), round((r + 1) * im.height / rows)))
            cell = main_shape(cell)
            bbox = cell.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
            if not bbox:
                continue
            cell = cell.crop(bbox)
            if fit_to is not None and len(out) < len(fit_to):
                cell = align(fit_to[len(out)], fit(cell, max(fit_to[len(out)].size) * 2))
            name = f"{folder}-{len(out) + 1}.webp"
            if write:
                save_webp(fit(cell, PIECE_MAX), OUT / name, 84)
            out.append({"file": name, "aspect": round(cell.height / cell.width, 4)})
    return out


def build_life(scenes: list[dict], write: bool) -> list[dict]:
    if (SRC / "anim" / "drift.png").exists():
        drift = cut_grid(SRC / "anim" / "drift.png", 6, 2, "anim/drift", write)
    else:
        drift = []
        for f in DRIFT_STANDIN:
            im = Image.open(OUT / f) if (OUT / f).exists() else None
            drift.append({"file": f, "aspect": round(im.height / im.width, 4) if im else 1.0, "standin": True})
    by_key = {s["key"]: s for s in scenes}
    for sheet, cols, rows, key, numbers, field in SWAPS:
        path = SRC / "anim" / sheet
        if not path.exists():
            continue
        # Each swap is fitted onto the web copy of the piece it replaces.
        originals = [Image.open(OUT / by_key[key]["pieces"][n - 1]["file"]).convert("RGBA") for n in numbers]
        cells = cut_grid(path, cols, rows, f"anim/{path.stem}", write, fit_to=originals)
        for n, cell in zip(numbers, cells):
            piece = by_key[key]["pieces"][n - 1]
            if field == "blink":
                piece["blink"] = cell["file"]
            else:
                piece.setdefault("poses", []).append(cell["file"])
    return drift


# The game's song, from the owner (game/assets/audio/). The web copy is a
# 128 kbps MP3 without the embedded cover art; ffmpeg makes it.
MUSIC = {
    "source": "audio/aksak-folk-dance.mp3",
    "file": "audio/aksak-folk-dance.mp3",
    "title": "Aksak Folk Dance",
    "artist": "hoai2k",
    "key": "C minor",  # measured from the recording; the plucks and chimes play in it
    "root": 60,
}


def build_music(write: bool) -> dict | None:
    src = SRC / MUSIC["source"]
    if not src.exists():
        return None
    if write:
        import subprocess
        (OUT / "audio").mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-map", "0:a", "-map_metadata", "-1",
                        "-metadata", f"title={MUSIC['title']}", "-metadata", f"artist={MUSIC['artist']}",
                        "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", str(OUT / MUSIC["file"])], check=True)
    return {k: v for k, v in MUSIC.items() if k != "source"}


def build_ui(write: bool) -> dict:
    ui = {"logo": "ui/logo.webp", "lines": []}
    if write:
        save_webp(fit(Image.open(SRC / "ui" / "logo.png").convert("RGBA"), 1400), OUT / "ui" / "logo.webp", 88)
        if (SRC / "ui" / "icon.png").exists():
            icon = Image.open(SRC / "ui" / "icon.png").convert("RGBA")
        else:
            moon = Image.open(OUT / "chains" / "moon-1.webp").convert("RGBA")
            tile = Image.open(SRC / "textures" / "indigo-batik.webp").convert("RGBA").resize((512, 512))
            mask = Image.new("L", (512, 512), 0)
            ImageDraw.Draw(mask).rounded_rectangle((8, 8, 503, 503), 96, fill=255)
            moon = fit(moon, 380)
            tile.alpha_composite(moon, ((512 - moon.width) // 2, (512 - moon.height) // 2))
            icon = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            icon.paste(tile, (0, 0), mask)
            ImageDraw.Draw(icon).rounded_rectangle((26, 26, 485, 485), 80, outline=(95, 180, 255, 255), width=5)
        (OUT / "icons").mkdir(parents=True, exist_ok=True)
        for size in (512, 192, 180, 48):
            icon.resize((size, size), Image.LANCZOS).save(OUT / "icons" / f"icon-{size}.png")
    ui["lines"] = build_sheet(SRC / "ui" / "line-drawings.png", LINE_DRAWINGS, "ui/lines", write, rows_first=False)
    # The pause menu pictures (HK-U06), once delivered: one badge per button.
    badges = SRC / "ui" / "pause-icons.png"
    if badges.exists():
        # The first badge (resume) and the last (crossed pins, for close) are
        # no longer used: clicking outside the menu resumes, and the close
        # button keeps a plain drawn X.
        names = [None, "controls", "hint", "howto", "settings", "next", "title", None]
        ui["pause"] = {}
        for name, cell in zip(names, cut_grid(badges, 4, 2, "ui/pause", write)):
            if name:
                ui["pause"][name] = cell["file"]
            elif write:
                (OUT / cell["file"]).unlink(missing_ok=True)
        # HK-U07: the title screen's fullscreen badge, beside How to play and Settings.
        full = SRC / "ui" / "fullscreen-badge.png"
        if full.exists():
            ui["pause"]["fullscreen"] = cut_grid(full, 1, 1, "ui/fullscreen", write)[0]["file"]
    controls = SRC / "ui" / "control-drawings.png"
    if controls.exists():
        names = ["stick", "trigger", "button", "shoulder", "dpad", "controller", "controllers", "moon-controller"]
        for name, cell in zip(names, cut_grid(controls, 4, 2, "ui/controls", write)):
            ui["lines"].append({"name": name, **cell})
    return ui


def main() -> int:
    write = "--check" not in sys.argv and "--data" not in sys.argv
    data_only = "--data" in sys.argv
    if write and OUT.exists():
        # macOS can remove an AppleDouble sidecar when its owning file is unlinked.
        def cleanup_error(function, path, exception):
            if isinstance(exception[1], FileNotFoundError) and Path(path).name.startswith('._'):
                return
            raise exception[1]
        shutil.rmtree(OUT, onerror=cleanup_error)
    scenes = [build_scene(k, v, write) for k, v in SCENES.items()]
    chains = build_chains(write)
    data = {
        "scenes": scenes,
        "chains": chains,
        "chainKinds": CHAINS,
        "textures": [f"textures/{t}.webp" for t in TEXTURES],
        "masks": [f"masks/{m}.webp" for m in MASKS],
        "ui": build_ui(write) if write else json.loads((OUT / "scenes.json").read_text())["ui"],
    }
    data["drift"] = build_life(scenes, write)
    data["music"] = build_music(write)
    if write:
        for t in TEXTURES:
            save_webp(Image.open(SRC / "textures" / f"{t}.webp").convert("RGB").resize((512, 512), Image.LANCZOS), OUT / "textures" / f"{t}.webp", 80)
        (OUT / "masks").mkdir(parents=True, exist_ok=True)
        for m in MASKS:
            mask = Image.open(SRC / "masks" / f"{m}.png").convert("L").resize((512, 512), Image.LANCZOS)
            mask.save(OUT / "masks" / f"{m}.webp", "WEBP", lossless=True)
    text = json.dumps(data, indent=1) + "\n"
    target = OUT / "scenes.json"
    if data_only:
        target.write_text(text)
        print("wrote fibreart/game/web/scenes.json")
        return 0
    if not write:
        if not target.exists() or target.read_text() != text:
            print("out of date: fibreart/game/web/scenes.json (rerun tools/build_web.py)")
            return 1
        return 0
    target.write_text(text)
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"wrote fibreart/game/web/ ({total / 1e6:.1f} MB, {sum(1 for _ in OUT.rglob('*.webp'))} images)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
