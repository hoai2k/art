// Detail layers: fine geometry that only exists when the creature is small
// enough to see it, built in small cells around the focus, seeded by position
// (the same pebble is always in the same place). See ARCHITECTURE.md, "Many
// creatures, many scales". Two built-in layers prove the mechanism:
//   leaves-pebbles  squirrel scale: fallen leaves and pebbles as real geometry
//   grass-blades    insect scale: grass blades as climbable stalks (colliders)
import * as THREE from 'three';
import { SURFACE } from '../surface.js';
import { Builder, hash1 } from './util.js';
import { MeshBVH } from 'three-mesh-bvh';

// position seed for a cell of a layer
export function cellSeed(layerId, i, j) {
  let h = 0; for (let k = 0; k < layerId.length; k++) h = (h * 31 + layerId.charCodeAt(k)) | 0;
  return hash1(h ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
}

const LEAF_COLS = [[0.72, 0.16, 0.06], [0.86, 0.38, 0.08], [0.9, 0.62, 0.15], [0.62, 0.36, 0.14], [0.8, 0.26, 0.08], [0.55, 0.22, 0.10], [0.85, 0.52, 0.12]];

function leafAtlas() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S;
  const g = cv.getContext('2d');
  // left: one maple leaf (white, tinted by vertex colour); right: opaque for pebbles
  g.translate(S / 2, S / 2); g.fillStyle = '#fff'; g.beginPath();
  for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2; const r = k % 2 ? S * 0.2 : S * 0.47; const x = Math.cos(t) * r, y = Math.sin(t) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.fill();
  g.strokeStyle = 'rgba(120,80,50,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, S * 0.5); g.lineTo(0, -S * 0.4); g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ddd'; g.fillRect(S + 4, 4, S - 8, S - 8);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// rectangles [x0, y0, x1, y1] (image fractions from the top left) of the
// single leaves on the delivered sprites/fallen_leaves.png
const FALLEN_RECTS = [[0.007, 0.005, 0.347, 0.331], [0.35, 0.007, 0.66, 0.344], [0.653, 0.009, 0.988, 0.348], [0.737, 0.321, 0.979, 0.655], [0.266, 0.329, 0.522, 0.665], [0.015, 0.332, 0.251, 0.674], [0.541, 0.337, 0.725, 0.678], [0.754, 0.65, 0.96, 0.985], [0.016, 0.655, 0.312, 0.973], [0.316, 0.674, 0.501, 0.987], [0.521, 0.69, 0.805, 0.967]];

export function leavesLayer(env) {
  const sheet = env.fallen || null;
  const tex = sheet || leafAtlas();
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const pebbleMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return {
    id: 'leaves-pebbles', minScale: 0.06, maxScale: 2.0, radius: 26, cellSize: 12,
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell;
      const b = new Builder({ color: 3 }), pb = new Builder({ color: 3 });
      // density from the trees nearby and the ground
      const treesNear = env.treesNear(x0 + size / 2, z0 + size / 2, size * 0.75 + 12);
      const nTry = Math.round(size * size * 1.4);
      const up = new THREE.Vector3();
      for (let k = 0; k < nTry; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        let dens = 0.06;
        for (const t of treesNear) { const d = Math.hypot(t.x - x, t.z - z); if (d < t.crown * 1.3) dens = Math.max(dens, 0.9 * (1 - d / (t.crown * 1.4))); }
        const s = env.surfaceAt(x, z);
        if (!s) continue;
        if (s.surface === SURFACE.road) dens *= 0.25;
        if (s.surface === SURFACE.water_bed || s.surface === SURFACE.roof || s.surface >= 4 && s.surface <= 10) continue;
        const pebble = rng() < (s.surface === SURFACE.ground ? 0.35 : 0.08);
        if (!pebble && rng() > dens) continue;
        up.copy(s.normal);
        const y = s.y + 0.004;
        const lx = x - cell.ox, lz = z - cell.oz;
        if (pebble) {
          const r = 0.008 + rng() * 0.02, g = 0.45 + rng() * 0.25;
          pb.set('color', [g, g * 0.97, g * 0.92]);
          const geo = new THREE.IcosahedronGeometry(r, 0); const p = geo.attributes.position, n = geo.attributes.normal;
          const base = pb.n, fl = 0.55 + rng() * 0.3;
          for (let i = 0; i < p.count; i++) pb.v(lx + p.getX(i), y + p.getY(i) * fl, lz + p.getZ(i), n.getX(i), n.getY(i), n.getZ(i));
          for (let i = 0; i < p.count; i += 3) pb.tri(base + i, base + i + 1, base + i + 2);
          geo.dispose();
        } else {
          const sz = 0.05 + rng() * 0.05, a = rng() * Math.PI * 2, c = Math.cos(a) * sz, sn = Math.sin(a) * sz;
          const col = LEAF_COLS[Math.floor(rng() * LEAF_COLS.length)], sh = 0.8 + rng() * 0.3;
          const curl = 0.004 + rng() * 0.01;
          let P;
          if (sheet) {
            // one of the painted leaves, its own colours, lightly shaded
            const R = FALLEN_RECTS[Math.floor(rng() * FALLEN_RECTS.length)];
            const u0 = R[0], u1 = R[2], v0 = 1 - R[3], v1 = 1 - R[1], um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
            b.set('color', [sh, sh, sh]);
            P = [[-c - sn, 0, -sn + c, u0, v1], [c - sn, curl, sn + c, u1, v1], [c + sn, 0, sn - c, u1, v0], [-c + sn, curl, -sn - c, u0, v0]];
            void um; void vm;
          } else {
            b.set('color', [col[0] * sh, col[1] * sh, col[2] * sh]);
            // a leaf folded slightly along its midrib (4 vertices)
            P = [[-c, 0, -sn, 0, 0.5], [sn, curl, -c, 0.25, 0], [c, 0, sn, 0.5, 0.5], [-sn, curl, c, 0.25, 1]];
          }
          const ids = P.map(([dx, dy, dz, u, v]) => b.v(lx + dx * 1, y + dy, lz + dz, up.x, up.y, up.z, u, v));
          // uv: the leaf texture spans the left half of the atlas
          b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
        }
      }
      if (!b.n && !pb.n) return null;
      const group = new THREE.Group();
      if (b.n) { const m = new THREE.Mesh(b.geometry(), mat); m.receiveShadow = true; group.add(m); }
      if (pb.n) { const m = new THREE.Mesh(pb.geometry(), pebbleMat); m.receiveShadow = true; group.add(m); }
      return { object: group };
    },
    dispose() { if (!sheet) tex.dispose(); mat.dispose(); pebbleMat.dispose(); },
  };
}

