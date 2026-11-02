#!/usr/bin/env python3
"""Stratford town data pipeline: OSM (+ HRDEM LiDAR) -> game/data/town.json + terrain.bin.

    python3 build_town.py            # fetch what is missing, build (LiDAR if cached)
    python3 build_town.py --no-lidar # OSM only, flat terrain, estimated heights (v1)
    python3 build_town.py --offline  # never touch the network (default when caches exist)

See README.md in this folder.
"""
import os, sys, json, math, glob, time, hashlib, argparse, subprocess
import xml.etree.ElementTree as ET
import numpy as np
from shapely import contains_xy
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, box
from shapely.ops import unary_union, polygonize, linemerge, nearest_points
from shapely.strtree import STRtree
from shapely.validation import make_valid
from shapely import prepared
from common import *
import lidar as lidarmod
from landmarks import LANDMARKS

UA = 'stratford-squirrel-prototype/0.1 (hoai2k@gmail.com)'
TILES = {  # name: bbox minlon,minlat,maxlon,maxlat  (each under the API's 50,000-node limit)
    'core': (-80.9930, 43.3640, -80.9640, 43.3780),
    'west': (-80.9950, 43.3620, -80.9930, 43.3790),
    'east': (-80.9640, 43.3620, -80.9580, 43.3790),
    'south': (-80.9930, 43.3620, -80.9640, 43.3640),
    'north': (-80.9930, 43.3780, -80.9640, 43.3790),
}
BOUNDS_BOX = box(MINX, MINZ, MAXX, MAXZ)


def log(*a):
    print(f'[{time.strftime("%H:%M:%S")}]', *a, flush=True)


# ---------------------------------------------------------------- OSM fetch / parse
def fetch_osm(offline):
    os.makedirs(OSM_DIR, exist_ok=True)
    import urllib.request, ssl
    ctx = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt') if os.path.exists('/root/.ccr/ca-bundle.crt') else ssl.create_default_context()
    for name, bb in TILES.items():
        f = os.path.join(OSM_DIR, name + '.osm')
        if os.path.exists(f) and os.path.getsize(f) > 1000:
            continue
        if offline:
            raise SystemExit(f'missing cache {f} (offline)')
        url = 'https://api.openstreetmap.org/api/0.6/map?bbox=' + ','.join(map(str, bb))
        log('fetching', url)
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, context=ctx, timeout=180) as r, open(f + '.tmp', 'wb') as o:
            o.write(r.read())
        os.replace(f + '.tmp', f)
        time.sleep(2)


def parse_osm():
    nodes, ways, rels = {}, {}, {}
    for f in sorted(glob.glob(os.path.join(OSM_DIR, '*.osm'))):
        for e in ET.parse(f).getroot():
            if e.tag == 'node':
                tags = {t.get('k'): t.get('v') for t in e.findall('tag')}
                nodes[e.get('id')] = (proj(float(e.get('lat')), float(e.get('lon'))), tags)
            elif e.tag == 'way':
                ways[e.get('id')] = ([n.get('ref') for n in e.findall('nd')], {t.get('k'): t.get('v') for t in e.findall('tag')})
            elif e.tag == 'relation':
                rels[e.get('id')] = ([(m.get('type'), m.get('ref'), m.get('role')) for m in e.findall('member')],
                                     {t.get('k'): t.get('v') for t in e.findall('tag')})
    return nodes, ways, rels


class OSM:
    def __init__(self, offline):
        fetch_osm(offline)
        self.nodes, self.ways, self.rels = parse_osm()
        log('osm', len(self.nodes), 'nodes', len(self.ways), 'ways', len(self.rels), 'relations')

    def coords(self, wid):
        return [self.nodes[n][0] for n in self.ways[wid][0] if n in self.nodes]

    def poly(self, wid):
        c = self.coords(wid)
        if len(c) < 4 or c[0] != c[-1]:
            return None
        return fix(Polygon(c))

    def mp(self, rid):
        mem, _ = self.rels[rid]
        outer = [LineString(self.coords(r)) for t, r, role in mem if t == 'way' and r in self.ways and role in ('outer', '') and len(self.coords(r)) > 1]
        inner = [LineString(self.coords(r)) for t, r, role in mem if t == 'way' and r in self.ways and role == 'inner' and len(self.coords(r)) > 1]
        if not outer:
            return None
        ops = list(polygonize(unary_union(outer)))
        ips = list(polygonize(unary_union(inner))) if inner else []
        out = []
        for op in ops:
            holes = [ip for ip in ips if op.contains(ip.representative_point())]
            g = op.difference(unary_union(holes)) if holes else op
            out.append(g)
        if not out:
            return None
        return fix(unary_union(out))


