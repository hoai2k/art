// Stratford's town on the World contract (ARCHITECTURE.md): createTown()
// loads town.json + terrain.bin, prepares the whole-town data once (streets,
// ground map, trees, props), then streams ~200 m chunks around the focus in
// time slices: far chunks get coarse terrain and buildings, near chunks add
// fine terrain, streets with curbs, colliders (one BVH set per chunk) and the
// detail layers that suit the creature's scale.
import * as THREE from 'three';
import { MeshBVH, CENTER } from 'three-mesh-bvh';
import { SURFACE } from '../surface.js';
import { loadTown } from './data.js';
import { loadAssets } from './assets.js';
import { Builder, ColliderBuilder, PointGrid, pointInPoly, bbox, centroid, disposeObject, rng, polyArea } from './util.js';
import { sharedUniforms, groundMaterial, streetMaterial, buildingMaterial, waterMaterial, groundArray } from './materials.js';
import { prepareStreets, buildGroundMap, buildChunkStreets, binStreetParts, ROAD_SINK, BAND_SINK } from './streets.js';
import { addBuilding, BUILDING_ATTRS } from './buildings.js';
import { correctHouseHeights } from './houses.js';
import { planLots } from './lots.js';
import { porchPlan } from './housegeo.js';
import { createTrees, prepareTrees, addStreetTrees } from './trees.js';
import { placeProps, createProps } from './props.js';
import { createSky } from './sky.js';
import { grassLayer, cellSeed } from './detail.js';
import { buildAtlas, nearLayer, midLayer, fixturesLayer, createView, pilesOf } from './ground.js';
import { facadeLayer, FACADE_SHOW_RADIUS } from './facade3d.js';

export const CHUNK = 200;
const QUALITY = {
  low: { groundRes: 2, shadows: false, nearMul: 0.8, treeNear: 90, propR: 70 },
  medium: { groundRes: 1.25, shadows: true, nearMul: 1, treeNear: 140, propR: 110 },
  high: { groundRes: 1, shadows: true, nearMul: 1.25, treeNear: 200, propR: 160 },
};

