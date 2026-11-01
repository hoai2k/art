# Part C image delivery

All **91 game assets and 8 mood boards** from the updated
[`image-requests.md`](../../image-requests.md) have been generated with the
built-in image generator. Each request has its own PNG.

- [Review gallery](index.html): searchable by id, subject or act.
- [Sized delivery PNGs](../../../intake/): named exactly by request id.
- [Selected originals](originals/): full generated resolution before sizing.
- [Prompt set](prompts.json): every final prompt, input reference, requested
  size, anchor, crop and placement.

The cast uses the delivered sailor, witch and band references. The beloved's
sheet was generated first and supplied to her sprite, the carrying pose and
the endings. Matching animation frames, creature states, shipwreck pieces,
house views and bay endings reuse their base references. Video frames and
the existing Méliès studies supply the scene and palette references.

PNG dimensions and decoding were checked for all 99 files: 81 have sprite
alpha and 18 are opaque backcloths, the playbill or mood boards. The art was
reviewed on composited contact sheets, including paired states and repeated
floor/water strips. Character silhouettes keep their proportions; stage
strips are sized to their full requested rectangles. The original generated
alpha is retained when sizing.

These are delivered to **intake for integration**. The game manifest remains
`requested` until the PNGs are imported as WebP assets and checked in the game.
Mood boards are visual references and do not become game slots.

To reproduce sizing and this gallery from the selected originals and saved
prompt set (requires Pillow):

```sh
python3 kingdomofthefairies/design/source/prepare_part_c_delivery.py
```
