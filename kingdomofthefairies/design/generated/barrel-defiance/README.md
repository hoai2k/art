# Barrel defiance, Aurora’s blessing and wedding refinements

31 October 2026. Generated with the built-in imagegen tool. The selected
native PNGs are retained in `source/`; the game uses:

- `assets/witch-barrel-anger-a.webp`
- `assets/witch-barrel-anger-b.webp`
- `assets/witch-barrel-anger-a-tinted.webp`
- `assets/witch-barrel-anger-b-tinted.webp`
- `assets/azurine-jump.webp` (corrected v2)
- `assets/azurine-jump-tinted.webp` (corrected v2)

The witch faces left toward the prince and alternates between pointing and
shaking her fists. `prepare_barrel_gestures.py` registers the two frames by
the barrel’s lower woodwork, preserving its width and base rather than
centering the canvas on her changing arm silhouette. Each look has its own
face-size calibration; both frames within a look use the same calibration.

The supporting figure on the cliff is Aurora (`aurora-point`), not Azurine.
She turns toward the prince, points to him and sends a gold sparkle stream
to him. Fire reaching her protection turns into temporary pale smoke and
gold sparks. The projectile is removed before further damage checks; smoke
has no collision or damage. Fire ahead of Aurora remains dangerous.

Azurine’s v2 jump is a compact hop with the same standing crown-to-hem
height and muted palette. The extended leg, high arms, exaggerated train and
bright tint of the earlier delivery are gone. Her painted height is exactly
160 stage pixels when the standing sprite is drawn at 160, in both looks;
the shared jump physics keep her feet at the prince’s jump level. Standing
no longer retains a residual walking bob. The v1 sources remain preserved
under `../celebration/source/`.

## Timing and music

The stinger’s audible final chord begins decaying around 3.45 seconds. The
screen fades then, over 1.65 seconds, instead of waiting for the near-silent
tail of the seven-second MP3. The wedding recording begins over black.
Its actual playback starts a 1.2-second musical lead, followed by a
2.8-second picture fade-in. A delayed recording download keeps the screen
black and does not consume the musical lead. A failed recording falls back
to the available accompaniment without trapping the game on black.

The final jump beneath Aurora, guest jump wave and rolling credits continue
to use the existing behavior. Tests cover all three editions, real audio
playback, delayed music loading, phone controls, both sprite looks, fixed
painted height, fire damage in front of Aurora and harmless smoke behind it.

## Generation prompts

For the witch’s pose A, each look used its existing `witch-barrel[−tinted]`
sprite as the identity/style reference. The exact common prompt was:

> Use case: identity-preserve. New game sprite, same witch and barrel as this exact reference, but the witch is FACING LEFT toward the prince who stands to her LEFT. Keep her an ugly furious elderly living woman with wrinkled face, long hooked nose, white wisps of hair and deep teal wool hood. She is shut inside this same iron-hooped wooden barrel, her lower body completely hidden. She leans out angrily, upper torso above the rim, snarling mouth open, one bony arm stretched LEFT with accusing pointing finger, the other bent up shaking a clenched fist threateningly. Exaggerated expressive silent-film pantomime, threatening and defiant rather than frightened. Preserve exact barrel stave pattern, bands, palette, wood texture, character face and STYLE. Full isolated figure with barrel: hands, fingers, hood, barrel fully framed, barrel base horizontal at bottom center. Genuine transparent alpha background; no glow, floor, scenery, text, extra people or shadow. Portrait canvas with enough clear room for arms.

Original STYLE: “painted Victorian toy-theatre cut-out look”.
Tinted STYLE: “muted photographic hand-tinted 1903 silent-film look”.

Each pose B used the matching generated pose A as its edit target:

> Use case: precise-object-edit. Make animation frame B of this exact witch-in-barrel sprite. Change ONLY the two arm gestures: the arm that points LEFT now bends at the elbow with a clenched bony fist shaken angrily to her LEFT in front of her chest; her other arm reaches up, fist raised higher beside her hood. She is shouting and glowering LEFT at the prince. Preserve the EXACT pixel positions, size, perspective, geometry and textures of the entire wooden barrel, including its top rim, bottom and hoops. Keep the same head position, face identity, hood, torso, costume, colours, linework and art style. Same full canvas size and placement. This is the second frame of a subtle furious pantomime animation. Whole hands and fingers in frame. Preserve genuine transparent alpha everywhere outside the cutout, no background, shadow, halo, floor, text or extra people.

Azurine’s corrected jump used her matching standing sprite as reference 1
and the earlier jump sprite as reference 2:

> Use case: identity-preserve. Correct the Princess Azurine jumping game sprite. Reference 1 is the EXACT required face, costume, brightness, saturation, palette, material and body proportions. Reference 2 shows the previous jump which is too large, long, bright and flamboyant: correct those problems. Make one compact gentle celebratory hop of reference 1, facing LEFT. Her head, neck, torso, gown length, face and hands must be the identical size relative to each other as in reference 1. Head to hem height approximately the same as standing, no elongated body or flowing extra-long skirt/train. Keep the gown near its standing silhouette, only gently lifting at the hem. Arms open cheerfully at shoulder height, elbows slightly bent, hands NO HIGHER than the crown of her head. Both legs modestly bent and together beneath the gown, with matching small shoes just visible, not one leg stretched far down. No large knee thrust out toward viewer. PALETTE Same young woman, circlet, hair and dress detailing as reference 1. Full body completely framed on genuine transparent RGBA background, no floor, shadow, glow, halo, scenery, letters or extra person. This must look like the standing sprite performing a small happy hop, NOT a different larger person.

Original PALETTE: “Match reference 1's exact painted azure, pale gold and soft pink values; do not brighten or intensify them.”

Tinted PALETTE: “Crucial: reproduce reference 1's very muted grey-blue gown, dusty faded rose fabric, mostly grayscale face and hair, desaturated photographic 1903 hand-tint. Do NOT add vivid pink, cyan, gold, glossy skin, brightness or saturation.”

## Reproduce the checks

`qa/barrel-browser.mjs` renders both gesture frames and both looks, then
checks Aurora’s facing and fire-to-smoke conversion on both sides of her.
`qa/celebration-browser.mjs` checks actual stinger timing, music before
picture (including a deliberately delayed download), sprite painted height,
coupled jumps and phone input. `qa/finale-browser.mjs` checks the wedding
score, final jump, uninterrupted credits and audio/visual fade.

The review images and JSON beside this file use the production renderer.
`witch-heads.jpg` retains the native-scale face comparison used to override
the template’s unreliable matches on the gesturing frames.
