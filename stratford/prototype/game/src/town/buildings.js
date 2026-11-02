// Buildings: extruded footprints with roofs by type, painted procedurally by
// the facade shader (materials.js) from per-wall parameters, plus real
// geometry where it shows at small-creature scale: cornices, parapets,
// awnings, steeples, towers. Landmarks get hand-made parts (landmarks.js).
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { hashStr, hash1, signedArea, obb, centroid, polyArea } from './util.js';
import { landmarkParts } from './landmarks.js';
import { FAC } from './assets.js';
import * as THREE from 'three';

// cornice types (facades.json) -> facade-kit strip (0 cream bracketed, 1 green pressed metal, 2 corbelled brick, 3 stone);
// 'parapet_plain' and 'none' have no projecting cornice
export const CORNICE_STRIP = { bracketed: 0, pressed_metal: 1, corbelled_brick: 2, stone: 3 };
export const BUILDING_ATTRS = { aF0: 4, aF1: 4, aFac: 1, aBid: 1, aCen: 2 };

const WALL_SURF = [SURFACE.wall_brick, SURFACE.wall_brick, SURFACE.wall_stone, SURFACE.wall_wood, SURFACE.wall_smooth, SURFACE.wall_smooth, SURFACE.wall_smooth];

function matIndex(b) {
  if (b.material && b.material in MAT) return MAT[b.material];
  return b.use === 'commercial' ? MAT.brick_red : b.use === 'residential' ? MAT.clapboard : MAT.brick_buff;
}

// Per-building parameters shared by its parts.
export function buildingParams(ctx, b) {
  const seed = hashStr(b.id);
  const mat = matIndex(b);
  const storeys = Math.max(1, Math.round(b.levels));
  const commercial = b.use === 'commercial';
  const house = b.use === 'residential';
  const church = b.use === 'church';
  const shed = b.use === 'garage' || b.use === 'shed';
  const civic = b.use === 'civic' || b.use === 'theatre';
  let gfh = storeys > 1 ? (commercial ? Math.min(4.6, b.height * 0.42) : b.height / storeys) : b.height;
  let flags = 0;
  const brick = mat === MAT.brick_red || mat === MAT.brick_buff;
  const sv = b.survey && b.survey.full ? b.survey : null;
  if ((commercial && storeys <= 5 && !(sv && Array.isArray(sv.storefronts) && !sv.storefronts.length)) || (sv && sv.storefronts && sv.storefronts.length)) flags |= FLAG.store;
  if ((commercial && brick && seed < 0.8) || (civic && brick) || (house && brick && seed < 0.45)) flags |= FLAG.arched;
  // a shop storey is tall: room for the shopfront and its sign band under the upper floors
  if ((flags & FLAG.store) && storeys > 1) gfh = Math.max(gfh, Math.min(4.2, b.height - (storeys - 1) * 2.8));
  if (church) flags |= FLAG.church;
  if (house) flags |= FLAG.house;
  if (b.use === 'theatre') flags |= FLAG.theatre;
  if (shed || b.use === 'industrial' && seed < 0.5) flags |= FLAG.noWindows;
  let base = b.base;
  if (!Number.isFinite(base)) { base = Infinity; for (const p of b.outer) base = Math.min(base, ctx.hf.at(p[0], p[1])); }
  // facade elevation for the street front (when delivered), by type
  let fac = -1;
  if (commercial) {
    if (mat === MAT.glass || mat === MAT.metal || storeys === 1) fac = FAC.modern;
    else fac = mat === MAT.stone ? FAC.bank : mat === MAT.brick_buff ? (storeys >= 3 ? FAC.buff3 : FAC.buff2) : mat === MAT.stucco ? FAC.painted : storeys >= 3 ? (seed < 0.35 ? FAC.corner : FAC.red3) : FAC.narrow;
  } else if (house) fac = mat === MAT.brick_buff ? (storeys <= 1 ? FAC.buffCottage : FAC.italianate) : mat === MAT.clapboard ? FAC.clapboard : mat === MAT.stucco ? -1 : storeys <= 1 ? FAC.cottage : FAC.queenAnne;
  else if (church) fac = FAC.church;
  else if (shed) fac = FAC.garage;
  if (b.use === 'theatre' || (ctx.landmarkByBuilding.has(b.id) && !church)) fac = -1;
  if (mat === MAT.glass) flags |= FLAG.noWindows;
  return { seed, mat, storeys, gfh, flags, base, eaves: b.height, commercial, house, church, civic, shed, fac };
}

// Edges facing a street: the data's front edge, plus (for shops and civic
// buildings) any long edge running alongside a curbed road close by.
export function frontEdges(ctx, b, P) {
  const out = new Set();
  if (b.front >= 0) out.add(b.front);
  if (!(P.commercial || P.civic || P.church)) return out;
  const o = b.outer, n = o.length;
  for (let i = 0; i < n; i++) {
    const a = o[i], c = o[(i + 1) % n];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3) continue;
    const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;
    const mx = (a[0] + c[0]) / 2 + nx * 2, mz = (a[1] + c[1]) / 2 + nz * 2;
    const q = ctx.streets.grid.nearest(mx, mz, 30);
    if (!q || q.d - q.seg.data.hw > 9) continue;
    let rx = q.seg.bx - q.seg.ax, rz = q.seg.bz - q.seg.az; const rl = Math.hypot(rx, rz) || 1;
    if (Math.abs((rx * dx + rz * dz) / rl) > 0.75) out.add(i);
  }
  return out;
}

// Does this wall get a modelled 3D front near the focus (facade3d.js)? Street
// fronts of ordinary buildings: 1 (the flat wall, its awnings and cornice are
// swapped out for the model), else 0.
export function modelledFront(ctx, P, b, isFront, L) {
  if (!isFront || L < 3 || P.eaves < 2.6 || P.shed || P.church) return 0;
  if (ctx.landmarkByBuilding.has(b.id) || b.use === 'theatre') return 0;
  if (P.mat === MAT.glass || P.mat === MAT.metal) return 0;
  return 1;
}

