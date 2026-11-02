// Where each ambient bed is heard. Pure (no Web Audio): built from the town data
// (areas, water polygons and their levels, buildings by use, landmarks, trees, roads),
// read-only. `buildZones(town)` rasterises each kind of place onto a coarse grid, blurs
// it so a bed fades in over a few tens of metres, and `weights(x, z)` reads it back.
// `bedGains` turns the weights into the gain of each bed (at most three audible).

export const BEDS = {
  downtown: 'amb_downtown', residential: 'amb_residential', park: 'amb_park_trees',
  busy: 'amb_waterfowl_busy', pond: 'amb_pond_waterfowl', weir: 'amb_weir', river: 'amb_river_flow', underwater: 'underwater',
};

const CELL = 8;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function pip(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i]; const [x2, z2] = poly[j];
    if ((z1 > z) !== (z2 > z) && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) c = !c;
  }
  return c;
}

function boxBlur(a, nx, nz, r) {
  if (r < 1) return a;
  const tmp = new Float32Array(a.length); const out = new Float32Array(a.length);
  const w = 2 * r + 1;
  for (let j = 0; j < nz; j++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += a[j * nx + Math.min(nx - 1, Math.max(0, i))];
    for (let i = 0; i < nx; i++) {
      tmp[j * nx + i] = s / w;
      s += a[j * nx + Math.min(nx - 1, i + r + 1)] - a[j * nx + Math.max(0, i - r)];
    }
  }
  for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += tmp[Math.min(nz - 1, Math.max(0, j)) * nx + i];
    for (let j = 0; j < nz; j++) {
      out[j * nx + i] = s / w;
      s += tmp[Math.min(nz - 1, j + r + 1) * nx + i] - tmp[Math.max(0, j - r) * nx + i];
    }
  }
  return out;
}
const blur = (a, nx, nz, r) => boxBlur(boxBlur(a, nx, nz, r), nx, nz, r);

// Where waterfowl gather on the Avon's lakes, in town coordinates: the shore along Lakeside
// Drive between the two bridges over Lake Victoria, around Tom Patterson Island, and the
// Festival Theatre lawns' shoreline (the swans are kept there). Everything else on the lake
// is the calmer pond bed.
export function busyZones(town) {
  const lm = (id) => (town.landmarks || []).find((l) => l.id === id);
  const zones = [];
  const island = lm('tom-patterson-island'); const fest = lm('festival-theatre');
  if (island) zones.push({ kind: 'disc', x: island.x, z: island.z, r: 170 });
  if (fest) zones.push({ kind: 'disc', x: fest.x, z: fest.z - 100, r: 260 });
  // the lake's two bridges: the western Ontario-Street-side crossing and the one by the islands
  zones.push({ kind: 'strip', ax: 210, az: -427, bx: 540, bz: -707, r: 230 });
  return zones;
}
function inBusy(zones, x, z) {
  for (const q of zones) {
    if (q.kind === 'disc') { if (Math.hypot(x - q.x, z - q.z) <= q.r) return true; continue; }
    const dx = q.bx - q.ax; const dz = q.bz - q.az; const l2 = dx * dx + dz * dz;
    const t = ((x - q.ax) * dx + (z - q.az) * dz) / l2;
    if (t < 0 || t > 1) continue;
    if (Math.hypot(x - (q.ax + dx * t), z - (q.az + dz * t)) <= q.r) return true;
  }
  return false;
}

// Weirs: where two water polygons of different levels meet (the dam: lake -8.5 over the
// river's -11.5), found from vertices of different levels lying together.
export function findWeirs(polys) {
  const pts = [];
  for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) {
    const drop = Math.abs(polys[a].level - polys[b].level);
    if (drop < 0.3) continue;
    const m = [];
    for (const p of polys[a].outer) for (const q of polys[b].outer) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5) m.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (Math.hypot(m[i][0] - m[j][0], m[i][1] - m[j][1]) < 90) pts.push({ a: m[i], b: m[j], strength: clamp01(drop / 2.5) });
  }
  return pts;
}

