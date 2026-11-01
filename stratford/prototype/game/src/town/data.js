// Loading and normalising town.json + terrain.bin. Every optional field may
// be missing; the rest of the town code reads only what this returns.
import { bbox, pointInPoly, signedArea } from './util.js';

const HERE = new URL('./', import.meta.url);
export const DATA_URL = new URL('../../data/town.json', HERE).href;
export const FIXTURE_URL = new URL('../../test/fixtures/town-mini.json', HERE).href;

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// Loads town.json (or the fixture when the real data is missing) and its terrain.
export async function loadTown(dataUrl) {
  let url = dataUrl || DATA_URL, raw;
  try { raw = await fetchJSON(url); } catch (e) {
    if (dataUrl) throw e;
    url = FIXTURE_URL; raw = await fetchJSON(url);
    console.info('[town] data/town.json not found, using the test fixture');
  }
  const data = normalise(raw);
  data.url = url;
  data.isFixture = url === FIXTURE_URL;
  let terrainBuf = null;
  if (data.terrain && data.terrain.file) {
    try {
      const r = await fetch(new URL(data.terrain.file, url));
      if (r.ok) terrainBuf = await r.arrayBuffer();
    } catch { /* flat ground */ }
  }
  data.height = makeHeightfield(data, terrainBuf);
  return data;
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pts = (a) => (Array.isArray(a) ? a.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) : []);
function ring(a) {
  const p = pts(a);
  if (p.length > 2) { const f = p[0], l = p[p.length - 1]; if (f[0] === l[0] && f[1] === l[1]) p.pop(); }
  return p;
}

export function normalise(raw) {
  const d = {};
  d.version = raw.version || 1;
  d.origin = raw.origin || { lat: 43.369994, lon: -80.982254, elev: 0 };
  d.attribution = raw.attribution || '';
  d.terrain = raw.terrain || null;
  d.buildings = (raw.buildings || []).map((b, i) => {
    const outer = ring(b.outer);
    if (outer.length < 3) return null;
    // our convention: positive signed area in (x, z); the front edge k joins vertex k and k+1
    let front = Array.isArray(b.front) && Number.isInteger(b.front[0]) ? ((b.front[0] % outer.length) + outer.length) % outer.length : -1;
    if (signedArea(outer) < 0) { outer.reverse(); if (front >= 0) front = (outer.length * 2 - 2 - front) % outer.length; }
    const levels = Math.max(1, Math.round(num(b.levels, 0)) || Math.max(1, Math.round(num(b.height, 7) / 3.3)));
    const height = Math.max(2.2, num(b.height, levels * 3.3 + 0.6));
    return {
      id: String(b.id ?? `b${i}`), outer, holes: (b.holes || []).map(ring).filter((h) => h.length > 2),
      base: num(b.base, NaN), height, roofHeight: Math.max(0, num(b.roofHeight, 0)),
      roof: b.roof || (num(b.roofHeight, 0) > 0 ? 'gabled' : 'flat'), levels,
      use: b.use || 'other', material: b.material || null, name: b.name || '', street: b.street || '',
      front,
      colour: b.colour || b.color || null,
    };
  }).filter(Boolean);
  d.roads = (raw.roads || []).map((r, i) => {
    const p = pts(r.points); if (p.length < 2) return null;
    const kind = r.kind || 'residential';
    return { id: String(r.id ?? `r${i}`), kind, name: r.name || '', width: num(r.width, defaultWidth(kind)), points: p,
      bridge: !!r.bridge, tunnel: !!r.tunnel, layer: num(r.layer, 0), oneway: !!r.oneway, lanes: num(r.lanes, 0) };
  }).filter(Boolean);
  d.areas = (raw.areas || []).map((a) => {
    const outer = ring(a.outer); if (outer.length < 3) return null;
    return { kind: a.kind || 'grass', outer, holes: (a.holes || []).map(ring).filter((h) => h.length > 2), name: a.name || '' };
  }).filter(Boolean);
  const w = raw.water || {};
  d.water = {
    level: num(w.level, NaN),
    polygons: (w.polygons || []).map((p) => ({ outer: ring(p.outer), holes: (p.holes || []).map(ring).filter((h) => h.length > 2), level: num(p.level, NaN) })).filter((p) => p.outer.length > 2),
    rivers: (w.rivers || []).map((r) => ({ points: pts(r.points), width: num(r.width, 20) })).filter((r) => r.points.length > 1),
  };
  // water areas given as areas also count
  for (const a of d.areas) if (a.kind === 'water') d.water.polygons.push({ outer: a.outer, holes: a.holes });
  d.trees = (raw.trees || []).map((t) => (Number.isFinite(t.x) && Number.isFinite(t.z)
    ? { x: t.x, z: t.z, height: Math.min(32, Math.max(3, num(t.height, 12))), crown: Math.min(14, Math.max(1.2, num(t.crown, num(t.height, 12) * 0.35))), kind: t.kind || 'maple', generated: false }
    : null)).filter(Boolean);
  d.railways = (raw.railways || []).map((r) => ({ points: pts(r.points) })).filter((r) => r.points.length > 1);
  d.landmarks = (raw.landmarks || []).map((l, i) => (Number.isFinite(l.x) && Number.isFinite(l.z)
    ? { ...l, id: l.id || `landmark-${i}`, name: l.name || l.id || 'Landmark', radius: num(l.radius, 25) } : null)).filter(Boolean);
  // bounds: given, or from everything
  if (raw.bounds && Number.isFinite(raw.bounds.minX)) d.bounds = { ...raw.bounds };
  else {
    const all = [];
    for (const b of d.buildings) all.push(...b.outer);
    for (const r of d.roads) all.push(...r.points);
    const bb = all.length ? bbox(all) : { minX: -500, maxX: 500, minZ: -500, maxZ: 500 };
    d.bounds = bb;
  }
  d.spawn = raw.spawn && Number.isFinite(raw.spawn.x) ? { x: raw.spawn.x, z: raw.spawn.z, yaw: num(raw.spawn.yaw, 0) } : null;
  return d;
}

