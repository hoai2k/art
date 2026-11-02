// Street furniture: Stratford's black heritage lamps, benches, planters with
// mums, hydrants, bins, bike racks and parked cars. Placed once from the road
// classification (deterministic), drawn instanced near the focus, and given
// simple boxes in the chunk colliders.
import * as THREE from 'three';
import { SURFACE } from '../surface.js';
import { Builder, walk, hash2, rng } from './util.js';
import { propMaterial } from './materials.js';

const BLACK = [0.07, 0.08, 0.08], IRON = [0.12, 0.13, 0.13], WOOD = [0.50, 0.33, 0.20], GLOW = [1.0, 0.86, 0.6];

function cyl(b, x, y0, z, r0, y1, r1, n, col) {
  b.set('color', col);
  const ring = (y, r) => { const ids = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; ids.push(b.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, Math.cos(a), (r0 - r1) / Math.max(0.01, y1 - y0) * 0.5, Math.sin(a))); } return ids; };
  const A = ring(y0, r0), B = ring(y1, r1);
  for (let i = 0; i < n; i++) b.quad(A[i + 1], A[i], B[i], B[i + 1]);
  if (r1 > 0.01) { const c = b.v(x, y1, z, 0, 1, 0); const R = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; R.push(b.v(x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1, 0, 1, 0)); } for (let i = 0; i < n; i++) b.tri(c, R[i + 1], R[i]); }
}
function box(b, cx, cy, cz, hx, hy, hz, col, yaw = 0) { b.set('color', col); b.box(cx, cy, cz, hx, hy, hz, yaw); }
function blob(b, x, y, z, r, col, seed) {
  const g = new THREE.IcosahedronGeometry(r, 0); const p = g.attributes.position, n = g.attributes.normal;
  const R = rng(seed);
  b.set('color', col);
  const base = b.n;
  for (let i = 0; i < p.count; i++) { const j = 0.85 + 0.3 * R(); b.v(x + p.getX(i) * j, y + p.getY(i) * j, z + p.getZ(i) * j, n.getX(i), n.getY(i), n.getZ(i)); }
  for (let i = 0; i < p.count; i += 3) b.tri(base + i, base + i + 1, base + i + 2);
  g.dispose();
}

