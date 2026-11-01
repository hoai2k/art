// Hand-made parts for the landmarks, added to their footprints by
// buildings.js. Each entry: { roof?(b, rh) -> {roof, rh}, replacesRoof?,
// noSteeple?, build({ ctx, b, P, vb, cb, ox, oz, base, eaves, rh, fronts, kit }) }.
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { centroid, obb, polyArea } from './util.js';
import { insetRing } from './buildings.js';

// A gable over the eaves (white-trimmed when the palette says so): a
// triangle of wall facing out along (nx, nz), with a little roof behind it.
function gable(vb, cb, P, x, y, z, dx, dz, nx, nz, w, h, kit) {
  const hw = w / 2, V = (s, up, out) => [x + dx * s + nx * out, y + up, z + dz * s + nz * out];
  kit.setPart(vb, P, PART.wall, P.mat, 0, w, 0.1, 1);
  const tri = (a, b, c, n) => { const ids = [a, b, c].map((p) => vb.v(p[0], p[1], p[2], n[0], n[1], n[2], (p[0] - x) * dx + (p[2] - z) * dz + hw, p[1] - y + 50)); vb.tri(ids[0], ids[1], ids[2]); vb.tri(ids[0], ids[2], ids[1]); cb.tri(a, b, c, SURFACE.wall_brick); };
  tri(V(-hw, 0, 0.3), V(hw, 0, 0.3), V(0, h, 0.3), [nx, 0, nz]);
  kit.setPart(vb, P, PART.roof);
  const ridgeBack = V(0, h, -3.5), ridgeFront = V(0, h, 0.4);
  for (const sg of [-1, 1]) {
    const e0 = V(sg * (hw + 0.3), -0.2, 0.4), e1 = V(sg * (hw + 0.3), -0.2, -3.5);
    const n = [0, 1, 0];
    const ids = [e0, e1, ridgeBack, ridgeFront].map((p) => vb.v(p[0], p[1], p[2], n[0], n[1], n[2], p[0], p[2]));
    vb.quad(ids[0], ids[1], ids[2], ids[3]); vb.quad(ids[1], ids[0], ids[3], ids[2]);
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
      vb.quad(ids[0], ids[1], ids[2], ids[3]); vb.quad(ids[1], ids[0], ids[3], ids[2]);
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
    params: () => ({ seed: 0.241, mat: MAT.brick_red }),            // slate roofs, white trim
    roof: (b, rh) => ({ roof: 'hipped', rh: Math.max(rh, 7) }),
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
      const w = 6.4, t = frontTower(b, w, 'centre', edge);
      const top = eaves + 3.2;
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
        kit.setPart(vb, P, PART.trim);
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const px = o.cx + o.ux * o.hu * su * 0.97 - o.uz * o.hv * sv * 0.97, pz = o.cz + o.uz * o.hu * su * 0.97 + o.ux * o.hv * sv * 0.97;
          kit.box(vb, cb, px - ox, eaves + 0.9, pz - oz, 0.55, 0.9, 0.55, 0, SURFACE.wall_stone);
          kit.frustum(vb, cb, px - ox, eaves + 1.8, pz - oz, 0.6, eaves + 4.6, 0.04, 8, 0, SURFACE.roof);
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
    params: () => ({ mat: MAT.brick_buff, seed: 0.108 }),
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      const w = 4.8, t = frontTower(b, w, 'left');
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, eaves + rh + 3.5, t.yaw, { belfry: 3.6, clock: true, pyramid: 10.5, roofPart: PART.roof, pinnacles: 1.6, mat: MAT.brick_buff });
      // a projecting entrance bay with its gable in the middle of the front
      const m = frontTower(b, 7, 'centre');
      kit.setPart(vb, P, PART.wall, MAT.brick_buff, FLAG.front | FLAG.arched, 7, eaves - base, 3);
      kit.box(vb, cb, m.x - ox, (base + eaves) / 2, m.z - oz, 3.5, (eaves - base) / 2, 1.2, m.yaw, SURFACE.wall_brick);
      gable(vb, cb, P, m.x - ox, eaves, m.z - oz, m.dx, m.dz, m.nx, m.nz, 7.4, 4.5, kit);
    },
  },
  // Knox Presbyterian Church: dark red brick, a big gabled front with a
  // great window, green copper trim, a square tower with a low cap (photo).
  'knox-church': {
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
    noSteeple: true,
    params: () => ({ mat: MAT.stone }),
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      const w = 5.6, t = frontTower(b, w, 'right');
      kit.tower(vb, cb, P, t.x - ox, base, t.z - oz, w, eaves + rh + 4, t.yaw, { belfry: 4.2, pinnacles: 3.8, mat: MAT.stone });
      kit.setPart(vb, P, PART.stone);
    },
  },
  // Festival Theatre (1957): the round drum under the crown-like folded roof
  // that recalls the Festival's first tent.
  'festival-theatre': {
    replacesRoof: true,
    roof: () => ({ roof: 'flat', rh: 0 }),
    build({ b, P, vb, cb, ox, oz, base, eaves, kit }) {
      const c = centroid(b.outer);
      const area = polyArea(b.outer);
      const r = Math.max(14, Math.sqrt(area / Math.PI) * 0.78);
      const cx = c[0] - ox, cz = c[1] - oz;
      const n = 32;
      // drum: plain buff wall with a band of clerestory glass
      kit.setPart(vb, P, PART.wall, MAT.stucco, FLAG.noWindows, 2 * Math.PI * r, 200, 1);
      const y0 = eaves - 0.5, y1 = eaves + 4.5;
      kit.frustum(vb, cb, cx, y0, cz, r, y1, r, n, 0, SURFACE.wall_smooth);
      kit.setPart(vb, P, PART.glass);
      kit.frustum(vb, null, cx, y1, cz, r * 0.995, y1 + 1.2, r * 0.995, n, 0, SURFACE.wall_smooth);
      // the crown: a pleated cone whose rim rises into points
      const yc = y1 + 1.2, apex = yc + 9.5, pts = 16;
      kit.setPart(vb, { ...P, seed: 0.1 }, PART.copper);            // dark slate grey
      const P3 = (a, rr, y) => [cx + Math.cos(a) * rr, y, cz - Math.sin(a) * rr];
      const tri = (p, q, s) => {
        const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = s[0] - p[0], vy = s[1] - p[1], vz = s[2] - p[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        const ids = [p, q, s].map((v, k) => vb.v(v[0], v[1], v[2], nx, ny, nz, k * 2, v[1] - yc));
        vb.tri(ids[0], ids[1], ids[2]);
        const ids2 = [p, s, q].map((v, k) => vb.v(v[0], v[1], v[2], -nx, -ny, -nz, k * 2, v[1] - yc));
        vb.tri(ids2[0], ids2[1], ids2[2]);
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
      kit.setPart(vb, P, PART.dark);
      kit.frustum(vb, null, cx, apex + 3.3, cz, 0.07, apex + 9, 0.04, 4, 0, SURFACE.prop);
    },
  },
  // Tom Patterson Theatre (2022, Hariri Pontarini): glass at the ground and a
  // long, low, deeply overhanging roof slab facing the river.
  'tom-patterson-theatre': {
    replacesRoof: true,
    roof: () => ({ roof: 'flat', rh: 0 }),
    build({ b, P, vb, cb, ox, oz, eaves, kit }) {
      // checked against the photos: a deep bronze fascia over glass walls
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
    build({ b, P, vb, cb, ox, oz, base, kit }) {
      const k = b.front >= 0 ? b.front : 0;
      const m = edgeMid(b, k), L = Math.hypot(m.dx, m.dz) || 1;
      const nx = m.dz / L, nz = -m.dx / L, yaw = Math.atan2(-m.dz, m.dx);
      const w = Math.min(L * 0.8, 12);
      kit.setPart(vb, P, PART.sign);
      kit.box(vb, cb, m.x + nx * 1.6 - ox, base + 4.2, m.z + nz * 1.6 - oz, w / 2, 0.45, 1.6, yaw, SURFACE.prop);
      kit.setPart(vb, P, PART.dark);
      kit.box(vb, null, m.x + nx * 1.6 - ox, base + 3.68, m.z + nz * 1.6 - oz, w / 2 - 0.05, 0.07, 1.55, yaw, SURFACE.prop);
      // vertical blade sign (no lettering)
      kit.setPart(vb, P, PART.sign);
      kit.box(vb, cb, m.x + nx * 0.9 - ox, base + 8, m.z + nz * 0.9 - oz, 0.15, 2.8, 0.7, yaw + Math.PI / 2, SURFACE.prop);
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
