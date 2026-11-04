// House lots: what lies between a house and the street, and beside it.
//
// planLots() (once, before the ground map is painted) lays out each house's lot
// from its footprint, its street and the gaps to its neighbours: a front walk
// from the porch steps to the sidewalk, a side driveway (asphalt or gravel) to a
// garage or shed at the back of the lot where there is room, garden beds along
// the front wall, and on some lots a picket fence, a low iron fence, a stone
// wall or a hedge along the front lot line, and a board fence down one side.
// The walks, drives and beds are painted into the ground map (streets.js), so
// what is drawn is what the collider says (concrete, asphalt, gravel, dirt). The
// garages are small buildings of their own (ctx.extraBuildings).
//
// lotDetail() builds, near the focus (the facade detail layer, facade3d.js), the
// fine parts: porch railings and balusters, Italianate eave brackets, fences,
// hedges, shrubs and perennials, all in the cell's collider (fences and railings
// climbable as `fence`, hedges and shrubs `branch`, posts `wall_wood`).
import { SURFACE } from '../surface.js';
import { PART, FLAG } from './materials.js';
import { buildingParams, KIT } from './buildings.js';
import { frontFrame, porchPlan } from './housegeo.js';
import { hashStr, hash2, polyArea, signedArea, PointGrid } from './util.js';

export const PART_PAINT = 19, PART_FOLIAGE = 20, PART_FLOWERS = 21;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const FENCE_PAINT = [0xeeeae0, 0xf2efe6, 0xe6e0cf, 0x3d4a3e, 0x6b4a36];
const SHRUB = [0x3e5a2e, 0x4a6a34, 0x34502c, 0x5a6e36, 0x8a2a20, 0x6e7a38, 0x2e4a2e];    // incl. a burning bush in red
const FLOWERS = [0x8a5cc2, 0xd8a02a, 0xc84a2a, 0xd27aa8, 0xe8d050, 0xb03050, 0xf0f0e8];   // asters, mums, sedum, black-eyed susans

