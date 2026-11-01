#!/usr/bin/env python3
"""Measure the scale each painted pose of a recurring character was painted
at, against its standing portrait, so the games can draw every pose of a bird
the same size. The results are kept in pose-scales.json (with notes on the
few cells checked by hand, by a rigid part such as a head or a handle); the
games' tests read that file.

    python3 icecreamcone/design/source/measure_pose_scales.py [game ...]

For each character, keypoints (SIFT, then ORB) are matched between every pair
of its cells; each pair with at least 15 RANSAC inliers gives a similarity
transform, and so a scale. The scales of all the cells are then solved
together by weighted least squares (log scale, weighted by the square root of
the inliers), with the portrait fixed at 1. A cell linked to the others by
fewer than two pairs, or whose pairs disagree (residual over 0.04), is
reported as weakly measured. The two detectors are averaged. It prints the
measurements; pose-scales.json is edited by hand from them.

Needs opencv-python (cv2, 4.5 or later) and numpy.
"""
import itertools
import sys
from pathlib import Path

import cv2
import numpy as np

GAME = Path(__file__).resolve().parents[2] / "game"
SPR, SUB, BIRD = "assets/sprites/", "assets/subjects/", "assets/birds/"

# Each character: its portrait first, then its pose sheets as file:cols:rows.
FAMILIES = {
    "milkmidge": [SUB + "milkmidge.png", SPR + "midge-throw.png:2:1", SPR + "midge-moods.png:2:1"],
    "waterglassgoose": [SUB + "waterglassgoose.png", SPR + "goose-tap.png:2:1", SPR + "goose-moves.png:2:1"],
    "niffy": [SUB + "niffy.png", SPR + "niffy-dive.png:2:1", SPR + "niffy-fly.png:3:1"],
    "broomwhisk": [SUB + "broomwhisk.png", SPR + "broomwhisk-sweep.png:2:1", SPR + "broomwhisk-poses.png:3:1"],
    "buttonbeaks": [SUB + "buttonbeaks.png", SPR + "buttonbeaks-toss.png:2:1", SPR + "buttonbeaks-poses.png:4:1"],
    "snippit": [SUB + "snippit.png", SPR + "snippit-snip.png:2:1", SPR + "snippit-poses.png:3:1"],
    "plugsocketswift": [SUB + "plugsocketswift.png", SPR + "swift-poses.png:3:1"],
    "saltshakershrike": [SUB + "saltshakershrike.png", SPR + "shrike-poses.png:4:1"],
    "ladlelark": [SUB + "ladlelark.png", SPR + "lark-poses.png:3:1"],
    "drippet": [SUB + "drippet.png", SPR + "drippet-poses.png:2:1", SPR + "drippet-more.png:2:1"],
    "sawbird": [SUB + "sawbird.png", SPR + "sawbird-sawing.png", SPR + "sawbird-poses.png:2:1"],
    "radiobird": [SUB + "radiobird.png", SPR + "radiobird-poses.png:3:1"],
    "titthrush": [SUB + "titthrush.png", SPR + "titthrush-sing.png", SPR + "titthrush-fluster.png", SPR + "titthrush-hop.png:2:1"],
    "coot": [BIRD + "coot.png", SPR + "coot-poses.png:2:1"],
    "gullfinch": [BIRD + "gullfinch.png", SPR + "gullfinch-sing.png"],
    "cupadee": [BIRD + "cupadee.png", SPR + "cupadee-open.png"],
    "crow": [SPR + "chicks.png:3:2"],
}
MIN_INLIERS = 15


