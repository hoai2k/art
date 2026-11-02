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
// The retired Extra Animations idle frames are never loaded; the climber's
// wall-idle poses still are.
{
  const { RETIRED_IDLE } = await import('../src/theme.js');
  assert.ok(RETIRED_IDLE.test('crew-squire-idle-b') && RETIRED_IDLE.test('water-fairy-stand-idle-c-tinted'));
  assert.ok(!RETIRED_IDLE.test('prince-wall-idle-b') && !RETIRED_IDLE.test('prince-wall-idle-b-tinted') && !RETIRED_IDLE.test('crew-squire'));
}
console.log('retired idle frames are left out; the climbing idles stay');
