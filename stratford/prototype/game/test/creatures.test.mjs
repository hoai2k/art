// node --test stratford/prototype/game/test/creatures.test.mjs
// The playable creatures on the generic controller and camera (stand-in yard, headless): each one's
// moves (walking, swimming and diving, hops, wading, take-off, flight and landing), superspeed
// (speed reached, no tunnelling, the camera never inside geometry), no NaN; and a browser run at
// superspeed along a real town street, checking the town's chunks are ready under and ahead of it.
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = pathToFileURL(join(GAME, 'lib')).href;
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: '${LIB}/three.module.min.js', shortCircuit: true };
  if (spec === 'three-mesh-bvh') return { url: '${LIB}/three-mesh-bvh.module.js', shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: '${LIB}/addons/' + spec.slice(13), shortCircuit: true };
  return next(spec, ctx);
}`), import.meta.url);

const THREE = await import('three');
const src = (p) => import(pathToFileURL(join(GAME, 'src', p)).href);
const { createStandInWorld } = await src('stand-in-world.js');
const { CREATURES, CREATURE_INFO } = await src('creatures/index.js');
const { sphereHits } = await src('creatures/collide.js');
const world = await createStandInWorld({ THREE, scene: new THREE.Scene() });

const idle = () => ({ move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false, zoom: 0, boost: 0 });
const ctrlCam = (from, to) => { const c = new THREE.PerspectiveCamera(); c.position.set(...from); c.lookAt(...to); c.updateMatrixWorld(); return c; };
const EAST = () => ctrlCam([-40, 1, 18], [10, 1, 18]);
async function make(kind, spawn) {
  const mod = await CREATURES[kind]();
  const c = await mod.createCreature({ model: false });
  c.reset(spawn);
  return c;
}
function run(c, secs, fn, cam, probe, dt = 1 / 60) {
  for (let t = 0, i = 0; t < secs; t += dt, i++) {
    c.update(dt, { ...idle(), ...fn(t, i) }, world, cam);
    const p = c.position, v = c.velocity;
    assert.ok(Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z), `${c.kind}: finite at t=${t.toFixed(2)}`);
    probe?.(t, c);
  }
}
const OPEN = { x: -18, y: 0, z: 18, yaw: -Math.PI / 2 };          // open grass, facing east
const POND_W = { x: 7.6, y: 0, z: -3, yaw: -Math.PI / 2 };        // west of the pond, facing east
const pondCam = () => ctrlCam([0, 1, -3], [20, 1, -3]);

test('the registry lists five creatures, each on the creature contract', async () => {
  assert.deepEqual(Object.keys(CREATURES), ['squirrel', 'beaver', 'rabbit', 'swan', 'heron']);
  assert.deepEqual(CREATURE_INFO.map((c) => c.kind), Object.keys(CREATURES));
  const want = { squirrel: [0.25, false], beaver: [0.8, false], rabbit: [0.4, false], swan: [1.4, true], heron: [1.0, true] };
  for (const kind of Object.keys(CREATURES)) {
    const mod = await CREATURES[kind]();
    assert.equal(typeof mod.createCreature, 'function'); assert.equal(typeof mod.createCamera, 'function');
    const c = await mod.createCreature({ model: false });
    assert.equal(c.kind, kind); assert.equal(c.scale, want[kind][0]); assert.equal(c.canFly, want[kind][1]);
    assert.ok(c.climbs instanceof Set && c.eyeHeight > 0);
    assert.equal(c.climbs.has(4), kind === 'squirrel', `${kind}: climbs brick only if it's the squirrel`);
    for (const k of ['runSpeed', 'camDistance', 'camProbe', 'radius', 'stepUp']) assert.ok(c.tuning[k] > 0, `${kind}: tuning.${k}`);
  }
});

test('beaver: waddles and gallops; swims; dives with A and surfaces with A again', async () => {
  const b = await make('beaver', OPEN);
  let walk = 0, gallop = 0;
  run(b, 1.5, () => ({ move: [0, 1] }), EAST(), (t, c) => { walk = Math.hypot(c.velocity.x, c.velocity.z); });
  run(b, 1.5, () => ({ move: [0, 1], sprint: 1 }), EAST(), (t, c) => { gallop = Math.hypot(c.velocity.x, c.velocity.z); });
  assert.ok(walk > 1.1 && walk < 1.5, `waddle ${walk.toFixed(2)} m/s`);
  assert.ok(gallop > 2.8 && gallop < 3.5, `gallop ${gallop.toFixed(2)} m/s`);
  b.reset(POND_W);
  let swam = false;
  run(b, 3.5, () => ({ move: [0, 0.8] }), pondCam(), (t, c) => { if (c.state === 'swim') swam = true; });
  assert.ok(swam && b.state === 'swim', 'swimming in the pond');
  let minY = 0;
  run(b, 2, (t, i) => ({ move: [0, 0.4], jump: i < 2, jumpPressed: i === 0 }), pondCam(), (t, c) => { minY = Math.min(minY, c.position.y); });
  assert.equal(b.state, 'dive');
  assert.ok(minY < -0.05 - 0.4, `dove under (feet at ${minY.toFixed(2)}, water at -0.05)`);
  run(b, 1.5, (t, i) => ({ jump: i < 2, jumpPressed: i === 0 }), pondCam());
  assert.equal(b.state, 'swim', 'A surfaces');
});