export async function createTown(opts = {}) {
  const { renderer = null, quality: qName = 'medium', onProgress = () => {}, dataUrl, manifestUrl } = opts;
  const quality = QUALITY[qName] ? qName : 'medium';
  const Q = QUALITY[quality];
  const scene = opts.scene || new THREE.Scene();
  const t0 = performance.now();
  const stats = { buildMs: 0, readyMs: 0, chunks: 0, nearChunks: 0, colliderTris: 0, prepMs: 0 };
  const progress = (p, msg) => { try { onProgress(p, msg); } catch { /* ignore */ } };
  // let the page breathe between the big steps
  const breathe = () => new Promise((r) => setTimeout(r, 0));

  progress(0.02, 'Reading the map');
  const [assets, data] = await Promise.all([loadAssets(manifestUrl, { facadeSize: quality === 'high' ? 1024 : 512, skyWidth: quality === 'high' ? 4096 : 2048 }), loadTown(dataUrl)]);
  const hf = data.height;
  // house heights inflated by overhanging trees (LiDAR), flat roofs on small houses (houses.js)
  const heightFixes = correctHouseHeights(data, hf);
  stats.heightFixes = heightFixes.count;
  const ctx = { data, hf, quality, curb: 0.15, assets };
  progress(0.15, 'Planting trees');
  ctx.trees = prepareTrees(data, hf);
  await breathe();
  progress(0.2, 'Laying out the streets');
  prepareStreets(ctx);

  // lookups shared by the builders
  const bGrid = new Map();
  const bKey = (i, j) => i * 100003 + j;
  data.buildings.forEach((b, i) => { b._idx = i; });
  for (const b of data.buildings) {
    b.bb = bbox(b.outer);
    for (let i = Math.floor(b.bb.minX / 20); i <= Math.floor(b.bb.maxX / 20); i++) for (let j = Math.floor(b.bb.minZ / 20); j <= Math.floor(b.bb.maxZ / 20); j++) {
      const k = bKey(i, j); let a = bGrid.get(k); if (!a) bGrid.set(k, a = []); a.push(b);
    }
  }
  ctx.buildingAt = (x, z) => {
    const a = bGrid.get(bKey(Math.floor(x / 20), Math.floor(z / 20))); if (!a) return null;
    for (const b of a) if (x >= b.bb.minX && x <= b.bb.maxX && z >= b.bb.minZ && z <= b.bb.maxZ && pointInPoly(x, z, b.outer)) return b;
    return null;
  };
  ctx.landmarkByBuilding = new Map();
  for (const l of data.landmarks) {
    let b = l.buildingId ? data.buildings.find((q) => q.id === l.buildingId) : null;
    if (!b && /theatre/i.test(l.id)) {
      // nearest sizeable building to the landmark point
      let best = null, bd = 40;
      for (const q of data.buildings) { const c = centroid(q.outer); const d = Math.hypot(c[0] - l.x, c[1] - l.z) - Math.sqrt(Math.abs(q.bb.maxX - q.bb.minX) * Math.abs(q.bb.maxZ - q.bb.minZ)) * 0.3; if (d < bd) { bd = d; best = q; } }
      b = ctx.buildingAt(l.x, l.z) || best;
    }
    if (b) { ctx.landmarkByBuilding.set(b.id, l); l.buildingId = l.buildingId || b.id; }
  }
  // parks (for path furniture)
  const parkAreas = data.areas.filter((a) => a.kind === 'park' || a.kind === 'garden' || a.kind === 'grass' || a.kind === 'cemetery').map((a) => ({ ...a, bb: bbox(a.outer) }));
  ctx.inPark = (x, z) => parkAreas.some((a) => x >= a.bb.minX && x <= a.bb.maxX && z >= a.bb.minZ && z <= a.bb.maxZ && pointInPoly(x, z, a.outer));
  ctx.markingGrid = new PointGrid(20);
  for (const m of ctx.markings) ctx.markingGrid.add(m.cx, m.cz, m);
  stats.streetTrees = addStreetTrees(ctx);
  // house lots: walks, driveways, garages, fences, gardens (lots.js); garages are extra buildings
  ctx.registerBuilding = (b) => {
    b.bb = bbox(b.outer);
    for (let i = Math.floor(b.bb.minX / 20); i <= Math.floor(b.bb.maxX / 20); i++) for (let j = Math.floor(b.bb.minZ / 20); j <= Math.floor(b.bb.maxZ / 20); j++) {
      const k = bKey(i, j); let a = bGrid.get(k); if (!a) bGrid.set(k, a = []); a.push(b);
    }
  };
  ctx.extraBuildings = [];
  stats.lots = planLots(ctx);
  ctx.extraBuildings.forEach((b, k) => { b._idx = data.buildings.length + k; });
  stats.garages = ctx.extraBuildings.length;
  const allBuildings = data.buildings.concat(ctx.extraBuildings);

  // chunk grid aligned with the terrain grid
  const X0 = hf.x0, Z0 = hf.z0;
  const NX = Math.ceil(((hf.nx - 1) * hf.cell) / CHUNK), NZ = Math.ceil(((hf.nz - 1) * hf.cell) / CHUNK);
  const keyOf = (x, z) => `${Math.floor((x - X0) / CHUNK)},${Math.floor((z - Z0) / CHUNK)}`;
  binStreetParts(ctx, keyOf);
  await breathe();
  progress(0.3, 'Painting the ground');
  const ground = buildGroundMap(ctx, Q.groundRes);
  const groundClass = classMap(ground, hf);
  ctx.groundClass = groundClass;
  ground.canvases = null;
  await breathe();
  progress(0.4, 'Placing benches and lamps');
  const propItems = placeProps(ctx);

  // materials and global objects
  const shared = sharedUniforms();
  const minWater = data.water.all.length ? Math.min(...data.water.all.map((p) => p.level)) : -100;
  // one texel per building: 1 when its modelled street front is built (facade3d.js)
  const flagRows = Math.max(1, Math.ceil(allBuildings.length / 256));
  const detailFlags = new THREE.DataTexture(new Uint8Array(256 * flagRows), 256, flagRows, THREE.RedFormat, THREE.UnsignedByteType);
  detailFlags.needsUpdate = true;
  // the street-photo survey's colours, 16 texels per building (see materials.js survey())
  const svRows = Math.max(1, Math.ceil((allBuildings.length * 16) / 256));
  const svData = new Float32Array(256 * svRows * 4);
  const col = new THREE.Color();
  const put = (bi, k, hex, a) => { if (!hex) return; col.set(hex); const o = (bi * 16 + k) * 4; svData[o] = col.r; svData[o + 1] = col.g; svData[o + 2] = col.b; svData[o + 3] = a; };
  data.buildings.forEach((b, bi) => {
    const sv = b.survey; if (!sv) return;
    put(bi, 0, sv.wall, sv.painted ? 2 : 1);
    put(bi, 1, sv.trim, 1);
    if (sv.full) {
      put(bi, 2, sv.roofColour, 1);
      (sv.storefronts || []).slice(0, 4).forEach((f, u) => { put(bi, 4 + u, f.colour, 1); if (f.awning) { put(bi, 8 + u, f.awning.colour, f.awning.stripes ? 2 : 1); put(bi, 12 + u, f.awning.stripes, 1); } });
    }
  });
  const surveyTex = new THREE.DataTexture(svData, 256, svRows, THREE.RGBAFormat, THREE.FloatType);
  surveyTex.needsUpdate = true;
  const facadeUniforms = { flags: detailFlags, survey: surveyTex, focus: { value: new THREE.Vector3() }, radius: { value: FACADE_SHOW_RADIUS } };
  // the paving and leaf textures in one array; the plazas (Market Square) paved
  const gdTex = groundArray(assets);
  const plazas = Array.from({ length: 6 }, () => new THREE.Vector4());
  data.areas.filter((a) => a.kind === 'plaza').sort((a, b) => polyArea(b.outer) - polyArea(a.outer)).slice(0, 6).forEach((a, i) => { const bb = bbox(a.outer); plazas[i].set(bb.minX, bb.minZ, bb.maxX, bb.maxZ); });
  const mats = {
    ground: groundMaterial(shared, ground, assets, minWater, gdTex, plazas),
    street: streetMaterial(shared, assets, {}, ground, gdTex, plazas),
    markings: streetMaterial(shared, assets, { polygonOffsetFactor: -2, polygonOffsetUnits: -8 }, ground, gdTex, plazas),
    building: buildingMaterial(shared, assets, facadeUniforms),
    water: waterMaterial(shared, assets),
  };
  const root = new THREE.Group(); root.name = 'town'; scene.add(root);
  const sky = createSky(scene, shared, Q.shadows ? renderer : null, Q.shadows ? quality : 'low', assets);
  const water = buildWater(data, mats.water); if (water) root.add(water);
  const trees = createTrees(ctx, shared, assets); root.add(trees.group);
  const props = createProps(ctx, shared, propItems); root.add(props.group);

  // bin per chunk
  const binned = new Map();
  const bin = (k) => { let e = binned.get(k); if (!e) binned.set(k, e = { buildings: [], trees: [], props: [] }); return e; };
  for (const b of allBuildings) { const c = centroid(b.outer); bin(keyOf(c[0], c[1])).buildings.push(b); }
  for (const t of ctx.trees) bin(keyOf(t.x, t.z)).trees.push(t);
  for (const p of propItems) bin(keyOf(p.x, p.z)).props.push(p);
  const treeGrid = new PointGrid(20); for (const t of ctx.trees) treeGrid.add(t.x, t.z, t);
  stats.prepMs = Math.round(performance.now() - t0);

  // ---------------------------------------------------------------- chunks
  const chunks = new Map();
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x0 = X0 + i * CHUNK, z0 = Z0 + j * CHUNK;
    const key = `${i},${j}`;
    const c = { key, i, j, x0, z0, size: CHUNK, ox: x0, oz: z0, level: 0, want: 0, task: null, group: null, far: null, near: null, colliders: [], buildCb: null, minY: Infinity, maxY: -Infinity };
    for (let a = 0; a <= 50; a += 10) for (let b = 0; b <= 50; b += 10) { const y = hf.at(x0 + a * 4, z0 + b * 4); c.minY = Math.min(c.minY, y); c.maxY = Math.max(c.maxY, y); }
    c.minY -= 20; c.maxY += 60;
    chunks.set(key, c);
  }
  stats.chunks = chunks.size;

  let scale = 0.25, nearR = 260, farR = 2000;
  const setScaleRadii = (s) => {
    scale = s;
    if (typeof shared !== 'undefined' && shared) shared.uScale.value = s;
    nearR = THREE.MathUtils.clamp(s * 1000, 110, 330) * Q.nearMul;
    farR = THREE.MathUtils.clamp(s * 8000, 500, 2400);
    sky.setScale(s);
  };
  setScaleRadii(opts.scale || 0.25);

  // Terrain node heights for a chunk at a step (in grid cells). Near chunks sink
  // the nodes under carriageways a little so the road surface always covers them;
  // the collider is built from the very same heights, so what is drawn is what is walked on.
  const SINK = BAND_SINK, SINK_ROAD = ROAD_SINK;
  function terrainHeights(c, step, sink) {
    const i0 = Math.round((c.x0 - hf.x0) / hf.cell), j0 = Math.round((c.z0 - hf.z0) / hf.cell);
    const cols = Math.floor(Math.round(CHUNK / hf.cell) / step) + 1;
    const y = new Float32Array(cols * cols), sunk = new Uint8Array(cols * cols);
    for (let jj = 0; jj < cols; jj++) for (let ii = 0; ii < cols; ii++) {
      const i = i0 + ii * step, j = j0 + jj * step;
      let h = hf.node(i, j);
      if (sink) {
        const x = hf.x0 + i * hf.cell, z = hf.z0 + j * hf.cell;
        // under the carriageway and the sidewalk band (both drawn over it), not under lawns
        // (deeper under carriageways: a wide road is triangulated between its curbs, so its
        // surface is a chord that sits below a crowned road's middle)
        const q = ctx.streets.grid.nearest(x, z, 16);
        if (q && q.d < q.seg.data.hw - 0.3) { h -= SINK_ROAD; sunk[jj * cols + ii] = 1; }
        else if (q && q.d < q.seg.data.hw + q.seg.data.band - 0.6) { h -= SINK; sunk[jj * cols + ii] = 1; }
      }
      y[jj * cols + ii] = h;
    }
    return { y, sunk, cols, i0, j0, step };
  }

  function terrainMesh(c, T) {
    const { y: Y, cols, i0, j0, step } = T;
    const b = new Builder({});
    const H = (i, j) => hf.node(i, j);
    const ids = [];
    for (let jj = 0; jj < cols; jj++) for (let ii = 0; ii < cols; ii++) {
      const i = i0 + ii * step, j = j0 + jj * step;
      const x = hf.x0 + i * hf.cell, z = hf.z0 + j * hf.cell;
      const dx = H(i + step, j) - H(i - step, j), dz = H(i, j + step) - H(i, j - step);
      const nx = -dx, ny = 4 * hf.cell * step, nz = -dz; const l = Math.hypot(nx, ny, nz);
      ids.push(b.v(x - c.ox, Y[jj * cols + ii], z - c.oz, nx / l, ny / l, nz / l));
    }
    for (let jj = 0; jj < cols - 1; jj++) for (let ii = 0; ii < cols - 1; ii++) {
      const a = ids[jj * cols + ii], b1 = ids[jj * cols + ii + 1], c1 = ids[(jj + 1) * cols + ii + 1], d = ids[(jj + 1) * cols + ii];
      b.tri(a, d, c1); b.tri(a, c1, b1);
    }
    // skirts hang straight down (never walkable, never above the ground) against cracks between levels of detail
    const drop = step > 1 ? 1.5 : 0.6;
    const edge = (list) => {
      for (let k = 0; k < list.length - 1; k++) {
        const pa = list[k], pb = list[k + 1];
        const A = [b.pos[pa * 3], b.pos[pa * 3 + 1], b.pos[pa * 3 + 2]], B = [b.pos[pb * 3], b.pos[pb * 3 + 1], b.pos[pb * 3 + 2]];
        const v0 = b.v(A[0], A[1] - 0.002, A[2], 0, 1, 0), v1 = b.v(B[0], B[1] - 0.002, B[2], 0, 1, 0), v2 = b.v(B[0], B[1] - drop, B[2], 0, 1, 0), v3 = b.v(A[0], A[1] - drop, A[2], 0, 1, 0);
        b.quad(v0, v1, v2, v3); b.quad(v1, v0, v3, v2);
      }
    };
    edge(ids.slice(0, cols)); edge(ids.slice((cols - 1) * cols)); edge(ids.filter((_, k) => k % cols === 0)); edge(ids.filter((_, k) => k % cols === cols - 1));
    const m = new THREE.Mesh(b.geometry(), mats.ground);
    m.receiveShadow = true; m.name = 'terrain';
    return m;
  }

  // The top of the walkable slabs (roads, sidewalks, footways) over a chunk, on a 0.5 m raster
  // (chunk-relative collider triangles in), -Infinity where there is none.
  function slabRaster(cbStreets) {
    const r = 0.5, n = Math.round(CHUNK / r) + 1, top = new Float32Array(n * n).fill(-Infinity);
    const P = cbStreets.pos;
    for (let t = 0; t < P.length; t += 9) {
      const ax = P[t], ay = P[t + 1], az = P[t + 2], bx = P[t + 3], by = P[t + 4], bz = P[t + 5], cx = P[t + 6], cy = P[t + 7], cz = P[t + 8];
      const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az, det = ux * vz - uz * vx;
      if (Math.abs(det) < 1e-6) continue;
      const uy = by - ay, vy = cy - ay;
      const ny = Math.abs(det) / Math.hypot(uy * vz - uz * vy, det, ux * vy - uy * vx);
      if (ny < 0.7) continue;                                   // walls, curbs, skirts
      const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) / r)), i1 = Math.min(n - 1, Math.floor(Math.max(ax, bx, cx) / r));
      const j0 = Math.max(0, Math.ceil(Math.min(az, bz, cz) / r)), j1 = Math.min(n - 1, Math.floor(Math.max(az, bz, cz) / r));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = i * r - ax, pz = j * r - az;
        const s1 = (px * vz - pz * vx) / det, s2 = (ux * pz - uz * px) / det;
        if (s1 < -1e-4 || s2 < -1e-4 || s1 + s2 > 1 + 1e-4) continue;
        const y = ay + (by - ay) * s1 + (cy - ay) * s2, k = j * n + i;
        if (y > top[k]) top[k] = y;
      }
    }
    return { top, n, r };
  }

  // terrain collider: the drawn triangles, two cells merged only where all four are exactly coplanar
  function terrainCollider(c, cb, T, slabs) {
    const { y: Y, cols, i0, j0, step = 1 } = T;
    // a cell wholly under a road or sidewalk slab is not a ground anyone can reach: leave it out
    // (every 0.5 m sample of it has a slab at or above the terrain)
    const covered = (ii, jj) => {
      if (!slabs) return false;
      const k = 4 / slabs.r, si = ii * k, sj = jj * k, h = (p, q) => {
        const u = p / k, v = q / k;
        return (Y[jj * cols + ii] * (1 - u) + Y[jj * cols + ii + 1] * u) * (1 - v) + (Y[(jj + 1) * cols + ii] * (1 - u) + Y[(jj + 1) * cols + ii + 1] * u) * v;
      };
      for (let q = 0; q <= k; q++) for (let p = 0; p <= k; p++) if (!(slabs.top[(sj + q) * slabs.n + si + p] >= h(p, q) - 0.005)) return false;
      return true;
    };
    const P = (ii, jj) => [hf.x0 + (i0 + ii) * hf.cell - c.ox, Y[jj * cols + ii], hf.z0 + (j0 + jj) * hf.cell - c.oz];
    // the drawn surface (groundClass.drawn) on a 1 m grid in each cell: one id per cell
    // when it is the same all over, else -1 (the cell is cut into 1 m pieces)
    const SUB = Math.max(1, Math.round(hf.cell * step));
    const at = (x, z) => (hf.waterAt(x, z) !== null ? SURFACE.water_bed : groundClass.drawn(x, z));
    const cellSurf = new Map();
    const surf = (ii, jj) => {
      const key = jj * cols + ii; if (cellSurf.has(key)) return cellSurf.get(key);
      const cs = hf.cell * step, x0c = hf.x0 + (i0 + ii * step) * hf.cell, z0c = hf.z0 + (j0 + jj * step) * hf.cell;
      let s0 = null;
      for (let q = 0; q < SUB && s0 !== -1; q++) for (let p = 0; p < SUB; p++) { const sv = at(x0c + ((p + 0.5) / SUB) * cs, z0c + ((q + 0.5) / SUB) * cs); if (s0 === null) s0 = sv; else if (sv !== s0) { s0 = -1; break; } }
      cellSurf.set(key, s0); return s0;
    };
    // a mixed cell: SUB x SUB pieces on the drawn triangles' planes (diagonal (0,0)-(1,1))
    const mixed = (I, J) => {
      const a = Y[J * cols + I], b = Y[J * cols + I + 1], c2 = Y[(J + 1) * cols + I + 1], d = Y[(J + 1) * cols + I];
      const cs = hf.cell * step, x0c = hf.x0 + (i0 + I * step) * hf.cell - c.ox, z0c = hf.z0 + (j0 + J * step) * hf.cell - c.oz;
      const Q = (u, v) => [x0c + u * cs, u >= v ? a + (b - a) * u + (c2 - b) * v : a + (c2 - d) * u + (d - a) * v, z0c + v * cs];
      const S = (u, v) => at(x0c + c.ox + u * cs, z0c + c.oz + v * cs);
      // a quadtree down to 1/8 of the cell (50 cm): squares split while the drawn surface
      // differs across them (sampled on a 3 x 3 grid), each leaf one surface at its centre
      // a square wholly under a slab (raster nodes round it all at or above the terrain) is
      // left out like a covered cell: the paint's edges hidden under sidewalks cost nothing
      const under = (u0, v0, w) => {
        if (!slabs) return false;
        const r = slabs.r, xa = x0c + u0 * cs, za = z0c + v0 * cs, xb = xa + w * cs, zb = za + w * cs;
        for (let j = Math.floor(za / r); j <= Math.ceil(zb / r); j++) for (let i = Math.floor(xa / r); i <= Math.ceil(xb / r); i++) {
          if (i < 0 || j < 0 || i >= slabs.n || j >= slabs.n) return false;
          const u = Math.min(1, Math.max(0, (i * r - x0c) / cs)), v = Math.min(1, Math.max(0, (j * r - z0c) / cs));
          if (!(slabs.top[j * slabs.n + i] >= Q(u, v)[1] - 0.005)) return false;
        }
        return true;
      };
      const quad = (u0, v0, w, depth) => {
        if (under(u0, v0, w)) return;
        const s0 = S(u0 + w / 2, v0 + w / 2);
        let same = true;
        if (depth < 3) for (let q = 0; q <= 2 && same; q++) for (let p = 0; p <= 2; p++) if (S(u0 + (p * 0.5 + (p === 1 ? 0 : p === 0 ? 0.05 : -0.05)) * w, v0 + (q * 0.5 + (q === 1 ? 0 : q === 0 ? 0.05 : -0.05)) * w) !== s0) { same = false; break; }
        if (!same) { const h = w / 2; quad(u0, v0, h, depth + 1); quad(u0 + h, v0, h, depth + 1); quad(u0, v0 + h, h, depth + 1); quad(u0 + h, v0 + h, h, depth + 1); return; }
        const u1 = u0 + w, v1 = v0 + w;
        tri(Q(u0, v0), Q(u0, v1), Q(u1, v1), s0); tri(Q(u0, v0), Q(u1, v1), Q(u1, v0), s0);
      };
      quad(0, 0, 1, 0);
    };
    const tri = (A, B, C, s) => cb.tri(A, B, C, s);
    const n = cols - 1;
    for (let jj = 0; jj < n; jj += 2) for (let ii = 0; ii < n; ii += 2) {
      // the drawn diagonal runs (ii, jj)-(ii+1, jj+1); a 2x2 block may become 2 triangles
      // only if all nine nodes lie on one plane (to 2 mm) and share a surface
      let flat = ii + 2 <= n && jj + 2 <= n;
      if (flat) {
        const a = Y[jj * cols + ii], bq = Y[jj * cols + ii + 2], d = Y[(jj + 2) * cols + ii];
        const gx = (bq - a) / 2, gz = (d - a) / 2;
        for (let q = 0; q <= 2 && flat; q++) for (let p = 0; p <= 2 && flat; p++) if (Math.abs(Y[(jj + q) * cols + ii + p] - (a + gx * p + gz * q)) > 0.002) flat = false;
      }
      const s00 = surf(ii, jj);
      const anyCovered = covered(ii, jj) || (ii + 1 < n && covered(ii + 1, jj)) || (jj + 1 < n && covered(ii, jj + 1)) || (ii + 1 < n && jj + 1 < n && covered(ii + 1, jj + 1));
      if (flat && !anyCovered && s00 >= 0 && s00 === surf(ii + 1, jj) && s00 === surf(ii, jj + 1) && s00 === surf(ii + 1, jj + 1)) {
        tri(P(ii, jj), P(ii, jj + 2), P(ii + 2, jj + 2), s00); tri(P(ii, jj), P(ii + 2, jj + 2), P(ii + 2, jj), s00);
        continue;
      }
      for (let q = 0; q < 2; q++) for (let p = 0; p < 2; p++) {
        const I = ii + p, J = jj + q; if (I >= n || J >= n || covered(I, J)) continue;
        const s = surf(I, J);
        if (s < 0) { mixed(I, J); continue; }
        tri(P(I, J), P(I, J + 1), P(I + 1, J + 1), s); tri(P(I, J), P(I + 1, J + 1), P(I + 1, J), s);
      }
    }
  }

  function colliderMeshes(cb, name) {
    const out = [];
    const tris = cb.triangles;
    const PER = 16000;
    for (let start = 0; start < tris; start += PER) {
      const end = Math.min(tris, start + PER);
      const pos = new Float32Array(cb.pos.slice(start * 9, end * 9));
      const surf = new Uint8Array(cb.surf.slice(start * 3, end * 3));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('surface', new THREE.BufferAttribute(surf, 1));
      out.push({ g, name });
    }
    return out;
  }

  // Far level: coarse terrain + buildings. Generator (time-sliced).
  function* buildFar(c) {
    const group = new THREE.Group(); group.position.set(c.ox, 0, c.oz); group.name = `chunk ${c.key}`;
    const terr = terrainMesh(c, terrainHeights(c, 2, false));
    group.add(terr);
    yield;
    const vb = new Builder(BUILDING_ATTRS), cb = new ColliderBuilder();
    const list = (binned.get(c.key) || {}).buildings || [];
    let k = 0;
    for (const b of list) {
      try { addBuilding(ctx, b, vb, cb, c.ox, c.oz); } catch (e) { console.warn('[town] building', b.id, e); }
      if (++k % 12 === 0) yield;
    }
    if (vb.n) {
      const m = new THREE.Mesh(vb.geometry(), mats.building);
      m.castShadow = true; m.receiveShadow = true; m.name = 'buildings';
      group.add(m);
    }
    c.buildCb = cb;
    c.far = { group, terr };
    root.add(group);
    group.updateMatrixWorld(true);
    c.group = group;
  }
  // Near level: fine terrain, streets, colliders with BVHs.
  function* buildNear(c) {
    const vb = new Builder({ aSt: 4, aDir: 2 }), mb = new Builder({ aSt: 4, aDir: 2 }), cb = new ColliderBuilder();
    const T = terrainHeights(c, 1, true);
    const terr = terrainMesh(c, T);
    yield;
    yield* buildChunkStreets(ctx, c, vb, cb, mb);
    const streetMesh = vb.n ? new THREE.Mesh(vb.geometry(), mats.street) : null;
    if (streetMesh) { streetMesh.receiveShadow = true; streetMesh.castShadow = true; streetMesh.name = 'streets'; }
    // road paint sits 4 mm over the carriageway; a stronger depth offset keeps it on top
    const markMesh = mb.n ? new THREE.Mesh(mb.geometry(), mats.markings) : null;
    if (markMesh) { markMesh.receiveShadow = true; markMesh.name = 'markings'; markMesh.renderOrder = 1; }
    yield;
    const tc = new ColliderBuilder();
    terrainCollider(c, tc, T, slabRaster(cb));
    const e = binned.get(c.key) || { trees: [], props: [] };
    const oc = new ColliderBuilder();
    trees.addColliders(e.trees, oc, c.ox, c.oz);
    props.addColliders(e.props, oc, c.ox, c.oz);
    yield;
    const parts = [...colliderMeshes(tc, 'terrain'), ...colliderMeshes(c.buildCb || new ColliderBuilder(), 'buildings'), ...colliderMeshes(cb, 'streets'), ...colliderMeshes(oc, 'trees+props')];
    const meshes = [];
    for (const p of parts) {
      p.g.boundsTree = new MeshBVH(p.g, { strategy: CENTER, maxLeafTris: 12 });
      p.g.computeBoundingBox();
      const m = new THREE.Mesh(p.g); m.name = `collider ${c.key} ${p.name}`;
      m.position.set(c.ox, 0, c.oz); m.updateMatrixWorld(true);
      m.userData.box = p.g.boundingBox.clone().translate(m.position);
      meshes.push(m);
      stats.colliderTris += p.g.attributes.position.count / 3;
      yield;
    }
    // swap in
    if (!c.far) return;
    c.far.terr.visible = false;
    c.group.add(terr);
    if (streetMesh) c.group.add(streetMesh);
    if (markMesh) c.group.add(markMesh);
    c.near = { terr, streetMesh, markMesh };
    c.colliders = meshes;
  }
  function dropNear(c) {
    if (!c.near) return;
    for (const m of [c.near.terr, c.near.streetMesh, c.near.markMesh]) if (m) { c.group.remove(m); m.geometry.dispose(); }
    for (const m of c.colliders) { stats.colliderTris -= m.geometry.attributes.position.count / 3; m.geometry.boundsTree = null; m.geometry.dispose(); }
    c.colliders = [];
    c.near = null;
    if (c.far) c.far.terr.visible = true;
  }
  function dropFar(c) {
    dropNear(c);
    if (!c.group) return;
    root.remove(c.group);
    c.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    c.group = null; c.far = null; c.buildCb = null;
  }

  // ---------------------------------------------------------------- scheduler
  const focus = new THREE.Vector3(data.spawn ? data.spawn.x : 0, 0, data.spawn ? data.spawn.z : 0);
  const distTo = (c, p) => { const dx = Math.max(c.x0 - p.x, 0, p.x - (c.x0 + CHUNK)), dz = Math.max(c.z0 - p.z, 0, p.z - (c.z0 + CHUNK)); return Math.hypot(dx, dz); };
  function plan() {
    for (const c of chunks.values()) {
      const d = distTo(c, focus);
      // hysteresis: keep what is built a little longer than we would build it
      const nearIn = d < nearR, nearKeep = d < nearR + 70, farIn = d < farR, farKeep = d < farR * 1.15 + 100;
      if (c.level === 2) c.want = nearKeep ? 2 : farKeep ? 1 : 0;
      else if (c.level === 1) c.want = nearIn ? 2 : farKeep ? 1 : 0;
      else c.want = nearIn ? 2 : farIn ? 1 : 0;
      c.dist = d;
    }
  }
  function step(budgetMs) {
    const tEnd = performance.now() + budgetMs;
    facadeUniforms.focus.value.copy(focus);
    plan();
    // tear down first (cheap), then build nearest first
    for (const c of chunks.values()) {
      if (c.want < c.level && !c.task) {
        if (c.want <= 1 && c.level === 2) { dropNear(c); c.level = 1; }
        if (c.want === 0 && c.level >= 1) { dropFar(c); c.level = 0; }
      }
    }
    const todo = [...chunks.values()].filter((c) => c.want > c.level || c.task).sort((a, b) => (a.task ? -1 : 0) - (b.task ? -1 : 0) || a.dist - b.dist);
    for (const c of todo) {
      while (performance.now() < tEnd) {
        if (!c.task) {
          if (c.want <= c.level) break;
          c.task = c.level === 0 ? { gen: buildFar(c), to: 1 } : { gen: buildNear(c), to: 2 };
        }
        const r = c.task.gen.next();
        if (r.done) { c.level = c.task.to; c.task = null; }
      }
      if (performance.now() >= tEnd) break;
    }
    // detail layers
    if (performance.now() < tEnd) details.step(tEnd);
    stats.nearChunks = [...chunks.values()].filter((c) => c.level === 2).length;
  }
  function nearDone(p, r) {
    for (const c of chunks.values()) if (distTo(c, p) < r && (c.level < 2 || c.task)) return false;
    return true;
  }

  // ---------------------------------------------------------------- queries
  const _ray = new THREE.Ray(), _box = new THREE.Box3();
  function collidersNear(box) {
    const out = [];
    for (const c of chunks.values()) {
      if (!c.colliders.length) continue;
      if (box.max.x < c.x0 - 20 || box.min.x > c.x0 + CHUNK + 20 || box.max.z < c.z0 - 20 || box.min.z > c.z0 + CHUNK + 20) continue;
      for (const m of c.colliders) if (m.userData.box.intersectsBox(box)) out.push(m);
    }
    details.collidersNear(box, out);
    return out;
  }
  function raycast(origin, dir, far = 1000) {
    _box.makeEmpty(); _box.expandByPoint(origin); _box.expandByPoint(_ray.origin.copy(dir).multiplyScalar(far).add(origin));
    let best = null;
    for (const m of collidersNear(_box)) {
      const bvh = m.geometry.boundsTree; if (!bvh) continue;
      _ray.origin.copy(origin).sub(m.position); _ray.direction.copy(dir);
      const hit = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
      if (!hit || hit.distance > far || (best && hit.distance >= best.distance)) continue;
      const normal = hit.face.normal.clone();
      if (normal.dot(dir) > 0) normal.negate();
      const g = m.geometry, vi = g.index ? g.index.getX(hit.faceIndex * 3) : hit.faceIndex * 3;
      best = { point: hit.point.clone().add(m.position), normal, distance: hit.distance, surface: g.attributes.surface.getX(vi), object: m };
    }
    return best;
  }
  const _down = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3();
  // highest walkable surface under (x, z) starting from just above the street level
  function surfaceAt(x, z, above = 0.6) {
    const y0 = (ctx.H ? ctx.H(x, z) : hf.at(x, z)) + above;
    const h = raycast(_o.set(x, y0, z), _down, above + 3);
    if (!h) return null;
    return { x, z, y: h.point.y, surface: h.surface, normal: h.normal };
  }

  // ---------------------------------------------------------------- detail layers
  const details = createDetails({
    scene: root, chunkReady: (x, z) => { const c = chunks.get(keyOf(x, z)); return !c || (c.level === 2 && !c.task); },
    chunkKeyOf: keyOf,
    env: {
      surfaceAt, groundClass, fallen: assets.fallen, sprites: assets.sprites,
      treesNear: (x, z, r) => { const out = []; const g = treeGrid, cs = g.cell; for (let i = Math.floor((x - r) / cs); i <= Math.floor((x + r) / cs); i++) for (let j = Math.floor((z - r) / cs); j <= Math.floor((z + r) / cs); j++) { const a = g.map.get(i * 100003 + j); if (a) for (const p of a) out.push(p.data); } return out; },
      heightNear: (s, x, z) => s.y - (s.normal.x * (x - s.x) + s.normal.z * (z - s.z)) / Math.max(0.2, s.normal.y),
    },
  });
  // built-in layers proving the scale system
  // ground detail in tiers (ground.js): near 3D leaves and debris, mid cards and pebbles, street fixtures
  const view = createView();
  const atlas = buildAtlas(assets);
  const centreL = data.landmarks.find((l) => l.id === 'city-hall') || { x: 0, z: 0 };
  Object.assign(details.env, {
    groundClass,
    streetInfo: (x, z) => {
      const q = ctx.streets.grid.nearest(x, z, 30); if (!q) return null;
      const st = q.seg.data; let dx = q.seg.bx - q.seg.ax, dz = q.seg.bz - q.seg.az; const l = Math.hypot(dx, dz) || 1;
      return { d: q.d - st.hw, hw: st.hw, band: st.band, blv: st.blv, downtown: st.downtown, dx: dx / l, dz: dz / l };
    },
    roadsIn: (x0, z0, size) => { const set = new Set(); ctx.streets.grid.query(x0 + size / 2, z0 + size / 2, size * 0.75, (sg) => set.add(sg.data)); return [...set].filter((st) => !st.road.bridge).map((st) => ({ points: st.road.points, hw: st.hw, id: st.id })); },
    crossingsIn: (x0, z0, size) => (ctx.crosswalks || []).filter((c) => c.x > x0 - 15 && c.x < x0 + size + 15 && c.z > z0 - 15 && c.z < z0 + size + 15),
    // on the sidewalk's slabs (not the curb top, a grass or paved boulevard strip, or a plaza)
    onSlabs: (x, z, si) => !!si && si.d > 0.3 && si.d < si.band - 0.05 && (si.blv > 0.05 ? si.d > si.blv + 0.05 : si.blv < -0.05 ? si.d > 0.25 - si.blv : true) && !plazas.some((r) => r.z > r.x && x > r.x && x < r.z && z > r.y && z < r.w),
    downtownAt: (x, z) => { const q = ctx.streets.grid.nearest(x, z, 40); return (q && q.seg.data.downtown) || Math.hypot(x - centreL.x, z - centreL.z) < 120; },
  });
  const near = nearLayer(details.env, view.U, atlas.texture, view);
  details.add(near);
  details.add(midLayer(details.env, view.U, atlas.texture, view));
  details.add(fixturesLayer(details.env, view.U, atlas.texture, shared));
  details.add(grassLayer(details.env));
  // modelled street fronts near the focus
  const bByCell = new Map();
  for (const b of data.buildings) { const c = centroid(b.outer); const k = `${Math.floor(c[0] / 40)},${Math.floor(c[1] / 40)}`; let a = bByCell.get(k); if (!a) bByCell.set(k, a = []); a.push(b); }
  details.add(facadeLayer({
    ctx, material: mats.building,
    buildingsIn: (x0, z0, size) => (size === 40 ? bByCell.get(`${Math.round(x0 / 40)},${Math.round(z0 / 40)}`) || [] : data.buildings.filter((b) => { const c = centroid(b.outer); return c[0] >= x0 && c[0] < x0 + size && c[1] >= z0 && c[1] < z0 + size; })),
    setFlag: (i, on) => { const d = detailFlags.image.data; if (d[i] !== (on ? 255 : 0)) { d[i] = on ? 255 : 0; detailFlags.needsUpdate = true; } },
  }));

  // ---------------------------------------------------------------- world
  const spawn = { x: focus.x, y: 0, z: focus.z, yaw: data.spawn ? data.spawn.yaw : 0 };
  const landmarks = data.landmarks.map((l) => ({ ...l, y: hf.at(l.x, l.z) }));
  let elapsed = 0, disposed = false, pinned = null;
  const tmpFocus = new THREE.Vector3();

  const world = {
    scene, stats, quality,
    // credits for the map and the instructions (OpenStreetMap, Ontario open data, Mapillary)
    get attribution() { return data.attribution; },
    get scale() { return scale; },
    get collider() { const c = chunks.get(keyOf(focus.x, focus.z)); return c && c.colliders[0] || null; },
    groundAt: (x, z) => hf.at(x, z),
    waterAt: (x, z) => hf.waterAt(x, z),
    surfaceAt,
    spawn, landmarks,
    trees: ctx.trees.map((t) => ({ x: t.x, y: t.y, z: t.z, height: t.height, crown: t.crown, kind: t.kind, species: t.species, setting: t.setting, colours: [t.colIn, t.colOut], street: !!t.grate })),
    data,
    collidersNear, raycast,
    // residential buildings whose LiDAR height or flat roof was corrected (houses.js), worst first
    heightFixes: heightFixes.fixes,
    setScale(s) { if (s > 0 && s !== scale) { setScaleRadii(s); details.setScale(s); } },
    setFocus(p) { focus.set(p.x, p.y || 0, p.z); },
    addDetailLayer: (layer) => details.add(layer),
    removeDetailLayer: (id) => details.remove(id),
    setDetailLayerEnabled: (id, on) => details.enable(id, on),
    get detailLayers() { return details.list(); },
    // Resolves when the chunks and detail layers around p are built. Until then
    // p stays the streaming focus, whatever update() is told (a transition).
    ready(p) {
      if (p) { focus.set(p.x, p.y || 0, p.z); pinned = { x: p.x, y: p.y || 0, z: p.z }; }
      const pin = pinned;
      return new Promise((resolve) => {
        const t = performance.now();
        const tick = () => {
          if (disposed) return resolve(false);
          if (pin) focus.set(pin.x, pin.y, pin.z);
          step(40);
          details.update(focus, scale);
          if (nearDone(focus, Math.min(nearR, CHUNK * 0.75)) && details.done(focus)) { if (pinned === pin) pinned = null; stats.readyMs = Math.round(performance.now() - t); resolve(true); } else setTimeout(tick, 0);
        };
        tick();
      });
    },
    update(dt, camera, f) {
      elapsed += dt || 0;
      shared.uTime.value = elapsed;
      if (pinned) focus.set(pinned.x, pinned.y, pinned.z);
      else if (f) focus.set(f.x, f.y, f.z);
      else if (camera) focus.copy(camera.position);
      sky.update(camera, f || (camera && camera.position));
      facadeUniforms.focus.value.copy(focus);
      view.update(dt || 0, focus, camera, scale);
      details.tick(dt || 0, view);
      trees.update(focus, Q.treeNear * Math.max(0.6, Math.min(1.5, scale / 0.25)), farR * 0.9);
      props.update(focus, Q.propR);
      details.update(focus, scale);
      step(4);
    },
    setTimeOfDay: (h) => sky.setTimeOfDay(h),
    get timeOfDay() { return sky.hours; },
    // for the bench: the leaf piles (ground.js) near (x, z)
    // the surface id the terrain shader draws at (x, z) (its ground-map rule)
    debugCrosswalks: (x, z, r = 60) => (ctx.crosswalks || []).filter((c) => Math.hypot(c.x - x, c.z - z) < r),
    debugDrawnTerrain: (x, z) => (hf.waterAt(x, z) !== null ? SURFACE.water_bed : groundClass.drawn(x, z)),
    debugFixtures: (x, z, r = 40) => { const out = []; root.traverse((o) => { for (const f of o.userData.fixtures || []) if (Math.hypot(f.x - x, f.z - z) < r) out.push(f); }); return out; },
    debugPiles: (x, z, r = 30) => pilesOf(details.env, details.env.treesNear(x, z, r + 14), x - r, z - r, 2 * r).map((p) => ({ x: p.x, z: p.z, y: p.y, R: p.R, H: p.H })),
    // for tests and probes: the visible ground-level meshes of the chunks
    // around (x, z) (terrain, streets, buildings) and of the detail layers
    debugGroundMeshes(x, z, r = 30) {
      const out = [];
      for (const c of chunks.values()) {
        if (!c.group || x < c.x0 - r || x > c.x0 + CHUNK + r || z < c.z0 - r || z > c.z0 + CHUNK + r) continue;
        c.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.parent && o.parent.visible) out.push(o); });
      }
      root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.userData.detailLayer && !o.userData.notGround) out.push(o); });
      return out;
    },
    buildingAt(x, z) { const b = ctx.buildingAt(x, z); return b ? b.id : null; },
    // for tests and benches: the house lots near (x, z) (lots.js): type, porch post, fences, drive, garage
    debugLots: (x, z, r = 60) => (ctx.lots || []).filter((l) => Math.hypot(l.F.a[0] - x, l.F.a[1] - z) < r).map((l) => {
      const pp = porchPlan(l.b, l.P, l.F, l.P.style);
      return { id: l.b.id, type: l.P.style.type, porch: pp && { kind: pp.kind, roofed: pp.roofed, post: pp.roofed ? l.F.P(pp.s0 + 0.12, -pp.depth + 0.12) : null, out: [l.F.nx, l.F.nz], deck: l.F.P(pp.s0 + pp.w / 2, -pp.depth / 2) },
        fences: l.fences.map((f) => ({ type: f.type, p0: f.p0, p1: f.p1 })), shrubs: l.shrubs.length, drive: !!l.drive, garage: l.garage ? l.garage.id : null };
    }),
    debugChunk(x, z) { const c = chunks.get(keyOf(x, z)); return c && { key: c.key, level: c.level, want: c.want, task: !!c.task, colliders: c.colliders.length, error: c.error || null }; },
    get chunkSize() { return CHUNK; },
    get chunkOrigin() { return { x: X0, z: Z0 }; },
    // counts for benches and tests
    info() {
      const lv = [0, 0, 0]; for (const c of chunks.values()) lv[c.level]++;
      // live geometries the town holds (visual meshes in the scene, chunk and detail colliders)
      const seen = new Set(); root.traverse((o) => { if (o.geometry) seen.add(o.geometry); });
      let cols = 0; for (const c of chunks.values()) cols += c.colliders.length;
      const box = new THREE.Box3(new THREE.Vector3(-1e9, -1e9, -1e9), new THREE.Vector3(1e9, 1e9, 1e9)); const dc = []; details.collidersNear(box, dc);
      return { geometries: seen.size + cols + dc.length, chunks: chunks.size, far: lv[1], near: lv[2], colliders: [...chunks.values()].reduce((s, c) => s + c.colliders.length, 0), colliderTris: stats.colliderTris, detailCells: details.count(), nearR, farR, scale, zoom: +view.zoom.toFixed(2), groundNearR: +view.rNear.toFixed(2), leavesFlying: near.flying };
    },
    dispose() {
      disposed = true;
      for (const c of chunks.values()) dropFar(c);
      details.dispose();
      trees.dispose(); props.dispose(); sky.dispose();
      if (water) { water.geometry.dispose(); }
      for (const k in mats) mats[k].dispose();
      ground.texA.dispose(); ground.texB.dispose(); detailFlags.dispose(); surveyTex.dispose(); gdTex.dispose(); atlas.texture.dispose();
      for (const t of Object.values(assets.tex)) t.texture.dispose();
      assets.sky?.texture.dispose(); for (const t of Object.values(assets.sprites)) t.dispose?.();
      assets.facadeArray?.dispose();
      scene.remove(root);
    },
  };
  void tmpFocus; void disposeObject; void rng;

  progress(0.5, 'Building the town');
  // build what the spawn sees, reporting progress
  focus.set(spawn.x, 0, spawn.z);
  details.setScale(scale);
  await new Promise((resolve) => {
    const tick = () => {
      step(30);
      const want = [...chunks.values()].filter((c) => c.want > 0);
      const doneN = want.filter((c) => c.level >= c.want && !c.task).length;
      progress(0.5 + 0.5 * (doneN / Math.max(1, want.length)), 'Building the town');
      if (doneN >= want.length) resolve(); else setTimeout(tick, 0);
    };
    tick();
  });
  trees.update(focus, Q.treeNear, farR * 0.9);
  props.update(focus, Q.propR);
  const s = surfaceAt(spawn.x, spawn.z, 2);
  spawn.y = s ? s.y : hf.at(spawn.x, spawn.z);
  stats.buildMs = Math.round(performance.now() - t0);
  progress(1, 'Ready');
  return world;
}

