// Hand-made parts for the landmarks, added to their footprints by
// buildings.js. Each entry: { roof?(b, rh) -> {roof, rh}, replacesRoof?,
// noSteeple?, build({ ctx, b, P, vb, cb, ox, oz, base, eaves, rh, fronts, kit }) }.
import { SURFACE } from '../surface.js';
import { PART, MAT, FLAG } from './materials.js';
import { centroid, obb, polyArea } from './util.js';
import { insetRing } from './buildings.js';

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

export const landmarkParts = {
  // Stratford City Hall (1899): red brick on its triangular site, with the
  // tall clock tower at the apex facing the square.
  'city-hall': {
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      const i = sharpest(b.outer), q = b.outer[i];
      const c = centroid(b.outer);
      let dx = c[0] - q[0], dz = c[1] - q[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const w = 6.2;
      const tx = q[0] + dx * w * 0.75, tz = q[1] + dz * w * 0.75;
      const yaw = Math.atan2(-dz, dx) + Math.PI / 4;
      const top = eaves + rh + 6.5;
      const y = kit.tower(vb, cb, P, tx - ox, base, tz - oz, w, top, yaw, { belfry: 4.2, clock: true, pyramid: 7.5, roofPart: PART.copper, mat: MAT.brick_red });
      // corner pinnacles on the belfry
      kit.setPart(vb, P, PART.copper);
      for (let k = 0; k < 4; k++) {
        const a = yaw + Math.PI / 4 + (k * Math.PI) / 2, r = w * 0.62;
        kit.frustum(vb, cb, tx - ox + Math.cos(a) * r, top + 4.6, tz - oz - Math.sin(a) * r, 0.45, top + 7.2, 0.04, 6, 0, SURFACE.roof);
      }
      // two gabled bays on the long fronts: small towers capped by pyramids
      const o = obb(b.outer);
      if (o) {
        kit.setPart(vb, P, PART.wall, MAT.brick_red, FLAG.front | FLAG.arched, 5, eaves - base + 3, 3);
        for (const s of [-1, 1]) {
          const bx = o.cx + o.ux * o.hu * 0.45 * s, bz = o.cz + o.uz * o.hu * 0.45 * s;
          kit.setPart(vb, P, PART.roof);
          kit.frustum(vb, cb, bx - ox, eaves + rh * 0.4, bz - oz, 2.4, eaves + rh + 2.5, 0.1, 4, Math.atan2(-o.uz, o.ux) + Math.PI / 4, SURFACE.roof);
        }
      }
    },
  },
  // Perth County Courthouse (1887, George F. Durand): High Victorian, a
  // central tower over the entrance with a steep pavilion roof.
  courthouse: {
    build({ b, P, vb, cb, ox, oz, base, eaves, rh, kit }) {
      const k = b.front >= 0 ? b.front : 0;
      const m = edgeMid(b, k), L = Math.hypot(m.dx, m.dz) || 1;
      const nx = m.dz / L, nz = -m.dx / L;              // outward
      const w = 5.6;
      const tx = m.x + nx * 0.8, tz = m.z + nz * 0.8;
      const yaw = Math.atan2(nz, -nx) + Math.PI / 2;
      kit.tower(vb, cb, P, tx - ox, base, tz - oz, w, eaves + rh + 4.5, Math.atan2(-m.dz, m.dx), { belfry: 3.2, clock: true, pyramid: 8.5, roofPart: PART.roof, mat: P.mat });
      // entrance porch in stone
      kit.setPart(vb, P, PART.stone);
      kit.box(vb, cb, tx + nx * 3.2 - ox, base + 2.3, tz + nz * 3.2 - oz, 2.6, 2.3, 0.9, Math.atan2(-m.dz, m.dx), SURFACE.wall_stone);
      void yaw;
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
      const yc = y1 + 1.2, apex = yc + 9.5, pts = 20;
      kit.setPart(vb, P, PART.copper);
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
        const v0 = P3(a0, r * 1.06, yc), pk = P3(am, r * 1.14, yc + 3.4), v1 = P3(a1, r * 1.06, yc);
        const ap = [cx, apex, cz];
        const mid = P3(am, r * 0.55, yc + 6.0);
        tri(v0, pk, mid); tri(pk, v1, mid); tri(v0, mid, ap); tri(mid, v1, ap);
        // the fascia under each point
        tri(P3(a0, r, yc), P3(am, r * 1.14, yc + 3.4), P3(a0, r * 1.06, yc));
        tri(P3(am, r * 1.14, yc + 3.4), P3(a1, r, yc), P3(a1, r * 1.06, yc));
        tri(P3(a0, r, yc), P3(a1, r, yc), P3(am, r * 1.14, yc + 3.4));
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
      const ring = insetRing(b.outer, -2.6);
      const y0 = eaves + 0.2, y1 = eaves + 0.9;
      kit.setPart(vb, P, PART.copper);
      slab(vb, cb, ring, y0, y1, ox, oz);
      // a brick "veil" band under the slab
      kit.setPart(vb, P, PART.wall, MAT.brick_red, FLAG.noWindows, 10, 200, 1);
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
