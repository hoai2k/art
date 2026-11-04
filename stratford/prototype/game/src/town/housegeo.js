// House parts on the base building mesh (seen near and far): the cross gable of
// an Ontario Gothic cottage or a Queen Anne front, dormers, bay windows and the
// porch or verandah with its roof, posts, deck and steps. The type and its parts
// come from houseStyle() (houses.js); the fine parts that only show close up
// (railings, balusters, brackets, gardens, fences) are built near the focus by
// lots.js. Everything solid goes into the collider: decks and steps walkable
// (prop), posts climbable (wall_wood), roofs (roof).
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { roofHeightAt, KIT, board } from './buildings.js';

const WALL_SURF = [SURFACE.wall_brick, SURFACE.wall_brick, SURFACE.wall_stone, SURFACE.wall_wood, SURFACE.wall_smooth, SURFACE.wall_smooth, SURFACE.wall_smooth];

// The front edge's frame: W(u, t, y) is the point u metres along the front, t metres
// into the house (negative: in front of it), at height y; chunk-relative.
export function frontFrame(b, ox = 0, oz = 0, edge = b.front) {
  const n = b.outer.length, a = b.outer[edge], c = b.outer[(edge + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;
  return { a, c, L, dx, dz, nx, nz, yaw: Math.atan2(-dz, dx),
    P: (u, t) => [a[0] + dx * u - nx * t, a[1] + dz * u - nz * t],
    W: (u, t, y) => [a[0] + dx * u - nx * t - ox, y, a[1] + dz * u - nz * t - oz] };
}

// a flat polygon (3 or 4 points) facing `want`, uv per point, into vb (and cb with surf)
function poly(vb, cb, pts, want, uvs, surf) {
  const [p0, p1, p2] = pts;
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const flip = nx * want[0] + ny * want[1] + nz * want[2] < 0;
  if (flip) { nx = -nx; ny = -ny; nz = -nz; }
  const ids = pts.map((p, k) => vb.v(p[0], p[1], p[2], nx, ny, nz, uvs[k][0], uvs[k][1]));
  const tri = (i, j, k) => { if (flip) { vb.tri(ids[i], ids[k], ids[j]); if (cb) cb.tri(pts[i], pts[k], pts[j], surf); } else { vb.tri(ids[i], ids[j], ids[k]); if (cb) cb.tri(pts[i], pts[j], pts[k], surf); } };
  tri(0, 1, 2); if (pts.length === 4) tri(0, 2, 3);
}
// uv of a sloped plane: metres along its two edges
const uvOf = (pts) => { const o = pts[0]; return pts.map((p) => [Math.hypot(p[0] - o[0], p[2] - o[2]), p[1] - o[1]]); };

// where along the inward depth t the roof surface above u reaches height y (bisection), or null
function depthAt(R, F, u, y, tMax) {
  let lo = 0, hi = tMax;
  const h = (t) => { const p = F.P(u, t); return roofHeightAt(R, p[0], p[1]); };
  if (h(lo) > y || h(hi) < y) return null;
  for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (h(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// sets the building material's attributes for a part
const setPart = (vb, P, part, f0 = [0, 0, 1], flags = 0, mat = P.mat, seed = P.seed) => vb.set('aF0', [part, f0[0], f0[1], f0[2]]).set('aF1', [mat, flags, seed, P.gfh]).set('aFac', [0]);

// A window unit (painted sash) as a quad just proud of a wall: centre u, sill y0, w x h.
function windowQuad(vb, F, u, t, y0, w, h, style, P) {
  setPart(vb, P, PART.window, [w, h, style]);
  poly(vb, null, [F.W(u - w / 2, t, y0), F.W(u + w / 2, t, y0), F.W(u + w / 2, t, y0 + h), F.W(u - w / 2, t, y0 + h)], [F.nx, 0, F.nz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

// ---- the cross gable: a gable in the front wall's plane rising into the main roof
function crossGable(vb, cb, F, R, P, eaves, at, wFrac, gothic) {
  const L = F.L, w = Math.max(2.6, Math.min(L * 0.55, wFrac * L)), uc = Math.max(w / 2 + 0.3, Math.min(L - w / 2 - 0.3, at * L));
  const u0 = uc - w / 2, u1 = uc + w / 2;
  const rise = R.yR - eaves;
  if (rise < 1.4) return null;
  const yA = eaves + Math.min(rise * 0.94, (w / 2) * (gothic ? 1.6 : 1.2));
  const tA = depthAt(R, F, uc, yA, R.hs * 2.2); if (tA == null) return null;
  const wallSurf = WALL_SURF[P.mat];
  // the gable wall
  setPart(vb, P, PART.wall, [L, eaves - P.base, P.storeys], P.flags | FLAG.front | FLAG.noWindows);
  poly(vb, cb, [F.W(u0, 0, eaves), F.W(u1, 0, eaves), F.W(uc, 0, yA)], [F.nx, 0, F.nz], [[u0, eaves - P.base], [u1, eaves - P.base], [uc, yA - P.base]], wallSurf);
  // its two roof planes, from the overhanging rakes back to the valleys on the main roof
  setPart(vb, P, PART.roof, [w, 0, 1]);
  const ov = 0.35, lift = 0.12;
  for (const [ue, ui] of [[u0 - 0.28, u0], [u1 + 0.28, u1]]) {
    const pts = [F.W(ue, -ov, eaves - 0.18), F.W(uc, -ov, yA + lift), F.W(uc, tA, yA + lift), F.W(ui, 0.02, eaves + 0.02)];
    poly(vb, cb, pts, [0, 1, 0], uvOf(pts), SURFACE.roof);
  }
  // bargeboards along the rakes, a finial
  setPart(vb, P, PART.trim, [2, 0.22, 1], 0, P.mat, P.seed + 0.37);
  board(vb, F.W(u0 - 0.28, -ov - 0.03, eaves - 0.2), F.W(uc, -ov - 0.03, yA + lift), [F.nx, 0, F.nz], 0.24, 0.05);
  board(vb, F.W(u1 + 0.28, -ov - 0.03, eaves - 0.2), F.W(uc, -ov - 0.03, yA + lift), [F.nx, 0, F.nz], 0.24, 0.05);
  if (gothic) { const f = F.W(uc, -ov - 0.03, yA + 0.45); KIT.box(vb, null, f[0], f[1], f[2], 0.04, 0.4, 0.04, F.yaw, 0); }
  // a window in the gable (pointed in a Gothic cottage)
  const gh = yA - eaves;
  if (gh > 1.7) {
    const wh = Math.min(1.5, gh * 0.48), ww = Math.min(0.85, w * 0.28);
    windowQuad(vb, F, uc, -0.03, eaves + gh * 0.12, ww, wh, gothic ? 3 : 0, P);
  }
  return { u0, u1, uc, yA };
}

// ---- a gabled dormer on the front slope of the roof
function dormer(vb, cb, F, R, P, eaves, at) {
  const L = F.L, w = Math.min(2.0, Math.max(1.4, L * 0.16)), uc = Math.max(w, Math.min(L - w, at * L));
  const t0 = 0.75, yb = (() => { const p = F.P(uc, t0); return roofHeightAt(R, p[0], p[1]); })();
  const room = R.yR - 0.3 - yb - w * 0.42;
  const fh = Math.min(1.45, room);
  if (fh < 0.95) return;
  const ye = yb + fh, ya = ye + w * 0.42;
  const tE = depthAt(R, F, uc - w / 2, ye, R.hs * 2.2), tA = depthAt(R, F, uc, ya, R.hs * 2.2);
  if (tE == null || tA == null || tE <= t0) return;
  const u0 = uc - w / 2, u1 = uc + w / 2, wallSurf = WALL_SURF[P.mat === MAT.stucco ? MAT.stucco : MAT.clapboard];
  // dormers are clad in siding (painted), whatever the house below
  setPart(vb, P, PART.wall, [w, 0, 1], FLAG.house | FLAG.noWindows, MAT.clapboard);
  poly(vb, cb, [F.W(u0, t0, yb - 0.05), F.W(u1, t0, yb - 0.05), F.W(u1, t0, ye), F.W(u0, t0, ye)], [F.nx, 0, F.nz], [[0, 0], [w, 0], [w, fh], [0, fh]], wallSurf);
  poly(vb, cb, [F.W(u0, t0, ye), F.W(u1, t0, ye), F.W(uc, t0, ya)], [F.nx, 0, F.nz], [[0, fh], [w, fh], [w / 2, fh + ya - ye]], wallSurf);
  for (const [u, s] of [[u0, -1], [u1, 1]]) poly(vb, cb, [F.W(u, t0, yb - 0.05), F.W(u, t0, ye), F.W(u, tE, ye)], [F.dx * s, 0, F.dz * s], [[0, 0], [0, fh], [tE - t0, fh]], wallSurf);
  setPart(vb, P, PART.roof, [w, 0, 1]);
  for (const [ue, s] of [[u0 - 0.15, -1], [u1 + 0.15, 1]]) { void s; const pts = [F.W(ue, t0 - 0.2, ye - 0.08), F.W(uc, t0 - 0.2, ya + 0.06), F.W(uc, tA, ya + 0.06), F.W(ue, tE, ye - 0.08)]; poly(vb, cb, pts, [0, 1, 0], uvOf(pts), SURFACE.roof); }
  windowQuad(vb, F, uc, t0 - 0.03, yb + 0.15, w * 0.52, fh * 0.72, 0, P);
}

// ---- a three-sided bay window on the front wall
export function bayPlan(F, at) {
  const L = F.L, fw = 1.3, pj = 0.72, half = fw / 2 + pj, uc = Math.max(half + 0.2, Math.min(L - half - 0.2, at * L));
  if (L < 2 * half + 0.6) return null;
  return { uc, fw, pj, half, u0: uc - half, u1: uc + half };
}
function bayWindow(vb, cb, F, P, base, eaves, at, storeys, style) {
  const B = bayPlan(F, at); if (!B) return null;
  const { uc, fw, pj, half } = B;
  const y0 = base - 0.3, top = storeys > 1 ? eaves - 0.2 : Math.min(eaves - 0.2, base + P.gfh - 0.05);
  const pts = [[uc - half, 0], [uc - fw / 2, -pj], [uc + fw / 2, -pj], [uc + half, 0]];
  const wallSurf = WALL_SURF[P.mat];
  for (let k = 0; k < 3; k++) {
    const [ua, ta] = pts[k], [ub, tb] = pts[k + 1];
    const len = Math.hypot(ub - ua, tb - ta);
    // the face's outward normal in the world
    const mu = (ub - ua) / len, mt = (tb - ta) / len;      // along the face in (u, t)
    const A = F.W(ua, ta, 0), B = F.W(ub, tb, 0), cx = (A[0] + B[0]) / 2, cz = (A[2] + B[2]) / 2, mid = F.W((ua + ub) / 2, (ta + tb) / 2 + 1, 0);
    const want = [cx - mid[0], 0, cz - mid[2]];
    setPart(vb, P, PART.wall, [len, top - base, 1], P.flags | FLAG.front | FLAG.noWindows);
    poly(vb, cb, [F.W(ua, ta, y0), F.W(ub, tb, y0), F.W(ub, tb, top), F.W(ua, ta, top)], want, [[0, y0 - base], [len, y0 - base], [len, top - base], [0, top - base]], wallSurf);
    // a window per storey in each face, just proud of it
    const wl = Math.hypot(want[0], want[2]) || 1, ox2 = (want[0] / wl) * 0.02, oz2 = (want[2] / wl) * 0.02;
    for (let s = 0; s < storeys; s++) {
      const sb = base + (s === 0 ? 0 : P.gfh), sh = s === 0 ? Math.min(P.gfh, top - base) : top - base - P.gfh;
      const ww = Math.min(len - 0.3, k === 1 ? 1.0 : 0.62), wh = Math.min(sh * 0.62, 2.0), wy = sb + Math.max(0.75, sh * 0.26);
      if (wh < 0.8 || ww < 0.4) continue;
      setPart(vb, P, PART.window, [ww, wh, style]);
      const c0 = (ua + ub) / 2, t0 = (ta + tb) / 2, h = ww / 2;
      const p = (s2, y) => { const q = F.W(c0 + mu * s2, t0 + mt * s2, y); return [q[0] + ox2, y, q[2] + oz2]; };
      poly(vb, null, [p(-h, wy), p(h, wy), p(h, wy + wh), p(-h, wy + wh)], want, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  // its roof: three sloped facets back to the wall
  setPart(vb, P, PART.roof, [2, 0, 1]);
  const o = 0.12, rt = top + 0.55;
  const E = [[uc - half - o * 0.4, 0], [uc - fw / 2 - o * 0.4, -pj - o], [uc + fw / 2 + o * 0.4, -pj - o], [uc + half + o * 0.4, 0]];
  const facets = [[F.W(E[0][0], E[0][1], top), F.W(E[1][0], E[1][1], top), F.W(uc - fw / 2, 0.01, rt)],
    [F.W(E[1][0], E[1][1], top), F.W(E[2][0], E[2][1], top), F.W(uc + fw / 2, 0.01, rt), F.W(uc - fw / 2, 0.01, rt)],
    [F.W(E[2][0], E[2][1], top), F.W(E[3][0], E[3][1], top), F.W(uc + fw / 2, 0.01, rt)]];
  for (const f of facets) poly(vb, cb, f, [0, 1, 0], uvOf(f), SURFACE.roof);
  return { u0: uc - half, u1: uc + half, top };
}

// ---- the porch: deck, roof, posts and steps (railings near the focus, lots.js)
// kind: 'stoop' (steps and a landing), 'entry' (a small roofed porch at the door),
// 'full' (a verandah across the front), 'wrap' (and round the corner)
export function porchPlan(b, P, F, st) {
  const L = F.L, kind = st.porch;
  if (!kind) return null;
  const bay = st.bay ? bayPlan(F, st.bay.at) : null;
  let door = Math.max(0.9, Math.min(L - 0.9, st.doorAt * L));
  if (bay && door > bay.u0 - 0.7 && door < bay.u1 + 0.7) door = bay.uc < L / 2 ? Math.min(L - 0.9, bay.u1 + 0.8) : Math.max(0.9, bay.u0 - 0.8);
  let s0, w, depth;
  if (kind === 'stoop') { w = 1.8; depth = 1.2; s0 = door - w / 2; }
  else if (kind === 'entry') { w = Math.min(L - 0.6, 3.0); depth = 1.9; s0 = door - w / 2; }
  else { w = L - 0.5; depth = 2.3; s0 = 0.25; }
  // a porch never runs into the bay window: it stops short of it, on the door's side
  if (bay) {
    if (door < bay.uc) { const e = Math.min(s0 + w, bay.u0 - 0.1); s0 = Math.min(s0, e - 1.6); w = e - s0; }
    else { const e0 = Math.max(s0, bay.u1 + 0.1); w = s0 + w - e0; s0 = e0; if (w < 1.6) { w = 1.6; } }
  }
  s0 = Math.max(0.15, Math.min(L - w - 0.15, s0));
  return { kind, s0, w, depth, door, roofed: kind !== 'stoop' };
}
export function porch(vb, cb, b, P, F, base, st, bay) {
  const pl = porchPlan(b, P, F, st); if (!pl) return null;
  const { s0, w, depth, door, roofed, kind } = pl;
  // the deck stands a couple of steps above the ground at the front (on a slope, the higher side)
  let g = -Infinity; for (let k = 0; k <= 4; k++) { const p = F.P(s0 + (w * k) / 4, -depth); g = Math.max(g, P.hfAt ? P.hfAt(p[0], p[1]) : base); }
  const deck = Math.max(base + 0.35, g + 0.45);
  const roofY = Math.min(base + Math.max(2.8, Math.min(3.3, P.gfh * 0.95)), P.eavesY - 0.15);
  const mid = F.W(s0 + w / 2, -depth / 2, 0);
  // deck (a box down into the ground), and a skirt
  setPart(vb, P, PART.porch, [w, 0, 1]);
  const yb = Math.min(base, g) - 0.4;
  KIT.box(vb, cb, mid[0], (deck + yb) / 2, mid[2], w / 2, (deck - yb) / 2, depth / 2, F.yaw, SURFACE.prop);
  const parts = { ...pl, deck, roofY, ground: g };
  // steps down from the deck in front of the door (built near the focus: lots.js porchSteps)
  const nSteps = Math.max(1, Math.round((deck - g) / 0.18));
  const sw = kind === 'stoop' ? 1.5 : 1.4, su = Math.max(s0 + sw / 2, Math.min(s0 + w - sw / 2, door));
  parts.steps = { u: su, w: sw, n: nSteps, t0: -depth };
  if (!roofed) return parts;
  // posts at the front edge (and at the house wall's ends), turned-post proportions
  const posts = Math.max(2, Math.round(w / 2.4) + 1);
  parts.posts = [];
  for (let k = 0; k < posts; k++) {
    const u = s0 + 0.12 + ((w - 0.24) * k) / (posts - 1);
    if (Math.abs(u - su) < sw / 2 + 0.05 && posts > 2 && k > 0 && k < posts - 1) continue;
    parts.posts.push(u);
    const q = F.W(u, -depth + 0.12, 0);
    setPart(vb, P, PART.porch, [0.2, 0, 1]);
    KIT.box(vb, cb, q[0], (deck + roofY) / 2, q[2], 0.07, (roofY - deck) / 2, 0.07, F.yaw, SURFACE.wall_wood, 15);
  }
  // the roof: a shallow shed from the wall out over the posts, with a fascia
  setPart(vb, P, PART.roof, [w, 0, 1]);
  const yIn = roofY + 0.5, ov = 0.3;
  const rp = [F.W(s0 - ov, -depth - ov, roofY + 0.1), F.W(s0 + w + ov, -depth - ov, roofY + 0.1), F.W(s0 + w + ov, 0.02, yIn), F.W(s0 - ov, 0.02, yIn)];
  // (a bay window under the porch roof would poke through it: the roof steps round it)
  void bay;
  poly(vb, cb, rp, [0, 1, 0], uvOf(rp), SURFACE.roof);
  setPart(vb, P, PART.trim, [w, 0.22, 1], 0, P.mat, P.seed + 0.37);
  const fc = F.W(s0 + w / 2, -depth - ov + 0.03, roofY);
  KIT.box(vb, cb, fc[0], fc[1], fc[2], w / 2 + ov, 0.12, 0.04, F.yaw, SURFACE.prop, 15);
  // the soffit under it (painted trim), so the porch ceiling reads from the street
  setPart(vb, P, PART.trim, [w, 0, 1], 0, P.mat, P.seed + 0.37);
  const sp = [F.W(s0 - ov, -depth - ov, roofY - 0.02), F.W(s0 + w + ov, -depth - ov, roofY - 0.02), F.W(s0 + w + ov, 0.02, roofY + 0.3), F.W(s0 - ov, 0.02, roofY + 0.3)];
  poly(vb, null, sp, [0, -1, 0], uvOf(sp));
  return parts;
}

// All the house parts of one building (called by addBuilding for houses with a style).
export function houseParts(ctx, b, P, R, vb, cb, ox, oz, base, eaves) {
  const st = P.style; if (!st || b.front < 0) return;
  const F = frontFrame(b, ox, oz);
  if (F.L < 4.5) return;
  P.eavesY = eaves;
  P.hfAt = (x, z) => ctx.hf.at(x, z);
  // R's ridge must run along the front for a cross gable or dormers on the front slope
  const along = R ? Math.abs(R.ux * F.dx + R.uz * F.dz) : 0;
  if (R && st.crossGable && along > 0.9) crossGable(vb, cb, F, R, P, eaves, st.crossGable.at, st.crossGable.w, st.type === 'gothic');
  if (R && st.dormers.length && (along > 0.9 || R.ridge < R.hl - 0.01)) for (const at of st.dormers) dormer(vb, cb, F, R, P, eaves, at);
  let bay = null;
  if (st.bay) bay = bayWindow(vb, cb, F, P, base, eaves, st.bay.at, Math.min(st.bay.storeys, Math.max(1, P.storeys)), (P.flags & FLAG.arched) ? 2 : 0);
  porch(vb, cb, b, P, F, base, st, bay);
}
