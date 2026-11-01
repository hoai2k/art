import assert from 'node:assert/strict';
import { FINALE, FINALE_END, CREDITS, finaleFrame } from '../src/finale.js';
import { createAudio } from '../src/audio.js';

assert.equal(finaleFrame(0).music, 1);
assert.equal(finaleFrame(FINALE.celebrate).creditsY, 720, 'credits enter from below');
assert.ok(finaleFrame(20).creditsY < finaleFrame(10).creditsY, 'credits roll upward');
assert.ok(finaleFrame(35).creditsY + CREDITS.at(-1).y < 100, 'last credit exits above the visible stage');
assert.equal(finaleFrame(35).music, 1, 'music holds through the roll');
assert.equal(finaleFrame(39).music,1,'the wedding score continues after the credits');
assert.equal(finaleFrame(39).fade,0,'the scene stays available for free play');
assert.equal(finaleFrame(FINALE_END).done,true,'only the credit roll finishes');

// The finale's gain must multiply, rather than overwrite, the saved volume.
const previousWindow = globalThis.window, gains = [];
globalThis.window = { AudioContext: class {
  currentTime = 0; state = 'running'; destination = {};
  createGain() {
    const node = { connect() {}, gain: { value: 1, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } } };
    gains.push(node); return node;
  }
} };
try {
  const audio = createAudio(); audio.unlock(); audio.setVolumes(0.6, 0.8);
  audio.setMusicLevel(0.5);
  assert.equal(gains[2].gain.value, 0.6 * 0.55 * 0.5);
  audio.setVolumes(0.4, 0.8);
  assert.equal(gains[2].gain.value, 0.4 * 0.55 * 0.5);
  audio.setMusicLevel(0); assert.equal(gains[2].gain.value, 0);
  audio.setMusicLevel(1); assert.equal(gains[2].gain.value, 0.4 * 0.55);
} finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
console.log('Credits roll once while the scene and music remain available; volume preservation passes');