def fix(g):
    if g is None or g.is_empty:
        return None
    if not g.is_valid:
        g = make_valid(g)
    polys = [p for p in (g.geoms if hasattr(g, 'geoms') else [g]) if isinstance(p, Polygon) and p.area > 0]
    if not polys:
        return None
    return polys[0] if len(polys) == 1 else MultiPolygon(polys)


def polys_of(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]


def r2(v):
    return round(float(v), 2)


def ring_out(coords, ccw):
    """Open ring, rounded; orientation as seen from above (x east, -z north)."""
    pts = [(r2(x), r2(z)) for x, z in coords]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    a = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    # shoelace in (x,z) is negative for CCW seen from above (z points south)
    if (a < 0) != ccw:
        pts.reverse()
    return [list(p) for p in pts]


def poly_out(p, tol=0.05):
    p = p.simplify(tol, preserve_topology=True) if tol else p
    if not isinstance(p, Polygon) or p.is_empty or p.area < 0.5:
        return None
    outer = ring_out(list(p.exterior.coords), True)
    if len(outer) < 3:
        return None
    d = {'outer': outer}
    holes = [ring_out(list(h.coords), False) for h in p.interiors if Polygon(h).area > 1.0]
    holes = [h for h in holes if len(h) >= 3]
    if holes:
        d['holes'] = holes
    return d


def stable(key, n=1000):
    return int(hashlib.md5(key.encode()).hexdigest()[:8], 16) % n / n


def pick(key, table):
    """Deterministic weighted choice."""
    v = stable(key) * sum(w for _, w in table)
    for k, w in table:
        v -= w
        if v < 0:
            return k
    return table[-1][0]


# ---------------------------------------------------------------- roads
ROAD_KIND = {'motorway': 'primary', 'trunk': 'primary', 'primary': 'primary', 'primary_link': 'primary',
             'secondary': 'secondary', 'secondary_link': 'secondary', 'tertiary': 'tertiary', 'tertiary_link': 'tertiary',
             'residential': 'residential', 'unclassified': 'residential', 'living_street': 'residential',
             'service': 'service', 'pedestrian': 'footway', 'footway': 'footway', 'path': 'path', 'track': 'path',
             'bridleway': 'path', 'cycleway': 'cycleway', 'steps': 'steps'}
ROAD_W = {'primary': 12.0, 'secondary': 10.0, 'tertiary': 9.0, 'residential': 7.5, 'service': 4.5,
          'footway': 2.0, 'path': 1.6, 'cycleway': 2.6, 'steps': 2.2}


def parse_width(s):
    try:
        return float(str(s).split()[0].replace('m', '').replace(',', '.'))
    except Exception:
        return None


def build_roads(osm):
    roads, lines = [], []
    for wid, (refs, t) in osm.ways.items():
        hw = t.get('highway')
        if hw not in ROAD_KIND or t.get('area') == 'yes':
            continue
        if t.get('tunnel') in ('yes', 'culvert', 'building_passage') and ROAD_KIND[hw] in ('footway', 'path'):
            continue
        c = osm.coords(wid)
        if len(c) < 2:
            continue
        kind = ROAD_KIND[hw]
        w = parse_width(t.get('width')) or ROAD_W[kind]
        if kind in ('primary', 'secondary', 'tertiary', 'residential'):
            try:
                lanes = int(t.get('lanes', 2))
            except ValueError:
                lanes = 2
            if not t.get('width'):
                w = max(w, lanes * 3.4 + (1.0 if lanes <= 2 else 0))
        if hw == 'pedestrian':
            w = parse_width(t.get('width')) or 5.0
        g = LineString(c).intersection(BOUNDS_BOX)
        for part in (g.geoms if hasattr(g, 'geoms') else [g]):
            if part.is_empty or part.geom_type != 'LineString' or part.length < 1.0:
                continue
            part = part.simplify(0.1)
            r = {'id': 'w' + wid, 'kind': kind, 'width': r2(w), 'points': [[r2(x), r2(z)] for x, z in part.coords]}
            if t.get('name'):
                r['name'] = t['name']
            if t.get('bridge') in ('yes', 'viaduct'):
                r['bridge'] = True
            if t.get('tunnel') in ('yes', 'culvert'):
                r['tunnel'] = True
            roads.append(r)
    return roads