// ---------------------------------------------------------------- planning
export function planLots(ctx) {
  const { data, streets } = ctx;
  ctx.extraBuildings = ctx.extraBuildings || [];
  ctx.lots = [];
  const blockedBy = (x, z, self, pad = 0.6) => {
    for (const [ox, oz] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) { const q = ctx.buildingAt(x + ox, z + oz); if (q && q !== self) return q; }
    return null;
  };
  const onStreet = (x, z, pad = 0.3) => { const q = streets.grid.nearest(x, z, 20); return !!q && q.d < q.seg.data.hw + q.seg.data.band + pad; };
  const tg = new PointGrid(10); for (const t of ctx.trees) tg.add(t.x, t.z, t);
  const nearTree = (x, z, r) => !!tg.any(x, z, r);
  for (const b of data.buildings) {
    if (b.use !== 'residential' || b.front < 0) continue;
    let P; try { P = buildingParams(ctx, b); } catch { continue; }
    if (!P.style) continue;
    const F = frontFrame(b);
    if (F.L < 4.5) continue;
    const mid = F.P(F.L / 2, -0.1);
    const q = streets.grid.nearest(mid[0], mid[1], 45); if (!q) continue;
    const S = q.seg.data, hw = S.hw, band = S.band || 4;
    // the road's direction and the normal from the road to the house
    let rx = q.seg.bx - q.seg.ax, rz = q.seg.bz - q.seg.az; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    let nx = mid[0] - q.qx, nz = mid[1] - q.qz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    const yard = q.d - hw - band;                // front yard depth at the middle of the front
    if (yard < 1.5 || yard > 25) continue;
    // the house faces this road (its front normal points at it)
    if (F.nx * -nx + F.nz * -nz < 0.6) continue;
    const seed = hashStr(b.id + '#lot');
    const lot = { b, F, P, seed, road: { qx: q.qx, qz: q.qz, rx, rz, nx, nz, hw, band, d: q.d }, walk: null, drive: null, beds: [], fences: [], shrubs: [], garage: null };
    // where along the road line the lot line is (back of the sidewalk + 0.4 m)
    const lineAt = (s) => [q.qx + rx * s + nx * (hw + band + 0.4), q.qz + rz * s + nz * (hw + band + 0.4)];
    // the house's extent along the road, relative to q
    const proj = (p) => (p[0] - q.qx) * rx + (p[1] - q.qz) * rz;
    let s0 = Infinity, s1 = -Infinity; for (const p of b.outer) { const s = proj(p); s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    // gaps to the neighbours on each side, a few metres back from the front
    const depthIn = (q.d - hw - band) + 3;
    const gap = (dir) => { const s = dir < 0 ? s0 : s1; for (let g = 0.5; g <= 12; g += 0.5) { const x = q.qx + rx * (s + dir * g) + nx * (hw + band + depthIn), z = q.qz + rz * (s + dir * g) + nz * (hw + band + depthIn); if (ctx.buildingAt(x, z) || onStreet(x, z, -0.5)) return g - 0.5; } return 12; };
    const gL = gap(-1), gR = gap(1);
    lot.side = [s0 - Math.min(6, gL / 2), s1 + Math.min(6, gR / 2)];
    // ---- the front walk: from the porch steps (or the door) straight to the sidewalk
    const pp = porchPlan(b, P, F, P.style);
    const du = pp ? pp.steps ? pp.door : pp.door : P.style.doorAt * F.L;
    const st = pp ? F.P(Math.max(0.9, Math.min(F.L - 0.9, pp.door)), -(pp.depth + 0.15 + Math.max(1, Math.round(0.4 / 0.18)) * 0.3)) : F.P(du, -0.6);
    const sw = proj(st), end = lineAt(sw);
    lot.walk = { from: st, to: [end[0] - nx * 0.6, end[1] - nz * 0.6], w: 1.3 };
    // ---- the driveway: on the wider side if it is at least 3.4 m clear
    const side = gL >= gR ? -1 : 1, g = Math.max(gL, gR);
    if (g >= 3.4 && seed < 0.82) {
      const off = Math.min(g - 1.6, 1.9) * side, sd = (side < 0 ? s0 : s1) + off;
      // back to behind the house
      let back = -Infinity; for (const p of b.outer) back = Math.max(back, (p[0] - q.qx) * nx + (p[1] - q.qz) * nz);
      const a0 = lineAt(sd), dEnd = back + 6.5;
      const a1 = [q.qx + rx * sd + nx * dEnd, q.qz + rz * sd + nz * dEnd];
      // shortened where it would run into a building
      let len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), ok = len;
      for (let t = 0; t <= len; t += 0.5) { const x = a0[0] + nx * t, z = a0[1] + nz * t; if (blockedBy(x, z, null, 1.4)) { ok = t - 0.5; break; } }
      if (ok > 6) {
        lot.drive = { from: [a0[0] - nx * 0.6, a0[1] - nz * 0.6], to: [a0[0] + nx * ok, a0[1] + nz * ok], w: 2.8, gravel: hash2(b.outer[0][0], b.outer[0][1]) < 0.4, s: sd, side };
        // a garage (or a shed) at its end where there is room
        const k = hashStr(b.id + '#garage');
        if (ok > dEnd - (hw + band + 0.4) - 0.6 && k < 0.6) {
          const gw = k < 0.4 ? 3.4 : 2.6, gd = k < 0.4 ? 6.0 : 3.6, gs = sd + (side * (gw - 2.8)) / 2;
          const c0 = back + 1.2 - (hw + band + 0.4), cz0 = [q.qx + rx * gs + nx * (back + 1.4), q.qz + rz * gs + nz * (back + 1.4)];
          void c0;
          const corners = [[-gw / 2, 0], [gw / 2, 0], [gw / 2, gd], [-gw / 2, gd]].map(([u, v]) => [cz0[0] + rx * u + nx * v, cz0[1] + rz * u + nz * v]);
          const clear = corners.every((p) => !blockedBy(p[0], p[1], null, 0.5) && !onStreet(p[0], p[1], 1)) && !blockedBy(cz0[0] + nx * gd / 2, cz0[1] + nz * gd / 2, null, 0.5) && !nearTree(cz0[0] + nx * gd / 2, cz0[1] + nz * gd / 2, gw * 0.7);
          if (clear) {
            const outer = signedArea(corners) > 0 ? corners : corners.slice().reverse();
            // the edge facing the street (towards -n)
            let front = 0, best = -Infinity;
            for (let i = 0; i < 4; i++) { const p = outer[i], r2 = outer[(i + 1) % 4]; const m = [(p[0] + r2[0]) / 2 - cz0[0] - nx * gd / 2, (p[1] + r2[1]) / 2 - cz0[1] - nz * gd / 2]; const d = -(m[0] * nx + m[1] * nz); if (d > best) { best = d; front = i; } }
            const gb = { id: `lot-${b.id}-g`, outer, holes: [], base: NaN, height: gw > 3 ? 2.7 : 2.3, roofHeight: gw > 3 ? 1.4 : 1.0, roof: 'gabled', levels: 1, use: gw > 3 ? 'garage' : 'shed',
              material: hashStr(b.id + '#gm') < 0.6 ? 'clapboard' : b.material || 'clapboard', name: '', street: '', front, colour: null, generated: true };
            lot.garage = gb; ctx.extraBuildings.push(gb); if (ctx.registerBuilding) ctx.registerBuilding(gb);
            lot.drive.to = [cz0[0] - nx * 0.1, cz0[1] - nz * 0.1];
          }
        }
      }
    }
    // ---- beds along the front wall, either side of the porch or steps
    const pu0 = pp ? pp.s0 : du - 0.9, pu1 = pp ? pp.s0 + pp.w : du + 0.9;
    for (const [u0, u1] of [[0.3, pu0 - 0.2], [pu1 + 0.2, F.L - 0.3]]) if (u1 - u0 > 1.2) lot.beds.push({ u0, u1, depth: 1.1 });
    // shrubs in the beds and perennials in front of them
    const r = rngOf(seed);
    for (const bd of lot.beds) {
      const n = Math.max(1, Math.floor((bd.u1 - bd.u0) / 1.8));
      for (let k = 0; k < n; k++) {
        const u = bd.u0 + ((bd.u1 - bd.u0) * (k + 0.5)) / n + (r() - 0.5) * 0.4, p = F.P(u, -0.55 - r() * 0.2);
        if (nearTree(p[0], p[1], 0.9)) continue;
        lot.shrubs.push({ x: p[0], z: p[1], r: 0.38 + r() * 0.32, h: 0.6 + r() * 0.6, col: SHRUB[Math.floor(r() * SHRUB.length)], kind: 'shrub' });
        if (r() < 0.75) { const p2 = F.P(u + (r() - 0.5) * 0.8, -0.95 - r() * 0.1); lot.shrubs.push({ x: p2[0], z: p2[1], r: 0.22 + r() * 0.1, h: 0.35 + r() * 0.2, col: FLOWERS[Math.floor(r() * FLOWERS.length)], kind: 'flowers' }); }
      }
    }
    // ---- a front fence, wall or hedge on some lots, open lawn on most
    const fk = hashStr(b.id + '#fence');
    const ftype = fk < 0.16 ? 'picket' : fk < 0.24 ? 'iron' : fk < 0.42 ? 'hedge' : fk < 0.47 ? 'stone' : null;
    if (ftype) {
      const gaps = [[sw - 0.9, sw + 0.9]];
      if (lot.drive) gaps.push([lot.drive.s - 1.7, lot.drive.s + 1.7]);
      lot.fences.push(...fenceRuns(ctx, lineAt, lot.side[0], lot.side[1], gaps, ftype, b, blockedBy, onStreet, nearTree));
    }
    // ---- a board fence down one side of the back yard
    if (hashStr(b.id + '#side') < 0.5) {
      const sideS = lot.drive ? lot.drive.s + lot.drive.side * 1.9 : (gL < gR ? lot.side[0] : lot.side[1]);
      let back = -Infinity, frontD = Infinity; for (const p of b.outer) { const d = (p[0] - q.qx) * nx + (p[1] - q.qz) * nz; back = Math.max(back, d); frontD = Math.min(frontD, d); }
      const at = (d) => [q.qx + rx * sideS + nx * d, q.qz + rz * sideS + nz * d];
      lot.fences.push(...splitRun(ctx, at, frontD + (back - frontD) * 0.6, back + 10, 'board', b, blockedBy, onStreet));
    }
    b._lot = lot;
    ctx.lots.push(lot);
  }
  return ctx.lots.length;
}
function rngOf(seed) { let s = (Math.floor(seed * 4294967296) >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
// pieces of a fence along the lot line between s0 and s1, leaving gaps, clear of buildings and streets
function fenceRuns(ctx, lineAt, s0, s1, gaps, type, b, blockedBy, onStreet, nearTree) {
  const out = []; let run = null;
  const ok = (s) => { const p = lineAt(s); return !gaps.some(([g0, g1]) => s > g0 && s < g1) && !blockedBy(p[0], p[1], null, 0.5) && !onStreet(p[0], p[1], 0.15) && !nearTree(p[0], p[1], 0.5); };
  for (let s = s0; s <= s1 + 1e-6; s += 0.25) {
    if (ok(s)) { if (!run) run = { a: s, b: s }; else run.b = s; }
    else if (run) { if (run.b - run.a > 0.9) out.push({ p0: lineAt(run.a), p1: lineAt(run.b), type }); run = null; }
  }
  if (run && run.b - run.a > 0.9) out.push({ p0: lineAt(run.a), p1: lineAt(run.b), type });
  void b;
  return out;
}
function splitRun(ctx, at, d0, d1, type, b, blockedBy, onStreet) {
  const out = []; let run = null;
  for (let d = d0; d <= d1; d += 0.25) {
    const p = at(d), ok = !blockedBy(p[0], p[1], null, 0.4) && !onStreet(p[0], p[1], 0.5);
    if (ok) { if (!run) run = { a: d, b: d }; else run.b = d; }
    else if (run) { if (run.b - run.a > 1.5) out.push({ p0: at(run.a), p1: at(run.b), type }); run = null; }
  }
  if (run && run.b - run.a > 1.5) out.push({ p0: at(run.a), p1: at(run.b), type });
  void b;
  return out;
}

// Paints the lots into the ground map (streets.js buildGroundMap): A = asphalt / concrete / gravel, B dirt.
export function paintLots(ctx, A, B) {
  const line = (g, a, b, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  A.lineCap = 'butt';
  for (const lot of ctx.lots || []) {
    if (lot.drive) { A.strokeStyle = lot.drive.gravel ? 'rgb(0,0,255)' : 'rgb(255,0,0)'; line(A, lot.drive.from, lot.drive.to, lot.drive.w); }
    if (lot.walk) { A.strokeStyle = 'rgb(0,255,0)'; line(A, lot.walk.from, lot.walk.to, lot.walk.w); }
    B.strokeStyle = 'rgb(0,0,255)'; B.lineCap = 'butt';
    for (const bd of lot.beds) { const a = lot.F.P(bd.u0, -bd.depth / 2 - 0.1), c = lot.F.P(bd.u1, -bd.depth / 2 - 0.1); line(B, a, c, bd.depth + 0.2); }
  }
  A.lineCap = 'round'; B.lineCap = 'round';
}

// ---------------------------------------------------------------- near detail
const setP = (vb, part, rgb, seed = 0.5) => vb.set('aF0', [part, rgb[0], rgb[1], rgb[2]]).set('aF1', [0, 0, seed, 3]).set('aFac', [0]);
// a box into vb and the collider
const box = (vb, cb, c, hx, hy, hz, yaw, surf, faces = 63) => KIT.box(vb, cb, c[0], c[1], c[2], hx, hy, hz, yaw, surf, faces);
// a low-poly shrub: a jittered, flattened sphere (closed), in the collider as branch
function blob(vb, cb, x, y, z, r, h, seed, surf) {
  const R = rngOf(seed), N = 7, rings = [0.18, 0.55, 0.9];
  const pts = [];
  for (let i = 0; i < rings.length; i++) {
    const ang = Math.asin(rings[i] * 2 - 1), rr = Math.cos(ang), yy = y + (Math.sin(ang) + 1) * 0.5 * h;
    const ring = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2 + i * 0.4, j = 0.85 + 0.3 * R(); ring.push([x + Math.cos(a) * r * rr * j, yy, z + Math.sin(a) * r * rr * j]); }
    pts.push(ring);
  }
  const top = [x, y + h, z], bot = [x, y - 0.05, z];
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    const m = [(a[0] + b[0] + c[0]) / 3 - x, (a[1] + b[1] + c[1]) / 3 - (y + h / 2), (a[2] + b[2] + c[2]) / 3 - z];
    let flip = nx * m[0] + ny * m[1] + nz * m[2] < 0; nx /= l; ny /= l; nz /= l; if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    // normals bent outward from the centre so the shrub reads round
    const ml = Math.hypot(...m) || 1; nx = nx * 0.5 + (m[0] / ml) * 0.5; ny = ny * 0.5 + (m[1] / ml) * 0.5; nz = nz * 0.5 + (m[2] / ml) * 0.5;
    const ids = [a, b, c].map((p) => vb.v(p[0], p[1], p[2], nx, ny, nz, p[0], p[1] + p[2]));
    if (flip) { vb.tri(ids[0], ids[2], ids[1]); cb.tri(a, c, b, surf); } else { vb.tri(ids[0], ids[1], ids[2]); cb.tri(a, b, c, surf); }
  };
  for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; tri(bot, pts[0][k1], pts[0][k]); tri(pts[2][k], pts[2][k1], top); }
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; tri(pts[i][k], pts[i][k1], pts[i + 1][k1]); tri(pts[i][k], pts[i + 1][k1], pts[i + 1][k]); }
}

