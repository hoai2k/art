// Houses: corrections to the data's LiDAR heights, and the type of each house.
//
// town.json's heights come from LiDAR (DSM minus DTM: the ridge is the 95th
// percentile over the footprint, the eaves the ridge minus a roof rise). A tree
// whose crown overhangs a house lifts those numbers, and a crown that covers a
// whole roof reads as a flat, tall block: Elizabeth Street's "three-storey
// flat-roofed slab" among 1.5-storey houses. correctHouseHeights() finds such
// outliers among residential buildings (height against footprint size and the
// neighbours' median, trees over the footprint, flat roofs on small houses) and
// clamps them to a plausible storey count (1.5 to 2.5 storeys unless the street
// survey says otherwise), turning flat roofs on small houses into pitched ones.
// Pure functions (no three.js), so the node tests can run them on the data.
// (util.js's hashStr, copied: util.js imports three.js)
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

const area = (o) => { let a = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const centre = (o) => { let x = 0, z = 0; for (const p of o) { x += p[0]; z += p[1]; } return [x / o.length, z / o.length]; };
// short and long side of the footprint's oriented box (rotating calipers over its edges)
function sides(o) {
  let best = null;
  for (let i = 0; i < o.length; i++) {
    const p = o[i], q = o[(i + 1) % o.length]; let dx = q[0] - p[0], dz = q[1] - p[1]; const L = Math.hypot(dx, dz); if (L < 0.5) continue; dx /= L; dz /= L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const r of o) { const a = r[0] * dx + r[1] * dz, b = -r[0] * dz + r[1] * dx; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const A = (a1 - a0) * (b1 - b0); if (!best || A < best.A) best = { A, s: Math.min(a1 - a0, b1 - b0), l: Math.max(a1 - a0, b1 - b0) };
  }
  return best || { s: 6, l: 10 };
}
function distToPoly(x, z, o) {
  let inside = false, d = Infinity;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const a = o[j], b = o[i];
    if ((b[1] > z) !== (a[1] > z) && x < ((a[0] - b[0]) * (z - b[1])) / (a[1] - b[1]) + b[0]) inside = !inside;
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)) : 0;
    d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  }
  return inside ? 0 : d;
}

// Eaves (m above the footprint's lowest ground) of a house of n storeys: a
// foundation, full storeys of ~2.9 m, and a half storey's knee wall.
export const EAVES_OF = { 1: 3.6, 1.5: 4.4, 2: 6.1, 2.5: 6.9, 3: 8.9 };
// The tallest plausible eaves for a house on this footprint (m²).
export const maxHouseEaves = (a) => (a < 90 ? 6.4 : a < 170 ? 7.6 : a < 280 ? 8.4 : 9.2);