function defaultWidth(kind) {
  return { primary: 13, secondary: 11, tertiary: 10, unclassified: 8, residential: 8, living_street: 6, service: 4.5,
    footway: 2, path: 1.8, cycleway: 2.2, steps: 2, pedestrian: 6, track: 3 }[kind] || 6;
}

// ---------------------------------------------------------------- heightfield
// Bilinear terrain. The data pipeline carves the river bed under the water
// already; with no terrain file (fixtures) the bed is carved here.
export function makeHeightfield(data, buf) {
  const t = data.terrain, b = data.bounds;
  let nx, nz, cell, x0, z0, h;
  const fromFile = !!(t && buf && t.nx && t.nz && buf.byteLength >= t.nx * t.nz * 2);
  if (fromFile) {
    nx = t.nx; nz = t.nz; cell = t.cell || 4; x0 = t.x0; z0 = t.z0;
    const u = new Uint16Array(buf, 0, nx * nz);
    const base = num(t.minElev, 0) - num(data.origin.elev, 0);
    const scale = num(t.scale, 0.01);
    h = new Float32Array(nx * nz);
    for (let i = 0; i < u.length; i++) h[i] = base + u[i] * scale;
  } else {
    cell = 4; x0 = Math.floor((b.minX - 40) / 4) * 4; z0 = Math.floor((b.minZ - 40) / 4) * 4;
    nx = Math.ceil((b.maxX + 40 - x0) / cell) + 1; nz = Math.ceil((b.maxZ + 40 - z0) / cell) + 1;
    h = new Float32Array(nx * nz);
  }
  const hf = { nx, nz, cell, x0, z0, h, flat: !fromFile };
  const water = data.water;
  // open water: polygons (each with its own level); rivers only when no polygons
  const polys = water.polygons.map((p) => ({ ...p, level: Number.isFinite(p.level) ? p.level : water.level }));
  if (!polys.length) for (const r of water.rivers) polys.push({ outer: riverPolygon(r.points, r.width), holes: [], level: water.level });
  const mask = new Uint8Array(nx * nz);
  for (const p of polys) rasterPoly(p.outer, p.holes, hf, mask);
  if (!Number.isFinite(water.level)) {
    const vals = []; for (let i = 0; i < mask.length; i++) if (mask[i]) vals.push(h[i]);
    vals.sort((p, q) => p - q);
    water.level = vals.length ? vals[Math.floor(vals.length * 0.3)] : -5;
  }
  for (const p of polys) { if (!Number.isFinite(p.level)) p.level = water.level; p.bb = bbox(p.outer); }
  water.all = polys;
  hf.waterMask = mask;
  if (!fromFile) {
    const dist = new Float32Array(nx * nz);
    for (let k = 0; k < dist.length; k++) dist[k] = mask[k] ? 1e9 : 0;
    chamfer(dist, nx, nz);
    for (const p of polys) {
      const m2 = new Uint8Array(nx * nz); rasterPoly(p.outer, p.holes, hf, m2);
      for (let k = 0; k < h.length; k++) if (m2[k]) h[k] = Math.min(h[k], p.level - Math.min(1.8, 0.35 + dist[k] * cell * 0.22));
    }
  }
  hf.at = (x, z) => {
    let fx = (x - x0) / cell, fz = (z - z0) / cell;
    fx = Math.max(0, Math.min(nx - 1.0001, fx)); fz = Math.max(0, Math.min(nz - 1.0001, fz));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nx + i;
    return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + nx] * (1 - u) + h[k + nx + 1] * u) * v;
  };
  hf.node = (i, j) => h[Math.max(0, Math.min(nz - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
  // water surface height at (x, z), or null
  hf.waterAt = (x, z) => {
    for (const p of polys) {
      if (x < p.bb.minX || x > p.bb.maxX || z < p.bb.minZ || z > p.bb.maxZ) continue;
      if (pointInPoly(x, z, p.outer) && !p.holes.some((q) => pointInPoly(x, z, q))) return p.level;
    }
    return null;
  };
  hf.polys = polys;
  return hf;
}

// Even-odd fill of a polygon (with holes) onto the grid nodes.
export function rasterPoly(outer, holes, g, mask, value = 1) {
  const rings = [outer, ...(holes || [])];
  const bb = bbox(outer);
  const j0 = Math.max(0, Math.ceil((bb.minZ - g.z0) / g.cell)), j1 = Math.min(g.nz - 1, Math.floor((bb.maxZ - g.z0) / g.cell));
  for (let j = j0; j <= j1; j++) {
    const z = g.z0 + j * g.cell, xs = [];
    for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const za = r[a][1], zb = r[b][1];
      if ((za > z) !== (zb > z)) xs.push(r[a][0] + ((z - za) / (zb - za)) * (r[b][0] - r[a][0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.x0) / g.cell)), i1 = Math.min(g.nx - 1, Math.floor((xs[k + 1] - g.x0) / g.cell));
      for (let i = i0; i <= i1; i++) mask[j * g.nx + i] = value;
    }
  }
}

function chamfer(d, nx, nz) {
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = d[k]; if (v === 0) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + a);
    if (j > 0) { v = Math.min(v, d[k - nx] + a); if (i > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); }
    d[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = d[k]; if (v === 0) continue;
    if (i < nx - 1) v = Math.min(v, d[k + 1] + a);
    if (j < nz - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0) v = Math.min(v, d[k + nx - 1] + b); }
    d[k] = v;
  }
}

// A river centreline + width as a polygon (simple offset, round-ish ends).
export function riverPolygon(points, width) {
  const L = [], R = [], hw = width / 2;
  for (let i = 0; i < points.length; i++) {
    const p = points[Math.max(0, i - 1)], q = points[Math.min(points.length - 1, i + 1)];
    let dx = q[0] - p[0], dz = q[1] - p[1]; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    L.push([points[i][0] - dz * hw, points[i][1] + dx * hw]); R.push([points[i][0] + dz * hw, points[i][1] - dx * hw]);
  }
  return L.concat(R.reverse());
}

export function insideAny(x, z, polys) {
  for (const p of polys) if (pointInPoly(x, z, p.outer) && !(p.holes || []).some((h) => pointInPoly(x, z, h))) return true;
  return false;
}