// One mesh for the open water (each piece at its own level).
function buildWater(data, mat) {
  const polys = data.water.all; if (!polys.length) return null;
  const b = new Builder({});
  const c = centroid(polys[0].outer);
  for (const p of polys) {
    const toV = (l) => l.map((q) => new THREE.Vector2(q[0], q[1]));
    let faces; try { faces = THREE.ShapeUtils.triangulateShape(toV(p.outer), p.holes.map(toV)); } catch { continue; }
    const all = p.outer.concat(...p.holes);
    const ids = all.map((q) => b.v(q[0] - c[0], p.level, q[1] - c[1], 0, 1, 0));
    for (const f of faces) {
      const A = all[f[0]], B = all[f[1]], C = all[f[2]];
      const up = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]) > 0;
      if (up) b.tri(ids[f[0]], ids[f[1]], ids[f[2]]); else b.tri(ids[f[0]], ids[f[2]], ids[f[1]]);
    }
  }
  const m = new THREE.Mesh(b.geometry(), mat); m.position.set(c[0], 0, c[1]); m.name = 'water'; m.receiveShadow = false;
  return m;
}

// Ground classes on a 1 m grid from the ground map: 0 grass, 1 park, 2 asphalt,
// 3 concrete, 4 gravel, 5 leaf litter.
function classMap(ground, hf) {
  const [ca, cbv] = ground.canvases;
  const w = ca.width, h = ca.height;
  const A = ca.getContext('2d').getImageData(0, 0, w, h).data, B = cbv.getContext('2d').getImageData(0, 0, w, h).data;
  const cls = new Uint8Array(w * h);
  // the channels the terrain shader decides walkable kinds by (asphalt, concrete, gravel, dirt)
  const ch = [new Uint8Array(w * h), new Uint8Array(w * h), new Uint8Array(w * h), new Uint8Array(w * h)];
  for (let i = 0, k = 0; i < w * h; i++, k += 4) {
    cls[i] = A[k] > 127 ? 2 : A[k + 1] > 127 ? 3 : A[k + 2] > 127 ? 4 : B[k] > 140 ? 5 : B[k + 1] > 127 ? 1 : 0;
    ch[0][i] = A[k]; ch[1][i] = A[k + 1]; ch[2][i] = A[k + 2]; ch[3][i] = B[k + 2];
  }
  const W = (hf.nx - 1) * hf.cell, D = (hf.nz - 1) * hf.cell;
  const fn = (x, z) => {
    const i = Math.floor(((x - hf.x0) / W) * w), j = Math.floor(((z - hf.z0) / D) * h);
    if (i < 0 || j < 0 || i >= w || j >= h) return 0;
    return cls[j * w + i];
  };
  // The surface the terrain shader draws at (x, z): its texture lookup (bilinear between
  // texel centres) of each channel against 0.5, asphalt over concrete over gravel over dirt.
  const lin = (c, x, z) => {
    const fx = ((x - hf.x0) / W) * w - 0.5, fz = ((z - hf.z0) / D) * h - 0.5;
    const i = Math.max(0, Math.min(w - 2, Math.floor(fx))), j = Math.max(0, Math.min(h - 2, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j)), k = j * w + i;
    return ((c[k] * (1 - u) + c[k + 1] * u) * (1 - v) + (c[k + w] * (1 - u) + c[k + w + 1] * u) * v) / 255;
  };
  fn.drawn = (x, z) => (lin(ch[0], x, z) > 0.5 ? SURFACE.road : lin(ch[1], x, z) > 0.5 ? SURFACE.sidewalk : lin(ch[2], x, z) > 0.5 || lin(ch[3], x, z) > 0.5 ? SURFACE.ground : SURFACE.grass);
  return fn;
}

