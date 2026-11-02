// Hand-made parts for the landmarks, added to their footprints by
// buildings.js. Each entry: { roof?(b, rh) -> {roof, rh}, replacesRoof?,
// noSteeple?, build({ ctx, b, P, vb, cb, ox, oz, base, eaves, rh, fronts, kit }) }.
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { centroid, obb, polyArea } from './util.js';
import { insetRing } from './buildings.js';

// the Avon's George Street side: the longest edge next to the front
function sideEdge(b) {
  const n = b.outer.length, k = b.front >= 0 ? b.front : 0;
  const len = (i) => { const a = b.outer[i], c = b.outer[(i + 1) % n]; return Math.hypot(c[0] - a[0], c[1] - a[1]); };
  const l = (k + n - 1) % n, r = (k + 1) % n;
  return len(l) >= len(r) ? l : r;
}

// a band course round a footprint at height y (proud of the walls)
function belt(vb, cb, P, ring, y, h, ox, oz, kit) {
  kit.setPart(vb, P, PART.trim);
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], c = ring[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.3) continue;
    const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;
    kit.box(vb, null, (a[0] + c[0]) / 2 + nx * 0.03 - ox, y + h / 2, (a[1] + c[1]) / 2 + nz * 0.03 - oz, L / 2 + 0.03, h / 2, 0.05, Math.atan2(-dz, dx), 0);
  }
  void cb;
}

// A rusticated stone plinth: the footprint stepped out a little, from below
// the ground to h above the base.
function plinth(vb, cb, P, b, base, h, ox, oz, kit) {
  const ring = insetRing(b.outer, -0.12), n = ring.length;
  kit.setPart(vb, P, PART.stone);
  for (let i = 0; i < n; i++) {
    const a = ring[i], c = ring[(i + 1) % n];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
    const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
    const ids = [[a, base - 0.8, 0], [c, base - 0.8, L], [c, base + h, L], [a, base + h, 0]].map(([p, y, u]) => vb.v(p[0] - ox, y, p[1] - oz, nx, 0, nz, u, y - base));
    vb.quad(ids[1], ids[0], ids[3], ids[2]);
    cb.quad([c[0] - ox, base - 0.8, c[1] - oz], [a[0] - ox, base - 0.8, a[1] - oz], [a[0] - ox, base + h, a[1] - oz], [c[0] - ox, base + h, c[1] - oz], SURFACE.wall_stone);
    // a sloped stone cap
    const A2 = b.outer[i], C2 = b.outer[(i + 1) % n];
    const ids2 = [[a, base + h], [c, base + h], [C2, base + h + 0.12], [A2, base + h + 0.12]].map(([p, y]) => vb.v(p[0] - ox, y, p[1] - oz, nx * 0.5, 0.86, nz * 0.5, p[0], p[1]));
    vb.quadFacing(ids2[0], ids2[1], ids2[2], ids2[3], [nx * 0.5, 0.86, nz * 0.5]);
  }
}

