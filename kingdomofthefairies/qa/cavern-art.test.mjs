import assert from 'node:assert/strict';
import { drawStalactite, floor } from '../src/acts/act4cavern-art.js';
import { CEIL_Y, DROP, createCavern, stepCavern } from '../src/acts/act4cavern.js';

const crops = [], rubble = [];
const k = {
  c: {}, img: () => ({ width: 120, height: 280 }),
  assetCrop: (...args) => { crops.push(args); return true; },
  asset: (...args) => { rubble.push(args); return true; },
};
// Painted supports begin at the walkable surface and continue below the stage.
floor(k,{x0:1900,x1:2300,y:490});
assert.ok(crops.length > 0);
assert.ok(crops.every(c=>c[0]==='cavern-platform' && c[6]===490 && c[6]+c[8]>720));
assert.ok(rubble.every(c=>c[0]==='cavern-ledge'));
crops.length=0;rubble.length=0;
const d = { x: 850, y: CEIL_Y, state: 'hang' };
drawStalactite(k, d, 0);
const [cap, spike] = crops.splice(0);
assert.ok(cap[6] < 0, "painted ceiling root extends through the top of the scene");
assert.ok(spike[7] >= 90, "stalactites have a substantial painted width");
assert.equal(CEIL_Y + DROP.len, 210, "larger ceiling-hung art preserves the original resting tip and fall timing");
assert.equal(cap[6] + cap[8], spike[6], 'hanging spike joins the painted ceiling without a gap');
assert.equal(spike[6] + spike[8], CEIL_Y + DROP.len, 'painted tip matches the hazard tip');
d.state = 'shake'; drawStalactite(k, d, 0.025);
assert.deepEqual(crops[0], cap, 'ceiling stays fixed while the spike shivers');
assert.notEqual(crops[1][5], spike[5]);
crops.length = 0;
d.state = 'fall'; d.y += 80; drawStalactite(k, d, 1);
assert.deepEqual(crops[0], cap, 'ceiling remains behind when the spike detaches');
assert.equal(crops[1][6], spike[6] + 80);
assert.equal(crops[1][6] + crops[1][8], d.y + DROP.len);
crops.length = 0;
d.state = 'broken'; d.landY = 520; drawStalactite(k, d, 2);
assert.deepEqual(crops, [cap]);
assert.equal(rubble[0][0], 'cavern-stalactite-broken');
assert.equal(rubble[0][2], 520, 'shards rest on the impact surface');
rubble.length = 0; d.landY = null; drawStalactite(k, d, 2);
assert.equal(rubble.length, 0, 'a spike lost in a pool leaves no floating rubble');

// A collision with an airborne prince must not leave rubble at his feet.
const cv = createCavern({ x: 850 });
Object.assign(cv.s, { y: 360, on: null, vy: 0 });
const falling = cv.drops[0]; Object.assign(falling, { state: 'fall', y: 240, vy: 0 });
const hits = [];
stepCavern(cv, 1 / 60, {}, { hit: cause => hits.push(cause), pearl() {}, events: [], graceLeft: () => 0 });
assert.ok(hits.includes('stalactite'));
assert.equal(falling.landY, 520, 'airborne hit debris uses the rock floor, not the prince’s altitude');
console.log('Painted stalactite attachment, shake, detachment, collision alignment and grounded rubble pass');
