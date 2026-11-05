"""Prepare native-alpha image_gen wedding gifts; retain the original PNGs."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / 'design/generated/finale-gifts'
gifts = json.loads((DELIVERY / 'prompts.json').read_text())['gifts']
sheet = Image.new('RGB', (1000, 1000), '#e8dfcc')
draw = ImageDraw.Draw(sheet)
audit = []
manifest_path = ROOT / 'assets/manifest.json'
manifest = json.loads(manifest_path.read_text())
for i, gift in enumerate(gifts):
    ident = 'wedding-gift-' + gift['id']
    source = DELIVERY / 'source' / (ident + '.png')
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    assert alpha.getextrema() == (0, 255), f'{ident}: missing native transparency'
    bbox = alpha.getbbox()
    assert bbox, f'{ident}: empty'
    cropped = image.crop(bbox)
    cropped.thumbnail((292, 292), Image.Resampling.LANCZOS)
    sprite = Image.new('RGBA', (320, 320))
    sprite.alpha_composite(cropped, ((320 - cropped.width) // 2, 308 - cropped.height))
    sprite.save(ROOT / 'assets' / (ident + '.webp'), quality=90, method=6)
    manifest['slots'][ident] = {'status': 'delivered', 'file': ident + '.webp'}
    preview = sprite.resize((176, 176), Image.Resampling.LANCZOS)
    x, y = (i % 5) * 200 + 12, (i // 5) * 250 + 12
    sheet.paste(preview, (x, y), preview)
    draw.text((x, y + 184), gift['name'], fill='#382d38')
    audit.append({'id': ident, 'sourceSize': image.size, 'alphaRange': alpha.getextrema(),
                  'sourceBounds': bbox, 'deliveredSize': sprite.size})
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
(DELIVERY / 'audit.json').write_text(json.dumps(audit, indent=2) + '\n')
sheet.save(DELIVERY / 'contact-sheet.png')
print(f'Prepared {len(gifts)} transparent wedding gifts')