# ---------------------------------------------------------------- areas / water
def area_kind(t):
    l, lu, n, am = t.get('leisure'), t.get('landuse'), t.get('natural'), t.get('amenity')
    if l in ('park', 'recreation_ground', 'nature_reserve', 'playground', 'common') or lu == 'recreation_ground':
        return 'park'
    if l == 'garden' or lu == 'flowerbed' or lu == 'allotments':
        return 'garden'
    if l == 'golf_course' or lu in ('grass', 'meadow', 'greenfield', 'village_green') or n in ('grassland', 'scrub'):
        return 'grass'
    if am == 'parking':
        return 'parking'
    if n == 'wood' or lu == 'forest':
        return 'wood'
    if l in ('pitch', 'track', 'sports_centre', 'stadium'):
        return 'pitch'
    if t.get('place') == 'square' or (t.get('highway') == 'pedestrian' and t.get('area') == 'yes') or lu == 'plaza':
        return 'plaza'
    if lu == 'cemetery' or am == 'grave_yard':
        return 'cemetery'
    if lu == 'railway':
        return 'railway'
    return None


def is_water(t):
    if t.get('leisure') == 'swimming_pool' or t.get('covered') == 'yes' or t.get('water') in ('reservoir',) and t.get('covered'):
        return False
    return t.get('natural') == 'water' or t.get('waterway') == 'riverbank' or t.get('landuse') == 'reservoir'


def feature_geoms(osm):
    """Yield (id, tags, shapely polygon) for every closed way and multipolygon relation."""
    inrel = set()
    for rid, (mem, t) in osm.rels.items():
        if t.get('type') == 'multipolygon':
            g = osm.mp(rid)
            for ty, ref, role in mem:
                if ty == 'way':
                    inrel.add(ref)
            if g is not None:
                yield 'r' + rid, t, g
    for wid, (refs, t) in osm.ways.items():
        if not t:
            continue
        p = osm.poly(wid)
        if p is not None:
            yield 'w' + wid, t, p
        elif wid in inrel:
            continue


# ---------------------------------------------------------------- buildings
BTYPE = {
    'house': 'residential', 'detached': 'residential', 'semidetached_house': 'residential', 'terrace': 'residential',
    'residential': 'residential', 'apartments': 'residential', 'dormitory': 'residential', 'bungalow': 'residential',
    'retail': 'commercial', 'commercial': 'commercial', 'office': 'commercial', 'hotel': 'commercial', 'supermarket': 'commercial',
    'industrial': 'industrial', 'warehouse': 'industrial', 'factory': 'industrial', 'service': 'industrial',
    'church': 'church', 'chapel': 'church', 'cathedral': 'church', 'synagogue': 'church', 'mosque': 'church',
    'public': 'civic', 'civic': 'civic', 'government': 'civic', 'school': 'civic', 'university': 'civic', 'hospital': 'civic',
    'college': 'civic', 'train_station': 'civic', 'fire_station': 'civic', 'kindergarten': 'civic', 'military': 'civic',
    'garage': 'garage', 'garages': 'garage', 'carport': 'garage', 'parking': 'garage',
    'shed': 'shed', 'hut': 'shed', 'cabin': 'shed', 'roof': 'shed', 'barn': 'shed', 'greenhouse': 'shed', 'outbuilding': 'shed',
}
SKIP_B = {'demolished', 'no', 'collapsed', 'proposed', 'construction'}


def num(s):
    try:
        return float(str(s).replace('m', '').strip().split()[0])
    except Exception:
        return None


def short_side(g):
    r = g.minimum_rotated_rectangle
    c = list(r.exterior.coords)
    a = math.dist(c[0], c[1]); b = math.dist(c[1], c[2])
    return min(a, b), max(a, b)


def estimate(use, area, short, core, key, tags):
    """Heights without LiDAR: (levels, eaves, roofHeight, roof)."""
    lv_tag = num(tags.get('building:levels'))
    sh = 3.5 if use in ('commercial', 'civic', 'theatre') else 3.0
    if use == 'commercial':
        lv = lv_tag or (pick(key + 'l', [(2, 5), (3, 4), (1, 1)]) if core else pick(key + 'l', [(1, 5), (2, 5)]))
        roof = 'flat'
    elif use == 'residential':
        lv = lv_tag or (3 if tags.get('building') == 'apartments' and area > 150 else (pick(key + 'l', [(2, 6), (1.5, 4)])))
        roof = 'flat' if tags.get('building') == 'apartments' and area > 400 else pick(key + 'r', [('gabled', 7), ('hipped', 3)])
    elif use == 'church':
        lv = lv_tag or 2.5; sh = 3.6; roof = 'gabled'
    elif use == 'civic':
        lv = lv_tag or (3 if area > 300 else 2); roof = pick(key + 'r', [('flat', 5), ('hipped', 5)])
    elif use == 'theatre':
        lv = lv_tag or 3; sh = 4.0; roof = 'flat'
    elif use == 'industrial':
        lv = lv_tag or 1.5; sh = 4.0; roof = 'flat' if area > 600 else 'gabled'
    elif use == 'garage':
        lv = 1; sh = 2.8; roof = 'gabled' if area > 20 else 'flat'
    elif use == 'shed':
        lv = 1; sh = 2.6; roof = 'flat' if area < 14 else 'gabled'
    else:
        lv = lv_tag or 1; roof = 'flat'
    eaves = num(tags.get('height')) or lv * sh
    if roof == 'flat':
        rh = 0.0
    elif use == 'church':
        rh = min(max(0.55 * short, 3.0), 8.0)
    else:
        rh = min(max(0.34 * short, 1.2), 4.5)
    if tags.get('height') and roof != 'flat' and num(tags.get('roof:height')):
        rh = num(tags['roof:height'])
    return lv, eaves, rh, roof


