# Cover pack: shaded period title edition

Upload these flattened PNGs to CrazyGames:

| Cover | File | Pixels |
| --- | --- | --- |
| Landscape | `cover-landscape-1920x1080.png` | 1920 × 1080 |
| Portrait | `cover-portrait-800x1200.png` | 800 × 1200 |
| Square | `cover-square-800x800.png` | 800 × 800 |

## Masters and layers

`masters/` contains the text-free artwork for every shape. The approved
landscape master is preserved from v9 without changing its image bytes.
Portrait and square artwork were recomposed with the built-in image
generator to retain the rescue scene and leave room for the title.

Each `cover-*.svg` has two named groups/layers: **Text-free artwork** and
**Editable title**. Artwork and font are embedded so the SVG is self-contained
when viewed in a browser. The title is real text, not generated lettering.
The title uses rounded Lobster Two Bold Italic lettering, shaded ivory ink,
a fine warm outline and a subtle plum drop shadow. These are editable SVG
effects, not a generated raster title. The text-free masters are unchanged
from v10.

Install the included `fonts/LobsterTwo-BoldItalic.ttf` if your vector editor
does not use embedded web fonts. Its Open Font License is included.

`title-*.svg` and `title-*.png` contain only the title on a transparent
background, at the matching cover's full dimensions. They can be overlaid
on the matching master in an image editor. Change wording, font size or
placement in the SVG/vector editor rather than repainting the image.

For reproducible exports, edit `layouts.json`, then run from the repository:

```sh
node kingdomofthefairies/design/distribution/crazygames/covers/v11/render.mjs
```

This uses the repository's shared Playwright setup and a local HTTP server.
The renderer verifies title margins and exports at one image pixel per CSS
pixel. Font sizes apply uniformly to each line; no per-letter shrinking or
horizontal text compression is used. The portrait deliberately sets “of
the” smaller between the two principal title words.

Prompts and generation details are recorded in `provenance.json`. Only the
title appears on the exported covers. No game or website source is changed.
