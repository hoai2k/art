"""Resize and register delivered surface strokes without repainting their alpha.

The reviewed neck point maps to (234, 96) in every 360x240 frame; native
sources and exact prompts remain in design/generated/surface-swim/.
"""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'design/generated/surface-swim/source'
SCALE=.22
for frame in ('a','b'):
    for look, neck_y in (('',445),('-tinted',405)):
        aid=f'prince-swim-surface-{frame}{look}'
        if frame=='b' and look: neck_y=445
        image=Image.open(SOURCE/(aid+'.png')).convert('RGBA')
        scaled=image.resize(tuple(round(d*SCALE) for d in image.size),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(360,240))
        canvas.alpha_composite(scaled,(round(234-1050*SCALE),round(96-neck_y*SCALE)))
        canvas.save(ROOT/'assets'/(aid+'.webp'),lossless=True,method=6)
