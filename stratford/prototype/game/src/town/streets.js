// Streets at small-creature scale: the carriageway sits a curb's height below
// the sidewalks, boulevards and corners around it. Road coverage is drawn into
// a small canvas per chunk (stroked with round joins, softened so street
// corners get a curb radius), traced with marching squares and triangulated:
// asphalt below, raised sidewalk plates with real vertical curbs above.
// Footways, service lanes, markings, crosswalks and bridges are built here too.
import * as THREE from 'three';
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
  for (const r of data.roads) {
    if (!CURBED.has(r.kind) || r.tunnel) continue;
    const hw = r.width / 2;
    let n = 0, hit = 0;
    walk(r.points, 8, (x, z) => { n++; if (shops.any(x, z, hw + 13)) hit++; });
    const downtown = n > 0 && hit / n > 0.4;
    const major = r.kind === 'primary' || r.kind === 'secondary' || r.kind === 'trunk';
    const s = {
      road: r, hw, downtown,
      band: downtown ? 4.4 : major ? 4.6 : 4.0,             // curb to the back of the sidewalk
      blv: downtown ? 0 : major ? 2.4 : 2.1,                // grass boulevard by the curb
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
    let s = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], c = r.points[i]; const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      bgrid.add(a[0], a[1], c[0], c[1], { b, s0: s, s1: s + l });
      s += l;
    }
  }
  const deckAt = (b, s) => {
    const t = s / b.L;
    let y = b.h0 + (b.h1 - b.h0) * t + Math.sin(Math.PI * t) * Math.min(0.8, b.L / 40);
    if (Number.isFinite(b.wl)) y = Math.max(y, b.wl + 1.1 + 0.6 * Math.sin(Math.PI * t));
    return y;
  };
  // drape height: terrain, or a bridge deck
  const H = (x, z) => {
    const q = bgrid.nearest(x, z, 14);
    if (q && q.d <= q.seg.data.b.half) {
      const { b, s0, s1 } = q.seg.data;
      return deckAt(b, s0 + (s1 - s0) * q.t);
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
      zebra(q.qx, q.qz, rx, rz, q.seg.data.hw, 3.0);
      crossings.add(q.qx, q.qz, true);
      r.crossing = true;
    }
  }
  function zebra(cx, cz, rx, rz, hw, depth) {
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
  for (const s of streets.roads) line(A, s.road.points, s.road.width + 2 * s.band);
  for (const a of data.areas) if (a.kind === 'plaza') poly(A, [a.outer, ...a.holes]);
  for (const r of data.roads) if (r.kind === 'footway' || r.kind === 'pedestrian' || r.kind === 'steps') line(A, r.points, r.width);
  // boulevards back to grass
  A.globalCompositeOperation = 'multiply'; A.strokeStyle = 'rgb(255,0,255)';
  for (const s of streets.roads) if (s.blv > 0) line(A, s.road.points, s.road.width + 2 * s.blv);
  A.globalCompositeOperation = 'lighten';
  // gravel: paths, rail beds
  A.strokeStyle = A.fillStyle = 'rgb(0,0,255)';
  for (const r of data.roads) if (r.kind === 'path' || r.kind === 'track' || r.kind === 'bridleway') line(A, r.points, r.width);
  for (const r of data.railways) line(A, r.points, 3.2);
  for (const a of data.areas) if (a.kind === 'railway') poly(A, [a.outer, ...a.holes]);
  // asphalt
  A.strokeStyle = A.fillStyle = 'rgb(255,0,0)';
  for (const a of data.areas) if (a.kind === 'parking') poly(A, [a.outer, ...a.holes]);
  for (const r of data.roads) if (r.kind === 'service' || CURBED.has(r.kind)) line(A, r.points, r.width);
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
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { texA: tex(ca), texB: tex(cb), rect: new THREE.Vector4(x0, z0, 1 / W, 1 / D), canvases: [ca, cb] };
}

// ---------------------------------------------------------------- per chunk
const R = 0.5;            // raster resolution (m)
const MARGIN = 16;        // px around the chunk so blur and strokes see their neighbours
let _canvas = null, _canvas2 = null;

