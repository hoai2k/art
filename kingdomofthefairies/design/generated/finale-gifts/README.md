# Wedding gifts

Twenty original toy-theatre wedding presents generated individually with the
built-in image_gen tool. These are fairy-tale interpretations, not film stills.
The exact prompts and gift names are in [prompts.json](prompts.json).

Full-resolution PNG originals, including their native alpha channels, are in
`source/`. The game uses 320 × 320 WebP copies in `assets/wedding-gift-*.webp`.
`design/source/prepare_finale_gifts.py` crops transparent margins, scales and pads
each original, preserving alpha, then writes the assets, manifest entries,
[transparency audit](audit.json) and [contact sheet](contact-sheet.png).
All twenty originals have alpha ranging from 0 to 255 and were visually reviewed.

The Water Fairy gives each of the twenty presents once, then stops.
Each appears enlarged during its flight, then settles onto the treasure heap.
Pearls earned on the journey remain separate from these wedding gifts.
