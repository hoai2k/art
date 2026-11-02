// Nut placement: deterministic, from the trees (and a few buildings) of the
// town. Acorns under oaks, walnuts and conkers under other trees, a few on
// roofs, in planters and up trees.
//
// `probe(x, z, fromY)` -> { y, surface } | null is the one thing it needs from
// the world: the first surface straight below (x, fromY, z). main.js builds it
// from the collider; the tests pass a flat one.

export const SURFACE_IDS = { ground: 0, roof: 8, bark: 9, branch: 10, prop: 12 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const nutKinds = ['acorn', 'walnut', 'conker'];

const round2 = (v) => Math.round(v * 100) / 100;

// Centroid and rough size of a footprint ring.
export function ringCentroid(ring) {
  let x = 0; let z = 0;
  for (const [px, pz] of ring) { x += px; z += pz; }
  return [x / ring.length, z / ring.length];
}

export function placeNuts({ trees = [], buildings = [], probe, seed = 1812, max = 90, assumeRoofs = false } = {}) {
  const rng = mulberry32(seed);
  const nuts = [];
  const taken = [];
  const free = (x, z) => taken.every(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 > 1.5 ** 2);
  const add = (kind, x, y, z, where) => {
    if (!Number.isFinite(y) || !free(x, z)) return false;
    taken.push([x, z]);
    nuts.push({ id: `n${nuts.length + 1}`, kind, x: round2(x), y: round2(y), z: round2(z), where });
    return true;
  };

  // Under trees: every random draw is made whether or not it is used, so one
  // missing surface never shifts the nuts that come after it.
  for (const t of trees) {
    const roll = rng(); const ang = rng() * Math.PI * 2; const rad = rng(); const pick = rng();
    const chance = t.kind === 'oak' ? 0.45 : t.kind === 'spruce' || t.kind === 'willow' ? 0 : 0.14;
    if (roll >= chance || nuts.length >= max) continue;
    const crown = Math.max(2, t.crown || 4);
    const r = crown * (0.35 + 0.55 * rad);
    const x = t.x + Math.cos(ang) * r;
    const z = t.z + Math.sin(ang) * r;
    const hit = probe(x, z, (t.y ?? 0) + 6);
    if (!hit || hit.surface === SURFACE_IDS.roof) continue;
    const kind = t.kind === 'oak' ? 'acorn' : pick < 0.5 ? 'walnut' : 'conker';
    add(kind, x, hit.y + 0.12, z, 'tree');
  }

  // Hidden ones: up the biggest trees (on a branch), on roofs, in planters.
  const tall = trees.filter((t) => (t.height || 0) > 12).sort((a, b) => b.height - a.height || a.x - b.x).slice(0, 14);
  let up = 0;
  for (const t of tall) {
    if (up >= 6) break;
    for (let i = 0; i < 5; i++) {
      const ang = rng() * Math.PI * 2; const rr = rng() * (t.crown || 4) * 0.7; const hh = 0.55 + rng() * 0.35;
      const x = t.x + Math.cos(ang) * rr; const z = t.z + Math.sin(ang) * rr;
      const hit = probe(x, z, (t.y ?? 0) + t.height * hh + 0.5);
      if (hit && hit.surface === SURFACE_IDS.branch && hit.y > (t.y ?? 0) + 3) {
        if (add(t.kind === 'oak' ? 'acorn' : 'walnut', x, hit.y + 0.12, z, 'branch')) up++;
        break;
      }
    }
  }
  let roofs = 0;
  const sorted = [...buildings].filter((b) => b.outer && b.outer.length >= 3).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const b of sorted) {
    const roll = rng();
    if (roofs >= 12 || roll > 0.03 || b.roof !== 'flat') continue;
    const [cx, cz] = ringCentroid(b.outer);
    const top = (b.base || 0) + (b.height || 6) + 2;
    let hit = probe(cx, cz, top);
    // The world streams, so a roof may not be loaded yet: trust the data (flat roof at eaves height).
    if ((!hit || hit.surface !== SURFACE_IDS.roof) && assumeRoofs) hit = { y: (b.base || 0) + (b.height || 6), surface: SURFACE_IDS.roof };
    if (hit && hit.surface === SURFACE_IDS.roof && hit.y > (b.base || 0) + 2) {
      if (add('walnut', cx, hit.y + 0.12, cz, 'roof')) roofs++;
    }
  }
  return nuts;
}

// The nearest unclaimed nut within reach of a position, or null.
export function nutWithin(list, pos, reach = 0.9, vreach = 1.6) {
  let best = null; let bd = Infinity;
  for (const n of list) {
    const d = Math.hypot(n.x - pos.x, n.z - pos.z);
    if (d <= reach && Math.abs(n.y - pos.y) <= vreach && d < bd) { best = n; bd = d; }
  }
  return best;
}
