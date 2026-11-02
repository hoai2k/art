# Stratford Squirrel prototype: architecture and contracts

You play an eastern grey squirrel exploring downtown Stratford, Ontario, in
3D: running, leaping and climbing through the real street plan, the buildings
around Market Square and the theatre district along the Avon River. A web game:
static ES modules, three.js r170 vendored in `game/lib/`, no build step, Xbox
controller first (see the root `GAME_GUIDELINES.md`).

This file is the contract between the parts. Each part has one owner; change
another part's files only through its owner (or say clearly in your report
what you touched and why).

## Folders

```
stratford/
  README.md            the game's README (checks, layout, links)
  publish.sh           copies the playable build into local/pages/stratford/
  intake/              the owner's drop box
  prototype/
    ARCHITECTURE.md    this file
    image-requests.md  every image the game wants (stand-ins until delivered)
    reference/         photos and generated sheets; never published
      sheets/          generated reference sheets (image requests R1.x)
      sheets/provisional/wobblers_squirrel.png  the Wobblers' squirrel sheet,
                       usable as a measuring tape until R1.1 arrives
    tools/             offline build scripts (Python 3 + numpy/scipy/Pillow, Node)
      town/            OSM + LiDAR -> game/data/
      squirrel/        reference sheet + anatomy -> game/assets/squirrel/
    game/              exactly what is published
      index.html, styles.css
      lib/             three.module.min.js (r170), three-mesh-bvh.module.js (0.8.3),
                       addons/ (BufferGeometryUtils, SkeletonUtils; copy more from
                       local/npm/three-0.170.0/package/examples/jsm/ as needed)
      src/main.js      boot, loop, screens (shell)
      src/input.js     controllers, keyboard, mouse (shell)
      src/ui/          title, menus, settings, pause, HUD, map (shell)
      src/game/        exploration rules: nuts, discoveries, journal (shell)
      src/town/        the town: meshes, materials, collider, landmarks, sky (town)
      src/squirrel/    the squirrel: model, rig, animation, controller, camera (squirrel)
      src/stand-in-world.js  a tiny test world on the World contract (squirrel)
      data/            town data written by tools/town (town data)
      assets/          delivered art and built models
      lab/             developer benches (squirrel.html, town.html); published, unlinked
      test/            node --test unit tests and the browser check
```

The import map in every page maps `three` to `./lib/three.module.min.js`,
`three/addons/` to `./lib/addons/` and `three-mesh-bvh` to
`./lib/three-mesh-bvh.module.js` (pages in `lab/` use `../lib/...`).

## World coordinates

- Metres. Y up. **+X is east, -Z is north** (so +Z is south). This is three.js'
  usual right-handed frame with north toward -Z.
- Origin: the centroid of the OSM building "Stratford City Hall"
  (lat 43.369994, lon -80.982254). Project lat/lon with a local equirectangular
  projection about that point: `x = (lon - lon0) * cos(lat0) * 111320`,
  `z = -(lat - lat0) * 110574`. Good to a few centimetres over 3 km.
- Y = 0 is the terrain elevation at the origin. `town.json` records the
  origin's height above sea level (`origin.elev`).
- Extent: lon -80.9950 .. -80.9580, lat 43.3620 .. 43.3790 (about 3.0 km × 1.9 km),
  which takes in downtown, Market Square, the Avon River, Lake Victoria, the
  Festival Theatre and its gardens, the Tom Patterson Theatre and the
  surrounding residential streets. The detailed core is roughly 1.6 km × 1 km
  around the origin and the theatres.

## Town data (`game/data/`, written by `tools/town/`)

`town.json` (gzip-friendly JSON, coordinates rounded to 0.01 m):

