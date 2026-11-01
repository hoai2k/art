// Modelled street fronts. Near the focus each ordinary building's street-facing
// walls are rebuilt as geometry from its data (use, storeys, material, the
// front edge and its width): the wall with real openings; recessed windows
// with reveals, sashes, sills and hoods (round-arched, segmental or flat by type
// and era); shopfronts with recessed glass, a panelled base, slim columns, a
// recessed door, a sign band, a cornice and an awning; bracketed cornices and
// string courses on commercial blocks; house doors with surrounds and steps.
// Further out the same walls are drawn flat with painted windows (materials.js),
// and the two never show at once: both read one per-building flag.
//
// It runs as a detail layer ('facades'): cells around the focus, built in time
// slices, freed when left behind. Protrusions (sills, hoods, sign bands, cornices,
// awnings, steps) go into the cell's collider so creatures can perch on them.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { buildingParams, frontEdges, modelledFront, awnings, cornice, BUILDING_ATTRS, KIT } from './buildings.js';
import { Builder, ColliderBuilder, centroid, hash1, polyArea } from './util.js';

const WALL_SURF = [SURFACE.wall_brick, SURFACE.wall_brick, SURFACE.wall_stone, SURFACE.wall_wood, SURFACE.wall_smooth, SURFACE.wall_smooth, SURFACE.wall_smooth];
const REVEAL = 0.16;        // window reveal depth (m)
const SHOP_DEPTH = 0.3;     // display glass set back from the wall face
const DOOR_DEPTH = 1.0;     // shop door at the back of its lobby

export const FACADE_SHOW_RADIUS = 80;   // modelled fronts are shown within this distance of the focus
export const FACADE_BUILD_RADIUS = 110; // and built a little further out

// Builds the modelled fronts of building b into vb/cb (vertices relative to ox, oz).
// Returns how many walls were modelled.
export function buildFronts(ctx, b, vb, cb, ox, oz) {
  const P = buildingParams(ctx, b);
  const fronts = frontEdges(ctx, b, P);
  const cen = centroid(b.outer);
  vb.set('aBid', [b._idx || 0]).set('aCen', [cen[0], cen[1]]);
  const parapet = b.roof === 'flat' && (P.commercial || P.civic) ? 0.85 : b.roof === 'flat' ? 0.3 : 0;
  const base = P.base, top = base + b.height + parapet;
  const n = b.outer.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = b.outer[i], c = b.outer[(i + 1) % n];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (!modelledFront(ctx, P, b, fronts.has(i), L)) continue;
    front(ctx, b, P, i, a, c, L, top, parapet, vb, cb, ox, oz);
    count++;
  }
  return count;
}

