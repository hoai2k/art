# Victory punctuation and wedding celebration

31 October 2026. Generated using the built-in imagegen tool. Native selected
First-pass PNGs are preserved in `source/`; corrected compact, palette-matched
v2 sources and prompts are in `../barrel-defiance/`. The game consumes `assets/azurine-jump.webp`
and `assets/azurine-jump-tinted.webp`. Both have real alpha transparency.
`design/source/prepare_celebration.py` trims transparent margins, resizes and
bottom-centres each delivery on a 300 × 500 canvas without redrawing it.
The person-size audit calibrates each pose against her standing face.

The prince reuses his court-dress dancing leap from the opening chase, with
matching court-dress walking and standing poses during the celebration.
Azurine has the same jump physics and jumps at the same moment. Existing
guest cut-outs hop in a wave, ordered by distance from the prince at takeoff;
only rescued crew attend. Repeated player jumps can start overlapping waves.

After the witch and barrel have entirely vanished, the empty cliff holds
for the stinger at its original pitch. The screen fade begins 3.45 seconds
into its final chord and lasts 1.65 seconds, following the audible decay
instead of waiting for the MP3’s silent tail. The wedding recording starts
over black; after a 1.2-second musical lead, the picture fades in over
2.8 seconds. Audio loading cannot consume that musical lead. The final tableau can be explored indefinitely; only a jump
beneath Aurora starts the ascent and rolling credits. Touch, keyboard and
controller all use their existing leap input, with a persistent prompt in
the light.

## Generation prompts

For each look, the supplied references were `azurine-stand[−tinted].webp`
(identity and costume) and `prince-court-leap[−tinted].webp` (pose and energy).
The exact first-pass prompt was identical except for the palette clause:

> Use case: identity-preserve. Create ONE full-body transparent game sprite of Princess Azurine in a joyful theatrical dancing leap, matching the raised-arm celebratory energy of reference 2. Reference 1 is her exact identity, costume, face, hair and art style: preserve these faithfully, including PALETTE. She faces LEFT as in reference 1, both arms lifted out joyfully, one knee lifted and other leg stretching down, gown flowing in a readable silhouette. No prince. One character only. Flat painted Victorian toy-theatre cutout, exact same person and scale of head as reference 1. Keep entire hands, hair, hem and feet inside frame, natural anatomy, genuine transparent background, no ground, no shadow, no text or props. This is a new pose, not a scene. Portrait composition.

Original PALETTE: “the ornate azure-blue and gold star-and-moon gown with pink drapery”.
Tinted PALETTE: “the muted hand-tinted silent film palette, plain pale blue-grey gown and pink drapery”.

The tinted pose received this alpha cleanup pass, with its first-pass image as input:

> Use case: background-extraction. Remove ALL of the dark blurred studio backdrop, its glow and shadows from this image. Deliver the identical full-body jumping Princess Azurine cutout on genuinely transparent RGBA alpha, including open transparent spaces between arms, hair, gown and legs. Keep every part of the princess exactly as it is: identical face, hair, hands, costume, pose, colours, linework and proportions. Do not add anything, no floor or shadow, no crop. Change ONLY the background to actual transparency.

## Verification

`qa/film.test.mjs` exercises the full victory hold/fade, single cue, couple's
jump arc, nearest-first guest wave, walking freely in the final tableau and
deliberate jump to ascend. `qa/celebration-browser.mjs` checks real decoded
stinger playback, music levels, the wedding track, both sprite looks, real
keyboard controls and the final prompt. `qa/finale-browser.mjs` checks the
complete wedding/credits score, coordinated fade and playbill return.

The screenshots and `review.json` beside this file retain the first-pass
review. Current v2 screenshots, timing checks and prompts are in
[`../barrel-defiance/`](../barrel-defiance/README.md), captured through the
production renderer. Sprite geometry and person sizes are also covered by
`design/sprite-audit.md` and `design/person-sizes.md`.
