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
  const sq = await makeSquirrel({ x: 21, y: 0, z: 16, yaw: Math.PI / 2 });    // facing west, open grass
  const cam = new THREE.PerspectiveCamera(); cam.position.set(27, 1, 16); cam.lookAt(17, 1, 16); cam.updateMatrixWorld();
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

// ---- the follow camera (src/creatures/camera.js), headless on the stand-in yard ---------------
const { createSquirrelCamera } = await import(pathToFileURL(join(GAME, 'src/squirrel/index.js')).href);
const { sphereHits } = await import(pathToFileURL(join(GAME, 'src/creatures/collide.js')).href);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Run the squirrel with the follow camera as the stick's reference (as in the game) and record
// every frame: [t, camera position, squirrel position].
async function follow(spawn, seconds, controlsAt, dt, setup) {
  const sq = await makeSquirrel(spawn);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.02, 500);
  const cam = createSquirrelCamera({ THREE, camera, squirrel: sq, world });
  setup?.(cam, sq);
  cam.update(1 / 60, idle());
  const fr = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const c = { ...idle(), zoom: 0, ...controlsAt(i * dt, i, dt) };
    sq.update(dt, c, world, camera);
    cam.update(dt, c);
    fr.push({ t: (i + 1) * dt, cam: camera.position.clone(), sq: sq.position.clone(), state: sq.state });
  }
  return { fr, cam, sq, camera };
}
const maxAcc = (fr, dt) => { let m = 0; for (let i = 2; i < fr.length; i++) m = Math.max(m, fr[i].cam.clone().sub(fr[i - 1].cam).sub(fr[i - 1].cam.clone().sub(fr[i - 2].cam)).length() / dt / dt); return m; };

