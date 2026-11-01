"""Water levels, bed carving and river centre-lines.

The HRDEM DTM is hydro-flattened: inside water polygons it holds the water-surface
elevation (Lake Victoria about 350.6 m, the Avon below the Thomas Orr dam about 346.6 m).
So:  level field L = DTM on the (eroded) water pixels, extended to the nearest water pixel;
     water polygons are cut where the level steps or drifts by more than 0.3 m, each piece
     carries its own `level`; terrain.bin is carved below the surface (a bed that deepens
     away from the shore) so the water plane is visible.
"""
import math
import numpy as np
from scipy.ndimage import distance_transform_edt, binary_erosion, median_filter
from shapely.geometry import LineString, Point, box, Polygon
from shapely.ops import unary_union
from common import *


def r2(v):
    return round(float(v), 2)


def _polys(g):
    if g is None or g.is_empty:
        return []
    return [g] if isinstance(g, Polygon) else [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]


def process(G, elev, xs, zs, origin_elev, water_union):
    if G is None or water_union.is_empty:
        level = -2.0
        return {'elev': elev, 'level': level, 'pieces': lambda q: [(q, level)], 'L': None}
    from rasterio.features import rasterize
    from rasterio.transform import Affine
    dtm = G['dtm'].astype('float64')
    gx0, gz0 = G['gx0'], G['gz0']
    tf = Affine(1, 0, gx0 - 0.5, 0, 1, gz0 - 0.5)
    mask = rasterize([(p, 1) for p in _polys(water_union)], out_shape=dtm.shape, transform=tf).astype(bool)
    core = binary_erosion(mask, iterations=2)
    d, (ii, jj) = distance_transform_edt(~core, return_indices=True)
    L = dtm[ii, jj]
    dist_in = distance_transform_edt(mask)
    ni = (xs - gx0).astype(int); nj = (zs - gz0).astype(int)
    Ln = median_filter(L[np.ix_(nj, ni)], size=9, mode='nearest')   # 36 m median: drops bridge decks / spillway noise
    mn = mask[np.ix_(nj, ni)]
    dn = dist_in[np.ix_(nj, ni)]
    depth = np.clip(0.35 + 0.3 * dn, 0.35, 2.0)
    out = elev.copy()
    out[mn] = (Ln - depth)[mn]
    # lake level = median over the biggest polygon's eastern (impounded) part: the most common level
    big = max(_polys(water_union), key=lambda p: p.area)
    mb = rasterize([(big, 1)], out_shape=dtm.shape, transform=tf).astype(bool) & core
    lake = float(np.median(L[mb]))
    X = gx0 + np.arange(dtm.shape[1])

    def pieces(q):
        mq = rasterize([(q, 1)], out_shape=dtm.shape, transform=tf).astype(bool) & core
        if q.area < 3000 or mq.sum() < 500:
            m = mq if mq.any() else rasterize([(q, 1)], out_shape=dtm.shape, transform=tf).astype(bool)
            lev = float(np.median(L[m])) if m.any() else lake
            return [(q, r2(lev - origin_elev))]
        cnt = mq.sum(0)
        prof = np.full(dtm.shape[1], np.nan)
        for i in np.nonzero(cnt >= 3)[0]:
            prof[i] = np.median(L[mq[:, i], i])
        valid = np.nonzero(np.isfinite(prof))[0]
        if len(valid) == 0:
            return [(q, r2(lake - origin_elev))]
        sm = prof.copy()
        sm[valid] = median_filter(prof[valid], size=41, mode='nearest')
        cuts = [X[valid[0]]]
        ref = sm[valid[0]]
        for i in valid:
            if abs(sm[i] - ref) > 0.3 and X[i] - cuts[-1] >= 40:
                cuts.append(X[i]); ref = sm[i]
        cuts.append(X[valid[-1]] + 1)
        out_p = []
        for k in range(len(cuts) - 1):
            a = -1e9 if k == 0 else cuts[k]
            b = 1e9 if k == len(cuts) - 2 else cuts[k + 1]
            piece = q.intersection(box(a, MINZ - 50, b, MAXZ + 50))
            if piece.is_empty:
                continue
            sel = mq & (X[None, :] >= a) & (X[None, :] < b)
            lev = float(np.median(L[sel])) if sel.any() else float(np.nanmedian(sm))
            out_p.append((piece, r2(lev - origin_elev)))
        return out_p

    return {'elev': out, 'level': r2(lake - origin_elev), 'pieces': pieces, 'L': L, 'Ln': Ln, 'xs': xs, 'zs': zs, 'mask': mask, 'dtm': dtm}


def rivers(stream_lines, water_union, T):
    info = T['info']; G = T['G']; org = T['origin_elev']
    out = []
    for name, items in stream_lines.items():
        for wid, t, g in items:
            pts = list(g.coords)
            width = 12.0 if name == 'Avon River' else 2.0
            if name == 'Avon River' and not water_union.is_empty:
                line = g
                n = max(2, int(line.length // 8))
                ds = [line.interpolate(i * line.length / n) for i in range(n + 1)]
                inside = [p for p in ds if water_union.contains(p)]
                if len(inside) >= 3:
                    bd = water_union.boundary
                    width = float(np.clip(2 * np.median([bd.distance(p) for p in inside]), 6, 70))
            d = {'points': [[r2(x), r2(z)] for x, z in pts], 'width': r2(width)}
            if name:
                d['name'] = name
            if info.get('L') is not None:
                gx0, gz0 = G['gx0'], G['gz0']
                lv = []
                for x, z in pts:
                    i = int(round(x - gx0)); j = int(round(z - gz0))
                    i = min(max(i, 0), info['L'].shape[1] - 1); j = min(max(j, 0), info['L'].shape[0] - 1)
                    if info['mask'][j, i]:
                        a = min(max(int(round((x - info['xs'][0]) / CELL)), 0), len(info['xs']) - 1)
                        b = min(max(int(round((z - info['zs'][0]) / CELL)), 0), len(info['zs']) - 1)
                        lv.append(r2(info['Ln'][b, a] - org))
                    else:
                        lv.append(r2(info['dtm'][j, i] - 0.3 - org))
                d['levels'] = lv
            out.append(d)
    return out
