// Detail layers: fine geometry that only exists when the creature is small
// enough to see it, built in small cells around the focus, seeded by position
// (the same pebble is always in the same place). See ARCHITECTURE.md, "Many
// creatures, many scales". Here: grass-blades (insect scale: grass blades as
// climbable stalks, colliders) and the pebble helper; the leaf and ground tiers
// (ground-near, leaves-pebbles, street-fixtures) are in ground.js.
import * as THREE from 'three';
import { SURFACE } from '../surface.js';
import { Builder, hash1 } from './util.js';
import { MeshBVH } from 'three-mesh-bvh';

// position seed for a cell of a layer
export function cellSeed(layerId, i, j) {
  let h = 0; for (let k = 0; k < layerId.length; k++) h = (h * 31 + layerId.charCodeAt(k)) | 0;
  return hash1(h ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
}

// A textured pebble: a squashed icosahedron with one cell of the pebble sheet
// projected from above. b: Builder with color + uv.
export function pebble(b, x, y, z, r, cell, rng, cols = 4) {
  const geo = new THREE.IcosahedronGeometry(1, 1); const p = geo.attributes.position, n = geo.attributes.normal;
  const fl = 0.45 + rng() * 0.3, base = b.n, rot = rng() * Math.PI * 2, c = Math.cos(rot), s = Math.sin(rot);
  const cu = (cell % cols) / cols, cv = 1 - (Math.floor(cell / cols) + 1) / cols, cw = 1 / cols;
  const g = 0.9 + rng() * 0.2; b.set('color', [g, g, g]);
  const out = [];
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const qx = px * c - pz * s, qz = px * s + pz * c;
    const u = cu + cw * (0.5 + px * 0.42), v = cv + cw * (0.5 - pz * 0.42);
    const P = [x + qx * r, y + (py * fl + fl * 0.6) * r, z + qz * r];
    out.push(P);
    b.v(P[0], P[1], P[2], n.getX(i) * c - n.getZ(i) * s, n.getY(i), n.getX(i) * s + n.getZ(i) * c, u, v);
  }
  for (let i = 0; i < p.count; i += 3) b.tri(base + i, base + i + 1, base + i + 2);
  geo.dispose();
  return out;
}

