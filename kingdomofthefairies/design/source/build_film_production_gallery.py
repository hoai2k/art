#!/usr/bin/env python3
"""Build a light, searchable gallery from validated production deliveries."""
from pathlib import Path
import html
import json

GAME = Path(__file__).resolve().parents[2]
BATCH = GAME / 'design/generated/film-production'
records = json.loads((BATCH / 'deliveries.json').read_text())['images']
cards = []
for record in records:
    ident = record['id']
    title = html.escape(record['title'])
    replacement = html.escape(record.get('superseded_by', ''))
    superseded = f'<p>Superseded by <a href="#{replacement}">{replacement}</a>; earlier artwork retained.</p>' if replacement else ''
    assert (GAME / record['file']).exists(), ident
    assert (BATCH / (ident + '-original.png')).exists(), ident
    cards.append(f'''<article id="{ident}"><a href="../../../{record['file']}"><img loading="lazy" src="../../../{record['file']}" alt="{title}"></a><div><h2>{title}</h2><code>{ident}</code><p>{record['size'][0]} × {record['size'][1]} · {html.escape(record['anchor'])}</p><p><a href="{ident}-original.png">Native original</a> · <a href="{ident}.json">Generation record</a></p>{superseded}<details><summary>Submitted prompt</summary><p>{html.escape(record['prompt'])}</p></details></div></article>''')
(BATCH / 'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kingdom of the Fairies · Production art</title><style>*{box-sizing:border-box}body{margin:0;background:#2a1424;color:#f3c6dc;font:16px/1.6 system-ui}header,main{max-width:1500px;margin:auto;padding:24px}h1,h2{font-family:Georgia,serif}a{color:#d9b34a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px}article{border:1px solid #675044;border-radius:8px;overflow:hidden}article img{display:block;width:100%;height:240px;object-fit:contain;background:#3a2112}article>div{padding:16px}h2{font-size:22px}details p{font-size:14px}input{font:inherit;padding:10px;max-width:100%;background:#3a2112;color:#f3c6dc;border:1px solid #d9b34a}[hidden]{display:none}</style></head><body><header><h1>Kingdom of the Fairies · Production art</h1><p>Prepared film-edition assets with unchanged native originals and submitted prompts. Legacy artwork is retained. Delivery does not implement new story chapters.</p><p><a href="../../image-requests.md">Requests and delivery status</a> · <a href="README.md">Delivery notes</a> · <a href="deliveries.json">Manifest</a></p><input id="search" type="search" aria-label="Find artwork" placeholder="Find a sprite, prop or set"><p id="count" aria-live="polite"></p></header><main>''' + '\n'.join(cards) + '''</main><script>const search=document.querySelector('#search'),cards=[...document.querySelectorAll('article')];function filter(){let n=0;for(const card of cards){card.hidden=!card.textContent.toLowerCase().includes(search.value.toLowerCase());if(!card.hidden)n++}document.querySelector('#count').textContent=n+' images shown'}search.addEventListener('input',filter);filter();</script></body></html>''')
print('Gallery file targets verified:', len(records), 'images.')