// a fence run from p0 to p1 (world x, z), standing on the ground
function fence(vb, cb, ctx, f, ox, oz, seed) {
  const dx = f.p1[0] - f.p0[0], dz = f.p1[1] - f.p0[1], L = Math.hypot(dx, dz); if (L < 0.5) return;
  const ux = dx / L, uz = dz / L, yaw = Math.atan2(-uz, ux);
  const G = (s) => ctx.hf.at(f.p0[0] + ux * s, f.p0[1] + uz * s);
  const P = (s, y) => [f.p0[0] + ux * s - ox, y, f.p0[1] + uz * s - oz];
  const col = hex(FENCE_PAINT[Math.floor(seed * 2.99)]);
  if (f.type === 'hedge') {
    const n = Math.max(1, Math.round(L / 2));
    for (let k = 0; k < n; k++) {
      const s0 = (L * k) / n, s1 = (L * (k + 1)) / n, g = Math.min(G(s0), G(s1)), h = 0.9 + 0.25 * hash2(f.p0[0] + k, f.p0[1]);
      setP(vb, PART_FOLIAGE, hex(seed < 0.5 ? 0x34502e : 0x3e5a30), seed + k);
      box(vb, cb, P((s0 + s1) / 2, g + h / 2 - 0.1), (s1 - s0) / 2 + 0.02, h / 2 + 0.1, 0.35, yaw, SURFACE.branch);
    }
    return;
  }
  if (f.type === 'stone') {
    const n = Math.max(1, Math.round(L / 2.5));
    setP(vb, PART_PAINT, hex(0x8a8274), seed);
    for (let k = 0; k < n; k++) { const s0 = (L * k) / n, s1 = (L * (k + 1)) / n, g = Math.min(G(s0), G(s1)); box(vb, cb, P((s0 + s1) / 2, g + 0.2), (s1 - s0) / 2 + 0.01, 0.35, 0.22, yaw, SURFACE.wall_stone); }
    return;
  }
  const board = f.type === 'board', iron = f.type === 'iron';
  const H = board ? 1.6 : iron ? 0.85 : 0.95, postE = board ? 2.4 : 2.0;
  const pc = iron ? hex(0x1c1e1d) : board ? hex(0x7a6a58) : col;
  const np = Math.max(1, Math.round(L / postE));
  for (let k = 0; k <= np; k++) {
    const s = (L * k) / np, g = G(s);
    setP(vb, PART_PAINT, pc, seed);
    box(vb, cb, P(s, g + H / 2), iron ? 0.03 : 0.05, H / 2 + 0.08, iron ? 0.03 : 0.05, yaw, board ? SURFACE.wall_wood : SURFACE.fence);
  }
  // rails, and pickets / pales / boards between the posts, the panel in the collider as fence
  for (let k = 0; k < np; k++) {
    const s0 = (L * k) / np, s1 = (L * (k + 1)) / np, g0 = G(s0), g1 = G(s1), gm = Math.min(g0, g1);
    setP(vb, PART_PAINT, pc, seed);
    for (const y of board ? [0.3, H - 0.25] : iron ? [0.1, H - 0.05] : [0.25, H - 0.3]) box(vb, null, P((s0 + s1) / 2, gm + y), (s1 - s0) / 2, 0.03, 0.025, yaw, 0);
    if (board) {
      setP(vb, PART_PAINT, hex(0x8a7660), seed + 0.3);
      box(vb, null, P((s0 + s1) / 2, gm + H / 2 + 0.02), (s1 - s0) / 2, H / 2, 0.012, yaw, 0);
    } else {
      const step2 = iron ? 0.13 : 0.16;
      for (let s = s0 + step2 / 2; s < s1; s += step2) box(vb, null, P(s, gm + (H - 0.04) / 2 + (iron ? 0.04 : 0.02)), iron ? 0.009 : 0.03, (H - 0.04) / 2, iron ? 0.009 : 0.011, yaw, 0, iron ? 15 : 31);
    }
    // one collider panel per bay (what a creature climbs and walks along)
    cb.box((s0 + s1) / 2 * ux + f.p0[0] - ox, gm + H / 2 + 0.01, (s0 + s1) / 2 * uz + f.p0[1] - oz, (s1 - s0) / 2, H / 2 + 0.01, 0.03, yaw, board ? SURFACE.wall_wood : SURFACE.fence);
  }
}

