# Later-act movement audit and delivery — 10 October 2026

Eight new generated sailor cut-outs are delivered and integrated. They are
gameplay poses, always enabled regardless of Settings → Extra Animations.
[Scale review](review.jpg) places the existing standing sailor beside every
pose at the same art-to-stage scale and on a common foot line.

| Act / movement | Audit finding | Delivery |
| --- | --- | --- |
| II: swimming, waking, moon-boat ride | Two swim strokes already exist, with head/boot registration adjustments; ride uses the boat. | Existing poses retained. |
| III: walking and freezing into a courtly pose | Walking pair and courtly bow already represent the available movement. | Existing poses retained. |
| IV: jumping through the whale | The rising leap also represented the apex and descent. | Keep the original rising leap; add `sailor-apex` and `sailor-fall`, selected by vertical velocity. |
| IV: landing | Immediately switched to standing or walking. | `sailor-land` cushions contact for 0.16 seconds. |
| IV: ledge catch and pull-up | Dedicated hand-anchored hang and knee/palm-anchored pull-up already exist. | Existing contact poses retained. |
| V: cliff holds | Reused the airborne leap for moving and stationary climbing. | `sailor-climb-a` reaches, `sailor-climb-b` pulls; movement progress selects the phase, stationary holds keep a stable frame. |
| V: cliff leap / loose hold / defeat fall | All used the leap or climbing silhouette. | Rise → apex → fall for leaps; falling silhouette for loose holds and defeat; landing on ledges briefly cushions contact. |
| V: ladder and ivy | Reused the leap pose. | Climbing pair changes every 26 world units of connector travel. |
| V: stairs and broken slope | Reused the leap pose despite stepping on a surface. | `sailor-stairs-a` reaches for the next step, `sailor-stairs-b` bears weight. Same distance-driven cadence; direction mirrors the sprite. |
| V: house jumps and falls | Reused one airborne pose. | Velocity selects rise / apex / fall; landing is a brief contact pose. |
| V: stone throw | The procedural fallback had an arm gesture, but delivered art selected standing. | `sailor-throw` represents release, while the game's existing stone projectile continues independently. |
| V: rescuing and carrying the beloved | Dedicated two-person carry cut-out; carrying disables jumps and slows movement. | Retain the established carry pose and the beloved's visibility on every connector and the quay. |

## Sources and fitting

Built-in imagegen produced the poses using the existing standing and leaping
sailor as identity and paint references. Complete generation prompts are in
[prompts.json](prompts.json). The accepted transparent originals are
`originals/air.png` and `originals/climb.png`; the first sheet and its support
frame refinement are retained as superseded takes because their head/body
proportions were too squat. This is a small set of discrete painted poses,
not a captured or interpolated full-body animation.

[prepare.py](prepare.py) separates each connected figure, keeps its alpha,
and uniformly resamples it. It does not warp or repaint body parts. Source
cap-top to beard-bottom measurements are normalized to the standing
reference's approximately 60 art-pixel head height. Measurements and exact
crop, scale and placement are in [fitting.json](fitting.json). The silhouette
height varies naturally with posture; rescaling every figure to the same
bounding-box height would enlarge the squatting sailor.

Each PNG/WebP is 360 × 440, with body axis at x=180 and the lowest boot at
y=440. The game draws these at `standingHeight / 360` scale, preserving aspect
ratio: Act IV uses 110 stage units for standing height, Act V uses 108 in the
cliff/house and 144 on the quay. The figure stays the same anatomical size;
transparent padding and raised hands can extend beyond the standing box.
The visible boot edge sits within two art pixels of that anchor (at most one
stage pixel at the standard scale). Mirroring uses the same anchor. Landing timers are visual state only; jump
physics, collisions and reach are unchanged. The stair/slope facing direction
now follows actual connector movement.

Lossless fitted PNGs are in `delivery/` and `intake/`; quality-94 alpha WebPs
are registered as delivered in the game manifest. The eight runtime assets
total roughly 280 KB and decode to about 4.8 MiB.

## Verification

- Board and all four later-act simulation suites, including full winning
  play-throughs and drawing with and without delivered art, pass.
- `qa/sailor-motion.test.mjs` checks pose selection, paused support frames,
  actual landing contact and expiry, mirroring, aspect ratio, scale and anchors.
- `qa/movement-browser.mjs` loads and decodes all eight real WebPs, draws 16
  representative movement scenes in both print/tint passes, and verifies the
  prior leap fallback with a missing falling asset. No browser errors.
- Game screenshots were inspected for cliff reach, stairs, throw and whale
  landing. Screenshot output and browser records go to ignored
  `local/widowsbay-movement/` when the check runs.
- Part C request generation remains synchronized with the manifest.

```sh
python3 kingdomofthefairies/design/generated/movement-poses/prepare.py
node kingdomofthefairies/qa/sailor-motion.test.mjs
CHROMIUM_PATH=/path/to/chromium node kingdomofthefairies/qa/movement-browser.mjs
```
