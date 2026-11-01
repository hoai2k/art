import assert from 'node:assert/strict';
import act, { PASSAGE, stepGaze, beamOn, litAt } from '../src/acts/act3.js';
const dt = 1 / 60;
function run(st, sec, input = () => ({}), until = () => false) {
  for (let t = 0; t < sec && !until(st); t += dt) { act.step(st, dt, { beat: st.t / .784, ...input(st) }); st.events.length = 0; }
}
const court = () => { const s = act.create({ from: { scene: 1 } }); s.p.grace = 0; s.gaze.dur = 999; s.whale.next = 999; return s; };
let n = 0;
function test(name, fn) { fn(); console.log('ok -', name); n++; }
test('Hall Doors: far-right entrances, stationary bows, guards pass in sequence and stay onstage', () => {
  const s = act.create(), f = s.tf;
  assert.ok(f.guards.every(g => g.x > 1100));
  run(s, 1, () => ({ moveX: 1 }));
  const x = f.x;
  run(s, 7, () => ({ moveX: 1, xHeld: true }));
  assert.equal(f.x, x); assert.ok(f.guards[0].passed); assert.equal(f.guards[1].mode, 'wait');
  run(s, 1, () => ({ moveX: 1 }));
  assert.notEqual(f.guards[1].mode, 'wait');
  run(s, 8, () => ({ xHeld: true }));
  assert.ok(f.guards.every(g => g.passed)); assert.equal(f.caught, 0);
  assert.ok(f.guards.every(g => g.x > 0 && g.x < f.x));
  run(s, 5, () => ({ moveX: 1 }), st => !st.tf);
  assert.equal(s.tf, null);
});
test('Hall Doors capture holds the lobster/prince pair, then releases with grace', () => {
  const s = act.create(); run(s, 5, () => ({ moveX: 1 }), s => s.tf.capture);
  assert.equal(s.tf.capture?.kind, 'lobster'); const x = s.tf.x;
  run(s, .5, () => ({ moveX: 1, a: true })); assert.equal(s.tf.x, x);
  run(s, .7); assert.equal(s.tf.capture, null); assert.ok(s.tf.x < x); assert.ok(s.tf.knockT > 0);
});
test('X holds a bow; A jumps upward and makes nearby people recoil then resume', () => {
  const s = court(); const c = s.courtiers.find(c => c.kind !== 'guard' && c.row === 2);
  s.p.x = c.x - 60; const x = s.p.x;
  act.step(s, dt, { xHeld: true, moveX: 1, a: true }); assert.equal(s.p.x, x); assert.equal(s.p.row, 2);
  act.step(s, dt, { a: true }); assert.equal(s.p.row, 1); assert.ok(s.p.jumpT > 0); assert.ok(c.recoilT > 0);
  const cx = c.x; run(s, .4); assert.ok(c.x > cx); assert.ok(s.p.lift > 0);
  run(s, 1.5); assert.equal(s.p.jumpT, 0); assert.equal(c.recoilT, 0);
  const resumed = c.x; run(s, 2); assert.notEqual(c.x, resumed);
});
for (const type of ['lobster', 'human']) for (const covered of [false, true]) test(`${type}: bow ${covered ? 'with' : 'without'} courtier cover`, () => {
  const s = court(); s.courtiers = [{ kind: 'guard', guardType: type, row: 2, x: s.p.x + 4, x0: s.p.x+4, x1: s.p.x+4, a: 200, b: 2700, dir: -1 }];
  if (covered) s.courtiers.push({ kind: 'pink', row: 2, x: s.p.x, x0: s.p.x, x1: s.p.x, a: 200, b: 2700, step: 40, pat: 'SSSR', dir: 1 });
  act.step(s, dt, { xHeld: true });
  assert.equal(s.lanterns, type === 'human' && !covered ? 2 : 3);
  assert.equal(!!s.capture, type === 'human' && !covered);
});
for (const type of ['human', 'lobster']) test(`${type}: upright player visibly captured on every hit and terminal hit`, () => {
  const s = court(); const guard = { kind: 'guard', guardType: type, row: 2, x: s.p.x+4, x0: s.p.x+4, x1: s.p.x+4, a: 200, b: 2700, dir: -1 }; s.courtiers = [guard];
  act.step(s, dt, {}); assert.equal(s.capture?.kind, type); assert.equal(s.lanterns, 2);
  const x = s.p.x; run(s, .6, () => ({ moveX: 1 })); assert.equal(s.p.x, x); assert.equal(s.lanterns, 2);
  run(s, .7); assert.equal(s.capture, null); assert.ok(s.p.grace > 0);
  s.p.x = guard.x; s.p.grace = 0; s.lanterns = 1;
  act.step(s, dt, {}); assert.equal(s.phase, 'caught'); assert.equal(s.capture.kind, type);
  run(s, 2); assert.equal(s.status, 'lost');
});
test('spotlight: bow alone is visible, courtier cover protects', () => {
  for (const covered of [false, true]) {
    const s = court(); s.courtiers = covered ? [{ kind: 'pink', row: 2, x: s.p.x, x0: s.p.x, x1: s.p.x, pat: 'R', dir: 1 }] : [];
    Object.assign(s.gaze, { phase: 'sweep', t: 0, dur: 8, from: s.p.x, to: s.p.x+500, aim: s.p.x, dir: 1 });
    act.step(s, dt, { xHeld: true }); assert.equal(s.lanterns, covered ? 3 : 2);
  }
});
test('spotlight: full out-and-back cycle follows camera and only then fades', () => {
  const g = { phase: 'dark', t: 0, dur: 0, lock: 0 }; let cam = 100;
  const ctx = () => ({ cam, rand: () => .1 });
  stepGaze(g, dt, null, ctx()); assert.equal(g.phase, 'warn');
  stepGaze(g, 3, null, ctx()); const left = g.from, right = g.to;
  cam += 200; stepGaze(g, g.dur, null, ctx());
  assert.equal(g.phase, 'sweep'); assert.equal(g.leg, 1); assert.equal(g.aim, right+200);
  stepGaze(g, g.dur, null, ctx()); assert.equal(g.phase, 'fade'); assert.equal(g.aim, left+200);
  stepGaze(g, .3, null, ctx()); assert.equal(g.phase, 'fade');
  stepGaze(g, .5, null, ctx()); assert.equal(g.phase, 'dark');
  const b = beamOn(500, 2, 1); assert.ok(b.cx-b.hw < 500-74); assert.equal(b.cx+b.hw, 574);
  assert.ok(litAt(500, 2, 380, 1)); assert.ok(!litAt(500, 2, 380, -1));
});
console.log(`${n} court film checks passed`);
