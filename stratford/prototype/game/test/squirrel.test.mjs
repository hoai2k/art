// node --test stratford/prototype/game/test/squirrel.test.mjs
// Headless checks of the squirrel's movement on the stand-in world, and a browser check of the
// squirrel bench (lab/squirrel.html) with a simulated Xbox controller.
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = pathToFileURL(join(GAME, 'lib')).href;
// the page's import map, for node
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: '${LIB}/three.module.min.js', shortCircuit: true };
  if (spec === 'three-mesh-bvh') return { url: '${LIB}/three-mesh-bvh.module.js', shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: '${LIB}/addons/' + spec.slice(13), shortCircuit: true };
  return next(spec, ctx);
}`), import.meta.url);

const THREE = await import('three');
const { createStandInWorld } = await import(pathToFileURL(join(GAME, 'src/stand-in-world.js')).href);
const { createSquirrel, createCreature } = await import(pathToFileURL(join(GAME, 'src/squirrel/index.js')).href);
const { CREATURES } = await import(pathToFileURL(join(GAME, 'src/creatures/index.js')).href);

const world = await createStandInWorld({ THREE, scene: new THREE.Scene() });

// a camera that looks north (-z) from behind, so stick up = north
function northCamera() {
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 500);
  cam.position.set(0, 1, 10); cam.lookAt(0, 1, 0); cam.updateMatrixWorld();
  return cam;
}
const idle = () => ({ move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false });

async function makeSquirrel(spawn) {
  const sq = await createSquirrel({ THREE, model: false });
  sq.reset(spawn);
  return sq;
}

function run(sq, seconds, controlsAt, cam = northCamera(), dt = 1 / 60, probe) {
  for (let t = 0, i = 0; t < seconds; t += dt, i++) {
    const c = { ...idle(), ...controlsAt(t, i) };
    sq.update(dt, c, world, cam);
    assert.ok(Number.isFinite(sq.position.x + sq.position.y + sq.position.z), `position is finite at t=${t.toFixed(2)}`);
    assert.ok(Number.isFinite(sq.velocity.x + sq.velocity.y + sq.velocity.z), 'velocity is finite');
    probe?.(t, sq);
  }
}

test('registry and creature contract', async () => {
  assert.equal(typeof CREATURES.squirrel, 'function');
  const mod = await CREATURES.squirrel();
  assert.equal(typeof mod.createCreature, 'function');
  assert.equal(typeof mod.createCamera, 'function');
  const sq = await createCreature({ THREE, model: false });
  assert.equal(sq.kind, 'squirrel'); assert.equal(sq.scale, 0.25); assert.equal(sq.canFly, false);
  assert.ok(sq.climbs.has(4) && !sq.climbs.has(7));
  assert.ok(sq.eyeHeight > 0.03 && sq.eyeHeight < 0.2);
});

test('stands on the ground and does not fall through it', async () => {
  const sq = await makeSquirrel({ x: -14, y: 0, z: 14, yaw: 0 });
  run(sq, 3, () => ({}));
  assert.ok(Math.abs(sq.position.y) < 0.01, `on the ground (y=${sq.position.y})`);
  assert.ok(['idle', 'move'].includes(sq.state));
  // dropped from 3 m
  sq.reset({ x: -14, y: 3, z: 14, yaw: 0 });
  sq.position.y = 3; sq.controller.state = 'air'; sq.controller._snapAfterReset = false;
  let landed = 0; sq.on('land', () => landed++);
  run(sq, 2, () => ({}));
  assert.ok(Math.abs(sq.position.y) < 0.01 && landed === 1, `landed once on the ground (y=${sq.position.y}, ${landed})`);
});

test('accelerates quickly to running and sprinting speed', async () => {
  const sq = await makeSquirrel({ x: -16, y: 0, z: 16, yaw: Math.PI / 2 });   // facing west, open grass
  const cam = new THREE.PerspectiveCamera(); cam.position.set(-10, 1, 16); cam.lookAt(-20, 1, 16); cam.updateMatrixWorld();
  let t03 = null;
  run(sq, 0.6, () => ({ move: [0, 1] }), cam, 1 / 60, (t, s) => { if (t03 === null && s.velocity.length() > 4.0) t03 = t; });
  const v = sq.velocity.length();
  assert.ok(v > 4.3 && v < 4.9, `run speed ${v.toFixed(2)} m/s`);
  assert.ok(t03 !== null && t03 < 0.3, `reaches 4 m/s in ${t03?.toFixed(2)} s`);
  run(sq, 0.6, () => ({ move: [0, 1], sprint: 1 }), cam);
  const vs = sq.velocity.length();
  assert.ok(vs > 7 && vs < 8, `sprint speed ${vs.toFixed(2)} m/s`);
  assert.equal(sq.state, 'move');
  // half stick: about half speed
  run(sq, 1, () => ({ move: [0, 0.55] }), cam);
  const vh = sq.velocity.length();
  assert.ok(vh > 1.6 && vh < 3, `analog speed ${vh.toFixed(2)} m/s`);
});

test('turns, with a wider radius at speed', async () => {
  const sq = await makeSquirrel({ x: -16, y: 0, z: 16, yaw: 0 });
  const cam = northCamera();
  run(sq, 0.5, () => ({ move: [0, 1] }), cam);
  const h0 = Math.atan2(sq.velocity.x, -sq.velocity.z);
  run(sq, 0.25, () => ({ move: [1, 0] }), cam);   // steer east
  const h1 = Math.atan2(sq.velocity.x, -sq.velocity.z);
  assert.ok(h1 - h0 > 0.5, `turned ${(h1 - h0).toFixed(2)} rad toward east in 0.25 s`);
  run(sq, 0.6, () => ({ move: [1, 0] }), cam);
  assert.ok(sq.velocity.x > 3, 'now running east');
});

test('jumps about 1 m high and 2.5-3.2 m far when A is held, less when tapped', async () => {
  const sq = await makeSquirrel({ x: -16, y: 0, z: 16, yaw: Math.PI / 2 });
  const cam = new THREE.PerspectiveCamera(); cam.position.set(-10, 1, 16); cam.lookAt(-20, 1, 16); cam.updateMatrixWorld();
  run(sq, 0.6, () => ({ move: [0, 1] }), cam);
  const x0 = sq.position.x; let peak = 0, landX = null, jumped = 0;
  sq.on('jump', () => jumped++);
  const offL = sq.on('land', () => { if (landX === null) landX = sq.position.x; });
  run(sq, 1.2, (t, i) => ({ move: [0, 1], jump: true, jumpPressed: i === 0 }), cam, 1 / 60, (t, s) => { peak = Math.max(peak, s.position.y); });
  assert.equal(jumped, 1);
  assert.ok(peak > 0.85 && peak < 1.15, `leap height ${peak.toFixed(2)} m`);
  const dist = Math.abs(landX - x0);
  assert.ok(dist > 2.4 && dist < 3.3, `leap distance ${dist.toFixed(2)} m`);
  // tap
  let peak2 = 0;
  run(sq, 1.0, (t, i) => ({ move: [0, 1], jump: i < 2, jumpPressed: i === 0 }), cam, 1 / 60, (t, s) => { peak2 = Math.max(peak2, s.position.y); });
  assert.ok(peak2 > 0.15 && peak2 < 0.6, `tap hop height ${peak2.toFixed(2)} m`);
});

test('runs up a 15 cm curb without stopping', async () => {
  const sq = await makeSquirrel({ x: 3, y: 0, z: 5, yaw: 0 });       // on the road, sidewalk ahead (north)
  let minV = Infinity, onWalk = false;
  run(sq, 0.5, () => ({ move: [0, 1] }));
  run(sq, 1.0, () => ({ move: [0, 1] }), northCamera(), 1 / 60, (t, s) => {
    minV = Math.min(minV, Math.hypot(s.velocity.x, s.velocity.z));
    if (s.position.z < 1.5 && s.position.z > -1.5 && Math.abs(s.position.y - 0.15) < 0.01 && ['move', 'idle'].includes(s.state)) onWalk = true;
  });
  assert.ok(onWalk, 'reached the sidewalk top');
  assert.ok(minV > 2.5, `kept running over the curb (min speed ${minV.toFixed(2)} m/s)`);
});

test('climbs the brick wall and tops out onto its roof', async () => {
  const sq = await makeSquirrel({ x: 4, y: 0, z: -11, yaw: 0 });     // building z -14..-18, 3 m
  let climbed = false, onRoof = false;
  sq.on('climb', () => { climbed = true; });
  run(sq, 4, () => ({ move: [0, 1] }), northCamera(), 1 / 60, (t, s) => {
    if (s.position.y > 2.99 && s.position.z < -14.05 && ['move', 'idle'].includes(s.state)) onRoof = true;
  });
  assert.ok(climbed, 'attached to the brick wall');
  assert.ok(onRoof, `on the roof (pos ${sq.position.toArray().map((v) => v.toFixed(2))}, ${sq.state})`);
});

test('cannot climb the glass wall', async () => {
  const sq = await makeSquirrel({ x: -4, y: 0, z: -11, yaw: 0 });    // glass wall at z -14..-14.4
  let climbed = false, maxY = 0;
  sq.on('climb', () => { climbed = true; });
  run(sq, 3, (t, i) => ({ move: [0, 1], jump: true, jumpPressed: i % 40 === 0 }), northCamera(), 1 / 60, (t, s) => { maxY = Math.max(maxY, s.position.y); });
  assert.ok(!climbed, 'never attached');
  assert.ok(maxY < 1.3, `stayed low (max y ${maxY.toFixed(2)})`);
  assert.ok(sq.position.z > -14.05, 'did not pass through the glass');
});

test('climbs the tree trunk and comes back down head first', async () => {
  const sq = await makeSquirrel({ x: -10, y: 0, z: -9, yaw: 0 });    // trunk at (-10, -12)
  let climbed = false, maxY = 0;
  sq.on('climb', () => { climbed = true; });
  run(sq, 2.0, () => ({ move: [0, 1] }), northCamera(), 1 / 60, (t, s) => { maxY = Math.max(maxY, s.position.y); });
  assert.ok(climbed && maxY > 1.5, `up the trunk (max y ${maxY.toFixed(2)})`);
  run(sq, 3.0, () => ({ move: [0, -1] }), northCamera());
  assert.ok(['move', 'idle'].includes(sq.state) && sq.position.y < 0.05, `back on the ground (${sq.state}, y ${sq.position.y.toFixed(2)})`);
});

test('sits, digs and swims', async () => {
  const sq = await makeSquirrel({ x: -16, y: 0, z: 16, yaw: 0 });
  run(sq, 0.3, (t, i) => ({ sitPressed: i === 1 }));
  assert.equal(sq.state, 'sit');
  run(sq, 0.5, () => ({ move: [0, 1] }));
  assert.notEqual(sq.state, 'sit');
  let dug = 0; sq.on('dig', () => dug++);
  run(sq, 0.6, () => ({}));
  run(sq, 0.3, (t, i) => ({ digPressed: i === 1 }));
  assert.equal(sq.state, 'dig'); assert.equal(dug, 1);
  // into the pond (12, -3) from the west
  sq.reset({ x: 7.5, y: 0, z: -3, yaw: -Math.PI / 2 });
  const cam = new THREE.PerspectiveCamera(); cam.position.set(4, 1, -3); cam.lookAt(12, 0.5, -3); cam.updateMatrixWorld();
  let swam = false;
  run(sq, 4, () => ({ move: [0, 1] }), cam, 1 / 60, (t, s) => { if (s.state === 'swim') swam = true; });
  assert.ok(swam, 'swam in the pond');
});

test('never NaN or stuck under random input', async () => {
  const sq = await makeSquirrel({ x: 0, y: 0, z: 5, yaw: 0 });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let c = idle();
  const cam = northCamera();
  for (let i = 0; i < 60 * 40; i++) {
    if (i % 20 === 0) c = { ...idle(), move: [rnd() * 2 - 1, rnd() * 2 - 1], sprint: rnd() > 0.6 ? 1 : 0, jump: rnd() > 0.7 };
    c.jumpPressed = c.jump && i % 20 === 0;
    const dt = [1 / 60, 1 / 30, 1 / 144, 0.1][i % 4];
    sq.update(dt, c, world, cam);
    assert.ok(Number.isFinite(sq.position.x + sq.position.y + sq.position.z), 'finite');
    assert.ok(sq.position.y > world.groundAt(sq.position.x, sq.position.z) - 0.3, `above ground at step ${i}`);
  }
});

// ------------------------------------------------------------------------------------------------
test('bench page loads, draws the squirrel and follows a simulated gamepad', { timeout: 120000 }, async () => {
  const { launch, serve } = await import(pathToFileURL(join(GAME, '../../../shared/test/lib.mjs')).href);
  const srv = await serve(GAME);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => {
      const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      window.__pad = pad;
      navigator.getGamepads = () => [pad, null, null, null];
    });
    await page.goto(srv.url + '/lab/squirrel.html?test=1');
    await page.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 });
    const drawn = await page.evaluate(() => window.__lab.renderer.info.render.triangles);
    assert.ok(drawn > 5000, `drew the scene with the squirrel (${drawn} triangles)`);
    const vis = await page.evaluate(() => window.__lab.squirrel.object.children.length > 0 && window.__lab.squirrel.model != null);
    assert.ok(vis, 'squirrel model loaded');
    const bad = await page.evaluate(() => Object.values(window.__lab.squirrel.model.bones).filter((b) => !Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.x)).map((b) => b.name));
    assert.deepEqual(bad, [], 'no NaN bones');
    const p0 = await page.evaluate(() => window.__lab.squirrel.position.toArray());
    await page.evaluate(() => { window.__pad.axes[1] = -1; });     // left stick up
    // Wait for the movement rather than a fixed time: under load (software
    // rendering, other browsers running) the page may only manage a few fps.
    await page.waitForFunction((p0) => {
      const p = window.__lab.squirrel.position;
      return Math.hypot(p.x - p0[0], p.z - p0[2]) > 0.5;
    }, p0, { timeout: 15000 }).catch(() => {});
    const st = await page.evaluate(() => ({ p: window.__lab.squirrel.position.toArray(), s: window.__lab.squirrel.state }));
    const moved = Math.hypot(st.p[0] - p0[0], st.p[2] - p0[2]);
    assert.ok(moved > 0.5, `moved ${moved.toFixed(2)} m with the stick`);
    await page.evaluate(() => { window.__pad.axes[1] = 0; window.__pad.buttons[0] = { pressed: true, touched: true, value: 1 }; });
    await page.waitForTimeout(150);
    const air = await page.evaluate(() => window.__lab.squirrel.position.y);
    await page.evaluate(() => { window.__pad.buttons[0] = { pressed: false, touched: false, value: 0 }; });
    assert.ok(air > 0.05, `A jumps (y ${air.toFixed(2)})`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); srv.close();
  }
});
