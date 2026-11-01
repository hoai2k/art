import assert from 'node:assert/strict';
import {validAnimation,animationDuration,animationFrame} from '../src/animation.js';
const base={frameW:40,frameH:60,frames:18,cols:6,fps:12,loop:'loop'};
assert.equal(validAnimation(base,{width:240,height:180}),true);
assert.equal(validAnimation(base,{width:239,height:180}),false);
assert.equal(validAnimation({...base,cols:0}),false);
assert.equal(validAnimation({...base,fps:0}),false);
assert.equal(validAnimation({...base,beats:4,bpm:0}),false);
assert.equal(validAnimation({...base,beats:4,bpm:NaN}),false);
assert.equal(animationFrame({...base,loop:'unknown'},0),null);
assert.equal(animationFrame(base,NaN),null);
assert.deepEqual(animationFrame(base,1),{index:12,sx:0,sy:120,sw:40,sh:60});
assert.equal(animationFrame(base,-10).index,0);
assert.equal(animationFrame({...base,loop:'once'},100).index,17);
const beat={...base,frames:24,beats:4,bpm:76.5};
assert.ok(Math.abs(animationDuration(beat)-3.13725490196)<1e-8);
for(let cycle=0;cycle<10;cycle++) {
 const offset=(cycle+.125)*animationDuration(beat);
 assert.equal(animationFrame(beat,offset).index,3);
}
assert.equal(animationFrame(beat,animationDuration(beat)*.5).index,12);
const pp={...base,frames:4,cols:4,loop:'pingpong',fps:6};
assert.deepEqual(Array.from({length:7},(_,i)=>animationFrame(pp,i/6+1e-8).index),[0,1,2,3,2,1,0]);
assert.equal(animationFrame({...base,frames:1,loop:'pingpong'},100).index,0);
console.log('animation timing, musical cycles, rectangles and invalid-sheet fallback passed');
// Old-film idles: A, B, A, C on the half-beat; one variant alone is A, B, A, B;
// none leaves the still.
{
  const { idleFrameId, IDLE_STEP } = await import('../src/animation.js');
  const both = (f) => ['x', 'x-idle-b', 'x-idle-c'].includes(f), onlyB = (f) => f === 'x' || f === 'x-idle-b';
  const at = (has, i) => idleFrameId('x', (i + 0.5) * IDLE_STEP, has);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => at(both, i)), ['x', 'x-idle-b', 'x', 'x-idle-c', 'x']);
  assert.deepEqual([0, 1, 2, 3].map((i) => at(onlyB, i)), ['x', 'x-idle-b', 'x', 'x-idle-b']);
  assert.equal(idleFrameId('x', 1.3, (f) => f === 'x'), 'x');
  assert.equal(idleFrameId('x', NaN, both), 'x');
  assert.equal(idleFrameId('x', -0.5 * IDLE_STEP, both), 'x-idle-c');
  assert.equal(idleFrameId('x', 1.5 * 0.6, both, 0.6), 'x-idle-b');
}
console.log('old-film idle frame order passed');
// The film tricks: deterministic, bounded, still at amp 0, and the uneven
// cranking never moves a frame change by more than a third of a step.
{
  const { idlePose, FILM_IDLE, IDLE_STEP } = await import('../src/animation.js');
  assert.deepEqual(idlePose('x', 1.234, { h: 420, w: 220 }), idlePose('x', 1.234, { h: 420, w: 220 }));
  assert.deepEqual(idlePose('x', 2, { amp: 0 }), { time: 2, dx: 0, dy: 0, rot: 0, sy: 1 });
  let moved = false;
  for (let t = 0; t < 20; t += 0.05) {
    const p = idlePose('reveller-yellow', t, { h: 420, w: 220 });
    assert.ok(Math.abs(p.dx) <= FILM_IDLE.boilPx * 420 + 1e-9 && Math.abs(p.rot) <= FILM_IDLE.boilRot + FILM_IDLE.sway + 1e-9);
    assert.ok(Math.abs(p.sy - 1) <= FILM_IDLE.breath + 1e-9 && Math.abs(p.time - t) <= FILM_IDLE.crank * IDLE_STEP + 1e-9);
    if (Math.abs(p.dx) > 0.2) moved = true;
  }
  assert.ok(moved, 'the boil moves');
  const wide = idlePose('pageant-dancers', 1, { h: 315, w: 720 }), tall = idlePose('pageant-dancers', 1, { h: 720, w: 315 });
  assert.ok(Math.abs(wide.rot) < Math.abs(tall.rot), 'wide groups rock less');
  assert.notDeepEqual(idlePose('a', 1, { h: 400 }), idlePose('b', 1, { h: 400 }), 'each figure moves on its own');
}
console.log('film idle tricks passed');
