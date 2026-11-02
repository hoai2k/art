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
| K8.1 | `kit/windows_victorian.png` | 2048 × 1024 | A sheet of 8 separate Victorian window units in a 4 × 2 grid on transparent background, each square-on and filling its cell, the glass a dark reflective blue-grey with a soft sky reflection and a hint of lace curtain, painted wooden sashes: tall two-over-two round-arched, tall two-over-two segmental-arched, tall one-over-one flat-topped, paired round-arched, a bay-window front panel, an attic half-round window, a pointed Gothic window with simple tracery, a small square basement window. Painted storybook realism. Status: `delivered` |
| K8.2 | `kit/shopfronts.png` | 2048 × 1024 | A sheet of 4 separate Victorian shopfront units side by side on transparent background, each square-on and filling its cell: large plate-glass display windows over a low panelled base, a recessed glazed door with a transom, slim cast-iron columns, the glass showing a soft warm-lit shop interior with shelves and goods out of focus, no readable lettering. Frames painted in deep green, oxblood red, navy and black respectively. Status: `delivered` |
| K8.3 | `kit/doors.png` | 2048 × 1024 | A sheet of 6 separate front doors with their frames on transparent background in a 3 × 2 grid, square-on: a panelled oak door with a fanlight, a green door with sidelights, a red Victorian door with an arched transom, a double church door with iron hinges in a pointed arch, a plain glazed commercial door, a weathered back-lane door. Status: `delivered` |
| K8.4 | `kit/cornices.png` | 2048 × 1024 | A sheet of 4 horizontal strips stacked one above another on transparent background, each a seamless horizontally tiling front elevation of a Victorian cornice about 1 m tall: a wooden bracketed cornice painted cream with paired scroll brackets, a pressed-metal cornice in dark green with dentils, a corbelled brick cornice in red brick, a stone cornice with a moulded profile. Must tile left to right. Status: `delivered` |
| K8.5 | `kit/trim.png` | 2048 × 1024 | A sheet of 8 separate architectural trim pieces on transparent background in a 4 × 2 grid, square-on: a stone window hood with keystone (arched), a segmental brick arch with keystone, a flat stone lintel, a stone sill, a cream-painted wooden window surround, a pair of decorative scroll brackets, a sign band panel (blank, framed), a carved gable bargeboard section. Status: `delivered` |
| K8.6 | `kit/awnings.png` | 2048 × 1024 | A sheet of 4 separate shop awning fabrics, flat and square-on, edge to edge, each filling a quarter of the sheet side by side: green and cream stripes, oxblood red plain with a scalloped edge, navy with a thin white stripe, burnt orange plain; slightly weathered canvas. Status: `delivered` |

## Round 8 delivery — 2026-11-01

All six building-kit sheets delivered to `game/assets/kit/` with built-in image_gen. PNG decoding, 2048 × 1024 dimensions, five native alpha channels, and sheet layouts checked. Web build now includes full-width kit sheets; prompts recorded in `generation-prompts-round-8.json`. Cornice strips retain transparent end margins and need cropping before horizontal repetition. No deployment.

Validation: 19 shell/town-data tests passed and web-copy check passed (59 images). Browser checks could not run because Playwright is not installed in this checkout.

## Round 9: more creatures to play

New playable creatures beside the squirrel: a beaver, a rabbit, a swan and a
great blue heron, all animals you'd meet along the Avon in Stratford. Each is
modelled the same way as the squirrel (anatomy placed on a reference sheet,
then rigged and animated), so these sheets are the measuring tape and paint.
Same formats as Round 1: 1920 × 1080, plain light grey background, soft even
studio light, no text, no ground shadows touching other views, the same animal
at the same scale in every view. Painted storybook realism with accurate adult
anatomy; not cute, not chibi, no smiles.

### R9.1 North American beaver turnaround — `delivered`
- **File:** `beaver_turnaround.png` → `reference/sheets/beaver_turnaround.png`
- **Prompt:** Turnaround sheet of one adult North American beaver (Castor canadensis), three views side by side at the same scale: exact side view facing right, exact top view head right, three-quarter front view. Standing on all fours on land in a neutral walking pose, all four feet visible. Heavy rounded body about 80 cm long, short legs, large webbed hind feet, small clawed fore paws, the broad flat scaly paddle tail held flat behind (fully visible in the top view), small round ears, small dark eyes, orange-brown incisors just showing. Coat glossy rich chestnut brown, darker on the back, the tail dark grey-black with a scale pattern.

### R9.2 Beaver pose sheet — `delivered`
- **File:** `beaver_poses.png` → `reference/sheets/beaver_poses.png`
- **Prompt:** A model sheet of one North American beaver in six poses, all exactly side-on facing right, same scale, two rows of three, not overlapping: (1) waddling walk on land, (2) sitting up on its haunches gnawing a stick held in its fore paws, tail flat on the ground in front, (3) swimming at the surface, only head, back and a little tail above a faint flat waterline, (4) diving, body angled down under a faint waterline, hind feet kicking, (5) slapping its tail on the water, tail raised high, (6) standing upright on its hind feet and tail, sniffing the air.

