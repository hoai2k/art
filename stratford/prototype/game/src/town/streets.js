// Streets at small-creature scale: the carriageway sits a curb's height below
// the sidewalks, boulevards and corners around it. Road coverage is drawn into
// a small canvas per chunk (stroked with round joins, softened so street
// corners get a curb radius), traced with marching squares and triangulated:
// asphalt below, raised sidewalk plates with real vertical curbs above.
// Footways, service lanes, markings, crosswalks and bridges are built here too.
import * as THREE from 'three';
import { paintLots } from './lots.js';
import { SURFACE } from '../surface.js';
import { contourLoops, cleanLoop, polygons } from './contour.js';
import { SegGrid, PointGrid, walk, polylineLength, hash2, hashStr } from './util.js';
import { STREET } from './materials.js';

export const CURBED = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'trunk', 'primary_link', 'secondary_link', 'tertiary_link']);
const RIBBON = { footway: STREET.footway, pedestrian: STREET.footway, steps: STREET.footway, cycleway: STREET.footway, path: STREET.path, track: STREET.path, bridleway: STREET.path, service: STREET.service };

// ---------------------------------------------------------------- preparation (whole town, once)
export function prepareStreets(ctx) {
  const { data, hf } = ctx;
  const curb = ctx.curb;                         // curb height (m)
  // commercial frontage, to tell downtown streets from residential ones
  const shops = new PointGrid(20);
  for (const b of data.buildings) {
    if (b.use !== 'commercial' && b.use !== 'civic' && b.use !== 'theatre') continue;
    const o = b.outer;
    for (let i = 0; i < o.length; i++) {
      const a = o[i], c = o[(i + 1) % o.length];
      walk([a, c], 4, (x, z) => shops.add(x, z, b), 0);
    }
  }
  const roads = [];
  const grid = new SegGrid(30);
  const ch = data.landmarks.find((l) => l.id === 'city-hall'), centre = ch ? [ch.x, ch.z] : null;
  for (const r of data.roads) {
    if (!CURBED.has(r.kind) || r.tunnel) continue;
    const hw = r.width / 2;
    let n = 0, hit = 0;
    walk(r.points, 8, (x, z) => { n++; if (shops.any(x, z, hw + 13)) hit++; });
    // downtown: mostly shopfronts, or (near the centre, where the street photos show paving
    // to the curb) a fair share of them
    let cd = Infinity; if (centre) walk(r.points, 8, (x, z) => { cd = Math.min(cd, Math.hypot(x - centre[0], z - centre[1])); });
    const downtown = n > 0 && (hit / n > 0.4 || (hit / n > 0.15 && cd < 420));
    const major = r.kind === 'primary' || r.kind === 'secondary' || r.kind === 'trunk';
    const s = {
      road: r, hw, downtown, id: roads.length,
      band: downtown ? 4.4 : major ? 4.6 : 4.0,             // curb to the back of the sidewalk
      blv: downtown ? -1.3 : major ? 2.4 : 2.1,             // grass boulevard by the curb (< 0: a paved strip downtown)
      len: polylineLength(r.points),
    };
    roads.push(s);
    for (let i = 1; i < r.points.length; i++) { const a = r.points[i - 1], b = r.points[i]; grid.add(a[0], a[1], b[0], b[1], s); }
  }
  // bridges: decks follow a straight line between the bank heights
  const bridges = [], bgrid = new SegGrid(30);
  for (const r of data.roads) {
    if (!r.bridge) continue;
    const st = roads.find((s) => s.road === r);
    const half = r.width / 2 + (st ? st.band : 0.2) + 0.4;
    const L = polylineLength(r.points); if (L < 2) continue;
    const p0 = r.points[0], p1 = r.points[r.points.length - 1];
    let h0 = hf.at(p0[0], p0[1]), h1 = hf.at(p1[0], p1[1]);
    let wl = -Infinity;
    walk(r.points, 2, (x, z) => { const w = hf.waterAt(x, z); if (w !== null) wl = Math.max(wl, w); });
    const b = { road: r, half, L, h0, h1, wl, curbed: !!st, style: st };
    bridges.push(b);
  }
  // a footbridge mapped alongside a road bridge (its sidewalk) is part of that bridge
  for (const b of bridges) {
    if (b.curbed) continue;
    const P = b.road.points, m = P[Math.floor(P.length / 2)], m0 = P[0], m1 = P[P.length - 1];
    const mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2];
    for (const o of bridges) {
      if (!o.curbed) continue;
      const Q = o.road.points;
      let d = Infinity;
      for (let i = 1; i < Q.length; i++) for (const p of [mid, m]) {
        const ax = Q[i - 1][0], az = Q[i - 1][1], bx = Q[i][0], bz = Q[i][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / l2)) : 0;
        d = Math.min(d, Math.hypot(p[0] - ax - dx * t, p[1] - az - dz * t));
      }
      if (d < o.half + 1) b.alongside = true;
    }
  }
  for (const b of bridges) {
    if (b.alongside) continue;
    const r = b.road, L = b.L;
    let s = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], c = r.points[i]; const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      bgrid.add(a[0], a[1], c[0], c[1], { b, s0: s, s1: s + l });
      s += l;
    }
  }
  // the deck starts and ends at the bank heights and rises (to clear the water) in between
  const deckAt = (b, s) => {
    const t = Math.min(1, Math.max(0, s / b.L));
    const lift = Math.max(Math.min(0.8, b.L / 40), Number.isFinite(b.wl) ? b.wl + 1.2 - Math.min(b.h0, b.h1) : 0);
    return b.h0 + (b.h1 - b.h0) * t + lift * Math.sin(Math.PI * t);
  };
  // drape height: terrain, or a bridge deck
  const H = (x, z) => {
    const q = bgrid.nearest(x, z, 14);
    if (q && q.d <= q.seg.data.b.half) {
      const { b, s0, s1 } = q.seg.data, s = s0 + (s1 - s0) * q.t;
      // only beside the deck, not beyond its ends
      if (s > 0.01 && s < b.L - 0.01) return Math.max(deckAt(b, s), hf.at(x, z));
    }
    return hf.at(x, z);
  };
  // junctions (shared nodes of curbed roads)
  const nodes = new Map();
  const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
  for (const s of roads) {
    const P = s.road.points;
    P.forEach((p, i) => {
      const k = key(p); let e = nodes.get(k); if (!e) nodes.set(k, e = { p, arms: [] });
      if (i > 0) e.arms.push({ s, i, dir: -1 });
      if (i < P.length - 1) e.arms.push({ s, i, dir: 1 });
    });
  }
  const junctions = [...nodes.values()].filter((n) => n.arms.length >= 3);
  const jgrid = new PointGrid(30);
  for (const j of junctions) {
    j.r = Math.max(...j.arms.map((a) => a.s.hw)) + 1.5;
    jgrid.add(j.p[0], j.p[1], j);
  }
  ctx.streets = { roads, grid, bridges, bgrid, H, deckAt, junctions, jgrid };
  ctx.H = H;
  ctx.markings = buildMarkings(ctx);
  return ctx.streets;
}

