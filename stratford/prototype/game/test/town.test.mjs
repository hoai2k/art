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
  page.on('console', (m) => { if (m.type() === 'error' || /^\[town\] (building|facade|detail layer)/.test(m.text())) errors.push(m.text()); });
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
    // horizontal rays into the back walls of houses near the spawn hit walls where the footprints say
    const wall = await page.evaluate(() => {
      const w = bench.world, sp = w.spawn, res = [];
      const near = w.data.buildings.filter((q) => q.use === 'residential' && q.height > 4 && Math.hypot(q.outer[0][0] - sp.x, q.outer[0][1] - sp.z) < 220).slice(0, 30);
      for (const b of near) {
        const o = b.outer, k = ((b.front >= 0 ? b.front : 0) + 2) % o.length, a = o[k], c = o[(k + 1) % o.length];
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 4) continue;
        const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
        const y = w.groundAt(mx + nx * 3, mz + nz * 3) + 1.5;
        const h = w.raycast(bench.vec(mx + nx * 3, y, mz + nz * 3), bench.vec(-nx, 0, -nz), 10);
        if (h) res.push({ surface: h.surface, d: h.distance });
      }
      return res;
    });
    const walls = [SURF.wall_brick, SURF.wall_stone, SURF.wall_wood, SURF.wall_smooth];
    const onWall = wall.filter((h) => Math.abs(h.d - 3) < 0.25 && walls.includes(h.surface));
    assert.ok(wall.length >= 5, `enough wall rays (${wall.length})`);
    assert.ok(onWall.length >= wall.length * 0.7, `rays hit the walls at the footprints (${onWall.length}/${wall.length})`);
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
    // see-through walls: a camera inside a detached house sees its dark interior, not the world
    const inside = await page.evaluate(async () => {
      const w = bench.world, sp = w.spawn, bs = w.data.buildings;
      const box = (b, m) => ({ x0: b.bb.minX - m, x1: b.bb.maxX + m, z0: b.bb.minZ - m, z1: b.bb.maxZ + m });
      const lone = bs.filter((b) => b.use === 'residential' && b.height > 5.5 && (b.bb.maxX - b.bb.minX) > 7 && (b.bb.maxZ - b.bb.minZ) > 7 && Math.hypot(b.outer[0][0] - sp.x, b.outer[0][1] - sp.z) < 250)
        .filter((b) => { const B = box(b, 3); return !bs.some((q) => q !== b && q.bb.maxX > B.x0 && q.bb.minX < B.x1 && q.bb.maxZ > B.z0 && q.bb.minZ < B.z1); });
      const b = lone[0]; if (!b) return null;
      const cx = (b.bb.minX + b.bb.maxX) / 2, cz = (b.bb.minZ + b.bb.maxZ) / 2, y = b.base + b.height * 0.5;
      bench.setMode('fly');
      const gl = bench.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
      const out = { id: b.id, views: [] };
      for (const [yaw, pitch] of [[0, 0], [1.7, 0.1], [3.3, 0], [0.5, 1.3]]) {
        bench.set(cx, y, cz, yaw, pitch);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        bench.renderer.render(bench.scene, bench.camera);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let bright = 0, n = 0;
        for (let i = 0; i < px.length; i += 4 * 7) { n++; if ((px[i] + px[i + 1] + px[i + 2]) / 765 > 0.35) bright++; }
        out.views.push(+(bright / n).toFixed(3));
      }
      return out;
    });
    assert.ok(inside, 'a detached house near the spawn');
    for (const f of inside.views) assert.ok(f < 0.05, `inside ${inside.id} the walls and roof are opaque and dark (${JSON.stringify(inside.views)} bright)`);
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

