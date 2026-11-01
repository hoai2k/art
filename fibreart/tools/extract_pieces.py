#!/usr/bin/env python3
"""Extract the delivered tableau sheets in request order (Pillow, NumPy, SciPy).

The reviewed component selections describe the actual sheets, not an assumed grid.
Run from any directory after changing a sheet only after reviewing its selections.
"""
import json
import argparse
import re
import runpy
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SELECTIONS = {
    'HK-T02-C': [[1], [2], [3], [5], [7], [6], [10], [12], [11]],
    'HK-T06-C': [[1], [2], [3], [4], [6], [5], [7]],
    'HK-M02': [[4], [3], [2], [1], [5]],
    'HK-M04': [[1], [5], [3], [2], [4]],
    'HK-T01-C': [[4], [1], [2], [3], [6], [5], [7], [8], [9], [10], [13], [12, 14, 15, 16]],
    'HK-T03-C': [[1], [2], [3], [5], [4], [6], [7], [9]],
    'HK-T04-C': [[1], [3], [2], [6], [4], [5], [7], [9], [8]],
    'HK-T05-C': [[2], [3], [1], [5], [6], [8], [7]],
    'HK-T07-C': [[2], [3], [1], [5], [4], [6], [7], [9]],
    'HK-T08-C': [[2], [1], [3], [4], [5], [6]],
    'HK-T09-C': [[1], [3], [2], [6], [5], [4], [7], [9], [8]],
    'HK-T10-C': [[2], [1], [3], [4], [5], [6], [7]],
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', nargs='+', help='Review and rebuild only these request IDs; preserve other cuts.')
    args = parser.parse_args()
    requests = runpy.run_path(str(ROOT / 'design/source/build_requests.py'))['REQUESTS']
    manifest = ROOT / 'game/assets/pieces.json'
    result = json.loads(manifest.read_text()) if args.only and manifest.exists() else {}
    for request in requests:
        if request['id'] not in SELECTIONS:
            continue
        if args.only and request['id'] not in args.only:
            continue
        path = ROOT / 'game' / request['file']
        image = Image.open(path).convert('RGBA')
        pixels = np.array(image)
        labels, _ = ndimage.label(ndimage.binary_dilation(pixels[:, :, 3] > 32, iterations=1 if request['section'] == 'chain' else 3))
        objects = ndimage.find_objects(labels)
        selections = SELECTIONS[request['id']]
        assert len(selections) == len(request['pieces'])
        owners = {}
        boxes = []
        for index, selection in enumerate(selections):
            for label in selection:
                assert label <= len(objects) and objects[label - 1] is not None
                owners[label] = index
            parts = [objects[label - 1] for label in selection]
            boxes.append((min(p[1].start for p in parts), min(p[0].start for p in parts),
                          max(p[1].stop for p in parts), max(p[0].stop for p in parts)))
        # Keep disconnected frays and stitches with the nearest reviewed motif.
        for label, bounds in enumerate(objects, 1):
            if label in owners or bounds is None:
                continue
            x = (bounds[1].start + bounds[1].stop) / 2
            y = (bounds[0].start + bounds[0].stop) / 2
            def distance(box):
                left, top, right, bottom = box
                return max(left-x, 0, x-right)**2 + max(top-y, 0, y-bottom)**2
            owners[label] = min(range(len(boxes)), key=lambda i: distance(boxes[i]))
        lookup = np.full(int(labels.max()) + 1, -1)
        for label, owner in owners.items():
            lookup[label] = owner
        rows = []
        directory = path.parent / (path.stem if request['section'] == 'chain' else 'pieces')
        directory.mkdir(exist_ok=True)
        for index, name in enumerate(request['pieces']):
            mask = lookup[labels] == index
            cut = pixels.copy()
            cut[:, :, 3] = np.where(mask, cut[:, :, 3], 0)
            cut = Image.fromarray(cut)
            bounds = cut.getchannel('A').getbbox()
            assert bounds is not None
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:72].rstrip('-')
            destination = directory / f'{index+1:02d}-{slug}.png'
            cut.crop(bounds).save(destination)
            rows.append({'name': name, 'file': str(destination.relative_to(ROOT / 'game')),
                         'sheetBounds': list(bounds), 'size': [bounds[2]-bounds[0], bounds[3]-bounds[1]]})
        result[request['key']] = rows
    manifest.write_text(json.dumps(result, indent=2) + '\n')
    print(f"Extracted {sum(map(len, result.values()))} pieces from {len(result)} sheets.")


if __name__ == '__main__':
    main()
