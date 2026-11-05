"""Encode the actual browser-rendered Wreck frames into review animations."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path('/tmp/fairies-wreck-swim')
out = root / 'design/generated/wreck-swim-review'
out.mkdir(parents=True, exist_ok=True)
for look in ['original', 'tinted']:
    frames = [Image.open(p).convert('RGB').crop((440, 270, 840, 450)).resize((800, 360), Image.Resampling.LANCZOS)
              for p in sorted((source / look).glob('*.png'))]
    assert len(frames) == 24
    # One palette across both strokes prevents GIF palette flicker.
    palette_source = Image.new('RGB', (800, 720))
    palette_source.paste(frames[0], (0, 0)); palette_source.paste(frames[4], (0, 360))
    palette = palette_source.quantize(colors=256)
    frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    frames[0].save(out / f'wreck-swim-{look}.gif', save_all=True, append_images=frames[1:],
                   duration=125, loop=0, disposal=2, optimize=False)
    print(out / f'wreck-swim-{look}.gif')
