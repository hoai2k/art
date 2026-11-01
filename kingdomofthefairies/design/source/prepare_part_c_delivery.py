#!/usr/bin/env python3
"""Size generated Part C art for intake and build its review gallery.

This does no image generation: every original comes from the built-in image
generator. Originals and prompts are retained separately from sized deliveries.
"""
import argparse
import html
import json
from pathlib import Path

from PIL import Image
from build_act_requests import ACTS, MOODS

GAME = Path(__file__).resolve().parents[2]
DELIVERY = GAME / 'design/generated/part-c'
INTAKE = GAME / 'intake'
RESAMPLE = Image.Resampling.LANCZOS
# These are stage-width painted strips/platforms, rather than proportioned cast
# silhouettes. Size their painted bounds to the requested stage rectangle.
FILL_FRAME = {'court-floor', 'belly-water', 'harbour-quay', 'cradle',
              'beam-fall', 'shore-rocks', 'lantern-string'}


def requested_ids():
    return [row[0] for _, _, rows in ACTS for row in rows] + [row[0] for row in MOODS]


def fit_sprite(image, width, height, anchor, fill_frame=False):
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] != 0:
        raise ValueError('sprite has no fully transparent pixels')
    # Ignore invisible alpha specks when measuring the painted card edge, while
    # retaining the actual generated alpha within the crop.
    bbox = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    if bbox is None:
        raise ValueError('empty sprite')
    art = image.crop(bbox)
    ratio = min(width / art.width, height / art.height)
    size = (width, height) if fill_frame else (max(1, round(art.width * ratio)), max(1, round(art.height * ratio)))
    art = art.resize(size, RESAMPLE)
    x = 0 if 'left' in anchor else width - art.width if 'right' in anchor else (width - art.width) // 2
    y = 0 if 'top' in anchor else height - art.height if 'bottom' in anchor else (height - art.height) // 2
    result = Image.new('RGBA', (width, height))
    result.paste(art, (x, y))
    return result, list(bbox), [x, y, art.width, art.height]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--partial', action='store_true', help='prepare completed generations while others are running')
    args = parser.parse_args()
    ids = requested_ids()
    drafts = {p.stem: json.loads(p.read_text()) for p in (DELIVERY / 'records').glob('*.json')}
    saved = DELIVERY / 'prompts.json'
    recipes = {r['id']: r for r in json.loads(saved.read_text())['images']} if saved.exists() else {}
    recipes.update(drafts)
    available = set(recipes)
    missing = sorted(set(ids) - available)
    if missing and not args.partial:
        raise SystemExit('Missing generations: ' + ', '.join(missing))
    INTAKE.mkdir(exist_ok=True)
    records = []
    for asset_id in ids:
        if asset_id not in available:
            continue
        record = recipes[asset_id]
        original = DELIVERY / 'originals' / (asset_id + '.png')
        with Image.open(original) as source:
            image = source.convert('RGBA')
            source_size = list(image.size)
        width, height = record['width'], record['height']
        crop = placement = None
        if record['transparent']:
            final, crop, placement = fit_sprite(image, width, height, record['anchor'], asset_id in FILL_FRAME)
        else:
            if image.getchannel('A').getextrema() != (255, 255):
                raise ValueError(asset_id + ': backcloth must be opaque')
            final = image.convert('RGB').resize((width, height), RESAMPLE)
        destination = INTAKE / (asset_id + '.png')
        final.save(destination, optimize=True)
        if final.size != (width, height):
            raise ValueError(asset_id + ': wrong dimensions')
        refs = []
        for value in record.get('refs', record.get('references', [])):
            if value.startswith(str(GAME) + '/'):
                refs.append(value[len(str(GAME)) + 1:])
            elif not Path(value).is_absolute():
                refs.append(value)
            else:
                refs.append('Earlier generated take of ' + asset_id)
        records.append({
            'id': asset_id, 'title': record['title'], 'section': record['section'],
            'width': width, 'height': height, 'anchor': record['anchor'],
            'transparent': record['transparent'], 'file': 'intake/' + asset_id + '.png',
            'original': 'design/generated/part-c/originals/' + asset_id + '.png',
            'originalSize': source_size, 'sourceCrop': crop, 'placement': placement,
            'mode': 'built-in image_gen', 'prompt': record['prompt'], 'references': refs,
        })
    data = {'requested': len(ids), 'generated': len(records), 'missing': missing, 'images': records}
    (DELIVERY / 'prompts.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    cards = []
    for record in records:
        ident = html.escape(record['id'])
        title = html.escape(record['title'])
        section = html.escape(record['section'])
        tags = f"{record['width']} × {record['height']} · {html.escape(record['anchor'])} · " + ('alpha PNG' if record['transparent'] else 'opaque PNG')
        cards.append(f'<article data-search="{ident} {title} {section}"><a class="art" href="../../../intake/{ident}.png"><img loading="lazy" src="../../../intake/{ident}.png" alt="{title}"></a><div class="info"><small>{section}</small><h2>{title}</h2><code>{ident}</code><p>{tags}</p><p><a href="../../../intake/{ident}.png" download>Delivery PNG</a> · <a href="originals/{ident}.png">Original</a></p></div></article>')
    gallery = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Widow’s Bay · Part C image delivery</title>
<style>body{margin:0;background:#2a1424;color:#f3c6dc;font:16px/1.5 system-ui}header,main{max-width:1400px;margin:auto;padding:28px}h1{font:42px Georgia;margin:0 0 12px}a{color:#d9b34a}input{width:min(600px,90%);padding:12px;background:#f4e6d7;border:0;font:inherit;margin-top:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:22px}article{border:1px solid #675044;border-radius:8px;overflow:hidden}.art{height:320px;display:flex;align-items:center;justify-content:center;background-color:#d0c5b8;background-image:conic-gradient(#e7ded2 25%,transparent 0 50%,#e7ded2 0 75%,transparent 0);background-size:24px 24px}.art img{max-width:100%;max-height:100%;object-fit:contain}.info{padding:18px}h2{font:24px Georgia;margin:8px 0}small{color:#d4adb9}code{font-size:13px}p{margin:8px 0}[hidden]{display:none}</style>
<header><h1>Widow’s Bay · Part C</h1><p>COUNT individually generated images: the shared cast, Acts I–V additions, and eight mood boards.</p><p>Production PNGs are sized and anchored for intake; originals and the <a href="prompts.json">complete prompt set</a> are preserved. Checkerboards belong to this preview, not to the PNGs. Game integration is a separate step.</p><label>Find an image<br><input id="search" type="search" placeholder="Try sailor, grotto, court, ending…"></label><p id="count"></p></header><main class="grid">CARDS</main><script>const input=document.querySelector('#search');const cards=[...document.querySelectorAll('article')];function filter(){const q=input.value.toLowerCase();let n=0;for(const c of cards){c.hidden=!c.dataset.search.toLowerCase().includes(q);if(!c.hidden)n++}document.querySelector('#count').textContent=n+' images shown'}input.addEventListener('input',filter);filter();</script></html>'''
    (DELIVERY / 'index.html').write_text(gallery.replace('COUNT', str(len(records))).replace('CARDS', '\n'.join(cards)))
    print(f'Prepared {len(records)}/{len(ids)} images; {len(missing)} pending')


if __name__ == '__main__':
    main()