// Where to split a wall so its top can follow a roof exactly: its ends, a few
// metres apart, and where it crosses the roof's ridge line or hip lines.
function wallStations(R, a, c, L) {
  const us = [0, L];
  if (!R) return us;
  const n = Math.max(1, Math.ceil(L / 2));
  for (let k = 1; k < n; k++) us.push((L * k) / n);
  const S = (u) => { const x = a[0] + (c[0] - a[0]) * u / L, z = a[1] + (c[1] - a[1]) * u / L, dx = x - R.o.cx, dz = z - R.o.cz; return [dx * R.ux + dz * R.uz, dx * R.vx + dz * R.vz]; };
  const f = (u) => { const [s, t] = S(u); return (R.hs - Math.abs(t)) / R.hs - (R.ridge < R.hl - 0.01 ? (R.hl - Math.abs(s)) / (R.hl - R.ridge) : 1e9); };
  const fine = 24;
  for (let k = 0; k < fine; k++) {
    const u0 = (L * k) / fine, u1 = (L * (k + 1)) / fine;
    const [s0, t0] = S(u0), [s1, t1] = S(u1);
    if (t0 * t1 < 0) us.push(u0 + (u1 - u0) * (t0 / (t0 - t1)));          // the ridge line
    if (s0 * s1 < 0) us.push(u0 + (u1 - u0) * (s0 / (s0 - s1)));          // the roof's middle (pyramid apex line)
    let lo = u0, hi = u1, flo = f(lo), fhi = f(hi);
    if (flo * fhi < 0 && Math.abs(flo) < 1e8 && Math.abs(fhi) < 1e8) {     // a hip line
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2, fm = f(m); if (fm * flo <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } }
      us.push((lo + hi) / 2);
    }
  }
  return [...new Set(us.map((u) => Math.round(u * 1e4) / 1e4))].sort((p, q) => p - q);
}

// Miter inset of a ring (positive area = CCW in x,z), clamped.
export function insetRing(ring, d) {
  const n = ring.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n], q = ring[i], r = ring[(i + 1) % n];
    let ax = q[0] - p[0], az = q[1] - p[1]; let la = Math.hypot(ax, az) || 1; ax /= la; az /= la;
    let bx = r[0] - q[0], bz = r[1] - q[1]; let lb = Math.hypot(bx, bz) || 1; bx /= lb; bz /= lb;
    // inward normals (left of direction)
    const n1x = -az, n1z = ax, n2x = -bz, n2z = bx;
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 1e-3) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
    const cos = mx * n1x + mz * n1z;
    const k = d / Math.max(0.35, cos);
    out.push([q[0] + mx * k, q[1] + mz * k]);
  }
  return out;
}

