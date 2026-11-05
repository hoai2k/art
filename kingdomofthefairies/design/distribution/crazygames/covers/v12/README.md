# Cover pack: generated calligraphic title

Upload `cover-landscape-1920x1080.png`, `cover-portrait-800x1200.png` and
`cover-square-800x800.png` separately in the portal.

`masters/` preserves the text-free artwork unchanged. `title-alpha-master.png`
is generated cream calligraphy with native alpha, matching the original cover
style. The title is a movable raster layer, not editable font text.

Each self-contained `cover-*.svg` embeds the artwork and title separately,
with the drop shadow applied as an editable SVG effect. `title-*.svg` and
the matching full-size `title-*.png` contain only the lettering and shadow
on transparency. Placement and scale are set in `layouts.json`.

Regenerate the exports from the repository root:

```sh
node kingdomofthefairies/design/distribution/crazygames/covers/v12/render.mjs
```

The renderer checks usable native alpha before export. All letters scale
together; no letters are individually squeezed or shrunk. `provenance.json`
records the generation prompt and compositing approach. Earlier iterations
remain alongside this directory.