```jsonc
{
  "version": 1,
  "origin": { "lat": 43.369994, "lon": -80.982254, "elev": 360.0 },
  "bounds": { "minX": ..., "maxX": ..., "minZ": ..., "maxZ": ... },
  "attribution": "© OpenStreetMap contributors (ODbL); contains information licensed under the Open Government Licence – Ontario / Canada",
  "terrain": { "file": "terrain.bin", "nx": 760, "nz": 480, "cell": 4, "x0": ..., "z0": ...,
               "format": "uint16 cm above minElev, row-major, z rows from z0", "minElev": ... },
  "buildings": [ {
      "id": "w123",                       // OSM id
      "outer": [[x,z], ...],              // CCW seen from above, not closed (no repeated first point)
      "holes": [[[x,z], ...]],            // optional
      "base": 0.0,                        // ground height under it (min terrain over the footprint)
      "height": 11.2,                     // wall top above base (eaves), from LiDAR where available
      "roofHeight": 3.0,                  // ridge above eaves (0 = flat)
      "roof": "flat|gabled|hipped|pyramidal|dome|mansard",
      "levels": 3,                        // estimated if not tagged
      "use": "commercial|residential|civic|church|theatre|industrial|garage|shed|other",
      "material": "brick_red|brick_buff|stone|clapboard|stucco|glass|metal",  // guess when untagged
      "name": "Stratford City Hall",      // optional
      "street": "Ontario Street",         // the street it faces, optional
      "front": [i, j]                     // optional: index of the outer edge that faces the street
  } ],
  "roads": [ { "id": "w1", "kind": "primary|secondary|tertiary|residential|service|footway|path|cycleway|steps",
               "name": "Ontario Street", "width": 12.0, "points": [[x,z], ...] } ],
  "areas": [ { "kind": "park|grass|garden|parking|water|wood|pitch|plaza|cemetery|railway",
               "outer": [[x,z], ...], "holes": [...], "name": "..." } ],
  "water": { "level": -6.2, "polygons": [ { "outer": [...], "holes": [...] } ],
             "rivers": [ { "points": [[x,z],...], "width": 30 } ] },
  "trees": [ { "x": ..., "z": ..., "height": 14, "crown": 5, "kind": "maple|oak|willow|spruce|linden|other" } ],
  "railways": [ { "points": [[x,z], ...] } ],
  "landmarks": [ { "id": "city-hall", "name": "Stratford City Hall", "x": ..., "z": ...,
                   "radius": 25, "blurb": "One or two sentences of plain history.", "buildingId": "w..." } ],
  "spawn": { "x": ..., "z": ..., "yaw": 0 }   // Market Square, facing City Hall
}
```

`terrain.bin` is the bare-earth height field. `groundAt(x, z)` is a bilinear
read of it.

Details fixed by the data pipeline (`tools/town/`, added fields only, nothing renamed):

- `terrain.bin`: little-endian uint16, row-major. Sample `(i, j)` is the height at
  `x = x0 + i*cell`, `z = z0 + j*cell` (grid nodes, not cell centres); the grid covers
  the whole extent. World `y = minElev + v/100 - origin.elev`. Under water the bed is
  carved below the water surface (so the water plane is visible); `groundAt` there is the bed.
- `water.polygons[].level` (world y, extra field): each water polygon piece has its own
  surface height. The Avon is cut where its level steps (Lake Victoria is about -8.5, the
  river below the Thomas Orr dam about -12.5). `water.level` is the Lake Victoria level.
  `water.rivers[].levels` (extra, per point) gives the water surface along each centre-line.
  Open water is in `water.polygons` only, not repeated in `areas`.
- `spawn.yaw`: radians, three.js `rotation.y` convention: forward = `(-sin yaw, 0, -cos yaw)`
  (yaw 0 faces north, -Z). `spawn.lookAt` (extra) is the `[x, z]` of City Hall.
- `roads[].bridge` / `.tunnel` (extra, only when true). Pedestrian streets are kind `footway`.
- Building `front` is `[i, j]`, the vertex indices of the edge facing `street`
  (`j = (i+1) % outer.length`). `outer` is CCW seen from above (x east, z south).
- Landmark ids (stable): city-hall, courthouse, market-square, avon-theatre, festival-theatre,
  tom-patterson-theatre, avon-river, lake-victoria, tom-patterson-island, shakespearean-gardens,
  normal-school, knox-church, st-james-church, railway-station, gallery-stratford, archives,
  public-library.

## The World contract (runtime, `src/town/index.js` and `src/stand-in-world.js`)

```js
const world = await createTown({ THREE, renderer, scene, quality, onProgress }); // or createStandInWorld(...)
world.scene            // the THREE.Scene everything is drawn in (sky, lights, fog included)
world.collider         // THREE.Mesh, world space, static, geometry.boundsTree built (three-mesh-bvh),
                       // non-indexed or indexed; geometry.attributes.surface: Uint8 per vertex, constant per
                       // triangle (see SURFACE below). Never added to the scene.
world.groundAt(x, z)   // bare terrain height (no buildings)
world.waterAt(x, z)    // water surface height if (x, z) is open water, else null
world.spawn            // { x, y, z, yaw }
world.landmarks        // town.json landmarks (with y filled in)
world.trees            // [{ x, y, z, height, crown, kind }]; trunks are in the collider as SURFACE.bark
world.update(dt, camera, focus)  // per frame: LOD, culling, wind sway, water; focus = squirrel position
world.setTimeOfDay?.(hours)      // optional
world.dispose()
```

