// Collision queries for creatures, on the World contract's query API (ARCHITECTURE.md, "Many
// creatures, many scales"): world.collidersNear(box3) -> BVH meshes (world space through their
// matrixWorld), world.raycast(origin, dir, far) -> { point, normal, distance, surface } | null.
// Falls back to world.collider when a world has no queries. Generic: nothing squirrel-specific.
import * as THREE from 'three';

const _box = new THREE.Box3();
const _inv = new THREE.Matrix4();
const _seg = new THREE.Line3();
const _segL = new THREE.Line3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n3 = new THREE.Matrix3();
const _ray = new THREE.Ray();

export function collidersNear(world, box) {
  if (world.collidersNear) return world.collidersNear(box);
  return world.collider ? [world.collider] : [];
}

function surfaceOf(mesh, triIndex) {
  const g = mesh.geometry, s = g.attributes.surface;
  if (!s) return 0;
  const vi = g.index ? g.index.getX(triIndex * 3) : triIndex * 3;
  return s.getX(vi);
}

// first hit along a ray (dir normalized): { point, normal, distance, surface } | null
export function raycast(world, origin, dir, far) {
  if (world.raycast) return world.raycast(origin, dir, far);
  return raycastMeshes(collidersNear(world, _box.setFromCenterAndSize(_v.copy(dir).multiplyScalar(far * 0.5).add(origin), _p1.set(1, 1, 1).multiplyScalar(far + 0.01)).expandByPoint(origin)), origin, dir, far);
}

export function raycastMeshes(meshes, origin, dir, far) {
  let best = null;
  for (const m of meshes) {
    const bvh = m.geometry.boundsTree;
    if (!bvh) continue;
    m.updateMatrixWorld();
    const ident = isIdentity(m.matrixWorld);
    _ray.origin.copy(origin); _ray.direction.copy(dir);
    let scale = 1;
    if (!ident) {
      _inv.copy(m.matrixWorld).invert();
      _ray.applyMatrix4(_inv);
      scale = _ray.direction.length(); _ray.direction.divideScalar(scale);
    }
    const hit = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far * scale);
    if (!hit) continue;
    const dist = hit.distance / scale;
    if (dist > far || (best && dist >= best.distance)) continue;
    const point = hit.point.clone(), normal = hit.face.normal.clone();
    if (!ident) { point.applyMatrix4(m.matrixWorld); normal.applyMatrix3(_n3.getNormalMatrix(m.matrixWorld)).normalize(); }
    if (normal.dot(dir) > 0) normal.negate();     // face the ray (double-sided colliders)
    best = { point, normal, distance: dist, surface: surfaceOf(m, hit.faceIndex), object: m };
  }
  return best;
}

function isIdentity(m) {
  const e = m.elements;
  return e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
}

// Push a capsule (segment a-b, radius r; world space, modified in place) out of the world.
// Calls onContact(normal, surface, depth) for each contact. Returns the number of contacts.
export function resolveCapsule(world, a, b, r, onContact, iterations = 3) {
  let contacts = 0;
  _box.makeEmpty(); _box.expandByPoint(a); _box.expandByPoint(b); _box.expandByScalar(r + 0.02);
  const meshes = collidersNear(world, _box);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const m of meshes) {
      const bvh = m.geometry.boundsTree;
      if (!bvh) continue;
      m.updateMatrixWorld();
      const ident = isIdentity(m.matrixWorld);
      _seg.start.copy(a); _seg.end.copy(b);
      _segL.copy(_seg);
      if (!ident) { _inv.copy(m.matrixWorld).invert(); _segL.applyMatrix4(_inv); }
      const lb = new THREE.Box3().expandByPoint(_segL.start).expandByPoint(_segL.end).expandByScalar(r);
      let best = null;
      bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(lb),
        intersectsTriangle: (tri, ti) => {
          const d = tri.closestPointToSegment(_segL, _p1, _p2);
          if (d < r && (!best || d < best.d)) best = { d, tp: _p1.clone(), sp: _p2.clone(), ti, n: tri.getNormal(new THREE.Vector3()) };
          return false;
        },
      });
      if (!best) continue;
      let tp = best.tp, sp = best.sp, tn = best.n;
      if (!ident) { tp.applyMatrix4(m.matrixWorld); sp.applyMatrix4(m.matrixWorld); tn.applyMatrix3(_n3.getNormalMatrix(m.matrixWorld)).normalize(); }
      const dir = _v.subVectors(sp, tp);
      let len = dir.length();
      if (len < 1e-6) { dir.copy(tn); len = 0; } else dir.divideScalar(len);
      const depth = r - len;
      a.addScaledVector(dir, depth + 1e-4); b.addScaledVector(dir, depth + 1e-4);
      contacts++; moved = true;
      onContact?.(dir.clone(), surfaceOf(m, best.ti), depth);
    }
    if (!moved) break;
  }
  return contacts;
}
