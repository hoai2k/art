"""Tree positions: OSM natural=tree nodes + tree_rows (+ LiDAR canopy maxima when available)."""
import math
import numpy as np
from shapely import contains_xy
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from common import *


def build(osm, G, T, buildings, blds, water_union, roads, areas, geoms):
    rng = np.random.default_rng(7)
    out = []
    for xz, t in osm.nodes.values():
        if t.get('natural') == 'tree' and MINX <= xz[0] <= MAXX and MINZ <= xz[1] <= MAXZ:
            out.append({'x': round(xz[0], 2), 'z': round(xz[1], 2), 'height': 9.0, 'crown': 5.0, 'kind': 'maple'})
    return out