// Lane markings and crosswalks as a flat list of quads (world space).
function buildMarkings(ctx) {
  const { data } = ctx;
  const { roads, junctions, jgrid, grid } = ctx.streets;
  const list = [];
  const quad = (cx, cz, dx, dz, hl, hw, kind) => list.push({ cx, cz, dx, dz, hl, hw, kind });
  const zebras = ctx.crosswalks = [];             // (centre, road direction, half width) for the tactile pads
  // OSM crossings: footways that cross a carriageway become zebra crosswalks
  const crossings = new PointGrid(20);
  for (const r of data.roads) {
    if (r.kind !== 'footway' && r.kind !== 'path' && r.kind !== 'cycleway') continue;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const q = grid.nearest(mx, mz, 12);
      if (!q || q.d > q.seg.data.hw - 0.5) continue;
      // direction of the road there
      let rx = q.seg.bx - q.seg.ax, rz = q.seg.bz - q.seg.az; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
      const cos = Math.abs(((b[0] - a[0]) * rx + (b[1] - a[1]) * rz) / L);
      if (cos > 0.6) continue; // runs along the road, not across
      if (crossings.any(q.qx, q.qz, 4)) { r.crossing = true; continue; }   // one zebra per crossing (a crossing is often several footway pieces)
      zebra(q.qx, q.qz, rx, rz, q.seg.data.hw, 3.0);
      crossings.add(q.qx, q.qz, true);
      r.crossing = true;
    }
  }
  function zebra(cx, cz, rx, rz, hw, depth) {
    zebras.push({ x: cx, z: cz, rx, rz, hw });
    // bars parallel to traffic, spread across the carriageway
    const nx = -rz, nz = rx;
    for (let o = -hw + 0.7; o <= hw - 0.5; o += 1.1) quad(cx + nx * o, cz + nz * o, rx, rz, depth / 2, 0.28, STREET.white);
  }
  // crosswalks at downtown and main-road junctions with no mapped crossing
  for (const j of junctions) {
    const main = j.arms.some((a) => a.s.downtown || a.s.road.kind === 'primary' || a.s.road.kind === 'secondary');
    if (!main) continue;
    for (const a of j.arms) {
      const P = a.s.road.points, q = P[a.i + a.dir];
      let dx = q[0] - j.p[0], dz = q[1] - j.p[1]; const L = Math.hypot(dx, dz); if (L < 1) continue; dx /= L; dz /= L;
      const others = Math.max(...j.arms.filter((b) => b.s !== a.s).map((b) => b.s.hw), 4);
      const d = others + 2.6;
      if (L < d + 2) continue;
      const cx = j.p[0] + dx * d, cz = j.p[1] + dz * d;
      if (crossings.any(cx, cz, 12)) continue;
      zebra(cx, cz, dx, dz, a.s.hw, 3.0);
      crossings.add(cx, cz, true);
      // stop bar on the approaching lane (right-hand traffic)
      const nx = -dz, nz = dx; // left of outward direction = right of incoming
      quad(cx + dx * 2.6 + nx * a.s.hw * 0.5, cz + dz * 2.6 + nz * a.s.hw * 0.5, nx, nz, a.s.hw * 0.5 - 0.3, 0.22, STREET.white);
    }
  }
  // centre lines
  for (const s of roads) {
    const k = s.road.kind;
    if (!(k === 'primary' || k === 'secondary' || k === 'tertiary' || k === 'trunk') || s.road.width < 8.5) continue;
    const dbl = k === 'primary' || k === 'trunk';
    const step = dbl ? 2 : 1;
    let idx = 0;
    walk(s.road.points, step, (x, z, dx, dz) => {
      idx++;
      const j = jgrid.any(x, z, 30, (J) => Math.hypot(J.p[0] - x, J.p[1] - z) < J.r + 3.5);
      if (j) return;
      if (crossings.any(x, z, 3)) return;             // no paint over paint (a centre line through a zebra)
      if (dbl) { const nx = -dz, nz = dx; quad(x + nx * 0.1, z + nz * 0.1, dx, dz, 1.0, 0.055, STREET.yellow); quad(x - nx * 0.1, z - nz * 0.1, dx, dz, 1.0, 0.055, STREET.yellow); }
      else if (idx % 9 < 3) quad(x, z, dx, dz, 0.5, 0.06, STREET.yellow);
    });
  }
  return list;
}

