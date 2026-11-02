// node --test stratford/prototype/game/test/town-data.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const town = JSON.parse(fs.readFileSync(path.join(dir, 'town.json'), 'utf8'));
const B = town.bounds;
const fin = (v) => Number.isFinite(v);
const inside = (x, z, m = 0.5) => x >= B.minX - m && x <= B.maxX + m && z >= B.minZ - m && z <= B.maxZ + m;
const pip = (x, z, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

test('top-level schema', () => {
  for (const k of ['version', 'origin', 'bounds', 'attribution', 'terrain', 'buildings', 'roads', 'areas', 'water', 'trees', 'railways', 'landmarks', 'spawn'])
    assert.ok(k in town, 'missing ' + k);
  assert.equal(town.version, 1);
  assert.ok(fin(town.origin.lat) && fin(town.origin.lon) && fin(town.origin.elev));
  assert.ok(B.maxX - B.minX > 2900 && B.maxZ - B.minZ > 1800, 'full extent kept');
  assert.match(town.attribution, /OpenStreetMap/);
});

test('buildings', () => {
  assert.ok(town.buildings.length > 3000);
  const roofs = ['flat', 'gabled', 'hipped', 'pyramidal', 'dome', 'mansard'];
  const uses = ['commercial', 'residential', 'civic', 'church', 'theatre', 'industrial', 'garage', 'shed', 'other'];
  const mats = ['brick_red', 'brick_buff', 'stone', 'clapboard', 'stucco', 'glass', 'metal'];
  const ids = new Set();
  for (const b of town.buildings) {
    assert.ok(!ids.has(b.id), 'duplicate id ' + b.id); ids.add(b.id);
    assert.ok(b.outer.length >= 3, b.id);
    const f = b.outer[0], l = b.outer[b.outer.length - 1];
    assert.ok(!(f[0] === l[0] && f[1] === l[1]), 'self-closing polygon ' + b.id);
    for (const [x, z] of b.outer) { assert.ok(fin(x) && fin(z), b.id); assert.ok(inside(x, z, 60), b.id); }
    assert.ok(area(b.outer) < 0, 'outer must be CCW seen from above (negative shoelace in x,z): ' + b.id);
    for (const h of b.holes || []) { const a = h[0], c = h[h.length - 1]; assert.ok(!(a[0] === c[0] && a[1] === c[1])); }
    assert.ok(b.height > 0 && fin(b.height), 'height ' + b.id);
    assert.ok(b.roofHeight >= 0 && fin(b.roofHeight) && fin(b.base));
    assert.ok(roofs.includes(b.roof) && uses.includes(b.use) && mats.includes(b.material), b.id);
    if (b.roof === 'flat') assert.equal(b.roofHeight, 0);
    assert.ok(b.height < 60);
    if (b.front) assert.ok(b.front[0] < b.outer.length && b.front[1] < b.outer.length);
  }
});

test('roads, areas, water, railways, trees', () => {
  assert.ok(town.roads.length > 1000);
  for (const r of town.roads) { assert.ok(r.width > 0 && r.points.length >= 2); for (const [x, z] of r.points) assert.ok(fin(x) && fin(z) && inside(x, z)); }
  for (const a of town.areas) { assert.ok(a.outer.length >= 3); for (const [x, z] of a.outer) assert.ok(fin(x) && fin(z) && inside(x, z)); const f = a.outer[0], l = a.outer[a.outer.length - 1]; assert.ok(!(f[0] === l[0] && f[1] === l[1])); }
  assert.ok(town.water.polygons.length >= 1 && fin(town.water.level));
  let big = 0;
  for (const w of town.water.polygons) { assert.ok(fin(w.level)); big += Math.abs(area(w.outer)); }
  assert.ok(big > 100000, 'Avon River and Lake Victoria polygons present');
  assert.ok(town.water.rivers.some((r) => r.name === 'Avon River' && r.width > 5));
  assert.ok(town.railways.length > 5);
  assert.ok(town.trees.length > 1000);
  for (const t of town.trees) { assert.ok(fin(t.x) && fin(t.z) && inside(t.x, t.z) && t.height > 0 && t.crown > 0); assert.ok(['maple', 'oak', 'willow', 'spruce', 'linden', 'other'].includes(t.kind)); }
});

test('terrain.bin matches its description', () => {
  const T = town.terrain;
  const st = fs.statSync(path.join(dir, T.file));
  assert.equal(st.size, T.nx * T.nz * 2);
  assert.equal(T.cell, 4);
  assert.ok(T.x0 <= B.minX && T.x0 + (T.nx - 1) * T.cell >= B.maxX);
  assert.ok(T.z0 <= B.minZ && T.z0 + (T.nz - 1) * T.cell >= B.maxZ);
  const buf = fs.readFileSync(path.join(dir, T.file));
  const v = new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2);
  let mx = 0; for (const a of v) if (a > mx) mx = a;
  assert.ok(mx > 100 && mx < 6000, 'relief between 1 m and 60 m: ' + mx / 100);
  // origin should be near y = 0
  const gi = Math.round((0 - T.x0) / T.cell), gj = Math.round((0 - T.z0) / T.cell);
  const y = T.minElev + v[gj * T.nx + gi] / 100 - town.origin.elev;
  assert.ok(Math.abs(y) < 1.5, 'origin ground y ' + y);
});

test('landmarks and spawn', () => {
  const want = ['city-hall', 'courthouse', 'market-square', 'avon-theatre', 'festival-theatre', 'tom-patterson-theatre', 'avon-river', 'lake-victoria',
    'shakespearean-gardens', 'normal-school', 'knox-church', 'st-james-church', 'railway-station', 'gallery-stratford', 'archives'];
  const ids = town.landmarks.map((l) => l.id);
  for (const w of want) assert.ok(ids.includes(w), 'missing landmark ' + w);
  assert.ok(town.landmarks.length >= 15 && town.landmarks.length <= 22);
  const bmap = new Map(town.buildings.map((b) => [b.id, b]));
  for (const l of town.landmarks) {
    assert.ok(fin(l.x) && fin(l.z) && inside(l.x, l.z, 0) && l.radius > 0, l.id);
    assert.ok(l.blurb.length > 30 && l.blurb.length < 400, l.id);
    if (l.buildingId) assert.ok(bmap.has(l.buildingId), l.id);
  }
  const s = town.spawn;
  assert.ok(fin(s.x) && fin(s.z) && fin(s.yaw));
  for (const b of town.buildings) assert.ok(!pip(s.x, s.z, b.outer), 'spawn inside building ' + b.id);
  const ch = town.landmarks.find((l) => l.id === 'city-hall');
  assert.ok(Math.hypot(s.x - ch.x, s.z - ch.z) < 80, 'spawn in Market Square near City Hall');
  for (const w of town.water.polygons) assert.ok(!pip(s.x, s.z, w.outer), 'spawn in water');
  // facing City Hall: forward = (-sin yaw, -cos yaw)
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const dx = ch.x - s.x, dz = ch.z - s.z, d = Math.hypot(dx, dz);
  assert.ok((fx * dx + fz * dz) / d > 0.95, 'spawn faces City Hall');
});

test('size budget', () => {
  let total = 0;
  for (const f of fs.readdirSync(dir)) total += fs.statSync(path.join(dir, f)).size;
  assert.ok(total < 8 * 1024 * 1024, 'game/data is ' + total + ' bytes');
});