test('rabbit: hops to a full bound, zig-zags, jumps high; paddles a little and gets out of water', async () => {
  const r = await make('rabbit', OPEN);
  let top = 0;
  run(r, 1.2, () => ({ move: [0, 1], sprint: 1 }), EAST(), (t, c) => { top = Math.max(top, Math.hypot(c.velocity.x, c.velocity.z)); });
  assert.ok(top > 10, `bound ${top.toFixed(1)} m/s`);
  // zig-zag at full speed: about 40 degrees off the line one way, then the other, a third of a second each
  const h = () => Math.atan2(r.controller.fwd.x, -r.controller.fwd.z);
  const h0 = h();
  run(r, 0.3, () => ({ move: [0.85, 1], sprint: 1 }), EAST());
  const h1 = h();
  run(r, 0.3, () => ({ move: [-0.85, 1], sprint: 1 }), EAST());
  const h2 = h();
  assert.ok(Math.abs(h1 - h0) > 0.55 && Math.abs(h2 - h1) > 1.1, `zig ${(h1 - h0).toFixed(2)} zag ${(h2 - h1).toFixed(2)} rad`);
  assert.ok(Math.hypot(r.velocity.x, r.velocity.z) > 8, 'without losing much speed');
  r.reset(OPEN);
  let peak = 0;
  run(r, 1.2, (t, i) => ({ move: [0, 1], jump: true, jumpPressed: i === 0 }), EAST(), (t, c) => { peak = Math.max(peak, c.position.y); });
  assert.ok(peak > 0.65, `jumps ${peak.toFixed(2)} m`);
  r.reset({ x: 8.3, y: 0, z: -3, yaw: -Math.PI / 2 });
  let swimT = 0;
  run(r, 9, (t) => ({ move: [0, t < 1.5 ? 0.6 : 0] }), pondCam(), (t, c) => { if (c.state === 'swim') swimT += 1 / 60; });
  assert.ok(swimT > 0.5 && swimT < 7, `paddled ${swimT.toFixed(1)} s`);
  assert.notEqual(r.state, 'swim', 'then climbed out');
});

test('swan: walks, swims, takes off with a run (A held), flies, glides and lands on ground and water', async () => {
  const s = await make('swan', OPEN);
  let walk = 0;
  run(s, 1.5, () => ({ move: [0, 1] }), EAST(), (t, c) => { walk = Math.hypot(c.velocity.x, c.velocity.z); });
  assert.ok(walk > 0.7 && walk < 1.1, `awkward walk ${walk.toFixed(2)} m/s`);
  let tookOff = null;
  run(s, 4, (t) => ({ move: [0, 1], jump: tookOff === null }), EAST(), (t, c) => { if (tookOff === null && c.state === 'fly') tookOff = t; });
  assert.ok(tookOff !== null && tookOff < 3, `took off after a ${tookOff?.toFixed(1)} s run`);
  // it let go of A at once: a short flight, gliding down onto the grass
  assert.ok(['move', 'idle'].includes(s.state), `glided down and landed (now ${s.state} at ${s.position.toArray().map((v) => v.toFixed(1))})`);
  // again, holding A: it climbs at flight speed
  s.reset(OPEN);
  run(s, 3.5, () => ({ move: [0, 1], jump: true }), EAST());
  assert.equal(s.state, 'fly');
  const y0 = s.position.y;
  run(s, 1, () => ({ move: [0, 1], jump: true }), EAST());
  assert.ok(s.position.y > y0 + 1.5, `A climbs (${y0.toFixed(1)} -> ${s.position.y.toFixed(1)} m)`);
  const v = Math.hypot(s.velocity.x, s.velocity.z);
  assert.ok(v > 12 && v < 18, `flying at ${v.toFixed(1)} m/s`);
  // on water: gliding in low over the pond, it lands and swims
  s.reset({ x: 9.3, y: 0, z: -3, yaw: -Math.PI / 2 });
  Object.assign(s.controller, { state: 'fly', flyTime: 1, speed: 9 });
  s.position.y = 0.45;
  run(s, 1.5, () => ({ move: [0, 1] }), pondCam());
  assert.equal(s.state, 'swim', 'landed on the water and swims');
  // and takes off from the water with a run across it (long enough here: superspeed shortens the run)
  run(s, 3, () => ({ move: [0, 1], jump: true, boost: 0.3 }), pondCam());
  assert.equal(s.state, 'fly', 'took off from the water');
});

