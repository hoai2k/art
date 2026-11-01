// Small shared helpers for the town: a growable geometry builder, polygon
// maths, a segment grid for nearest-road queries, a seeded hash.
import * as THREE from 'three';

// ---------------------------------------------------------------- hashing
export function hash1(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export function hash2(x, z) { return hash1((Math.floor(x * 7.31) * 73856093) ^ (Math.floor(z * 5.17) * 19349663)); }
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
// Deterministic PRNG.
export function rng(seed) {
  let s = (Math.floor(seed * 4294967296) >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- polygons
export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
export function centroid(pts) {
  let cx = 0, cz = 0, a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cz += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; }
    return [x / pts.length, z / pts.length];
  }
  return [cx / (3 * a), cz / (3 * a)];
}
export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function bbox(pts) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1];
  }
  return { minX, minZ, maxX, maxZ };
}
// Minimum-area oriented rectangle (rotating calipers over hull edges).
export function obb(pts) {
  const hull = convexHull(pts);
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    let dx = q[0] - p[0], dz = q[1] - p[1];
    const L = Math.hypot(dx, dz); if (L < 1e-6) continue;
    dx /= L; dz /= L;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const r of hull) {
      const a = r[0] * dx + r[1] * dz, b = -r[0] * dz + r[1] * dx;
      if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b;
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, dx, dz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  const { dx, dz, a0, a1, b0, b1 } = best;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  return {
    cx: ca * dx - cb * dz, cz: ca * dz + cb * dx,
    ux: dx, uz: dz,               // long-ish axis direction (axis a)
    hu: (a1 - a0) / 2, hv: (b1 - b0) / 2, area: best.area,
  };
}
export function convexHull(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
export function polyArea(pts) { return Math.abs(signedArea(pts)); }

// Distance from point to segment, and the parameter t.
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qz = az + t * dz;
  return { d: Math.hypot(px - qx, pz - qz), t, qx, qz };
}

// Douglas-Peucker on an open polyline of [x,z] (keeps endpoints).
export function simplify(pts, tol, keep) {
  if (pts.length <= 2) return pts.slice();
  const mark = new Uint8Array(pts.length); mark[0] = mark[pts.length - 1] = 1;
  if (keep) for (let i = 0; i < pts.length; i++) if (keep(i)) mark[i] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { mark[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  // keep forced points but still split around them
  const out = [];
  for (let i = 0; i < pts.length; i++) if (mark[i]) out.push(pts[i]);
  return out;
}

// Resample a polyline so no segment is longer than maxLen.
export function densify(pts, maxLen, closed = false) {
  const out = [];
  const n = pts.length, m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.ceil(L / maxLen));
    for (let j = 0; j < k; j++) { const t = j / k; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ...(a.length > 2 ? a.slice(2) : [])]); }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export function polylineLength(pts) {
  let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Walk along a polyline at a fixed step, calling fn(x, z, dirX, dirZ, s).
export function walk(pts, step, fn, start = step / 2) {
  let s = 0, next = start;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    while (next <= s + L) { const t = next - s; fn(a[0] + dx * t, a[1] + dz * t, dx, dz, next); next += step; }
    s += L;
  }
}

// ---------------------------------------------------------------- spatial grid of segments
export class SegGrid {
  constructor(cell = 25) { this.cell = cell; this.map = new Map(); this.segs = []; }
  key(i, j) { return i * 100003 + j; }
  add(ax, az, bx, bz, data) {
    const s = { ax, az, bx, bz, data }; const id = this.segs.push(s) - 1;
    const c = this.cell;
    const i0 = Math.floor(Math.min(ax, bx) / c), i1 = Math.floor(Math.max(ax, bx) / c);
    const j0 = Math.floor(Math.min(az, bz) / c), j1 = Math.floor(Math.max(az, bz) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(id);
    }
  }
  // Nearest segment within r; filter(data) optional.
  nearest(x, z, r, filter) {
    const c = this.cell, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    let best = null, bestD = r; const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.map.get(this.key(i, j)); if (!a) continue;
      for (const id of a) {
        if (seen.has(id)) continue; seen.add(id);
        const s = this.segs[id]; if (filter && !filter(s.data)) continue;
        const q = segDist(x, z, s.ax, s.az, s.bx, s.bz);
        if (q.d < bestD) { bestD = q.d; best = { seg: s, d: q.d, t: q.t, qx: q.qx, qz: q.qz }; }
      }
    }
    return best;
  }
  query(x, z, r, fn) {
    const c = this.cell, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    const seen = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.map.get(this.key(i, j)); if (!a) continue;
      for (const id of a) { if (seen.has(id)) continue; seen.add(id); fn(this.segs[id]); }
    }
  }
}