// A gable over the eaves (white-trimmed when the palette says so): a
// triangle of wall facing out along (nx, nz), with a little roof behind it.
function gable(vb, cb, P, x, y, z, dx, dz, nx, nz, w, h, kit) {
  const hw = w / 2, V = (s, up, out) => [x + dx * s + nx * out, y + up, z + dz * s + nz * out];
  kit.setPart(vb, P, PART.wall, P.mat, 0, w, 0.1, 1);
  const tri = (a, b, c, n) => { const ids = [a, b, c].map((p) => vb.v(p[0], p[1], p[2], n[0], n[1], n[2], (p[0] - x) * dx + (p[2] - z) * dz + hw, p[1] - y + 50)); vb.triFacing(ids[0], ids[1], ids[2], n); cb.tri(a, b, c, SURFACE.wall_brick); };
  tri(V(-hw, 0, 0.3), V(hw, 0, 0.3), V(0, h, 0.3), [nx, 0, nz]);
  kit.setPart(vb, P, PART.roof);
  const ridgeBack = V(0, h, -3.5), ridgeFront = V(0, h, 0.4);
  for (const sg of [-1, 1]) {
    const e0 = V(sg * (hw + 0.3), -0.2, 0.4), e1 = V(sg * (hw + 0.3), -0.2, -3.5);
    const n = [0, 1, 0];
    const ids = [e0, e1, ridgeBack, ridgeFront].map((p) => vb.v(p[0], p[1], p[2], n[0], n[1], n[2], p[0], p[2]));
    vb.quadFacing(ids[0], ids[1], ids[2], ids[3], [0, 1, 0]);
    cb.quad(e0, e1, ridgeBack, ridgeFront, SURFACE.roof);
  }
  // white bargeboards along the rakes
  kit.setPart(vb, P, PART.trim);
  for (const sg of [-1, 1]) {
    const a = V(sg * (hw + 0.3), -0.2, 0.45), c = V(0, h + 0.15, 0.45);
    const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, mz = (a[2] + c[2]) / 2;
    const ang = Math.atan2(c[1] - a[1], Math.hypot(c[0] - a[0], c[2] - a[2]));
    // a thin slab along the rake, built as a box rotated in its own frame
    const ux = (c[0] - a[0]) / len, uy = (c[1] - a[1]) / len, uz = (c[2] - a[2]) / len;
    const sx = nx * 0.12, sz = nz * 0.12, tx = -uy * ux * 0.15, ty = Math.cos(ang) * 0.15, tz = -uy * uz * 0.15;
    const P0 = (sa, sb, sc) => [mx + ux * len / 2 * sa + sx * sb + tx * sc, my + uy * len / 2 * sa + ty * sc, mz + uz * len / 2 * sa + sz * sb + tz * sc];
    const C = [P0(-1, -1, -1), P0(1, -1, -1), P0(1, -1, 1), P0(-1, -1, 1), P0(-1, 1, -1), P0(1, 1, -1), P0(1, 1, 1), P0(-1, 1, 1)];
    for (const [i, j, k, l] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [1, 5, 6, 2]]) {
      const ids = [C[i], C[j], C[k], C[l]].map((p) => vb.v(p[0], p[1], p[2], nx, 0.3, nz, p[0], p[1]));
      const cx2 = (C[i][0] + C[k][0]) / 2 - mx, cy2 = (C[i][1] + C[k][1]) / 2 - my, cz2 = (C[i][2] + C[k][2]) / 2 - mz;
      vb.quadFacing(ids[0], ids[1], ids[2], ids[3], [cx2, cy2, cz2]);
    }
  }
}

// interior angle at each vertex (radians), for picking a site's apex
function sharpest(ring) {
  let best = 0, bestA = 10;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[(i + ring.length - 1) % ring.length], q = ring[i], r = ring[(i + 1) % ring.length];
    const a1 = Math.atan2(p[1] - q[1], p[0] - q[0]), a2 = Math.atan2(r[1] - q[1], r[0] - q[0]);
    let a = Math.abs(a1 - a2); if (a > Math.PI) a = 2 * Math.PI - a;
    if (a < bestA) { bestA = a; best = i; }
  }
  return best;
}
function edgeMid(b, k) { const n = b.outer.length, a = b.outer[k], c = b.outer[(k + 1) % n]; return { x: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2, dx: (c[0] - a[0]), dz: (c[1] - a[1]) }; }

