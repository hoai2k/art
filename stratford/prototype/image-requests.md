# Stratford prototype: image requests

Images for the Stratford squirrel prototype (`stratford/prototype/`). The game
draws a procedural stand-in for every one of them, so nothing here blocks play:
each delivery is an upgrade. Drop finished files in
[`stratford/intake/`](../intake/README.md) under the **File** name given; they
are moved to the path shown and the request's status is set to `delivered`.

Status key: `open` (please generate), `delivered`, `dropped`.

## Style for the whole game: autumn storybook realism

A different look from the Wobblers' rubber toys. Think of a finely painted
picture book of a real small town, brought into 3D:

- **Real anatomy and real architecture, gently simplified.** The squirrel has a
  true eastern grey squirrel's proportions (long body, big hind feet, a tail as
  long as the body, large dark eyes set on the side of the head); no chibi
  proportions, no big cartoon eyes, no human smile. Buildings are the real
  Victorian brick and stone of downtown Stratford, Ontario, simplified into
  clear shapes.
- **Painted, not photographic.** Soft gouache-like brushwork, visible but fine;
  colours slightly warm and harmonious; detail kept to what reads at a glance.
  No photo textures, no lens effects, no noise.
- **Season and light:** mid-October in southwestern Ontario. Maples in red,
  orange and gold, oaks in brown, lawns still green, fallen leaves on the
  ground. Low, warm afternoon sun from the side, cool blue-violet shade.
- **Never:** text that isn't asked for, real business names or logos, the
  Stratford Festival's logo or wordmark, watermarks, people's faces.

## Formats

- **Reference sheets** (`stratford/prototype/reference/sheets/`): 1920 × 1080,
  plain light-grey background, soft even studio light, no ground shadows
  touching other views, no text. Never loaded by the game; used as a measuring
  tape and paint source when building models (the same method as the Wobblers'
  animals: `swingers/wobblers/tools/animals/METHOD.md`).
- **Tiling textures** (`game/assets/textures/`): 1024 × 1024, PNG, seamless on
  all four edges, seen square-on with no perspective and no baked shadows from
  a direction (only soft ambient-occlusion in the cracks). Real-world size given
  in each request so the game can scale them.
- **Facade elevations** (`game/assets/facades/`): 1024 × 1024 PNG, a flat
  orthographic front elevation of a whole building front filling the frame edge
  to edge, ground at the bottom edge, roofline at the top edge; no sky, no
  ground, no perspective, no people, no cars. The game wraps them onto the
  block faces.
- **Cutouts** (`game/assets/sprites/`): PNG on a flat `#FF00FF` magenta
  background (keyed out on delivery), the object filling most of the frame.
- **UI art** (`game/assets/ui/`): as given in the request.

---

## Round 1: reference sheets (please generate these first)

These shape the models. **R1.2, the black squirrel, matters most**: the game's own squirrel will be a black one, modelled from that sheet (the prototype may run on the Wobblers' squirrel until then). R1.1 (grey) is the alternative coat.

### R1.1 Eastern grey squirrel turnaround — `delivered`
- **File:** `squirrel_grey_turnaround.png` → `reference/sheets/squirrel_grey_turnaround.png`
- **Size:** 1920 × 1080
- **Prompt:** Character turnaround sheet of one adult eastern grey squirrel
  (Sciurus carolinensis), the same animal shown three times side by side at the
  same scale on a plain light grey background. Left: exact side view facing
  right. Middle: exact top-down view, head toward the right, legs spread a
  little so all four feet show. Right: three-quarter front view. Neutral
  standing pose on all fours, tail raised in a loose S-curve over the back but
  not touching the body, so its shape reads clearly. Accurate adult anatomy:
  body about 25 cm long, tail about as long again, big hind feet, slim
  forelegs, rounded head, large dark eyes with a pale eye-ring, small rounded
  ears. Coat: grizzled grey back with a warm rusty-brown wash along the flanks,
  face and feet, a clean white-cream belly, the tail grey with a silvery-white
  fringe. Painted storybook realism: soft gouache brushwork, fur suggested in
  broad strokes, no fine hair detail; not cute, not chibi, no smile. Soft even
  studio light, no text.

