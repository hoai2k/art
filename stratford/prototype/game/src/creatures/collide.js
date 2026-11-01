// Collision queries for creatures, on the World contract's query API (ARCHITECTURE.md, "Many
// creatures, many scales"): world.collidersNear(box3) -> BVH meshes (world space through their
// matrixWorld), world.raycast(origin, dir, far) -> { point, normal, distance, surface } | null.
// Falls back to world.collider when a world has no queries. Generic: nothing squirrel-specific.
//
// The town's colliders are thin, often open shells (a wall is one quad, a roof another), so
// nothing here may resolve a penetration by pushing through a surface: depenetration keeps the
// body on the side of each triangle it came from (`prev`), and callers sweep in short steps.
import * as THREE from 'three';

const _box = new THREE.Box3();
const _lb = new THREE.Box3();
const _inv = new THREE.Matrix4();
const _seg = new THREE.Line3();
const _segL = new THREE.Line3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n3 = new THREE.Matrix3();
const _ray = new THREE.Ray();
const _sph = new THREE.Sphere();

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

// Is the straight path a -> b free of geometry (nothing hit before b, less `pad`)?
export function pathClear(world, a, b, pad = 0.002) {
  _w.subVectors(b, a);
  const L = _w.length();
  if (L < 1e-6) return true;
  _w.divideScalar(L);
  const hit = raycast(world, a, _w.clone(), L);
  return !hit || hit.distance >= L - pad;
}

// Does a sphere overlap any collider triangle?
export function sphereHits(world, center, r) {
  _box.setFromCenterAndSize(center, _v.set(2 * r, 2 * r, 2 * r));
  for (const m of collidersNear(world, _box)) {
    const bvh = m.geometry.boundsTree;
    if (!bvh) continue;
    m.updateMatrixWorld();
    _c.copy(center);
    if (!isIdentity(m.matrixWorld)) _c.applyMatrix4(_inv.copy(m.matrixWorld).invert());
    _sph.set(_c, r);
    let hit = false;
    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsSphere(_sph),
      intersectsTriangle: (tri) => { if (tri.closestPointToPoint(_c, _p1).distanceToSquared(_c) < r * r) { hit = true; return true; } return false; },
    });
    if (hit) return true;
  }
  return false;
}

// Sweep a sphere from `from` toward `to`; returns the fraction (0..1) of the way it can travel
// before touching geometry (1 = free). `from` itself is assumed free.
export function sweepSphere(world, from, to, r) {
  const L = from.distanceTo(to);
  if (L < 1e-6) return 1;
  const steps = Math.max(1, Math.ceil(L / (r * 0.5)));
  let lo = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (sphereHits(world, _p2.lerpVectors(from, to, t), r)) {
      let hi = t;
      for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (sphereHits(world, _p2.lerpVectors(from, to, m), r)) hi = m; else lo = m; }
      return lo;
    }
    lo = t;
  }
  return 1;
}

// Push a capsule (segment a-b, radius r; world space, modified in place) out of the world.
// `prev` (optional): the capsule's middle before this step. A triangle the capsule has crossed
// (or is centred on) pushes it back to the side `prev` was on, never on through the surface.
// Calls onContact(normal, surface, depth) for each contact. Returns the number of contacts.
export function resolveCapsule(world, a, b, r, onContact, iterations = 3, prev = null) {
  let contacts = 0;
  _box.makeEmpty(); _box.expandByPoint(a); _box.expandByPoint(b);
  if (prev) _box.expandByPoint(prev);
  _box.expandByScalar(r + 0.02);
  const meshes = collidersNear(world, _box);
  const prevL = new THREE.Vector3();
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const m of meshes) {
      const bvh = m.geometry.boundsTree;
      if (!bvh) continue;
      m.updateMatrixWorld();
      const ident = isIdentity(m.matrixWorld);
      _seg.start.copy(a); _seg.end.copy(b);
      _segL.copy(_seg);
      if (prev) prevL.copy(prev);
      if (!ident) { _inv.copy(m.matrixWorld).invert(); _segL.applyMatrix4(_inv); if (prev) prevL.applyMatrix4(_inv); }
      _lb.makeEmpty(); _lb.expandByPoint(_segL.start); _lb.expandByPoint(_segL.end); _lb.expandByScalar(r);
      let best = null;
      bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_lb),
        intersectsTriangle: (tri, ti) => {
          const d = tri.closestPointToSegment(_segL, _p1, _p2);
          if (d < r && (!best || d < best.d)) best = { d, tp: _p1.clone(), sp: _p2.clone(), ti, n: tri.getNormal(new THREE.Vector3()) };
          return false;
        },
      });
      if (!best) continue;
      const { tp, sp, n: tn } = best;
      const dir = new THREE.Vector3().subVectors(sp, tp);
      let len = dir.length();
      let depth;
      // which side of the triangle's plane were we on before this step?
      const sPrev = prev ? (prevL.x - tp.x) * tn.x + (prevL.y - tp.y) * tn.y + (prevL.z - tp.z) * tn.z : 0;
      const sNow = (sp.x - tp.x) * tn.x + (sp.y - tp.y) * tn.y + (sp.z - tp.z) * tn.z;
      // (only over the triangle's face: near its edges the side can flip legitimately as a body
      // goes round the end of a thin wall)
      const overFace = len < 1e-6 || len - Math.abs(sNow) < 0.002;
      if (prev && Math.abs(sPrev) > 1e-5 && overFace && (len < 1e-6 || Math.sign(sNow) !== Math.sign(sPrev))) {
        // crossed (or sitting on) the surface: back to the side we came from
        dir.copy(tn).multiplyScalar(Math.sign(sPrev));
        depth = r - sNow * Math.sign(sPrev);
      } else {
        if (len < 1e-6) { dir.copy(tn); len = 0; } else dir.divideScalar(len);
        depth = r - len;
      }
      if (!ident) dir.applyMatrix3(_n3.getNormalMatrix(m.matrixWorld)).normalize();
      a.addScaledVector(dir, depth + 1e-4); b.addScaledVector(dir, depth + 1e-4);
      contacts++; moved = true;
      onContact?.(dir.clone(), surfaceOf(m, best.ti), depth);
    }
    if (!moved) break;
  }
  return contacts;
}