export function addBuilding(ctx, b, vb, cb, ox, oz) {
  const lm = ctx.landmarkByBuilding.get(b.id) || null;
  const special = lm ? landmarkParts[lm.id] || null : null;
  // landmark corrections from the reference notes and photos (heights, roofs)
  if (special && special.override) b = { ...b, ...(typeof special.override === 'function' ? special.override(b) : special.override) };
  const P = buildingParams(ctx, b);
  if (special && special.params) Object.assign(P, special.params(P, b));
  const cen = centroid(b.outer);
  vb.set('aBid', [b._idx || 0]).set('aCen', [cen[0], cen[1]]);
  const fronts = frontEdges(ctx, b, P);
  const base = P.base;
  const y0 = base - 0.8;                                  // sink into sloping ground
  let eaves = base + b.height;
  let roof = b.roof, rh = b.roofHeight, ridgeAlong = null;
  if (special && special.roof) ({ roof, rh } = special.roof(b, rh) || { roof, rh });
  if (P.church && rh < 4) rh = Math.max(rh, 5);
  // the photographed roof (houses): its shape, and which way its gable faces the street
  const sv = b.survey && b.survey.full ? b.survey : null;
  if (sv && sv.roof && !special) {
    roof = { gable_front: 'gabled', gable_side: 'gabled', cross_gable: 'gabled', hipped: 'hipped', mansard: 'mansard' }[sv.roof] || roof;
    const ob = obb(b.outer);
    if (ob && rh < 1.5) rh = Math.max(rh, Math.min(4.5, Math.min(ob.hu, ob.hv) * 0.85));
    if (b.front >= 0) {
      const a = b.outer[b.front], c = b.outer[(b.front + 1) % b.outer.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L;
      ridgeAlong = sv.roof === 'gable_side' ? [dx, dz] : sv.roof === 'gable_front' || sv.roof === 'cross_gable' ? [dz, -dx] : null;
    }
  }
  // flat roofs on commercial blocks get a parapet; the survey says what crowns a front
  const parapet = roof === 'flat' && (P.commercial || P.civic) ? (sv && sv.cornice === 'none' ? 0.3 : 0.85) : roof === 'flat' ? 0.3 : 0;
  P.cornice = sv && sv.cornice ? sv.cornice : parapet > 0.5 ? 'bracketed' : 'none';
  const top = eaves + parapet;
  const area = polyArea(b.outer);
  const S = (part, extraFlags = 0, mat = P.mat) => {
    vb.set('aF0', [part, 0, b.height, P.storeys]).set('aF1', [mat, P.flags | extraFlags, P.seed, P.gfh]).set('aFac', [0]);
  };
  const rel = (p, y) => [p[0] - ox, y, p[1] - oz];
  const rings = [b.outer, ...b.holes.map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h))];
  const R = special && special.replacesRoof ? null : roofFrame(b, rings, eaves, rh, roof, P, ridgeAlong);
  // ---- walls
  rings.forEach((ring, ri) => {
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i], c = ring[(i + 1) % n];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
      const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
      const isFront = ri === 0 && fronts.has(i);
      const swap = ri === 0 ? modelledFront(ctx, P, b, isFront, L) : 0;
      const wmat = (special && special.wallMat && ri === 0 ? special.wallMat(b, i) : null) ?? P.mat;
      const setW = (fac) => vb.set('aF0', [PART.wall, L, b.height, P.storeys]).set('aF1', [wmat, P.flags | (isFront ? FLAG.front : 0) | (wmat !== P.mat ? FLAG.ownMat : 0), P.seed + i * 0.0137, P.gfh]).set('aFac', [fac]);
      // stations along the wall: the ends, and where its top meets a roof ridge or hip
      const us = wallStations(R, a, c, L);
      const wq = (u0, y0a, y0b, u1, y1a, y1b) => {
        const A = [a[0] + (c[0] - a[0]) * u0 / L, a[1] + (c[1] - a[1]) * u0 / L], C = [a[0] + (c[0] - a[0]) * u1 / L, a[1] + (c[1] - a[1]) * u1 / L];
        const i0 = vb.v(A[0] - ox, y0a, A[1] - oz, nx, 0, nz, u0, y0a - base), i1 = vb.v(C[0] - ox, y0b, C[1] - oz, nx, 0, nz, u1, y0b - base);
        const i2 = vb.v(C[0] - ox, y1b, C[1] - oz, nx, 0, nz, u1, y1b - base), i3 = vb.v(A[0] - ox, y1a, A[1] - oz, nx, 0, nz, u0, y1a - base);
        vb.quad(i1, i0, i3, i2);
        return [A, C];
      };
      for (let k = 0; k + 1 < us.length; k++) {
        const u0 = us[k], u1 = us[k + 1];
        const pa = [a[0] + (c[0] - a[0]) * u0 / L, a[1] + (c[1] - a[1]) * u0 / L], pc = [a[0] + (c[0] - a[0]) * u1 / L, a[1] + (c[1] - a[1]) * u1 / L];
        const ta = R ? Math.max(top, roofHeightAt(R, pa[0], pa[1])) : top, tc = R ? Math.max(top, roofHeightAt(R, pc[0], pc[1])) : top;
        // the storeys (swapped for a modelled front near the focus), then the gable or the wall up to the roof
        setW(swap); wq(u0, y0, y0, u1, top, top);
        if (ta > top + 1e-3 || tc > top + 1e-3) { setW(0); wq(u0, top, top, u1, ta - 0.003, tc - 0.003); }
        cb.quad(rel(pc, y0), rel(pa, y0), rel(pa, ta + 0.02), rel(pc, tc + 0.02), WALL_SURF[wmat]);   // wound to face out; into the roof
      }
      // storefront awnings and cornices on street fronts
      if (isFront && (P.flags & FLAG.store) && L > 3.5 && P.storeys >= 1) awnings(vb, swap ? null : cb, a, c, L, nx, nz, base, P, ox, oz, i, swap);
      if (isFront && parapet > 0.5 && L > 2 && CORNICE_STRIP[P.cornice] !== undefined) cornice(vb, swap ? null : cb, a, c, L, nx, nz, top, P, ox, oz, swap);
    }
  });
  // ---- roof
  const cap = (ringsTop, y, part) => capPoly(vb, cb, ringsTop, y, ox, oz, part);
  if (special && special.replacesRoof) {
    S(PART.flat); cap(rings, eaves, PART.flat);
  } else if (roof === 'flat' || rh < 0.4 || area < 6) {
    S(parapet > 0.5 ? PART.flat : PART.roof);
    cap(rings, eaves + (parapet > 0.5 ? 0 : 0.02), parapet > 0.5 ? PART.flat : PART.flat);
    if (parapet > 0) parapetInside(vb, cb, rings[0], eaves, top, P, ox, oz);
  } else {
    pitchedRoof(vb, cb, b, rings, eaves, rh, roof, P, ox, oz, ctx, R);
  }
  if (P.church && !(special && special.noSteeple)) steeple(vb, cb, b, eaves, rh, P, ox, oz, fronts);
  if (special) special.build({ ctx, b, P, vb, cb, ox, oz, base, eaves, rh, fronts, S, kit: KIT });
  // chimneys on houses
  if (P.house && roof !== 'flat' && area > 50 && P.seed > 0.35) {
    const c = centroid(b.outer); const o = obb(b.outer);
    if (o) {
      const off = (P.seed - 0.5) * 2 * o.hu * 0.6;
      const cx = c[0] + o.ux * off, cz = c[1] + o.uz * off;
      S(PART.plain, 0, MAT.brick_red);
      KIT.box(vb, cb, cx - ox, eaves + rh * 0.55, cz - oz, 0.35, rh * 0.5 + 0.7, 0.45, Math.atan2(o.uz, o.ux), SURFACE.wall_brick);
    }
  }
  // porches on house fronts
  const porchKind = sv && sv.features ? (sv.features.some((f) => /full-width porch|verandah|two-storey porch|wrap/.test(f)) ? 'full' : sv.features.some((f) => /porch/.test(f)) ? 'entry' : null)
    : (P.seed < 0.35 ? 'full' : P.seed < 0.7 ? 'entry' : null);
  if (P.house && b.front >= 0 && area > 45 && porchKind) porch(vb, cb, b, base, P, ox, oz, porchKind, sv && sv.features.some((f) => /white columns/.test(f)));
}