export function grassLayer(env) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return {
    id: 'grass-blades', minScale: 0, maxScale: 0.03, radius: 2.6, cellSize: 1,
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell;
      const b = new Builder({ color: 3 });
      const coll = [];
      const s0 = env.surfaceAt(x0 + size / 2, z0 + size / 2);
      if (!s0) return null;
      for (let k = 0; k < 520; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const s = (k % 8 === 0) ? env.surfaceAt(x, z) : s0;
        if (!s || (s.surface !== SURFACE.grass && s.surface !== SURFACE.ground)) continue;
        const ground = env.groundClass(x, z);
        if (ground !== 0 && ground !== 1 && ground !== 5) continue;
        const y = s.surface === s0.surface && k % 8 ? env.heightNear(s0, x, z) : s.y;
        const h = 0.04 + rng() * 0.09, w = 0.0018 + rng() * 0.0015;
        const a = rng() * Math.PI * 2, lean = (rng() - 0.3) * 0.5;
        const dx = Math.cos(a), dz = Math.sin(a);
        const g = 0.75 + rng() * 0.35, dry = rng() < 0.18;
        const base = dry ? [0.62 * g, 0.56 * g, 0.30 * g] : [0.30 * g, 0.42 * g, 0.14 * g];
        const lx = x - cell.ox, lz = z - cell.oz;
        // 3 segments, bending along the lean
        const pts = [];
        for (let i = 0; i <= 3; i++) {
          const t = i / 3, bend = lean * t * t * h;
          pts.push([lx + dx * bend, y + h * t, lz + dz * bend, w * (1 - t * 0.9)]);
        }
        const nx = -dz, nz = dx;
        let prev = null;
        for (let i = 0; i <= 3; i++) {
          const [px, py, pz, ww] = pts[i];
          const sh = 0.7 + 0.3 * (i / 3);
          b.set('color', [base[0] * sh, base[1] * sh, base[2] * sh]);
          const L = b.v(px + nx * ww, py, pz + nz * ww, dx, 0.3, dz), R = b.v(px - nx * ww, py, pz - nz * ww, dx, 0.3, dz);
          if (prev) {
            b.quad(prev[0], prev[1], R, L);
            const A = pts[i - 1];
            coll.push([A[0] + nx * A[3], A[1], A[2] + nz * A[3]], [A[0] - nx * A[3], A[1], A[2] - nz * A[3]], [px - nx * ww, py, pz - nz * ww], [px + nx * ww, py, pz + nz * ww]);
          }
          prev = [L, R];
        }
      }
      if (!b.n) return null;
      const mesh = new THREE.Mesh(b.geometry(), mat);
      mesh.receiveShadow = true;
      // climbable stalks for creatures that walk on them
      const pos = new Float32Array((coll.length / 4) * 18), surf = new Uint8Array((coll.length / 4) * 6);
      for (let q = 0, o = 0; q < coll.length; q += 4) {
        const [a, bb, c, d] = [coll[q], coll[q + 1], coll[q + 2], coll[q + 3]];
        for (const p of [a, bb, c, a, c, d]) { pos[o++] = p[0]; pos[o++] = p[1]; pos[o++] = p[2]; }
      }
      surf.fill(SURFACE.branch);
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      cg.setAttribute('surface', new THREE.BufferAttribute(surf, 1));
      cg.boundsTree = new MeshBVH(cg);
      const collider = new THREE.Mesh(cg);
      return { object: mesh, colliders: [collider] };
    },
    dispose() { mat.dispose(); },
  };
}
