"""Package the transparent cave rock supports without repainting their alpha."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
DELIVERY=ROOT/'design/generated/cavern-platforms'
for row in json.loads((DELIVERY/'generation.json').read_text()):
    image=Image.open(DELIVERY/row['source']).convert('RGBA')
    image=image.crop(row['crop']).resize((720,480),Image.Resampling.LANCZOS)
    image.save(ROOT/'assets'/(row['asset']+'.webp'),lossless=True,method=6)