// ---------------------------------------------------------------- ground map (whole town, once)
// Two RGB canvases over the terrain: A = asphalt / concrete / gravel,
// B = leaf litter / lush park grass / dirt. The terrain shader blends painted
// layers by them; the CPU keeps nothing but the textures.
export function buildGroundMap(ctx, mPerPx) {
  const { data, hf, streets } = ctx;
  const x0 = hf.x0, z0 = hf.z0, W = (hf.nx - 1) * hf.cell, D = (hf.nz - 1) * hf.cell;
  const w = Math.round(W / mPerPx), h = Math.round(D / mPerPx);
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.setTransform(w / W, 0, 0, h / D, -x0 * w / W, -z0 * h / D); g.lineCap = 'round'; g.lineJoin = 'round'; return [c, g]; };
  const [ca, A] = mk(), [cb, B] = mk();
  const poly = (g, rings) => { g.beginPath(); for (const r of rings) { r.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); } g.fill('evenodd'); };
  const line = (g, pts, width) => { g.lineWidth = width; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
  A.globalCompositeOperation = 'lighten'; B.globalCompositeOperation = 'lighten';
  // concrete: sidewalk bands, plazas, footways
  A.strokeStyle = A.fillStyle = 'rgb(0,255,0)';
  // (bands and ribbons a little narrower than their slabs: the edge of the paint lies hidden
  // under the slab, not on the lawn beside it where it would be a second edge to walk across)
  for (const s of streets.roads) line(A, s.road.points, s.road.width + 2 * s.band - 1.2);
  for (const a of data.areas) if (a.kind === 'plaza') poly(A, [a.outer, ...a.holes]);
  for (const r of data.roads) if (r.kind === 'footway' || r.kind === 'pedestrian' || r.kind === 'steps') line(A, r.points, Math.max(0.4, r.width - 0.6));
  // boulevards back to grass
  A.globalCompositeOperation = 'multiply'; A.strokeStyle = 'rgb(255,0,255)';
  for (const s of streets.roads) if (s.blv > 0) line(A, s.road.points, s.road.width + 2 * s.blv);
  A.globalCompositeOperation = 'lighten';
  // gravel: paths, rail beds
  A.strokeStyle = A.fillStyle = 'rgb(0,0,255)';
  for (const r of data.roads) if (r.kind === 'path' || r.kind === 'track' || r.kind === 'bridleway') line(A, r.points, Math.max(0.4, r.width - 0.6));
  for (const r of data.railways) line(A, r.points, 3.2);
  for (const a of data.areas) if (a.kind === 'railway') poly(A, [a.outer, ...a.holes]);
  // asphalt
  A.strokeStyle = A.fillStyle = 'rgb(255,0,0)';
  for (const a of data.areas) if (a.kind === 'parking') poly(A, [a.outer, ...a.holes]);
  for (const r of data.roads) if (r.kind === 'service' || CURBED.has(r.kind)) line(A, r.points, Math.max(0.4, r.width - 0.6));
  // house lots: driveways, front walks and garden beds (lots.js)
  paintLots(ctx, A, B);
  A.globalCompositeOperation = 'lighten';
  // B: lush grass in parks; leaf litter under trees and in woods; dirt on pitches' infields
  B.fillStyle = 'rgb(0,255,0)';
  for (const a of data.areas) if (a.kind === 'park' || a.kind === 'garden' || a.kind === 'pitch' || a.kind === 'cemetery' || a.kind === 'grass') poly(B, [a.outer, ...a.holes]);
  B.fillStyle = 'rgb(255,0,0)';
  for (const a of data.areas) if (a.kind === 'wood') poly(B, [a.outer, ...a.holes]);
  for (const t of ctx.trees) {
    const r = t.crown * 0.95;
    const gr = B.createRadialGradient(t.x, t.z, r * 0.15, t.x, t.z, r);
    gr.addColorStop(0, 'rgba(255,0,0,0.95)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
    B.fillStyle = gr; B.beginPath(); B.arc(t.x, t.z, r, 0, Math.PI * 2); B.fill();
  }
  // flipY off: row 0 of the canvas is z0, as the shader's uv (and classMap) read it
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { texA: tex(ca), texB: tex(cb), rect: new THREE.Vector4(x0, z0, 1 / W, 1 / D), canvases: [ca, cb] };
}

// ---------------------------------------------------------------- per chunk
const R = 0.5;            // raster resolution (m)
// how far the terrain is sunk under carriageways and sidewalk bands (index.js uses these)
export const ROAD_SINK = 0.25, BAND_SINK = 0.08;
const ROAD_Y = 0.035;     // carriageway above the (sunken) terrain: a clear step, no depth fighting at its edges
const MARK_Y = 0.004;     // paint above the carriageway (drawn with a stronger depth offset)
const MARGIN = 16;        // px around the chunk so blur and strokes see their neighbours
let _canvas = null, _canvas2 = null;

// Builds a chunk's streets into vb (visual Builder with aSt/aDir) and cb
// (ColliderBuilder). ox, oz: the chunk origin (vertices are stored relative to
// it). Generator: yields between the heavy steps for time slicing.
export function* buildChunkStreets(ctx, chunk, vb, cb, mb = vb) {
  const { streets, curb } = ctx;
  const { x0, z0, size } = chunk;
  const ox = chunk.ox, oz = chunk.oz;
  const H = ctx.H;
  const N = Math.round(size / R) + 1, C = N + MARGIN * 2;
  // roads that touch this chunk (with their band)
  const near = new Set();
  streets.grid.query(x0 + size / 2, z0 + size / 2, size * 0.75 + 12, (s) => near.add(s.data));
  if (near.size) {
    if (!_canvas) { _canvas = document.createElement('canvas'); _canvas2 = document.createElement('canvas'); }
    _canvas.width = _canvas.height = C; _canvas2.width = _canvas2.height = C;
    const g = _canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, C, C);
    g.setTransform(1 / R, 0, 0, 1 / R, MARGIN + 0.5 - x0 / R, MARGIN + 0.5 - z0 / R);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'lighten';
    const stroke = (pts, width, style) => { g.strokeStyle = style; g.lineWidth = width; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
    for (const s of near) stroke(s.road.points, s.road.width + 2 * s.band, 'rgb(0,255,0)');
    for (const s of near) stroke(s.road.points, s.road.width, 'rgb(255,0,0)');
    const g2 = _canvas2.getContext('2d', { willReadFrequently: true });
    g2.filter = `blur(${(1.4 / R).toFixed(2)}px)`;
    g2.globalCompositeOperation = 'copy';
    g2.drawImage(_canvas, 0, 0);
    g2.filter = 'none';
    const px = g2.getImageData(MARGIN, MARGIN, N, N).data;
    yield;
    const road = new Float32Array(N * N), side = new Float32Array(N * N);
    for (let i = 0, k = 0; i < N * N; i++, k += 4) {
      const r = px[k] / 255, b = px[k + 1] / 255;
      road[i] = r; side[i] = Math.min(b, 1 - r);
    }
    const sample = (f, x, z) => {
      let fx = (x - x0) / R, fz = (z - z0) / R;
      fx = Math.max(0, Math.min(N - 1.001, fx)); fz = Math.max(0, Math.min(N - 1.001, fz));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
      return (f[k] * (1 - u) + f[k + 1] * u) * (1 - v) + (f[k + N] * (1 - u) + f[k + N + 1] * u) * v;
    };
    // distance (m) from each carriageway pixel to the curb: the traced road's own edge, so the
    // gutter follows a corner's curb return instead of the two streets' straight edges (chamfer
    // transform; outside the raster counts as more road, so a chunk's border is never a curb)
    const edt = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) edt[i] = road[i] >= 0.5 ? 1e6 : 0;
    { const a = R, b2 = R * Math.SQRT2;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; let v = edt[k]; if (!v) continue;
        if (i > 0) v = Math.min(v, edt[k - 1] + a); if (j > 0) { v = Math.min(v, edt[k - N] + a); if (i > 0) v = Math.min(v, edt[k - N - 1] + b2); if (i < N - 1) v = Math.min(v, edt[k - N + 1] + b2); } edt[k] = v; }
      for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) { const k = j * N + i; let v = edt[k]; if (!v) continue;
        if (i < N - 1) v = Math.min(v, edt[k + 1] + a); if (j < N - 1) { v = Math.min(v, edt[k + N] + a); if (i < N - 1) v = Math.min(v, edt[k + N + 1] + b2); if (i > 0) v = Math.min(v, edt[k + N - 1] + b2); } edt[k] = v; } }
    // nearest curbed road: distance from the curb and the street's direction
    const info = (x, z) => {
      const q = streets.grid.nearest(x, z, 40);
      if (!q) return { d: 9, din: 9, blv: 0, band: 0, dx: 1, dz: 0 };
      const s = q.seg.data; let dx = q.seg.bx - q.seg.ax, dz = q.seg.bz - q.seg.az; const l = Math.hypot(dx, dz) || 1;
      return { d: Math.max(0, q.d - s.hw), din: Math.max(0, s.hw - q.d), blv: s.blv, band: s.band, dx: dx / l, dz: dz / l };
    };
    // for a carriageway vertex: the distance in from the curb, and the curb's direction near it
    const roadInfo = (x, z) => {
      const i = info(x, z);
      const e = sample(edt, x, z);
      if (e < 1e5 && e < i.din + 0.6) {
        // half a pixel of the traced edge: the curb line lies there, not at the pixel centre
        i.din = Math.max(0, Math.min(i.din, e - R * 0.5));
        if (e < 3) {
          const gx = sample(edt, x + R, z) - sample(edt, x - R, z), gz = sample(edt, x, z + R) - sample(edt, x, z - R), gl = Math.hypot(gx, gz);
          if (gl > 1e-3 && gl < 1e5) { const tx = -gz / gl, tz = gx / gl, sg = tx * i.dx + tz * i.dz < 0 ? -1 : 1; i.dx = tx * sg; i.dz = tz * sg; }
        }
      }
      return i;
    };
    // carriageway, traced and triangulated in 4 m tiles so its surface follows the ground
    // (one outline per chunk gives long triangles whose flat faces dip into crowned roads)
    const TS = 8, sub = new Float32Array((TS + 1) * (TS + 1));
    for (let ty = 0; ty * TS < N - 1; ty++) {
      for (let tx = 0; tx * TS < N - 1; tx++) {
        let mx = 0;
        for (let j = 0; j <= TS; j++) for (let i = 0; i <= TS; i++) { const v = road[Math.min(N - 1, ty * TS + j) * N + Math.min(N - 1, tx * TS + i)]; sub[j * (TS + 1) + i] = v; if (v > mx) mx = v; }
        if (mx < 0.5) continue;
        const tl = contourLoops(sub, TS + 1, x0 + tx * TS * R, z0 + ty * TS * R, R).map((l) => cleanLoop(l, 0.03, 2)).filter(Boolean);
        for (const P of polygons(tl)) {
          const ry = new Map();
          triangulate(P, (pts) => pts.map((p) => {
            const i = roadInfo(p[0], p[1]);
            const y = H(p[0], p[1]) + ROAD_Y; ry.set(p, y);
            vb.set('aSt', [STREET.road, i.din, 1, 0]).set('aDir', [i.dx, i.dz]);      // distance in from the curb (the gutter)
            return vb.v(p[0] - ox, y, p[1] - oz, 0, 1, 0);
          }), vb, (a, b, c) => cb.tri([a[0] - ox, ry.get(a), a[1] - oz], [b[0] - ox, ry.get(b), b[1] - oz], [c[0] - ox, ry.get(c), c[1] - oz], SURFACE.road));
        }
      }
      if (ty % 10 === 9) yield;
    }
    yield;
    // sidewalks + boulevards, and the curbs along their road side
    const sideLoops = contourLoops(side, N, x0, z0, R).map((l) => cleanLoop(l, 0.04, 2.5)).filter(Boolean);
    for (const P of polygons(sideLoops)) {
      const rings = [P.outer, ...P.holes];
      const meta = new Map();
      for (const ring of rings) for (const p of ring) {
        const isCurb = sample(road, p[0], p[1]) > 0.22;
        const i = info(p[0], p[1]);
        // no grass boulevards on bridge decks
        const bq = streets.bgrid.nearest(p[0], p[1], 14);
        if (bq && bq.d <= bq.seg.data.b.half + 0.5) i.blv = 0;
        const y = isCurb ? H(p[0], p[1]) + curb : Math.max(H(p[0], p[1]), terrainTri(ctx.hf, p[0], p[1])) + 0.04;
        meta.set(p, { isCurb, y, d: isCurb ? 0 : Math.max(i.d, 0.3), i });
      }
      // Each triangle is cut where the boulevard's grass starts and ends (d = 0.2 and d = blv,
      // d interpolating linearly), so every drawn piece is all grass or all paving and its
      // collider triangle carries the same surface (the shader decides grass by the same rule).
      for (const [a, b, c] of upTriangles(P)) {
        const ma = meta.get(a), mb = meta.get(b), mc = meta.get(c), blv = mc.i.blv, band = mc.i.band;
        const V = [[a[0], ma.y, a[1], ma.d], [b[0], mb.y, b[1], mb.d], [c[0], mc.y, c[1], mc.d]];
        const cuts = blv > 0.05 ? [0.2, blv] : [];
        for (const piece of slicePoly(V, cuts)) {
          const dm = piece.reduce((t, q) => t + q[3], 0) / piece.length;
          const surf = blv > 0.05 && dm > 0.2 && dm < blv ? SURFACE.grass : SURFACE.sidewalk;
          vb.set('aSt', [STREET.plate, 0, blv, band]).set('aDir', [mc.i.dx, mc.i.dz]);
          const ids = piece.map((q) => { vb.state.aSt = [STREET.plate, q[3], blv, band]; return vb.v(q[0] - ox, q[1], q[2] - oz, 0, 1, 0); });
          for (let k = 1; k + 1 < piece.length; k++) {
            vb.tri(ids[0], ids[k], ids[k + 1]);
            cb.tri([piece[0][0] - ox, piece[0][1], piece[0][2] - oz], [piece[k][0] - ox, piece[k][1], piece[k][2] - oz], [piece[k + 1][0] - ox, piece[k + 1][1], piece[k + 1][2] - oz], surf);
          }
        }
      }
      // the slab's edges, all closed down to below the (sunken) terrain so nothing can get
      // under a sidewalk: curb faces on the road side, skirts on the outer side (inside is
      // on the left of each loop edge, the outside on the right); none along the chunk edge
      for (const ring of rings) {
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k], b = ring[(k + 1) % ring.length];
          if (a[2] && b[2]) continue;
          const ma = meta.get(a), mb = meta.get(b);
          let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz); if (l < 1e-4) continue; nx /= l; nz /= l;
          const isCurb = ma.isCurb && mb.isCurb;
          // down below the (sunken) ground, which beside a slab draped up to a bridge deck can be well below it
          const bot = (p) => { const h = H(p[0], p[1]), g = ctx.hf.at(p[0], p[1]), d = h - (isCurb ? ROAD_SINK + 0.05 : BAND_SINK + 0.25);
            return ctx.hf.waterAt(p[0], p[1]) !== null ? d : Math.max(h - 2.5, Math.min(d, g - ROAD_SINK - 0.05)); };
          const ya = bot(a), yb = bot(b);
          // aSt.y: the top of the face at this end (the curb texture hangs from it)
          vb.set('aSt', [STREET.curb, ma.y, 0, 0]).set('aDir', [-nz, nx]);
          const i0 = vb.v(a[0] - ox, ya, a[1] - oz, nx, 0, nz), i3 = vb.v(a[0] - ox, ma.y, a[1] - oz, nx, 0, nz);
          vb.set('aSt', [STREET.curb, mb.y, 0, 0]);
          const i1 = vb.v(b[0] - ox, yb, b[1] - oz, nx, 0, nz), i2 = vb.v(b[0] - ox, mb.y, b[1] - oz, nx, 0, nz);
          vb.quad(i1, i0, i3, i2);
          cb.quad([b[0] - ox, yb, b[1] - oz], [a[0] - ox, ya, a[1] - oz], [a[0] - ox, ma.y, a[1] - oz], [b[0] - ox, mb.y, b[1] - oz], isCurb ? SURFACE.sidewalk : SURFACE.ground);   // faces out
        }
      }
    }
    yield;
  }
  const inCarriageway = (x, z) => { const q = streets.grid.nearest(x, z, 20); return !!q && q.d < q.seg.data.hw - 0.4 && !streets.bgrid.nearest(x, z, 2); };
  // ribbons: footways, paths, service lanes (segments whose midpoint is in the chunk)
  for (const r of ctx.ribbonsIn(chunk)) {
    const kind = RIBBON[r.road.kind];
    // each kind a clear step above the terrain and each other (no depth fighting), all in the collider
    const y0 = kind === STREET.service ? 0.05 : kind === STREET.path ? 0.06 : 0.07;
    const surf = kind === STREET.service ? SURFACE.road : kind === STREET.path ? SURFACE.ground : SURFACE.sidewalk;
    ribbon(r.pts, r.road.width, (x, z) => Math.max(H(x, z), terrainTri(ctx.hf, x, z)) + y0, kind, vb, ox, oz, cb, surf, ctx.hf, inCarriageway);
    if (r.road.kind === 'steps') { /* drawn as a footway */ }
  }
  // markings
  for (const m of ctx.markingsIn(chunk)) {
    const n = Math.max(1, Math.ceil((m.hl * 2) / 2));
    const nx = -m.dz, nz = m.dx;
    mb.set('aSt', [m.kind, 0, 0, 0]).set('aDir', [m.dx, m.dz]);
    for (let k = 0; k < n; k++) {
      const s0 = -m.hl + (2 * m.hl * k) / n, s1 = -m.hl + (2 * m.hl * (k + 1)) / n;
      const P = [[s0, -m.hw], [s1, -m.hw], [s1, m.hw], [s0, m.hw]].map(([s, o]) => [m.cx + m.dx * s + nx * o, m.cz + m.dz * s + nz * o]);
      const Q = P.map((p) => [p[0] - ox, H(p[0], p[1]) + ROAD_Y + MARK_Y, p[1] - oz]);
      const ids = Q.map((q) => mb.v(q[0], q[1], q[2], 0, 1, 0));
      mb.quad(ids[0], ids[3], ids[2], ids[1]);
      cb.quad(Q[0], Q[3], Q[2], Q[1], SURFACE.road);        // paint is walked on too (4 mm proud)
    }
  }
  // bridges
  for (const b of streets.bridges) if (!b.alongside) buildBridge(ctx, b, chunk, vb, cb);
}

