#!/usr/bin/env python3
"""Prepare and validate the film-planning delivery from saved imagegen originals.

Run after recording generation metadata in references/film-planning/manifest.json.
This validates native originals and builds the gallery without altering artwork.
"""
from pathlib import Path
import html
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'references' / 'film-planning'
manifest = json.loads((FOLDER / 'manifest.json').read_text())
cards = []
for item in manifest['images']:
    image_id = item['id']
    original = FOLDER / 'originals' / (image_id + '.png')
    with Image.open(original) as source:
        source.verify()
    with Image.open(original) as source:
        source = source.convert('RGB')
        item['native_size'] = list(source.size)
        target = source.size
        item['requested_size'] = [2400, 1600] if item['kind'] == 'character' else [2560, 1440]
        item['delivery_size'] = list(target)
        item['file'] = 'originals/' + image_id + '.png'
        item['preview'] = item['file']
        item['original'] = item['file']
    esc = html.escape
    refs = ', '.join(item.get('references', [])) or 'No image references; text brief.'
    cards.append(f'''<article data-kind="{item['kind']}" id="{image_id}">
<a href="{item['file']}"><img loading="lazy" src="{item['preview']}" alt="{esc(item['title'])}"></a>
<div><small>{item['kind']} · {target[0]} × {target[1]}</small><h2>{esc(item['title'])}</h2><code>{image_id}</code>
<p><a href="{item['original']}" download>Native PNG</a></p>
<details><summary>Original request brief and named references</summary><p>{esc(item['generation_prompt'])}</p><p>{esc(refs)}</p></details></div></article>''')
(FOLDER / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(FOLDER / 'index.html').write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kingdom of the Fairies · Film planning artwork</title><style>
*{box-sizing:border-box}body{margin:0;background:#2a1424;color:#f3c6dc;font:16px/1.6 system-ui}header,main{max-width:1600px;margin:auto;padding:28px}h1,h2{font-family:Georgia,serif}h1{font-size:clamp(30px,4vw,52px)}h2{font-size:22px}a{color:#d9b34a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:24px}article{border:1px solid #675044;border-radius:8px;overflow:hidden}article img{display:block;width:100%;height:auto;background:#3a2112}article>div{padding:20px}code,small{font-size:13px}details p{font-size:14px}nav{display:flex;gap:16px;flex-wrap:wrap}button,input{font:inherit;padding:10px;background:#3a2112;color:#f3c6dc;border:1px solid #d9b34a;border-radius:4px}button[aria-pressed=true]{background:#6a2a4a}[hidden]{display:none}</style></head><body>
<header><h1>Kingdom of the Fairies · Film planning artwork</h1><p>Ten character sheets and twenty scene concepts in the existing painted toy-theatre aesthetic. These are planning interpretations for review, separate from the playable game.</p>
<p>Character sheets guided the scene generation. Native originals and original request briefs are retained. Actual dimensions are shown on each card; the larger requested dimensions remain production targets. Images load lazily to keep the gallery manageable.</p>
<p><a href="../../image-requests.md">Image requests</a> · <a href="../../film-adaptation.md">Adaptation plan</a> · <a href="manifest.json">Delivery manifest</a></p>
<nav aria-label="Filter artwork"><button data-kind="all" aria-pressed="true">All 30</button><button data-kind="character" aria-pressed="false">Characters</button><button data-kind="scene" aria-pressed="false">Scenes</button><input id="search" type="search" aria-label="Find artwork" placeholder="Find a character or scene"></nav><p id="count" aria-live="polite"></p></header><main>''' + '\n'.join(cards) + '''</main><script>
let kind='all';const cards=[...document.querySelectorAll('article')],search=document.querySelector('#search');function filter(){let count=0;for(const card of cards){card.hidden=(kind!=='all'&&card.dataset.kind!==kind)||!card.textContent.toLowerCase().includes(search.value.toLowerCase());if(!card.hidden)count++}document.querySelector('#count').textContent=count+' images shown'}for(const button of document.querySelectorAll('button[data-kind]'))button.addEventListener('click',()=>{kind=button.dataset.kind;for(const b of document.querySelectorAll('button[data-kind]'))b.setAttribute('aria-pressed',String(b===button));filter()});search.addEventListener('input',filter);filter();</script></body></html>''')
expected = {item['id'] for item in manifest['images']}
assert len(expected) == 30, 'All thirty planning requests must be delivered.'
assert sum(item['kind'] == 'character' for item in manifest['images']) == 10
for item in manifest['images']:
    for field in ['file', 'preview', 'original']:
        assert (FOLDER / item[field]).is_file(), item[field]
    with Image.open(FOLDER / item['file']) as image:
        assert list(image.size) == item['delivery_size']
print('Prepared and validated all 30 planning images and gallery links.')
