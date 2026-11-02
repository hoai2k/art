# tools/town: OSM + LiDAR -> `game/data/`

Writes `game/data/town.json` and `terrain.bin` (schema: `../../ARCHITECTURE.md`).
Outputs are written to a temp file and renamed, so a reader never sees half a file.

```
pip install rasterio shapely pyproj          # numpy, scipy, Pillow are also needed
python3 build_town.py                        # fetch missing caches, build with LiDAR if cached
python3 build_town.py --offline              # never touch the network (fails if a cache is missing)
python3 build_town.py --no-lidar             # v1: OSM only, flat terrain, estimated heights
python3 preview.py out.png [x0 z0 x1 z1]     # top-down preview (whole extent, or a crop in metres)
node --test ../../game/test/town-data.test.mjs
```

Caches live in `/home/user/art/local/stratford/` (ignored by Git): `osm/*.osm` (five API
tiles), `lidar/{dtm,dsm,transform}.npy` (HRDEM window) and `lidar/grid_*.npy` (resampled
1 m grids). Delete a cache file to refetch it. Run from this folder (plain `python3`, not `-I`).

## Steps

1. `fetch_osm` (build_town.py): five OSM API `map` calls tile the extent (each under the
   50,000-node limit), cached, with a User-Agent and a 2 s pause. Overpass is not used.
2. `fetch_lidar.py`: COG range read of the NRCan HRDEM 1 m DTM and DSM
   (`ON-Upper_Thames_Grand_River_2025-1m`, falling back to `ON-Lake_Erie_Fall_2017-1m`) for the
   extent; `lidar.py` resamples them onto a 1 m grid aligned with the world axes.
3. `terrain.py` / `water.py`: DTM (3 m box blur) sampled at 4 m nodes -> `terrain.bin`. The DTM
   is hydro-flattened, so it gives water surface heights directly; the bed is carved below it.
   Water polygons are cut where the level steps or drifts more than 0.3 m (the dam).
4. `build_town.py`: roads (width from `width`/`lanes`/class), areas, railways, buildings.
   Use from OSM tags, POIs inside the footprint, names, then footprint size and distance
   from the core. Heights: DSM minus the lowest ground under the footprint, inside the footprint
   shrunk by 0.8 m: p95 is the ridge; a spread (p95 - p10) under 1.7 m (or a footprint wider than
   20 m) is a flat roof at the median; otherwise pitched with the rise capped by footprint width.
   Without LiDAR: `levels` x 3.5 m (3.0 for houses), estimates by use and footprint.
   Materials are deterministic guesses (hash of the id). `street`/`front`: nearest named road,
   the edge that faces it.
5. `trees.py`: canopy-height-model maxima (Gaussian 1.4 m, 9 m window, over 3.5 m, poles
   rejected) outside buildings and water, merged with OSM `natural=tree` nodes; `kind` from
   species tags, crown shape and setting (willows by water, maples on streets, a mix in parks).
6. `landmarks.py`: 17 landmarks located from OSM features, with checked blurbs.
7. Spawn: pole of inaccessibility of the Market Square polygon minus buildings, facing City Hall.

Known limits: building heights can be inflated by overhanging trees; LiDAR is from 2025, OSM
footprints are older in places; the Avon bed depth is invented (0.35 to 2 m).
