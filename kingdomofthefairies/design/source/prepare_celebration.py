"""Package the generated transparent Azurine poses; never redraw or matte them."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
for suffix in ('', '-tinted'):
    aid = 'azurine-jump' + suffix
    image = Image.open(ROOT / 'design/generated/barrel-defiance/source' / f'{aid}-v2.png').convert('RGBA')
    bounds = image.getchannel('A').point(lambda value: 255 if value > 40 else 0).getbbox()
    image = image.crop(bounds)
    image.thumbnail((300, 500), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (300, 500))
    canvas.alpha_composite(image, ((300 - image.width) // 2, 500 - image.height))
    canvas.save(ROOT / 'assets' / f'{aid}.webp', lossless=True, method=6)
