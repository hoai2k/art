#!/usr/bin/env python3
"""Download the HRDEM (NRCan) 1 m DTM and DSM window covering the game extent
(COG range reads) into local/stratford/lidar/. Cached: skips existing files."""
import sys, os
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from pyproj import Transformer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
OUT = os.path.join(ROOT, 'local/stratford/lidar')
os.environ.setdefault('GDAL_HTTP_CAINFO', '/root/.ccr/ca-bundle.crt')
BASE = 'https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/'
DATASETS = ['ON-Upper_Thames_Grand_River_2025-1m', 'ON-Lake_Erie_Fall_2017-1m']
LON0, LON1, LAT0, LAT1 = -80.9955, -80.9575, 43.3615, 43.3795  # extent + margin

def main():
    os.makedirs(OUT, exist_ok=True)
    tr = Transformer.from_crs('EPSG:4326', 'EPSG:3979', always_xy=True)
    xs, ys = tr.transform([LON0, LON1, LON0, LON1], [LAT0, LAT0, LAT1, LAT1])
    bb = (min(xs), min(ys), max(xs), max(ys))
    for ds in DATASETS:
        ok = True
        for kind in ('dtm', 'dsm'):
            f = os.path.join(OUT, f'{kind}.npy')
            if os.path.exists(f): continue
            with rasterio.open(f'{BASE}{ds}-{kind}.tif') as r:
                w = from_bounds(*bb, transform=r.transform).round_offsets().round_lengths()
                a = r.read(1, window=w, boundless=True, fill_value=r.nodata)
                a = np.where(a == r.nodata, np.nan, a).astype('float32')
                print(ds, kind, a.shape, 'valid', np.isfinite(a).mean())
                if np.isfinite(a).mean() < 0.9: ok = False; break
                np.save(f, a)
                t = r.window_transform(w)
                np.save(os.path.join(OUT, 'transform.npy'), np.array([t.a, t.b, t.c, t.d, t.e, t.f]))
                open(os.path.join(OUT, 'source.txt'), 'w').write(ds + '\n')
        if ok: break
        for k in ('dtm', 'dsm'):
            p = os.path.join(OUT, f'{k}.npy')
            if os.path.exists(p): os.remove(p)
if __name__ == '__main__': main()