`SURFACE` ids (exported from `src/surface.js`, shared):
`0 ground, 1 road, 2 sidewalk, 3 grass, 4 wall_brick, 5 wall_stone, 6 wall_wood,
7 wall_smooth (glass/metal/stucco: not climbable), 8 roof, 9 bark, 10 branch,
11 water_bed, 12 prop (benches, planters), 13 fence`.

The squirrel climbs `wall_brick`, `wall_stone`, `wall_wood`, `bark`, `branch`,
`fence`; it walks on everything else.

## The squirrel contract (`src/squirrel/index.js`)

```js
const squirrel = await createSquirrel({ THREE, coat: 'grey' });   // 'grey' | 'black'
scene.add(squirrel.object);
squirrel.reset(world.spawn);
squirrel.update(dt, controls, world, camera);  // fixed or variable dt; it substeps itself
squirrel.position / squirrel.velocity          // THREE.Vector3
squirrel.state                                 // 'idle' | 'move' | 'air' | 'climb' | 'sit' | 'dig' | 'swim'
                                               // | 'dive' | 'fly' (creatures that dive or fly)
squirrel.on(event, fn)                         // 'land', 'jump', 'climb', 'dig', 'splash'
squirrel.setCoat(name)
const cam = createSquirrelCamera({ THREE, camera, squirrel, world });  // follow camera with collision
cam.update(dt, controls)
```

`controls` (built by the shell from `src/input.js` each frame):

```js
{ move: [x, y],      // left stick, -1..1, y up = forward (away from camera)
  look: [x, y],      // right stick / mouse delta (already scaled), radians per frame; x > 0
                     // turns right, y > 0 tilts the view up (invert-Y is applied in input.js)
  jump: bool,        // held
  jumpPressed: bool, // fresh press this frame
  sprint: 0..1,      // right trigger (analog) or Shift
  sitPressed: bool,  // X / E: sit up and look around (eat when holding a nut)
  digPressed: bool,  // Y / F: dig (find or bury a nut)
  recenter: bool,    // fresh press of the right stick click / C: camera behind the creature
  zoom: number,      // follow-camera zoom change this frame, in zoom units (the camera's range
                     // is 0 = standard close follow .. 1 = far follow, T.camZoomFar x further);
                     // > 0 = further: held LB / Z (+0.7/s), held RB / X (-0.7/s), mouse wheel
                     // (+0.125 a notch down). The camera clamps it; its `zoom` is a saved setting.
  boost: 0..1 }      // debug superspeed: left trigger (analog) or Q; multiplies the creature's speeds
                     // and accelerations up to tuning.boostMax (10x) on the ground, swimming and flying
```

## Controls (Xbox first)

| Control | Xbox | Keyboard / mouse |
|---|---|---|
| Move | Left stick | WASD |
| Camera | Right stick | Mouse (pointer lock) or arrow keys |
| Jump (hold for a longer leap; next to a trunk or wall: grab on) | A | Space |
| Run faster | Right trigger (analog) | Shift |
| Sit up, look around / eat | X | E |
| Dig: find or bury a nut | Y | F |
| Camera behind | Right stick click | C |
| Camera zoom: further / closer (saved) | Hold LB / hold RB | Mouse wheel, or hold Z / X |
| Superspeed (debugging aid, up to 10x) | Left trigger (analog), held | Q, held |
| Fly (swan, heron): take off (swan: hold while running), flap and climb; let go to glide | A | Space |
| Dive / surface (beaver, in water) | A | Space |
| Creature select | Menu, then Creature... (or Settings) | Escape, then Creature... |
| Map and journal | View | M or Tab |
| Pause | Menu | Escape or P |

## Exploration rules (shell, `src/game/`)

- Landmarks: walking within a landmark's radius the first time "discovers" it
  (a small painted card with its name and blurb); the journal lists found and
  unfound landmarks. Progress persists in `localStorage` (`stratford.save`).
