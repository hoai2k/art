# Wreck swimming size review

These animations are captures of the game renderer, not newly generated art.
Run `qa/wreck-swim-browser.mjs` and `qa/build-wreck-swim-review.py` to recreate
them. Full stage frames and measured anchors are recorded under
`/tmp/fairies-wreck-swim` during the check.

Both strokes now have the same 180-stage-pixel helmet-crest-to-boot-tip length
and identical head/boot anchors. The reaching hand can extend beyond the head
without reducing the body. Original and tinted frames are measured separately
in `src/acts/wreck-swim.js`. Native artwork and proportions are preserved;
uniform scale, rotation and anatomical registration correct the rendering.
Mouth bubbles and suspension wires follow the corrected artwork.

The browser regression checks both looks and both facing directions through
the actual Wreck renderer, and checks that sounding the first conch immediately
wakes three nearby sleepers. The conches wake a 360-pixel area around the horn;
their previous temporary song effect while swimming is retained.