const MAKERS = {
  lamp(b) {
    cyl(b, 0, 0, 0, 0.17, 0.5, 0.13, 8, BLACK);            // base
    cyl(b, 0, 0.5, 0, 0.075, 3.3, 0.06, 8, BLACK);          // post
    cyl(b, 0, 3.3, 0, 0.12, 3.42, 0.12, 8, BLACK);          // collar
    cyl(b, 0, 3.42, 0, 0.13, 3.95, 0.2, 6, GLOW);           // lantern glass
    cyl(b, 0, 3.95, 0, 0.26, 4.15, 0.05, 6, BLACK);         // cap
    cyl(b, 0, 4.15, 0, 0.03, 4.35, 0.01, 4, BLACK);         // finial
    box(b, 0, 3.18, 0, 0.32, 0.02, 0.02, BLACK);           // banner arm
  },
  bench(b) {
    for (const s of [-0.75, 0.75]) { box(b, s, 0.22, 0, 0.04, 0.22, 0.24, IRON); box(b, s, 0.6, -0.2, 0.04, 0.2, 0.03, IRON); }
    for (let i = 0; i < 4; i++) box(b, 0, 0.45, -0.18 + i * 0.12, 0.85, 0.02, 0.045, WOOD);
    for (let i = 0; i < 3; i++) box(b, 0, 0.58 + i * 0.12, -0.24, 0.85, 0.045, 0.015, WOOD);
  },
  planter(b) {
    box(b, 0, 0.3, 0, 0.6, 0.3, 0.3, [0.22, 0.30, 0.22]);
    box(b, 0, 0.61, 0, 0.64, 0.03, 0.34, [0.30, 0.22, 0.14]);
    const cols = [[0.85, 0.45, 0.10], [0.55, 0.22, 0.50], [0.90, 0.70, 0.15], [0.80, 0.30, 0.12], [0.30, 0.42, 0.18]];
    for (let i = 0; i < 9; i++) blob(b, -0.45 + (i % 5) * 0.22, 0.72 + (i % 2) * 0.05, -0.12 + Math.floor(i / 5) * 0.24, 0.16, cols[i % cols.length], i * 0.13 + 0.1);
    for (let i = 0; i < 4; i++) box(b, -0.5 + i * 0.33, 0.45, 0.31, 0.06, 0.18, 0.02, [0.25, 0.38, 0.16]);
  },
  hydrant(b) {
    const R = [0.72, 0.12, 0.08], Y = [0.85, 0.70, 0.18];
    cyl(b, 0, 0, 0, 0.14, 0.1, 0.14, 8, R);
    cyl(b, 0, 0.1, 0, 0.1, 0.62, 0.1, 8, R);
    cyl(b, 0, 0.62, 0, 0.12, 0.72, 0.06, 8, Y);
    box(b, 0, 0.42, 0, 0.17, 0.04, 0.04, R);
    box(b, 0, 0.42, 0.11, 0.05, 0.05, 0.05, R);
  },
  bin(b) {
    cyl(b, 0, 0, 0, 0.26, 0.85, 0.26, 10, [0.10, 0.14, 0.12]);
    cyl(b, 0, 0.85, 0, 0.28, 0.98, 0.1, 10, [0.10, 0.14, 0.12]);
  },
  bikerack(b) {
    for (const s of [-0.6, 0, 0.6]) {
      box(b, s, 0.42, -0.3, 0.025, 0.42, 0.025, IRON); box(b, s, 0.42, 0.3, 0.025, 0.42, 0.025, IRON); box(b, s, 0.84, 0, 0.025, 0.025, 0.32, IRON);
    }
  },
  car(b) {
    const W = [1, 1, 1], G = [0.13, 0.15, 0.18], T = [0.06, 0.06, 0.06], L = [0.95, 0.90, 0.80], RL = [0.6, 0.08, 0.06];
    box(b, 0, 0.62, 0, 2.2, 0.32, 0.88, W);                    // body
    box(b, -0.15, 1.12, 0, 1.25, 0.2, 0.8, W);                 // cabin base
    // glasshouse, slanted with a narrower roof
    b.set('color', G);
    const q = (p) => p;
    const gl = [[-1.35, 0.94, -0.8], [0.95, 0.94, -0.8], [0.6, 1.42, -0.72], [-1.15, 1.42, -0.72]];
    b.quad4(gl[0], gl[1], gl[2], gl[3]);
    b.quad4([0.95, 0.94, 0.8], [-1.35, 0.94, 0.8], [-1.15, 1.42, 0.72], [0.6, 1.42, 0.72]);
    b.quad4([0.95, 0.94, -0.8], [0.95, 0.94, 0.8], [0.6, 1.42, 0.72], [0.6, 1.42, -0.72]);
    b.quad4([-1.35, 0.94, 0.8], [-1.35, 0.94, -0.8], [-1.15, 1.42, -0.72], [-1.15, 1.42, 0.72]);
    b.set('color', W); b.quad4([-1.15, 1.42, -0.72], [0.6, 1.42, -0.72], [0.6, 1.42, 0.72], [-1.15, 1.42, 0.72]);
    void q;
    for (const [x, z] of [[-1.4, -0.82], [1.4, -0.82], [-1.4, 0.82], [1.4, 0.82]]) {
      b.set('color', T);
      const n = 8, ids0 = [], ids1 = [];
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const y = 0.33 + Math.sin(a) * 0.33, xx = x + Math.cos(a) * 0.33; ids0.push(b.v(xx, y, z - 0.12, Math.cos(a), Math.sin(a), 0)); ids1.push(b.v(xx, y, z + 0.12, Math.cos(a), Math.sin(a), 0)); }
      for (let i = 0; i < n; i++) b.quad(ids0[i], ids0[i + 1], ids1[i + 1], ids1[i]);
      const c0 = b.v(x, 0.33, z + 0.12 * Math.sign(z), 0, 0, Math.sign(z));
      for (let i = 0; i < n; i++) { const r = z > 0 ? ids1 : ids0; if (z > 0) b.tri(c0, r[i], r[i + 1]); else b.tri(c0, r[i + 1], r[i]); }
    }
    box(b, 2.21, 0.72, -0.6, 0.02, 0.08, 0.14, L); box(b, 2.21, 0.72, 0.6, 0.02, 0.08, 0.14, L);
    box(b, -2.21, 0.75, -0.62, 0.02, 0.07, 0.14, RL); box(b, -2.21, 0.75, 0.62, 0.02, 0.07, 0.14, RL);
  },
};
// collider boxes per type in local space: [cx, cy, cz, hx, hy, hz, surface]
const COLLIDE = {
  lamp: [[0, 2.1, 0, 0.09, 2.1, 0.09, SURFACE.fence], [0, 3.7, 0, 0.2, 0.3, 0.2, SURFACE.prop]],
  bench: [[0, 0.24, 0, 0.85, 0.24, 0.25, SURFACE.prop], [0, 0.7, -0.24, 0.85, 0.2, 0.03, SURFACE.prop]],
  planter: [[0, 0.4, 0, 0.62, 0.4, 0.32, SURFACE.prop]],
  hydrant: [[0, 0.36, 0, 0.13, 0.36, 0.13, SURFACE.prop]],
  bin: [[0, 0.49, 0, 0.26, 0.49, 0.26, SURFACE.prop]],
  bikerack: [[0, 0.42, 0, 0.62, 0.42, 0.32, SURFACE.fence]],
  car: [[0, 0.6, 0, 2.2, 0.45, 0.88, SURFACE.prop], [-0.25, 1.2, 0, 1.0, 0.24, 0.72, SURFACE.prop]],
};
const CAR_COLOURS = [0x8e1f1a, 0x1f3a5a, 0xd8d4c8, 0x2a2c2e, 0x6a6f72, 0x2f4a36, 0xb8b2a4, 0x5a3a28, 0x9aa4ae, 0x173040];