- Nuts: acorns under oaks, walnuts and conkers under other trees, a few hidden
  on roofs, in planters and up trees. Collect by running over them; Y buries
  one (it stays where you buried it, saved); a count on the HUD.
- Map: a painted parchment map drawn from `town.json` (roads, buildings, water,
  parks), the squirrel's position, discovered landmarks.

## Many creatures, many scales (the long-term goal)

The squirrel is the first of several small creatures; insects (an ant, a
beetle, a bee) are likely next. A creature may be 45 cm or 5 mm long, so the
world must stream in pieces and change its level of detail with the
creature's scale. Build everything now so this is an extension, not a rewrite.

- **Units stay metres everywhere.** A creature declares `scale` (body length in
  metres; squirrel 0.25, ant 0.005). Speeds, camera distance, near plane, fog,
  stream radius and detail all derive from it, never from squirrel constants
  hard-coded in shared code.
- **Creatures are plug-ins.** `src/creatures/index.js` is a registry:
  `CREATURES = { squirrel: () => import('../squirrel/index.js'), ... }`; each
  creature module exports `createCreature(opts)` (the squirrel also keeps
  `createSquirrel`) returning the squirrel contract above plus
  `{ kind, scale, eyeHeight, climbs: Set<surface ids>, canFly }`, and
  `createCamera(...)`. The shell never names the squirrel directly except as
  the default.
- **The world streams by chunk.** The town is cut into chunks (about 200 m;
  a chunk key is `"cx,cz"`). Chunks load, build and unload around the focus
  (`world.update(dt, camera, focus)` with `world.setScale(scale)`), in time
  slices so a frame never stalls (budget ~4 ms of building per frame), with
  geometry, materials and BVHs disposed on unload. Far chunks are coarse LOD;
  near chunks full.
- **Collision is queried, not one mesh.** Because chunks come and go, the
  creatures ask the world rather than holding `world.collider`:
  `world.collidersNear(box3)` returns the BVH meshes overlapping a box (each a
  `THREE.Mesh` with `geometry.boundsTree` and the `surface` attribute, in world
  space via its `matrixWorld`), and `world.raycast(origin, dir, far)` →
  `{ point, normal, distance, surface } | null` across them. `world.collider`
  stays as a convenience (the stand-in world's single mesh) but new code uses
  the queries.
- **Detail layers by scale.** Fine detail appears only when the creature is
  small enough to see it: `world.addDetailLayer({ id, minScale, maxScale,
  radius, build(chunkKey, cell) })` builds deterministic, seeded-by-position
  detail (grass blades, pebbles, fallen leaves as real geometry, bark relief,
  cracks in the sidewalk) in small cells around the focus, with its own
  colliders for creatures that walk on it. The squirrel needs few; an ant
  needs grass blades as climbable stalks. Seeding by position means the same
  pebble is always in the same place.
- **Precision.** Each chunk's geometry is stored relative to its chunk origin
  (the chunk object is positioned there), so vertices near the camera keep
  float precision at insect scale. The camera's near plane follows the scale
  (about `0.02 × scale`), with a far plane / fog to match; switch on
  `logarithmicDepthBuffer` only if z-fighting appears.
- **Transitions.** Changing creature (or teleporting) is: fade out, set the
  new scale and focus, wait for the near chunks and detail layers to report
  ready (`world.ready(focus)` → Promise), fade in. Loading shows progress and
  never blocks input handling or audio.

## Performance budget

60 fps on a mid-range laptop with integrated graphics at 1080p:
- under ~300 draw calls, under ~1.5 M triangles drawn;
- buildings merged per chunk (about 200 m × 200 m) with simple LOD; far chunks
  drop facade detail; trees instanced; shadows only near the squirrel
  (one directional light with a tight shadow camera following it);
- `game/data/` under 8 MB total, and the published folder under 60 MB.

## Rules for every agent

- Work only inside your own files (above). Don't `git commit`; the lead
  commits. Don't push.
- Never use Git LFS. Never download anything into the published `game/` folder
  that the game doesn't load. Keep caches and big downloads in
  `/home/user/art/local/` (ignored by Git).
- Record every outside source (data, photos) with its licence in the
  catalogue of the folder it lands in.
- Write tests that run with `node --test stratford/prototype/game/test/` and
  browser checks with Playwright (`shared/test/lib.mjs` has `launch()` and
  `serve()`); Chromium is pre-installed (do not install Playwright).
