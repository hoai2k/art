"""Shared constants and projection for the town data pipeline."""
import math, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
CACHE = os.path.join(ROOT, 'local/stratford')
OSM_DIR = os.path.join(CACHE, 'osm')
LIDAR_DIR = os.path.join(CACHE, 'lidar')
OUT_DIR = os.path.join(ROOT, 'stratford/prototype/game/data')

LAT0, LON0 = 43.369994, -80.982254
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110574.0
EXT = dict(minlon=-80.9950, maxlon=-80.9580, minlat=43.3620, maxlat=43.3790)


def proj(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


def unproj(x, z):
    return LAT0 - z / KZ, LON0 + x / KX


_xa, _za = proj(EXT['minlat'], EXT['minlon'])
_xb, _zb = proj(EXT['maxlat'], EXT['maxlon'])
MINX, MAXX = min(_xa, _xb), max(_xa, _xb)
MINZ, MAXZ = min(_za, _zb), max(_za, _zb)
CELL = 4