### R9.3 Eastern cottontail rabbit turnaround — `delivered`
- **File:** `rabbit_turnaround.png` → `reference/sheets/rabbit_turnaround.png`
- **Prompt:** Turnaround sheet of one adult eastern cottontail rabbit (Sylvilagus floridanus), three views side by side at the same scale: exact side view facing right, exact top view head right, three-quarter front view. Neutral crouched sitting pose with all four feet visible, long ears upright, large dark eyes, the white cottontail visible. Grizzled brown-grey coat, a rusty patch on the nape, pale belly, white tail underside. Body about 40 cm long.

### R9.4 Rabbit pose sheet — `delivered`
- **File:** `rabbit_poses.png` → `reference/sheets/rabbit_poses.png`
- **Prompt:** A model sheet of one eastern cottontail in six poses, all exactly side-on facing right, same scale, two rows of three, not overlapping: (1) slow hop, gathered, hind feet planted ahead of the fore feet, (2) slow hop, extended, (3) full-speed bound in mid-air, body stretched long, ears laid back, (4) sitting up tall on its hind legs, ears up, alert, (5) grooming its face with its fore paws, (6) flattened low in the grass, freezing, ears down.

### R9.5 Mute swan pose sheet — `delivered`
- **File:** `swan_poses.png` → `reference/sheets/swan_poses.png`
- **Prompt:** A model sheet of one adult mute swan in six poses, all exactly side-on facing right, same scale, two rows of three, not overlapping (the swimming turnaround already exists, R1.5): (1) walking on land, upright stance, black webbed feet, (2) standing preening, neck curved back to its wing, (3) take-off running across water, wings raised, feet slapping a faint flat waterline, (4) flying, neck stretched straight forward, wings at the top of the downstroke, (5) flying, wings at the bottom of the downstroke, (6) landing on water, wings spread back, feet forward skiing on a faint waterline. Pure white plumage, orange bill with a black knob.

### R9.6 Mute swan flying, top view — `delivered`
- **File:** `swan_flying_top.png` → `reference/sheets/swan_flying_top.png`
- **Prompt:** Three views of one mute swan in flight at the same scale, side by side: exact top view head right with wings fully spread, exact underside view head right with wings fully spread, exact front view with wings spread level. Neck stretched straight, feet tucked back under the tail. Pure white plumage, orange bill with black knob.

### R9.7 Great blue heron turnaround — `delivered`
- **File:** `heron_turnaround.png` → `reference/sheets/heron_turnaround.png`
- **Prompt:** Turnaround sheet of one adult great blue heron (Ardea herodias), three views side by side at the same scale: exact side view facing right, exact top view head right, three-quarter front view. Standing in a neutral walking pose, neck in its relaxed S-curve, long yellow-orange dagger bill, long dark legs with long toes. Blue-grey body and wings, white face with a black stripe above the eye extending into black plumes, rusty thighs, streaked white and black foreneck plumes. About 1.1 m tall.

### R9.8 Great blue heron pose sheet — `delivered`
- **File:** `heron_poses.png` → `reference/sheets/heron_poses.png`
- **Prompt:** A model sheet of one great blue heron in six poses, all exactly side-on facing right, same scale, two rows of three, not overlapping: (1) slow wading walk, one leg raised, a faint flat waterline at its shins, (2) hunched, neck folded, stalking, (3) striking, neck shot forward, bill at a faint waterline, (4) take-off, wings raised high, legs pushing off, (5) flying, neck folded back into an S, legs trailing straight behind, wings at the top of the downstroke, (6) flying, wings at the bottom of the downstroke.

### R9.9 Great blue heron flying, top view — `delivered`
- **File:** `heron_flying_top.png` → `reference/sheets/heron_flying_top.png`
- **Prompt:** Three views of one great blue heron in flight at the same scale, side by side: exact top view head right with wings fully spread, exact underside view head right with wings fully spread, exact front view with wings spread level. Neck folded back into an S, legs trailing straight behind. Blue-grey plumage with darker flight feathers.

### R9.10 Creature portraits for the creature select — `delivered`
- **File:** `ui/creatures.png` → `game/assets/ui/creatures.png`
- **Size:** 2560 × 512, on transparent background
- **Prompt:** Five round portrait medallions side by side, evenly spaced, each a painted head-and-shoulders portrait of an animal facing slightly right inside a thin cream ring on a warm autumn-coloured disc: a black squirrel, a North American beaver, an eastern cottontail rabbit, a mute swan, a great blue heron. Painted storybook realism, consistent style and lighting across all five, no text, transparent background around the discs.