// porch railings with balusters, and the brackets under an Italianate eave
function porchDetail(vb, cb, b, P, F, ox, oz) {
  const pp = porchPlan(b, P, F, P.style); if (!pp) return;
  const W = (u, t, y) => [F.a[0] + F.dx * u - F.nx * t - ox, y, F.a[1] + F.dz * u - F.nz * t - oz];
  let g = -Infinity; for (let k = 0; k <= 4; k++) { const p = F.P(pp.s0 + (pp.w * k) / 4, -pp.depth); g = Math.max(g, ctx_hf(P, p)); }
  const deck = Math.max(P.base + 0.35, g + 0.45);
  // the steps down from the deck to the walk
  {
    const n = Math.max(1, Math.round((deck - g) / 0.18)), sw = pp.kind === 'stoop' ? 1.5 : 1.4;
    const su = Math.max(pp.s0 + sw / 2, Math.min(pp.s0 + pp.w - sw / 2, pp.door));
    setP(vb, PART_PAINT, hex(0x9c968a), P.seed);
    for (let k = 0; k < n; k++) {
      const top = deck - ((k + 1) * (deck - g)) / (n + 1), tread = 0.3, t = -pp.depth - 0.15 - k * tread, c = W(su, t, 0), h = top - (g - 0.3);
      box(vb, cb, [c[0], g - 0.3 + h / 2, c[2]], sw / 2, h / 2, tread / 2 + 0.01, F.yaw, SURFACE.prop, 31);
    }
  }
  if (!pp.roofed) return;
  const trim = hex([0xf0ede4, 0xece6d4, 0x2e3c32, 0xe8e2d0][Math.floor(P.seed * 3.99)]);
  const rail = (ua, ta, ub, tb) => {
    const len = Math.hypot(ub - ua, tb - ta); if (len < 0.4) return;
    const mu = (ub - ua) / len, mt = (tb - ta) / len;
    const ax = F.dx * mu - F.nx * mt, az = F.dz * mu - F.nz * mt, yaw = Math.atan2(-az, ax);
    const c = W((ua + ub) / 2, (ta + tb) / 2, 0);
    setP(vb, PART_PAINT, trim, P.seed);
    box(vb, null, [c[0], deck + 0.86, c[2]], len / 2, 0.035, 0.045, yaw, 0);
    box(vb, null, [c[0], deck + 0.1, c[2]], len / 2, 0.03, 0.035, yaw, 0);
    for (let s = 0.07; s < len; s += 0.15) { const q = W(ua + mu * s, ta + mt * s, 0); box(vb, null, [q[0], deck + 0.48, q[2]], 0.022, 0.35, 0.022, yaw, 0, 15); }
    cb.box(c[0], deck + 0.46, c[2], len / 2, 0.45, 0.04, yaw, SURFACE.fence);
  };
  const t = -pp.depth + 0.12, u0 = pp.s0 + 0.12, u1 = pp.s0 + pp.w - 0.12;
  const su = pp.steps ? pp.steps.u : pp.door, hw = (pp.steps ? pp.steps.w : 1.4) / 2 + 0.05;
  if (pp.kind !== 'entry' || pp.w > 2.5) { rail(u0, t, su - hw, t); rail(su + hw, t, u1, t); }
  rail(u0, t, u0, -0.05); rail(u1, t, u1, -0.05);
  // brackets at the post tops
  const roofY = Math.min(P.base + Math.max(2.8, Math.min(3.3, P.gfh * 0.95)), P.base + b.height - 0.15);
  setP(vb, PART_PAINT, trim, P.seed);
  const posts = Math.max(2, Math.round(pp.w / 2.4) + 1);
  for (let k = 0; k < posts; k++) {
    const u = pp.s0 + 0.12 + ((pp.w - 0.24) * k) / (posts - 1);
    for (const s of [-1, 1]) { const q = W(u + s * 0.16, t, 0); box(vb, null, [q[0], roofY - 0.2, q[2]], 0.12, 0.12, 0.025, F.yaw, 0); }
  }
}
const ctx_hf = (P, p) => (P.hfAt ? P.hfAt(p[0], p[1]) : P.base);