function front(ctx, b, P, edge, a, c, L, top, parapet, vb, cb, ox, oz) {
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;     // along, outward
  const base = P.base, eaves = base + b.height, y0 = base - 0.8;
  const seed = P.seed + edge * 0.0137;
  // wall point: u along the wall, y, dep into the building (negative = in front)
  const W = (u, y, dep) => [a[0] + dx * u - nx * dep - ox, y, a[1] + dz * u - nz * dep - oz];
  const yaw = Math.atan2(-dz, dx);
  const store = !!(P.flags & FLAG.store), house = !!(P.flags & FLAG.house);
  const brick = P.mat === MAT.brick_red || P.mat === MAT.brick_buff;
  const wood = P.mat === MAT.clapboard;
  const storeys = P.storeys, gfh = Math.min(P.gfh, b.height);
  const upperH = storeys > 1 ? (b.height - gfh) / (storeys - 1) : b.height;
  const style = (P.flags & FLAG.arched) ? 1 : brick ? 2 : 0;     // round / segmental / flat heads
  const set = (part, f0 = [], flags = 0, mat = P.mat, s = seed) => vb.set('aF0', [part, f0[0] ?? L, f0[1] ?? b.height, f0[2] ?? storeys]).set('aF1', [mat, flags, s, gfh]).set('aFac', [2]);
  const trimPart = wood ? PART.trim : PART.stone;

  // ---- layout: openings in wall coordinates
  const openings = [];
  const signB = base + gfh - 0.95;
  const shopRow = store && gfh >= 3.2 && signB - base >= 2.3;
  if (shopRow) {
    const units = Math.max(1, Math.floor(L / 7 + 0.4)), uw = L / units;
    for (let k = 0; k < units; k++) {
      const u0 = k * uw + 0.38, u1 = (k + 1) * uw - 0.38;
      if (u1 - u0 < 2) continue;
      const h = hash1(Math.floor(seed * 1e6) + k * 7919);
      openings.push({ kind: 'shop', u0, u1, v0: base, v1: signB, k, uw, doorLeft: h < 0.5, h });
    }
  }
  const bay = house ? 3.1 : 2.7;
  const nb = L < 1.6 ? 0 : Math.max(1, Math.floor(L / bay + 0.35)), bw = L / Math.max(1, nb);
  const porchHere = house && b.front === edge && polyArea(b.outer) > 45 && P.seed < 0.7;
  for (let st = 0; st < storeys; st++) {
    if (st === 0 && shopRow) continue;
    const sb = st === 0 ? base : base + gfh + (st - 1) * upperH, sh = storeys < 2 ? b.height : st === 0 ? gfh : upperH;
    for (let k = 0; k < nb; k++) {
      const uc = (k + 0.5) * bw;
      if (house && st === 0 && k === Math.floor(nb / 2)) {
        // the front door: raised a step, with a transom
        const v0 = base + 0.32, v1 = Math.min(v0 + 2.55, sb + sh - 0.2);
        if (v1 - v0 > 2) openings.push({ kind: 'door', u0: uc - 0.52, u1: uc + 0.52, v0, v1, steps: !porchHere });
        continue;
      }
      const ww = Math.min(bw * 0.48, house ? 1.0 : 0.95);
      const wh = Math.min(sh * (house ? 0.55 : 0.58), 2.3);
      const v0 = sb + (st === 0 ? Math.max(0.85, sh * 0.3) : sh * 0.25), v1 = v0 + wh;
      if (ww < 0.45 || wh < 0.7 || v1 > eaves - 0.2) continue;
      openings.push({ kind: 'window', u0: uc - ww / 2, u1: uc + ww / 2, v0, v1, style });
    }
  }

  // ---- the wall around the openings, in horizontal bands
  set(PART.wall, [], P.flags | FLAG.front | FLAG.noWindows);
  const ys = [...new Set([y0, top, ...openings.flatMap((o) => [o.v0, o.v1])])].filter((y) => y >= y0 && y <= top).sort((p, q) => p - q);
  for (let k = 0; k + 1 < ys.length; k++) {
    const ya = ys[k], yb = ys[k + 1]; if (yb - ya < 1e-4) continue;
    const cut = openings.filter((o) => o.v0 <= ya + 1e-4 && o.v1 >= yb - 1e-4).map((o) => [o.u0, o.u1]).sort((p, q) => p[0] - q[0]);
    let u = 0;
    for (const [u0, u1] of [...cut, [L, L]]) {
      if (u0 > u + 1e-4) face(vb, W(u, ya, 0), W(u0, ya, 0), W(u0, yb, 0), W(u, yb, 0), [nx, 0, nz], [[u, ya - base], [u0, ya - base], [u0, yb - base], [u, yb - base]]);
      u = Math.max(u, u1);
    }
  }

  // ---- windows
  for (const o of openings.filter((p) => p.kind === 'window')) {
    const ww = o.u1 - o.u0, wh = o.v1 - o.v0, uc = (o.u0 + o.u1) / 2;
    reveal(vb, W, o, REVEAL, P, set, [nx, nz], [dx, dz], base);
    set(PART.window, [ww, wh, o.style]);
    face(vb, W(o.u0, o.v0, REVEAL), W(o.u1, o.v0, REVEAL), W(o.u1, o.v1, REVEAL), W(o.u0, o.v1, REVEAL), [nx, 0, nz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    // sill
    set(trimPart, [ww + 0.16, 0.08, 1]);
    const sill = W(uc, o.v0 - 0.045, -0.05);
    KIT.box(vb, null, sill[0], sill[1], sill[2], ww / 2 + 0.08, 0.045, 0.065, yaw, 0);
    cb.box(sill[0], sill[1], sill[2], ww / 2 + 0.08, 0.045, 0.065, yaw, SURFACE.prop);
    // head: an arch with a keystone, a segmental arch, or a flat lintel
    set(trimPart, [ww + 0.3, 0.2, 1]);
    if (o.style === 1) {
      const r0 = ww / 2 + 0.01, sy = o.v1 - ww / 2;
      archRing(vb, W, uc, sy, r0, r0 + 0.15, 0, Math.PI, 10, [nx, nz], [dx, dz]);
      const k = W(uc, o.v1 + 0.07, -0.06); KIT.box(vb, null, k[0], k[1], k[2], 0.09, 0.12, 0.07, yaw, 0);
      const hb = W(uc, sy + r0 * 0.5 + 0.1, -0.03); cb.box(hb[0], hb[1], hb[2], r0 + 0.15, r0 * 0.5 + 0.12, 0.04, yaw, SURFACE.wall_stone);
    } else if (o.style === 2) {
      const rise = 0.14, R = ((ww / 2) ** 2 + rise ** 2) / (2 * rise), cy = o.v1 - R + rise * 0.15, a0 = Math.asin(Math.min(1, (ww / 2 + 0.05) / R));
      archRing(vb, W, uc, cy, R, R + 0.17, Math.PI / 2 - a0, Math.PI / 2 + a0, 6, [nx, nz], [dx, dz]);
      const k = W(uc, cy + R + 0.08, -0.06); KIT.box(vb, null, k[0], k[1], k[2], 0.08, 0.1, 0.07, yaw, 0);
      const hb = W(uc, o.v1 + 0.1, -0.03); cb.box(hb[0], hb[1], hb[2], ww / 2 + 0.12, 0.12, 0.04, yaw, SURFACE.wall_stone);
    } else {
      const l = W(uc, o.v1 + 0.1, -0.035);
      KIT.box(vb, null, l[0], l[1], l[2], ww / 2 + 0.12, 0.1, 0.05, yaw, 0);
      cb.box(l[0], l[1], l[2], ww / 2 + 0.12, 0.1, 0.05, yaw, WALL_SURF[P.mat]);
    }
  }

  // ---- shopfronts
  for (const o of openings.filter((p) => p.kind === 'shop')) {
    const doorW = 1.1;
    const du0 = o.doorLeft ? o.u0 + 0.25 : o.u1 - 0.25 - doorW, du1 = du0 + doorW;
    const kick = 0.55, transomB = o.v1 - 0.5;
    // reveals of the opening (piers' sides) and its soffit
    set(PART.plain);
    face(vb, W(o.u0, o.v0, 0), W(o.u0, o.v0, SHOP_DEPTH), W(o.u0, o.v1, SHOP_DEPTH), W(o.u0, o.v1, 0), [dx, 0, dz], [[0, 0], [SHOP_DEPTH, 0], [SHOP_DEPTH, o.v1 - o.v0], [0, o.v1 - o.v0]]);
    face(vb, W(o.u1, o.v0, SHOP_DEPTH), W(o.u1, o.v0, 0), W(o.u1, o.v1, 0), W(o.u1, o.v1, SHOP_DEPTH), [-dx, 0, -dz], [[0, 0], [SHOP_DEPTH, 0], [SHOP_DEPTH, o.v1 - o.v0], [0, o.v1 - o.v0]]);
    set(PART.trim, [o.u1 - o.u0, 0.3, 1], 0, P.mat, seed + o.h);
    face(vb, W(o.u0, o.v1, 0), W(o.u1, o.v1, 0), W(o.u1, o.v1, SHOP_DEPTH), W(o.u0, o.v1, SHOP_DEPTH), [0, -1, 0], [[0, 0], [o.u1 - o.u0, 0], [o.u1 - o.u0, 0.3], [0, 0.3]]);
    // glass, panelled base and transom either side of the door bay
    const spans = [[o.u0, du0], [du1, o.u1]].filter(([p, q]) => q - p > 0.2);
    for (const [p, q] of spans) {
      set(PART.kick, [q - p, kick, 1], 0, P.mat, seed + o.h);
      const kb = W((p + q) / 2, o.v0 + kick / 2, (0.12 + SHOP_DEPTH) / 2);
      KIT.box(vb, null, kb[0], kb[1], kb[2], (q - p) / 2, kick / 2, (SHOP_DEPTH - 0.12) / 2, yaw, 0);
      set(PART.shopglass, [q - p, transomB - (o.v0 + kick), 1], 0, P.mat, seed + o.h);
      face(vb, W(p, o.v0 + kick, SHOP_DEPTH), W(q, o.v0 + kick, SHOP_DEPTH), W(q, transomB, SHOP_DEPTH), W(p, transomB, SHOP_DEPTH), [nx, 0, nz], [[0, 0], [q - p, 0], [q - p, transomB - o.v0 - kick], [0, transomB - o.v0 - kick]]);
      face(vb, W(p, transomB + 0.06, SHOP_DEPTH), W(q, transomB + 0.06, SHOP_DEPTH), W(q, o.v1, SHOP_DEPTH), W(p, o.v1, SHOP_DEPTH), [nx, 0, nz], [[0, 1.6], [q - p, 1.6], [q - p, 2.0], [0, 2.0]]);
      // slim cast-iron columns and the transom bar
      set(PART.dark, [0.1, 3, 1]);
      const nCol = Math.max(1, Math.round((q - p) / 1.6));
      for (let m = 0; m <= nCol; m++) {
        const u = p + ((q - p) * m) / nCol, cp = W(u, (o.v0 + kick + o.v1) / 2, SHOP_DEPTH - 0.06);
        KIT.box(vb, null, cp[0], cp[1], cp[2], 0.05, (o.v1 - o.v0 - kick) / 2, 0.05, yaw, 0);
      }
      const tb = W((p + q) / 2, transomB + 0.03, SHOP_DEPTH - 0.04);
      KIT.box(vb, null, tb[0], tb[1], tb[2], (q - p) / 2, 0.03, 0.05, yaw, 0);
    }
    // the recessed door at the back of a small glazed lobby
    set(PART.shopglass, [DOOR_DEPTH, 2.3, 1], 0, P.mat, seed + o.h);
    face(vb, W(du0, o.v0, SHOP_DEPTH), W(du0, o.v0, DOOR_DEPTH), W(du0, o.v0 + 2.4, DOOR_DEPTH), W(du0, o.v0 + 2.4, SHOP_DEPTH), [dx, 0, dz], [[0, 0], [0.7, 0], [0.7, 2.4], [0, 2.4]]);
    face(vb, W(du1, o.v0, DOOR_DEPTH), W(du1, o.v0, SHOP_DEPTH), W(du1, o.v0 + 2.4, SHOP_DEPTH), W(du1, o.v0 + 2.4, DOOR_DEPTH), [-dx, 0, -dz], [[0, 0], [0.7, 0], [0.7, 2.4], [0, 2.4]]);
    set(PART.trim, [doorW, 1, 1], 0, P.mat, seed + o.h);
    face(vb, W(du0, o.v0 + 2.4, 0), W(du1, o.v0 + 2.4, 0), W(du1, o.v0 + 2.4, DOOR_DEPTH), W(du0, o.v0 + 2.4, DOOR_DEPTH), [0, -1, 0], [[0, 0], [doorW, 0], [doorW, 1], [0, 1]]);
    face(vb, W(du0, o.v0 + 2.4, 0), W(du1, o.v0 + 2.4, 0), W(du1, o.v1, 0.0001), W(du0, o.v1, 0.0001), [nx, 0, nz], [[0, 0], [doorW, 0], [doorW, 0.3], [0, 0.3]]);
    set(PART.stone);
    face(vb, W(du0, o.v0 + 0.01, 0), W(du1, o.v0 + 0.01, 0), W(du1, o.v0 + 0.01, DOOR_DEPTH), W(du0, o.v0 + 0.01, DOOR_DEPTH), [0, 1, 0], [[0, 0], [doorW, 0], [doorW, 1], [0, 1]]);
    set(PART.door, [doorW, 2.3, 1], 0, P.mat, seed + o.h);
    face(vb, W(du0, o.v0, DOOR_DEPTH), W(du1, o.v0, DOOR_DEPTH), W(du1, o.v0 + 2.3, DOOR_DEPTH), W(du0, o.v0 + 2.3, DOOR_DEPTH), [nx, 0, nz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    set(PART.shopglass, [doorW, 0.1, 1], 0, P.mat, seed + o.h);
    face(vb, W(du0, o.v0 + 2.3, DOOR_DEPTH), W(du1, o.v0 + 2.3, DOOR_DEPTH), W(du1, o.v0 + 2.4, DOOR_DEPTH), W(du0, o.v0 + 2.4, DOOR_DEPTH), [nx, 0, nz], [[0, 2.2], [doorW, 2.2], [doorW, 2.3], [0, 2.3]]);
    // sign band and the storefront cornice over the whole unit, with brackets at the piers
    const s0 = o.u0 - 0.3, s1 = o.u1 + 0.3, sh = Math.min(0.7, base + gfh - 0.25 - o.v1);
    set(PART.signband, [s1 - s0, sh, 0], 0, P.mat, seed + o.h);
    const sbm = W((s0 + s1) / 2, o.v1 + sh / 2, -0.05);
    KIT.box(vb, null, sbm[0], sbm[1], sbm[2], (s1 - s0) / 2, sh / 2, 0.05, yaw, 0);
    cb.box(sbm[0], sbm[1], sbm[2], (s1 - s0) / 2, sh / 2, 0.05, yaw, SURFACE.prop);
    set(PART.trim, [s1 - s0, 0.25, 1], 0, P.mat, seed + o.h);
    const cm = W((s0 + s1) / 2, o.v1 + sh + 0.12, -0.11);
    KIT.box(vb, null, cm[0], cm[1], cm[2], (s1 - s0) / 2 + 0.1, 0.12, 0.12, yaw, 0);
    cb.box(cm[0], cm[1], cm[2], (s1 - s0) / 2 + 0.1, 0.12, 0.12, yaw, SURFACE.prop);
    for (const u of [o.u0 - 0.19, o.u1 + 0.19]) { const br = W(u, o.v1 + sh * 0.5, -0.09); KIT.box(vb, null, br[0], br[1], br[2], 0.09, sh * 0.5, 0.09, yaw, 0); }
  }
  if (shopRow) awnings(vb, cb, a, c, L, nx, nz, base, P, ox, oz, edge, 2);

  // ---- house doors: surround, a little cornice, steps
  for (const o of openings.filter((p) => p.kind === 'door')) {
    const w = o.u1 - o.u0, uc = (o.u0 + o.u1) / 2;
    reveal(vb, W, o, 0.22, P, set, [nx, nz], [dx, dz], base);
    set(PART.door, [w, o.v1 - o.v0, 0], 0, P.mat, seed);
    face(vb, W(o.u0, o.v0, 0.22), W(o.u1, o.v0, 0.22), W(o.u1, o.v1, 0.22), W(o.u0, o.v1, 0.22), [nx, 0, nz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    set(PART.trim, [w + 0.4, 0.2, 1], 0, P.mat, seed + 0.37);
    for (const u of [o.u0 - 0.06, o.u1 + 0.06]) { const sp = W(u, (o.v0 + o.v1) / 2, -0.03); KIT.box(vb, null, sp[0], sp[1], sp[2], 0.07, (o.v1 - o.v0) / 2, 0.04, yaw, 0); }
    const hd = W(uc, o.v1 + 0.1, -0.07); KIT.box(vb, null, hd[0], hd[1], hd[2], w / 2 + 0.2, 0.1, 0.09, yaw, 0);
    cb.box(hd[0], hd[1], hd[2], w / 2 + 0.2, 0.1, 0.09, yaw, SURFACE.prop);
    if (o.steps) {
      set(PART.stone);
      for (let k = 0; k < 2; k++) {
        const hgt = (o.v0 - base) * (2 - k) / 2, sp = W(uc, base + hgt / 2 - 0.2, -0.18 - k * 0.3);
        KIT.box(vb, null, sp[0], sp[1], sp[2], 0.75, hgt / 2 + 0.2, 0.16, yaw, 0);
        cb.box(sp[0], sp[1], sp[2], 0.75, hgt / 2 + 0.2, 0.16, yaw, SURFACE.prop);
      }
    }
  }

  // ---- string courses between storeys on commercial and civic brick, and the bracketed cornice
  if (!house && brick && storeys > 1) {
    set(PART.stone, [L, 0.12, 1]);
    for (let st = shopRow ? 2 : 1; st < storeys; st++) {
      const y = base + gfh + (st - 1) * upperH;
      const m = W(L / 2, y + 0.06, -0.03);
      KIT.box(vb, null, m[0], m[1], m[2], L / 2, 0.06, 0.04, yaw, 0);
    }
  }
  if (parapet > 0.5) {
    cornice(vb, cb, a, c, L, nx, nz, top, P, ox, oz, 2);
    set(PART.trim, [0.1, 0.42, 1]);
    const yb = top - 0.6 - 0.21;
    for (let u = 0.45; u < L - 0.3; u += 0.9) { const br = W(u, yb, -0.17); KIT.box(vb, null, br[0], br[1], br[2], 0.055, 0.21, 0.17, yaw, 0); }
    set(PART.trim, [L, 0.32, 1]);
    const fr = W(L / 2, yb - 0.37, -0.025); KIT.box(vb, null, fr[0], fr[1], fr[2], L / 2, 0.16, 0.03, yaw, 0);
  }
}

// a quad facing `want` (reversed if needed); uv per corner
function face(vb, p0, p1, p2, p3, want, uv) {
  const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const flip = nx * want[0] + ny * want[1] + nz * want[2] < 0;
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  if (flip) { nx = -nx; ny = -ny; nz = -nz; }
  const ids = [p0, p1, p2, p3].map((p, k) => vb.v(p[0], p[1], p[2], nx, ny, nz, uv[k][0], uv[k][1]));
  if (flip) vb.quad(ids[1], ids[0], ids[3], ids[2]); else vb.quad(ids[0], ids[1], ids[2], ids[3]);
}

// the four sides of an opening, from the wall face back to depth `dep`
function reveal(vb, W, o, dep, P, set, n, d, base) {
  set(PART.plain);
  const h = o.v1 - o.v0, w = o.u1 - o.u0;
  face(vb, W(o.u0, o.v0, 0), W(o.u0, o.v0, dep), W(o.u0, o.v1, dep), W(o.u0, o.v1, 0), [d[0], 0, d[1]], [[0, 0], [dep, 0], [dep, h], [0, h]]);
  face(vb, W(o.u1, o.v0, dep), W(o.u1, o.v0, 0), W(o.u1, o.v1, 0), W(o.u1, o.v1, dep), [-d[0], 0, -d[1]], [[0, 0], [dep, 0], [dep, h], [0, h]]);
  face(vb, W(o.u0, o.v1, 0), W(o.u1, o.v1, 0), W(o.u1, o.v1, dep), W(o.u0, o.v1, dep), [0, -1, 0], [[0, 0], [w, 0], [w, dep], [0, dep]]);
  face(vb, W(o.u0, o.v0, dep), W(o.u1, o.v0, dep), W(o.u1, o.v0, 0), W(o.u0, o.v0, 0), [0, 1, 0], [[0, 0], [w, 0], [w, dep], [0, dep]]);
  void P; void n; void base;
}

// an arch of voussoirs proud of the wall: radii r0..r1 about (uc, cy), angles a0..a1
function archRing(vb, W, uc, cy, r0, r1, a0, a1, seg, n, d) {
  const out = -0.05;
  const P = (r, t, dep) => W(uc + Math.cos(t) * r, cy + Math.sin(t) * r, dep);
  for (let k = 0; k < seg; k++) {
    const t0 = a0 + ((a1 - a0) * k) / seg, t1 = a0 + ((a1 - a0) * (k + 1)) / seg;
    face(vb, P(r0, t0, out), P(r1, t0, out), P(r1, t1, out), P(r0, t1, out), [n[0], 0, n[1]], [[0, 0], [0.15, 0], [0.15, 0.2], [0, 0.2]]);
    const tm = (t0 + t1) / 2, ox = Math.cos(tm) * d[0], oz = Math.cos(tm) * d[1], oy = Math.sin(tm);
    face(vb, P(r1, t0, 0), P(r1, t1, 0), P(r1, t1, out), P(r1, t0, out), [ox, oy, oz], [[0, 0], [0.2, 0], [0.2, 0.05], [0, 0.05]]);
    face(vb, P(r0, t1, 0), P(r0, t0, 0), P(r0, t0, out), P(r0, t1, out), [-ox, -oy, -oz], [[0, 0], [0.2, 0], [0.2, 0.05], [0, 0.05]]);
  }
}

// ---------------------------------------------------------------- the detail layer
// env: { buildingsIn(x0, z0, size) -> buildings with their centre in the cell,
//        setFlag(index, on), material, ctx }
export function facadeLayer(env) {
  return {
    id: 'facades', minScale: 0, maxScale: 5, radius: FACADE_BUILD_RADIUS, cellSize: 40,
    build(chunkKey, cell) {
      const vb = new Builder(BUILDING_ATTRS), cb = new ColliderBuilder();
      const done = [];
      for (const b of env.buildingsIn(cell.x0, cell.z0, cell.size)) {
        try { if (buildFronts(env.ctx, b, vb, cb, cell.ox, cell.oz)) done.push(b._idx); } catch (e) { console.warn('[town] facade', b.id, e); }
      }
      if (!vb.n) return null;
      const mesh = new THREE.Mesh(vb.geometry(), env.material);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'facades';
      const res = { object: mesh, onDrop: () => { for (const i of done) env.setFlag(i, false); } };
      for (const i of done) env.setFlag(i, true);
      if (cb.triangles) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(cb.pos, 3));
        g.setAttribute('surface', new THREE.BufferAttribute(new Uint8Array(cb.surf), 1));
        g.boundsTree = new MeshBVH(g);
        res.colliders = [new THREE.Mesh(g)];
      }
      return res;
    },
  };
}