### R1.2 Black squirrel turnaround (Stratford's black morph) — `delivered`
- **File:** `squirrel_black_turnaround.png` → `reference/sheets/squirrel_black_turnaround.png`
- **Size:** 1920 × 1080
- **Prompt:** The same layout and pose as R1.1 (side view facing right, top
  view head right, three-quarter front view, light grey background), of the
  black colour morph of the eastern grey squirrel that is common in
  southwestern Ontario: glossy black-brown all over, a faint warm brown sheen
  on the flanks and tail, dark eyes with a thin pale eye-ring, tail fur tipped
  very slightly lighter. Same painted storybook realism, same anatomy and
  proportions as a real grey squirrel. No text.

### R1.3 Squirrel pose sheet — `delivered`
- **File:** `squirrel_poses.png` → `reference/sheets/squirrel_poses.png`
- **Size:** 1920 × 1080
- **Prompt:** A model sheet of one eastern grey squirrel in eight poses, all
  seen exactly side-on facing right, at the same scale, in two rows of four on
  a plain light grey background, evenly spaced and not overlapping: (1) sitting
  upright on its haunches holding an acorn to its mouth with its front paws,
  tail curled up behind its back; (2) alert, standing tall on its hind legs,
  front paws held against its chest; (3) running bound, gathered: hind feet
  landing ahead of the front feet, back arched, tail streaming behind; (4)
  running bound, extended: body stretched long, front legs reaching forward,
  hind legs pushing off behind; (5) a leap in mid-air, all four legs spread
  wide and tail straight out behind for balance; (6) landing, front paws
  touching down first, tail swinging up; (7) clinging head-down on a vertical
  tree trunk, hind feet turned backwards, tail flat against the bark; (8)
  digging, nose down, front paws scrabbling at the ground, tail up. Accurate
  anatomy, painted storybook realism, no text.

### R1.4 Squirrel head close-up — `delivered`
- **File:** `squirrel_head.png` → `reference/sheets/squirrel_head.png`
- **Size:** 1920 × 1080
- **Prompt:** Close-up model sheet of an eastern grey squirrel's head, three
  views side by side on a plain light grey background: exact side profile
  facing right, exact front view, exact top view nose right. Shows the large
  dark eye with a pale cream eye-ring, the small rounded ears with a short tuft,
  the whiskers, the split upper lip, the cream throat and the rusty cheeks.
  Painted storybook realism, accurate anatomy, no text.

### R1.5 Mute swan turnaround (the swans on the Avon) — `delivered`
- **File:** `swan_turnaround.png` → `reference/sheets/swan_turnaround.png`
- **Size:** 1920 × 1080
- **Prompt:** Turnaround sheet of one adult mute swan swimming, three views side
  by side at the same scale on a plain light grey background: exact side view
  facing right, exact top view head right, three-quarter front view. Neck in a
  graceful S-curve, wings folded and slightly raised, orange bill with a black
  knob. Show the waterline as a faint flat line only. Painted storybook
  realism, no text.

### R1.6 Canada goose turnaround — `delivered`
- **File:** `goose_turnaround.png` → `reference/sheets/goose_turnaround.png`
- **Size:** 1920 × 1080
- **Prompt:** Turnaround sheet of one Canada goose standing on grass, three
  views side by side at the same scale on a plain light grey background: exact
  side view facing right, exact top view head right, three-quarter front view.
  Black neck and head with the white chin strap, brown-grey body, pale breast,
  black legs. Painted storybook realism, no text.

---

## Round 2: textures for the town

Tiling, 1024 × 1024, painted storybook realism (see Formats).

