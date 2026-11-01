# Second art round

All 56 C8–C12 requests and `touch-pause` in C13 were generated with the built-in
image generator. The earlier delivered artwork supplied the palette, painted
textures and character references. State variants use their new base image as
the edit input.

See [the review gallery](index.html), [complete prompts](prompts.json), and
[requested specifications](requests.json). Full-size selected PNGs are in
`originals/`; earlier takes used as correction inputs are in `rejected/`.
**Delivered, 6 October 2026.** The sized PNGs were converted to WebP in
`../../../assets/` (full-frame backcloths at the 1280 × 720 stage size, the
rest at their requested 2× size), their manifest slots set to `delivered`, and
the intake emptied. 54 are in the game. The two wave-crank pieces were tried
at the wings and dropped (the cranks were optional and still read as screws);
their originals stay here. `cliff-face-tall` and `ending-dark-2` work but are
re-requested in C14 (see `../../image-requests.md`).

Rebuild the sized deliveries and gallery from the retained recipes with:

```sh
python3 kingdomofthefairies/design/source/prepare_round2_delivery.py
```

Preparation preserves generated alpha, sizes sprites to their requested
anchors, and retains the crank's canvas padding so its axle stays centred.
The three grotto ground rows are cropped to a continuous painted top edge;
the exact crop and placement are recorded in `prompts.json`. Rectangular strips
retain one transparent canvas row when their cropped art fills the frame.
The five review sheets show the complete delivery on a neutral background.
