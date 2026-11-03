// node --test stratford/prototype/game/test/touch.test.mjs
// The touch controls' pure logic (src/ui/touch-logic.js): drag vs tap, multi-touch ownership,
// the stick's maths, the hide/show timer, the look scaling and smoothing, the camera profile
// choice; and the follow camera's touch profile (src/creatures/camera.js) on the stand-in yard.
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

const src = (p) => import(pathToFileURL(join(GAME, 'src', p)).href);
const L = await src('ui/touch-logic.js');
const { createInput } = await src('input.js');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('sizes scale with the screen and stay comfortable', () => {
  assert.equal(L.dragThreshold(844, 390), 8);          // 1.5% of 390 = 5.9 -> at least 8 px
  assert.equal(L.dragThreshold(1366, 1024), 12);       // a big tablet: at most 12 px
  assert.ok(near(L.dragThreshold(1280, 700), 10.5));
  assert.equal(L.stickRadius(844, 390), 51);
  assert.equal(L.stickRadius(390, 844), 51);           // portrait: the same short side
  assert.equal(L.stickRadius(320, 568), 44);           // never smaller
  assert.equal(L.stickRadius(1366, 1024), 72);         // never larger
  const b = L.buttonSizes(844, 390);
  assert.ok(b.jump >= 68 && b.small >= 46 && b.small >= 44, JSON.stringify(b));
});

test('drag vs tap: thresholds and time', () => {
  const th = 10;
  assert.equal(L.classifyGesture({ dist: 3, ms: 120, released: true }, th), 'tap');
  assert.equal(L.classifyGesture({ dist: 10, ms: 120, released: true }, th), 'tap');   // at the threshold: still a tap
  assert.equal(L.classifyGesture({ dist: 10.5, ms: 120, released: true }, th), 'drag');
  assert.equal(L.classifyGesture({ dist: 2, ms: L.TAP_MS + 1, released: true }, th), 'hold'); // too slow for a tap
  assert.equal(L.classifyGesture({ dist: 2, ms: 50, released: false }, th), 'pending');
  assert.equal(L.classifyGesture({ dist: 40, ms: 50, released: false }, th), 'drag');

  // through the router: a quick still press is a tap and looks nowhere; a moving one is a drag, never a tap
  const r = L.createTouchRouter({ threshold: th });
  r.down(1, 400, 200, 0, 'surface');
  r.move(1, 403, 202);
  assert.equal(r.up(1, 403, 202, 150), 'tap');
  assert.deepEqual(r.take(), { dx: 0, dy: 0, zoom: 0 });
  r.down(2, 400, 200, 1000, 'surface');
  assert.equal(r.move(2, 406, 200), 'pending');        // within the slop: nothing yet
  assert.equal(r.move(2, 415, 200), 'drag');           // crosses it: the slop is swallowed
  assert.equal(r.move(2, 445, 190), 'drag');
  assert.deepEqual(r.take(), { dx: 30, dy: -10, zoom: 0 });
  assert.equal(r.up(2, 400, 200, 1100), null);         // came back to its start, quickly: still not a tap
  // a long still press is neither
  r.down(3, 10, 10, 2000, 'surface');
  assert.equal(r.up(3, 10, 10, 2600), null);
});

test('multi-touch ownership: the stick finger and the camera finger never mix', () => {
  const r = L.createTouchRouter({ threshold: 10, radius: 50 });
  assert.equal(r.down(1, 100, 300, 0, 'stick'), 'stick');
  r.move(1, 140, 300);                                 // stick pushed right
  // a second finger landing in the stick zone while the stick is held is a camera finger
  assert.equal(r.down(2, 120, 320, 10, 'stick'), 'camera');
  r.move(2, 180, 320); r.move(2, 220, 300);
  const s = r.stickState();
  assert.ok(near(s.move[0], (0.8 - L.STICK_DEAD) / (1 - L.STICK_DEAD), 1e-9) && near(s.move[1], 0), `stick unchanged by the second finger: ${s.move}`);
  const g = r.take();
  assert.ok(g.dx > 0 && g.dy < 0, 'the second finger turned the camera');
  // a finger on a button is a button, whatever happens around it
  assert.equal(r.down(3, 780, 330, 20, 'button:jump'), 'button');
  assert.deepEqual(r.buttons(), ['jump']);
  r.move(3, 700, 200);
  assert.equal(r.take().dx, 0, 'a button finger never turns the camera');
  assert.ok(r.busy);
  // lifting the camera finger leaves the stick alone; lifting the stick zeroes it
  r.up(2, 220, 300, 400);
  assert.equal(r.stick.id, 1);
  assert.equal(r.up(1, 140, 300, 500), 'stick-end');
  assert.deepEqual(r.stickState().move, [0, 0]);
  assert.equal(r.up(3, 700, 200, 600), 'button-end');
  assert.ok(!r.busy);
  // a new finger in the stick zone takes the stick again
  assert.equal(r.down(4, 90, 310, 700, 'stick'), 'stick');
});