// The drawn terrain's height: its grid cells are split along the (i, j)-(i+1, j+1)
// diagonal (index.js terrainMesh), which can sit centimetres above the bilinear height.
export function terrainTri(hf, x, z) {
  const fx = (x - hf.x0) / hf.cell, fz = (z - hf.z0) / hf.cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = hf.node(i, j), b = hf.node(i + 1, j), c = hf.node(i + 1, j + 1), d = hf.node(i, j + 1);
  return u >= v ? a + (b - a) * u + (c - b) * v : a + (c - d) * u + (d - a) * v;
}

// The polygon's triangles (earcut), each wound to face up (+y), as point triples.
function upTriangles(P) {
  const toV = (l) => l.map((p) => new THREE.Vector2(p[0], p[1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(toV(P.outer), P.holes.map(toV)); } catch { return []; }
  const all = P.outer.concat(...P.holes);
  return faces.map((f) => {
    const a = all[f[0]], b = all[f[1]], c = all[f[2]];
    return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0 ? [a, b, c] : [a, c, b];
  });
}
// Cut a convex polygon of [x, y, z, d] at the given values of d (linear across it): the
// pieces between consecutive cuts, in order, each a convex polygon (wound as the input).
function slicePoly(V, cuts) {
  let rest = V; const out = [];
  for (const t of cuts) {
    const lo = [], hi = [];
    for (let i = 0; i < rest.length; i++) {
      const p = rest[i], q = rest[(i + 1) % rest.length];
      if (p[3] < t) lo.push(p); else if (p[3] > t) hi.push(p); else { lo.push(p); hi.push(p); }
      if ((p[3] < t && q[3] > t) || (p[3] > t && q[3] < t)) {
        const u = (t - p[3]) / (q[3] - p[3]), m = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u, t];
        lo.push(m); hi.push(m);
      }
    }
    if (lo.length >= 3) out.push(lo);
    rest = hi; if (rest.length < 3) return out;
  }
  out.push(rest);
  return out;
}

// Earcut via three's ShapeUtils. emit(pts) -> vertex indices, in pts order.
function triangulate(P, emit, vb, onTri) {
  const toV = (l) => l.map((p) => new THREE.Vector2(p[0], p[1]));
  const outer = P.outer, holes = P.holes;
  let faces;
  try { faces = THREE.ShapeUtils.triangulateShape(toV(outer), holes.map(toV)); } catch { return; }
  const all = outer.concat(...holes);
  const ids = emit(all);
  for (const f of faces) {
    // orient every triangle to face up (+y): (b - a) x (c - a) has y = (bz-az)(cx-ax) - (bx-ax)(cz-az)
    const a = all[f[0]], b = all[f[1]], c = all[f[2]];
    const up = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
    if (up) vb.tri(ids[f[0]], ids[f[1]], ids[f[2]]); else vb.tri(ids[f[0]], ids[f[2]], ids[f[1]]);
    if (onTri) onTri(a, b, c);
  }
}

function ribbon(pts, width, yAt, kind, vb, ox, oz, cb = null, surf = 0, hf = null, skip = null, cut = [false, false]) {
  const base = hf ? (P) => {
    const x = P[0] + ox, z = P[2] + oz, g = hf.at(x, z);
    if (hf.waterAt(x, z) !== null) return P[1] - 0.4;      // over water the bridge structure closes it
    return Math.max(P[1] - 2.5, Math.min(P[1] - 0.4, g - ROAD_SINK - 0.05));
  } : null;
  const hw = width / 2;
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 2));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  if (dense.length < 2) return;
  // the parts over a curbed carriageway are left out (the road is drawn and walked there;
  // a ribbon's end on the road would be a little wall across it)
  if (skip) {
    let run = [], cutStart = false;
    const flush = (cutEnd) => { if (run.length >= 2) ribbon(run, width, yAt, kind, vb, ox, oz, cb, surf, hf, null, [cutStart, cutEnd]); run = []; };
    for (const p of dense) { if (skip(p[0], p[1])) { flush(true); cutStart = true; } else { if (!run.length && p !== dense[0] && !cutStart) cutStart = false; run.push(p); } }
    flush(false);
    return;
  }
  let prev = null;
  for (let i = 0; i < dense.length; i++) {
    const p = dense[Math.max(0, i - 1)], q = dense[Math.min(dense.length - 1, i + 1)];
    let dx = q[0] - p[0], dz = q[1] - p[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = dense[i][0], z = dense[i][1];
    // extend the ends a little so ribbons overlap at joins
    const ext = i === 0 ? (cut[0] ? 0 : -hw * 0.6) : i === dense.length - 1 ? (cut[1] ? 0 : hw * 0.6) : 0;
    const cx = x + dx * ext, cz = z + dz * ext;
    vb.set('aSt', [kind, 0, 0, 0]).set('aDir', [dx, dz]);
    const pl = [cx - dz * hw - ox, yAt(cx - dz * hw, cz + dx * hw), cz + dx * hw - oz], pr = [cx + dz * hw - ox, yAt(cx + dz * hw, cz - dx * hw), cz - dx * hw - oz];
    const L = vb.v(pl[0], pl[1], pl[2], 0, 1, 0);
    const Rr = vb.v(pr[0], pr[1], pr[2], 0, 1, 0);
    if (prev) {
      vb.quad(prev[0], L, Rr, prev[1]); if (cb) cb.quad(prev[2], pl, pr, prev[3], surf);
      // skirts down the two sides, so the slab cannot be crept under
      skirt(vb, cb, prev[2], pl, [-dz, 0, dx], kind, base); skirt(vb, cb, pr, prev[3], [dz, 0, -dx], kind, base);
    }
    if (i === 0) skirt(vb, cb, pr, pl, [-dx, 0, -dz], kind, base);
    if (i === dense.length - 1) skirt(vb, cb, pl, pr, [dx, 0, dz], kind, base);
    prev = [L, Rr, pl, pr];
  }
}