// Corrects the residential buildings of `data` in place. Returns { count, fixes } with
// fixes = [{ id, street, area, from: {height, roofHeight, roof, levels}, to: {...}, reasons }].
// hf (optional): the height field, for the ground's fall across a footprint.
export function correctHouseHeights(data, hf = null) {
  const lmIds = new Set((data.landmarks || []).map((l) => l.buildingId).filter(Boolean));
  const homes = [];
  for (const b of data.buildings) {
    if (b.use !== 'residential' || lmIds.has(b.id)) continue;
    const a = area(b.outer); if (a < 30) continue;
    homes.push({ b, a, c: centre(b.outer) });
  }
  // grids: houses and trees by 25 m cell
  const G = 25, key = (x, z) => `${Math.floor(x / G)},${Math.floor(z / G)}`;
  const hg = new Map(); for (const h of homes) { const k = key(h.c[0], h.c[1]); (hg.get(k) || hg.set(k, []).get(k)).push(h); }
  const tg = new Map(); for (const t of data.trees || []) { const k = key(t.x, t.z); (tg.get(k) || tg.set(k, []).get(k)).push(t); }
  const near = (g, x, z, r) => { const out = []; for (let i = Math.floor((x - r) / G); i <= Math.floor((x + r) / G); i++) for (let j = Math.floor((z - r) / G); j <= Math.floor((z + r) / G); j++) for (const q of g.get(`${i},${j}`) || []) out.push(q); return out; };
  // the neighbours' median eaves, from the original data
  for (const h of homes) {
    const nb = near(hg, h.c[0], h.c[1], 45).filter((q) => q !== h && q.a > 40 && q.a < 350 && Math.hypot(q.c[0] - h.c[0], q.c[1] - h.c[1]) < 45).map((q) => q.b.height).sort((p, q) => p - q);
    h.median = nb.length >= 3 ? nb[Math.floor(nb.length / 2)] : null;
  }
  const fixes = [];
  for (const h of homes) {
    const { b, a } = h;
    if (a > 400) continue;                                     // apartment blocks, terraces: as measured
    const sv = b.survey && b.survey.full ? b.survey : null;
    if (sv && sv.storeys && sv.storeys >= 3) continue;         // photographed as tall: keep
    const { s: short } = sides(b.outer);
    let fall = 0;
    if (hf) { let lo = Infinity, hi = -Infinity; for (const p of b.outer) { const y = hf.at(p[0], p[1]); lo = Math.min(lo, y); hi = Math.max(hi, y); } fall = Math.min(2.5, Math.max(0, hi - lo)); }
    // trees whose crown reaches over the roof (taller than its eaves)
    const trees = near(tg, h.c[0], h.c[1], 20).filter((t) => t.height > b.height - 0.5 && distToPoly(t.x, t.z, b.outer) < t.crown * 0.45);
    const flat = b.roof === 'flat' || b.roofHeight < 0.4;
    const maxE = maxHouseEaves(a) + fall * 0.6;
    const reasons = [];
    if (b.height > maxE) reasons.push('tall for its footprint');
    if (flat && a < 230) reasons.push('flat roof on a small house');
    if (h.median != null && b.height > h.median + 2.4 && trees.length) reasons.push('taller than the neighbours under a tree');
    if (!flat && b.roofHeight > 0.62 * short + 0.5) reasons.push('roof too steep for its span');
    if (!reasons.length) continue;
    const from = { height: b.height, roofHeight: b.roofHeight, roof: b.roof, levels: b.levels };
    const seed = hashStr(b.id);
    // the storeys: the survey's, else what the (capped) height and the neighbours suggest
    const ridgeOld = b.height + b.roofHeight;
    const treeHit = reasons.includes('taller than the neighbours under a tree');
    let roof = b.roof;
    if (flat && a < 230) roof = seed < 0.62 ? 'gabled' : 'hipped';
    let eaves, rh, st;
    if (treeHit || (flat && a < 230)) {
      // the LiDAR ridge is a tree's crown (or a crown over a whole roof): rebuild from storeys
      let target = Math.min(b.height, maxE);
      if (h.median != null) target = Math.min(target, Math.max(h.median, EAVES_OF[1.5]) + (treeHit ? 0.9 : 0.6));
      st = sv && sv.storeys ? Math.min(2.5, Math.max(1, sv.storeys)) : target < 5.2 ? 1.5 : target < 6.6 ? 2 : 2.5;
      if (a < 60) st = Math.min(st, 1.5);
      eaves = Math.min(b.height, EAVES_OF[st] + fall * 0.5 + (seed - 0.5) * 0.4);
      const pitch = roof === 'hipped' ? (st === 1.5 ? 0.36 : 0.3) : st === 1.5 ? 0.5 : st === 2.5 ? 0.44 : 0.36;
      rh = Math.min(5.2, Math.max(1.8, short * pitch));
    } else {
      // the ridge is right, the roof's rise was read too low: a steeper Victorian roof under the
      // same ridge, its eaves no higher than the footprint allows
      const pitch = roof === 'hipped' ? 0.36 : 0.46;
      const cap = (roof === 'hipped' ? 0.42 : 0.62) * short;
      rh = Math.min(cap, 5.4, Math.max(b.roofHeight, short * pitch));
      eaves = Math.min(maxE, ridgeOld - rh);
      rh = Math.min(cap, Math.max(rh, Math.min(ridgeOld - eaves, 6)));
      st = sv && sv.storeys ? sv.storeys : eaves < 5.2 ? 1.5 : eaves < 6.6 ? 2 : 2.5;
    }
    if (Math.abs(eaves - b.height) < 0.15 && Math.abs(rh - b.roofHeight) < 0.15 && roof === b.roof) continue;
    b.height = +eaves.toFixed(2); b.roofHeight = +rh.toFixed(2); b.roof = roof; b.levels = st;
    b.heightFix = { from, reasons, trees: trees.length };
    fixes.push({ id: b.id, street: b.street, area: Math.round(a), from, to: { height: b.height, roofHeight: b.roofHeight, roof, levels: st }, reasons, trees: trees.length, drop: +(from.height + from.roofHeight - b.height - b.roofHeight).toFixed(2) });
  }
  fixes.sort((p, q) => q.drop - p.drop);
  return { count: fixes.length, fixes };
}