test('pinch: two camera fingers zoom and do not look', () => {
  const r = L.createTouchRouter({ threshold: 10 });
  r.down(1, 300, 200, 0, 'surface');
  r.down(2, 500, 200, 5, 'surface');
  assert.ok(r.pinching);
  r.move(1, 250, 200); r.move(2, 550, 200);            // fingers apart: zoom in (closer, negative)
  const g = r.take();
  assert.equal(g.dx, 0); assert.equal(g.dy, 0);
  assert.ok(near(g.zoom, -Math.log(300 / 200) * L.PINCH_ZOOM, 1e-9), `zoom ${g.zoom}`);
  r.move(1, 300, 200); r.move(2, 500, 200);            // back together: further
  assert.ok(r.take().zoom > 0);
  assert.equal(r.up(1, 300, 200, 300), 'pinch-end');
  assert.ok(!r.pinching);
  r.move(2, 530, 210);                                 // the finger left behind looks again
  assert.ok(r.take().dx > 0);
  // a stick finger and one camera finger is no pinch
  const q = L.createTouchRouter();
  q.down(1, 50, 300, 0, 'stick'); q.down(2, 500, 200, 0, 'surface');
  assert.ok(!q.pinching);
});

test('stick maths: dead zone, clamp, sprint, knob, follow', () => {
  const R = 50;
  assert.deepEqual(L.stickVector(0, 0, R).move, [0, 0]);
  const tiny = L.stickVector(R * L.STICK_DEAD * 0.9, 0, R);
  assert.deepEqual(tiny.move, [0, 0]);                 // inside the dead zone
  const half = L.stickVector(0, -R * 0.5, R);          // up on screen = forward
  assert.ok(near(half.move[0], 0) && near(half.move[1], (0.5 - L.STICK_DEAD) / (1 - L.STICK_DEAD)));
  const full = L.stickVector(R, 0, R);
  assert.ok(near(full.mag, 1) && near(full.move[0], 1) && full.sprint === 0, 'the ring edge: full speed, no sprint yet');
  const out = L.stickVector(R * 2, 0, R);
  assert.ok(near(Math.hypot(...out.move), 1), 'clamped to 1');
  assert.equal(out.sprint, 1, 'pushed well past the ring: full sprint');
  assert.ok(near(Math.hypot(...out.knob), R), 'the knob stops at the ring');
  const mid = L.stickVector(R * (L.SPRINT_FROM + L.SPRINT_FULL) / 2, 0, R);
  assert.ok(mid.sprint > 0.4 && mid.sprint < 0.6, `sprint ramps: ${mid.sprint}`);
  const diag = L.stickVector(30, 30, R);
  assert.ok(near(diag.move[0], -diag.move[1]), 'down-right on screen = right and back');
  // the floating stick follows a finger that runs far out, so coming back is short
  const r = L.createTouchRouter({ radius: R });
  r.down(1, 100, 300, 0, 'stick');
  r.move(1, 300, 300);
  assert.ok(near(r.stick.ox, 300 - L.STICK_FOLLOW * R), `origin dragged along: ${r.stick.ox}`);
  assert.equal(r.stickState().sprint, 1);
  // an anchored stick: the press lands on it, the centre is the anchor
  const a = L.createTouchRouter({ radius: R });
  a.down(1, 110, 290, 0, 'stick', [100, 300]);
  assert.ok(a.stickState().mag > 0, 'grabbing the anchored stick off-centre deflects at once');
});

test('hide/show timer', () => {
  const f = L.createFader({ hideAfter: 3.5 });
  assert.equal(f.visible(0), false, 'hidden until shown');
  f.poke(10);
  assert.equal(f.visible(12), true);
  assert.equal(f.visible(13.49), true);
  assert.equal(f.visible(13.51), false, 'fades after 3.5 s unused');
  assert.equal(f.visible(20, true), true, 'a finger on a control shows it (and keeps it)');
  assert.equal(f.visible(23), true);
  assert.equal(f.visible(23.6), false);
  f.poke(30);                                          // a tap brings it back
  assert.equal(f.visible(30.1), true);
  f.hide();
  assert.equal(f.visible(30.2), false);
  assert.ok(L.HIDE_AFTER >= 3 && L.HIDE_AFTER <= 4);
});

