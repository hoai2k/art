# The squirrel: model, rig, movement, camera

Design note for the player creature of the Stratford prototype. Status: **prototype player,
good enough to explore the town with**. The owner moved the priority to the town and the scale
systems, so the deep model review and fine animation (foot IK, the full pose library) are
deferred; what is left is listed at the end.

## Which model ships

The prototype ships **this game's own model**, built by `tools/squirrel/build.py` from anatomy
(below), in the **black** coat by default (the owner wants a black squirrel; the black morph is
common in southwestern Ontario). `coat: 'grey'` and `setCoat('grey')` switch to the grey coat.

The finished Wobblers squirrel (`swingers/wobblers/assets/animals/squirrel.*`) was offered as a
quick option. It was not used: it is a 4k-triangle rubber-toy model with one rigid weight per
rig part (body, head, four legs, tail), so it would need re-rigging for a spine, scapulae and a
tail chain anyway, and its cartoon proportions (big head, tall stance) are off-style. Its sheet
(`reference/sheets/provisional/wobblers_squirrel.png`, from the Wobblers' R-series) is used here
only as a measuring tape, and `tools/squirrel/segment.py` is adapted from the Wobblers'
`tools/animals/segment.py` (the owner's code).

## Anatomy and measurements (`tools/squirrel/anatomy.py`)

Adult eastern grey squirrel, ~0.5 kg: head and body 25 cm (nose 15.2 cm .. rump -9.8 cm about
the model origin), tail vertebrae 21 cm, head 6 cm long and 3.4 cm wide, ears 1.4 cm above the
skull, eye 1 cm across set high on the side 3 cm behind the nose, back 9.5-10 cm high standing,
belly 4 cm off the ground, humerus 3.1, radius/ulna 3.3, fore paw 2.1, femur 4.3, tibia 6.0,
hind foot 5.6, scapula 3 cm. Cross-checked against the provisional sheet with
`python3 tools/squirrel/review/grid.py provisional/wobblers_squirrel.png <out.png>` (centimetre
grid in the model frame), correcting the sheet's cartoon head and stance toward real anatomy.

Model frame: +z forward, y up, +x the animal's left, origin on the ground under mid-body.

## Skeleton (39 bones, `THREE.SkinnedMesh`)

`root → pelvis → spine1 (lumbar) → spine2 (thorax) → neck → head → jaw, ear_L/R`;
`spine2 → scap_L/R (shoulder blades) → uarm → farm → hand → fing`;
`pelvis → thigh_L/R → shin → foot → toes`; `pelvis → tail0 … tail11` (21 cm chain).
Rest rotations are identity, so every bone's local axes are the model's.

## How the model is built (`python3 stratford/prototype/tools/squirrel/build.py`, ~10 s)

1. Soft-tissue parts around the bones (anatomy.py `parts`): ellipsoids for haunch, rump, loins,
   chest, breast, cranium, cheeks, nose pad, scapulae, thigh muscle, ears (thin rounded leaves);
   tapered tubes for neck, muzzle, chin, every limb segment, paws and a flattened tail core
   (one tube per tail bone). Each part belongs to a bone and has a blend radius.
2. Signed distance fields, smooth union (polynomial smin, per-part blend), light Gaussian
   smoothing, surface nets on a 1.3 mm grid (~126k triangles), decimated with
   fast-simplification to 13,000 triangles (6,501 vertices).
3. Skin weights from the part fields: for each vertex, soft-min weights over the parts'
   distances, summed per bone, top four kept (blended at the joints).
4. Paint: procedural per-vertex coats for both morphs (grizzled back with a brownish dorsal wash,
   rusty flank band, cheeks and feet, cream belly / throat / chin, eye-ring, pinkish inner ears,
   dark claws, warm under-tail; black: black-brown with a warm sheen on flanks and tail), plus
   per-vertex fur length, hair direction, region and baked occlusion.
5. `--paint sheet` projects the R1.1 / R1.2 turnaround sheets' side and top views onto the
   vertices instead (by normal), with the procedural coat filling what the sheets can't see.

Output `game/assets/squirrel/squirrel.json` + `squirrel.bin` (330 KB; layout in build.py's
docstring). Needs numpy, scipy, Pillow and fast-simplification (installed in the ignored
`local/pylib`: `pip install --target local/pylib fast-simplification`, then delete the numpy it
pulls in there).

At runtime (`src/squirrel/model.js`): the skinned body, 6 fur shells (the skin pushed out along
the normal by the fur length, cut into strands in the shader, pale-tipped on the tail for the
silvery fringe, leaning back with speed), a hair-direction sheen and soft rim term, glossy eyes
with eye-rings, and whiskers on the head bone. 13k + 78k triangles, 4 draw calls.

## Movement (generic, `src/creatures/controller.js`; numbers in `src/squirrel/tuning.js`)

The controller and camera know nothing about squirrels: every length and speed comes from the
tuning table written in multiples of `scale` (0.25 m), so an insect can reuse them with its own
table. Collision goes through `world.collidersNear(box3)` / `world.raycast()` (`collide.js`;
falls back to `world.collider`).

- Body: a capsule (r 4 cm) along the heading; ground found by rays, snapped on slopes.
- Run 4.6 m/s full stick, 7.6 m/s with RT; 0 → 4 m/s in ~0.2 s; turning radius
  `0.1 + 0.11 v²` m (tight pivots when slow, wide arcs flat out); brakes before reversing.
- Leap: 1 m high with A held, ~2.8 m across at a run (gravity 20 m/s²); releasing A early cuts
  the rise (tap ≈ 0.3 m); coyote time 0.1 s, jump buffer 0.13 s; air control 9 m/s².
- Step-up: obstacles up to 36 cm (curbs, steps) are hopped automatically without losing speed;
  higher non-climbable things block and slide.
- Climbing: running or leaping into a climbable surface (`SURFACE` brick, stone, wood, bark,
  branch, fence, and roofs too steep to walk) attaches; the stick moves on the wall (up = up the
  surface, sideways matched to the camera's right); inner corners, outer corners and trunks are
  followed; reaching the top tops out, over a flush wall top or parapet or out and round an
  overhanging eave (up to 60 cm) onto the roof; with nowhere to go (the gap under a roof, an
  overhang too deep) it holds at the top. It never clings to an underside (cornice soffits,
  eaves) except bark and branches. Going down is head-first and walks off at the bottom; A kicks
  away. Smooth walls (glass, stucco) never attach.
- Swimming: in water the body floats low and paddles at 0.9 m/s; A hops out.
- X sits up (any move or X again ends it), Y digs (1.8 s, emits `dig`). Events: `land`,
  `jump`, `climb`, `dig`, `splash`.

### Never through a surface

The town's colliders are thin, open shells: a wall is one quad from below the ground to the
eaves, and pitched roofs are fitted to each footprint's oriented bounding box, so wherever a
footprint isn't an exact rectangle there is a slot between the wall top and the roof. In the
first deployed build the squirrel climbed to a wall top, lost the wall, failed to top out (the
ledge probe started inside the slot), fell, and air control carried it through the slot into the
hollow building ("went through a ceiling"). The rules now:

- Every relocation (attaching, inner and outer corners, topping out, step hops, ground snaps)
  needs a clear straight path from the body's centre to where it goes, or via checked points
  (round an eave: out past the edge, up, over). A step "found" behind a wall is no step.
- A re-found climbing surface must continue where the current one is; a hit much deeper is
  another surface seen through a gap (the inside of a parapet) and counts as lost.
- Substeps are short (under half the body radius of travel), depenetration pushes back to the
  side of a triangle the body came from, never on through it, and after every ordinary step the
  centre's motion is ray-checked: a move that crosses any surface is undone.
- Letting go of a wall steps the feet out one body radius first (on a wall the feet are on its
  surface; in the air the body is above them, so it would straddle the wall).
- In the air it won't fly sideways into a pocket with a roof just overhead and no floor beneath.

## Animation (`src/squirrel/animator.js`, forward kinematics)

Gait by speed with smooth blending: lateral-sequence walk below ~0.9 m/s, half-bound to ~2.6 m/s,
full bound above (hinds nearly together, fores alternating); stride length `0.07 + 0.075 v` m,
frequency up to 8 Hz; spine flexes and extends with the bound cycle, scapulae slide, heels lift
at push-off. Lean into turns, pitch along the leap arc, landing crouch. The tail is a damped
spring per joint toward a per-state curve (S over the back idle, streaming low when running,
straight back in leaps, flat when climbing, trailing when swimming) and swings against turns.
Idle: breathing, blinks, ear twitches, glances, tail flicks. Sit-up with forepaws to the chest
and chewing; dig with scrabbling forepaws, nose down; climbing splays the limbs and turns the
hind feet back going down head-first; swimming paddles.

## Camera (`src/creatures/camera.js`)

A normal follow camera, every length from the creature's tuning (multiples of `scale`):
standard distance 0.85 m (`3.4 x scale`), look-at point 15 cm up, default pitch 0.32 rad (18 deg,
sees ahead over curbs), near plane `0.08 x scale`, collision sphere 5.5 cm (`camProbe`).

- **Follow:** the look-at point rides critically damped springs, integrated exactly for a target
  moving through the frame, so 30, 60 and 144 fps give the same path. 85% of the creature's
  velocity is fed forward, so it trails a sprint by about 0.2 m (a plain spring trails by 1.4 m). In
  the air it follows only a third of the rise, so leaps don't bob the view.
- **Yaw:** the right stick turns it directly, and auto-follow never pulls against it. When the
  stick is let go, a gentle swing behind the heading fades in over about a second. It doesn't
  swing round when running toward the camera. On a wall it turns to face the wall from outside.
- **Pitch:** the player's. Set with the right stick, it is kept while running, turning and
  climbing. Terrain (the real ground under the camera, curbs and paving included) and obstacles
  (a wall or roof edge between it and the squirrel) bend it up for a while. It then returns.
- **Recenter** (R3 click / C): turns behind the squirrel and keeps the player's pitch. That
  keeps a chosen view; the default pitch comes back with a new game or reset settings.
- **Zoom** (hold LB further, RB closer; mouse wheel; hold Z / X): 0 = the standard 0.85 m ..
  1 = far, 5x (4.25 m), smoothed, saved as `settings.zoom`. `controls.zoom` is the change per
  frame (ARCHITECTURE.md).
- **Collision:** a sphere is swept from the look-at point toward the wanted spot. It starts thin
  (a third of the probe) and widens over 25 cm, so a curb beside the squirrel doesn't count. Thin
  things are ignored: props (lamp posts, benches, parked cars), branches, fences. When something
  comes between, it first looks over the top (pitch bend), then pulls in on a fast spring (a few
  frames, no snap) and eases back out slowly. The camera itself never ends inside or touching
  geometry. Each move is checked from its last position, and only a short glitch, like going over
  a roof edge after a fall, may pass a thin surface between two frames. If it's hidden from the
  squirrel for over 0.35 s it cuts to a clear spot. The view direction comes from yaw and pitch,
  not `lookAt`, so it is stable when pulled right in. Closer than 3.5 body radii, the squirrel is
  hidden rather than clipped by the near plane.

**What was buggy** (measured with `tools/squirrel/review/camera-trace.mjs`, plotted with
`camera-plot.py`):
- Landing after a leap snapped the view: acceleration peaks of 196 to 475 m/s^2, from separate
  vertical smoothing rates in the air and on the ground.
- Topping out pulled the camera to 1.5 cm from the squirrel and back (1,339 to 7,322 m/s^2). It was
  clamped at once to the first hit of a sweep from the lagging look-at point, and that point was
  snapped about whenever it touched something.
- Orbiting near props in the town brought it to 4 mm from the squirrel, and `lookAt` then spun the
  view at up to 409 rad/s.
- Running past props popped the distance at up to 19 m/s (7,500 m/s^2).
- Auto-follow pulled the pitch back to the default (0.29 rad of drift with no input).
- `snapBehind` didn't settle the springs.
- Lag depended on the frame rate (up to 0.24 m at 30 fps).

## Checks

- `node --test stratford/prototype/game/test/squirrel.test.mjs` (18 tests, including the camera:
  smooth at 60 and 144 fps and the same path at 30, never inside geometry, the player's pitch
  kept, zoom range, recenter, the stick never fought; earlier ones: registry/contract,
  ground, speeds, turning, leap height/distance, curb, brick wall + roof top-out, glass wall,
  trunk up and down, sit/dig/swim, random-input NaN soak, bench page with a simulated gamepad,
  and climbing real downtown buildings with the body and the camera never inside one; that one
  needs `game/data/town.json` and takes about 3 minutes).
- Camera traces: `node stratford/prototype/tools/squirrel/review/camera-trace.mjs <out.json> [town]`
  (scripted runs at 30 / 60 / 144 fps; `GAME_DIR=<copy>` measures another build), then
  `python3 .../review/camera-plot.py <before.json> <after.json> <out.png>`.
- Climb probe: `node stratford/prototype/tools/squirrel/review/climb-probe.mjs [count] [skip]`
  climbs the nearest `count` brick, stone and wood buildings from the spawn in five scripted
  ways and prints every frame where the squirrel or the camera is inside a building
  (`VERBOSE=1` lists every run).
- Bench: `game/lab/squirrel.html` (stand-in world; `?town=1` loads `src/town/index.js`,
  `?coat=grey`). Debug panel: state, gait, speed, skeleton, slow motion, fur shells, coat.
- Review renders: `node stratford/prototype/tools/squirrel/review/shots.mjs <dir>` writes
  turnaround, gait and action strips and the boards `final_turnaround.png`, `final_gaits.png`,
  `final_actions.png` (never into the repo).

## Tuning knobs

`tuning.js` (speeds, accel, turn radius, jump height and cut, step-up, climb speeds, camera);
`animator.js` (gait thresholds, stride formula, amplitudes, tail curves and spring constants);
`anatomy.py` (every part's position and size, fur lengths); `model.js` `SHELLS`.

## Left to do (the new black squirrel)

- When **R1.2** (black turnaround) and R1.1 / R1.3 / R1.4 arrive in `reference/sheets/`:
  re-measure `anatomy.py` against them with `review/grid.py`, rebuild with
  `--paint sheet --sheet-black squirrel_black_turnaround.png`, and run review rounds
  (turnarounds next to the sheet, 2-3 rounds as in the Wobblers' METHOD.md).
- Model: haunch and shoulder bulk still a little slim; hind legs read long in the rest pose;
  fur shells show strand layering at grazing angles (add tail fin cards); no claws.
- Animation: foot planting with IK onto the ground (feet currently swing by phase and can slide
  at speed changes), hind feet landing ahead of the fores in the bound, two-bone IK on slopes and
  curbs, eating a nut in the sit, scratching, circling a trunk pose, look-at toward the camera's
  interest.

## The other creatures: beaver, cottontail, swan, heron

The player can be any of five creatures (`src/creatures/index.js`: `CREATURES`, `CREATURE_INFO`).
The squirrel keeps its own module; the four others are `src/{beaver,rabbit,swan,heron}/index.js`
on the shared `src/creatures/creature.js` (`creatureTuning(scale, overrides)` derives lengths,
the capsule and the camera from body length; speeds and abilities are set per creature),
`model.js` (loads `assets/<kind>/`; coats, fur shells, eyes, whiskers, feather cards) and
`animators.js` (`createQuadAnimator` with a waddle or hop style; `createBirdAnimator`).
None of them uses the Wobblers squirrel or any outside model: each is built by our own builder.

### Building them

`python3 tools/squirrel/build.py --creature <kind>` loads `anatomy_<kind>.py` (parts, bones,
optional `paint`, `fur_adjust`, `COATS`, `SHEETS`/`SHEET`, `META`, `TRIS`, `GRID`, tail curve)
and writes `game/assets/<kind>/`. Without `--creature` it builds the squirrel, byte for byte as
before. Triangles: beaver 14k, rabbit 12k, swan about 12.3k, heron about 10.3k (the squirrel is
about 12k). The beaver and the rabbit carry fur shells; the birds carry no shells but runtime
feather cards (alpha-tested quads skinned to the humerus, ulna and manus: primaries fanned on
the hand, secondaries, tertials, coverts and a tail fan, from `META.wings`).

- **Beaver** (0.8 m with tail): measured from anatomy texts and open photos. The tail is a broad,
  flat paddle (`TAIL_XS` 3.6, `TAIL_YS` 0.4), webbed hind feet, orange incisors, short dense fur.
- **Cottontail** (0.4 m): long hind feet, large upright ears with pink insides, white scut.
- **Mute swan** (1.4 m): measured on the delivered `reference/sheets/swan_turnaround.png`
  (2.07 mm per pixel, the waterline at 0.36 m), orange bill with the black knob, S-neck.
- **Great blue heron** (1.0 m tall): slate-grey body, white face with the black plume,
  yellow dagger bill, long legs; built from anatomy and open photos.

### What to redo when the round-9 sheets land

- **R9.1/R9.2 beaver, R9.3/R9.4 rabbit, R9.7/R9.8 heron:** re-measure each `anatomy_<kind>.py`
  against the turnaround with `review/grid.py` (parts, bone pivots, the beaver's tail length and
  width, the rabbit's ear length and hind foot, the heron's neck segments and leg lengths), then
  check `SHEET` (`body`, `rump_u`; the beaver's `rump_u` is a guess) and rebuild with
  `--paint sheet`, which projects the side and top views onto the coat and keeps the procedural
  paint for what the sheet can't see.
- **R9.5 swan pose sheet:** check the walking, swimming and take-off poses in `animators.js`
  (neck pose, wing lift, the paddle stroke).
- **R9.6 swan flying and R9.9 heron flying (top views):** lay out `META.wings` from them (span,
  primary count and fan, secondary length, covert rows) and check the wing bone lengths.
  The folded wing is today the humerus scaled into the body's wing bulk.
- **R9.10 portraits:** `ui/creatures.png`, five medallions in a row in `CREATURE_INFO` order,
  replaces the painted stand-ins in `src/ui/creature-select.js` without code changes.
- Then two or three review rounds with `review/creature-shots.mjs` (below), as for the squirrel.

### How each one moves

| | Ground | Water | Air | Abilities |
| --- | --- | --- | --- | --- |
| Beaver | waddle (run 1.3 m/s), slow gallop on RT (3.2) | swims at the surface (1.7); A dives (2.0 m/s, down to 1.4 m, 60 s breath), A again surfaces | small jump | Y gnaws; no climbing |
| Cottontail | hops from a slow hop to a bound (3.5, sprint 11), sharp turns and zig-zags | swims poorly (0.45) and after 3 s heads for the nearest bank | big jumps (2× body length) | no climbing |
| Mute swan | awkward waddle (0.9, 2.6) | graceful swim (1.3) | hold A to run (on land or water) and take off at 6.5 m/s; fly 15 m/s, RT to 21; A flaps to climb, release to glide; stick steers and banks; lands on water or ground | — |
| Great blue heron | stately walk (0.7, 1.7) with a head bob | wades to 0.42 m deep, never swims (the deep water stops it) | A takes off from standing with wingbeats; flies 9 m/s, RT 13, neck folded, legs trailing; glides, lands on roofs and trees | perches |

Swimming, diving, wading and flight are generic modes of `src/creatures/controller.js` (states
`swim`, `dive`, `fly`), switched on by tuning: `canSwim`, `swimTire`, `canDive`/`diveSpeed`/
`diveDepth`/`breath`, `wadeDepth`, `canFly`, `takeoffSpeed` (0 = take off standing), `flySpeed`,
`flySprint`, `flyMin`, `flyAccel`, `flyClimb`, `glideSink`, `flyTurn`. Pulling the stick back in
flight slows and steepens the descent, which is how a landing is aimed. In flight the camera
(`camera.js`) springs to a further (`camFlyMul`, 1.8 to 1.9) and higher view and banks with the
turn; its sphere sweep against buildings and trees is the same as on foot.

### Superspeed (all creatures)

Holding LT (analog) or Q multiplies speed on the ground, swimming, diving, climbing and flying
up to `boostMax` (10). The controller substeps by distance (up to 400 substeps a frame), so a
creature at 10× never crosses a surface; the camera's velocity feed-forward and step detection
scale with the boost, so it neither lags nor pops. In the real town at 76 m/s along Ontario
Street the colliders were ready at least 260 m ahead in every frame (0 misses in 720 frames).

### Choosing a creature

The pause menu and Settings open the "Choose a creature" panel (`src/ui/creature-select.js`).
A switch fades out, swaps the creature, sets the world's scale, waits for `ready` and fades in
at the nearest safe spot (the heron is moved out of deep water). The choice is saved
(`settings.creature`); `?creature=<kind>` overrides it. Nuts are a squirrel thing; discovered
landmarks are shared.

### Checks and review

- `node --test stratford/prototype/game/test/creatures.test.mjs` (8 tests: registry and contract,
  each creature's moves in the stand-in yard, superspeed without tunnelling and with the camera
  never inside geometry, a random-input NaN soak for all five, and superspeed through the real
  town with the chunks ready ahead).
- `node stratford/prototype/game/scripts/browser-check.mjs` covers the creature select (pause
  menu, switching to the heron, the saved swan at boot) and LT/Q.
- `node stratford/prototype/tools/squirrel/review/creature-shots.mjs <dir> [kind ...]` renders
  `<kind>_turnaround.png` and `<kind>_gaits.png` boards (never into the repo).