// Deterministic placement along the classified streets.
export function placeProps(ctx) {
  const { streets, H, curb } = ctx;
  const items = [];
  const add = (type, x, z, yaw, y) => items.push({ type, x, z, yaw, y: y ?? H(x, z), col: type === 'car' ? CAR_COLOURS[Math.floor(hash2(x, z) * CAR_COLOURS.length)] : 0xffffff });
  const nearJunction = (x, z, extra) => streets.jgrid.any(x, z, 40, (J) => Math.hypot(J.p[0] - x, J.p[1] - z) < J.r + extra);
  const nearMarking = (x, z, r) => ctx.markingGrid.any(x, z, r);
  const inBuilding = (x, z) => ctx.buildingAt(x, z);
  for (const s of streets.roads) {
    const r = s.road, hw = s.hw;
    if (r.bridge) continue;
    const yawOf = (dx, dz) => Math.atan2(-dz, dx);
    if (s.downtown) {
      for (const side of [-1, 1]) {
        walk(r.points, 21, (x, z, dx, dz, d) => {
          const nx = -dz * side, nz = dx * side;
          if (nearJunction(x, z, 4)) return;
          const px = x + nx * (hw + 0.65), pz = z + nz * (hw + 0.65);
          if (inBuilding(px, pz)) return;
          add('lamp', px, pz, yawOf(dx, dz), H(px, pz) + curb);
          const h = hash2(px, pz);
          const along = (o, off) => [x + dx * o + nx * (hw + off), z + dz * o + nz * (hw + off)];
          if (h < 0.45) { const [bx, bz] = along(4, 0.75); if (!inBuilding(bx, bz)) add('planter', bx, bz, yawOf(dx, dz), H(bx, bz) + curb); }
          else if (h < 0.62) { const [bx, bz] = along(6, 2.4); if (!inBuilding(bx, bz)) add('bench', bx, bz, Math.atan2(-nx, -nz), H(bx, bz) + curb); }
          else if (h < 0.72) { const [bx, bz] = along(-3, 0.6); if (!inBuilding(bx, bz)) add('bin', bx, bz, 0, H(bx, bz) + curb); }
          else if (h < 0.78) { const [bx, bz] = along(5, 1.2); if (!inBuilding(bx, bz)) add('bikerack', bx, bz, yawOf(nx, nz), H(bx, bz) + curb); }
        }, side > 0 ? 6 : 16);
        // parked cars in the parking lanes of wide downtown streets
        if (r.width >= 10.5) {
          walk(r.points, 6.6, (x, z, dx, dz) => {
            const nx = -dz * side, nz = dx * side;
            if (nearJunction(x, z, 9)) return;
            const cx = x + nx * (hw - 1.25), cz = z + nz * (hw - 1.25);
            if (nearMarking(cx, cz, 5)) return;
            if (hash2(cx, cz) > 0.62) return;
            add('car', cx, cz, yawOf(dx * side, dz * side), H(cx, cz));
          }, 4 + (side > 0 ? 0 : 3));
        }
      }
    } else {
      // residential: hydrants in the boulevard, a few cars at the curb
      walk(r.points, 95, (x, z, dx, dz) => {
        const side = hash2(x, z) < 0.5 ? -1 : 1, nx = -dz * side, nz = dx * side;
        const px = x + nx * (hw + 0.7), pz = z + nz * (hw + 0.7);
        if (!inBuilding(px, pz) && !nearJunction(x, z, 1)) add('hydrant', px, pz, 0, H(px, pz) + curb);
      }, 30);
      if (r.width >= 7) walk(r.points, 7, (x, z, dx, dz) => {
        if (hash2(x * 1.3, z) > 0.1 || nearJunction(x, z, 9)) return;
        const side = hash2(z, x) < 0.5 ? -1 : 1, nx = -dz * side, nz = dx * side;
        const cx = x + nx * (hw - 1.15), cz = z + nz * (hw - 1.15);
        add('car', cx, cz, Math.atan2(-dz * side, dx * side), H(cx, cz));
      });
    }
  }
  // lamps and benches along park paths
  for (const r of ctx.data.roads) {
    if (r.kind !== 'path' && r.kind !== 'footway') continue;
    if (!ctx.inPark(r.points[0][0], r.points[0][1])) continue;
    walk(r.points, 32, (x, z, dx, dz) => {
      const px = x - dz * (r.width / 2 + 0.5), pz = z + dx * (r.width / 2 + 0.5);
      if (streets.grid.nearest(px, pz, 8)) return;
      add('lamp', px, pz, 0);
      if (hash2(px, pz) < 0.35) { const bx = x + dz * (r.width / 2 + 0.8), bz = z - dx * (r.width / 2 + 0.8); add('bench', bx, bz, Math.atan2(-dz, dx)); }
    }, 10);
  }
  return items;
}