// ---------------------------------------------------------------- parts
function capPoly(vb, cb, rings, y, ox, oz, part) {
  const toV = (l) => l.map((p) => new THREE.Vector2(p[0], p[1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(toV(rings[0]), rings.slice(1).map(toV)); } catch { return; }
  const all = [].concat(...rings);
  const ids = all.map((p) => vb.v(p[0] - ox, y, p[1] - oz, 0, 1, 0, p[0], p[1]));
  for (const f of faces) {
    const a = all[f[0]], b = all[f[1]], c = all[f[2]];
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
    if (up) vb.tri(ids[f[0]], ids[f[1]], ids[f[2]]); else vb.tri(ids[f[0]], ids[f[2]], ids[f[1]]);
    cb.tri([a[0] - ox, y, a[1] - oz], [b[0] - ox, y, b[1] - oz], [c[0] - ox, y, c[1] - oz], SURFACE.roof);
  }
}

function parapetInside(vb, cb, ring, y0, y1, P, ox, oz) {
  const inner = insetRing(ring, 0.25);
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = inner[i], c = inner[(i + 1) % n], A = ring[i], C = ring[(i + 1) % n];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
    const nx = -(c[1] - a[1]) / L, nz = (c[0] - a[0]) / L;      // facing inward
    vb.set('aF0', [PART.plain, L, 0, 1]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [0]);
    const i0 = vb.v(a[0] - ox, y0, a[1] - oz, nx, 0, nz, 0, 0), i1 = vb.v(c[0] - ox, y0, c[1] - oz, nx, 0, nz, L, 0);
    const i2 = vb.v(c[0] - ox, y1, c[1] - oz, nx, 0, nz, L, y1 - y0), i3 = vb.v(a[0] - ox, y1, a[1] - oz, nx, 0, nz, 0, y1 - y0);
    vb.quad(i0, i1, i2, i3);
    // coping on top
    vb.set('aF0', [PART.trim, L, 0, 1]);
    const j0 = vb.v(A[0] - ox, y1, A[1] - oz, 0, 1, 0, 0, 0), j1 = vb.v(C[0] - ox, y1, C[1] - oz, 0, 1, 0, L, 0);
    const j2 = vb.v(c[0] - ox, y1, c[1] - oz, 0, 1, 0, L, 0.25), j3 = vb.v(a[0] - ox, y1, a[1] - oz, 0, 1, 0, 0, 0.25);
    vb.quadFacing(j0, j1, j2, j3, [0, 1, 0]);
    cb.quad([a[0] - ox, y0, a[1] - oz], [c[0] - ox, y0, c[1] - oz], [c[0] - ox, y1, c[1] - oz], [a[0] - ox, y1, a[1] - oz], WALL_SURF[P.mat]);
    cb.quad([A[0] - ox, y1, A[1] - oz], [C[0] - ox, y1, C[1] - oz], [c[0] - ox, y1, c[1] - oz], [a[0] - ox, y1, a[1] - oz], SURFACE.roof);
  }
}

export function cornice(vb, cb, a, c, L, nx, nz, top, P, ox, oz, swap = 0) {
  const d = 0.42, h = 0.55, yb = top - h - 0.05, yt = top + 0.08;
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L;
  const A = [a[0] - dx * 0.1, a[1] - dz * 0.1], C = [c[0] + dx * 0.1, c[1] + dz * 0.1];
  const Ao = [A[0] + nx * d, A[1] + nz * d], Co = [C[0] + nx * d, C[1] + nz * d];
  vb.set('aF0', [PART.trim, L, h, (CORNICE_STRIP[P.cornice] ?? -1) + 1]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [swap]);
  const v = (p, y, n, u, w) => vb.v(p[0] - ox, y, p[1] - oz, n[0], n[1], n[2], u, w);
  const N = [nx, 0, nz];
  // front face (slightly sloped forward at the top), underside, top
  let q = [v(Ao, yb, N, 0, 0), v(Co, yb, N, L + 0.2, 0), v(Co, yt, N, L + 0.2, h), v(Ao, yt, N, 0, h)];
  vb.quad(q[1], q[0], q[3], q[2]);
  q = [v(A, yb, [0, -1, 0], 0, 0), v(C, yb, [0, -1, 0], L, 0), v(Co, yb, [0, -1, 0], L, 0.4), v(Ao, yb, [0, -1, 0], 0, 0.4)];
  vb.quad(q[1], q[0], q[3], q[2]);
  q = [v(A, yt, [0, 1, 0], 0, 0), v(C, yt, [0, 1, 0], L, 0), v(Co, yt, [0, 1, 0], L, 0.4), v(Ao, yt, [0, 1, 0], 0, 0.4)];
  vb.quad(q[0], q[1], q[2], q[3]);
  // ends
  for (const [P0, P1, s] of [[A, Ao, -1], [C, Co, 1]]) {
    const n2 = [dx * s, 0, dz * s];
    q = [v(P0, yb, n2, 0, 0), v(P1, yb, n2, 0.4, 0), v(P1, yt, n2, 0.4, h), v(P0, yt, n2, 0, h)];
    vb.quadFacing(q[0], q[1], q[2], q[3], n2);
  }
  const r = (p, y) => [p[0] - ox, y, p[1] - oz];
  if (!cb) return;
  cb.quad(r(Ao, yb), r(Co, yb), r(Co, yt), r(Ao, yt), SURFACE.prop);     // a cornice is not a wall to cling to
  cb.quad(r(A, yb), r(C, yb), r(Co, yb), r(Ao, yb), SURFACE.prop);
  cb.quad(r(A, yt), r(C, yt), r(Co, yt), r(Ao, yt), SURFACE.roof);
}

export function awnings(vb, cb, a, c, L, nx, nz, base, P, ox, oz, edge, swap = 0, plan = null) {
  const units = plan ? plan.length : Math.max(1, Math.floor(L / 7 + 0.4)), uw = L / units;
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L;
  for (let u = 0; u < units; u++) {
    const h = hash1(Math.floor(P.seed * 1e6) + u * 7919 + edge * 104729);
    if (plan ? !plan[u] : h > 0.5) continue;
    const s0 = (plan ? plan[u].u0 : u * uw) + 0.45, s1 = (plan ? plan[u].u1 : (u + 1) * uw) - 0.45; if (s1 - s0 < 1.5) continue;
    const unitW = plan ? -(plan[u].unit + 1) : 1;
    const yTop = base + P.gfh - 0.98, out = 1.25, drop = 0.7, val = 0.28;
    const p = (s, o) => [a[0] + dx * s + nx * o, a[1] + dz * s + nz * o];
    vb.set('aF0', [PART.awning, s1 - s0, 0, unitW]).set('aF1', [P.mat, 0, P.seed + h * 3.1, 3]).set('aFac', [swap]);
    const slope = Math.atan2(drop, out); const sn = [nx * Math.sin(slope), Math.cos(slope), nz * Math.sin(slope)];
    const V = (q, y, n, uu, w) => vb.v(q[0] - ox, y, q[1] - oz, n[0], n[1], n[2], uu, w);
    let q = [V(p(s0, 0.02), yTop, sn, s0, 0), V(p(s1, 0.02), yTop, sn, s1, 0), V(p(s1, out), yTop - drop, sn, s1, 1), V(p(s0, out), yTop - drop, sn, s0, 1)];
    vb.quadFacing(q[0], q[1], q[2], q[3], sn);
    const fn = [nx, 0, nz];
    q = [V(p(s0, out), yTop - drop - val, fn, s0, 1.3), V(p(s1, out), yTop - drop - val, fn, s1, 1.3), V(p(s1, out), yTop - drop, fn, s1, 1), V(p(s0, out), yTop - drop, fn, s0, 1)];
    vb.quadFacing(q[0], q[1], q[2], q[3], fn);
    for (const [s, sgn] of [[s0, -1], [s1, 1]]) {
      const n2 = [dx * sgn, 0, dz * sgn];
      const t = [V(p(s, 0.02), yTop, n2, 0, 0), V(p(s, out), yTop - drop, n2, 1, 1), V(p(s, out), yTop - drop - val, n2, 1, 1.3)];
      vb.triFacing(t[0], t[1], t[2], n2);
    }
    const r = (q2, y) => [q2[0] - ox, y, q2[1] - oz];
    if (cb) cb.quad(r(p(s0, 0.02), yTop), r(p(s1, 0.02), yTop), r(p(s1, out), yTop - drop), r(p(s0, out), yTop - drop), SURFACE.prop);
  }
}

// Gabled / hipped / pyramidal roofs over the footprint's oriented rectangle
// when the footprint is close to one, else a hip-like roof from an inset ring.
// A pitched roof fitted to the footprint's oriented rectangle (when the
// footprint is close to one), or null. Shared by the roof and the walls: the
// walls rise to the roof's underside so no slot opens between them.
export function roofFrame(b, rings, eaves, rh, roof, P, ridgeAlong = null) {
  if (roof === 'flat' || rh < 0.4 || polyArea(b.outer) < 6 || roof === 'dome' || roof === 'mansard') return null;
  const o = obb(b.outer);
  if (!o || polyArea(b.outer) / o.area <= 0.86 || rings.length !== 1) return null;
  let ux = o.ux, uz = o.uz, hl = o.hu, hs = o.hv;
  // the ridge runs along the long axis, or along the photographed direction
  const swapAxes = ridgeAlong ? Math.abs(o.ux * ridgeAlong[0] + o.uz * ridgeAlong[1]) < 0.7071 : hs > hl;
  if (swapAxes) { ux = -o.uz; uz = o.ux; hl = o.hv; hs = o.hu; }
  if (ridgeAlong && roof !== 'gabled' && hs > hl) { ux = o.ux; uz = o.uz; hl = o.hu; hs = o.hv; }
  const e = P.house ? 0.4 : 0.25;
  hl += e; hs += e;
  const slopeDrop = e * (rh / Math.max(0.5, hs - e));
  const yE = eaves - slopeDrop, yR = eaves + rh;
  let ridge = roof === 'gabled' ? hl : roof === 'pyramidal' ? 0 : Math.max(0, hl - hs);
  if (roof === 'gabled' && P.church) ridge = hl;
  return { o, ux, uz, vx: -uz, vz: ux, hl, hs, e, slopeDrop, yE, yR, ridge };
}
// height of that roof's surface over (x, z)
export function roofHeightAt(R, x, z) {
  const dx = x - R.o.cx, dz = z - R.o.cz;
  const s = Math.abs(dx * R.ux + dz * R.uz), t = Math.abs(dx * R.vx + dz * R.vz);
  const rise = R.yR - R.yE;
  let f = (R.hs - t) / R.hs;                                   // the long slopes
  if (R.ridge < R.hl - 0.01) f = Math.min(f, (R.hl - s) / (R.hl - R.ridge));   // hip ends
  return R.yE + rise * Math.max(0, f);
}

function pitchedRoof(vb, cb, b, rings, eaves, rh, roof, P, ox, oz, ctx, R) {
  const roofPart = (P.church || P.civic) && P.seed < 0.5 ? PART.copper : PART.roof;
  const set = (L) => vb.set('aF0', [roofPart === PART.copper ? PART.roof : PART.roof, L, 0, 1]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [0]);
  if (R) {
    const { o, ux, uz, vx, vz, e, slopeDrop, yE, yR, ridge } = R;
    let { hl, hs } = R;
    const W = (s, t, y) => [o.cx + ux * s + vx * t - ox, y, o.cz + uz * s + vz * t - oz];
    void hl; void hs;
    const plane = (p0, p1, p2, p3, L) => {
      set(L);
      const nrm = new THREE.Vector3().crossVectors(new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)), new THREE.Vector3(...p3).sub(new THREE.Vector3(...p0))).normalize();
      if (nrm.y < 0) nrm.negate();
      const sl = Math.hypot(rh + slopeDrop, hs);
      const ids = [p0, p1, p2, p3].map((p, k) => vb.v(p[0], p[1], p[2], nrm.x, nrm.y, nrm.z, k === 1 || k === 2 ? L : 0, k >= 2 ? sl : 0));
      const n2 = new THREE.Vector3().crossVectors(new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)), new THREE.Vector3(...p3).sub(new THREE.Vector3(...p0)));
      if (n2.y > 0) { vb.quad(ids[0], ids[1], ids[2], ids[3]); cb.quad(p0, p1, p2, p3, SURFACE.roof); } else { vb.quad(ids[1], ids[0], ids[3], ids[2]); cb.quad(p1, p0, p3, p2, SURFACE.roof); }
    };
    const tri = (p0, p1, p2, L) => {
      set(L);
      const n2 = new THREE.Vector3().crossVectors(new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)), new THREE.Vector3(...p2).sub(new THREE.Vector3(...p0)));
      const up = n2.y > 0; n2.normalize(); if (!up) n2.negate();
      const ids = [p0, p1, p2].map((p, k) => vb.v(p[0], p[1], p[2], n2.x, n2.y, n2.z, k === 1 ? L : k === 2 ? L / 2 : 0, k === 2 ? Math.hypot(rh, hs) : 0));
      if (up) { vb.tri(ids[0], ids[1], ids[2]); cb.tri(p0, p1, p2, SURFACE.roof); } else { vb.tri(ids[0], ids[2], ids[1]); cb.tri(p0, p2, p1, SURFACE.roof); }
    };
    // the two long slopes
    plane(W(-hl, -hs, yE), W(hl, -hs, yE), W(ridge, 0, yR), W(-ridge, 0, yR), 2 * hl);
    plane(W(hl, hs, yE), W(-hl, hs, yE), W(-ridge, 0, yR), W(ridge, 0, yR), 2 * hl);
    if (ridge < hl - 0.01) {
      tri(W(hl, -hs, yE), W(hl, hs, yE), W(ridge, 0, yR), 2 * hs);
      tri(W(-hl, hs, yE), W(-hl, -hs, yE), W(-ridge, 0, yR), 2 * hs);
    } else {
      // the gable walls are the footprint's own walls, which rise to the roof (see addBuilding)
      // bargeboards along the rakes of house gables (painted trim)
      if (P.house) {
        vb.set('aF0', [PART.trim, 2, 0.22, 1]).set('aF1', [P.mat, 0, P.seed + 0.37, 3]).set('aFac', [0]);
        for (const sg of [-1, 1]) {
          const o = [ux * sg * 0.03, 0, uz * sg * 0.03];
          const E1 = W(sg * hl, -hs, yE - 0.02), Rg = W(sg * hl, 0, yR + 0.02), E2 = W(sg * hl, hs, yE - 0.02);
          for (const [A, C] of [[E1, Rg], [Rg, E2]]) board(vb, [A[0] + o[0], A[1], A[2] + o[2]], [C[0] + o[0], C[1], C[2] + o[2]], [ux * sg, 0, uz * sg], 0.24, 0.05);
          if (ctx.assets && ctx.assets.tex.kit_trim) {
            // the carved bargeboard peak (facade kit) at the top of the gable
            const rise = yR - yE, pw = Math.min(hs * 1.1, rise * 1.6), ph = pw * 0.62;
            vb.set('aF0', [PART.kit, 4, 7, 0]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [0]);
            const Q = [W(sg * (hl + 0.06), -pw / 2, yR - ph + 0.05), W(sg * (hl + 0.06), pw / 2, yR - ph + 0.05), W(sg * (hl + 0.06), pw / 2, yR + 0.05), W(sg * (hl + 0.06), -pw / 2, yR + 0.05)];
            const wantN = [ux * sg, 0, uz * sg];
            const uvs = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[1, 0], [0, 0], [0, 1], [1, 1]];
            const ids = Q.map((q, k) => vb.v(q[0], q[1], q[2], wantN[0], 0, wantN[2], uvs[k][0], uvs[k][1]));
            vb.quadFacing(ids[0], ids[1], ids[2], ids[3], wantN);
          }
        }
      }
    }
    // soffit (underside) so the overhang reads from below
    vb.set('aF0', [PART.trim, 2 * hl, 0, 1]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [0]);
    const sids = [W(-hl, -hs, yE), W(hl, -hs, yE), W(hl, hs, yE), W(-hl, hs, yE)].map((p) => vb.v(p[0], p[1], p[2], 0, -1, 0, p[0], p[2]));
    vb.quadFacing(sids[0], sids[1], sids[2], sids[3], [0, -1, 0]);
    return;
  }
  // inset (hip-like) roof for irregular footprints
  const outer = rings[0];
  const o = obb(b.outer);
  const minHalf = o ? Math.min(o.hu, o.hv) : 3;
  let d = roof === 'mansard' ? Math.min(rh * 0.35, minHalf * 0.4) : Math.min(rh * 1.4, minHalf * 0.75);
  let inner = insetRing(outer, d);
  if (signedArea(inner) < polyArea(outer) * 0.04 || selfCross(inner)) { d *= 0.5; inner = insetRing(outer, d); }
  if (signedArea(inner) <= 0 || selfCross(inner)) { inner = insetRing(outer, 0.3); d = 0.3; }
  const yT = eaves + (roof === 'mansard' ? rh : Math.min(rh, d * 1.1 + 0.5));
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const A = outer[i], C = outer[(i + 1) % n], a = inner[i], c = inner[(i + 1) % n];
    const L = Math.hypot(C[0] - A[0], C[1] - A[1]); if (L < 0.05) continue;
    const p0 = [A[0] - ox, eaves, A[1] - oz], p1 = [C[0] - ox, eaves, C[1] - oz], p2 = [c[0] - ox, yT, c[1] - oz], p3 = [a[0] - ox, yT, a[1] - oz];
    const nrm = new THREE.Vector3().crossVectors(new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)), new THREE.Vector3(...p3).sub(new THREE.Vector3(...p0)));
    const up = nrm.y > 0; nrm.normalize(); if (!up) nrm.negate();
    set(L);
    const sl = Math.hypot(yT - eaves, d);
    const ids = [p0, p1, p2, p3].map((p, k) => vb.v(p[0], p[1], p[2], nrm.x, nrm.y, nrm.z, k === 1 || k === 2 ? L : 0, k >= 2 ? sl : 0));
    if (up) { vb.quad(ids[0], ids[1], ids[2], ids[3]); cb.quad(p0, p1, p2, p3, SURFACE.roof); } else { vb.quad(ids[1], ids[0], ids[3], ids[2]); cb.quad(p1, p0, p3, p2, SURFACE.roof); }
  }
  set(1);
  capPoly(vb, cb, [inner], yT, ox, oz, PART.roof);
  if (rings.length > 1) { set(1); capPoly(vb, cb, rings.slice(1).map((h) => h), eaves, ox, oz, PART.roof); }
}
// a flat board from A to C (thickness along `side`, width across it), all six faces
function board(vb, A, C, side, width, thick) {
  const d = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], L = Math.hypot(...d);
  const sv = side.map((v) => v * thick / 2);
  let t = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]];
  const tl = Math.hypot(...t) || 1; t = t.map((v) => (v / tl) * width / 2);
  const P = (a, b, e) => [(a ? C : A)[0] + sv[0] * b + t[0] * e, (a ? C : A)[1] + sv[1] * b + t[1] * e, (a ? C : A)[2] + sv[2] * b + t[2] * e];
  const faces = [[P(0, 1, -1), P(1, 1, -1), P(1, 1, 1), P(0, 1, 1)], [P(1, -1, -1), P(0, -1, -1), P(0, -1, 1), P(1, -1, 1)],
    [P(0, -1, 1), P(0, 1, 1), P(1, 1, 1), P(1, -1, 1)], [P(1, -1, -1), P(1, 1, -1), P(0, 1, -1), P(0, -1, -1)]];
  for (const f of faces) {
    const ids = f.map((p, k) => vb.v(p[0], p[1], p[2], side[0], 0.2, side[2], k === 1 || k === 2 ? L : 0, k >= 2 ? width : 0));
    vb.quad(ids[0], ids[1], ids[2], ids[3]);
  }
}
function selfCross(r) {
  const n = r.length; if (n > 60) return false;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segX(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
  }
  return false;
}
function segX(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

// A church tower with a spire, at the front edge.
function steeple(vb, cb, b, eaves, rh, P, ox, oz, fronts) {
  const o = obb(b.outer); if (!o) return;
  const area = polyArea(b.outer); if (area < 120) return;
  // the front: the data's front edge midpoint, else the end of the long axis nearest a road
  let fx, fz;
  const n = b.outer.length;
  if (b.front >= 0) { const a = b.outer[b.front], c = b.outer[(b.front + 1) % n]; fx = (a[0] + c[0]) / 2; fz = (a[1] + c[1]) / 2; }
  else { fx = o.cx + o.ux * o.hu; fz = o.cz + o.uz * o.hu; }
  const c = centroid(b.outer);
  let dx = c[0] - fx, dz = c[1] - fz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const tw = Math.max(3.2, Math.min(6, Math.min(o.hu, o.hv) * 0.62));
  const tx = fx + dx * tw * 0.45, tz = fz + dz * tw * 0.45;
  const yaw = Math.atan2(-dz, dx);
  const base = P.base;
  const shaftTop = eaves + rh + 3.5 + P.seed * 4;
  KIT.tower(vb, cb, P, tx - ox, base, tz - oz, tw, shaftTop, yaw, { belfry: 3.4, clock: P.seed > 0.5, spire: tw * 2.6 + 8 + P.seed * 6, spirePart: PART.copper });
}

function porch(vb, cb, b, base, P, ox, oz, kind = 'entry', whitePosts = false) {
  const n = b.outer.length, a = b.outer[b.front], c = b.outer[(b.front + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 5) return;
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;
  const full = kind === 'full';
  const w = Math.min(L - 1, full ? L - 1 : 4.2), s0 = (L - w) / 2 + (full ? 0 : (P.seed - 0.5) * (L - w) * 0.8);
  void whitePosts;
  const depth = 2.2, deck = base + 0.55, roofY = base + Math.min(3.2, P.gfh * 0.95);
  const p = (s, o) => [a[0] + dx * s + nx * o, a[1] + dz * s + nz * o];
  const yaw = Math.atan2(-dz, dx);
  const mid = p(s0 + w / 2, depth / 2);
  vb.set('aF0', [PART.porch, w, 0, 1]).set('aF1', [P.mat, 0, P.seed, 3]).set('aFac', [0]);
  KIT.box(vb, cb, mid[0] - ox, deck - 0.3, mid[1] - oz, w / 2, 0.3, depth / 2, yaw, SURFACE.prop);
  KIT.box(vb, cb, mid[0] - ox, roofY + 0.12, mid[1] - oz, w / 2 + 0.15, 0.12, depth / 2 + 0.15, yaw, SURFACE.roof);
  const posts = Math.max(2, Math.round(w / 2.2) + 1);
  for (let k = 0; k < posts; k++) {
    const q = p(s0 + 0.15 + ((w - 0.3) * k) / (posts - 1), depth - 0.15);
    KIT.box(vb, cb, q[0] - ox, (deck + roofY) / 2, q[1] - oz, 0.08, (roofY - deck) / 2, 0.08, yaw, SURFACE.wall_wood);
  }
  // steps
  const st = p(s0 + w / 2, depth + 0.35);
  KIT.box(vb, cb, st[0] - ox, base + 0.15, st[1] - oz, 0.7, 0.15, 0.35, yaw, SURFACE.prop);
}

// ---------------------------------------------------------------- kit of parts (also used by landmarks)
export const KIT = {
  // box with the builder's current attributes; uv in metres on each face
  box(vb, cb, cx, cy, cz, hx, hy, hz, yaw, surf) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const C = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const F = [[4, 5, 6, 7, 2 * hx], [1, 0, 3, 2, 2 * hx], [5, 1, 2, 6, 2 * hz], [0, 4, 7, 3, 2 * hz], [7, 6, 2, 3, 2 * hx], [0, 1, 5, 4, 2 * hx]];
    for (const [a, b, cc, d, w] of F) {
      const pa = C[a], pb = C[b], pd = C[d];
      const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2], vx = pd[0] - pa[0], vy = pd[1] - pa[1], vz = pd[2] - pa[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const h = Math.hypot(vx, vy, vz), vert = Math.abs(ny) < 0.5;
      const ids = [[pa, 0, 0], [pb, w, 0], [C[cc], w, h], [pd, 0, h]].map(([p, u, v]) => vb.v(p[0], p[1], p[2], nx, ny, nz, u, vert ? p[1] - (cy - hy) : v));
      vb.quad(ids[0], ids[1], ids[2], ids[3]);
      if (cb) cb.quad(pa, pb, C[cc], pd, surf);
    }
  },
  // n-sided pyramid / frustum (spires, roofs): from radius r0 at y0 to r1 at y1
  frustum(vb, cb, cx, y0, cz, r0, y1, r1, n, yaw, surf, capTop = false) {
    for (let i = 0; i < n; i++) {
      const a0 = yaw + (i / n) * Math.PI * 2 + Math.PI / n, a1 = yaw + ((i + 1) / n) * Math.PI * 2 + Math.PI / n;
      const p0 = [cx + Math.cos(a0) * r0, y0, cz - Math.sin(a0) * r0], p1 = [cx + Math.cos(a1) * r0, y0, cz - Math.sin(a1) * r0];
      const q0 = [cx + Math.cos(a0) * r1, y1, cz - Math.sin(a0) * r1], q1 = [cx + Math.cos(a1) * r1, y1, cz - Math.sin(a1) * r1];
      const am = (a0 + a1) / 2; const slope = Math.atan2(r0 - r1, y1 - y0);
      const nx = Math.cos(am) * Math.cos(slope), ny = Math.sin(slope), nz = -Math.sin(am) * Math.cos(slope);
      const w = 2 * r0 * Math.sin(Math.PI / n), h = Math.hypot(y1 - y0, r0 - r1);
      const ids = [[p0, 0, 0], [p1, w, 0], [q1, w, h], [q0, 0, h]].map(([p, u, v]) => vb.v(p[0], p[1], p[2], nx, ny, nz, u, v));
      vb.quad(ids[0], ids[1], ids[2], ids[3]);
      if (cb) cb.quad(p0, p1, q1, q0, surf);
    }
    if (capTop && r1 > 0.01) {
      const c = vb.v(cx, y1, cz, 0, 1, 0, 0, 0);
      const ring = [];
      for (let i = 0; i < n; i++) { const a = yaw + (i / n) * Math.PI * 2 + Math.PI / n; ring.push(vb.v(cx + Math.cos(a) * r1, y1, cz - Math.sin(a) * r1, 0, 1, 0, Math.cos(a) * r1, Math.sin(a) * r1)); }
      for (let i = 0; i < n; i++) vb.tri(c, ring[i], ring[(i + 1) % n]);
    }
  },
  setPart(vb, P, part, mat = P.mat, flags = 0, len = 4, eaves = 100, storeys = 1) {
    vb.set('aF0', [part, len, eaves, storeys]).set('aF1', [mat, flags, P.seed, 3]).set('aFac', [0]);
  },
  // square tower: shaft, belfry with arched openings painted, optional clocks, roof
  tower(vb, cb, P, x, base, z, w, top, yaw, opt = {}) {
    const h = top - base, hw = w / 2;
    KIT.setPart(vb, P, PART.wall, opt.mat ?? P.mat, FLAG.front | FLAG.arched, w, h - 0.4, Math.max(2, Math.round(h / 4.8)));
    KIT.box(vb, cb, x, base + h / 2 - 0.4, z, hw, h / 2 + 0.4, hw, yaw, WALL_SURF[opt.mat ?? P.mat]);
    let y = top;
    // a stone (or painted) band
    KIT.setPart(vb, P, opt.band ?? PART.stone);
    KIT.box(vb, cb, x, y + 0.15, z, hw + 0.12, 0.15, hw + 0.12, yaw, SURFACE.wall_stone);
    y += 0.3;
    if (opt.belfry) {
      const bh = opt.belfry;
      // belfry walls with tall arched openings (church flag draws lancets)
      KIT.setPart(vb, P, PART.wall, opt.mat ?? P.mat, FLAG.church | FLAG.front, w, bh + 0.2, 1);
      KIT.box(vb, cb, x, y + bh / 2, z, hw * 0.94, bh / 2, hw * 0.94, yaw, WALL_SURF[opt.mat ?? P.mat]);
      y += bh;
      KIT.setPart(vb, P, PART.trim);
      KIT.box(vb, cb, x, y + 0.2, z, hw + 0.2, 0.2, hw + 0.2, yaw, SURFACE.roof);
      y += 0.4;
    }
    if (opt.pinnacles) {
      KIT.setPart(vb, P, opt.pinnaclePart ?? PART.stone);
      for (let k = 0; k < 4; k++) {
        const a = yaw + Math.PI / 4 + (k * Math.PI) / 2, r = hw * 1.25;
        const px = x + Math.cos(a) * r, pz = z - Math.sin(a) * r;
        KIT.box(vb, cb, px, y + 0.6, pz, 0.32, 0.6, 0.32, yaw, SURFACE.wall_stone);
        KIT.frustum(vb, cb, px, y + 1.2, pz, 0.36, y + 1.2 + opt.pinnacles, 0.03, 4, yaw + Math.PI / 4, SURFACE.roof);
      }
    }
    if (opt.clock) {
      const cy = top - Math.min(2.2, h * 0.12);
      const r = Math.min(hw * 0.75, 1.4);
      KIT.setPart(vb, P, PART.clock, P.mat, opt.clockBlue ? 1 : 0);
      for (let k = 0; k < 4; k++) {
        const a = yaw + (k * Math.PI) / 2;
        const nx = Math.cos(a), nz = -Math.sin(a), tx = -nz, tz = nx; // tangent
        const fx = x + nx * (hw + 0.03), fz = z + nz * (hw + 0.03);
        const seg = 16, c0 = vb.v(fx, cy, fz, nx, 0, nz, 0, 0);
        const ring = [];
        for (let i = 0; i <= seg; i++) { const t = (i / seg) * Math.PI * 2; ring.push(vb.v(fx + tx * Math.cos(t) * r, cy + Math.sin(t) * r, fz + tz * Math.cos(t) * r, nx, 0, nz, Math.cos(t) * 1.0, Math.sin(t) * 1.0)); }
        for (let i = 0; i < seg; i++) vb.tri(c0, ring[i + 1], ring[i]);
      }
    }
    if (opt.spire) {
      KIT.setPart(vb, P, opt.spirePart ?? PART.copper);
      // broach: square to octagon, then the needle
      KIT.frustum(vb, cb, x, y, z, hw * 1.05, y + opt.spire, 0.05, 8, yaw, SURFACE.roof);
      KIT.setPart(vb, P, PART.dark);
      KIT.frustum(vb, null, x, y + opt.spire - 0.2, z, 0.06, y + opt.spire + 1.6, 0.02, 4, yaw, SURFACE.roof);
      y += opt.spire;
    } else if (opt.pyramid) {
      KIT.setPart(vb, P, opt.roofPart ?? PART.roof);
      // a bell-cast skirt, then the steep pyramid
      KIT.frustum(vb, cb, x, y, z, hw * 1.42 + 0.35, y + 0.8, hw * 1.42 - 0.1, 4, yaw + Math.PI / 4, SURFACE.roof);
      KIT.frustum(vb, cb, x, y + 0.8, z, hw * 1.42 - 0.1, y + opt.pyramid, 0.12, 4, yaw + Math.PI / 4, SURFACE.roof);
      y += opt.pyramid;
      KIT.setPart(vb, P, PART.dark);
      KIT.frustum(vb, null, x, y - 0.1, z, 0.08, y + 1.8, 0.02, 4, yaw, SURFACE.roof);
    }
    return y;
  },
};