test('heron: walks, wades in the shallows (never swims, deep water stops it), takes off on the spot, perches on a roof', async () => {
  const h = await make('heron', OPEN);
  let walk = 0;
  run(h, 2, () => ({ move: [0, 1] }), EAST(), (t, c) => { walk = Math.hypot(c.velocity.x, c.velocity.z); });
  assert.ok(walk > 0.5 && walk < 0.9, `stately walk ${walk.toFixed(2)} m/s`);
  h.reset(POND_W);
  let maxWade = 0, swam = false;
  run(h, 8, () => ({ move: [0, 1] }), pondCam(), (t, c) => { maxWade = Math.max(maxWade, c.controller.wading); if (c.state === 'swim') swam = true; });
  assert.ok(!swam, 'never swims');
  assert.ok(maxWade > 0.25 && maxWade <= h.tuning.wadeDepth + 0.02, `waded up to ${maxWade.toFixed(2)} m (limit ${h.tuning.wadeDepth})`);
  h.reset(OPEN);
  run(h, 0.6, (t, i) => ({ jump: i < 10, jumpPressed: i === 0 }), EAST());
  assert.equal(h.state, 'fly', 'A takes off on the spot');
  assert.ok(h.position.y > 0.5, `rising (${h.position.y.toFixed(2)} m)`);
  // perching: gliding in over the brick building's flat roof (3 m), it lands on it
  h.reset({ x: 4, y: 0, z: -14.5, yaw: 0 });
  Object.assign(h.controller, { state: 'fly', flyTime: 1, speed: 5 });
  h.position.y = 3.5;
  const north = ctrlCam([4, 4, 0], [4, 4, -30]);
  run(h, 1.5, () => ({ move: [0, 0.2] }), north);
  assert.ok(['move', 'idle'].includes(h.state) && Math.abs(h.position.y - 3) < 0.05, `perched on the roof (${h.state}, y ${h.position.y.toFixed(2)})`);
});

test('superspeed (LT / Q): ten times the speed, nothing tunnels, the camera stays out of walls', async () => {
  for (const kind of ['squirrel', 'rabbit', 'beaver']) {
    const c = await make(kind, OPEN);
    let top = 0;
    run(c, 0.5, () => ({ move: [0, 1], sprint: 1, boost: 1 }), EAST(), (t, k) => { top = Math.max(top, Math.hypot(k.velocity.x, k.velocity.z)); });
    assert.ok(top > c.tuning.sprintSpeed * 8.5, `${kind}: ${top.toFixed(0)} m/s at full boost (sprint ${c.tuning.sprintSpeed})`);
  }
  // straight at the brick building and the glass wall, and along the yard's edge, at 10x
  const mod = await CREATURES.squirrel();
  for (const [spawn, from, to, inside] of [
    [{ x: 4, y: 0, z: 10, yaw: 0 }, [4, 1, 20], [4, 1, -20], (p) => p.x > 2.05 && p.x < 5.95 && p.z < -14.05 && p.z > -17.95 && p.y < 2.95],
    [{ x: -4, y: 0, z: 10, yaw: 0 }, [-4, 1, 20], [-4, 1, -20], (p) => p.z < -14.45 && p.x > -6 && p.x < -2 && p.y < 2.9],
    [{ x: -20, y: 0, z: 22, yaw: -Math.PI / 2 }, [-40, 1, 22], [40, 1, 23.8], (p) => p.z > 23.6 || p.x > 23.6],
  ]) {
    const c = await make('squirrel', spawn);
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 500);
    const cam = mod.createCamera({ camera, squirrel: c, world });
    const steer = ctrlCam(from, to);
    for (let i = 0; i < 120; i++) {
      const k = { ...idle(), move: [0, 1], sprint: 1, boost: 1 };
      c.update(1 / 60, k, world, steer); cam.update(1 / 60, k);
      assert.ok(!inside(c.position), `never through the wall (at ${c.position.toArray().map((v) => v.toFixed(2))})`);
      assert.ok(!sphereHits(world, camera.position, c.tuning.camProbe * 0.45), `camera clear of geometry (${camera.position.toArray().map((v) => v.toFixed(2))})`);
      assert.ok(Number.isFinite(camera.position.x + camera.position.y + camera.position.z));
    }
  }
});