def guess_material(use, key, tags):
    m = tags.get('building:material')
    c = (tags.get('building:colour') or '').lower()
    if m in ('brick',):
        return 'brick_buff' if c in ('yellow', 'beige', 'buff', 'tan', 'cream') else 'brick_red'
    if m in ('stone', 'concrete', 'sandstone', 'limestone'):
        return 'stone'
    if m in ('wood',):
        return 'clapboard'
    if m in ('glass',):
        return 'glass'
    if m in ('metal', 'steel'):
        return 'metal'
    if use == 'commercial':
        return pick(key + 'm', [('brick_red', 55), ('brick_buff', 33), ('stone', 5), ('stucco', 3), ('glass', 4)])
    if use == 'church':
        return pick(key + 'm', [('stone', 50), ('brick_red', 30), ('brick_buff', 20)])
    if use == 'civic':
        return pick(key + 'm', [('brick_red', 45), ('brick_buff', 30), ('stone', 25)])
    if use == 'theatre':
        return pick(key + 'm', [('brick_red', 40), ('stone', 40), ('brick_buff', 20)])
    if use == 'industrial':
        return pick(key + 'm', [('metal', 50), ('brick_red', 30), ('brick_buff', 10), ('stucco', 10)])
    if use == 'garage':
        return pick(key + 'm', [('clapboard', 40), ('metal', 25), ('brick_red', 20), ('stucco', 15)])
    if use == 'shed':
        return pick(key + 'm', [('clapboard', 55), ('metal', 30), ('brick_red', 15)])
    return pick(key + 'm', [('brick_red', 40), ('brick_buff', 25), ('clapboard', 28), ('stucco', 7)])


LM_WAYS = set()


def build_buildings(osm, geoms, lidar, G):
    # POIs and landuse used to infer use
    pois = [(Point(xz), t) for xz, t in osm.nodes.values()
            if t and (t.get('shop') or t.get('office') or t.get('craft') or (t.get('amenity') and t['amenity'] not in
                                                                           ('bench', 'waste_basket', 'bicycle_parking', 'parking', 'parking_space', 'bus_station', 'post_box', 'recycling', 'vending_machine', 'drinking_water', 'shelter', 'fountain', 'clock', 'toilets', 'bicycle_rental', 'charging_station', 'atm')))]
    poi_tree = STRtree([p for p, _ in pois])
    commercial_land = unary_union([g for k, t, g in geoms if t.get('landuse') in ('commercial', 'retail')])
    comm_prep = prepared.prep(commercial_land) if not commercial_land.is_empty else None

    cand = []
    for key, t, g in geoms:
        b = t.get('building')
        if not b or b in SKIP_B or t.get('building:part'):
            continue
        for p in polys_of(g):
            if p.area < 6 or not BOUNDS_BOX.contains(p.centroid):
                continue
            cand.append((key, t, p))
    log('buildings candidates', len(cand))

    out = []
    for key, t, p in cand:
        b = t['building']
        area = p.area
        use = BTYPE.get(b)
        if t.get('amenity') == 'place_of_worship':
            use = 'church'
        if t.get('amenity') == 'theatre':
            use = 'theatre'
        if t.get('amenity') in ('townhall', 'courthouse', 'school', 'library', 'fire_station', 'police', 'community_centre'):
            use = 'civic'
        d0 = math.hypot(p.centroid.x, p.centroid.y)   # y holds world z
        core = d0 < 500 or (comm_prep is not None and comm_prep.contains(p.centroid))
        near = [pois[i][1] for i in poi_tree.query(p, predicate='contains')]
        if use is None or b == 'yes':
            if any(n.get('shop') or n.get('office') or n.get('amenity') in ('restaurant', 'cafe', 'pub', 'bar', 'fast_food', 'bank', 'pharmacy', 'dentist', 'doctors') for n in near):
                use = 'commercial'
            elif any(n.get('amenity') in ('theatre',) for n in near):
                use = 'theatre'
            elif any(n.get('amenity') in ('library', 'townhall', 'courthouse', 'school', 'fire_station', 'police', 'community_centre', 'post_office') for n in near):
                use = 'civic'
            elif any(n.get('amenity') == 'place_of_worship' for n in near):
                use = 'church'
            elif use is None:
                use = None
        nm = (t.get('name') or '').lower()
        if (use is None or b == 'yes' or b == 'service') and nm:
            if any(k in nm for k in ('church', 'chapel')):
                use = 'church'
            elif any(k in nm for k in ('school', 'college', 'jail', 'armoury', 'fire ', 'library', 'museum', 'arena', 'centre', 'center', 'station', 'water')) and not t.get('shop'):
                use = 'civic'
            elif any(k in nm for k in ('hotel', 'inn', 'mall', 'store', 'pharmacy', 'bank', 'dental', 'financial', 'securities', 'esso', 'mobil', 'shell', 'candies', 'pizza')):
                use = 'commercial'
            elif any(k in nm for k in ('residence', 'place', 'gardens', 'suites', 'bed & breakfast', 'living', 'pines', 'huntingdon')):
                use = 'residential'
        if use is None:   # building=yes and nothing else known
            if area < 20:
                use = 'shed'
            elif area < 50 and not core:
                use = 'garage'
            elif core and area > 90:
                use = 'commercial'
            elif area > 700:
                use = 'industrial' if not core else 'commercial'
            elif area >= 50:
                use = 'residential'
            else:
                use = 'shed'
        bid = ('w' + key[1:]) if key[0] == 'w' else key
        out.append(dict(lm_hint=(bid in LM_WAYS), key=key, id=bid, tags=t, poly=p, use=use, area=area, core=core))
    return out


