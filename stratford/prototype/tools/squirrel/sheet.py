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


def own(m):
    """drop pieces of the neighbouring drawings cut by the panel's left or right edge (a tail tip,
    whiskers): blobs touching those edges, other than the biggest blob"""
    from scipy import ndimage as ndi
    lab, n = ndi.label(m)
    if n < 2: return m
    sizes = ndi.sum(m, lab, range(1, n + 1)); big = int(np.argmax(sizes)) + 1
    edge = set(np.unique(np.concatenate([lab[:, :3].ravel(), lab[:, -3:].ravel()]))) - {0, big}
    return m & ~np.isin(lab, list(edge))


class Sheet:
    def __init__(self, file, body=0.25, rump_u=0.22, row=0, rows=1, y0=0.0, panels=None, side=None, top=None, shadow=True):
        # y0: the model height (m) at the side view's lowest row (0 for an animal standing on the
        # ground; the hull bottom for a swimming bird). panels: (side, top) panel columns.
        # side / top: take that view from another sheet or cell instead, as dict(file, row, rows,
        # col, cols, rot, box) (rot: degrees to turn the panel so the head points right); top=False:
        # the sheet has no usable top view (then top_px maps nothing and self.tp is None).
        self.file = file
        ps, pt = panels or (0, 1)
        def cell(d, col):
            d = dict(d or {})
            img = load(d.get('file', file))
            if d.get('box'):          # explicit pixels (x0, y0, x1, y1) where drawings overlap in columns
                x0, y0_, x1, y1 = d['box']; p = img[y0_:y1, x0:x1]
            else:
                p = panel(img, d.get('row', row), d.get('col', col), d.get('rows', rows), d.get('cols', 3))
            if d.get('rot'):
                from scipy.ndimage import rotate
                bg = np.median(np.concatenate([p[:8].reshape(-1, 3), p[-8:].reshape(-1, 3)]), axis=0)
                p = np.stack([rotate(p[..., k], d['rot'], reshape=True, order=1, cval=float(bg[k])) for k in range(3)], -1)
            return p
        self.sp = cell(side, ps)
        self.tp = None if top is False else cell(top, pt)
        self.y0 = y0
        # shadow=False: keep thin dark legs that the ground-shadow removal would take (the heron)
        self.sm = own(drop_ground_shadow(self.sp, mask(self.sp), 0.45) if shadow else mask(self.sp))
        self.tm = own(mask(self.tp)) if self.tp is not None else np.ones((4, 4), bool)
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
    def ys(self, r): return (self.ground - np.asarray(r, float)) * self.k + self.y0
    def side_px(self, z, y): return (np.asarray(z) / self.k + self.zmid, self.ground - (np.asarray(y) - self.y0) / self.k)
    def top_px(self, z, x):
        tc1 = self.T[3]
        zn = self.zs(self.nose)
        return ((np.asarray(z) - zn) / self.kt + tc1, self.taxis - np.asarray(x) / self.kt)