test('no NaN or falling out of the world under random input, for every creature', async () => {
  for (const kind of Object.keys(CREATURES)) {
    const c = await make(kind, { x: 0, y: 0, z: 5, yaw: 0 });
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let k = idle();
    const cam = ctrlCam([0, 1, 10], [0, 1, 0]);
    for (let i = 0; i < 60 * 20; i++) {
      if (i % 20 === 0) k = { ...idle(), move: [rnd() * 2 - 1, rnd() * 2 - 1], sprint: rnd() > 0.6 ? 1 : 0, jump: rnd() > 0.6, boost: rnd() > 0.85 ? 1 : 0 };
      k.jumpPressed = k.jump && i % 20 === 0;
      c.update([1 / 60, 1 / 30, 1 / 144, 0.1][i % 4], k, world, cam);
      const p = c.position;
      assert.ok(Number.isFinite(p.x + p.y + p.z), `${kind}: finite`);
      assert.ok(p.y > world.groundAt(p.x, p.z) - 0.8, `${kind}: above the ground at step ${i} (${p.toArray().map((v) => v.toFixed(2))}, ${c.state})`);
    }
  }
});

// ------------------------------------------------------------------------------------------------
test('superspeed in the real town: chunks are ready under and ahead of the creature', { timeout: 900000 }, async (t) => {
  const { access } = await import('node:fs/promises');
  try { await access(join(GAME, 'data/town.json')); } catch { t.skip('no town data'); return; }
  const { launch, serve } = await import(pathToFileURL(join(GAME, '../../../shared/test/lib.mjs')).href);
  const srv = await serve(GAME);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(srv.url + '/lab/squirrel.html?town=1&test=1');
    await page.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 300000 });
    const r = await page.evaluate(async () => {
      const L = window.__lab, T = L.THREE, W = L.world, sq = L.squirrel, cam = L.cam, camera = L.camera;
      L.paused = true;
      // along the longest main street near the middle (Ontario Street), steering by its points
      const len = (r) => r.points.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - r.points[i - 1][0], p[1] - r.points[i - 1][1]) : 0), 0);
      const road = W.data.roads.filter((r) => ['primary', 'secondary'].includes(r.kind) && r.points.some((p) => Math.hypot(p[0], p[1]) < 300)).sort((a, b) => len(b) - len(a))[0];
      const pts = road.points;
      const SP = { x: pts[0][0], z: pts[0][1], yaw: Math.atan2(-(pts[1][0] - pts[0][0]), -(pts[1][1] - pts[0][1])) };
      await W.ready(SP); SP.y = W.groundAt(SP.x, SP.z); sq.reset(SP); cam.snapBehind();
      let wp = 1, misses = 0, top = 0, minAhead = 1e9;
      for (let i = 0; i < 60 * 8; i++) {
        const p = sq.position;
        while (wp < pts.length - 1 && Math.hypot(pts[wp][0] - p.x, pts[wp][1] - p.z) < 6) wp++;
        const d = new T.Vector3(pts[wp][0] - p.x, 0, pts[wp][1] - p.z).normalize();
        const f = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; f.normalize();
        const rr = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); rr.y = 0; rr.normalize();
        const c = { move: [d.dot(rr), d.dot(f)], look: [0, 0], jump: false, jumpPressed: false, sprint: 1, boost: 1, zoom: 0 };
        sq.update(1 / 60, c, W, camera); cam.update(1 / 60, c); W.update(1 / 60, camera, sq.position);
        top = Math.max(top, Math.hypot(sq.velocity.x, sq.velocity.z));
        const box = new T.Box3().setFromCenterAndSize(p, new T.Vector3(4, 8, 4));
        if (!W.collidersNear(box).length || !W.raycast(new T.Vector3(p.x, p.y + 2, p.z), new T.Vector3(0, -1, 0), 6)) misses++;
        if (i % 30 === 29) {
          let ahead = 0; const fw = sq.controller.fwd;
          for (let dd = 20; dd <= 200; dd += 20) { const q = new T.Vector3(p.x + fw.x * dd, p.y, p.z + fw.z * dd); if (W.collidersNear(new T.Box3().setFromCenterAndSize(q, new T.Vector3(2, 40, 2))).length) ahead = dd; else break; }
          minAhead = Math.min(minAhead, ahead);
        }
      }
      return { road: road.name, misses, top, minAhead, travelled: Math.hypot(sq.position.x - SP.x, sq.position.z - SP.z) };
    });
    assert.ok(r.top > 60, `superspeed in town: ${r.top.toFixed(0)} m/s`);
    assert.ok(r.travelled > 300, `crossed ${r.travelled.toFixed(0)} m of ${r.road}`);
    assert.equal(r.misses, 0, 'a collider under the creature every frame');
    assert.ok(r.minAhead >= 100, `near chunks ready at least ${r.minAhead} m ahead`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); srv.close();
  }
});