| # | File | Real size | Prompt |
|---|---|---|---|
| T2.1 | `textures/brick_red.png` | 2 m × 2 m | Seamless tiling texture of old red-orange Ontario clay brick in running bond, slightly irregular bricks with soft colour variation, pale grey lime mortar, a little weathering; painted storybook realism, flat front-on, no shadows. Status: `delivered` |
| T2.2 | `textures/brick_buff.png` | 2 m × 2 m | Seamless tiling texture of the pale buff-yellow "white brick" typical of 19th-century southwestern Ontario, running bond, warm cream to honey bricks, pale mortar, light weathering; painted, flat front-on. Status: `delivered` |
| T2.3 | `textures/stone_ashlar.png` | 2 m × 2 m | Seamless tiling texture of dressed grey-beige limestone ashlar blocks with thin joints, as on a Victorian courthouse or church; painted, flat front-on. Status: `delivered` |
| T2.4 | `textures/clapboard.png` | 2 m × 2 m | Seamless tiling texture of painted horizontal wooden clapboard siding, soft off-white paint, gentle wear; painted, flat front-on. Status: `delivered` |
| T2.5 | `textures/roof_shingles.png` | 3 m × 3 m | Seamless tiling texture of dark grey-brown asphalt roof shingles in staggered rows, seen square-on; painted. Status: `delivered` |
| T2.6 | `textures/roof_metal.png` | 3 m × 3 m | Seamless tiling texture of a weathered standing-seam metal roof, dull grey-green with vertical seams; painted. Status: `delivered` |
| T2.7 | `textures/roof_slate.png` | 3 m × 3 m | Seamless tiling texture of a Victorian slate roof, blue-grey slates with a band of fish-scale slates; painted. Status: `delivered` |
| T2.8 | `textures/asphalt.png` | 4 m × 4 m | Seamless tiling texture of worn street asphalt seen from directly above, dark grey with fine aggregate, a few patched cracks, a scattering of fallen maple leaves; painted. Status: `delivered` |
| T2.9 | `textures/sidewalk.png` | 3 m × 3 m | Seamless tiling texture of a concrete sidewalk seen from above, square slabs 1.5 m with control joints, pale warm grey, a few leaves; painted. Status: `delivered` |
| T2.10 | `textures/grass_autumn.png` | 4 m × 4 m | Seamless tiling texture of a mown green lawn in October seen from above, with scattered fallen red, orange and yellow maple leaves; painted. Status: `delivered` |
| T2.11 | `textures/leaf_litter.png` | 3 m × 3 m | Seamless tiling texture of thick autumn leaf litter under trees seen from above: maple, oak and linden leaves in red, orange, gold and brown; painted. Status: `delivered` |
| T2.12 | `textures/bark_maple.png` | 1 m × 2 m | Seamless tiling texture of mature sugar maple bark, grey with long vertical plates and furrows, seen front-on; painted. Must tile horizontally and vertically. Status: `delivered` |
| T2.13 | `textures/bark_willow.png` | 1 m × 2 m | Seamless tiling texture of old weeping willow bark, deep criss-cross furrows, grey-brown; painted. Status: `delivered` |
| T2.14 | `textures/gravel_path.png` | 3 m × 3 m | Seamless tiling texture of a fine crushed-limestone park path seen from above, pale tan; painted. Status: `delivered` |
| T2.15 | `textures/water_avon.png` | 8 m × 8 m | Seamless tiling texture of calm river water seen from above, deep green-blue with soft ripples and a few floating leaves; painted. Status: `delivered` |

## Round 3: facade elevations (downtown blocks)

1024 × 1024 each, flat front elevations as described in Formats. Generic
buildings in the spirit of downtown Stratford (Ontario Street, Downie Street,
Wellington Street, Market Square), not copies of specific buildings, with no
readable business names: shop signs are blank boards or a single painted
symbol (a teacup, a book, scissors, a loaf).

