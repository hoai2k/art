"""HRDEM LiDAR window -> 1 m grid aligned with the world axes.

The cached window (local/stratford/lidar/{dtm,dsm}.npy, EPSG:3979) is resampled
bilinearly onto integer world coordinates (x = gx0 + i, z = gz0 + j).
"""
import os, math
import numpy as np
from scipy.ndimage import map_coordinates
from pyproj import Transformer
from common import *

GX0 = int(math.floor(MINX / CELL) * CELL) - 8
GZ0 = int(math.floor(MINZ / CELL) * CELL) - 8


def available():
    return all(os.path.exists(os.path.join(LIDAR_DIR, f)) for f in ('dtm.npy', 'dsm.npy', 'transform.npy'))


def load():
    """Return dict(dtm, dsm, gx0, gz0) with elevations in metres above sea level, or None."""
    if not available():
        return None
    cd, cs = os.path.join(LIDAR_DIR, 'grid_dtm.npy'), os.path.join(LIDAR_DIR, 'grid_dsm.npy')
    nx = int(math.ceil(MAXX)) - GX0 + 9
    nz = int(math.ceil(MAXZ)) - GZ0 + 9
    if not (os.path.exists(cd) and os.path.exists(cs)):
        t = np.load(os.path.join(LIDAR_DIR, 'transform.npy'))
        a, b, c, d, e, f = t
        tr = Transformer.from_crs('EPSG:4326', 'EPSG:3979', always_xy=True)
        xs = GX0 + np.arange(nx, dtype='float64')
        zs = GZ0 + np.arange(nz, dtype='float64')
        X, Z = np.meshgrid(xs, zs)
        lat, lon = unproj(X, Z)
        E_, N_ = tr.transform(lon, lat)
        col = (E_ - c) / a - 0.5   # pixel centres
        row = (N_ - f) / e - 0.5
        for name, out in (('dtm', cd), ('dsm', cs)):
            src = np.load(os.path.join(LIDAR_DIR, name + '.npy'))
            fill = np.nanmedian(src)
            src = np.where(np.isfinite(src), src, fill)
            g = map_coordinates(src, [row, col], order=1, mode='nearest').astype('float32')
            np.save(out, g)
    return dict(dtm=np.load(cd), dsm=np.load(cs), gx0=GX0, gz0=GZ0)