// a vertical face from a slab edge (A to B, chunk-relative, with their slab heights)
// down to 40 cm below it: drawn and in the collider, facing `n`
function skirt(vb, cb, A, B, n, kind, base) {
  // down to the ground (below a slab draped up to a bridge, the ground can be far below its edge)
  const ya = base ? base(A) : A[1] - 0.4, yb = base ? base(B) : B[1] - 0.4;
  vb.set('aSt', [kind === STREET.path ? STREET.path : STREET.curb, 0, 0, 0]);
  const i0 = vb.v(A[0], ya, A[2], n[0], 0, n[2]), i1 = vb.v(B[0], yb, B[2], n[0], 0, n[2]), i2 = vb.v(B[0], B[1], B[2], n[0], 0, n[2]), i3 = vb.v(A[0], A[1], A[2], n[0], 0, n[2]);
  vb.quadFacing(i0, i1, i2, i3, n);
  if (cb) cb.quad([A[0], ya, A[2]], [B[0], yb, B[2]], [B[0], B[1], B[2]], [A[0], A[1], A[2]], SURFACE.ground);
}

function buildBridge(ctx, b, chunk, vb, cb) {
  const { x0, z0, size, ox, oz } = chunk;
  const P = b.road.points;
  const foot = !b.curbed;
  const half = b.half - 0.4;
  let s = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], c = P[i];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    if (L < 0.1 || mx < x0 || mx >= x0 + size || mz < z0 || mz >= z0 + size) { s += L; continue; }
    const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L, nx = -dz, nz = dx;
    const n = Math.max(1, Math.ceil(L / 2));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const pa = [a[0] + (c[0] - a[0]) * t0, a[1] + (c[1] - a[1]) * t0], pb = [a[0] + (c[0] - a[0]) * t1, a[1] + (c[1] - a[1]) * t1];
      const ya = ctx.streets.deckAt(b, s + L * t0), yb = ctx.streets.deckAt(b, s + L * t1);
      const W = (p, side, y) => [p[0] + nx * side - ox, y, p[1] + nz * side - oz];
      // deck collider (the visual deck is the road/sidewalk/footway drape)
      // a footbridge's timber deck is drawn 3 cm up and walked on there; a road bridge's
      // carriageway and sidewalks are already in the collider exactly as drawn
      if (foot) cb.quad(W(pa, -half, ya + 0.03), W(pa, half, ya + 0.03), W(pb, half, yb + 0.03), W(pb, -half, yb + 0.03), SURFACE.sidewalk);
      if (foot) {
        vb.set('aSt', [STREET.deck, 0, 0, 0]).set('aDir', [dx, dz]);
        quadV(vb, W(pa, -half, ya + 0.03), W(pb, -half, yb + 0.03), W(pb, half, yb + 0.03), W(pa, half, ya + 0.03), [0, 1, 0]);
      }
      // sides and underside
      for (const side of [-1, 1]) {
        const o = side * half, nn = [nx * side, 0, nz * side];
        vb.set('aSt', [STREET.stone, 0, 0, 0]).set('aDir', [dx, dz]);
        const lo = foot ? 0.35 : 1.0;
        const q = side > 0 ? [W(pa, o, ya - lo), W(pb, o, yb - lo), W(pb, o, yb + 0.05), W(pa, o, ya + 0.05)] : [W(pb, o, yb - lo), W(pa, o, ya - lo), W(pa, o, ya + 0.05), W(pb, o, yb + 0.05)];
        quadV(vb, q[0], q[1], q[2], q[3], nn);
        // parapet (road bridges: stone; footbridges: dark railing)
        const ph = foot ? 1.0 : 0.9, th = foot ? 0.06 : 0.3;
        const oi = o - side * th;
        vb.set('aSt', [foot ? STREET.railing : STREET.stone, 0, 0, 0]);
        if (foot) {
          // top rail and posts
          const top = [W(pa, o, ya + ph), W(pb, o, yb + ph)];
          railBar(vb, top[0], top[1], 0.05);
          railBar(vb, W(pa, o, ya + 0.15), W(pb, o, yb + 0.15), 0.035);
          const post = W(pa, o, ya); railBar(vb, post, [post[0], post[1] + ph, post[2]], 0.05);
          const p2 = W(pa, o, ya + 0.55), p3 = W(pb, o, yb + 0.55); railBar(vb, p2, p3, 0.025);
        } else {
          const q2 = side > 0 ? [W(pa, o, ya), W(pb, o, yb), W(pb, o, yb + ph), W(pa, o, ya + ph)] : [W(pb, o, yb), W(pa, o, ya), W(pa, o, ya + ph), W(pb, o, yb + ph)];
          quadV(vb, ...q2, nn);
          const q3 = side > 0 ? [W(pb, oi, yb), W(pa, oi, ya), W(pa, oi, ya + ph), W(pb, oi, yb + ph)] : [W(pa, oi, ya), W(pb, oi, yb), W(pb, oi, yb + ph), W(pa, oi, ya + ph)];
          quadV(vb, ...q3, [-nn[0], 0, -nn[2]]);
          quadV(vb, W(pa, oi, ya + ph), W(pa, o, ya + ph), W(pb, o, yb + ph), W(pb, oi, yb + ph), [0, 1, 0]);
        }
        cb.quad(W(pa, o, ya), W(pb, o, yb), W(pb, o, yb + ph), W(pa, o, ya + ph), foot ? SURFACE.fence : SURFACE.wall_stone);
      }
      vb.set('aSt', [STREET.stone, 0, 0, 0]);
      const lo = foot ? 0.35 : 1.0;
      quadV(vb, W(pa, half, ya - lo), W(pa, -half, ya - lo), W(pb, -half, yb - lo), W(pb, half, yb - lo), [0, -1, 0]);
      cb.quad(W(pa, half, ya - lo), W(pa, -half, ya - lo), W(pb, -half, yb - lo), W(pb, half, yb - lo), SURFACE.wall_stone);   // the underside, from below
    }
    s += L;
  }
}
function quadV(vb, a, b, c, d, n) {
  const i = [a, b, c, d].map((p) => vb.v(p[0], p[1], p[2], n[0], n[1], n[2]));
  vb.quad(i[0], i[1], i[2], i[3]);
}
// a thin square bar between two points
function railBar(vb, a, b, r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d) || 1;
  const u = Math.abs(d[1] / L) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let s = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]; const sl = Math.hypot(...s); s = s.map((v) => (v / sl) * r);
  let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map((v) => (v / tl) * r);
  const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let k = 0; k < 4; k++) {
    const [p1, q1] = C[k], [p2, q2] = C[(k + 1) % 4];
    const o1 = [s[0] * p1 + t[0] * q1, s[1] * p1 + t[1] * q1, s[2] * p1 + t[2] * q1], o2 = [s[0] * p2 + t[0] * q2, s[1] * p2 + t[1] * q2, s[2] * p2 + t[2] * q2];
    const n = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2, (o1[2] + o2[2]) / 2]; const nl = Math.hypot(...n) || 1;
    quadV(vb, [a[0] + o1[0], a[1] + o1[1], a[2] + o1[2]], [a[0] + o2[0], a[1] + o2[1], a[2] + o2[2]], [b[0] + o2[0], b[1] + o2[1], b[2] + o2[2]], [b[0] + o1[0], b[1] + o1[1], b[2] + o1[2]], [n[0] / nl, n[1] / nl, n[2] / nl]);
  }
}