// Point grid (for "is there something near here").
export class PointGrid {
  constructor(cell = 10) { this.cell = cell; this.map = new Map(); }
  add(x, z, data) {
    const k = Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell);
    let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push({ x, z, data });
  }
  any(x, z, r, filter) {
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const a = this.map.get(i * 100003 + j); if (!a) continue;
        for (const p of a) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r && (!filter || filter(p.data))) return p;
      }
    return null;
  }
}

// ---------------------------------------------------------------- geometry builder
// Vertex attributes: position, normal, uv + named extra attributes taken from
// the builder's current state (set(name, values)).
export class Builder {
  constructor(extra = {}) {
    this.pos = []; this.nor = []; this.uv = []; this.idx = [];
    this.extra = extra; this.ex = {}; this.state = {};
    for (const k in extra) { this.ex[k] = []; this.state[k] = new Array(extra[k]).fill(0); }
    this.n = 0;
  }
  set(name, v) { this.state[name] = v; return this; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, w);
    for (const k in this.extra) { const s = this.state[k]; const a = this.ex[k]; for (let i = 0; i < s.length; i++) a.push(s[i]); }
    return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // a triangle / quad wound so its front faces `want` (a direction)
  triFacing(a, b, c, want) {
    const P = this.pos, A = a * 3, B = b * 3, C = c * 3;
    const ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[C] - P[A], vy = P[C + 1] - P[A + 1], vz = P[C + 2] - P[A + 2];
    const d = (uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2];
    if (d >= 0) this.tri(a, b, c); else this.tri(a, c, b);
  }
  quadFacing(a, b, c, d, want) { this.triFacing(a, b, c, want); this.triFacing(a, c, d, want); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  get triangles() { return this.idx.length / 3; }
  // Flat quad from 4 corners (CCW seen from the side the normal points to).
  quad4(p0, p1, p2, p3, uv) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    uv = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const a = this.v(p0[0], p0[1], p0[2], nx, ny, nz, uv[0][0], uv[0][1]);
    const b = this.v(p1[0], p1[1], p1[2], nx, ny, nz, uv[1][0], uv[1][1]);
    const c = this.v(p2[0], p2[1], p2[2], nx, ny, nz, uv[2][0], uv[2][1]);
    const d = this.v(p3[0], p3[1], p3[2], nx, ny, nz, uv[3][0], uv[3][1]);
    this.quad(a, b, c, d);
  }
  // Axis-aligned-in-local-frame box: centre, half sizes, rotation about Y.
  box(cx, cy, cz, hx, hy, hz, yaw = 0, faces = 0b111111) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const C = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const F = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]]; // +z,-z,+x,-x,+y,-y
    for (let f = 0; f < 6; f++) if (faces & (1 << f)) { const q = F[f]; this.quad4(C[q[0]], C[q[1]], C[q[2]], C[q[3]]); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    for (const k in this.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(this.ex[k], this.extra[k]));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Collider soup: world-space triangles with a surface id each.
export class ColliderBuilder {
  constructor() { this.pos = []; this.surf = []; }
  get triangles() { return this.surf.length / 3; }
  tri(a, b, c, s) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.surf.push(s, s, s);
  }
  quad(a, b, c, d, s) { this.tri(a, b, c, s); this.tri(a, c, d, s); }
  // Oriented box (yaw about Y), all six faces, outward winding.
  box(cx, cy, cz, hx, hy, hz, yaw, s, faces = 0b111111) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * c + z * sn, cy + y, cz - x * sn + z * c];
    const C = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const F = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]];
    for (let f = 0; f < 6; f++) if (faces & (1 << f)) { const q = F[f]; this.quad(C[q[0]], C[q[1]], C[q[2]], C[q[3]], s); }
  }
  // Vertical prism (n sides) between y0 and y1, radius r0 at bottom, r1 at top.
  prism(x, y0, z, r0, y1, r1, n, s, tilt = null) {
    const top = tilt || [x, y1, z];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0], p1 = [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0];
      const q0 = [top[0] + Math.cos(a0) * r1, top[1], top[2] + Math.sin(a0) * r1], q1 = [top[0] + Math.cos(a1) * r1, top[1], top[2] + Math.sin(a1) * r1];
      this.quad(p0, q0, q1, p1, s);
    }
  }
}

// GLSL value noise / fbm shared by the painted materials.
export const GLSL_NOISE = /* glsl */`
float th(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float th1(float n){ return fract(sin(n) * 43758.5453); }
float tnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1.0, 0.0)), u.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), u.x), u.y); }
float tfbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * tnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// fade a high-frequency pattern out as it gets smaller than a pixel
float aafade(float scale, float px){ return clamp(1.0 - px * scale * 1.5, 0.0, 1.0); }
`;

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material; if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      for (const k in mm) if (mm[k] && mm[k].isTexture) mm[k].dispose();
      mm.dispose();
    }
  });
}
