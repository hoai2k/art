// Pure helpers for the recorded sound effects: which sound a creature's footstep,
// claw scrabble, landing or water event plays, and the spatial indexes used for
// positional sounds. No Web Audio in here, so node can test it.
import { SURFACE } from './surface.js';

const S = SURFACE;
const PAVED = new Set([S.road, S.sidewalk, S.roof, S.prop, S.wall_smooth]);
const SOFT = new Set([S.grass, S.ground, S.water_bed]);

// A squirrel's step by the surface under it. `leafy`: leaf litter is near (a tree's crown or
// a leaf layer), which turns grass and bare ground into dry leaves.
export function squirrelStep(surface, leafy = false) {
  if (PAVED.has(surface)) return 'squirrel_step_pavement';
  if (surface === S.bark || surface === S.branch || surface === S.fence || surface === S.wall_wood) return 'squirrel_climb_bark';
  if (surface === S.wall_brick || surface === S.wall_stone) return 'squirrel_climb_brick';
  if (SOFT.has(surface)) return leafy ? 'squirrel_step_leaves' : 'squirrel_step_grass';
  return 'squirrel_step_pavement';
}

// Claws on a climbable surface: bark and wood scrabble, masonry scratches.
export function climbSound(surface) {
  return surface === S.wall_brick || surface === S.wall_stone || surface === S.wall_smooth ? 'squirrel_climb_brick' : 'squirrel_climb_bark';
}

// The sound for a footstep of `kind` on `surface`; `inWater` for wading. null: silent.
export function stepSound(kind, surface, { leafy = false, inWater = false } = {}) {
  switch (kind) {
    case 'beaver': return 'beaver_step';
    case 'rabbit': return 'rabbit_hop';
    case 'swan': return inWater ? 'swim_paddle' : 'beaver_step';
    case 'heron': return inWater ? 'heron_wade' : (leafy ? 'squirrel_step_leaves' : 'squirrel_step_grass');
    default: return squirrelStep(surface, leafy);
  }
}

// The landing sound; `water` landings are the splash's job. null: nothing recorded.
export function landSound(kind, surface, { impact = 0, leafy = false, water = false } = {}) {
  if (water) return null;
  switch (kind) {
    case 'beaver': return 'beaver_step';
    case 'rabbit': return 'rabbit_hop';
    case 'swan': case 'heron': return null;
    default: return impact > 5 && leafy && SOFT.has(surface) ? 'leaf_pile_burst' : 'squirrel_land';
  }
}

// A splash event's sound: the controller emits speed 0.5 on starting a dive, 0.4 on surfacing,
// otherwise a splash proper. A swan's splash in the water is its landing; leaving the water is the take-off.
export function splashSound(kind, speed, state) {
  if (kind === 'swan') return state === 'swim' ? 'swan_land_water' : null;
  if (speed === 0.5) return 'dive';
  if (speed === 0.4) return 'surface';
  return 'splash';
}

// What a creature's action button (the "dig" event) sounds like.
export function actionSound(kind) {
  return { beaver: 'beaver_gnaw', rabbit: 'rabbit_thump', swan: 'swan_hiss', heron: 'heron_call' }[kind] || 'squirrel_dig';
}

// A coarse grid over points with a `.x`/`.z`, for nearby-tree queries.
export function createGrid(points, cell = 40) {
  const cells = new Map();
  const key = (i, j) => i * 100003 + j;
  for (const p of points || []) {
    const k = key(Math.floor(p.x / cell), Math.floor(p.z / cell));
    (cells.get(k) || cells.set(k, []).get(k)).push(p);
  }
  return {
    near(x, z, r) {
      const out = [];
      const i0 = Math.floor((x - r) / cell); const i1 = Math.floor((x + r) / cell);
      const j0 = Math.floor((z - r) / cell); const j1 = Math.floor((z + r) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        for (const p of cells.get(key(i, j)) || []) if (Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
      }
      return out;
    },
  };
}

// Is a tree's crown over (x, z)? Autumn: its fallen leaves are about.
export function leafyAt(grid, x, z) {
  if (!grid) return false;
  for (const t of grid.near(x, z, 16)) if (Math.hypot(t.x - x, t.z - z) <= (t.crown || 6) + 1.5) return true;
  return false;
}

// Points along the main streets (primary, secondary, tertiary), for passing cars.
export function mainStreetPoints(roads, step = 15) {
  const out = [];
  for (const r of roads || []) {
    if (!['primary', 'secondary', 'tertiary'].includes(r.kind) || !r.points) continue;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const [ax, az] = r.points[i]; const [bx, bz] = r.points[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let k = 0; k < n; k++) out.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, dx: bx - ax, dz: bz - az });
    }
  }
  return out;
}

// Positional gain and low-pass cutoff by distance (metres).
export function distanceGain(d, ref = 40) { return d <= 0 ? 1 : Math.min(1, 1 / (1 + Math.max(0, d - ref * 0.25) / ref) ** 1.6); }
export function distanceCutoff(d) { return Math.max(900, 14000 / (1 + d / 80)); }
