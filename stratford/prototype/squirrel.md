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

Low follow at 0.75 m (`3 × scale`), look point 12 cm up, right-stick orbit, auto-swing behind
the heading when moving, recenter (R-stick click / C), pull-back and FOV 55° → 63° with speed;
while climbing it keeps world-up and swings out to face the wall. Near plane `0.08 × scale`.
Collision: the look-at point must be in the open and seen straight from the squirrel's body (the
smoothed, lagging point could otherwise cut through a roof corner); the camera is a 5.5 cm
sphere (`camProbe`, well over the near plane's half-diagonal) swept from there to where it wants
to be through `world.collidersNear`, stopping at the first touch: it pulls in at once and eases
back out. It applies `controls.look` as given (`pitch -= look[1]`); invert-Y is the input
layer's setting.

## Checks

- `node --test stratford/prototype/game/test/squirrel.test.mjs` (13 tests: registry/contract,
  ground, speeds, turning, leap height/distance, curb, brick wall + roof top-out, glass wall,
  trunk up and down, sit/dig/swim, random-input NaN soak, bench page with a simulated gamepad,
  and climbing real downtown buildings with the body and the camera never inside one; that one
  needs `game/data/town.json` and takes about 3 minutes).
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