test('every visible ground matches the collider (ground probe)', { timeout: 900000 }, async () => {
  const real = await hasRealData();
  const { page, errors } = await openTown(real ? '?norender' : '?norender&data=fixture');
  try {
    // spawn (Market Square), a park (Shakespearean Gardens), a residential street, Ontario Street
    const foci = real ? [null, { x: -234.8, z: -215.8 }, { x: 442.8, z: 188.9 }, { x: 65, z: -170 }] : [null];
    const r = await page.evaluate((foci) => bench.groundProbe({ foci: foci.map((f) => f || bench.world.spawn), perFocus: 140 }), foci);
    console.log(`  ground probe: ${r.n} points, above +1 cm ${r.above1cm}, below -1 cm ${r.below1cm}, max ${r.maxAbove.toFixed(3)} / ${r.maxBelow.toFixed(3)} m, close layers ${JSON.stringify(r.pairs)}, stacked walkable surfaces ${r.stacked}, open undercuttable edges ${r.leaks} ${JSON.stringify(r.leakSamples)}`);
    // slabs (sidewalks, footways, roads) must not have an open edge a creature can get under
    assert.ok(r.leaks <= Math.max(1, r.n * 0.001), `open, undercuttable slab edges at most 1 per 1000 points (${r.leaks}: ${JSON.stringify(r.leakSamples)})`);
    assert.ok(r.n > 300, `enough probe points (${r.n})`);
    assert.ok(r.above1cm <= r.n * 0.001, `visible ground more than 1 cm above the collider at under 0.1% of points (${r.above1cm}): ${JSON.stringify(r.worst.slice(0, 3))}`);
    assert.ok(r.below1cm <= r.n * 0.01, `visible ground below the collider at under 1% of points (${r.below1cm})`);
    const fights = Object.entries(r.pairs).filter(([k]) => k !== 'markings+streets' && k !== 'streets+streets').reduce((a, [, v]) => a + v, 0);
    assert.ok(fights <= r.n * 0.01, `different ground layers drawn within 1.5 cm of each other at under 1% of points (${fights})`);
    assert.deepEqual(errors, [], 'no console errors');
  } finally { await page.close(); }
});

test('ground detail: leaves scatter and piles burst where a creature runs, the near tier follows the zoom, walkable debris is in the collider', { timeout: 900000 }, async (t) => {
  if (!(await hasRealData())) { t.skip('no town data'); return; }
  const { page, errors } = await openTown('?norender');
  try {
    const r = await page.evaluate(async () => {
      const w = bench.world, cam = bench.camera, V = bench.vec;
      w.setScale(0.25);
      // a leaf pile in the park (Shakespearean Gardens)
      const piles = w.debugPiles(-234.8, -215.8, 80);
      const p = piles[0];
      const out = { piles: piles.length };
      if (!p) return out;
      const start = { x: p.x - (p.R + 1.2), z: p.z };
      const focus = V(start.x, w.groundAt(start.x, start.z), start.z);
      const place = (d) => { cam.position.set(focus.x - d, focus.y + 0.3, focus.z); cam.lookAt(focus); };
      await w.ready({ x: p.x, y: 0, z: p.z });
      place(0.85); for (let k = 0; k < 10; k++) w.update(1 / 60, cam, focus);
      out.rDefault = w.info().groundNearR;
      place(4.25); for (let k = 0; k < 10; k++) w.update(1 / 60, cam, focus);
      out.rFar = w.info().groundNearR;
      place(0.85); for (let k = 0; k < 10; k++) w.update(1 / 60, cam, focus);
      await w.ready({ x: p.x, y: 0, z: p.z });
      // run east through the pile at 3 m/s
      let flying = 0;
      for (let k = 0; k < 90; k++) {
        focus.x += 3 / 60; focus.y = w.groundAt(focus.x, focus.z); place(0.85);
        w.update(1 / 60, cam, focus);
        flying = Math.max(flying, w.info().leavesFlying);
      }
      out.flying = flying;
      for (let k = 0; k < 240; k++) w.update(1 / 60, cam, focus);
      out.settled = w.info().leavesFlying;
      // walkable debris under the trees: branches (perches) and props (cones, acorns, twigs) in the near tier's colliders
      const surf = new Set();
      for (const m of w.collidersNear(bench.box(p.x - 6, -100, p.z - 6, p.x + 6, 100, p.z + 6))) {
        if (!m.userData || m.name) continue;
        const a = m.geometry.attributes.surface; for (let i = 0; i < a.count; i += 3) surf.add(a.getX(i));
      }
      out.detailSurfaces = [...surf].sort();
      return out;
    });
    console.log(`  ground detail: ${JSON.stringify(r)}`);
    assert.ok(r.piles > 0, 'leaf piles in the park');
    assert.ok(r.rFar < r.rDefault, `the near tier pulls in when the camera zooms out (${r.rDefault} -> ${r.rFar} m)`);
    assert.ok(r.flying >= 20, `leaves fly up when the creature runs through a pile (${r.flying})`);
    assert.ok(r.settled === 0, `and settle again (${r.settled} still in the air)`);
    assert.ok(r.detailSurfaces.includes(12), 'cones, acorns, twigs and pebbles are in the collider');
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
