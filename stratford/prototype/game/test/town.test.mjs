// The town on the World contract, built headlessly in Chromium (Playwright)
// through the lab bench (lab/town.html): from the real data, and from the
// small fixture. Run: node --test stratford/prototype/game/test/town.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, serve } from '../../../../shared/test/lib.mjs';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const SURF = { ground: 0, road: 1, sidewalk: 2, grass: 3, wall_brick: 4, wall_stone: 5, wall_wood: 6, wall_smooth: 7, roof: 8 };
let srv, browser;
before(async () => { srv = await serve(GAME); browser = await launch(); });
after(async () => { await browser?.close(); srv?.close(); });

async function openTown(query = '') {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${srv.url}/lab/town.html${query}`);
  await page.waitForFunction(() => window.bench, null, { timeout: 180000 });
  return { page, errors };
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function hasRealData() { try { await access(join(GAME, 'data/town.json')); return true; } catch { return false; } }

test('town builds from the data and answers the World contract', { timeout: 600000 }, async () => {
  const real = await hasRealData();
  const json = JSON.parse(await readFile(join(GAME, real ? 'data/town.json' : 'test/fixtures/town-mini.json'), 'utf8'));
  const { page, errors } = await openTown(real ? '' : '?data=fixture');
  try {
    const r = await page.evaluate(() => {
      const w = bench.world, sp = w.spawn;
      return { spawn: sp, ground: w.groundAt(sp.x, sp.z), stats: w.stats, info: w.info(), ids: w.landmarks.map((l) => l.id) };
    });
    assert.ok(Number.isFinite(r.ground), 'groundAt at the spawn is finite');
    assert.ok(Number.isFinite(r.spawn.y), 'spawn has a height');
    assert.deepEqual(r.ids, json.landmarks.map((l) => l.id), 'landmarks match the data');
    // colliders near the spawn: BVH + surface attribute
    const col = await page.evaluate(() => {
      const w = bench.world, sp = w.spawn;
      const meshes = w.collidersNear(bench.box(sp.x - 4, sp.y - 4, sp.z - 4, sp.x + 4, sp.y + 4, sp.z + 4));
      return meshes.map((m) => ({ bvh: !!m.geometry.boundsTree, surf: !!m.geometry.attributes.surface, n: m.geometry.attributes.position.count / 3, inScene: !!m.parent }));
    });
    assert.ok(col.length > 0, 'collidersNear finds chunk colliders at the spawn');
    for (const m of col) { assert.ok(m.bvh, 'collider has a BVH'); assert.ok(m.surf, 'collider has a surface attribute'); assert.ok(!m.inScene, 'colliders are not in the scene'); }
    // a downward ray at the spawn lands on the ground, not a roof
    const down = await page.evaluate(() => {
      const w = bench.world, sp = w.spawn;
      const h = w.raycast(bench.vec(sp.x, sp.y + 30, sp.z), bench.vec(0, -1, 0), 60);
      return h && { y: h.point.y, surface: h.surface, d: h.distance, ny: h.normal.y };
    });
    assert.ok(down, 'downward ray hits');
    assert.ok([SURF.ground, SURF.road, SURF.sidewalk, SURF.grass].includes(down.surface), `spawn ray hits ground, not ${down.surface}`);
    assert.ok(down.ny > 0.7, 'ground normal points up');
    // a horizontal ray into City Hall's wall hits a wall
    const wall = await page.evaluate(() => {
      const w = bench.world, b = w.data.buildings.find((q) => q.id === 'w164420370') || w.data.buildings.find((q) => q.use === 'commercial');
      const o = b.outer, a = o[0], c = o[1];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]), nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const y = (Number.isFinite(b.base) ? b.base : w.groundAt(mx, mz)) + Math.min(5, b.height * 0.5);
      const h = w.raycast(bench.vec(mx + nx * 8, y, mz + nz * 8), bench.vec(-nx, 0, -nz), 20);
      return h && { surface: h.surface, d: h.distance };
    });
    assert.ok(wall, 'wall ray hits');
    assert.ok([SURF.wall_brick, SURF.wall_stone, SURF.wall_wood, SURF.wall_smooth].includes(wall.surface), `wall ray hits a wall (got ${wall.surface})`);
    assert.ok(Math.abs(wall.d - 8) < 1.5, `wall is where the footprint says (${wall.d.toFixed(2)} m)`);
    // budget from the spawn view, at the creature's eye and from above
    const views = await page.evaluate(async () => {
      const w = bench.world, sp = w.spawn, out = [];
      const la = w.data.spawn && w.data.spawn.lookAt;
      for (const [h, pitch] of [[0.1, 0.05], [30, -0.5]]) {
        bench.setMode('fly');
        bench.set(sp.x, sp.y + h, sp.z, sp.yaw, pitch);
        if (la) bench.look(la[0], sp.y + (h > 1 ? 0 : 8), la[1]);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
        const i = bench.renderer.info.render;
        out.push({ calls: i.calls, tris: i.triangles });
      }
      return out;
    });
    for (const v of views) {
      assert.ok(v.calls > 10 && v.calls < 300, `draw calls under 300 (${v.calls})`);
      assert.ok(v.tris < 1.5e6, `triangles under 1.5 M (${v.tris})`);
    }
    console.log(`  build ${r.stats.buildMs} ms (prep ${r.stats.prepMs}), chunks ${r.info.chunks} (${r.info.near} near), collider tris ${r.info.colliderTris}, views ${JSON.stringify(views)}`);
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await page.close(); }
});

test('chunks stream: moving the focus frees chunks and keeps memory flat; scale switches detail layers', { timeout: 900000 }, async () => {
  const real = await hasRealData();
  // no rendering: the software GL in CI takes about a second a frame, which would starve the streaming
  const { page, errors } = await openTown(real ? '?norender' : '?norender&data=fixture');
  try {
    const res = await page.evaluate(async () => {
      const w = bench.world, sp = w.spawn;
      const far = w.landmarks.reduce((a, l) => (Math.hypot(l.x - sp.x, l.z - sp.z) > Math.hypot(a.x - sp.x, a.z - sp.z) ? l : a), w.landmarks[0]);
      const go = async (p) => { bench.set(p.x, w.groundAt(p.x, p.z) + 2, p.z, 0, 0); await w.ready({ x: p.x, y: 0, z: p.z }); for (let i = 0; i < 40; i++) { w.update(0.016, bench.camera, bench.vec(p.x, w.groundAt(p.x, p.z), p.z)); } await w.ready({ x: p.x, y: 0, z: p.z }); };
      const snap = () => ({ ...w.info(), geo: w.info().geometries });
      const out = { far: { id: far.id, d: Math.hypot(far.x - sp.x, far.z - sp.z) } };
      bench.setMode('fly');
      await go(sp); out.a = snap();
      out.spawnCols = w.collidersNear(bench.box(sp.x - 2, -100, sp.z - 2, sp.x + 2, 100, sp.z + 2)).length;
      await go(far); out.b = snap();
      out.spawnColsAway = w.collidersNear(bench.box(sp.x - 2, -100, sp.z - 2, sp.x + 2, 100, sp.z + 2)).length;
      out.farCols = w.collidersNear(bench.box(far.x - 2, -100, far.z - 2, far.x + 2, 100, far.z + 2)).length;
      for (let k = 0; k < 2; k++) { await go(sp); await go(far); }
      out.c = snap();
      await go(sp); out.d = snap();
      // query API shape
      const h = w.raycast(bench.vec(sp.x, sp.y + 20, sp.z), bench.vec(0, -1, 0), 50);
      out.ray = h && { keys: Object.keys(h).sort(), finite: [h.point.x, h.point.y, h.point.z, h.distance].every(Number.isFinite) };
      out.miss = w.raycast(bench.vec(sp.x, sp.y + 20, sp.z), bench.vec(0, 1, 0), 50);
      // scale: grass blades at insect scale, leaves at squirrel scale
      w.setScale(0.01); await w.ready({ x: sp.x, y: 0, z: sp.z });
      const L1 = Object.fromEntries(w.detailLayers.map((l) => [l.id, l]));
      out.small = { grass: L1['grass-blades'].active, grassCells: L1['grass-blades'].cells, leaves: L1['leaves-pebbles'].active };
      w.setScale(0.25); await w.ready({ x: sp.x, y: 0, z: sp.z });
      const L2 = Object.fromEntries(w.detailLayers.map((l) => [l.id, l]));
      out.big = { grass: L2['grass-blades'].active, grassCells: L2['grass-blades'].cells, leaves: L2['leaves-pebbles'].active, leafCells: L2['leaves-pebbles'].cells };
      // a custom detail layer: seeded by position, deterministic
      const seen = [];
      const layer = { id: 'probe', minScale: 0, maxScale: 10, radius: 6, cellSize: 4, build(chunkKey, cell) { seen.push(`${cell.key}:${cell.rng().toFixed(8)}:${chunkKey}`); return null; } };
      w.addDetailLayer(layer); await w.ready({ x: sp.x, y: 0, z: sp.z });
      const first = seen.slice().sort();
      w.removeDetailLayer('probe'); seen.length = 0;
      w.addDetailLayer(layer); await w.ready({ x: sp.x, y: 0, z: sp.z });
      out.probe = { n: first.length, same: JSON.stringify(first) === JSON.stringify(seen.slice().sort()), chunkKey: first[0] && first[0].split(':')[2] };
      w.removeDetailLayer('probe');
      return out;
    });
    assert.ok(res.far.d > 600, `the far landmark is far away (${res.far.id}, ${res.far.d | 0} m)`);
    assert.ok(res.spawnCols > 0, 'colliders at the spawn');
    assert.equal(res.spawnColsAway, 0, 'the spawn chunk colliders are freed after moving away');
    assert.ok(res.farCols > 0, 'colliders at the far landmark');
    assert.ok(res.b.near <= res.a.near + 4 && res.b.near > 0, 'a bounded number of near chunks');
    assert.ok(res.a.geo > 50, `geometries are counted (${res.a.geo})`);
    assert.ok(res.c.geo <= res.b.geo * 1.15 + 20, `memory stays flat over round trips (geometries ${res.b.geo} -> ${res.c.geo})`);
    assert.ok(res.d.geo <= res.a.geo * 1.15 + 20, `memory at the spawn is the same after the trips (${res.a.geo} -> ${res.d.geo})`);
    assert.ok(Math.abs(res.d.colliderTris - res.a.colliderTris) < res.a.colliderTris * 0.15 + 1000, 'collider triangles return to the same count');
    assert.deepEqual(res.ray.keys, ['distance', 'normal', 'object', 'point', 'surface']);
    assert.ok(res.ray.finite);
    assert.equal(res.miss, null, 'a ray into the sky misses');
    assert.ok(res.small.grass && res.small.grassCells > 0 && !res.small.leaves, 'grass blades at 1 cm scale, no leaves layer');
    assert.ok(!res.big.grass && res.big.grassCells === 0 && res.big.leaves && res.big.leafCells > 0, 'leaves at squirrel scale, grass blades freed');
    assert.ok(res.probe.n > 0 && res.probe.same, 'a custom detail layer is built and seeded by position');
    assert.match(res.probe.chunkKey, /^\d+,\d+$/);
    console.log(`  near ${res.a.near}/${res.b.near}, geometries ${res.a.geo} -> ${res.b.geo} -> ${res.c.geo} -> ${res.d.geo}`);
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await page.close(); }
});

test('the fixture town builds too', { timeout: 300000 }, async () => {
  const fx = JSON.parse(await readFile(join(GAME, 'test/fixtures/town-mini.json'), 'utf8'));
  const { page, errors } = await openTown('?data=fixture&norender');
  try {
    const r = await page.evaluate(() => ({ ids: bench.world.landmarks.map((l) => l.id), n: bench.world.data.buildings.length, info: bench.world.info() }));
    assert.deepEqual(r.ids, fx.landmarks.map((l) => l.id));
    assert.equal(r.n, fx.buildings.length);
    assert.ok(r.info.near > 0);
    const left = await page.evaluate(() => { bench.world.dispose(); let n = 0; bench.scene.traverse((o) => { if (o.name === 'town') n++; }); return { n, fog: bench.scene.fog }; });
    assert.equal(left.n, 0, 'dispose removes the town from the scene');
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await page.close(); }
});