def cells(spec):
    parts = spec.split(":")
    cols = int(parts[1]) if len(parts) > 1 else 1
    rows = int(parts[2]) if len(parts) > 2 else 1
    im = cv2.imread(str(GAME / parts[0]), cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 3:
        im = cv2.cvtColor(im, cv2.COLOR_BGR2BGRA)
    h, w = im.shape[:2]
    cw, ch = w // cols, h // rows
    for i in range(cols * rows):
        c = im[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw]
        a = c[:, :, 3:4].astype(float) / 255
        grey = cv2.cvtColor((c[:, :, :3] * a + 235 * (1 - a)).astype(np.uint8), cv2.COLOR_BGR2GRAY)
        yield f"{Path(parts[0]).name}#{i}", grey, (c[:, :, 3] > 128).astype(np.uint8) * 255


def detector(kind):
    if kind == "sift":
        return cv2.SIFT_create(nfeatures=4000), cv2.NORM_L2
    return cv2.ORB_create(nfeatures=6000, scaleFactor=1.08, nlevels=20, edgeThreshold=15, patchSize=31), cv2.NORM_HAMMING


def pair_scale(det, norm, a, b):
    """Scale of b against a (trying b mirrored too), and the inliers."""
    k1, d1 = a
    best = None
    for flip in (False, True):
        grey, mask = b
        if flip:
            grey, mask = grey[:, ::-1].copy(), mask[:, ::-1].copy()
        k2, d2 = det.detectAndCompute(grey, mask)
        if d1 is None or d2 is None or len(k2) < 8:
            continue
        good = [m for m, n in (p for p in cv2.BFMatcher(norm).knnMatch(d1, d2, k=2) if len(p) == 2) if m.distance < 0.75 * n.distance]
        if len(good) < 8:
            continue
        src = np.float32([k1[m.queryIdx].pt for m in good])
        dst = np.float32([k2[m.trainIdx].pt for m in good])
        M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=6, maxIters=5000, confidence=0.999)
        if M is None:
            continue
        s, n = float(np.hypot(M[0, 0], M[1, 0])), int(inl.sum())
        if s > 0.3 and (best is None or n > best[1]):
            best = (s, n)
    return best


def solve(nodes, kind):
    det, norm = detector(kind)
    keys = [det.detectAndCompute(g, m) for _, g, m in nodes]
    n = len(nodes)
    edges = []
    for i, j in itertools.combinations(range(n), 2):
        r = pair_scale(det, norm, keys[i], nodes[j][1:])
        if r and r[1] >= MIN_INLIERS:
            edges.append((i, j, np.log(r[0]), r[1]))
    rows, rhs, wts = [], [], []
    for i, j, ls, inl in edges:
        r = np.zeros(n)
        r[j], r[i] = 1, -1
        rows.append(r)
        rhs.append(ls)
        wts.append(np.sqrt(inl))
    r = np.zeros(n)
    r[0] = 1
    rows.append(r)
    rhs.append(0)
    wts.append(1000)
    A = np.array(rows) * np.array(wts)[:, None]
    x = np.linalg.lstsq(A, np.array(rhs) * np.array(wts), rcond=None)[0]
    out = {}
    for k in range(n):
        es = [(e, (x[e[1]] - x[e[0]]) - e[2]) for e in edges if k in e[:2]]
        resid = float(np.sqrt(np.average([d * d for _, d in es], weights=[e[3] for e, _ in es]))) if es else float("nan")
        out[nodes[k][0]] = (float(np.exp(x[k])), len(es), resid)
    return out


def main():
    for name in sys.argv[1:] or FAMILIES:
        nodes = [c for spec in FAMILIES[name] for c in cells(spec)]
        res = {kind: solve(nodes, kind) for kind in ("sift", "orb")}
        print(name)
        for cell_name, *_ in nodes:
            got = [res[k][cell_name] for k in res]
            ok = [s for s, links, resid in got if links >= 1]
            mean = sum(ok) / len(ok) if ok else float("nan")
            notes = "  ".join(f"{k} {s:.3f} ({links} links, resid {resid:.3f})" for k, (s, links, resid) in zip(res, got))
            weak = any(links < 2 or not resid < 0.04 for _, links, resid in got)
            print(f"  {cell_name:28s} {mean:.3f}   {notes}{'   weak' if weak else ''}")


if __name__ == "__main__":
    main()