| # | File | Prompt |
|---|---|---|
| F3.1 | `facades/commercial_red_3storey.png` | Front elevation of a three-storey 1880s Italianate commercial block in red brick, two shopfronts at street level with large display windows, recessed doors and a blank sign band, tall round-arched upper windows with stone hoods, a bracketed cornice at the top. Status: `delivered` |
| F3.2 | `facades/commercial_buff_2storey.png` | Front elevation of a two-storey Victorian commercial building in buff-yellow brick, one wide shopfront with a green-and-cream striped awning, segmental-arched upper windows, a simple corbelled brick cornice. Status: `delivered` |
| F3.3 | `facades/commercial_red_2storey_narrow.png` | Front elevation of a narrow two-storey red brick shop, a single shopfront with a painted wooden frame in deep blue, a blank sign board, two tall upper windows, a pressed-metal cornice. Status: `delivered` |
| F3.4 | `facades/commercial_stone_bank.png` | Front elevation of a small Edwardian bank building in grey limestone, a central arched doorway, two tall windows, pilasters and a plain pediment, no lettering. Status: `delivered` |
| F3.5 | `facades/commercial_corner_red_3storey.png` | Front elevation of a three-storey Victorian corner block in red brick with a canted corner entrance, shop windows, a row of paired upper windows and a heavy bracketed cornice. Status: `delivered` |
| F3.6 | `facades/commercial_painted_2storey.png` | Front elevation of a two-storey 1900s storefront whose brick is painted cream, a bay window on the upper floor, a burgundy awning over the shop window, a blank sign band. Status: `delivered` |
| F3.7 | `facades/house_italianate_buff.png` | Front elevation of a two-storey Italianate house in buff-yellow brick, tall windows with arched hoods, a front porch with turned posts, a low hipped roof with paired brackets. Status: `delivered` |
| F3.8 | `facades/house_ontario_cottage_red.png` | Front elevation of a one-and-a-half-storey Ontario Gothic cottage in red brick with a steep central gable with a pointed window, gingerbread bargeboard, a front door with sidelights and a window either side. Status: `delivered` |
| F3.9 | `facades/house_clapboard_gable.png` | Front elevation of a two-storey front-gabled wooden house with white clapboard, a full-width front porch, double-hung windows with dark green shutters. Status: `delivered` |
| F3.10 | `facades/house_queen_anne_red.png` | Front elevation of a Queen Anne style red brick house with a corner turret, a wrap-around porch, fish-scale shingles in the gable, and a stained-glass transom. Status: `delivered` |
| F3.11 | `facades/side_wall_red.png` | Elevation of the plain side wall of a three-storey red brick commercial building: a few small windows, a faded painted-over ghost sign with no readable words, a metal fire escape. Status: `delivered` |
| F3.12 | `facades/back_lane.png` | Elevation of the back of a row of brick commercial buildings: mismatched doors, small windows, utility meters, a wooden stair, downspouts. Status: `delivered` |

## Round 4: cutouts and props

On a flat `#FF00FF` background (keyed out on delivery).