// Builds a chunk's streets into vb (visual Builder with aSt/aDir) and cb
// (ColliderBuilder). ox, oz: the chunk origin (vertices are stored relative to
// it). Generator: yields between the heavy steps for time slicing.
export function* buildChunkStreets(ctx, chunk, vb, cb) {
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
    // nearest curbed road: distance from the curb and the street's direction
    const info = (x, z) => {
      const q = streets.grid.nearest(x, z, 40);
      if (!q) return { d: 9, blv: 0, dx: 1, dz: 0 };
      const s = q.seg.data; let dx = q.seg.bx - q.seg.ax, dz = q.seg.bz - q.seg.az; const l = Math.hypot(dx, dz) || 1;
      return { d: Math.max(0, q.d - s.hw), blv: s.blv, dx: dx / l, dz: dz / l };
    };
    // carriageway
    const roadLoops = contourLoops(road, N, x0, z0, R);
    yield;
    for (const P of polygons(roadLoops.map((l) => cleanLoop(l, 0.04, 3)).filter(Boolean))) {
      triangulate(P, (pts) => {
        const idx = pts.map((p) => {
          const i = info(p[0], p[1]);
          vb.set('aSt', [STREET.road, 0, 0, 0]).set('aDir', [i.dx, i.dz]);
          return vb.v(p[0] - ox, H(p[0], p[1]) + 0.02, p[1] - oz, 0, 1, 0);
        });
        return idx;
      }, vb);
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
        const y = H(p[0], p[1]) + (isCurb ? curb : 0.04);
        meta.set(p, { isCurb, y, d: isCurb ? 0 : Math.max(i.d, 0.3), i });
      }
      triangulate(P, (pts) => pts.map((p) => {
        const m = meta.get(p);
        vb.set('aSt', [STREET.plate, m.d, m.i.blv, 0]).set('aDir', [m.i.dx, m.i.dz]);
        return vb.v(p[0] - ox, m.y, p[1] - oz, 0, 1, 0);
      }), vb, (a, b, c) => {
        const ma = meta.get(a), mb = meta.get(b), mc = meta.get(c);
        const d = (ma.d + mb.d + mc.d) / 3, blv = ma.i.blv;
        const surf = blv > 0 && d > 0.25 && d < blv ? SURFACE.grass : SURFACE.sidewalk;
        cb.tri([a[0] - ox, ma.y, a[1] - oz], [c[0] - ox, mc.y, c[1] - oz], [b[0] - ox, mb.y, b[1] - oz], surf);
      });
      // curb faces: loop edges whose both ends are on the curb (inside is on the left, the road on the right)
      for (const ring of rings) {
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k], b = ring[(k + 1) % ring.length];
          const ma = meta.get(a), mb = meta.get(b);
          if (!ma.isCurb || !mb.isCurb || (a[2] && b[2])) continue;
          let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz); if (l < 1e-4) continue; nx /= l; nz /= l;
          const ya = ma.y - curb, yb = mb.y - curb;
          vb.set('aSt', [STREET.curb, 0, 0, 0]).set('aDir', [-nz, nx]);
          const i0 = vb.v(a[0] - ox, ya - 0.03, a[1] - oz, nx, 0, nz), i1 = vb.v(b[0] - ox, yb - 0.03, b[1] - oz, nx, 0, nz);
          const i2 = vb.v(b[0] - ox, mb.y, b[1] - oz, nx, 0, nz), i3 = vb.v(a[0] - ox, ma.y, a[1] - oz, nx, 0, nz);
          vb.quad(i1, i0, i3, i2);
          cb.quad([a[0] - ox, ya, a[1] - oz], [b[0] - ox, yb, b[1] - oz], [b[0] - ox, mb.y, b[1] - oz], [a[0] - ox, ma.y, a[1] - oz], SURFACE.sidewalk);
        }
      }
    }
    yield;
  }
  // ribbons: footways, paths, service lanes (segments whose midpoint is in the chunk)
  for (const r of ctx.ribbonsIn(chunk)) {
    const kind = RIBBON[r.road.kind];
    const y0 = kind === STREET.service ? 0.012 : 0.026;
    ribbon(r.pts, r.road.width, (x, z) => H(x, z) + y0, kind, vb, ox, oz);
    if (r.road.kind === 'steps') { /* drawn as a footway */ }
  }
  // markings
  for (const m of ctx.markingsIn(chunk)) {
    const n = Math.max(1, Math.ceil((m.hl * 2) / 2));
    const nx = -m.dz, nz = m.dx;
    vb.set('aSt', [m.kind, 0, 0, 0]).set('aDir', [m.dx, m.dz]);
    for (let k = 0; k < n; k++) {
      const s0 = -m.hl + (2 * m.hl * k) / n, s1 = -m.hl + (2 * m.hl * (k + 1)) / n;
      const P = [[s0, -m.hw], [s1, -m.hw], [s1, m.hw], [s0, m.hw]].map(([s, o]) => [m.cx + m.dx * s + nx * o, m.cz + m.dz * s + nz * o]);
      const ids = P.map((p) => vb.v(p[0] - ox, H(p[0], p[1]) + 0.032, p[1] - oz, 0, 1, 0));
      vb.quad(ids[0], ids[3], ids[2], ids[1]);
    }
  }
  // bridges
  for (const b of streets.bridges) buildBridge(ctx, b, chunk, vb, cb);
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

function ribbon(pts, width, yAt, kind, vb, ox, oz) {
  const hw = width / 2;
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 2));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  if (dense.length < 2) return;
  let prev = null;
  for (let i = 0; i < dense.length; i++) {
    const p = dense[Math.max(0, i - 1)], q = dense[Math.min(dense.length - 1, i + 1)];
    let dx = q[0] - p[0], dz = q[1] - p[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = dense[i][0], z = dense[i][1];
    // extend the ends a little so ribbons overlap at joins
    const ext = i === 0 ? -hw * 0.6 : i === dense.length - 1 ? hw * 0.6 : 0;
    const cx = x + dx * ext, cz = z + dz * ext;
    vb.set('aSt', [kind, 0, 0, 0]).set('aDir', [dx, dz]);
    const L = vb.v(cx - dz * hw - ox, yAt(cx - dz * hw, cz + dx * hw), cz + dx * hw - oz, 0, 1, 0);
    const Rr = vb.v(cx + dz * hw - ox, yAt(cx + dz * hw, cz - dx * hw), cz - dx * hw - oz, 0, 1, 0);
    if (prev) vb.quad(prev[0], L, Rr, prev[1]);
    prev = [L, Rr];
  }
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
      cb.quad(W(pa, -half, ya), W(pa, half, ya), W(pb, half, yb), W(pb, -half, yb), foot ? SURFACE.sidewalk : SURFACE.road);
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