const CAM_RUNS = {
  straight: [{ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 3, (t) => ({ move: [0, 1], sprint: t > 1 ? 1 : 0 })],
  turns: [{ x: -15, y: 0, z: 21, yaw: 0 }, 4, (t) => ({ move: [Math.sin(t * 3.2) > 0 ? 0.9 : -0.9, 0.5], sprint: 0.5 })],
  stopStart: [{ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 4, (t) => ({ move: [0, (t % 1.2) < 0.6 ? 1 : 0] })],
  jumps: [{ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 4, (t, i, dt) => { const ph = t % 0.9; return { move: [0, 1], jump: ph < 0.45, jumpPressed: ph < dt * 0.999 }; }],
  climbAndTopOut: [{ x: 4, y: 0, z: -11, yaw: 0 }, 2.8, () => ({ move: [0, 1] })],
};

test('camera: smooth (bounded frame-to-frame acceleration) at 60 and 144 fps, the same path at any frame rate', async () => {
  for (const [name, [spawn, secs, ctl]] of Object.entries(CAM_RUNS)) {
    const runs = {};
    for (const fps of [30, 60, 144]) {
      const dt = 1 / fps;
      runs[fps] = (await follow(spawn, secs, ctl, dt)).fr;
      if (fps !== 30) {
        const a = maxAcc(runs[fps], dt);
        assert.ok(a < 150, `${name} @${fps} fps: camera acceleration peaks at ${a.toFixed(0)} m/s^2 (no pops or jitter)`);
      }
    }
    if (name === 'turns') continue;   // (the squirrel's own camera-relative path differs a little with the frame rate)
    // the camera's offset from the squirrel at the same moments, 30 / 60 fps vs 144 fps
    for (const fps of [30, 60]) {
      let dev = 0;
      for (const f of runs[fps]) {
        const g = runs[144].reduce((b, x) => (Math.abs(x.t - f.t) < Math.abs(b.t - f.t) ? x : b));
        if (Math.abs(g.t - f.t) < 0.004) dev = Math.max(dev, f.cam.clone().sub(f.sq).sub(g.cam.clone().sub(g.sq)).length());
      }
      assert.ok(dev < 0.16, `${name}: camera offset at ${fps} fps within ${dev.toFixed(3)} m of 144 fps`);
    }
  }
});

test('camera: never inside geometry and never on top of the squirrel (yard runs, climbing, walls)', async () => {
  const runs = [...Object.values(CAM_RUNS),
    [{ x: 4, y: 0, z: -11, yaw: 0 }, 5, (t) => ({ move: [t < 2.5 ? 0 : 1, 1] })],               // climb, then along the roof
    [{ x: -4, y: 0, z: -12.5, yaw: Math.PI }, 3, (t, i, dt) => ({ move: [0, 0.6], look: [t < 1.5 ? 1.8 * dt : 0, 0] })],   // orbit with the glass wall behind
  ];
  for (const [spawn, secs, ctl] of runs) {
    const { fr, cam, sq } = await follow(spawn, secs, ctl, 1 / 60);
    const probe = sq.tuning.camProbe;
    for (const f of fr) {
      assert.ok(!sphereHits(world, f.cam, probe * 0.45), `camera clear of geometry at t=${f.t.toFixed(2)} (${f.cam.toArray().map((v) => v.toFixed(2))})`);
      assert.ok(f.cam.distanceTo(f.sq) > 0.3, `camera not on top of the squirrel at t=${f.t.toFixed(2)}`);
    }
    // the building's and the glass wall's insides
    for (const f of fr) {
      const p = f.cam;
      assert.ok(!(p.x > 2.02 && p.x < 5.98 && p.z < -14.02 && p.z > -17.98 && p.y < 2.98), 'camera not inside the brick building');
      assert.ok(!(p.x > -6 && p.x < -2 && p.z < -14 && p.z > -14.4 && p.y < 3), 'camera not inside the glass wall');
    }
    assert.equal(cam.debug.cuts, 0, 'no cuts');
  }
});

test('camera: the player\'s pitch is kept while running, turning and climbing', async () => {
  const set = -0.25;   // stick up for a moment: tilts the view up by 0.25 rad from the default
  const { cam, sq } = await follow({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 4.5, (t, i, dt) => (t < 0.25 ? { look: [0, 1.0 * dt] } : { move: [Math.sin(t) * 0.6, 1], sprint: t > 2 ? 1 : 0 }), 1 / 60);
  const want = sq.tuning.camPitch + set;
  assert.ok(Math.abs(cam.pitch - want) < 0.02, `pitch kept at the player's ${want.toFixed(2)} (now ${cam.pitch.toFixed(3)})`);
  assert.ok(Math.abs(cam.debug.pitch - cam.pitch) < 0.03, `shown pitch ${cam.debug.pitch.toFixed(3)} = the player's on open ground`);
  // climbing a wall keeps it too
  const r2 = await follow({ x: 4, y: 0, z: -11, yaw: 0 }, 1.6, () => ({ move: [0, 1] }), 1 / 60, (c) => { c.pitch = 0.5; });
  assert.equal(r2.sq.state, 'climb');
  assert.ok(Math.abs(r2.cam.pitch - 0.5) < 1e-9 && Math.abs(r2.cam.debug.pitch - 0.5) < 0.05, `pitch on the wall ${r2.cam.debug.pitch.toFixed(3)}`);
});

test('camera: zoom (LB / RB, wheel, Z / X) changes the distance smoothly within its range', async () => {
  const T = (await makeSquirrel({ x: 0, y: 0, z: 0 })).tuning;
  const near = T.camDistance, far = T.camDistance * T.camZoomFar;
  // hold LB (zoom further) 2 s while standing in the open
  const out = await follow({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 3.5, (t, i, dt) => ({ zoom: t < 2 ? 0.7 * dt : 0 }), 1 / 60);
  assert.equal(out.cam.zoom, 1, 'zoomed all the way out');
  assert.ok(out.cam.debug.free > far * 0.9 && out.cam.debug.free < far * 1.05, `far follow at ${out.cam.debug.free.toFixed(2)} m (range ${near.toFixed(2)} .. ${far.toFixed(2)} m)`);
  assert.ok(maxAcc(out.fr, 1 / 60) < 150, 'smoothly');
  // then hold RB (closer) from there
  const back = await follow({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 3.5, (t, i, dt) => ({ zoom: t < 2 ? -0.7 * dt : 0 }), 1 / 60, (c) => { c.zoom = 1; c.snapBehind(); });
  assert.equal(back.cam.zoom, 0);
  assert.ok(Math.abs(back.cam.debug.free - near) < 0.05, `back to the standard ${near.toFixed(2)} m (${back.cam.debug.free.toFixed(2)})`);
});

test('camera: an R3 / C tap turns it behind the squirrel and keeps the pitch; the stick is never fought', async () => {
  // orbit 90 degrees round a squirrel standing still, let go, then tap recenter
  let yawAfterOrbit = null;
  const { cam, sq } = await follow({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 2.2, (t, i, dt) => {
    if (t < 0.6) return { look: [(Math.PI / 2) / 0.6 * dt, 0] };
    if (Math.abs(t - 1.2) < dt / 2) return { recenter: true };
    return {};
  }, 1 / 60, (c) => { c.pitch = 0.45; });
  const behind = Math.atan2(-sq.controller.fwd.x, -sq.controller.fwd.z);
  assert.ok(Math.abs(wrapA(cam.yaw - behind)) < 0.03, `behind the squirrel after recenter (off by ${wrapA(cam.yaw - behind).toFixed(3)} rad)`);
  assert.ok(Math.abs(cam.pitch - 0.45) < 1e-9, 'kept the pitch');
  // while the stick turns the camera during a run, auto-follow doesn't pull against it
  const rates = [];
  const r = await follow({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }, 2.5, (t, i, dt) => ({ move: [0, 1], look: [t > 1 && t < 2 ? 1.2 * dt : 0, 0] }), 1 / 60, (c) => {
    const u = c.update; let prev = null;
    c.update = (dt, ctl) => { u(dt, ctl); if (ctl.look[0]) { if (prev !== null) rates.push(wrapA(prev - c.yaw) / dt); prev = c.yaw; } };
  });
  void r; void yawAfterOrbit;
  const off = Math.max(...rates.map((x) => Math.abs(x - 1.2)));
  assert.ok(off < 0.02, `stick turns the camera at exactly its rate (max deviation ${off.toFixed(4)} rad/s)`);
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

// ------------------------------------------------------------------------------------------------
// Regression (owner report: "went through a ceiling and back"; the camera saw through a wall).
// The town's building colliders are thin open shells, and pitched roofs are fitted to each
// footprint's bounding box, so there are slots between wall tops and roofs. Climb real downtown
// buildings with scripted input (straight up to the top, diagonally toward corners, sideways,
// up then down, roaming the roof with jumps) and check, every frame, that the squirrel is never
// inside a footprint below the eaves, only ever gets above a roof by arriving on it, and that
// the follow camera is never inside a footprint below the eaves either.
const TOWN_CASES = [
  // [building id, roof] from the climb probe (tools/squirrel/review/climb-probe.mjs)
  ['w1462606519', 'gabled'], ['w1462606790', 'gabled'], ['w1463843464', 'gabled'],
  ['w1462606521', 'gabled'], ['w1471432610', 'flat'], ['w164420370', 'hipped'],
];
test('climbs real downtown buildings without getting inside one (body or camera)', { timeout: 900000 }, async (t) => {
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
    const res = await page.evaluate(async (cases) => {
      const L = window.__lab, T = L.THREE, W = L.world, sq = L.squirrel;
      L.paused = true;
      const ctrlCam = new T.PerspectiveCamera(55, 16 / 9, 0.02, 500);
      const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
      const edgeDist = (x, z, poly) => { let d = 1e9; for (let e = 0; e < poly.length; e++) { const A = poly[e], C = poly[(e + 1) % poly.length]; const vx = C[0] - A[0], vz = C[1] - A[1]; const t = Math.max(0, Math.min(1, ((x - A[0]) * vx + (z - A[1]) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - A[0] - vx * t, z - A[1] - vz * t)); } return d; };
      const scen = [[0, 1], [0, 1, 'roam'], [0.7, 0.7], [1, 0.25], [0, 1, 'down']];
      const out = { runs: 0, climbed: 0, onRoof: 0, problems: [] };
      let k = 0;
      for (const [id] of cases) {
        const B = W.data.buildings.find((q) => q.id === id);
        if (!B) { out.problems.push(`missing building ${id}`); continue; }
        const nb = W.data.buildings.filter((q) => Math.abs(q.outer[0][0] - B.outer[0][0]) < 90 && Math.abs(q.outer[0][1] - B.outer[0][1]) < 90);
        let best = 0, bi = 0;
        for (let i = 0; i < B.outer.length; i++) { const a = B.outer[i], c = B.outer[(i + 1) % B.outer.length]; const l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l > best) { best = l; bi = i; } }
        for (const ei of [bi, (bi + 1) % B.outer.length, (bi + 2) % B.outer.length]) {
          const a = B.outer[ei], c = B.outer[(ei + 1) % B.outer.length];
          const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ex = c[0] - a[0], ez = c[1] - a[1], el = Math.hypot(ex, ez);
          if (el < 2) continue;
          let nx = ez / el, nz = -ex / el;
          if (pip(mx + nx * 0.3, mz + nz * 0.3, B.outer)) { nx = -nx; nz = -nz; }
          const sx = mx + nx, sz = mz + nz;
          if (nb.some((q) => pip(sx, sz, q.outer))) continue;            // party wall
          await W.ready({ x: sx, y: 0, z: sz });
          const g = W.raycast(new T.Vector3(sx, W.groundAt(sx, sz) + 3, sz), new T.Vector3(0, -1, 0), 6);
          if (!g || g.normal.y < 0.7 || g.point.y > W.groundAt(sx, sz) + 0.6) continue;
          const sc = scen[k++ % scen.length];
          sq.reset({ x: sx, y: g.point.y, z: sz, yaw: Math.atan2(nx, nz) });
          ctrlCam.position.set(sx + nx * 1.5, g.point.y + 0.6, sz + nz * 1.5); ctrlCam.lookAt(mx, g.point.y + 0.5, mz); ctrlCam.updateMatrixWorld();
          L.cam.snapBehind();
          out.runs++;
          let climbed = false, onRoof = false;
          const above = new Set();     // footprints the squirrel is over at roof height
          let prevY = sq.position.y, prevState = sq.state;
          for (let i = 0; i < 60 * 8; i++) {
            let mv = [sc[0], sc[1]];
            if (sc[2] === 'down' && i > 150) mv = [0, -1];
            if (sc[2] === 'roam' && i > 240) { const tt = i / 60; mv = [Math.sin(tt * 1.3), Math.cos(tt * 0.9)]; }
            const jp = sc[2] === 'roam' && i % 97 === 0;
            const controls = { move: mv, look: [0, 0], jump: jp, jumpPressed: jp, sprint: i % 200 < 60 ? 1 : 0, sitPressed: false, digPressed: false, recenter: false };
            sq.update(1 / 60, controls, W, ctrlCam);
            L.cam.update(1 / 60, controls);
            if (i % 30 === 0) W.update(0.5, ctrlCam, sq.position);
            const p = sq.position, cp = L.camera.position;
            if (sq.state === 'climb') climbed = true;
            if (sq.state !== 'climb' && p.y > B.base + B.height - 0.3) onRoof = true;
            for (const q of nb) {
              const eav = q.base + q.height;
              const inBody = pip(p.x, p.z, q.outer) && edgeDist(p.x, p.z, q.outer) > 0.08;
              if (inBody && p.y > q.base + 0.1) {
                if (p.y < eav - 0.2) out.problems.push(`${id} ${sc.join(',')} frame ${i}: squirrel inside ${q.id} at ${p.toArray().map((v) => v.toFixed(2))} (eaves ${eav.toFixed(2)}, ${sq.state})`);
                else if (!above.has(q.id)) {
                  // it may only arrive over a roof by climbing onto it or leaping (<= ~1 m) onto it
                  if (prevState !== 'climb' && prevY < eav - 1.1) out.problems.push(`${id} ${sc.join(',')} frame ${i}: appeared above ${q.id}'s roof from y ${prevY.toFixed(2)} (eaves ${eav.toFixed(2)})`);
                  above.add(q.id);
                }
              } else above.delete(q.id);
              if (pip(cp.x, cp.z, q.outer) && cp.y < eav - 0.2 && cp.y > q.base + 0.1 && edgeDist(cp.x, cp.z, q.outer) > 0.0)
                out.problems.push(`${id} ${sc.join(',')} frame ${i}: camera inside ${q.id} at ${cp.toArray().map((v) => v.toFixed(2))}`);
            }
            prevY = p.y; prevState = sq.state;
            if (out.problems.length > 6) break;
          }
          if (climbed) out.climbed++;
          if (onRoof) out.onRoof++;
        }
      }
      return out;
    }, TOWN_CASES);
    assert.deepEqual(res.problems.slice(0, 6), [], 'never inside a building');
    assert.ok(res.runs >= 8, `ran ${res.runs} climbs`);
    assert.ok(res.climbed >= res.runs * 0.6, `climbed in ${res.climbed} of ${res.runs} runs`);
    assert.ok(res.onRoof >= 1, `topped out onto a roof in ${res.onRoof} runs`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); srv.close();
  }
});
