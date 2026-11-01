"""terrain.bin from the HRDEM DTM (or flat when there is no LiDAR), plus water levels."""
import os, math
import numpy as np
from scipy.ndimage import uniform_filter, gaussian_filter, distance_transform_edt, map_coordinates
from shapely import contains_xy
from shapely.geometry import LineString, Point
from shapely.ops import linemerge
from common import *


def r2(v):
    return round(float(v), 2)


def build(G, origin_elev, x0, z0, nx, nz, water_union, outdir):
    xs = x0 + CELL * np.arange(nx)
    zs = z0 + CELL * np.arange(nz)
    if G is None:
        elev = np.full((nz, nx), origin_elev, 'float32')
        grid = None
    else:
        dtm = G['dtm'].astype('float64')
        sm = uniform_filter(dtm, size=3, mode='nearest')      # 3 m box blur: keeps valley shapes, kills 1 m noise
        ii = (xs - G['gx0']).astype(int); jj = (zs - G['gz0']).astype(int)
        elev = sm[np.ix_(jj, ii)].astype('float32')
        grid = dtm
    # water carving / levels are decided in water.py once the DTM has been inspected
    import water as W
    info = W.process(G, elev, xs, zs, origin_elev, water_union)
    elev = info['elev']
    minE = float(elev.min())
    u16 = np.round((elev - minE) * 100).astype('<u2')
    os.makedirs(outdir, exist_ok=True)
    tmp = os.path.join(outdir, 'terrain.bin.tmp')
    u16.tofile(tmp)
    os.replace(tmp, os.path.join(outdir, 'terrain.bin'))
    stored = u16.astype('float64') / 100 + minE

    def ground(x, z):
        gi = (np.asarray(x, 'float64') - x0) / CELL
        gj = (np.asarray(z, 'float64') - z0) / CELL
        v = map_coordinates(stored, [np.atleast_1d(gj), np.atleast_1d(gi)], order=1, mode='nearest')
        return (v - origin_elev) if np.ndim(x) else float(v[0] - origin_elev)

    meta = {'file': 'terrain.bin', 'nx': nx, 'nz': nz, 'cell': CELL, 'x0': r2(x0), 'z0': r2(z0),
            'format': 'uint16 little-endian, cm above minElev, row-major (z rows from z0, x columns from x0); '
                      'sample (i,j) is the height at x=x0+i*cell, z=z0+j*cell; y = minElev + v/100 - origin.elev',
            'minElev': r2(minE)}
    return {'ground': ground, 'meta': meta, 'water_level': info['level'], 
            'info': info, 'origin_elev': origin_elev, 'G': G}


def rivers(stream_lines, water_union, T):
    import water as W
    return W.rivers(stream_lines, water_union, T)