def lidar_heights(poly, G):
    """(base_elev, ridge_rel, eaves_rel, spread, n) from the 1 m grids, or None."""
    from rasterio.features import rasterize
    from rasterio.transform import Affine
    x0, z0, x1, z1 = poly.bounds
    gx0, gz0 = G['gx0'], G['gz0']
    i0, i1 = int(math.floor(x0 - gx0)) - 1, int(math.ceil(x1 - gx0)) + 2
    j0, j1 = int(math.floor(z0 - gz0)) - 1, int(math.ceil(z1 - gz0)) + 2
    dtm, dsm = G['dtm'], G['dsm']
    if i0 < 0 or j0 < 0 or i1 >= dtm.shape[1] or j1 >= dtm.shape[0]:
        return None
    tf = Affine(1, 0, gx0 + i0 - 0.5, 0, 1, gz0 + j0 - 0.5)   # pixel (i,j) centred on integer coords
    shape = (j1 - j0, i1 - i0)
    full = rasterize([(poly, 1)], out_shape=shape, transform=tf).astype(bool)
    inner_poly = poly.buffer(-0.8)
    inner = rasterize([(inner_poly, 1)], out_shape=shape, transform=tf).astype(bool) if not inner_poly.is_empty else np.zeros(shape, bool)
    m = inner if inner.sum() >= 6 else full
    if m.sum() < 3:
        return None
    sub_dtm = dtm[j0:j1, i0:i1]
    sub_dsm = dsm[j0:j1, i0:i1]
    base = float(sub_dtm[full].min()) if full.any() else float(sub_dtm[m].min())
    rel = sub_dsm[m] - base
    p = np.percentile(rel, [10, 25, 50, 75, 95])
    return base, p, int(m.sum())


def apply_lidar(b, G, origin_elev):
    r = lidar_heights(b['poly'], G)
    if r is None:
        return False
    base, p, n = r
    short, long_ = short_side(b['poly'])
    p10, p25, p50, p75, p95 = [float(v) for v in p]
    b['base_elev'] = base
    spread = p95 - p10
    ridge = p95
    if ridge < 1.8 or ridge > 60:
        return False
    if b['use'] in ('garage', 'shed') and ridge < 2.2:
        ridge = 2.2
    if spread < 1.7 or (n < 8 and spread < 2.5) or (short > 20 and not b.get('lm_hint')):
        b['lidar'] = ('flat', max(p50, 2.2), 0.0)
    else:
        rh_max = (0.7 if b['use'] == 'church' else 0.45) * short
        rh = min(ridge - p25 + 0.2 * (p25 - p10), rh_max, 11.0 if b['use'] == 'church' else 6.0, ridge - 2.2)
        if rh < 1.0:
            b['lidar'] = ('flat', max(p50, 2.2), 0.0)
        else:
            b['lidar'] = ('pitched', ridge - rh, rh)    # total height = ridge; eaves = ridge - roof rise
    return True


