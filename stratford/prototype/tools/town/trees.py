"""Tree positions.

With LiDAR: local maxima of the canopy height model (DSM - DTM, Gaussian-smoothed) outside
building footprints and water, thin poles rejected, merged with OSM natural=tree nodes
(species tags win; unmatched OSM trees are added).  Without LiDAR: OSM tree nodes plus
points along natural=tree_row ways.  `kind` is a guess from species tags, crown shape and
setting (willows by the water, maples on streets, a mix in parks).
"""
import math, hashlib
import numpy as np
from scipy.ndimage import gaussian_filter, maximum_filter, binary_dilation, distance_transform_edt
from scipy.spatial import cKDTree
from shapely import contains_xy
from shapely.geometry import LineString, Point, Polygon, MultiPolygon
from shapely.ops import unary_union
from common import *

TABLES = {
    'water': [('willow', 55), ('maple', 20), ('oak', 10), ('other', 15)],
    'street': [('maple', 60), ('linden', 12), ('oak', 10), ('other', 18)],
    'park': [('maple', 30), ('oak', 25), ('linden', 10), ('spruce', 10), ('other', 25)],
    'yard': [('maple', 40), ('oak', 15), ('other', 30), ('spruce', 15)],
}


def stable(x, z, salt=''):
    return int(hashlib.md5(f'{x:.1f},{z:.1f}{salt}'.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def choose(table, u):
    tot = sum(w for _, w in table); v = u * tot
    for k, w in table:
        v -= w
        if v < 0:
            return k
    return table[-1][0]


def species_kind(t):
    s = ' '.join((t.get('species') or '', t.get('genus') or '', t.get('taxon') or '', t.get('species:en') or '')).lower()
    if 'salix' in s or 'willow' in s: return 'willow'
    if 'acer' in s or 'maple' in s: return 'maple'
    if 'quercus' in s or 'oak' in s: return 'oak'
    if 'tilia' in s or 'linden' in s: return 'linden'
    if any(k in s for k in ('picea', 'pinus', 'abies', 'thuja', 'spruce', 'pine', 'fir', 'cedar', 'juniper')): return 'spruce'
    if t.get('leaf_type') == 'needleleaved': return 'spruce'
    return None


def build(osm, G, T, buildings, blds, water_union, roads, areas, geoms):
    osm_trees = [(xz, t) for xz, t in osm.nodes.values()
                 if t.get('natural') == 'tree' and MINX <= xz[0] <= MAXX and MINZ <= xz[1] <= MAXZ]
    bpolys = [b['poly'] for b in blds]
    bunion = unary_union(bpolys)
    street_lines = [LineString(r['points']) for r in roads if r['kind'] in ('primary', 'secondary', 'tertiary', 'residential') and not r.get('bridge')]
    street_zone = unary_union(street_lines).buffer(12)
    park_zone = unary_union([Polygon(a['outer']) for a in areas if a['kind'] in ('park', 'garden', 'cemetery', 'wood', 'grass') and Polygon(a['outer']).area > 1500])
    water_zone = water_union.buffer(18) if not water_union.is_empty else Polygon()

    def setting(x, z):
        if contains_xy(water_zone, x, z): return 'water'
        if contains_xy(park_zone, x, z): return 'park'
        if contains_xy(street_zone, x, z): return 'street'
        return 'yard'

    trees = []  # dict(x,z,h,c,kind)
    if G is not None:
        from rasterio.features import rasterize
        from rasterio.transform import Affine
        gx0, gz0 = G['gx0'], G['gz0']
        chm = np.clip(G['dsm'] - G['dtm'], 0, 60).astype('float32')
        tf = Affine(1, 0, gx0 - 0.5, 0, 1, gz0 - 0.5)
        bm = rasterize([(p.buffer(0.5), 1) for p in bpolys], out_shape=chm.shape, transform=tf).astype(bool)
        bm = binary_dilation(bm, iterations=1)
        wm = T['info']['mask']
        sm = gaussian_filter(chm, 1.4)
        mx = maximum_filter(sm, size=9)
        pk = (sm == mx) & (sm > 3.0) & ~bm & ~wm
        js, is_ = np.nonzero(pk)
        log_n = len(js)
        for j, i in zip(js, is_):
            if j < 6 or i < 6 or j >= chm.shape[0] - 6 or i >= chm.shape[1] - 6:
                continue
            x, z = gx0 + i, gz0 + j
            if not (MINX <= x <= MAXX and MINZ <= z <= MAXZ):
                continue
            win = chm[j - 5:j + 6, i - 5:i + 6]
            h = float(chm[j - 1:j + 2, i - 1:i + 2].max())
            if h > 40 or h < 3.5:
                continue
            cnt = int((win > 0.5 * h).sum())
            if cnt < 12:      # poles, antennas, wires
                continue
            # skip structures (rooftop plant, scaffolding): inside the building zone already masked
            crown = 2 * math.sqrt(cnt / math.pi)
            crown = float(min(max(crown, 2.5), min(14.0, 0.95 * h + 1.5)))
            trees.append({'x': float(x), 'z': float(z), 'h': h, 'c': crown, 'kind': None, 'src': 'lidar'})
        print('  canopy maxima', log_n, '-> trees', len(trees))
        # merge OSM trees
        if trees:
            kd = cKDTree([[t['x'], t['z']] for t in trees])
        for xz, t in osm_trees:
            if contains_xy(bunion, xz[0], xz[1]):
                continue
            k = species_kind(t)
            hh = num(t.get('height'))
            cc = num(t.get('diameter_crown'))
            if trees:
                d, idx = kd.query(xz)
                if d < 4.5:
                    tr = trees[idx]
                    if k: tr['kind'] = k
                    if hh: tr['h'] = hh
                    if cc: tr['c'] = cc
                    continue
            # unmatched: height from CHM where possible
            i = int(round(xz[0] - gx0)); j = int(round(xz[1] - gz0))
            hch = float(chm[max(j - 1, 0):j + 2, max(i - 1, 0):i + 2].max()) if 0 <= i < chm.shape[1] and 0 <= j < chm.shape[0] else 0
            h = hh or (hch if hch > 3 else 7.0)
            trees.append({'x': xz[0], 'z': xz[1], 'h': h, 'c': cc or min(0.55 * h + 1, 9), 'kind': k, 'src': 'osm'})
    else:
        for xz, t in osm_trees:
            if contains_xy(bunion, xz[0], xz[1]):
                continue
            h = num(t.get('height')) or 8.0
            trees.append({'x': xz[0], 'z': xz[1], 'h': h, 'c': num(t.get('diameter_crown')) or min(0.55 * h + 1, 9), 'kind': species_kind(t), 'src': 'osm'})
        for wid, (refs, t) in osm.ways.items():
            if t.get('natural') == 'tree_row':
                c = osm.coords(wid)
                if len(c) < 2: continue
                ln = LineString(c)
                n = max(1, int(ln.length // 9))
                for k in range(n + 1):
                    p = ln.interpolate(k * ln.length / n)
                    if MINX <= p.x <= MAXX and MINZ <= p.y <= MAXZ and not contains_xy(bunion, p.x, p.y):
                        trees.append({'x': p.x, 'z': p.y, 'h': 9.0 + 3 * stable(p.x, p.y), 'c': 5.5, 'kind': None, 'src': 'row'})
    out = []
    for t in trees:
        if t['kind'] is None:
            s = setting(t['x'], t['z'])
            u = stable(t['x'], t['z'])
            if t['h'] >= 7 and t['c'] / t['h'] < 0.38:
                t['kind'] = 'spruce'
            else:
                k = choose(TABLES[s], u)
                if k == 'spruce' and (t['c'] / t['h'] > 0.7):
                    k = 'maple'
                t['kind'] = k
        out.append({'x': round(t['x'], 2), 'z': round(t['z'], 2), 'height': round(t['h'], 1), 'crown': round(t['c'], 1), 'kind': t['kind']})
    return out


def num(s):
    try:
        return float(str(s).split()[0])
    except Exception:
        return None