export function buildZones(town) {
  const b = town.bounds || { minX: -1100, maxX: 2000, minZ: -1050, maxZ: 950 };
  const x0 = b.minX - 40; const z0 = b.minZ - 40;
  const nx = Math.ceil((b.maxX - b.minX + 80) / CELL); const nz = Math.ceil((b.maxZ - b.minZ + 80) / CELL);
  const grid = () => new Float32Array(nx * nz);
  const ix = (x) => Math.floor((x - x0) / CELL); const iz = (z) => Math.floor((z - z0) / CELL);
  const L = { downtown: grid(), residential: grid(), park: grid(), trees: grid(), busy: grid(), pond: grid(), river: grid() };

  const bbox = (poly) => {
    let a = 1e9; let c = 1e9; let d = -1e9; let e = -1e9;
    for (const [x, z] of poly) { if (x < a) a = x; if (x > d) d = x; if (z < c) c = z; if (z > e) e = z; }
    return [Math.max(0, ix(a)), Math.max(0, iz(c)), Math.min(nx - 1, ix(d)), Math.min(nz - 1, iz(e))];
  };
  const fill = (arr, poly, holes, val = 1) => {
    const [i0, j0, i1, j1] = bbox(poly);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * CELL; const z = z0 + (j + 0.5) * CELL;
      if (pip(x, z, poly) && !(holes && holes.some((h) => pip(x, z, h)))) arr[j * nx + i] = val;
    }
  };

  for (const bd of town.buildings || []) {
    const use = bd.use;
    const arr = use === 'commercial' || use === 'civic' || use === 'theatre' ? L.downtown : use === 'residential' ? L.residential : null;
    if (!arr || !bd.outer?.length) continue;
    const [i0, j0, i1, j1] = bbox(bd.outer);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) arr[j * nx + i] = 1;
  }
  for (const a of town.areas || []) if (['park', 'garden', 'wood', 'cemetery'].includes(a.kind) && a.outer) fill(L.park, a.outer, a.holes);
  for (const t of town.trees || []) { const i = ix(t.x); const j = iz(t.z); if (i >= 0 && j >= 0 && i < nx && j < nz) L.trees[j * nx + i] += 1; }

  // water: lakes (about -8.5) split into the busy waterfowl places and the calmer rest; the river below the dam
  const polys = town.water?.polygons || [];
  const busy = busyZones(town);
  for (const p of polys) {
    const river = p.level < -9.5;
    const [i0, j0, i1, j1] = bbox(p.outer);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) * CELL; const z = z0 + (j + 0.5) * CELL;
      if (!pip(x, z, p.outer) || (p.holes && p.holes.some((h) => pip(x, z, h)))) continue;
      L[river ? 'river' : inBusy(busy, x, z) ? 'busy' : 'pond'][j * nx + i] = 1;
    }
  }
  const weirs = findWeirs(polys);

  // blur each layer: the distance over which a bed fades in (cells of 8 m)
  const B = {
    downtown: blur(L.downtown, nx, nz, 4), residential: blur(L.residential, nx, nz, 4), park: blur(L.park, nx, nz, 3),
    trees: blur(L.trees, nx, nz, 4), busy: blur(L.busy, nx, nz, 3), pond: blur(L.pond, nx, nz, 3), river: blur(L.river, nx, nz, 3),
  };

  const at = (a, x, z) => {
    const fx = (x - x0) / CELL - 0.5; const fz = (z - z0) / CELL - 0.5;
    const i = Math.floor(fx); const j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return 0;
    const tx = fx - i; const tz = fz - j;
    const k = j * nx + i;
    return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - tz) + (a[k + nx] * (1 - tx) + a[k + nx + 1] * tx) * tz;
  };

  // closeness to a weir: full at the drop, fading over 90 m
  const weirAt = (x, z) => {
    let best = 0;
    for (const w of weirs) {
      const dx = w.b[0] - w.a[0]; const dz = w.b[1] - w.a[1]; const l2 = dx * dx + dz * dz || 1;
      const t = clamp01(((x - w.a[0]) * dx + (z - w.a[1]) * dz) / l2);
      const d = Math.hypot(x - (w.a[0] + dx * t), z - (w.a[1] + dz * t));
      best = Math.max(best, w.strength * clamp01(1 - d / 90) ** 1.5);
    }
    return best;
  };

  return {
    cell: CELL,
    // Raw weights (0..1) of each place at (x, z). Residential is dimmed in the commercial core.
    weights(x, z) {
      const downtown = clamp01(at(B.downtown, x, z) * 3.5 - 0.25);
      const residential = clamp01(at(B.residential, x, z) * 2.2 - 0.1) * (1 - 0.8 * downtown);
      const park = Math.max(clamp01(at(B.park, x, z) * 1.6), clamp01((at(B.trees, x, z) - 0.12) / 0.3));
      return {
        downtown, residential, park,
        busy: clamp01(at(B.busy, x, z) * 2), pond: clamp01(at(B.pond, x, z) * 2),
        river: clamp01(at(B.river, x, z) * 2), weir: weirAt(x, z),
      };
    },
  };
}

// Gains (0..1 before the sound's own level) of each bed from the raw weights. Under water only
// the underwater bed plays. At most `max` beds are audible, the loudest ones; the total is kept
// near one so crossfades stay level. `zoom` (0..1): the further out, the slightly quieter.
// The river below the dam plays the pond bed at low volume until `amb_river_flow` is approved.
export function bedGains(w, { underwater = false, zoom = 0, hasRiverFlow = false, max = 3 } = {}) {
  if (underwater) return { underwater: 1 };
  const g = { ...w };
  if (hasRiverFlow) g.river = w.river;
  else { g.pond = Math.max(w.pond, w.river * 0.35); delete g.river; }
  const top = Object.entries(g).filter(([, v]) => v > 0.01).sort((a, b) => b[1] - a[1]).slice(0, max);
  const sum = top.reduce((s, [, v]) => s + v, 0);
  const norm = Math.max(1, sum) ;
  const zf = 1 - 0.3 * clamp01(zoom);
  const out = {};
  for (const [k, v] of top) out[k] = (v / norm) * zf;
  return out;
}
