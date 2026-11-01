"""Package matched gesture frames with an invariant barrel base and width."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[2]
W, H = 400, 360
manifest = json.loads((ROOT / 'assets/manifest.json').read_text())
for look in ('', '-tinted'):
    frames = []
    for pose in ('a', 'b'):
        aid = f'witch-barrel-anger-{pose}{look}'
        image = Image.open(ROOT / 'design/generated/barrel-defiance/source' / f'{aid}.png').convert('RGBA')
        mask = image.getchannel('A').point(lambda value: 255 if value > 40 else 0)
        bounds = mask.getbbox()
        # The lower 28% contains only the barrel, never the gesturing arms.
        band = mask.crop((0, int(bounds[3] * .72), image.width, bounds[3])).getbbox()
        centre, width = (band[0] + band[2]) / 2, band[2] - band[0]
        frames.append((aid, image, bounds, centre, width))
    reference_width = frames[0][-1]
    left = right = height = 0
    for _, _, box, centre, width in frames:
        ratio = reference_width / width
        left = max(left, (centre - box[0]) * ratio)
        right = max(right, (box[2] - centre) * ratio)
        height = max(height, (box[3] - box[1]) * ratio)
    fit = min((W / 2 - 1) / max(left, right), H / height)
    for aid, image, box, centre, width in frames:
        scale = fit * reference_width / width
        figure = image.crop(box)
        figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (W, H))
        canvas.alpha_composite(figure, (round(W / 2 + (box[0] - centre) * scale), H - figure.height))
        canvas.save(ROOT / 'assets' / f'{aid}.webp', lossless=True, method=6)
        manifest['slots'][aid] = {'status': 'delivered', 'file': f'{aid}.webp', 'size': [W, H], 'anchor': 'bottom centre', 'edition': 'film'}
(ROOT / 'assets/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