## Round 10: the ground the squirrel runs on

Playing showed the ground needs more character up close: the fallen-leaf
sprites read as flat specks rather than leaves lying in drifts, and the
sidewalks, curbs and gutters are plainer than real downtown streets. These are
for the street surfaces and for the small things a squirrel meets at ground
level. Same painted storybook realism and October light. Tiling textures are
seamless on all four edges, seen exactly from above, no directional shadows.
Cutouts are on a transparent background, seen from directly above unless the
request says otherwise, each item whole and not touching the others.

| # | File | Size / real size | Prompt |
|---|---|---|---|
| G10.1 | `textures/leaf_drift_edge.png` | 1024 × 1024, 1 m × 1 m | Seamless (left–right only) top-down texture of fallen autumn leaves piled in a drift along a curb: thick overlapping maple, oak and linden leaves at the top edge thinning to scattered single leaves at the bottom edge, transparent where there are no leaves. Reds, oranges, golds, browns, some curled and some flat. Status: `delivered` |
| G10.2 | `textures/leaf_scatter.png` | 1024 × 1024, 2 m × 2 m | Seamless top-down texture of scattered fallen leaves on a transparent background, about 25% coverage, mixed maple, oak, linden and elm, some overlapping in small clusters, a few curled up at the edges with soft contact shadows under them. Status: `delivered` |
| G10.3 | `sprites/leaf_piles.png` | 2048 × 1024 | Six separate small heaps of raked or wind-blown autumn leaves seen at a three-quarter angle from slightly above, each about the size a squirrel could dive into, from a low scatter to a deep mound, in red, orange, gold and brown, transparent background. Status: `delivered` |
| G10.4 | `sprites/leaves_single_hd.png` | 2048 × 2048 | Twenty-four single fallen leaves seen from above in a 6 × 4 grid, large and detailed with veins and stems: sugar maple (red, orange, yellow), red maple, silver maple, red oak, white oak, linden, elm, horse chestnut, Manitoba maple keys, birch; some flat, some curled, some half-decayed with holes; transparent background. Status: `delivered` |
| G10.5 | `textures/sidewalk_slab_hd.png` | 1024 × 1024, 1.5 m × 1.5 m | Seamless top-down texture of one square of weathered broom-finished concrete sidewalk with a tooled border, a hairline crack, a few gum spots and a dark rain stain; painted. Status: `delivered` |
| G10.6 | `textures/curb_face.png` | 1024 × 256, 2 m × 0.25 m | Seamless (left–right) front view of the vertical face and rounded top edge of an old concrete curb, chipped in places, grimy at the bottom where it meets the gutter; painted. Status: `delivered` |
| G10.7 | `textures/gutter.png` | 1024 × 512, 2 m × 1 m | Seamless (left–right) top-down texture of the concrete gutter strip between a curb (top edge) and asphalt (bottom edge), with grit, a few wet leaves, a bottle cap and a faint damp line; painted. Status: `delivered` |
| G10.8 | `textures/pavers_square.png` | 1024 × 1024, 3 m × 3 m | Seamless top-down texture of a modern civic plaza: pale grey concrete panels in a large grid with bands of small charcoal-grey pavers between them, a few leaves; painted. Status: `delivered` |
| G10.9 | `textures/tactile_paving.png` | 512 × 512, 0.6 m × 0.6 m | Seamless top-down texture of a yellow tactile warning pad of raised truncated domes at a crosswalk ramp, slightly worn; painted. Status: `delivered` |
| G10.10 | `textures/mulch_bed.png` | 1024 × 1024, 2 m × 2 m | Seamless top-down texture of a cedar mulch flower bed with a few fallen leaves and the base of dried perennials; painted. Status: `delivered` |
| G10.11 | `textures/asphalt_patched.png` | 1024 × 1024, 4 m × 4 m | Seamless top-down texture of worn downtown asphalt with darker patched rectangles, sealed cracks in black tar lines, faded road paint fragments and a few leaves; painted. Status: `delivered` |
| G10.12 | `sprites/street_ground_items.png` | 2048 × 1024 | Eight separate street-level fixtures seen exactly from above, on transparent background: a round cast-iron manhole cover with a grid pattern, a rectangular storm drain grate with leaves caught in it, a square cast-iron tree grate around a trunk opening, a water valve cap, a utility access plate, a small puddle with a sky reflection, a crack in concrete with a weed growing out, a round metal survey marker. Painted, no text on the covers. Status: `delivered` |
| G10.13 | `sprites/ground_plants.png` | 2048 × 1024 | Twelve separate low plants and ground growth seen from the side at squirrel eye level, transparent background: a dandelion with a seed head, a clump of clover, plantain leaves, a tuft of crabgrass from a sidewalk crack, moss in a crack, a small cluster of mushrooms, a fern, a dried goldenrod stalk, chicory, a patch of creeping thyme, an ivy runner, a fallen twig with lichen. Painted. Status: `delivered` |
| G10.14 | `sprites/ground_debris.png` | 2048 × 1024 | Twelve separate small things on the ground seen from slightly above at squirrel eye level, transparent background: a pine cone, a broken branch about 40 cm long, a bundle of twigs, a crushed paper coffee cup with no logo, a bottle cap, an acorn with cap, a half-eaten apple core, a horse chestnut in its spiky husk, a feather, a smooth river stone, a cluster of maple keys, a small heap of sunflower seed shells. Painted, no logos or text. Status: `delivered` |
## Round 9 delivery — 2026-11-02