export function grassLayer(env) {
  const sp = env.sprites || {};
  const useSprites = !!(sp.blades && sp.litter);
  let atlas = null, cardMat, pebMat;
  if (useSprites) {
    // blades (left) and litter bits (right) in one atlas: one draw call per cell
    const W = 1024, cv = document.createElement('canvas'); cv.width = W * 2; cv.height = W;
    const g = cv.getContext('2d'); g.drawImage(sp.blades.image, 0, 0, W, W); g.drawImage(sp.litter.image, W, 0, W, W);
    atlas = new THREE.CanvasTexture(cv); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
    cardMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
  } else cardMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  pebMat = new THREE.MeshLambertMaterial({ map: sp.pebbles || null, vertexColors: true });
  return {
    id: 'grass-blades', minScale: 0, maxScale: 0.03, radius: 2.6, cellSize: 1,
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell;
      const b = new Builder({ color: 3 }), pb = new Builder({ color: 3 });
      const coll = [], pcoll = [];
      const s0 = env.surfaceAt(x0 + size / 2, z0 + size / 2);
      if (!s0) return null;
      const lawn = (s) => s && (s.surface === SURFACE.grass || s.surface === SURFACE.ground);
      const quadColl = (A, B, C, D) => coll.push(A, B, C, D);
      for (let k = 0; k < (useSprites ? 300 : 520); k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const s = (k % 8 === 0) ? env.surfaceAt(x, z) : s0;
        const ground = env.groundClass(x, z);
        const y = k % 8 ? env.heightNear(s0, x, z) : (s ? s.y : 0);
        const lx = x - cell.ox, lz = z - cell.oz;
        const a = rng() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
        if (!lawn(s) || (ground !== 0 && ground !== 1 && ground !== 5)) {
          // paving and paths: now and then a pebble or a bit of litter
          if (!useSprites || !s || s.surface > SURFACE.grass || k % 12) continue;
          if (rng() < 0.6) { pcoll.push(...pebble(pb, lx, y - 0.001, lz, 0.002 + rng() * 0.008, Math.floor(rng() * 16), rng)); continue; }
          const j = Math.floor(rng() * 16), r = 0.008 + rng() * 0.02;
          const cu = 0.5 + ((j % 4) / 4) * 0.5, cv = 1 - (Math.floor(j / 4) + 1) / 4, c = Math.cos(a) * r, sn = Math.sin(a) * r;
          b.set('color', [1, 1, 1]);
          const ids = [[-c + sn, -sn - c, cu, cv], [c + sn, sn - c, cu + 0.125, cv], [c - sn, sn + c, cu + 0.125, cv + 0.25], [-c - sn, -sn + c, cu, cv + 0.25]].map(([ox2, oz2, u, v]) => b.v(lx + ox2, y + 0.0015, lz + oz2, 0, 1, 0, u, v));
          b.quad(ids[0], ids[1], ids[2], ids[3]);
          continue;
        }
        if (useSprites) {
          // a blade or weed card from the sheet (2 rows of 10), crossed
          const i = Math.floor(rng() * 20), h = 0.04 + rng() * 0.1, w = h * 0.2, lean = (rng() - 0.5) * 0.3 * h;
          const u0 = (i % 10) / 10, u1 = u0 + 0.1, v0 = i < 10 ? 0.5 : 0, v1 = v0 + 0.5;
          const sh = 0.85 + rng() * 0.3; b.set('color', [sh, sh, sh]);
          for (const [ex, ez] of [[dx, dz], [-dz, dx]]) {
            const P = [[lx - ex * w / 2, y, lz - ez * w / 2, u0 / 2, v0], [lx + ex * w / 2, y, lz + ez * w / 2, u1 / 2, v0], [lx + ex * w / 2 + dz * lean, y + h, lz + ez * w / 2 - dx * lean, u1 / 2, v1], [lx - ex * w / 2 + dz * lean, y + h, lz - ez * w / 2 - dx * lean, u0 / 2, v1]];
            const ids = P.map(([px, py, pz, u, v]) => b.v(px, py, pz, -ez, 0.4, ex, u, v));
            b.quad(ids[0], ids[1], ids[2], ids[3]);
          }
          quadColl([lx - dx * w * 0.2, y, lz - dz * w * 0.2], [lx + dx * w * 0.2, y, lz + dz * w * 0.2], [lx + dx * w * 0.2 + dz * lean, y + h * 0.9, lz + dz * w * 0.2 - dx * lean], [lx - dx * w * 0.2 + dz * lean, y + h * 0.9, lz - dz * w * 0.2 - dx * lean]);
          // now and then a bit of litter lying in the grass, or a pebble
          if (k % 40 === 0) {
            const j = Math.floor(rng() * 16), r = 0.01 + rng() * 0.02;
            const cu = 0.5 + ((j % 4) / 4) * 0.5, cv = 1 - (Math.floor(j / 4) + 1) / 4;
            const c = Math.cos(a) * r, sn = Math.sin(a) * r;
            const ids = [[-c + sn, -sn - c, cu, cv], [c + sn, sn - c, cu + 0.125, cv], [c - sn, sn + c, cu + 0.125, cv + 0.25], [-c - sn, -sn + c, cu, cv + 0.25]].map(([ox, oz, u, v]) => b.v(lx + ox, y + 0.002, lz + oz, 0, 1, 0, u, v));
            b.quad(ids[0], ids[1], ids[2], ids[3]);
          }
          if (k % 60 === 0) {
            const tris = pebble(pb, lx, y - 0.002, lz, 0.004 + rng() * 0.012, Math.floor(rng() * 16), rng);
            pcoll.push(...tris);
          }
        } else {
          const h = 0.04 + rng() * 0.09, w = 0.0018 + rng() * 0.0015, lean = (rng() - 0.3) * 0.5;
          const gg = 0.75 + rng() * 0.35, dry = rng() < 0.18;
          const base = dry ? [0.62 * gg, 0.56 * gg, 0.30 * gg] : [0.30 * gg, 0.42 * gg, 0.14 * gg];
          const pts = [];
          for (let i = 0; i <= 3; i++) { const t = i / 3, bend = lean * t * t * h; pts.push([lx + dx * bend, y + h * t, lz + dz * bend, w * (1 - t * 0.9)]); }
          const nx = -dz, nz = dx; let prev = null;
          for (let i = 0; i <= 3; i++) {
            const [px, py, pz, ww] = pts[i]; const sh = 0.7 + 0.3 * (i / 3);
            b.set('color', [base[0] * sh, base[1] * sh, base[2] * sh]);
            const L = b.v(px + nx * ww, py, pz + nz * ww, dx, 0.3, dz), R = b.v(px - nx * ww, py, pz - nz * ww, dx, 0.3, dz);
            if (prev) { b.quad(prev[0], prev[1], R, L); const A = pts[i - 1]; quadColl([A[0] + nx * A[3], A[1], A[2] + nz * A[3]], [A[0] - nx * A[3], A[1], A[2] - nz * A[3]], [px - nx * ww, py, pz - nz * ww], [px + nx * ww, py, pz + nz * ww]); }
            prev = [L, R];
          }
        }
      }
      if (!b.n && !pb.n) return null;
      const group = new THREE.Group();
      if (b.n) { const m = new THREE.Mesh(b.geometry(), cardMat); m.receiveShadow = true; group.add(m); }
      if (pb.n) { const m = new THREE.Mesh(pb.geometry(), pebMat); m.receiveShadow = true; m.castShadow = true; group.add(m); }
      // climbable stalks (branch) and pebbles (prop) for creatures that walk on them
      const nq = coll.length / 4, np = pcoll.length / 3;
      const pos = new Float32Array(nq * 18 + np * 9), surf = new Uint8Array(nq * 6 + np * 3);
      let o = 0, so = 0;
      for (let q = 0; q < coll.length; q += 4) { for (const P of [coll[q], coll[q + 1], coll[q + 2], coll[q], coll[q + 2], coll[q + 3]]) { pos[o++] = P[0]; pos[o++] = P[1]; pos[o++] = P[2]; surf[so++] = SURFACE.branch; } }
      for (const P of pcoll) { pos[o++] = P[0]; pos[o++] = P[1]; pos[o++] = P[2]; surf[so++] = SURFACE.prop; }
      if (!so) return { object: group };
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      cg.setAttribute('surface', new THREE.BufferAttribute(surf, 1));
      cg.boundsTree = new MeshBVH(cg);
      return { object: group, colliders: [new THREE.Mesh(cg)] };
    },
    dispose() { atlas?.dispose(); cardMat.dispose(); pebMat.dispose(); },
  };
}
