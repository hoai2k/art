"""Package the paired setting-down poses, anchored on Azurine's feet."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
# The foot centre is reviewed on each native cutout; the prince kneels right.
for look, foot in (('',.35),('-tinted',.38)):
    aid='prince-set-down'+look
    image=Image.open(ROOT/'design/generated/battle-entrance/source'/f'{aid}.png').convert('RGBA')
    bounds=image.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
    image=image.crop(bounds)
    image.thumbnail((400,440),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(600,440))
    canvas.alpha_composite(image,(300-round(image.width*foot),440-image.height))
    canvas.save(ROOT/'assets'/f'{aid}.webp',lossless=True,method=6)