// the tower position: the middle of the front edge (stepped out a little), or a front corner
function frontTower(b, w, where = 'centre', edge = null) {
  const n = b.outer.length, k = edge ?? (b.front >= 0 ? b.front : 0);
  const a = b.outer[k], c = b.outer[(k + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = dz, nz = -dx;    // along the front, outward
  const s = where === 'centre' ? L / 2 : where === 'left' ? w * 0.55 : L - w * 0.55;
  const out = where === 'centre' ? w * 0.35 : w * 0.15;
  return { x: a[0] + dx * s + nx * out, z: a[1] + dz * s + nz * out, yaw: Math.atan2(-dz, dx), dx, dz, nx, nz, L };
}

export const landmarkParts = {
  // Stratford City Hall (1898-1900, George W. King), checked against the
  // reference photos: deep red brick, white trim, grey slate roofs, and the
  // clock tower in the middle of the symmetric front, its steep dark slate
  // spire, blue clock faces and white corner spirelets.
  'city-hall': {
    // notes: eaves about 14 m, ridge about 19 m above the plinth; the data's 17.6 m is the ridge
    override: { height: 14, roofHeight: 5, roof: 'hipped' },
    params: () => ({ seed: 0.241, mat: MAT.brick_red }),            // slate roofs, white trim
    build({ ctx, b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      // the front faces Market Square
      const sq = ctx.data.landmarks.find((l) => l.id === 'market-square');
      let edge = null;
      if (sq) {
        let best = -Infinity; const n = b.outer.length, c0 = centroid(b.outer);
        let tx = sq.x - c0[0], tz = sq.z - c0[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        for (let i = 0; i < n; i++) {
          const a = b.outer[i], c = b.outer[(i + 1) % n], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
          const score = ((c[1] - a[1]) / L * tx - (c[0] - a[0]) / L * tz) * Math.sqrt(L);
          if (score > best) { best = score; edge = i; }
        }
      }
      plinth(vb, cb, P, b, base, 3.3, ox, oz, kit);                   // rock-faced grey limestone basement: a full storey (photos)
      const w = 5.0, t = frontTower(b, w, 'centre', edge);
      const top = eaves + 3.2;                                        // spire tip about 35 m
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, top, t.yaw, { belfry: 4.6, clock: true, clockBlue: true, pyramid: 12.5, roofPart: PART.roof, band: PART.trim, pinnacles: 2.6, pinnaclePart: PART.trim, mat: MAT.brick_red });
      // lantern and flagpole on the spire
      const yTop = top + 0.3 + 4.6 + 0.4 + 12.5;
      kit.setPart(vb, P, PART.trim);
      kit.frustum(vb, cb, t.x - ox, yTop - 3.2, t.z - oz, 0.75, yTop - 1.6, 0.75, 6, 0, SURFACE.roof, true);
      kit.setPart(vb, P, PART.dark);
      kit.frustum(vb, null, t.x - ox, yTop - 1.6, t.z - oz, 0.06, yTop + 4.5, 0.03, 4, 0, SURFACE.prop);
      // the entrance: a stone arch bay under the tower, with steps
      kit.setPart(vb, P, PART.stone);
      kit.box(vb, cb, t.x + t.nx * (w * 0.5 + 0.6) - ox, base + 0.35, t.z + t.nz * (w * 0.5 + 0.6) - oz, w * 0.45, 0.35, 1.3, t.yaw, SURFACE.wall_stone);
      // white spirelets at the corners of the roof and the two front gables
      const o = obb(b.outer);
      if (o) {
        // the two ends: full-height rounded bays of red brick (three storeys over the stone
        // basement) under conical slate roofs with finials (photos), not turrets at the corners
        for (const su of [-1, 1]) {
          const r = Math.min(6.5, o.hv * 0.92), off = o.hu - r * 0.55;
          const px = o.cx + o.ux * off * su, pz = o.cz + o.uz * off * su;
          kit.setPart(vb, P, PART.stone);
          kit.frustum(vb, cb, px - ox, base - 0.8, pz - oz, r + 0.12, base + 3.3, r + 0.12, 16, 0, SURFACE.wall_stone);
          kit.setPart(vb, P, PART.wall, MAT.brick_red, FLAG.front | FLAG.arched, 2 * Math.PI * r / 16, eaves - base - 3.3, 3);
          kit.frustum(vb, cb, px - ox, base + 3.3, pz - oz, r, eaves + 0.3, r, 16, 0, SURFACE.wall_brick);
          kit.setPart(vb, P, PART.trim);
          kit.frustum(vb, cb, px - ox, eaves + 0.3, pz - oz, r + 0.3, eaves + 0.75, r + 0.3, 16, 0, SURFACE.roof);
          kit.setPart(vb, P, PART.roof);
          kit.frustum(vb, cb, px - ox, eaves + 0.75, pz - oz, r + 0.35, eaves + 0.75 + r * 1.35, 0.05, 16, 0, SURFACE.roof);
          kit.setPart(vb, P, PART.trim);
          kit.frustum(vb, null, px - ox, eaves + 0.65 + r * 1.35, pz - oz, 0.25, eaves + 1.1 + r * 1.35, 0.25, 6, 0, SURFACE.roof, true);
          kit.setPart(vb, P, PART.dark);
          kit.frustum(vb, null, px - ox, eaves + 1.1 + r * 1.35, pz - oz, 0.05, eaves + 2.6 + r * 1.35, 0.02, 4, 0, SURFACE.prop);
        }
        // front gables either side of the tower: white-edged triangles over the eaves
        for (const sgn of [-1, 1]) {
          const gx = t.x + t.dx * sgn * (t.L * 0.27) - t.nx * w * 0.35, gz = t.z + t.dz * sgn * (t.L * 0.27) - t.nz * w * 0.35;
          gable(vb, cb, P, gx - ox, eaves, gz - oz, t.dx, t.dz, t.nx, t.nz, 6.5, 4.2, kit);
        }
      }
    },
  },
  // Perth County Courthouse (1887, George F. Durand), checked against the
  // photos: buff brick with red-brown arches and bands, and a slender tower
  // at the front corner with a tall, steep spire.
  courthouse: {
    // notes: cream-yellow (buff) brick with red sandstone trim, not brick_red; tower about 35 m (115 ft)
    params: () => ({ mat: MAT.brick_buff, seed: 0.108 }),
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      plinth(vb, cb, P, b, base, 2.0, ox, oz, kit);
      // strong dark red-brown sandstone bands on the buff brick (photos): each floor line and under the eaves
      const band = { ...P, seed: 0.07 };                              // oxblood trim
      const w = 4.8, t = frontTower(b, w, 'left'), m = frontTower(b, 7, 'centre');
      // round the main block, the entrance bay and the tower: a deep course at each
      // floor line, a narrower one at the window heads, and a deep one under the eaves
      const rect = (q, hx, hz) => [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sa, sn]) => [q.x + q.dx * hx * sa + q.nx * hz * sn, q.z + q.dz * hx * sa + q.nz * hz * sn]);
      const rings = [b.outer, rect(m, 3.5, 1.2), rect(t, w / 2, w / 2)];
      const fl = (eaves - base - 2.0) / 3;
      for (let k = 0; k < 3; k++) {
        const y = base + 2.0 + k * fl;
        for (const r of rings) { belt(vb, cb, band, r, y - 0.05, 0.5, ox, oz, kit); belt(vb, cb, band, r, y + fl * 0.72, 0.28, ox, oz, kit); }
      }
      for (const r of rings.slice(0, 2)) belt(vb, cb, band, r, eaves - 0.6, 0.6, ox, oz, kit);
      for (const y of [eaves + 0.6, eaves + 3.2]) belt(vb, cb, band, rings[2], y, 0.45, ox, oz, kit);
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, base + 20.5, t.yaw, { belfry: 3.6, clock: true, pyramid: 10.5, roofPart: PART.roof, pinnacles: 1.6, mat: MAT.brick_buff });
      // a projecting entrance bay with its gable in the middle of the front
      kit.setPart(vb, P, PART.wall, MAT.brick_buff, FLAG.front | FLAG.arched, 7, eaves - base, 3);
      kit.box(vb, cb, m.x - ox, (base + eaves) / 2, m.z - oz, 3.5, (eaves - base) / 2, 1.2, m.yaw, SURFACE.wall_brick);
      gable(vb, cb, P, m.x - ox, eaves, m.z - oz, m.dx, m.dz, m.nx, m.nz, 7.4, 4.5, kit);
    },
  },
  // Knox Presbyterian Church: dark red brick, a big gabled front with a
  // great window, green copper trim, a square tower with a low cap (photo).
  'knox-church': {
    // notes + photo: dark red-brown brick (not stone), green copper caps, no spire since 1913
    noSteeple: true,
    params: () => ({ mat: MAT.brick_red, seed: 0.5195 }),
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      const w = 6, t = frontTower(b, w, 'right');
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, eaves + rh + 2, t.yaw, { belfry: 3.4, pyramid: 2.2, roofPart: PART.copper, mat: MAT.brick_red });
    },
  },
  // St. James' Anglican Church: grey stone Gothic, a square tower crowned
  // with four tall pinnacles and no spire (photos).
  'st-james-church': {
    // notes: buff brick, a 14 x 14 ft (4.3 m) bell tower with four broach spires, about 25 m to their tips
    noSteeple: true,
    params: () => ({ mat: MAT.brick_buff }),
    build({ b, P, vb, cb, ox, oz, base, kit }) {
      const w = 4.3, t = frontTower(b, w, 'right');
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, base + 16.5, t.yaw, { belfry: 4.4, pinnacles: 3.6, mat: MAT.brick_buff });
    },
  },
  // Railway station (1913, Grand Trunk): notes: a two-storey main block (about
  // 9-10 m to the eaves) under broad, low hipped roofs, on a purple-grey granite base.
  'railway-station': {
    override: { height: 9.2, roofHeight: 2.6, roof: 'hipped' },
    params: () => ({ mat: MAT.brick_red }),
    build({ b, P, vb, cb, ox, oz, base, kit }) { plinth(vb, cb, P, b, base, 1.1, ox, oz, kit); },
  },
  // Festival Theatre (1957): the round drum under the crown-like folded roof
  // that recalls the Festival's first tent.
  'festival-theatre': {
    replacesRoof: true,
    roof: () => ({ roof: 'flat', rh: 0 }),
    build({ b, P, vb, cb, ox, oz, base, eaves, kit }) {
      const c = centroid(b.outer);
      const area = polyArea(b.outer);
      // notes: the drum is about 61 m (200 ft) across, of 34 bays; the footprint includes later additions
      const r = Math.min(30.5, Math.max(14, Math.sqrt(area / Math.PI) * 0.78));
      const cx = c[0] - ox, cz = c[1] - oz;
      const n = 32;
      // drum: plain buff wall with a band of clerestory glass
      kit.setPart(vb, P, PART.wall, MAT.stucco, FLAG.noWindows, 2 * Math.PI * r, 200, 1);
      const y0 = eaves - 0.5, y1 = eaves + 4.5;
      kit.frustum(vb, cb, cx, y0, cz, r, y1, r, n, 0, SURFACE.wall_smooth);
      kit.setPart(vb, P, PART.glass);
      kit.frustum(vb, null, cx, y1, cz, r * 0.995, y1 + 1.2, r * 0.995, n, 0, SURFACE.wall_smooth);
      // the crown: a pleated cone whose rim rises into points
      const yc = y1 + 1.2, apex = yc + 9.5, pts = 34;
      kit.setPart(vb, P, PART.plain, MAT.stucco);                     // light grey folded-plate concrete
      const P3 = (a, rr, y) => [cx + Math.cos(a) * rr, y, cz - Math.sin(a) * rr];
      const tri = (p, q, s) => {
        const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = s[0] - p[0], vy = s[1] - p[1], vz = s[2] - p[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        // face out of the crown (up, or away from its axis)
        const ax = (p[0] + q[0] + s[0]) / 3 - cx, az = (p[2] + q[2] + s[2]) / 3 - cz;
        const want = ny > 0.2 || ny < -0.2 ? [nx * Math.sign(ny), Math.abs(ny), nz * Math.sign(ny)] : [ax, 0, az];
        const sg = nx * want[0] + ny * want[1] + nz * want[2] >= 0 ? 1 : -1;
        const ids = [p, q, s].map((v, k) => vb.v(v[0], v[1], v[2], nx * sg, ny * sg, nz * sg, k * 2, v[1] - yc));
        vb.triFacing(ids[0], ids[1], ids[2], want);
        cb.tri(p, q, s, SURFACE.roof);
      };
      for (let i = 0; i < pts; i++) {
        const a0 = (i / pts) * Math.PI * 2, am = ((i + 0.5) / pts) * Math.PI * 2, a1 = ((i + 1) / pts) * Math.PI * 2;
        const v0 = P3(a0, r * 1.06, yc), pk = P3(am, r * 1.16, yc + 4.6), v1 = P3(a1, r * 1.06, yc);
        const ap = [cx, apex, cz];
        const mid = P3(am, r * 0.55, yc + 6.0);
        tri(v0, pk, mid); tri(pk, v1, mid); tri(v0, mid, ap); tri(mid, v1, ap);
        // the fascia under each point
        tri(P3(a0, r, yc), P3(am, r * 1.16, yc + 4.6), P3(a0, r * 1.06, yc));
        tri(P3(am, r * 1.16, yc + 4.6), P3(a1, r, yc), P3(a1, r * 1.06, yc));
        tri(P3(a0, r, yc), P3(a1, r, yc), P3(am, r * 1.16, yc + 4.6));
      }
      // lantern and flagpole
      kit.setPart(vb, P, PART.trim);
      kit.frustum(vb, cb, cx, apex - 0.5, cz, 1.4, apex + 1.8, 1.4, 8, 0, SURFACE.roof, true);
      kit.setPart(vb, P, PART.copper);
      kit.frustum(vb, cb, cx, apex + 1.8, cz, 1.7, apex + 3.4, 0.1, 8, 0, SURFACE.roof);
      // the coronet: a ring of upright prongs round the mast, and the flagpole
      kit.setPart(vb, P, PART.dark);
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; kit.box(vb, null, cx + Math.cos(a) * 0.9, apex + 3.9, cz - Math.sin(a) * 0.9, 0.06, 0.6, 0.06, a, SURFACE.prop); }
      kit.frustum(vb, null, cx, apex + 3.3, cz, 0.07, apex + 9, 0.04, 4, 0, SURFACE.prop);
    },
  },
  // Tom Patterson Theatre (2022, Hariri Pontarini): glass at the ground and a
  // long, low, deeply overhanging roof slab facing the river.
  'tom-patterson-theatre': {
    replacesRoof: true,
    roof: () => ({ roof: 'flat', rh: 0 }),
    build({ b, P, vb, cb, ox, oz, eaves, kit }) {
      // notes + photos: a pale brick drum (the theatre) behind a ribbon of glass and bronze
      const c0 = centroid(b.outer), rd = Math.min(18, Math.sqrt(polyArea(b.outer) / Math.PI) * 0.5);
      kit.setPart(vb, P, PART.wall, MAT.brick_buff, FLAG.noWindows, 2 * Math.PI * rd, 200, 1);
      kit.frustum(vb, cb, c0[0] - ox, eaves - 2, c0[1] - oz, rd, eaves + 5.5, rd, 24, 0, SURFACE.wall_brick);
      kit.setPart(vb, P, PART.flat);
      kit.frustum(vb, null, c0[0] - ox, eaves + 5.5, c0[1] - oz, rd, eaves + 5.55, rd * 0.98, 24, 0, SURFACE.roof, true);
      const ring = insetRing(b.outer, -2.6);
      const y0 = eaves + 0.2, y1 = eaves + 1.4;
      kit.setPart(vb, { ...P, seed: 0.108 }, PART.trim);       // bronze-brown
      slab(vb, cb, ring, y0, y1, ox, oz);
      // a clerestory of glass between the walls and the slab
      kit.setPart(vb, P, PART.glass, MAT.glass, 0, 10, 200, 1);
      const band = insetRing(b.outer, 0.0);
      for (let i = 0; i < band.length; i++) {
        const a = band[i], c = band[(i + 1) % band.length];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.5) continue;
        const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
        const ids = [[a, eaves - 2.6], [c, eaves - 2.6], [c, y0], [a, y0]].map(([p, y], k) => vb.v(p[0] - ox + nx * 0.05, y, p[1] - oz + nz * 0.05, nx, 0, nz, k === 1 || k === 2 ? L : 0, y - eaves + 20));
        vb.quad(ids[1], ids[0], ids[3], ids[2]);
      }
    },
  },
  // Avon Theatre (1901): a marquee over the Downie Street doors.
  'avon-theatre': {
    // from the street-photo survey: the Downie Street front is cream stone-slab cladding with
    // deep-set windows, roofline brackets and a green glass-and-metal canopy with stairs and rails
    // each side; the George Street side is red brick with glass-block windows; a tall plain stage
    // house with fire escapes and a black fly tower rises behind
    params: () => ({ mat: MAT.stone, seed: 0.241 }),
    wallMat: (b, i) => (i === sideEdge(b) ? MAT.brick_red : null),
    build({ ctx, b, P, vb, cb, ox, oz, base, eaves, kit }) {
      const k = b.front >= 0 ? b.front : 0;
      const m = edgeMid(b, k), L = Math.hypot(m.dx, m.dz) || 1;
      const dx = m.dx / L, dz = m.dz / L, nx = dz, nz = -dx, yaw = Math.atan2(-dz, dx);
      const at = (u, out) => [m.x + dx * u + nx * out - ox, m.z + dz * u + nz * out - oz];
      // the canopy: green-tinted glass on a dark steel frame over the entrance
      const cw = Math.min(L * 0.7, 14), cd = 3.2, cy = base + 3.9;
      kit.setPart(vb, { ...P, seed: 0.05 }, PART.copper);
      let p = at(0, cd / 2); kit.box(vb, cb, p[0], cy, p[1], cw / 2, 0.08, cd / 2, yaw, SURFACE.prop);
      kit.setPart(vb, P, PART.dark);
      p = at(0, cd); kit.box(vb, null, p[0], cy - 0.12, p[1], cw / 2 + 0.05, 0.12, 0.06, yaw, SURFACE.prop);
      for (const u of [-cw / 2 + 0.2, cw / 2 - 0.2]) { p = at(u, cd - 0.1); kit.box(vb, cb, p[0], (base + cy) / 2, p[1], 0.06, (cy - base) / 2, 0.06, yaw, SURFACE.fence); }
      // a landing under the canopy and flights of stairs up to it from each side, with rails
      const land = base + 1.1;
      kit.setPart(vb, P, PART.stone);
      p = at(0, 1.4); kit.box(vb, cb, p[0], (base + land) / 2 - 0.2, p[1], cw / 2 - 2.2, (land - base) / 2 + 0.2, 1.4, yaw, SURFACE.sidewalk);
      for (const sg of [-1, 1]) for (let st = 0; st < 6; st++) {
        const top = base + land * ((st + 1) / 6) - base * ((st + 1) / 6) + 0, h = (land - base) * ((st + 1) / 6);
        p = at(sg * (cw / 2 - 2.2 + 0.3 * (6 - st) - 0.15), 1.4);
        kit.box(vb, cb, p[0], base + h / 2 - 0.1, p[1], 0.15, h / 2 + 0.1, 1.2, yaw, SURFACE.sidewalk);
        void top;
      }
      kit.setPart(vb, P, PART.dark);
      for (const sg of [-1, 1]) for (const o of [0.25, 2.55]) {
        const a0 = at(sg * (cw / 2 - 0.4), o), a1 = at(sg * (cw / 2 - 2.2), o);
        const mx = (a0[0] + a1[0]) / 2, mz = (a0[1] + a1[1]) / 2;
        kit.box(vb, null, mx, base + (land - base) / 2 + 0.95, mz, 0.9, 0.03, 0.03, yaw, SURFACE.fence);
      }
      // a row of small roofline brackets
      kit.setPart(vb, P, PART.trim);
      for (let u = -L / 2 + 0.4; u < L / 2 - 0.3; u += 0.8) { p = at(u, 0.12); kit.box(vb, cb, p[0], eaves - 0.25, p[1], 0.05, 0.18, 0.12, yaw, SURFACE.prop); }
      // the George Street side: a band of glass-block windows on the red brick
      const se = sideEdge(b), n = b.outer.length;
      if (se >= 0) {
        const A = b.outer[se], C = b.outer[(se + 1) % n], Ls = Math.hypot(C[0] - A[0], C[1] - A[1]);
        const sx = (C[0] - A[0]) / Ls, sz = (C[1] - A[1]) / Ls, snx = sz, snz = -sx;
        kit.setPart(vb, P, PART.glass, MAT.glass, 0, Ls * 0.6, 200, 1);
        kit.box(vb, null, (A[0] + C[0]) / 2 + snx * 0.03 - ox, base + 4.2, (A[1] + C[1]) / 2 + snz * 0.03 - oz, Ls * 0.3, 0.7, 0.04, Math.atan2(-sz, sx), SURFACE.wall_smooth);
      }
      // the stage house: over the back of the footprint, plain grey-beige render, fire escapes, a black fly tower
      const o = obb(b.outer); if (!o) return;
      let ax = o.ux, az = o.uz, ha = o.hu, hb = o.hv;
      if (Math.abs(ax * nx + az * nz) < 0.7071) { ax = -o.uz; az = o.ux; ha = o.hv; hb = o.hu; }
      const back = (ax * nx + az * nz) > 0 ? -1 : 1;              // away from the front
      const sdx = o.cx + ax * back * ha * 0.55, sdz = o.cz + az * back * ha * 0.55;
      const sh = eaves + 8, sw = ha * 0.42, sl = hb * 0.85, syaw = Math.atan2(-az, ax);
      kit.setPart(vb, { ...P, seed: 0.62 }, PART.wall, MAT.stucco, FLAG.noWindows, 2 * sl, sh - base, 1);
      kit.box(vb, cb, sdx - ox, (base + sh) / 2 - 0.4, sdz - oz, sw, (sh - base) / 2 + 0.4, sl, syaw, SURFACE.wall_smooth);
      kit.setPart(vb, P, PART.flat);
      kit.box(vb, cb, sdx - ox, sh + 0.05, sdz - oz, sw, 0.05, sl, syaw, SURFACE.roof);
      kit.setPart(vb, P, PART.dark);
      kit.box(vb, cb, sdx - ox, sh + 3, sdz - oz, sw * 0.8, 3, sl * 0.55, syaw, SURFACE.wall_smooth);
      // fire escapes: landings and stair flights on both long sides
      for (const sg of [-1, 1]) {
        const fx = sdx + (-az) * sg * (sl + 0.45), fz = sdz + ax * sg * (sl + 0.45);
        for (let y = base + 4; y < sh - 1; y += 3.2) {
          kit.box(vb, cb, fx - ox, y, fz - oz, sw * 0.5, 0.04, 0.45, syaw, SURFACE.fence);
          kit.box(vb, null, fx - ox, y + 1.0, fz - oz + 0, sw * 0.5, 0.02, 0.02, syaw, SURFACE.fence);
          kit.box(vb, null, fx - ox, y + 1.6, fz - oz, 0.04, 1.6, 0.35, syaw + 0.5, SURFACE.fence);
        }
      }
    },
  },
  // Stratford Normal School (1908): a cupola on the hipped roof.
  'normal-school': {
    build({ b, P, vb, cb, ox, oz, eaves, rh, kit }) {
      const c = centroid(b.outer);
      kit.setPart(vb, P, PART.trim);
      kit.frustum(vb, cb, c[0] - ox, eaves + rh - 0.5, c[1] - oz, 1.8, eaves + rh + 2.6, 1.8, 8, 0, SURFACE.roof);
      kit.setPart(vb, P, PART.copper);
      kit.frustum(vb, cb, c[0] - ox, eaves + rh + 2.6, c[1] - oz, 2.2, eaves + rh + 5.4, 0.1, 8, 0, SURFACE.roof);
    },
  },
};