test('look: scaled to the screen, eased over a few frames', () => {
  const [ax] = L.lookRadians(390, 0, 390, 1);
  assert.ok(near(ax, L.LOOK_TURN), 'a swipe across the short side turns LOOK_TURN');
  const [bx] = L.lookRadians(100, 0, 390, 1); const [cx] = L.lookRadians(100, 0, 780, 1);
  assert.ok(near(bx, cx * 2), 'the same drag turns half as much on a screen twice the size');
  assert.ok(near(L.lookRadians(100, 0, 390, 2)[0], bx * 2), 'camera sensitivity multiplies');
  assert.ok(L.lookRadians(0, 50, 390)[1] > 0, 'finger down = look down (mouse convention)');
  const s = L.createLookSmoother();
  s.add(1, -0.5);
  let sx = 0, frames = 0;
  const [f0] = s.step(1 / 60); sx += f0; frames++;
  assert.ok(f0 > 0.2 && f0 < 0.6, `first frame takes part of it: ${f0}`);
  while (Math.abs(s.pending[0]) > 1e-4 && frames < 60) { const [x] = s.step(1 / 60); sx += x; frames++; }
  assert.ok(frames < 30, `settles in well under half a second (${frames} frames)`);
  assert.ok(near(sx + s.pending[0], 1, 1e-9), 'nothing is lost');
});

test('camera profile choice', () => {
  const c = L.chooseCameraProfile;
  assert.equal(c({ kind: 'keyboard', explicit: false, coarse: true }), 'touch', 'a phone before any input');
  assert.equal(c({ kind: 'keyboard', explicit: false, coarse: false }), 'console', 'a desktop before any input');
  assert.equal(c({ kind: 'touch', explicit: true, coarse: false }), 'touch', 'a touch laptop, touched');
  assert.equal(c({ kind: 'controller', explicit: true, coarse: true }), 'console', 'a pad on a tablet');
  assert.equal(c({ kind: 'keyboard', explicit: true, coarse: true }), 'console', 'a keyboard on a tablet');
  assert.equal(c({ kind: 'pointer', explicit: true, coarse: true }), 'console');
  // input.js reports whether a device was actually used
  const target = new EventTarget();
  const input = createInput({ target, doc: null, getGamepads: () => [] });
  assert.equal(input.kindExplicit, false);
  const kinds = [];
  input.on('kind', (k) => kinds.push(k));
  const ev = (type, props) => Object.assign(new Event(type), props);
  target.dispatchEvent(ev('pointerdown', { pointerType: 'touch' }));
  assert.equal(input.kind, 'touch'); assert.equal(input.kindExplicit, true);
  assert.equal(c({ kind: input.kind, explicit: input.kindExplicit }), 'touch');
  target.dispatchEvent(ev('keydown', { code: 'KeyW' }));
  assert.equal(c({ kind: input.kind, explicit: input.kindExplicit, coarse: true }), 'console', 'the keyboard switches back');
  assert.deepEqual(kinds, ['touch', 'keyboard']);
  // and merges the touch state into controls
  input.touch.active = true; input.touch.move = [0, 1]; input.touch.zoom = -0.3; input.touch.jumpPressed = true; input.touch.dig = true;
  const ctl = input.controls(1 / 60);
  assert.deepEqual(ctl.move, [0, 1]); assert.ok(near(ctl.zoom, -0.3)); assert.ok(ctl.jumpPressed && ctl.digPressed);
  assert.equal(input.touch.zoom, 0, 'zoom is taken once');
});

test('button labels follow the creature and its state', () => {
  assert.deepEqual(L.buttonLabels('squirrel', 'idle'), { jump: 'Jump', icon: 'jump', action: 'Dig', sit: 'Sit' });
  assert.equal(L.buttonLabels('squirrel', 'idle', { carried: 1 }).sit, 'Eat');
  assert.equal(L.buttonLabels('squirrel', 'climb').jump, 'Leap');
  assert.equal(L.buttonLabels('swan', 'swim').jump, 'Fly');
  assert.equal(L.buttonLabels('swan', 'fly').jump, 'Flap');
  assert.equal(L.buttonLabels('heron', 'idle').action, 'Strike');
  assert.equal(L.buttonLabels('beaver', 'swim').jump, 'Dive');
  assert.equal(L.buttonLabels('beaver', 'dive').jump, 'Surface');
  assert.equal(L.buttonLabels('beaver', 'idle').action, 'Gnaw');
  assert.equal(L.buttonLabels('rabbit', 'idle').action, 'Thump');
  assert.equal(L.buttonLabels('swan', 'idle').action, 'Preen');
});