export function createProps(ctx, shared, items) {
  const group = new THREE.Group(); group.name = 'props';
  const mat = propMaterial(shared);
  const types = {};
  for (const t of Object.keys(MAKERS)) {
    const list = items.filter((i) => i.type === t);
    if (!list.length) continue;
    const b = new Builder({ color: 3 }); MAKERS[t](b);
    const mesh = new THREE.InstancedMesh(b.geometry(), mat, list.length);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
    if (t === 'car') mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
    group.add(mesh);
    types[t] = { mesh, list };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  let last = null, lastR = 0;
  const update = (focus, radius) => {
    if (last && last.distanceToSquared(focus) < 16 && radius === lastR) return;
    last = (last || new THREE.Vector3()).copy(focus); lastR = radius;
    const r2 = radius * radius;
    for (const t in types) {
      const { mesh, list } = types[t]; let n = 0;
      const rr = t === 'car' || t === 'lamp' ? r2 * 2.2 : r2;
      for (const it of list) {
        const dx = it.x - focus.x, dz = it.z - focus.z; if (dx * dx + dz * dz > rr) continue;
        _m.compose(_p.set(it.x, it.y, it.z), _q.setFromAxisAngle(up, it.yaw), _s);
        mesh.setMatrixAt(n, _m);
        if (mesh.instanceColor) mesh.setColorAt(n, _c.setHex(it.col));
        n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
  const addColliders = (list, cb, ox, oz) => {
    for (const it of list) for (const [cx, cy, cz, hx, hy, hz, s] of COLLIDE[it.type]) {
      const c = Math.cos(it.yaw), sn = Math.sin(it.yaw);
      cb.box(it.x - ox + cx * c + cz * sn, it.y + cy, it.z - oz - cx * sn + cz * c, hx, hy, hz, it.yaw, s);
    }
  };
  const dispose = () => { group.traverse((o) => o.geometry && o.geometry.dispose()); mat.dispose(); };
  return { group, update, addColliders, dispose, types };
}