// A thick slab from a ring: top, bottom, edge.
function slab(vb, cb, ring, y0, y1, ox, oz) {
  const n = ring.length;
  const c = centroid(ring);
  for (const [y, ny] of [[y1, 1], [y0, -1]]) {
    const cid = vb.v(c[0] - ox, y, c[1] - oz, 0, ny, 0, 0, 0);
    const ids = ring.map((p) => vb.v(p[0] - ox, y, p[1] - oz, 0, ny, 0, p[0], p[1]));
    for (let i = 0; i < n; i++) {
      if (ny > 0) vb.tri(cid, ids[(i + 1) % n], ids[i]); else vb.tri(cid, ids[i], ids[(i + 1) % n]);
      const a = ring[i], b = ring[(i + 1) % n];
      cb.tri([c[0] - ox, y, c[1] - oz], [a[0] - ox, y, a[1] - oz], [b[0] - ox, y, b[1] - oz], SURFACE.roof);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.01) continue;
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    const ids = [[a, y0], [b, y0], [b, y1], [a, y1]].map(([p, y], k) => vb.v(p[0] - ox, y, p[1] - oz, nx, 0, nz, k === 1 || k === 2 ? L : 0, y - y0));
    vb.quad(ids[1], ids[0], ids[3], ids[2]);
  }
}