| # | File | Size | Prompt |
|---|---|---|---|
| S4.1 | `sprites/maple_leaf_cluster.png` | 1024 × 1024 | A cluster of sugar maple leaves on thin twigs in autumn red, orange and gold, seen from the side, dense enough to read as foliage, for tree canopies; painted storybook realism. Status: `delivered` |
| S4.2 | `sprites/oak_leaf_cluster.png` | 1024 × 1024 | A cluster of red oak leaves in russet and brown on twigs, for tree canopies; painted. Status: `delivered` |
| S4.3 | `sprites/willow_strands.png` | 1024 × 1024 | Long hanging strands of weeping willow leaves in yellow-green turning gold, for the willows along the Avon; painted. Status: `delivered` |
| S4.4 | `sprites/spruce_bough.png` | 1024 × 1024 | A dark green spruce bough seen from the side, for conifer canopies; painted. Status: `delivered` |
| S4.5 | `sprites/fallen_leaves.png` | 1024 × 1024 | Twelve separate single fallen leaves laid out in a grid (maple red, maple orange, maple gold, oak brown, linden yellow, ...), each whole and not touching; painted. Status: `delivered` |
| S4.6 | `sprites/nuts.png` | 1024 × 1024 | Six separate nuts and seeds in a row, not touching: an acorn with its cap, a black walnut in its green husk, a shelled black walnut, a hickory nut, a horse chestnut (conker), a sunflower seed head; painted storybook realism. Status: `delivered` |
| S4.7 | `sprites/flower_planter.png` | 1024 × 1024 | A rectangular wooden street planter overflowing with orange and purple mums and trailing ivy, three-quarter view; painted. Status: `delivered` |

## Round 5: title and interface

| # | File | Size | Prompt |
|---|---|---|---|
| U5.1 | `ui/logo.png` | 2048 × 1024, transparent | Title logo reading exactly **Stratford Squirrel**, in warm cream hand-lettered serif capitals with a fine dark outline, the words on two lines, a small eastern grey squirrel sitting on the first S holding an acorn and a few red maple leaves drifting past; painted storybook style; spelled exactly; transparent background. Status: `delivered` |
| U5.2 | `ui/title_backdrop.png` | 1920 × 1080 | A wide painted storybook view of downtown Stratford, Ontario in October from just above street level: a row of Victorian brick shopfronts and a red-brick town hall tower in the distance, maple trees in full red and gold, fallen leaves, warm late-afternoon sun; the lower middle third kept calm for the title; no people, no readable signs. Status: `delivered` |
| U5.3 | `ui/icon.png` | 1024 × 1024 | App icon: the head and raised tail of an eastern grey squirrel in profile against a round maple-red background, painted, simple, readable when small, no text. Status: `delivered` |
| U5.4 | `ui/map_parchment.png` | 2048 × 2048 | A sheet of warm parchment paper with soft deckled edges and faint stains, empty, for the town map; painted. Status: `delivered` |

## Delivery — 2026-11-01

All 44 requested PNGs generated with built-in image_gen and saved at the paths above. Cutouts have native alpha transparency rather than a magenta key. Delivery dimensions, PNG decoding, and alpha channels verified; full set visually reviewed in a contact sheet. Prompts are recorded in `generation-prompts.json`. Texture edge continuity and facade projection still need an in-game material check; some facade artwork includes small foreground details. No playable prototype exists in this checkout to perform that check.

---

## Round 6: close-up ground detail for small creatures

The world changes its detail with the creature's size (see "Many creatures,
many scales" in `ARCHITECTURE.md`): a squirrel sees curbs and leaves, an ant
sees grains of soil and blades of grass. These are for the close-up detail
layers. Same painted storybook realism, same October light. Tiling textures
1024 × 1024 seamless; cutouts on transparent or flat `#FF00FF`.

