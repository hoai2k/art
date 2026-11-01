"""Package generated transparent stair poses without redrawing or recolouring."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
for who, width in (("prince-court", 320), ("azurine", 300)):
    for frame in ("a", "b"):
        for look in ("", "-tinted"):
            aid = f"{who}-stairs-{frame}{look}"
            image = Image.open(ROOT / "design/generated/wedding-freeplay/source" / f"{aid}.png").convert("RGBA")
            bounds = image.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
            image = image.crop(bounds)
            image.thumbnail((width, 440), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (width, 440))
            canvas.alpha_composite(image, ((width-image.width)//2, 440-image.height))
            canvas.save(ROOT / "assets" / f"{aid}.webp", lossless=True, method=6)