test('the touch camera profile: raised, further back, the creature low in the view, stronger follow', async () => {
  const THREE = await import('three');
  const { createStandInWorld } = await src('stand-in-world.js');
  const { CREATURES } = await src('creatures/index.js');
  const { profileOf } = await src('creatures/camera.js');
  const world = await createStandInWorld({ THREE, scene: new THREE.Scene() });
  const idle = () => ({ move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false, zoom: 0, boost: 0 });
  for (const kind of ['squirrel', 'swan']) {
    const mod = await CREATURES[kind]();
    const T = (await mod.createCreature({ model: false })).tuning;
    const tp = profileOf(T, 'touch'), cp = profileOf(T, 'console');
    assert.ok(tp.pitch >= THREE.MathUtils.degToRad(25) && tp.pitch <= THREE.MathUtils.degToRad(35), `${kind}: touch pitch ${tp.pitch}`);
    assert.ok(tp.pitch > cp.pitch && tp.distMul > cp.distMul && tp.followMax > cp.followMax, `${kind}: touch is higher, further, follows harder`);
    const run = async (profile) => {
      const cr = await mod.createCreature({ model: false });
      const cam = new THREE.PerspectiveCamera(55, 844 / 390, 0.05, 2000);
      cr.reset({ x: world.spawn.x, z: world.spawn.z, y: world.groundAt(world.spawn.x, world.spawn.z), yaw: 0 });
      const ctl = mod.createCamera({ THREE, camera: cam, creature: cr, world, profile });
      for (let i = 0; i < 90; i++) { cr.update(1 / 60, idle(), world, cam); ctl.update(1 / 60, idle()); }
      const p = ctl.debug.focus.clone().project(cam);   // the look-at point just above the creature
      return { ctl, cam, cr, ndcY: p.y, dist: cam.position.distanceTo(cr.position), elev: Math.asin((cam.position.y - cr.position.y) / cam.position.distanceTo(cr.position)) };
    };
    const con = await run('console'), tou = await run('touch');
    assert.equal(tou.ctl.profile, 'touch');
    assert.ok(tou.dist > con.dist * 1.25, `${kind}: further back (${con.dist.toFixed(2)} -> ${tou.dist.toFixed(2)} m)`);
    assert.ok(tou.elev > con.elev + 0.12, `${kind}: raised (${con.elev.toFixed(2)} -> ${tou.elev.toFixed(2)} rad)`);
    assert.ok(tou.ndcY < -0.15 && tou.ndcY > -0.7, `${kind}: the creature sits in the lower-middle of the view (ndc y ${tou.ndcY.toFixed(2)})`);
    assert.ok(Math.abs(con.ndcY) < 0.15, `${kind}: console framing unchanged (ndc y ${con.ndcY.toFixed(2)})`);
    // switching profile eases over to the other one
    tou.ctl.setProfile('console');
    for (let i = 0; i < 240; i++) { tou.cr.update(1 / 60, idle(), world, tou.cam); tou.ctl.update(1 / 60, idle()); }
    assert.ok(Math.abs(tou.cam.position.distanceTo(tou.cr.position) - con.dist) < con.dist * 0.08, `${kind}: back to the console distance`);
  }
  // stronger auto-follow: running sideways, the touch camera swings behind sooner
  const mod = await CREATURES.squirrel();
  const swing = async (profile) => {
    const cr = await mod.createCreature({ model: false });
    const cam = new THREE.PerspectiveCamera(55, 2, 0.05, 2000);
    cr.reset({ x: world.spawn.x, z: world.spawn.z, y: world.groundAt(world.spawn.x, world.spawn.z), yaw: 0 });
    const ctl = mod.createCamera({ THREE, camera: cam, creature: cr, world, profile });
    const c0 = ctl.yaw;
    for (let i = 0; i < 60; i++) { cr.update(1 / 60, { ...idle(), move: [1, 0] }, world, cam); ctl.update(1 / 60, idle()); }
    return Math.abs(Math.atan2(Math.sin(ctl.yaw - c0), Math.cos(ctl.yaw - c0)));
  };
  const sc = await swing('console'), st = await swing('touch');
  assert.ok(st > sc * 1.3, `the touch camera follows the turn harder (${sc.toFixed(2)} vs ${st.toFixed(2)} rad in 1 s)`);
});