Nine animal reference sheets and the transparent creature portrait strip delivered to the listed paths with built-in image_gen. Prompts recorded in `generation-prompts-round-9.json`. PNG decoding and delivery sizes checked, portrait alpha verified, full set visually reviewed, with beaver layout and heron flight corrections generated. Portrait web copy and manifest updated; no deployment.

## Round 10 delivery — 2026-11-02

All 14 ground-detail images generated with built-in image_gen, saved at listed asset paths with web copies and manifest entries. Prompts in `generation-prompts-round-10.json`. PNG decoding, dimensions and requested alpha channels checked; contact sheet visually reviewed. Two sheets have near-transparent minimum alpha of 1/255. Texture seams remain subject to in-game review. 23 shell/town-data tests passed. No deployment.

## Round 11: replacements after reviewing rounds 9 and 10

Rounds 9 and 10 were reviewed image by image on delivery. Almost all of them
work as delivered. These six fall short of what the game needs and are asked
for again; the originals stay in use until the replacements arrive.

| # | File | Size | Why it's asked again | Prompt |
|---|---|---|---|---|
| R11.1 | `beaver_turnaround.png` → `reference/sheets/beaver_turnaround.png` | 1920 × 1080 | The "side" view came out turned three-quarters, so it can't be measured as a profile. | Exactly as R9.1, but the left view must be a **strict orthographic side profile facing right**: the camera level with the body and at right angles to it, only the near side visible, the near legs in front of the far ones, the tail seen edge-on as a thin flat paddle. Middle: strict top view, head right. Right: three-quarter front view. Same beaver, same scale, plain light grey background, no text. Status: `delivered` |
| R11.2 | `heron_turnaround.png` → `reference/sheets/heron_turnaround.png` | 1920 × 1080 | The "top" view shows the heron lying on its side with its legs sideways, not seen from above while standing. | Exactly as R9.7, but the middle view must be a **strict top-down view of the heron standing upright**, the camera directly overhead looking down at its back: the folded wings and back plumes, the S-curved neck and bill pointing right, and only the toes showing below the body. Left: strict side view facing right. Right: three-quarter front view. Same bird, same scale, plain light grey background, no text. Status: `delivered` |
| G11.3 | `textures/curb_face.png` | 1024 × 256 | Came out painted bright yellow (a no-parking curb); the default curb is bare concrete. | As G10.6, in **plain weathered grey concrete with no paint**: a seamless (left–right) front view of the vertical face and rounded top edge of an old concrete curb, chipped in places, grimy at the bottom. Status: `delivered` |
| G11.4 | `textures/asphalt_patched.png` | 1024 × 1024 | Has yellow lane-paint dashes baked in, which would repeat every 4 m on every road. | As G10.11 **with no road paint at all**: worn downtown asphalt with darker patched rectangles, sealed cracks in black tar lines and a few leaves; seamless, top-down. Status: `delivered` |
| G11.5 | `sprites/ground_plants.png` | 2048 × 1024 | Each plant sits in a pale glow halo instead of a clean cut-out edge. | The same twelve plants as G10.13, on a **flat pure #FF00FF magenta background** with crisp edges, no glow, no soft shadow and no halo around any item, each plant whole and separate. Status: `delivered` |
| G11.6 | `textures/leaf_drift_edge.png` | 1024 × 1024 | Has a stone curb painted along its top edge; the curb is modelled separately. | As G10.1 with **no curb or pavement drawn**: leaves only, thickest along the top edge and thinning to scattered single leaves at the bottom, transparent everywhere else; seamless left–right. Status: `delivered` |

## Round 11 delivery — 2026-11-02

Six requested replacements delivered with built-in image_gen, prompts recorded in `generation-prompts-round-11.json`. Beaver profile and heron overhead view regenerated, curb and asphalt have no paint, leaf drift contains no curb. Plant sheet generated on magenta (preserved in `reference/delivery/round-11/`), then background removed with image_gen for game use. PNG dimensions and alpha checked; web copies rebuilt. Texture seams require in-game review. No deployment.
