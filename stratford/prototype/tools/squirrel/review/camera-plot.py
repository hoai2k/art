"""python3 camera-plot.py <before.json> <after.json> <out.png>: camera traces (from
camera-trace.mjs) before and after, per scenario at 60 fps: camera acceleration (frame-to-frame
jerk, log scale) and camera-to-squirrel distance over time."""
import json, sys, math
from PIL import Image, ImageDraw, ImageFont

B, A = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
names = [n for n in A['traces'] if n in B['traces']]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except OSError: F = FB = ImageFont.load_default()
W, RH, PW = 1400, 170, 640
img = Image.new('RGB', (W, 60 + RH * len(names)), 'white'); d = ImageDraw.Draw(img)
d.text((10, 10), 'Follow camera before (red) and after (blue), 60 fps. Left: camera acceleration |d2p/dt2| (log, m/s^2). Right: camera-to-squirrel distance (m).', fill='black', font=FB)
d.text((10, 32), 'Dashed line: the 150 m/s^2 bound in test/squirrel.test.mjs.', fill=(90, 90, 90), font=F)

def series(fr, fps):
    dt = 1 / fps; acc = [0, 0]
    for i in range(2, len(fr)):
        acc.append(math.sqrt(sum((fr[i][k] - 2 * fr[i - 1][k] + fr[i - 2][k]) ** 2 for k in (1, 2, 3))) / dt / dt)
    return [f[0] for f in fr], acc, [f[6] for f in fr]

for r, n in enumerate(names):
    y0 = 60 + r * RH
    d.text((10, y0 + 4), n, fill='black', font=FB)
    for col, (key, logy) in enumerate((('acc', True), ('dist', False))):
        x0 = 120 + col * (PW + 20); top, h = y0 + 8, RH - 30
        d.rectangle([x0, top, x0 + PW, top + h], outline=(180, 180, 180))
        runs = [(B, (220, 60, 50)), (A, (40, 90, 220))]
        tmax = max(max(f[0] for f in X['traces'][n]['60']) for X, _ in runs)
        if logy: lo, hi = 0, 4.5                              # 1 .. 30000 m/s^2
        else:
            vals = [f[6] for X, _ in runs for f in X['traces'][n]['60']]; lo, hi = 0, max(vals) * 1.1
        def Y(v): return top + h - (min(max(v, lo), hi) - lo) / (hi - lo) * h
        if logy:
            for e in range(0, 5):
                yy = Y(e); d.line([x0, yy, x0 + PW, yy], fill=(235, 235, 235)); d.text((x0 - 40, yy - 7), f'1e{e}', fill=(120, 120, 120), font=F)
            yy = Y(math.log10(150))
            for xx in range(x0, x0 + PW, 8): d.line([xx, yy, xx + 4, yy], fill=(60, 60, 60))
        else:
            d.text((x0 - 40, top - 2), f'{hi:.1f}', fill=(120, 120, 120), font=F); d.text((x0 - 40, top + h - 12), '0', fill=(120, 120, 120), font=F)
        for X, colr in runs:
            t, acc, dist = series(X['traces'][n]['60'], 60)
            v = [math.log10(max(a, 1)) for a in acc] if logy else dist
            pts = [(x0 + tt / tmax * PW, Y(vv)) for tt, vv in zip(t, v)]
            d.line(pts, fill=colr, width=2)
        if logy:
            sb, sa = B['summary'][n]['60'], A['summary'][n]['60']
            d.text((x0 + 6, top + 4), f"max {sb['camAccMax']:.0f} -> {sa['camAccMax']:.0f}", fill='black', font=F)
img.save(sys.argv[3]); print('wrote', sys.argv[3])
