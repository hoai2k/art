"""Trim alpha margins and resize the generated breach; preserve painted pixels."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
image=Image.open(ROOT/'design/generated/tower-floor-breach/source.png').convert('RGBA')
bounds=image.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
image=image.crop(bounds)
image=image.resize((600,round(image.height*600/image.width)),Image.Resampling.LANCZOS)
image.save(ROOT/'assets/tower-floor-breach.webp',lossless=True,method=6)
print('Prepared tower-floor-breach:',image.size,'from alpha bounds',bounds)