| # | File | Real size | Prompt |
|---|---|---|---|
| D6.1 | `textures/soil_closeup.png` | 20 cm × 20 cm | Seamless tiling texture of garden soil seen from directly above at very close range: dark brown crumbly earth with tiny grains, small pebbles, a few rootlets and bits of decayed leaf; painted, no shadows from a direction. Status: `delivered` |
| D6.2 | `textures/grass_roots_closeup.png` | 20 cm × 20 cm | Seamless tiling texture of the ground at the base of a lawn seen from above at very close range: soil, moss, the bases of grass stems, a clover leaf, a fallen maple seed; painted. Status: `delivered` |
| D6.3 | `textures/moss.png` | 30 cm × 30 cm | Seamless tiling texture of a cushion of green moss seen from above at close range, tiny star-shaped shoots, a few tiny fallen leaf fragments; painted. Status: `delivered` |
| D6.4 | `textures/concrete_closeup.png` | 30 cm × 30 cm | Seamless tiling texture of weathered sidewalk concrete seen from above at very close range: exposed aggregate, fine cracks, a little grit and a speck of lichen; painted. Status: `delivered` |
| D6.5 | `textures/asphalt_closeup.png` | 30 cm × 30 cm | Seamless tiling texture of road asphalt seen from above at very close range: black binder and grey-brown stones of different sizes, grit in the gaps; painted. Status: `delivered` |
| D6.6 | `textures/bark_closeup.png` | 30 cm × 60 cm | Seamless tiling texture of maple bark at very close range, deep furrows and ridges with a patch of pale green lichen; painted, front-on. Status: `delivered` |
| D6.7 | `sprites/grass_blades.png` | 1024 × 1024 | Twenty separate single blades and stems of lawn grass and weeds, upright, not touching, in greens with a few straw-coloured dry ones, including a dandelion leaf, a plantain leaf and a clover stem with three leaves; painted, transparent background. Status: `delivered` |
| D6.8 | `sprites/pebbles.png` | 1024 × 1024 | Sixteen separate small pebbles and stones seen from above, not touching: grey limestone, tan sandstone, a pink granite chip, a dark basalt one, rounded and angular; painted, transparent background. Status: `delivered` |
| D6.9 | `sprites/litter_bits.png` | 1024 × 1024 | Sixteen separate tiny things found on the ground, not touching: maple keys (samaras), a broken acorn cap, a twig, a pine needle cluster, a seed husk, a bit of bark, a feather, a beech nut, a crumpled dry leaf, a tiny snail shell; painted, transparent background. Status: `delivered` |

## Round 7: more of the town

| # | File | Size | Prompt |
|---|---|---|---|
| F7.1 | `facades/church_stone_gothic.png` | 1024 × 1024 | Flat front elevation of a Victorian Gothic Revival church in grey-buff stone with a central pointed-arch doorway, a large pointed window with tracery above it and buttresses at the corners, the roofline at the top edge (the tower is built separately); edge to edge, no sky, no ground, no trees. Status: `delivered` |
| F7.2 | `facades/commercial_buff_3storey.png` | 1024 × 1024 | Flat front elevation of a three-storey 1870s commercial block in buff-yellow brick, two shopfronts with dark green wooden frames, segmental-arched upper windows with keystones, a heavy wooden bracketed cornice; edge to edge, no sky, no ground, no trees, no readable signs. Status: `delivered` |
| F7.3 | `facades/commercial_modern_1960s.png` | 1024 × 1024 | Flat front elevation of a plain two-storey 1960s commercial infill building in tan brick with a wide aluminium-framed shop window and a band of horizontal upper windows, blank sign band; edge to edge, no sky, no ground, no readable signs. Status: `delivered` |
| F7.4 | `facades/house_buff_cottage.png` | 1024 × 1024 | Flat front elevation of a one-and-a-half-storey buff-brick Ontario cottage with a centre door, a window either side and a small centre gable, edge to edge with the roofline at the top, the ground line at the bottom edge, no garden, no trees, no sky. Status: `delivered` |
| F7.5 | `facades/garage_side.png` | 1024 × 1024 | Flat elevation of a plain wooden garage or shed wall in weathered grey-green boards with one small window and a door, edge to edge, no sky, no ground. Status: `delivered` |
| K7.6 | `ui/sky_autumn.png` | 4096 × 2048 | Equirectangular 360° sky for a game: a clear mid-October afternoon over flat southwestern Ontario, soft warm blue overhead fading to pale gold near the horizon, a few soft cumulus clouds, the sun low in the west-southwest (left of centre) with a gentle glow; no ground, no buildings, no birds; the bottom half fades to a warm haze; painted storybook style; must wrap seamlessly at the left and right edges. Status: `delivered` |