// ---------------------------------------------------------------- detail-layer manager
function createDetails({ scene, chunkReady, chunkKeyOf, env }) {
  const layers = new Map();     // id -> { layer, enabled, cells: Map }
  let scale = 0.25;
  const focus = new THREE.Vector3();
  const queue = [];
  const active = (L) => L.enabled && scale >= (L.layer.minScale ?? 0) && scale <= (L.layer.maxScale ?? Infinity);
  const cellsAround = (L, p) => {
    const cs = L.layer.cellSize || 4, r = L.layer.radius || 20, out = [];
    for (let i = Math.floor((p.x - r) / cs); i <= Math.floor((p.x + r) / cs); i++) for (let j = Math.floor((p.z - r) / cs); j <= Math.floor((p.z + r) / cs); j++) {
      const cx = (i + 0.5) * cs, cz = (j + 0.5) * cs;
      if (Math.hypot(cx - p.x, cz - p.z) <= r + cs * 0.71) out.push([i, j]);
    }
    return out;
  };
  const drop = (L, key) => {
    const cell = L.cells.get(key); if (!cell) return;
    if (cell.onDrop) { try { cell.onDrop(); } catch (e) { console.warn(e); } }
    if (cell.object) { scene.remove(cell.object); cell.object.traverse((o) => o.geometry && o.geometry.dispose()); }
    for (const m of cell.colliders || []) { m.geometry.boundsTree = null; m.geometry.dispose(); }
    L.cells.delete(key);
  };
  const api = {
    env,
    add(layer) {
      if (!layer || !layer.id || typeof layer.build !== 'function') throw new Error('addDetailLayer: { id, build } required');
      if (layers.has(layer.id)) api.remove(layer.id);
      layers.set(layer.id, { layer, enabled: true, cells: new Map() });
      return layer.id;
    },
    remove(id) { const L = layers.get(id); if (!L) return; for (const k of [...L.cells.keys()]) drop(L, k); L.layer.dispose?.(); layers.delete(id); },
    enable(id, on) { const L = layers.get(id); if (L) { L.enabled = !!on; if (!on) for (const k of [...L.cells.keys()]) drop(L, k); } },
    list() { return [...layers.values()].map((L) => ({ id: L.layer.id, minScale: L.layer.minScale, maxScale: L.layer.maxScale, radius: L.layer.radius, enabled: L.enabled, active: active(L), cells: L.cells.size })); },
    setScale(s) { scale = s; for (const L of layers.values()) if (!active(L)) for (const k of [...L.cells.keys()]) drop(L, k); },
    update(p) {
      focus.copy(p);
      queue.length = 0;
      for (const L of layers.values()) {
        const r = (L.layer.radius || 20) * 1.3 + (L.layer.cellSize || 4);
        for (const [k, cell] of L.cells) if (Math.hypot(cell.cx - p.x, cell.cz - p.z) > r) drop(L, k);
        if (!active(L)) continue;
        for (const [i, j] of cellsAround(L, p)) {
          const key = `${i},${j}`; if (L.cells.has(key)) continue;
          const cs = L.layer.cellSize || 4;
          queue.push({ L, i, j, key, d: Math.hypot((i + 0.5) * cs - p.x, (j + 0.5) * cs - p.z) });
        }
      }
      queue.sort((a, b) => a.d - b.d);
    },
    step(tEnd) {
      while (queue.length && performance.now() < tEnd) {
        const q = queue.shift();
        const { L, i, j, key } = q;
        const cs = L.layer.cellSize || 4, x0 = i * cs, z0 = j * cs;
        if (!chunkReady(x0 + cs / 2, z0 + cs / 2)) continue;
        if (L.cells.has(key)) continue;
        const seed = cellSeed(L.layer.id, i, j);
        let s = (Math.floor(seed * 4294967296) >>> 0) || 1;
        const rngf = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
        const cell = { key, i, j, x0, z0, size: cs, ox: x0, oz: z0, seed, rng: rngf, scale };
        let res = null;
        try { res = L.layer.build(chunkKeyOf(x0 + cs / 2, z0 + cs / 2), cell); } catch (e) { console.warn('[town] detail layer', L.layer.id, e); }
        const entry = { cx: x0 + cs / 2, cz: z0 + cs / 2, object: null, colliders: [], onDrop: res && res.onDrop };
        if (res && res.object) { res.object.position.set(x0, 0, z0); res.object.updateMatrixWorld(true); res.object.traverse((o) => { o.userData.detailLayer = L.layer.id; }); scene.add(res.object); entry.object = res.object; }
        if (res && res.colliders) for (const m of res.colliders) {
          m.position.set(x0, 0, z0); m.updateMatrixWorld(true);
          if (!m.geometry.boundsTree) m.geometry.boundsTree = new MeshBVH(m.geometry);
          m.geometry.computeBoundingBox(); m.userData.box = m.geometry.boundingBox.clone().translate(m.position);
          entry.colliders.push(m);
        }
        L.cells.set(key, entry);
      }
    },
    done(p) {
      for (const L of layers.values()) {
        if (!active(L)) continue;
        for (const [i, j] of cellsAround(L, p)) if (!L.cells.has(`${i},${j}`)) return false;
      }
      return true;
    },
    collidersNear(box, out) {
      for (const L of layers.values()) for (const e of L.cells.values()) for (const m of e.colliders) if (m.userData.box.intersectsBox(box)) out.push(m);
    },
    count() { let n = 0; for (const L of layers.values()) n += L.cells.size; return n; },
    // per-frame behaviour of the built cells (leaves kicked up, piles burst)
    tick(dt, view) { for (const L of layers.values()) if (L.layer.tick && active(L)) { try { L.layer.tick(dt, view); } catch (e) { console.warn('[town] detail layer', L.layer.id, e); } } },
    dispose() { for (const id of [...layers.keys()]) api.remove(id); },
  };
  return api;
}
