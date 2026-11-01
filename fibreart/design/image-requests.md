# Fibre Art: image requests

Artwork for Fibre Art, the shifting collage in `fibreart/` (see [`design.md`](design.md)). Generated from `source/build_requests.py`; edit the data there and rerun it, which also rewrites `asset-list.json`.

## How to use this list

1. Each prompt is complete on its own: paste it as it stands. The shared style text is already in every prompt.
2. **Give the generator the reference photos.** Every request names photos of Hanneke's own work in `fibreart/reference/`, and its prompt links to them. Attach them where the generator takes images: they matter more than the words.
3. **Composition first.** Each scene has three requests. Make the composition (`-A`) first and settle it: it is a finished picture in its own right, and the reference for the rest. Then make the ground (`-B`) and the pieces (`-C`) with the composition attached, so the pieces match it in shape, colour and scale. If a piece drifts from the composition, regenerate the piece, not the composition.
4. Save each image under the file name in its **File** line and drop it in `fibreart/intake/`. On integration it moves to that path under `fibreart/game/`, its status flips to `delivered`, and the pieces on a sheet are cut apart and named in the order the prompt lists them.
5. Transparent images are `.png`. If the generator cannot produce alpha, use a flat pure magenta `#FF00FF` background as the prompts say; it is keyed out on integration. Opaque images are listed as `.webp`; PNG or JPEG is fine too.
6. If a generator struggles with a whole sheet, split it: the first half of the list and the second half as two images, saved as `pieces-1.png` and `pieces-2.png`, each in the same order and at the same scale.
7. Nothing here blocks a prototype: until an image arrives the game cuts a stand-in from the reference photos, or draws noise for the masks and textures.
8. Order of work: a few compositions first (Viriditas, Moons and hearts, The Golden Lady are enough to test the idea), then their grounds and pieces, then the morph chains, then the rest. The textures and masks can come any time.

## Status

0 requested, 62 delivered, 62 in total.

## Brand and interface

The title, the icon, and the pieces of the interface drawn in her line.

### HK-U01 · Title