Facade notes from round 3, kept for next time: the delivered fronts are lovely,
but several include sky above the roofline, bushes and trees at the base or
white margins; the game crops them. New facade requests above say "edge to
edge, no sky, no ground, no trees" more firmly.

## Rounds 6–7 delivery — 2026-11-01

All 15 new images delivered at the listed asset paths with built-in image_gen; prompts recorded in `generation-prompts-rounds-6-7.json`. PNG integrity and requested dimensions verified, including the 4096 × 2048 sky; all three cutout sheets have native alpha. Full set visually reviewed, web copies and manifest rebuilt and checked. Seamless tiling and sky wrapping remain subject to in-game material review. Assets only; no deployment.

## Round 8: a facade kit for modelled building fronts

Playing the prototype showed that painting a whole building front onto a flat
wall reads badly up close (painted depth, sky peeking over the roofline). The
fronts are now modelled in 3D: real recessed windows and doors, sills, hoods,
cornices, brackets, storefronts and awnings, built per building from its data.
These are the textures for those parts. Each is a **flat, square-on, edge to
edge** picture of one part, with no surrounding wall, no sky, no ground, no
shadows cast from a direction. The game cuts them to fit, so keep each item
centred and filling its cell.

| # | File | Size | Prompt |
|---|---|---|---|
| K8.1 | `kit/windows_victorian.png` | 2048 × 1024 | A sheet of 8 separate Victorian window units in a 4 × 2 grid on transparent background, each square-on and filling its cell, the glass a dark reflective blue-grey with a soft sky reflection and a hint of lace curtain, painted wooden sashes: tall two-over-two round-arched, tall two-over-two segmental-arched, tall one-over-one flat-topped, paired round-arched, a bay-window front panel, an attic half-round window, a pointed Gothic window with simple tracery, a small square basement window. Painted storybook realism. Status: `open` |
| K8.2 | `kit/shopfronts.png` | 2048 × 1024 | A sheet of 4 separate Victorian shopfront units side by side on transparent background, each square-on and filling its cell: large plate-glass display windows over a low panelled base, a recessed glazed door with a transom, slim cast-iron columns, the glass showing a soft warm-lit shop interior with shelves and goods out of focus, no readable lettering. Frames painted in deep green, oxblood red, navy and black respectively. Status: `open` |
| K8.3 | `kit/doors.png` | 2048 × 1024 | A sheet of 6 separate front doors with their frames on transparent background in a 3 × 2 grid, square-on: a panelled oak door with a fanlight, a green door with sidelights, a red Victorian door with an arched transom, a double church door with iron hinges in a pointed arch, a plain glazed commercial door, a weathered back-lane door. Status: `open` |
| K8.4 | `kit/cornices.png` | 2048 × 1024 | A sheet of 4 horizontal strips stacked one above another on transparent background, each a seamless horizontally tiling front elevation of a Victorian cornice about 1 m tall: a wooden bracketed cornice painted cream with paired scroll brackets, a pressed-metal cornice in dark green with dentils, a corbelled brick cornice in red brick, a stone cornice with a moulded profile. Must tile left to right. Status: `open` |
| K8.5 | `kit/trim.png` | 2048 × 1024 | A sheet of 8 separate architectural trim pieces on transparent background in a 4 × 2 grid, square-on: a stone window hood with keystone (arched), a segmental brick arch with keystone, a flat stone lintel, a stone sill, a cream-painted wooden window surround, a pair of decorative scroll brackets, a sign band panel (blank, framed), a carved gable bargeboard section. Status: `open` |
| K8.6 | `kit/awnings.png` | 2048 × 1024 | A sheet of 4 separate shop awning fabrics, flat and square-on, edge to edge, each filling a quarter of the sheet side by side: green and cream stripes, oxblood red plain with a scalloped edge, navy with a thin white stripe, burnt orange plain; slightly weathered canvas. Status: `open` |