// Builds the near detail of a house's lot into the facade cell's builders.
export function lotDetail(ctx, b, vb, cb, ox, oz) {
  const lot = b._lot; if (!lot) return 0;
  const P = buildingParams(ctx, b); if (!P.style) return 0;
  P.hfAt = (x, z) => ctx.hf.at(x, z);
  const F = frontFrame(b);
  porchDetail(vb, cb, b, P, F, ox, oz);
  // Italianate brackets in pairs under the eaves of the front
  if (P.style.brackets) {
    const eaves = P.base + b.height, W = (u, t, y) => [F.a[0] + F.dx * u - F.nx * t - ox, y, F.a[1] + F.dz * u - F.nz * t - oz];
    setP(vb, PART_PAINT, hex(0xe8e2d2), P.seed);
    for (let u = 0.5; u < F.L - 0.3; u += 1.3) for (const o of [-0.13, 0.13]) { const q = W(u + o, -0.2, 0); box(vb, cb, [q[0], eaves - 0.22, q[2]], 0.045, 0.2, 0.19, F.yaw, SURFACE.prop); }
  }
  let k = 0;
  for (const f of lot.fences) fence(vb, cb, ctx, f, ox, oz, hashStr(b.id + '#fc' + (k++)));
  for (const s of lot.shrubs) {
    const y = ctx.hf.at(s.x, s.z);
    setP(vb, s.kind === 'flowers' ? PART_FLOWERS : PART_FOLIAGE, hex(s.col), hash2(s.x, s.z));
    blob(vb, cb, s.x - ox, y - 0.02, s.z - oz, s.r, s.h, hash2(s.z, s.x), SURFACE.branch);
  }
  void FLAG; void polyArea; void PART;
  return 1;
}