- **File:** `fibreart/game/assets/ui/logo.png`
- **Size:** 1600 x 700, transparent
- **Used for:** The title screen above Press Start, and the card on the game library page.
- **Stand-in until delivered:** The title set in a hand-drawn style in code.
- **Reference:** [`watercolor-face-with-handwriting.jpg`](../reference/mixed-media/watercolor-face-with-handwriting.jpg), [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Status:** delivered

```text
A title for a game, spelled exactly "Fibre Art", written in one flowing line of dark red thread as if stitched into cloth, the loops of the letters like her looping handwriting, with a few loose thread ends. Beneath the words, a short row of small cut-cloth motifs sewn on with running stitch: a pale yellow crescent moon with a sleeping face, a red heart, a teal tree, a violet sun. Wide landscape composition filling about 85% of the width, no other text. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-face-with-handwriting.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-U02 · App icon and favicon

- **File:** `fibreart/game/assets/ui/icon.png`
- **Size:** 1024 x 1024, transparent
- **Used for:** Browser tab and home-screen icon (scaled to 512, 192 and 180 px).
- **Stand-in until delivered:** A drawn crescent moon on an indigo tile.
- **Attach:** [`moon.png`](../game/assets/chains/moon.png), [`indigo-batik.webp`](../game/assets/textures/indigo-batik.webp)
- **Note:** Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. App icon: a pale yellow crescent moon with a sleeping face, cut from cloth and sewn with visible stitches onto a rounded-square tile of deep indigo batik, a small red heart tucked in the crescent's curve, a running stitch in bright blue around the tile's edge. Bold and simple, readable at 48 px; the moon fills about 70% of the tile. Transparent corners outside the rounded square (PNG with alpha), or flat magenta #FF00FF corners if transparency is not possible. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/chains/moon.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/textures/indigo-batik.webp .
```

### HK-U03 · Line drawings for the interface

- **File:** `fibreart/game/assets/ui/line-drawings.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Menus, the instructions, the bindings card and the little drawings pinned beside a piece when a control is found.
- **Stand-in until delivered:** Plain vector strokes.
- **Reference:** [`drawing-embrace-with-boots.jpg`](../reference/mixed-media/drawing-embrace-with-boots.jpg), [`painting-embrace-in-blue.jpg`](../reference/paintings/painting-embrace-in-blue.jpg), [`watercolor-woman-at-window.jpg`](../reference/mixed-media/watercolor-woman-at-window.jpg)
- **Status:** delivered

```text
A sheet of small line drawings in the style of Hanneke de Neve's pen drawings: each one a single fluid, unbroken dark brown-black ink line, drawn fast with a fine pen, no shading and no colour fill. Lay them out in a grid of 4 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The drawings, in order: 1. A woman's face with closed eyes, an oval head on a long neck. 2. A woman's face with open almond eyes, looking out. 3. Two figures embracing. 4. A figure seen from behind at a window, arms open. 5. A hand reaching, fingers open. 6. A hand holding a needle with a loose thread. 7. A crescent moon with a sleeping face. 8. A heart with a small crown drawn inside. 9. A bare tree. 10. A bird in flight. 11. A pair of felt boots. 12. A spool of thread. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/drawing-embrace-with-boots.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-embrace-in-blue.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-woman-at-window.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-U04 · Stitches and threads

- **File:** `fibreart/game/assets/ui/threads.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Threads drawn along splines in the game: the outline round a found control's target, the threads that link pieces, trails behind moving pieces, menu dividers.
- **Stand-in until delivered:** Dashed strokes drawn in code.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg), [`fibercollage-netting-and-pink-silk.jpg`](../reference/fibre/fibercollage-netting-and-pink-silk.jpg), [`tapestry-10-figure-sun-and-bird.jpg`](../reference/fibre/tapestry-10-figure-sun-and-bird.jpg)
- **Status:** delivered

```text
A sheet of real sewing thread and stitches photographed flat, for a game that cuts each one out and bends it along a path. Each item lies in a perfectly straight horizontal line across almost the full width of the sheet, one above the other with wide gaps, nothing touching. In order from top to bottom: 1. A running stitch in white cotton thread, even dashes as if sewn through cloth that is not there. 2. A running stitch in bright blue thread. 3. A machine zigzag stitch in orange thread. 4. A couched gold thread, a thick gold cord held down by tiny cross stitches. 5. A loose length of red embroidery thread, lying straight, slightly twisted. 6. A length of white thread with a frayed end on the right. 7. A narrow ribbon of rose silk, lying straight and flat. 8. A narrow ribbon of turquoise satin, lying straight and flat. Even soft light, no shadows. Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-U06 · Pause menu pictures

- **File:** `fibreart/game/assets/ui/pause-icons.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** The pause menu's buttons, which are pictures with no words, and the close button of every panel.
- **Stand-in until delivered:** Simple line icons drawn in code.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg), [`tapestry-man-and-woman.jpg`](../reference/fibre/tapestry-man-and-woman.jpg)
- **Note:** Attach HK-U02 (assets/ui/icon.png) and HK-U03 (assets/ui/line-drawings.png) so the badges match the icon and the line.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of eight round appliqué badges for a game's pause menu, each one a circle of cream linen with a dashed red running stitch round its edge, and on it one simple motif cut from cloth and sewn on, bold and readable at 80 px, centred, filling about two thirds of the badge. All eight the same size, the same cream linen and the same stitched border, so they read as one set. Lay them out in a grid of 4 columns and 2 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The motifs, in order: 1. A play triangle pointing right, cut from saffron silk (resume). 2. An open hand of pale yellow cloth, palm up, with short loose threads running from its fingertips (the controls you have found). 3. A single wide-open eye of cream and blue cloth, its lashes stitched in dark thread (a hint: look closely). 4. An open book whose pages are pieces of cloth, with lines of running stitch for writing (how to play). 5. A wooden spool wound with red thread, a needle stuck through it (settings). 6. A small square quilt block in indigo and red with a stitched arrow pointing right (the next picture). 7. A little peaked house of patchwork with a red roof (back to the title). 8. Two dressmaker's pins crossed in an X (close). No words or letters anywhere. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-man-and-woman.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-U07 · Fullscreen badge

- **File:** `fibreart/game/assets/ui/fullscreen-badge.png`
- **Size:** 512 x 512, transparent
- **Used for:** The fullscreen button in the bottom right of the title screen, beside the How to play and Settings badges from HK-U06.
- **Stand-in until delivered:** A cream cloth circle with a drawn four-corner frame.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Note:** Attach HK-U06 (assets/ui/pause-icons.png) and match its badges exactly: the same cream linen, the same dashed red running stitch border, the same size and light.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. One round appliqué badge, matching the attached set of pause menu badges exactly (the same circle of cream linen, the same dashed red running stitch round its edge, the same size, lighting and style), for a game's fullscreen button. On it, a small rectangle of patterned cotton (a little picture, like a window) with four bold corner brackets of deep red felt sewn just outside its corners, each bracket an L pointing outward, as if the picture is growing to fill the frame. It must read plainly as fullscreen even at 48 px: bold shapes, strong contrast against the cream. No words, no letters. Centred, nothing else on the badge. Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-U05 · Line drawings of the controls

- **File:** `fibreart/game/assets/ui/control-drawings.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** The small drawing pinned beside a piece when a control is found, and the card of controls found.
- **Stand-in until delivered:** The hand, spool and needle from the line drawings (HK-U03).
- **Reference:** [`drawing-embrace-with-boots.jpg`](../reference/mixed-media/drawing-embrace-with-boots.jpg)
- **Note:** Attach HK-U03 (assets/ui/line-drawings.png) so the line matches.
- **Status:** delivered

```text
A sheet of small line drawings in the same hand as the attached sheet of line drawings: each one a single fluid, unbroken dark brown-black ink line, drawn fast with a fine pen, no shading and no colour fill, slightly wobbly and human, never mechanical. Lay them out in a grid of 4 columns and 2 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The drawings, in order: 1. A thumbstick seen from above at an angle, a round cap on a short stem, with a curved arrow circling it. 2. A trigger seen from the side, a curved paddle being pressed by one fingertip. 3. A single round button being pressed by a fingertip, small lines radiating from it. 4. A long rounded shoulder button pressed by a fingertip. 5. A cross-shaped D-pad seen from above, one arm pressed. 6. A hand holding a game controller loosely, seen from above, drawn in one line. 7. Two hands each holding a controller, side by side. 8. A thread running from a controller to a small crescent moon, as if the controller pulls the moon on a string. No letters or symbols on the controls. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/drawing-embrace-with-boots.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

## Tableaux

Each scene has three requests: the **composition** (`-A`), the full picture, which is the reference for the other two and the scene's resting state; the **ground** (`-B`), the same picture with the moving pieces taken out; and the **pieces** (`-C`), those pieces cut out on one transparent sheet. Make the composition first, then the ground and the pieces with it attached.

### HK-T01-A · Viriditas: composition

- **File:** `fibreart/game/assets/tableaux/viriditas/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 1, after her painting Viriditas: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`viriditas.jpg`](../reference/paintings/viriditas.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A dense wood of slender trees under a dark sky, after her painting Viriditas (Hildegard of Bingen's word for the greening life force). Acid yellow and yellow-green light fills the spaces between thin, wavering teal and bottle-green trunks; clusters of small red-orange berries and buds hang from the branches; a large violet disc, a sun or moon, glows behind the trees; the sky at the top is deep purple and indigo with swirling darker strokes; olive and ochre undergrowth along the bottom, with a few orange marks like fallen leaves. Painted on silk with stitched lines along some of the trunks. The motifs that will move: the large violet sun disc; the tallest teal tree, trunk and branches, from the ground to the top; a second slender teal tree, leaning left; a third slender tree, bottle green, forked near the top; a short young tree with a few buds; a cluster of red-orange berries, large; a cluster of red-orange berries, medium; a cluster of red-orange berries, small; a single dark green bud on a curved stem; a swirl of dark purple sky, cut out like a cloud; a small bird of stitched teal silk among the branches; a patch of orange fallen leaves. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg .
```

### HK-T01-B · Viriditas: ground

- **File:** `fibreart/game/assets/tableaux/viriditas/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 1: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Attach:** [`composition.webp`](../game/assets/tableaux/viriditas/composition.webp)
- **Note:** Attach HK-T01-A when generating. What stays: the sky, the yellow-green light between the trees, the undergrowth. Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T01-A (file assets/tableaux/viriditas/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the large violet sun disc; the tallest teal tree, trunk and branches, from the ground to the top; a second slender teal tree, leaning left; a third slender tree, bottle green, forked near the top; a short young tree with a few buds; a cluster of red-orange berries, large; a cluster of red-orange berries, medium; a cluster of red-orange berries, small; a single dark green bud on a curved stem; a swirl of dark purple sky, cut out like a cloud; a small bird of stitched teal silk among the branches; a patch of orange fallen leaves. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/viriditas/composition.webp .
```

### HK-T01-C · Viriditas: pieces

- **File:** `fibreart/game/assets/tableaux/viriditas/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 1: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`viriditas.jpg`](../reference/paintings/viriditas.jpg)
- **Note:** Attach HK-T01-A when generating. 12 pieces in a 4 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T01-A (file assets/tableaux/viriditas/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 4 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The large violet sun disc. 2. The tallest teal tree, trunk and branches, from the ground to the top. 3. A second slender teal tree, leaning left. 4. A third slender tree, bottle green, forked near the top. 5. A short young tree with a few buds. 6. A cluster of red-orange berries, large. 7. A cluster of red-orange berries, medium. 8. A cluster of red-orange berries, small. 9. A single dark green bud on a curved stem. 10. A swirl of dark purple sky, cut out like a cloud. 11. A small bird of stitched teal silk among the branches. 12. A patch of orange fallen leaves. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T02-A · Moons and hearts: composition

- **File:** `fibreart/game/assets/tableaux/night-quilt/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 2, after her fibercollage of moons and hearts: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A night quilt of patchwork blocks, after her fibercollage of moons and hearts: deep indigo and black blocks bordered by red and orange batik and printed cotton, stitched together with bright blue running stitch and zigzag. On the dark blocks: a pale yellow crescent moon with a sleeping face, a round pale yellow moon with a sleeping face in profile, and two red velvet hearts, each embroidered with a small white crown-like pattern. A pale yellow stitched hand reaches toward the lower heart. A few small batik flowers in red and yellow. The motifs that will move: the crescent moon with the sleeping face; the round moon with the sleeping face in profile; the upper red heart with its white embroidery; the lower red heart with its white embroidery; the pale yellow stitched hand; a cluster of small red and yellow batik flowers; one indigo block from the middle of the quilt, as a square of cloth with its stitched edge; a strip of red and orange batik border; a small white batik star. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg .
```

### HK-T02-B · Moons and hearts: ground

- **File:** `fibreart/game/assets/tableaux/night-quilt/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 2: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Note:** Attach HK-T02-A when generating. What stays: the patchwork of blocks and batik borders, the blue stitching between them.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T02-A (file assets/tableaux/night-quilt/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the crescent moon with the sleeping face; the round moon with the sleeping face in profile; the upper red heart with its white embroidery; the lower red heart with its white embroidery; the pale yellow stitched hand; a cluster of small red and yellow batik flowers; one indigo block from the middle of the quilt, as a square of cloth with its stitched edge; a strip of red and orange batik border; a small white batik star. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg .
```

### HK-T02-C · Moons and hearts: pieces

- **File:** `fibreart/game/assets/tableaux/night-quilt/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 2: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Attach:** [`composition.webp`](../game/assets/tableaux/night-quilt/composition.webp)
- **Note:** Attach HK-T02-A when generating. 9 pieces in a 3 x 3 grid. Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T02-A (file assets/tableaux/night-quilt/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The crescent moon with the sleeping face. 2. The round moon with the sleeping face in profile. 3. The upper red heart with its white embroidery. 4. The lower red heart with its white embroidery. 5. The pale yellow stitched hand. 6. A cluster of small red and yellow batik flowers. 7. One indigo block from the middle of the quilt, as a square of cloth with its stitched edge. 8. A strip of red and orange batik border. 9. A small white batik star. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/night-quilt/composition.webp . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T03-A · The Golden Lady: composition

- **File:** `fibreart/game/assets/tableaux/golden-lady/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 3, after her painting The Golden Lady: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`the-golden-lady-acrylic-on-silk-2016.jpg`](../reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg), [`the-golden-lady-detail-face.jpg`](../reference/paintings/the-golden-lady-detail-face.jpg), [`the-golden-lady-detail-dress.jpg`](../reference/paintings/the-golden-lady-detail-dress.jpg), [`the-golden-lady-detail-sky.jpg`](../reference/paintings/the-golden-lady-detail-sky.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A young woman from the waist up, after her painting The Golden Lady, acrylic on silk: short orange-gold hair, a pale oval face with dark almond eyes and a small mouth, a long neck, a saffron-yellow dress with a V neck and loose sleeves, one hand on her hip. She stands a little left of centre, so the picture is wider than the original. Behind her a green field runs to a low horizon, a slim tree stands at the left edge, and the sky is soft lilac, pink and sky blue with tall smoky grey-violet and blue clouds rising on the right. Loose, wet brushwork; brown contour lines over the colour. The motifs that will move: her head and neck, without the hair; her orange-gold hair, as one piece; her body in the saffron dress, from the shoulders to the waist, with the arm on her hip; the slim tree at the left edge; the tallest smoky grey-violet cloud; a blue cloud; a pink cloud; a small pale sun low in the sky. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-face.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-dress.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-sky.jpg .
```

### HK-T03-B · The Golden Lady: ground

- **File:** `fibreart/game/assets/tableaux/golden-lady/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 3: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`the-golden-lady-acrylic-on-silk-2016.jpg`](../reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg), [`the-golden-lady-detail-face.jpg`](../reference/paintings/the-golden-lady-detail-face.jpg), [`the-golden-lady-detail-dress.jpg`](../reference/paintings/the-golden-lady-detail-dress.jpg), [`the-golden-lady-detail-sky.jpg`](../reference/paintings/the-golden-lady-detail-sky.jpg)
- **Note:** Attach HK-T03-A when generating. What stays: the field, the horizon, the pale sky.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T03-A (file assets/tableaux/golden-lady/composition.webp), at exactly the same framing and scale, but with these motifs taken out: her head and neck, without the hair; her orange-gold hair, as one piece; her body in the saffron dress, from the shoulders to the waist, with the arm on her hip; the slim tree at the left edge; the tallest smoky grey-violet cloud; a blue cloud; a pink cloud; a small pale sun low in the sky. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-face.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-dress.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-sky.jpg .
```

### HK-T03-C · The Golden Lady: pieces

- **File:** `fibreart/game/assets/tableaux/golden-lady/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 3: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`the-golden-lady-acrylic-on-silk-2016.jpg`](../reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg), [`the-golden-lady-detail-face.jpg`](../reference/paintings/the-golden-lady-detail-face.jpg), [`the-golden-lady-detail-dress.jpg`](../reference/paintings/the-golden-lady-detail-dress.jpg), [`the-golden-lady-detail-sky.jpg`](../reference/paintings/the-golden-lady-detail-sky.jpg)
- **Note:** Attach HK-T03-A when generating. 8 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T03-A (file assets/tableaux/golden-lady/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. Her head and neck, without the hair. 2. Her orange-gold hair, as one piece. 3. Her body in the saffron dress, from the shoulders to the waist, with the arm on her hip. 4. The slim tree at the left edge. 5. The tallest smoky grey-violet cloud. 6. A blue cloud. 7. A pink cloud. 8. A small pale sun low in the sky. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-acrylic-on-silk-2016.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-face.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-dress.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-sky.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T04-A · The black tree: composition

- **File:** `fibreart/game/assets/tableaux/black-tree/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 4, after her fibercollage of a black tree and faces: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`fibercollage-black-tree-and-faces.jpg`](../reference/fibre/fibercollage-black-tree-and-faces.jpg), [`collage-faces-tree-and-houses.jpg`](../reference/mixed-media/collage-faces-tree-and-houses.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A wide fibercollage after her black tree and faces: a rust-red and cream patchwork ground, a large black appliqué tree with bare, curving branches and a few big leaf shapes in black, ochre and cream, three women's faces cut from cream and white cloth with dark drawn features (one with long dark hair, one pale with closed eyes, one dark-skinned with a gold mask-like look), a band of black and white piano-key stripes across the top, harlequin diamonds in red and cream on the right, and a small row of Dutch gabled houses. The motifs that will move: the black tree, trunk and branches; a large black leaf; a large ochre leaf; a cream leaf; the face with long dark hair; the pale face with closed eyes; the dark face with the gold mask-like look; the row of small gabled houses; a single red and cream harlequin diamond. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-black-tree-and-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/collage-faces-tree-and-houses.jpg .
```

### HK-T04-B · The black tree: ground

- **File:** `fibreart/game/assets/tableaux/black-tree/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 4: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`fibercollage-black-tree-and-faces.jpg`](../reference/fibre/fibercollage-black-tree-and-faces.jpg), [`collage-faces-tree-and-houses.jpg`](../reference/mixed-media/collage-faces-tree-and-houses.jpg)
- **Note:** Attach HK-T04-A when generating. What stays: the rust and cream patchwork, the piano-key band, the harlequin diamonds.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T04-A (file assets/tableaux/black-tree/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the black tree, trunk and branches; a large black leaf; a large ochre leaf; a cream leaf; the face with long dark hair; the pale face with closed eyes; the dark face with the gold mask-like look; the row of small gabled houses; a single red and cream harlequin diamond. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-black-tree-and-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/collage-faces-tree-and-houses.jpg .
```

### HK-T04-C · The black tree: pieces

- **File:** `fibreart/game/assets/tableaux/black-tree/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 4: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`fibercollage-black-tree-and-faces.jpg`](../reference/fibre/fibercollage-black-tree-and-faces.jpg), [`collage-faces-tree-and-houses.jpg`](../reference/mixed-media/collage-faces-tree-and-houses.jpg)
- **Note:** Attach HK-T04-A when generating. 9 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T04-A (file assets/tableaux/black-tree/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The black tree, trunk and branches. 2. A large black leaf. 3. A large ochre leaf. 4. A cream leaf. 5. The face with long dark hair. 6. The pale face with closed eyes. 7. The dark face with the gold mask-like look. 8. The row of small gabled houses. 9. A single red and cream harlequin diamond. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-black-tree-and-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/collage-faces-tree-and-houses.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T05-A · Two moons over lace mountains: composition

- **File:** `fibreart/game/assets/tableaux/two-moons/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 5, after her quilt of two moons bound in blue satin: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg), [`tapestry-10-figure-sun-and-bird.jpg`](../reference/fibre/tapestry-10-figure-sun-and-bird.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A quilt after her two moons bound in blue satin: a range of pointed mountains pieced from white lace and pale floral prints with violet and rose, under a night sky of indigo and navy, with a band of pale yellow and sky-blue stripes sweeping across the top like a comet's trail. Two large pale moons of white and silver cloth hang above the peaks, and a golden crescent of couched gold thread hangs between them. The whole quilt is bound in shiny turquoise satin. The motifs that will move: the left pale moon; the right pale moon; the golden crescent of couched thread; the lace mountain range, as one long piece; the striped band of pale yellow and sky blue; a single small lace peak, separate from the range; a small silver star. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-10-figure-sun-and-bird.jpg .
```

### HK-T05-B · Two moons over lace mountains: ground

- **File:** `fibreart/game/assets/tableaux/two-moons/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 5: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg), [`tapestry-10-figure-sun-and-bird.jpg`](../reference/fibre/tapestry-10-figure-sun-and-bird.jpg)
- **Note:** Attach HK-T05-A when generating. What stays: the night sky, the turquoise satin binding.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T05-A (file assets/tableaux/two-moons/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the left pale moon; the right pale moon; the golden crescent of couched thread; the lace mountain range, as one long piece; the striped band of pale yellow and sky blue; a single small lace peak, separate from the range; a small silver star. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-10-figure-sun-and-bird.jpg .
```

### HK-T05-C · Two moons over lace mountains: pieces

- **File:** `fibreart/game/assets/tableaux/two-moons/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 5: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg), [`tapestry-10-figure-sun-and-bird.jpg`](../reference/fibre/tapestry-10-figure-sun-and-bird.jpg)
- **Note:** Attach HK-T05-A when generating. 7 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T05-A (file assets/tableaux/two-moons/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The left pale moon. 2. The right pale moon. 3. The golden crescent of couched thread. 4. The lace mountain range, as one long piece. 5. The striped band of pale yellow and sky blue. 6. A single small lace peak, separate from the range. 7. A small silver star. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-10-figure-sun-and-bird.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T06-A · The dancers: composition

- **File:** `fibreart/game/assets/tableaux/dancers/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 6, after her quilt of red and blue dancers: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`quilt-red-and-blue-dancers.jpg`](../reference/fibre/quilt-red-and-blue-dancers.jpg), [`quilt-red-figure-and-rose.jpg`](../reference/fibre/quilt-red-figure-and-rose.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A quilted panel after her red and blue dancers: a white and pale grey ground divided by red-printed borders into four or five compartments of different sizes, like rooms. In them, figures printed and painted in red and in cobalt blue dance, leap and turn, their limbs long and flowing; a round red sun in the top left compartment; a tall blue plant with curling leaves; a small framed window of quilted pale blue. A border of red and white triangles along the bottom. The motifs that will move: the leaping blue dancer; the turning red dancer; a pair of blue dancers holding hands; a red dancer reaching up; the round red sun; the tall blue plant with curling leaves; the small quilted window, as an empty frame. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-and-blue-dancers.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-figure-and-rose.jpg .
```

### HK-T06-B · The dancers: ground

- **File:** `fibreart/game/assets/tableaux/dancers/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 6: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`quilt-red-and-blue-dancers.jpg`](../reference/fibre/quilt-red-and-blue-dancers.jpg), [`quilt-red-figure-and-rose.jpg`](../reference/fibre/quilt-red-figure-and-rose.jpg)
- **Note:** Attach HK-T06-A when generating. What stays: the white ground, the red borders between the compartments, the triangle border.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T06-A (file assets/tableaux/dancers/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the leaping blue dancer; the turning red dancer; a pair of blue dancers holding hands; a red dancer reaching up; the round red sun; the tall blue plant with curling leaves; the small quilted window, as an empty frame. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-and-blue-dancers.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-figure-and-rose.jpg .
```

### HK-T06-C · The dancers: pieces

- **File:** `fibreart/game/assets/tableaux/dancers/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 6: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Attach:** [`composition.webp`](../game/assets/tableaux/dancers/composition.webp)
- **Note:** Attach HK-T06-A when generating. 7 pieces in a 3 x 3 grid. Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T06-A (file assets/tableaux/dancers/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The leaping blue dancer. 2. The turning red dancer. 3. A pair of blue dancers holding hands. 4. A red dancer reaching up. 5. The round red sun. 6. The tall blue plant with curling leaves. 7. The small quilted window, as an empty frame. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/dancers/composition.webp . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T07-A · Man and woman: composition

- **File:** `fibreart/game/assets/tableaux/man-and-woman/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 7, after her tapestry Man and Woman: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`tapestry-man-and-woman.jpg`](../reference/fibre/tapestry-man-and-woman.jpg), [`painting-embrace-in-blue.jpg`](../reference/paintings/painting-embrace-in-blue.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A tapestry after her Man and Woman: an old man and an old woman with grey and white hair sit facing each other across a table, their hands meeting in the middle, pieced from grey and mauve fabric with lace and white thread for their hair. A red patterned tablecloth with a looping scarlet ribbon runs along the bottom. Behind them a soft grey-rose ground with a little peaked house on the left, a large copper-gold sun of metallic cloth top left, and two bare brown trees on the right with orange leaves of silk. Scraps of lace and white embroidery here and there. The motifs that will move: the man, seated, facing right; the woman, seated, facing left; the copper-gold sun; the little peaked house; the larger bare tree; the smaller bare tree; a single orange silk leaf; the looping scarlet ribbon from the tablecloth. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-man-and-woman.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-embrace-in-blue.jpg .
```

### HK-T07-B · Man and woman: ground

- **File:** `fibreart/game/assets/tableaux/man-and-woman/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 7: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`tapestry-man-and-woman.jpg`](../reference/fibre/tapestry-man-and-woman.jpg), [`painting-embrace-in-blue.jpg`](../reference/paintings/painting-embrace-in-blue.jpg)
- **Note:** Attach HK-T07-A when generating. What stays: the grey-rose ground, the table.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T07-A (file assets/tableaux/man-and-woman/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the man, seated, facing right; the woman, seated, facing left; the copper-gold sun; the little peaked house; the larger bare tree; the smaller bare tree; a single orange silk leaf; the looping scarlet ribbon from the tablecloth. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-man-and-woman.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-embrace-in-blue.jpg .
```

### HK-T07-C · Man and woman: pieces

- **File:** `fibreart/game/assets/tableaux/man-and-woman/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 7: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`tapestry-man-and-woman.jpg`](../reference/fibre/tapestry-man-and-woman.jpg), [`painting-embrace-in-blue.jpg`](../reference/paintings/painting-embrace-in-blue.jpg)
- **Note:** Attach HK-T07-A when generating. 8 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T07-A (file assets/tableaux/man-and-woman/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The man, seated, facing right. 2. The woman, seated, facing left. 3. The copper-gold sun. 4. The little peaked house. 5. The larger bare tree. 6. The smaller bare tree. 7. A single orange silk leaf. 8. The looping scarlet ribbon from the tablecloth. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-man-and-woman.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-embrace-in-blue.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T08-A · Blue Lady: composition

- **File:** `fibreart/game/assets/tableaux/blue-lady/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 8, after her tapestry Blue Lady: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`tapestry-blue-lady.jpg`](../reference/fibre/tapestry-blue-lady.jpg), [`watercolor-woman-at-window.jpg`](../reference/mixed-media/watercolor-woman-at-window.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A night tapestry after her Blue Lady: a woman lies stretched out along the middle of the picture as if floating on a river, her body pieced from many blues, teals and slate greys of cotton, satin and corduroy, her face pale and calm with closed eyes, her long hair flowing behind her into the water. The ground is a dark ribbed blue-black, with ripples of stitched teal thread. A small pale moon above, a fish of patterned blue cloth below her, a few tall reeds at the right edge. The motifs that will move: the reclining woman, her face, body and hair as one piece; the small pale moon; the fish of patterned blue cloth; a cluster of tall reeds; a long ripple of stitched teal thread; a scrap of turquoise satin, like a wave crest. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-blue-lady.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-woman-at-window.jpg .
```

### HK-T08-B · Blue Lady: ground

- **File:** `fibreart/game/assets/tableaux/blue-lady/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 8: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`tapestry-blue-lady.jpg`](../reference/fibre/tapestry-blue-lady.jpg), [`watercolor-woman-at-window.jpg`](../reference/mixed-media/watercolor-woman-at-window.jpg)
- **Note:** Attach HK-T08-A when generating. What stays: the dark ribbed ground, the stitched ripples.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T08-A (file assets/tableaux/blue-lady/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the reclining woman, her face, body and hair as one piece; the small pale moon; the fish of patterned blue cloth; a cluster of tall reeds; a long ripple of stitched teal thread; a scrap of turquoise satin, like a wave crest. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-blue-lady.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-woman-at-window.jpg .
```

### HK-T08-C · Blue Lady: pieces

- **File:** `fibreart/game/assets/tableaux/blue-lady/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 8: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`tapestry-blue-lady.jpg`](../reference/fibre/tapestry-blue-lady.jpg), [`watercolor-woman-at-window.jpg`](../reference/mixed-media/watercolor-woman-at-window.jpg)
- **Note:** Attach HK-T08-A when generating. 6 pieces in a 3 x 2 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T08-A (file assets/tableaux/blue-lady/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 2 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The reclining woman, her face, body and hair as one piece. 2. The small pale moon. 3. The fish of patterned blue cloth. 4. A cluster of tall reeds. 5. A long ripple of stitched teal thread. 6. A scrap of turquoise satin, like a wave crest. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-blue-lady.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-woman-at-window.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T09-A · The crowd of faces: composition

- **File:** `fibreart/game/assets/tableaux/crowd/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 9, after her painting of a crowd of faces: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`painting-crowd-of-faces.jpg`](../reference/paintings/painting-crowd-of-faces.jpg), [`watercolor-face-with-handwriting.jpg`](../reference/mixed-media/watercolor-face-with-handwriting.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A painting after her crowd of faces: dozens of small faces, oval heads on long necks with simple drawn features, some with eyes closed and some looking out, packed together in rose, ochre, cream, dusty blue and slate, filling the picture like a crowd seen from above or a field of flowers. A little right of centre, one much larger face with wide open eyes looks straight out. A single large eye floats at the left. Lines of looping handwriting, unreadable, drift across the top. The motifs that will move: the large face with wide open eyes; the single floating eye; a rose face with closed eyes; an ochre face looking left; a dusty blue face looking up; a cream face with a long neck; a slate face in profile; a small pale face, smiling; a pair of faces cheek to cheek. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-crowd-of-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-face-with-handwriting.jpg .
```

### HK-T09-B · The crowd of faces: ground

- **File:** `fibreart/game/assets/tableaux/crowd/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 9: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`painting-crowd-of-faces.jpg`](../reference/paintings/painting-crowd-of-faces.jpg), [`watercolor-face-with-handwriting.jpg`](../reference/mixed-media/watercolor-face-with-handwriting.jpg)
- **Note:** Attach HK-T09-A when generating. What stays: the packed crowd behind, the drifting handwriting.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T09-A (file assets/tableaux/crowd/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the large face with wide open eyes; the single floating eye; a rose face with closed eyes; an ochre face looking left; a dusty blue face looking up; a cream face with a long neck; a slate face in profile; a small pale face, smiling; a pair of faces cheek to cheek. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-crowd-of-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-face-with-handwriting.jpg .
```

### HK-T09-C · The crowd of faces: pieces

- **File:** `fibreart/game/assets/tableaux/crowd/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 9: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`painting-crowd-of-faces.jpg`](../reference/paintings/painting-crowd-of-faces.jpg), [`watercolor-face-with-handwriting.jpg`](../reference/mixed-media/watercolor-face-with-handwriting.jpg)
- **Note:** Attach HK-T09-A when generating. 9 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T09-A (file assets/tableaux/crowd/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The large face with wide open eyes. 2. The single floating eye. 3. A rose face with closed eyes. 4. An ochre face looking left. 5. A dusty blue face looking up. 6. A cream face with a long neck. 7. A slate face in profile. 8. A small pale face, smiling. 9. A pair of faces cheek to cheek. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-crowd-of-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-face-with-handwriting.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-T10-A · The silk bird: composition

- **File:** `fibreart/game/assets/tableaux/silk-bird/composition.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 10, after her fibercollage of a silk bird: its resting state, the reference for its ground and pieces, and a picture to keep on its own.
- **Stand-in until delivered:** The reference photo, stretched to fill.
- **Reference:** [`fibercollage-silk-bird.jpg`](../reference/fibre/fibercollage-silk-bird.jpg), [`fibercollage-netting-and-pink-silk.jpg`](../reference/fibre/fibercollage-netting-and-pink-silk.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A complete picture in landscape 16:9, full bleed, meant both as a finished artwork and as the key a game scene is built from: every motif named below will later be cut out and moved on its own, so give each one a clear, readable silhouette, keep the motifs apart from each other (touching at most at an edge, never overlapping much), and make each one a distinct piece of cloth or paint against the ground. A painted canvas after her silk bird: on a pale cream and grey ground, a large bird pieced from silk in magenta, cobalt, turquoise and violet flies left, its wings swept back; a small calm face is set in its breast like a locket. Long ribbons of colour (pale gold, rose, sky blue and lilac) swirl around it in loops, painted and stitched. Lower right, a fish of brown netting with orange stitching; a pink silk triangle in one corner. The motifs that will move: the silk bird with the face in its breast; a long gold ribbon loop; a rose ribbon loop; a sky-blue ribbon loop; a lilac ribbon loop; the netting fish with orange stitching; the pink silk triangle. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-silk-bird.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-netting-and-pink-silk.jpg .
```

### HK-T10-B · The silk bird: ground

- **File:** `fibreart/game/assets/tableaux/silk-bird/ground.webp`
- **Size:** 1920 x 1080, opaque
- **Used for:** Scene 10: the layer behind the pieces, cut into panels and warped by the large effects.
- **Stand-in until delivered:** The reference photo, blurred where the pieces sit.
- **Reference:** [`fibercollage-silk-bird.jpg`](../reference/fibre/fibercollage-silk-bird.jpg), [`fibercollage-netting-and-pink-silk.jpg`](../reference/fibre/fibercollage-netting-and-pink-silk.jpg)
- **Note:** Attach HK-T10-A when generating. What stays: the pale painted ground.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. The same picture as the attached composition, request HK-T10-A (file assets/tableaux/silk-bird/composition.webp), at exactly the same framing and scale, but with these motifs taken out: the silk bird with the face in its breast; a long gold ribbon loop; a rose ribbon loop; a sky-blue ribbon loop; a lilac ribbon loop; the netting fish with orange stitching; the pink silk triangle. Where each one was, continue the ground underneath as if it had never been there (the sky, the field, the patchwork, the stitching running on), with no gap, hole, outline or ghost of the removed shape. Everything else stays exactly as it is in the composition. Full bleed 16:9, opaque. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-silk-bird.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-netting-and-pink-silk.jpg .
```

### HK-T10-C · The silk bird: pieces

- **File:** `fibreart/game/assets/tableaux/silk-bird/pieces.png`
- **Size:** 2048 x 2048, transparent
- **Used for:** Scene 10: the pieces that move, cut apart in this order on integration.
- **Stand-in until delivered:** Ovals and rectangles cut from the reference photo.
- **Reference:** [`fibercollage-silk-bird.jpg`](../reference/fibre/fibercollage-silk-bird.jpg), [`fibercollage-netting-and-pink-silk.jpg`](../reference/fibre/fibercollage-netting-and-pink-silk.jpg)
- **Note:** Attach HK-T10-A when generating. 7 pieces in a 3 x 3 grid.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of separate cut-out pieces for a game that moves, stretches, turns and dissolves each one on its own. Draw each motif below exactly as it appears in the attached composition, request HK-T10-A (file assets/tableaux/silk-bird/composition.webp): same design, colours, materials, stitching and scale relative to each other, in the same orientation it has there (do not turn it to fit the cell). Each piece is complete and whole, including any part that was hidden behind another motif, with its own frayed or painted edge all round and a little of its stitching or thread running loose past the edge. Lay them out in a grid of 3 columns and 3 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, in order: 1. The silk bird with the face in its breast. 2. A long gold ribbon loop. 3. A rose ribbon loop. 4. A sky-blue ribbon loop. 5. A lilac ribbon loop. 6. The netting fish with orange stitching. 7. The pink silk triangle. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-silk-bird.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-netting-and-pink-silk.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

## Morph chains

Motifs that grow into each other, so pieces can travel from one scene to the next. Each stage is cut apart on integration and blended into the next in the game.

### HK-M01 · Moon to sun to heart

- **File:** `fibreart/game/assets/chains/moon.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg), [`viriditas.jpg`](../reference/paintings/viriditas.jpg), [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a pale yellow crescent moon with a sleeping face; a round pale moon, the sleeping face turned to the front; a violet sun disc of painted silk, the face fading into its glow; a copper-gold sun of metallic cloth with short stitched rays; a red velvet heart with a white embroidered crown, its top curves the sun's rays. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-M02 · Bare tree to berry tree

- **File:** `fibreart/game/assets/chains/tree.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Attach:** [`02-the-tallest-teal-tree-trunk-and-branches-from-the-ground-to-the-top.png`](../game/assets/tableaux/viriditas/pieces/02-the-tallest-teal-tree-trunk-and-branches-from-the-ground-to-the-top.png), [`01-the-black-tree-trunk-and-branches.png`](../game/assets/tableaux/black-tree/pieces/01-the-black-tree-trunk-and-branches.png), [`05-the-larger-bare-tree.png`](../game/assets/tableaux/man-and-woman/pieces/05-the-larger-bare-tree.png)
- **Note:** Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a bare black appliqué tree with curving branches; the same tree budding, small green buds along the branches; a tree with orange silk leaves; a slender teal tree with clusters of red-orange berries; a single budding branch, as if held in a hand. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/viriditas/pieces/02-the-tallest-teal-tree-trunk-and-branches-from-the-ground-to-the-top.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/black-tree/pieces/01-the-black-tree-trunk-and-branches.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/man-and-woman/pieces/05-the-larger-bare-tree.png . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-M03 · Sleeping face to open eyes

- **File:** `fibreart/game/assets/chains/face.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Reference:** [`painting-crowd-of-faces.jpg`](../reference/paintings/painting-crowd-of-faces.jpg), [`the-golden-lady-detail-face.jpg`](../reference/paintings/the-golden-lady-detail-face.jpg), [`watercolor-face-with-handwriting.jpg`](../reference/mixed-media/watercolor-face-with-handwriting.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a pale oval face with closed eyes, drawn in one dark line on cream cloth; the same face waking, eyes half open; the face with dark almond eyes wide open, looking out; the face turned three-quarters, gold hair beginning to show; a mask-like gold and ochre face, eyes closed again. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-crowd-of-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-face.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/mixed-media/watercolor-face-with-handwriting.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-M04 · Bird to fish to leaf

- **File:** `fibreart/game/assets/chains/bird.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Attach:** [`01-the-silk-bird-with-the-face-in-its-breast.png`](../game/assets/tableaux/silk-bird/pieces/01-the-silk-bird-with-the-face-in-its-breast.png), [`03-the-fish-of-patterned-blue-cloth.png`](../game/assets/tableaux/blue-lady/pieces/03-the-fish-of-patterned-blue-cloth.png), [`06-the-netting-fish-with-orange-stitching.png`](../game/assets/tableaux/silk-bird/pieces/06-the-netting-fish-with-orange-stitching.png), [`07-a-single-orange-silk-leaf.png`](../game/assets/tableaux/man-and-woman/pieces/07-a-single-orange-silk-leaf.png)
- **Note:** Retry: the first attempt was rejected by the image service (category other). This prompt leaves out the artist's name and the photos of her work; attach the images listed under Attach instead.
- **Status:** delivered

```text
Original artwork in a contemporary fibre-art style of fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a silk bird in magenta and cobalt, wings spread; the bird folding its wings, its body lengthening; a fish of patterned blue cloth; a fish of brown netting with orange stitching; a long orange silk leaf, its veins the fish's stitches. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. Match the look of these images, made earlier for the same game: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/silk-bird/pieces/01-the-silk-bird-with-the-face-in-its-breast.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/blue-lady/pieces/03-the-fish-of-patterned-blue-cloth.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/silk-bird/pieces/06-the-netting-fish-with-orange-stitching.png , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/game/assets/tableaux/man-and-woman/pieces/07-a-single-orange-silk-leaf.png . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-M05 · Dancer to sleeper

- **File:** `fibreart/game/assets/chains/figure.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Reference:** [`quilt-red-and-blue-dancers.jpg`](../reference/fibre/quilt-red-and-blue-dancers.jpg), [`quilt-red-figure-and-rose.jpg`](../reference/fibre/quilt-red-figure-and-rose.jpg), [`tapestry-blue-lady.jpg`](../reference/fibre/tapestry-blue-lady.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a red silhouette of a standing figure, cut from one piece of cloth, no face; a blue printed dancer, arms raised; a dancer turning, leaning over; a figure crouching, curled forward; a woman lying stretched out, pieced from blues, eyes closed. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-and-blue-dancers.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-figure-and-rose.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-blue-lady.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-M06 · Rose to berries to heart

- **File:** `fibreart/game/assets/chains/flower.png`
- **Size:** 3000 x 700, transparent
- **Used for:** Pieces that change into one another, and carry over between scenes.
- **Stand-in until delivered:** A cross-fade between pieces of the tableaux.
- **Reference:** [`quilt-red-figure-and-rose.jpg`](../reference/fibre/quilt-red-figure-and-rose.jpg), [`viriditas.jpg`](../reference/paintings/viriditas.jpg), [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A morph chain: one motif changing step by step into others, for a game that blends each stage into the next. 5 stages in one row from left to right, all at the same size and centred on the same point in their cells, each about as wide and tall as the others so one can grow out of the last. Each stage is a finished cut-cloth motif with stitched edges, and each shares something with its neighbours (the curve of an edge, a colour, a line of stitches, the closed eyes) so the change feels grown rather than swapped. The stages, in order: a pink fabric rose with layered petals; a violet bloom, opening; a cluster of red-orange berries; a cluster of small red and yellow batik flowers; a small red heart, stitched. Even spacing, plenty of clear background between them, nothing touching. No numbers, arrows or labels. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-figure-and-rose.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

## Fabric textures

Seamless swatches that fill shapes and show through where a panel is torn away or a piece is stretched past its edge.

### HK-X01 · Indigo batik

- **File:** `fibreart/game/assets/textures/indigo-batik.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`fibercollage-moons-and-hearts.jpg`](../reference/fibre/fibercollage-moons-and-hearts.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: deep indigo cotton batik with small pale crescent and dot patterns, slightly uneven dye. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-moons-and-hearts.jpg .
```

### HK-X02 · Rust paisley

- **File:** `fibreart/game/assets/textures/rust-paisley.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`quilt-red-figure-and-rose.jpg`](../reference/fibre/quilt-red-figure-and-rose.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: rust red and orange printed paisley cotton with fine black detail. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-red-figure-and-rose.jpg .
```

### HK-X03 · Gold damask

- **File:** `fibreart/game/assets/textures/gold-damask.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`tapestry-20-crouching-figure-on-damask.jpg`](../reference/fibre/tapestry-20-crouching-figure-on-damask.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: heavy olive-gold damask woven with large leafy scrolls on a dark ground. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/tapestry-20-crouching-figure-on-damask.jpg .
```

### HK-X04 · Turquoise satin

- **File:** `fibreart/game/assets/textures/turquoise-satin.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: shiny turquoise satin with soft rippled highlights. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg .
```

### HK-X05 · White lace on black

- **File:** `fibreart/game/assets/textures/black-lace.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`quilt-two-moons-blue-satin.jpg`](../reference/fibre/quilt-two-moons-blue-satin.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: white floral lace laid over black cotton. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/quilt-two-moons-blue-satin.jpg .
```

### HK-X06 · Brown netting

- **File:** `fibreart/game/assets/textures/brown-netting.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`fibercollage-netting-and-pink-silk.jpg`](../reference/fibre/fibercollage-netting-and-pink-silk.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: coarse brown netting over dark felt, with a few loose orange threads. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-netting-and-pink-silk.jpg .
```

### HK-X07 · Yellow-green painted silk

- **File:** `fibreart/game/assets/textures/green-silk.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`viriditas.jpg`](../reference/paintings/viriditas.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: silk painted in acid yellow and yellow-green washes with soft teal blooms. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg .
```

### HK-X08 · Ultramarine painted canvas

- **File:** `fibreart/game/assets/textures/ultramarine-canvas.webp`
- **Size:** 1024 x 1024, opaque, tiling
- **Used for:** Fills and backings behind torn panels and stretched pieces.
- **Stand-in until delivered:** A flat colour from the scene's palette with noise.
- **Reference:** [`painting-embrace-in-blue.jpg`](../reference/paintings/painting-embrace-in-blue.jpg)
- **Status:** delivered

```text
A seamlessly tiling square texture of one fabric, photographed flat and straight on in even, soft light, filling the whole square with no edge, fold, shadow or vignette: it must repeat in both directions with no visible seam. The fabric: canvas painted in deep ultramarine with visible brush marks. Rich, saturated colour; the weave and thread visible up close. No motifs that read as a picture on their own. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-embrace-in-blue.jpg .
```

## Dissolve masks

Greyscale maps that decide how one image wears away into another. The game can make plain noise ones itself; these give the dissolves her materials.

### HK-D01 · Torn paper

- **File:** `fibreart/game/assets/masks/torn-paper.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: torn along wandering rips, like collage paper being pulled away in strips from one corner. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

### HK-D02 · Watercolour bloom

- **File:** `fibreart/game/assets/masks/watercolour-bloom.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: spreading outward from several points like wet watercolour blooms, with ragged, cauliflower edges. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

### HK-D03 · Seams

- **File:** `fibreart/game/assets/masks/seams.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: block by block along a patchwork of irregular rectangles, each block going in turn, the seams between them last. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

### HK-D04 · Unravelling thread

- **File:** `fibreart/game/assets/masks/unravel.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: thread by thread along long horizontal lines, like a woven cloth unravelling from the top. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

### HK-D05 · Swirl

- **File:** `fibreart/game/assets/masks/swirl.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: in a spiral from the centre outward, with the arms of the spiral wavering like a painted stroke. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

### HK-D06 · Stitch line

- **File:** `fibreart/game/assets/masks/stitch-line.png`
- **Size:** 1024 x 1024, greyscale
- **Used for:** Dissolves between scenes and between morph stages.
- **Stand-in until delivered:** Value noise generated in code.
- **Status:** delivered

```text
A greyscale dissolve map for a game shader, square, opaque, no colour at all: pure white is where an image disappears first and pure black where it disappears last, with every shade of grey between, so that as a threshold sweeps from white to black the image wears away in this way: from one side to the other along a wavering line of running stitches, dashes of white ahead of the edge. Use the full range from pure white to pure black, with smooth gradients inside the shapes and fine, crisp detail along their edges. Nothing else in the image, no texture of paper or cloth, no text. 
```

## Life

Small extra pictures that make the scenes feel alive: loose leaves and petals that blow across on a gust, eyes that close for a blink, a bird's wings. Most of the life is made in code (trees bending in the wind, breathing, drifting clouds, swimming fish); these are the parts code cannot fake. Each swap is drawn exactly over the piece it replaces, so attach that piece.

### HK-A01 · Loose leaves and petals

- **File:** `fibreart/game/assets/anim/drift.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** Single leaves and petals blown across the windy scenes (Viriditas, The Golden Lady, The black tree, Man and woman) on each gust, turning as they go.
- **Stand-in until delivered:** The single leaves from The black tree and Man and woman.
- **Reference:** [`fibercollage-black-tree-and-faces.jpg`](../reference/fibre/fibercollage-black-tree-and-faces.jpg), [`viriditas.jpg`](../reference/paintings/viriditas.jpg)
- **Attach:** [`07-a-single-orange-silk-leaf.png`](../game/assets/tableaux/man-and-woman/pieces/07-a-single-orange-silk-leaf.png), [`03-a-large-ochre-leaf.png`](../game/assets/tableaux/black-tree/pieces/03-a-large-ochre-leaf.png), [`12-a-patch-of-orange-fallen-leaves.png`](../game/assets/tableaux/viriditas/pieces/12-a-patch-of-orange-fallen-leaves.png)
- **Note:** Attach the files listed under Attach; they are the pieces this matches.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. A sheet of single small cut-cloth leaves and petals, each one loose and whole, lying flat, seen from straight above, with frayed edges and a line of stitching for its vein, for a game that blows them across the picture. Lay them out in a grid of 6 columns and 2 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. In order: 1. An orange silk leaf. 2. A red-orange silk leaf, slightly curled. 3. A saffron leaf. 4. An ochre leaf. 5. A cream leaf with a brown stitched vein. 6. A black leaf with a white stitched vein. 7. A small yellow-green leaf. 8. A teal leaf. 9. A pink rose petal. 10. A red petal. 11. A single red-orange berry with a short stem. 12. A white blossom with five petals. Each about the same size. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-black-tree-and-faces.jpg , https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-A02 · The Golden Lady blinks

- **File:** `fibreart/game/assets/anim/blink-golden-lady.png`
- **Size:** 1024 x 1024, transparent
- **Used for:** Her face for a moment with her eyes closed, every few seconds, so she breathes and blinks instead of staring.
- **Stand-in until delivered:** No blink: she breathes and tilts her head.
- **Reference:** [`the-golden-lady-detail-face.jpg`](../reference/paintings/the-golden-lady-detail-face.jpg)
- **Attach:** [`01-her-head-and-neck-without-the-hair.png`](../game/assets/tableaux/golden-lady/pieces/01-her-head-and-neck-without-the-hair.png)
- **Note:** Attach the files listed under Attach; they are the pieces this matches.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. Replacement pieces for animation, each drawn to sit exactly in place of the attached original piece: the same size, framing, outline, colours, cloth and stitching, the same pose and the same position in its cell, with only the change described. Laid over the original, everything but that change must line up. The piece: her head and neck, without the hair. The change: her eyes are closed, drawn as two calm downward curves with lashes in the same dark line, as if she is blinking. One piece, centred. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/the-golden-lady-detail-face.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-A03 · The crowd blinks

- **File:** `fibreart/game/assets/anim/blink-crowd.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** The open-eyed faces of the crowd blink now and then, each on its own rhythm.
- **Stand-in until delivered:** No blink: the faces breathe and tilt.
- **Reference:** [`painting-crowd-of-faces.jpg`](../reference/paintings/painting-crowd-of-faces.jpg)
- **Attach:** [`01-the-large-face-with-wide-open-eyes.png`](../game/assets/tableaux/crowd/pieces/01-the-large-face-with-wide-open-eyes.png), [`04-an-ochre-face-looking-left.png`](../game/assets/tableaux/crowd/pieces/04-an-ochre-face-looking-left.png), [`05-a-dusty-blue-face-looking-up.png`](../game/assets/tableaux/crowd/pieces/05-a-dusty-blue-face-looking-up.png), [`08-a-small-pale-face-smiling.png`](../game/assets/tableaux/crowd/pieces/08-a-small-pale-face-smiling.png)
- **Note:** Attach the files listed under Attach; they are the pieces this matches.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. Replacement pieces for animation, each drawn to sit exactly in place of the attached original piece: the same size, framing, outline, colours, cloth and stitching, the same pose and the same position in its cell, with only the change described. Laid over the original, everything but that change must line up. Lay them out in a grid of 4 columns and 1 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, each with its eyes closed as if blinking, drawn as calm downward curves in the same dark line: 1. The large face with wide open eyes. 2. The ochre face looking left. 3. The dusty blue face looking up. 4. The small pale smiling face. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/painting-crowd-of-faces.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-A04 · The black tree blinks

- **File:** `fibreart/game/assets/anim/blink-black-tree.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** The two open-eyed women of The black tree blink now and then.
- **Stand-in until delivered:** No blink: they breathe and tilt.
- **Reference:** [`fibercollage-black-tree-and-faces.jpg`](../reference/fibre/fibercollage-black-tree-and-faces.jpg)
- **Attach:** [`05-the-face-with-long-dark-hair.png`](../game/assets/tableaux/black-tree/pieces/05-the-face-with-long-dark-hair.png), [`07-the-dark-face-with-the-gold-mask-like-look.png`](../game/assets/tableaux/black-tree/pieces/07-the-dark-face-with-the-gold-mask-like-look.png)
- **Note:** Attach the files listed under Attach; they are the pieces this matches.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. Replacement pieces for animation, each drawn to sit exactly in place of the attached original piece: the same size, framing, outline, colours, cloth and stitching, the same pose and the same position in its cell, with only the change described. Laid over the original, everything but that change must line up. Lay them out in a grid of 2 columns and 1 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The pieces, each with its eyes closed as if blinking, drawn as calm downward curves in the same line: 1. The face with long dark hair. 2. The dark face with the gold mask-like look. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/fibre/fibercollage-black-tree-and-faces.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```

### HK-A05 · The bird's wings

- **File:** `fibreart/game/assets/anim/bird-viriditas.png`
- **Size:** 2048 x 1024, transparent
- **Used for:** The small teal bird in Viriditas flicks its wings and ruffles now and then on its branch.
- **Stand-in until delivered:** The bird hops and tilts instead.
- **Reference:** [`viriditas.jpg`](../reference/paintings/viriditas.jpg)
- **Attach:** [`11-a-small-bird-of-stitched-teal-silk-among-the-branches.png`](../game/assets/tableaux/viriditas/pieces/11-a-small-bird-of-stitched-teal-silk-among-the-branches.png)
- **Note:** Attach the files listed under Attach; they are the pieces this matches.
- **Status:** delivered

```text
Original artwork in the style of Hanneke de Neve, a Dutch-born New Jersey artist who makes fibercollages, quilts, tapestries and paintings: figurative and dreamlike, built from cut and pieced fabric and loose paint. Flat shapes cut from cloth with slightly irregular, softly frayed edges; visible hand stitching (running stitch, couched thread, machine zigzag); batik, paisley, damask, satin, lace and netting side by side; figures and faces with oval heads, long necks and almond eyes, often closed, drawn in one fluid dark contour over washes of colour that spill past the line. Deep indigo, black and teal grounds with hot accents of red, orange, saffron and pale gold, and acid yellow-green light. Calm, warm, a little melancholy, full of love for people. Rich, saturated colour, as in a fresh photograph of the real cloth, not faded. No text, no lettering, no signature, no watermark, no picture frame, no UI. Replacement pieces for animation, each drawn to sit exactly in place of the attached original piece: the same size, framing, outline, colours, cloth and stitching, the same pose and the same position in its cell, with only the change described. Laid over the original, everything but that change must line up. Lay them out in a grid of 3 columns and 1 rows, in the order listed, from left to right and top to bottom, one per cell and centred in it, with plenty of clear background around each one. Nothing touches anything else or the edge of its cell. No numbers, labels, guide lines, outlines around the cells or shadows. The changes, in order: 1. Its wings half open, lifted a little off its back, as if about to fly. 2. Its wings fully raised above its back, feathers spread. 3. Its feathers ruffled and its head turned to look back over its shoulder. Its feet stay on the same spot in every one. For the style, materials and palette, look at her work in these reference photos: https://raw.githubusercontent.com/hoai2k/mini/main/fibreart/reference/paintings/viriditas.jpg . Transparent background (PNG with alpha). If transparency is not possible, use a flat pure magenta #FF00FF background with nothing else on it and no cast shadow; it is keyed out on integration.
```
