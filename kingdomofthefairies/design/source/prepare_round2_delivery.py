#!/usr/bin/env python3
"""Size built-in image generations for second-round intake; retain originals."""
import argparse
import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps
from prepare_part_c_delivery import fit_sprite

GAME = Path(__file__).resolve().parents[2]
BATCH = GAME / 'design/generated/round-2'
FILL = {'hud-plaque', 'hud-voyage-rope', 'hud-air-tube', 'grotto-ledge',
        'grotto-ledge-wall', 'grotto-shelf', 'grotto-floor', 'court-floor-edge',
        'rib-ledge', 'belly-bank', 'throat-lip', 'belly-floor', 'chain-strip',
        'set-platform-edge', 'cliff-hold', 'cliff-ledge', 'floor-slope'}
LEVEL_CORE = {'grotto-ledge-wall', 'grotto-shelf', 'grotto-floor'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--partial', action='store_true')
    args = parser.parse_args()
    requests = json.loads((BATCH / 'requests.json').read_text())
    records = []
    missing = []
    for job in requests:
        ident = job['id']
        recipe = BATCH / 'records' / (ident + '.json')
        if not recipe.exists():
            missing.append(ident)
            continue
        record = json.loads(recipe.read_text())
        source = Image.open(BATCH / 'originals' / (ident + '.png')).convert('RGBA')
        original_size = list(source.size)
        offset = [0, 0]
        if ident in LEVEL_CORE:
            # Crop the small rounded ends and upper card fringe to the first
            # uninterrupted painted row. No paint or generated alpha changes.
            alpha = source.getchannel('A')
            left, top, right, bottom = alpha.point(lambda v: 255 if v >= 8 else 0).getbbox()
            inset = max(1, round((right-left)*0.02))
            left, right = left+inset, right-inset
            level = next(y for y in range(top, bottom)
                         if alpha.crop((left, y, right, y+1)).getextrema()[0] >= 180)
            source = source.crop((left, level, right, bottom))
            offset = [left, level]
        w, h = record['width'], record['height']
        crop = placement = None
        if record['transparent']:
            if ident == 'wave-crank':
                # Preserve the requested centre axle rather than centring its
                # asymmetric silhouette. Generator leaves padding at left.
                art = ImageOps.contain(source, (w, h), Image.Resampling.LANCZOS)
                final = Image.new('RGBA', (w, h))
                x, y = (w-art.width)//2, (h-art.height)//2
                final.paste(art, (x, y))
                placement = [x, y, art.width, art.height]
            else:
                final, crop, placement = fit_sprite(source, w, h, record['anchor'], ident in FILL)
                if ident in LEVEL_CORE:
                    crop = [crop[0]+offset[0], crop[1]+offset[1],
                            crop[2]+offset[0], crop[3]+offset[1]]
            if ident in FILL and final.getchannel('A').getextrema()[0] > 0:
                # A rectangular strip may fill its cropped painted bounds.
                # Leave one pixel of transparent canvas below its top anchor.
                art = final.resize((w, h-1), Image.Resampling.LANCZOS)
                final = Image.new('RGBA', (w, h))
                final.paste(art, (0, 0))
                placement = [0, 0, w, h-1]
            assert final.getchannel('A').getextrema() == (0, 255), ident
        else:
            assert source.getchannel('A').getextrema() == (255, 255), ident
            final = source.convert('RGB').resize((w, h), Image.Resampling.LANCZOS)
        final.save(GAME / 'intake' / (ident + '.png'), optimize=True)
        record.update(file='intake/'+ident+'.png', original='design/generated/round-2/originals/'+ident+'.png',
                      originalSize=original_size, sourceCrop=crop, placement=placement)
        records.append(record)
    if missing and not args.partial:
        raise SystemExit('Missing: '+', '.join(missing))
    (BATCH / 'prompts.json').write_text(json.dumps(dict(requested=len(requests), generated=len(records), missing=missing, images=records), indent=2)+'\n')
    cards=[]
    for r in records:
        ident=r['id']; title=html.escape(r['title'])
        cards.append(f'<article><a class="art" href="../../../intake/{ident}.png"><img loading="lazy" src="../../../intake/{ident}.png" alt="{title}"></a><div><small>{html.escape(r["section"])}</small><h2>{title}</h2><code>{ident}</code><p>{r["width"]} × {r["height"]} · {html.escape(r["anchor"])}</p><p><a href="../../../intake/{ident}.png" download>Delivery PNG</a> · <a href="originals/{ident}.png">Original</a></p></div></article>')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Widow’s Bay · second art round</title><style>body{margin:0;background:#2a1424;color:#f3c6dc;font:16px/1.5 system-ui}header,main{max-width:1440px;margin:auto;padding:28px}h1,h2{font-family:Georgia}a{color:#d9b34a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}article{border:1px solid #675044;border-radius:8px;overflow:hidden}article div{padding:18px}.art{height:320px;display:flex;align-items:center;justify-content:center;background-color:#d0c5b8;background-image:conic-gradient(#e7ded2 25%,transparent 0 50%,#e7ded2 0 75%,transparent 0);background-size:24px 24px}.art img{max-width:100%;max-height:100%;object-fit:contain}code{font-size:13px}input{padding:10px;font:inherit;width:min(600px,90%)}[hidden]{display:none}</style><header><h1>Widow’s Bay · second art round</h1><p>COUNT individually generated images: stage machinery, HUD, scenery and replacement artwork (C8–C12 and touch-pause).</p><p>Production PNGs are sized in intake, ready for integration. The <a href="prompts.json">complete prompts and reference list</a> and full-size originals are preserved. Checkerboards belong to this preview.</p><p><a href="../../image-requests.md">Image requests</a> · <a href="../part-c/index.html">Earlier Part C</a></p><input id="search" type="search" aria-label="Find an image" placeholder="Find an image…"><p id="count"></p></header><main>CARDS</main><script>const input=document.querySelector('#search'),cards=[...document.querySelectorAll('article')];function filter(){let n=0;for(const card of cards){card.hidden=!card.textContent.toLowerCase().includes(input.value.toLowerCase());if(!card.hidden)n++}document.querySelector('#count').textContent=n+' images shown'}input.addEventListener('input',filter);filter()</script></html>'''
    (BATCH / 'index.html').write_text(page.replace('COUNT',str(len(records))).replace('CARDS','\n'.join(cards)))
    for part in range((len(records)+11)//12):
        sheet=Image.new('RGB',(1400,1050),'#ddd3c6'); draw=ImageDraw.Draw(sheet)
        for i,r in enumerate(records[part*12:(part+1)*12]):
            im=ImageOps.contain(Image.open(GAME/r['file']).convert('RGBA'),(330,300),Image.Resampling.LANCZOS)
            x=(i%4)*350+(350-im.width)//2; y=(i//4)*350+35+(300-im.height)//2
            sheet.paste(im,(x,y),im);draw.text(((i%4)*350+10,(i//4)*350+10),r['id'],fill='#2a1424')
        sheet.save(BATCH / ('review-'+str(part+1)+'.jpg'))
    print(f'Prepared {len(records)}/{len(requests)} images')


if __name__ == '__main__':
    main()