// Bin ribbons and markings into chunks (by segment midpoint / quad centre).
export function binStreetParts(ctx, chunkKeyOf) {
  const ribbons = new Map(), marks = new Map();
  const push = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(v); };
  for (const r of ctx.data.roads) {
    if (!(r.kind in RIBBON) || r.tunnel) continue;
    if (r.crossing && (r.kind === 'footway' || r.kind === 'path')) {
      // keep only the parts of a crossing footway that are off the carriageway
    }
    let run = null, runKey = null;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      // skip segments lying on a carriageway (crossings are painted as zebras)
      const q = ctx.streets.grid.nearest(mx, mz, 12);
      const onRoad = q && q.d < q.seg.data.hw - 0.3 && r.kind !== 'service';
      const k = chunkKeyOf(mx, mz);
      if (onRoad || k !== runKey) { if (run && run.pts.length > 1) push(ribbons, runKey, run); run = null; runKey = null; }
      if (onRoad) continue;
      if (!run) { run = { road: r, pts: [a] }; runKey = k; }
      run.pts.push(b);
    }
    if (run && run.pts.length > 1) push(ribbons, runKey, run);
  }
  for (const m of ctx.markings) push(marks, chunkKeyOf(m.cx, m.cz), m);
  ctx.ribbonsIn = (c) => ribbons.get(c.key) || [];
  ctx.markingsIn = (c) => marks.get(c.key) || [];
}

export function seedOf(x, z) { return hash2(x, z); }
export { hashStr };
