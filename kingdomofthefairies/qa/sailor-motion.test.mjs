import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { MOVEMENT_IDS, MOVEMENT_SIZE, drawMovement, airbornePose, whalePose, cliffPose, housePose } from '../src/acts/sailor-motion.js';
import whale from '../src/acts/act4.js';
import cliff, { HOUSE } from '../src/acts/act5.js';

assert.equal(airbornePose(-200), 'leap');
assert.equal(airbornePose(0), 'apex');
assert.equal(airbornePose(200), 'apex');   // a jump coming down reaches for the landing
assert.equal(airbornePose(1100), 'fall');  // only a long drop flails
assert.equal(whalePose({ on: null, vy: 400 }, 'climb'), 'apex');
assert.equal(whalePose({ on: null, vy: 1100 }, 'climb'), 'fall');
assert.equal(whalePose({ on: 'bank', vx: 0, landT: 0.1 }, 'climb'), 'land');
assert.equal(whalePose({ on: 'bank', vx: 0 }, 'down'), 'fall');
const st = { cl: { kind: 'climb', moveT: 0.2, moveDur: 0.34 } };
assert.equal(cliffPose(st, { moving: true, k: 0.2 }, {}), 'climb-a');
assert.equal(cliffPose(st, { moving: true, k: 0.8 }, {}), 'climb-b');
st.cl.kind = 'fall';
assert.equal(cliffPose(st, { moving: true, k: 0.2 }, {}), 'fall');
st.cl.kind = 'leap';
for (const [k, pose] of [[0.2, 'leap'], [0.5, 'apex'], [0.8, 'apex']]) {
  assert.equal(cliffPose(st, { moving: true, k }, {}), pose);
}
st.cl.moveT = st.cl.moveDur + 0.1;
assert.equal(cliffPose(st, { moving: false }, { kind: 'ledge' }), 'land');
st.cl.kind = 'fall';
assert.equal(cliffPose(st, { moving: false }, { kind: 'ledge' }), 'land');
st.cl.moveT += 0.2;
assert.equal(cliffPose(st, { moving: false }, { kind: 'ledge' }), 'stand');

const hs = { p: { f: 0, x: 10, y: 100, vx: 0 } };
for (const kind of ['ladder', 'ivy', 'stairs', 'slope']) {
  hs.p.conn = { c: { kind, a: { x: 0, f: 0 }, b: { x: 0, f: 1 } }, u: 0 };
  const floors = [100, 0];
  const first = housePose(hs, floors);
  assert.ok(first.startsWith(['stairs', 'slope'].includes(kind) ? 'stairs-' : 'climb-'));
  assert.equal(housePose(hs, floors), first, 'paused movement holds its frame');
  hs.p.conn.u = 0.27;
  assert.notEqual(housePose(hs, floors), first, 'distance changes the support phase');
}
hs.p.conn = null;
hs.throwT = 0.2;
assert.equal(housePose(hs), 'throw');
hs.p.carry = true;
assert.equal(housePose(hs), 'carry', 'keep the beloved visible');

// Landing cues only start on actual contact and expire without changing physics.
const w = whale.create();
Object.assign(w.s, { on: null, y: 297, vy: 240, air: true });
whale.step(w, 1/60, {});
assert.equal(w.s.on, 'bank');
assert.equal(w.s.landT, 0.16);
for (let i = 0; i < 12; i++) whale.step(w, 1/60, {});
assert.equal(w.s.landT, 0);
const h = cliff.create({ from: { scene: 2 } });
Object.assign(h.p, { f: -1, y: HOUSE.floors[0] - 3, vy: 240, airTop: HOUSE.floors[0] - 10 });
cliff.step(h, 1/60, {});
assert.equal(h.p.f, 0);
assert.equal(h.p.landT, 0.16);
for (let i = 0; i < 12; i++) cliff.step(h, 1/60, {});
assert.equal(h.p.landT, 0);

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url)));
const fitting = JSON.parse(readFileSync(new URL('../design/generated/movement-poses/fitting.json', import.meta.url)));
for (const id of MOVEMENT_IDS) {
  assert.equal(manifest.slots[id].status, 'delivered');
  assert.deepEqual(manifest.slots[id].size, MOVEMENT_SIZE);
  assert.ok(existsSync(new URL('../assets/' + manifest.slots[id].file, import.meta.url)));
  const fit = fitting.find((f) => f.id === id);
  assert.ok(Math.abs(fit.sourceHeadHeight * fit.uniformScale - 60) < 1e-9);
  assert.equal(fit.placement[1] + fit.placement[3], 440);
  for (const height of [108, 110, 144]) for (const face of [-1, 1]) {
    const calls = [];
    const k = { img: () => true, c: new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]) }),
      asset: (...args) => { calls.push(['asset', ...args]); return true; } };
    assert.equal(drawMovement(k, id.slice(7), 123, 456, height, face), true);
    assert.deepEqual(calls.find((c) => c[0] === 'translate'), ['translate', 123, 456]);
    assert.deepEqual(calls.find((c) => c[0] === 'scale'), ['scale', face, 1]);
    const draw = calls.find((c) => c[0] === 'asset');
    assert.ok(Math.abs(draw[4] / draw[5] - 360 / 440) < 1e-9, 'no aspect-ratio distortion');
    assert.ok(Math.abs(draw[5] - 440 * height / 360) < 1e-9, 'same anatomical scale in each act');
  }
}
assert.equal(drawMovement({ img: () => false }, 'fall', 0, 0, 110), false);
console.log('Sailor movement: state selection, landing contact, anchors, scale, mirroring and fallback passed');