// ---------------------------------------------------------------- house types
// The type of a house and its parts, deterministic by its footprint, storeys, roof,
// material and id (and the street survey's roof and features where there is one):
//   gothic      Ontario Gothic cottage: 1.5 storeys, side gable with a steep centre gable
//   worker      workers' cottage: 1-1.5 storeys, plain side gable, door to one side
//   bungalow    post-war bungalow: one storey, low hip, picture window
//   italianate  2 storeys, low hip, bracketed eaves, tall paired windows, often a bay
//   foursquare  Edwardian foursquare: 2-2.5 storeys, hipped, a front dormer, full porch
//   queenanne   asymmetric: a front gable over a bay to one side, wraparound porch
//   frontgable  the gable-front house: gable to the street, door to one side
// Returns { type, ridge: 'front'|'side'|null (gable facing the street or ridge along it),
//   crossGable: null|{ at: 0..1 along the front, w: fraction }, dormers: [at...],
//   bay: null|{ at, storeys }, porch: null|'stoop'|'entry'|'full'|'wrap', doorAt, brackets,
//   tall (window height factor), paired }
export function houseStyle(b) {
  const seed = hashStr(b.id + '#style'), s2 = hashStr(b.id + '#parts');
  const a = area(b.outer), lv = b.levels || 2;
  const sv = b.survey && b.survey.full ? b.survey : null;
  const feats = sv ? sv.features || [] : [];
  const has = (re) => feats.some((f) => re.test(f));
  let type;
  const svRoof = sv && sv.roof;
  if (svRoof === 'gable_front') type = a > 120 && seed < 0.5 ? 'queenanne' : 'frontgable';
  else if (svRoof === 'cross_gable') type = lv <= 1.5 || has(/Ontario cottage|centre gable/) ? 'gothic' : 'queenanne';
  else if (svRoof === 'gable_side') type = lv <= 1.5 ? (has(/Ontario cottage|centre gable/) || seed < 0.5 ? 'gothic' : 'worker') : 'worker';
  else if (svRoof === 'hipped') type = lv <= 1.5 ? 'bungalow' : (b.material === 'clapboard' || seed < 0.4 ? 'foursquare' : 'italianate');
  else if (lv <= 1.5) {
    if (b.roof === 'hipped' && a < 150 && seed < 0.4) type = 'bungalow';
    else if (a < 80 || seed < 0.38) type = 'worker';
    else type = 'gothic';
  } else if (b.roof === 'hipped') type = (b.material === 'brick_buff' || b.material === 'brick_red') && seed < 0.6 ? 'italianate' : 'foursquare';
  else type = a > 105 && seed < 0.55 ? 'queenanne' : seed < 0.8 ? 'frontgable' : 'worker';
  const st = { type, ridge: null, crossGable: null, dormers: [], bay: null, porch: null, doorAt: 0.5, brackets: false, tall: 1, paired: false };
  const side = s2 < 0.5 ? 0.25 : 0.75, other = 1 - side;
  switch (type) {
    case 'gothic':
      st.ridge = 'side'; st.crossGable = { at: 0.5, w: 0.3 }; st.doorAt = 0.5;
      st.porch = s2 < 0.45 ? 'full' : s2 < 0.85 ? 'entry' : 'stoop'; break;
    case 'worker':
      st.ridge = lv >= 2 ? 'side' : 'side'; st.doorAt = side > 0.5 ? 0.72 : 0.28;
      st.porch = s2 < 0.3 ? 'full' : s2 < 0.7 ? 'entry' : 'stoop';
      if (lv >= 2 && s2 > 0.6) st.dormers = [0.5]; break;
    case 'bungalow':
      st.doorAt = side; st.porch = s2 < 0.6 ? 'stoop' : 'entry'; st.picture = true; break;
    case 'italianate':
      st.brackets = true; st.tall = 1.18; st.paired = s2 < 0.5; st.doorAt = s2 < 0.6 ? side * 0.8 + 0.1 : 0.5;
      if (s2 < 0.55) st.bay = { at: st.doorAt < 0.5 ? 0.72 : 0.28, storeys: 1 };
      st.porch = s2 < 0.35 ? 'full' : 'entry'; break;
    case 'foursquare':
      st.dormers = [0.5]; st.doorAt = side; st.porch = s2 < 0.75 ? 'full' : 'entry'; break;
    case 'queenanne':
      st.ridge = 'side'; st.crossGable = { at: other, w: 0.42 }; st.bay = { at: other, storeys: lv >= 2 ? 2 : 1 }; st.doorAt = side;
      st.porch = s2 < 0.55 ? 'wrap' : 'full'; break;
    case 'frontgable':
      st.ridge = 'front'; st.doorAt = side; st.porch = s2 < 0.5 ? 'full' : s2 < 0.85 ? 'entry' : 'stoop';
      if (s2 > 0.7) st.bay = { at: other, storeys: 1 }; break;
  }
  if (lv >= 2.5 && type !== 'foursquare' && st.ridge === 'side' && !st.crossGable) st.dormers = [0.3, 0.7];
  // the survey's features win where they speak
  if (sv) {
    if (has(/full-width porch|verandah|two-storey porch/)) st.porch = has(/wrap/) ? 'wrap' : 'full';
    else if (has(/entry porch|enclosed porch|entry hood|small entry gable|pedimented porch/)) st.porch = 'entry';
    else if (feats.length) st.porch = has(/steps/) ? 'stoop' : st.porch === 'full' || st.porch === 'wrap' ? 'entry' : st.porch;
    if (has(/dormer/)) st.dormers = st.dormers.length ? st.dormers : [0.5];
    if (sv.bay || has(/\bbay|oriel/)) st.bay = st.bay || { at: st.doorAt < 0.5 ? 0.72 : 0.28, storeys: 1 };
    if (has(/bracket/)) st.brackets = true;
  }
  if (a < 55) { st.porch = st.porch ? 'stoop' : null; st.bay = null; st.dormers = []; }
  return st;
}