# ---------------------------------------------------------------- main build
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-lidar', action='store_true')
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--out', default=OUT_DIR)
    args = ap.parse_args()
    LM_WAYS.update('w' + lm['find'][1] for lm in LANDMARKS if lm['find'][0] == 'way')
    t_start = time.time()
    osm = OSM(args.offline)
    if not args.no_lidar and not lidarmod.available() and not args.offline:
        log('fetching LiDAR window')
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'fetch_lidar.py')], check=False)
    G = None if args.no_lidar else lidarmod.load()
    log('lidar', 'yes' if G else 'no')

    geoms = list(feature_geoms(osm))
    log('polygon features', len(geoms))

    # ---- terrain
    x0 = math.floor(MINX / CELL) * CELL
    z0 = math.floor(MINZ / CELL) * CELL
    nx = int(math.ceil((MAXX - x0) / CELL)) + 1
    nz = int(math.ceil((MAXZ - z0) / CELL)) + 1
    ox, oz = 0.0, 0.0
    if G:
        dtm = G['dtm']
        origin_elev = float(dtm[int(round(oz - G['gz0'])), int(round(ox - G['gx0']))])
    else:
        origin_elev = 360.0
    log('origin elev', origin_elev)

    # ---- water (before terrain: terrain is carved under it)
    water_polys, area_list = [], []
    for key, t, g in geoms:
        if is_water(t):
            c = g.intersection(BOUNDS_BOX)
            if not c.is_empty and c.area > 8:
                water_polys.append((key, t, c))
    water_union = unary_union([g for _, _, g in water_polys]) if water_polys else Polygon()
    # waterways
    stream_lines = {}
    for wid, (refs, t) in osm.ways.items():
        if t.get('waterway') in ('stream', 'river', 'canal', 'ditch', 'drain') and not t.get('tunnel') and not t.get('culvert'):
            c = osm.coords(wid)
            if len(c) >= 2:
                g = LineString(c).intersection(BOUNDS_BOX)
                for part in (g.geoms if hasattr(g, 'geoms') else [g]):
                    if part.geom_type == 'LineString' and part.length > 3:
                        stream_lines.setdefault(t.get('name', ''), []).append((wid, t, part))

    import terrain as terr
    T = terr.build(G, origin_elev, x0, z0, nx, nz, water_union, args.out)
    ground = T['ground']   # function (x,z)-> world y (vectorised), relative to origin

    # ---- rivers with width / levels
    rivers = terr.rivers(stream_lines, water_union, T)

    # ---- roads
    roads = build_roads(osm)
    named_lines = [LineString(r['points']) for r in roads if r.get('name') and r['kind'] in ('primary', 'secondary', 'tertiary', 'residential', 'service')]
    named_names = [r['name'] for r in roads if r.get('name') and r['kind'] in ('primary', 'secondary', 'tertiary', 'residential', 'service')]
    named_tree = STRtree(named_lines)
    log('roads', len(roads))

    # ---- areas
    areas = []
    for key, t, g in geoms:
        if t.get('building') or is_water(t):
            continue
        k = area_kind(t)
        if not k:
            continue
        c = g.intersection(BOUNDS_BOX)
        for p in polys_of(c):
            if p.area < (40 if k in ('grass', 'garden') else 25):
                continue
            if k in ('grass', 'garden', 'park', 'wood') and not water_union.is_empty:
                p = p.difference(water_union)
            for q in polys_of(p):
                d = poly_out(q, 0.1)
                if d:
                    d['kind'] = k
                    if t.get('name'):
                        d['name'] = t['name']
                    areas.append((q.area, d))
    areas.sort(key=lambda a: -a[0])
    areas = [a[1] for a in areas]
    log('areas', len(areas))

    # ---- railways
    railways = []
    for wid, (refs, t) in osm.ways.items():
        if t.get('railway') == 'rail' and t.get('tunnel') != 'yes':
            c = osm.coords(wid)
            if len(c) >= 2:
                g = LineString(c).intersection(BOUNDS_BOX)
                for part in (g.geoms if hasattr(g, 'geoms') else [g]):
                    if part.geom_type == 'LineString' and part.length > 2:
                        railways.append({'points': [[r2(x), r2(z)] for x, z in part.simplify(0.1).coords]})

    # ---- buildings
    blds = build_buildings(osm, geoms, G, G)
    lm_by_way = {}
    for lm in LANDMARKS:
        kind, ref = lm['find']
        if kind == 'way':
            lm_by_way[('w' + ref)] = lm
    # node-building landmarks: containing / nearest building
    btree = STRtree([b['poly'] for b in blds])
    for lm in LANDMARKS:
        kind, ref = lm['find']
        if kind == 'node-building':
            pt = Point(osm.nodes[ref][0])
            idx = [i for i in btree.query(pt, predicate='within')]
            if not idx:
                idx = list(btree.query_nearest(pt, max_distance=40))
            if idx:
                lm_by_way[blds[int(idx[0])]['id']] = lm
            else:
                log('WARNING no building for landmark', lm['id'])
    n_lidar = 0
    for b in blds:
        lm = lm_by_way.get(b['id'])
        if lm:
            b['lm'] = lm
            if lm.get('use'):
                b['use'] = lm['use']
            b['name'] = lm['name']
        short, long_ = short_side(b['poly'])
        b['short'] = short
        lv, eaves, rh, roof = estimate(b['use'], b['area'], short, b['core'], b['key'], b['tags'])
        b['est'] = (lv, eaves, rh, roof)
        b['lidar'] = None
        if G is not None and apply_lidar(b, G, origin_elev):
            n_lidar += 1
    log('lidar heights', n_lidar, 'of', len(blds))

    buildings = []
    for b in blds:
        t = b['tags']
        p = b['poly']
        lv, eaves, rh, roof = b['est']
        use = b['use']
        base = 0.0
        if 'base_elev' in b:
            base = b['base_elev'] - origin_elev
        else:
            base = float(ground(p.centroid.x, p.centroid.y)) if G else 0.0
        explicit_h = num(t.get('height'))
        if b['lidar'] and not explicit_h:
            kind, e, r = b['lidar']
            eaves, rh = e, r
            # guard against tree-inflated or misread roofs: do not exceed estimate by too much
            lim = max(b['est'][1] * 1.8, b['est'][1] + 5)
            if eaves > lim:
                eaves = max(b['est'][1], 3.0)
            if kind == 'flat':
                roof = 'flat'
            else:
                if t.get('roof:shape') in ('gabled', 'hipped', 'pyramidal', 'dome', 'mansard'):
                    roof = t['roof:shape']
                elif roof == 'flat' or b['est'][3] == 'flat':
                    roof = 'hipped' if use in ('civic', 'church') or b['area'] > 300 else 'gabled'
                if roof in ('gabled', 'hipped') and b['area'] < 60 and b['short'] < 7 and use in ('shed', 'garage') and rh < 1.6:
                    pass
            sh = 3.5 if use in ('commercial', 'civic', 'theatre') else 3.0
            lv = max(1, round(eaves / sh * 2) / 2)
        if t.get('roof:shape') in ('gabled', 'hipped', 'pyramidal', 'dome', 'mansard', 'flat') and not b['lidar']:
            roof = t['roof:shape']
        if roof == 'pyramidal' or (roof in ('gabled', 'hipped') and b['short'] < 5 and rh > 0 and b['area'] < 40 and False):
            pass
        if roof == 'flat':
            rh = 0.0
        d = poly_out(p, 0.05)
        if not d:
            continue
        bd = {'id': b['id'], 'outer': d['outer']}
        if 'holes' in d:
            bd['holes'] = d['holes']
        bd.update({'base': r2(base), 'height': r2(max(eaves, 2.2)), 'roofHeight': r2(rh), 'roof': roof,
                   'levels': lv, 'use': use, 'material': (b.get('lm') or {}).get('material') or guess_material(use, b['key'], t)})
        if b.get('name') or t.get('name'):
            bd['name'] = b.get('name') or t['name']
        # street + front edge
        try:
            near = named_tree.query_nearest(p, max_distance=60, all_matches=False)
        except Exception:
            near = []
        street_line = None
        if len(near):
            i = int(near[0])
            street_line = named_lines[i]
            bd['street'] = named_names[i]
            addr = t.get('addr:street')
            if addr and addr != bd['street']:
                for j in named_tree.query(p.buffer(80)):
                    if named_names[int(j)] == addr:
                        bd['street'] = addr; street_line = named_lines[int(j)]; break
        if street_line is not None:
            o = bd['outer']; n = len(o)
            c = nearest_points(p.centroid, street_line)[1]
            best, bscore = None, 1e18
            maxlen = max(math.dist(o[i], o[(i + 1) % n]) for i in range(n))
            for i in range(n):
                a, bb = o[i], o[(i + 1) % n]
                L = math.dist(a, bb)
                if L < 1.0:
                    continue
                dx, dz = bb[0] - a[0], bb[1] - a[1]
                nxn, nzn = -dz / L, dx / L
                mid = ((a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2)
                face = nxn * (c.x - mid[0]) + nzn * (c.y - mid[1])
                dist = Point(mid).distance(street_line)
                if face <= 0.05 * max(dist, 1):
                    continue
                score = dist - 0.15 * L
                if L < 0.25 * maxlen:
                    score += 8
                if score < bscore:
                    best, bscore = i, score
            if best is not None:
                bd['front'] = [best, (best + 1) % n]
        buildings.append(bd)
    log('buildings', len(buildings))

    # ---- landmarks, spawn
    bmap = {b['id']: b for b in buildings}
    lm_out = []
    centres = {}
    avon = [(g, t) for nm, items in stream_lines.items() if nm == 'Avon River' for _, t, g in items]
    avon_merged = linemerge([g for g, _ in avon]) if avon else None
    for lm in LANDMARKS:
        kind, ref = lm['find']
        pos, bid = None, None
        if kind == 'way':
            bid = 'w' + ref
            if bid in bmap:
                pos = polygon_centroid(bmap[bid]['outer'])
            else:
                p = osm.poly(ref)
                if p is not None:
                    pos = (p.centroid.x, p.centroid.y)
        elif kind == 'node-building':
            for bidk, l2 in lm_by_way.items():
                if l2 is lm and bidk in bmap:
                    bid = bidk; pos = polygon_centroid(bmap[bidk]['outer'])
            if pos is None:
                pos = osm.nodes[ref][0]
        elif kind == 'area':
            p = osm.poly(ref)
            pos = (p.centroid.x, p.centroid.y)
            if p.contains(Point(pos)) is False:
                rp = p.representative_point(); pos = (rp.x, rp.y)
        elif kind == 'lake':
            pt = Point(osm.nodes[ref][0])
            best = min(polys_of(water_union), key=lambda q: q.distance(pt))
            rp = best.representative_point()
            pos = (rp.x, rp.y)
        elif kind == 'river':
            cx, cz = centres[ref]
            if avon_merged is not None:
                np_ = nearest_points(avon_merged, Point(cx, cz))[0]
                pos = (np_.x, np_.y)
        if pos is None:
            log('WARNING landmark not placed:', lm['id'])
            continue
        centres[lm['id']] = pos
        d = {'id': lm['id'], 'name': lm['name'], 'x': r2(pos[0]), 'z': r2(pos[1]), 'radius': lm['radius'], 'blurb': lm['blurb']}
        if bid:
            d['buildingId'] = bid
        lm_out.append(d)

    # spawn: pole of inaccessibility of Market Square minus buildings
    spawn = None
    sq = osm.poly('504649968')
    if sq is not None:
        from shapely.algorithms.polylabel import polylabel
        free = sq.difference(unary_union([b['poly'].buffer(1.5) for b in blds]))
        cands = [q for q in polys_of(free)]
        if cands:
            q = max(cands, key=lambda q: q.area)
            pt = polylabel(q, 0.5)
            spawn = (pt.x, pt.y)
    if spawn is None:
        spawn = (centres.get('market-square') or (0, 40))
    ch = centres['city-hall']
    dx, dz = ch[0] - spawn[0], ch[1] - spawn[1]
    yaw = math.atan2(-dx, -dz)   # forward = (-sin yaw, 0, -cos yaw), three.js rotation.y convention
    spawn_out = {'x': r2(spawn[0]), 'z': r2(spawn[1]), 'yaw': round(yaw, 4), 'lookAt': [r2(ch[0]), r2(ch[1])]}

    # ---- trees
    import trees as treemod
    tree_list = treemod.build(osm, G, T, buildings, blds, water_union, roads, areas, geoms)
    log('trees', len(tree_list))

    # ---- water output
    wpolys = []
    for key, t, g in water_polys:
        for q in polys_of(g):
            for piece, lev in T['info']['pieces'](q):
                for pp in polys_of(piece):
                    d = poly_out(pp, 0.1)
                    if d:
                        d['level'] = lev
                        if t.get('name'):
                            d['name'] = t['name']
                        wpolys.append(d)
    water = {'level': T['water_level'], 'polygons': wpolys, 'rivers': rivers}

    town = {
        'version': 1,
        'origin': {'lat': LAT0, 'lon': LON0, 'elev': r2(origin_elev)},
        'bounds': {'minX': r2(MINX), 'maxX': r2(MAXX), 'minZ': r2(MINZ), 'maxZ': r2(MAXZ)},
        'attribution': '© OpenStreetMap contributors (ODbL); contains information licensed under the Open Government Licence – Ontario / Canada',
        'terrain': T['meta'],
        'buildings': buildings, 'roads': roads, 'areas': areas, 'water': water, 'trees': tree_list,
        'railways': railways, 'landmarks': lm_out, 'spawn': spawn_out,
    }
    os.makedirs(args.out, exist_ok=True)
    tmp = os.path.join(args.out, 'town.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(town, f, separators=(',', ':'), ensure_ascii=False)
    os.replace(tmp, os.path.join(args.out, 'town.json'))
    log('wrote town.json', os.path.getsize(os.path.join(args.out, 'town.json')) // 1024, 'KB; terrain.bin',
        os.path.getsize(os.path.join(args.out, 'terrain.bin')) // 1024, 'KB; total', round(time.time() - t_start), 's')


def polygon_centroid(ring):
    return Polygon(ring).centroid.x, Polygon(ring).centroid.y


if __name__ == '__main__':
    main()
