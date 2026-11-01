"""Package the generated open arch, preserving its alpha and painted shadow."""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
image=Image.open(ROOT/'design/generated/tower-escape/source.png').convert('RGBA')
bounds=image.getchannel('A').point(lambda v:255 if v>40 else 0).getbbox()
image=image.crop(bounds)
image.thumbnail((160,250),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(160,250))
canvas.alpha_composite(image,((160-image.width)//2,250-image.height))
canvas.save(ROOT/'assets/tower-escape-door.webp',lossless=True,method=6)
