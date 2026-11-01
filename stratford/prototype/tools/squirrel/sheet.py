"""A reference sheet as a measuring tape: the side view (facing right) and top view (head right)
of one row of a 1920 x 1080 turnaround sheet, scaled to metres.

    sh = Sheet('provisional/wobblers_squirrel.png', body=0.25)
    sh.side_px(z, y) / sh.top_px(z, x)      metres -> panel pixels
    sh.zs(col), sh.ys(row), sh.xt(row)      panel pixels -> metres

Model frame (as the game): +z forward (the nose), y up, x to the animal's left; origin on the
ground under the middle of the body. `body` is the head-and-body length (nose tip to rump) the
sheet's side view is scaled to; `nose` / `rump` are the side view's columns for those points
(found from the silhouette: the nose is its right-most column, the rump is given as a fraction
of the box because the tail hides it).
"""
import numpy as np
from segment import load, panel, mask, drop_ground_shadow


class Sheet:
    def __init__(self, file, body=0.25, rump_u=0.22, row=0, rows=1):
        img = load(file)
        self.file = file
        self.sp, self.tp = panel(img, row, 0, rows), panel(img, row, 1, rows)
        self.sm = drop_ground_shadow(self.sp, mask(self.sp), 0.45)
        self.tm = mask(self.tp)
        r, c = np.where(self.sm); self.S = (r.min(), r.max(), c.min(), c.max())   # r0, r1, c0, c1
        r, c = np.where(self.tm); self.T = (r.min(), r.max(), c.min(), c.max())
        r0, r1, c0, c1 = self.S
        self.nose = c1; self.rump = c0 + rump_u * (c1 - c0)
        self.k = body / (self.nose - self.rump)            # metres per side pixel
        self.zmid = (self.nose + self.rump) / 2           # column of z = 0
        self.ground = r1
        # the top view: same scale along z, fitted so its nose column matches
        tr0, tr1, tc0, tc1 = self.T
        self.kt = self.k * (c1 - c0) / max(1, tc1 - tc0)
        self.taxis = np.median(np.where(self.tm[:, tc1 - int(0.25 * (tc1 - tc0)):tc1 - int(0.05 * (tc1 - tc0))])[0])

    # metres <-> pixels
    def zs(self, c): return (np.asarray(c, float) - self.zmid) * self.k
    def ys(self, r): return (self.ground - np.asarray(r, float)) * self.k
    def side_px(self, z, y): return (np.asarray(z) / self.k + self.zmid, self.ground - np.asarray(y) / self.k)
    def top_px(self, z, x):
        tc1 = self.T[3]
        zn = self.zs(self.nose)
        return ((np.asarray(z) - zn) / self.kt + tc1, self.taxis - np.asarray(x) / self.kt)
