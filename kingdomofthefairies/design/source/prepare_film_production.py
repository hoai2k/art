#!/usr/bin/env python3
"""Prepare saved film-edition artwork at its requested size and anchor.

Retain native originals and generation records; reuse the existing sprite
delivery fitting routine. No generated artwork is repainted.
"""
from pathlib import Path
import argparse
import json
import shutil
from datetime import datetime, timedelta, timezone
from PIL import Image
from prepare_part_c_delivery import fit_sprite

GAME = Path(__file__).resolve().parents[2]
BATCH = GAME / 'design/generated/film-production'
manifest_path = GAME / 'assets/manifest.json'
manifest = json.loads(manifest_path.read_text())
records = []
previous_path = BATCH / 'deliveries.json'
previous = {r['id']: r for r in json.loads(previous_path.read_text())['images']} if previous_path.exists() else {}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--ids', nargs='+', help='prepare only these changed assets; validate cached deliveries for the rest')
selected = parser.parse_args().ids
for path in sorted(BATCH.glob('*.json')):
    if path.name == 'deliveries.json' or path.name.startswith('._'):
        continue
    record = json.loads(path.read_text())
    ident = record['id']
    if record.get('fit_bounds'):
        record['alignment_bounds'] = record['fit_bounds']
    elif record.get('align_to'):
        with Image.open(GAME / 'assets' / (record['align_to'] + '.webp')) as reference:
            record['alignment_bounds'] = list(reference.getchannel('A').point(lambda value: 255 if value >= 8 else 0).getbbox())
    original = BATCH / (ident + '-original.png')
    delivery = GAME / 'assets' / (ident + '.webp')
    cached = previous.get(ident)
    if (cached and delivery.exists() and (delivery.stat().st_mtime >= original.stat().st_mtime
            or selected is not None and ident not in selected)
            and all(cached.get(k) == record.get(k) for k in ['prompt', 'size', 'anchor', 'transparent', 'align_to', 'alignment_bounds'])):
        with Image.open(delivery) as check:
            check.verify()
        with Image.open(delivery) as check:
            assert list(check.size) == record['size'], ident
            if record['transparent']:
                assert check.mode == 'RGBA' and check.getchannel('A').getextrema()[0] == 0, ident
        cached.update(record)
        records.append(cached)
        manifest['slots'][ident].update(status='delivered', file=ident + '.webp',
                                       size=record['size'], anchor=record['anchor'], edition=record.get('edition', 'film'))
        continue
    with Image.open(original) as source:
        source.verify()
    with Image.open(original) as source:
        source = source.convert('RGBA')
        native = list(source.size)
        w, h = record['size']
        if record['transparent']:
            assert source.getchannel('A').getextrema()[0] == 0, ident + ': missing transparency'
            final, crop, placement = fit_sprite(source, w, h, record['anchor'], ident in {'rampart-strip', 'tower-wall-tall', 'tower-interior'})
            if record.get('alignment_bounds'):
                x0, y0, x1, y1 = record['alignment_bounds']
                bw, bh = x1 - x0, y1 - y0
                # Only a small export adjustment is allowed. Larger pose or
                # proportion differences need a new generated image.
                sx, sy = bw / (crop[2] - crop[0]), bh / (crop[3] - crop[1])
                assert abs(sy / sx - 1) <= 0.03, ident + ': alignment exceeds 3%; regenerate'
                fitted, crop, _ = fit_sprite(source, bw, bh, record['anchor'], True)
                final = Image.new('RGBA', (w, h))
                final.paste(fitted, (x0, y0))
                placement = [x0, y0, bw, bh]
            assert final.getchannel('A').getbbox(), ident + ': empty artwork'
        else:
            final = source.convert('RGB').resize((w, h), Image.Resampling.LANCZOS)
            crop = placement = None
        delivery = GAME / 'assets' / (ident + '.webp')
        final.save(delivery, 'WEBP', quality=95, method=4)
        with Image.open(delivery) as check:
            assert check.size == (w, h), ident
            if record['transparent']:
                assert check.mode == 'RGBA' and check.getchannel('A').getextrema()[0] == 0, ident
    record.update(original=str(original.relative_to(GAME)), file=str(delivery.relative_to(GAME)),
                  native_size=native, source_crop=crop, placement=placement)
    records.append(record)
    slot = manifest['slots'][ident]
    slot.update(status='delivered', file=ident + '.webp', size=[w, h], anchor=record['anchor'], edition=record.get('edition', 'film'))
by_id = {record['id']: record for record in records}
installed = set()
for record in records:
    target = record.get('install_as')
    if not target or record.get('superseded_by'):
        continue
    assert target not in installed, target + ': multiple active replacements'
    installed.add(target)
    assert manifest['slots'][target]['size'] == record['size'], target
    previous_file = BATCH / record.get('archive_directory', 'progress/superseded-f14') / (target + '.webp')
    assert previous_file.exists(), target + ': archive the earlier prepared file before replacement'
    shutil.copy2(GAME / record['file'], GAME / 'assets' / (target + '.webp'))
    record['installed_file'] = 'assets/' + target + '.webp'
    by_id[target].update(file=str(previous_file.relative_to(GAME)), superseded_by=record['id'])
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
(BATCH / 'deliveries.json').write_text(json.dumps({'generated': len(records), 'images': records}, indent=2) + '\n')
print('Validated and prepared', len(records), 'film production images.')
progress = BATCH / 'progress'
progress.mkdir(exist_ok=True)
now = datetime.now(timezone.utc)
pending = sum(slot.get('edition') == 'film' and slot.get('status') != 'delivered'
              for slot in manifest['slots'].values())
(progress / 'state.json').write_text(json.dumps({
    'active': pending > 0, 'completed': len(records), 'pending': pending,
    'updated_at': now.isoformat(),
    'lease_expires_at': (now + timedelta(minutes=90)).isoformat() if pending else None,
}, indent=2) + '\n')
