import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { keyboardControls } from '../src/keyboard.js';

globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
const input = createInput(window);
const key = (type, code) => { const e = new Event(type); Object.assign(e, { code, repeat: false }); window.dispatchEvent(e); };
const controls = (key, phase, extra = {}) => keyboardControls({ key }, { phase, ...extra }, true);
for (const [name, profile] of [
  ['gifts', controls('prologue', 'court')], ['hall', controls('court', 'play', { tf: {} })],
  ['sword duel', controls('burning', 'barrel')], ['final gifts', controls('burning', 'apotheosis')],
]) {
  key('keydown', 'Space'); let i = input.poll(.016, profile);
  assert.ok(i.keyAction && i.xHeld && !i.leap, `${name}: Space acts without jumping`);
  key('keyup', 'Space'); input.poll(.016, profile);
  key('keydown', 'KeyW'); i = input.poll(.016, profile);
  assert.ok(i.leap && i.aHeld && !i.keyAction, `${name}: W jumps`);
  assert.ok(!input.poll(.016, profile).leap, 'held jump does not generate repeated edges');
  key('keyup', 'KeyW'); input.poll(.016, profile);
}
for (const profile of [controls('grotto','swim'), controls('grotto','ride'), controls('tower','cliff'), controls('burning','house'), controls('burning','wedding'), controls('court','play')]) {
  key('keydown', 'KeyW'); let i = input.poll(.016, profile);
  assert.equal(i.leap, false, 'vertical movement must not also jump'); assert.equal(i.moveY, -1);
  key('keyup', 'KeyW'); input.poll(.016, profile);
  key('keydown', 'Space'); i = input.poll(.016, profile);
  assert.ok(i.leap && !i.keyAction, 'Space retains the separate jump/kick');
  key('keyup', 'Space'); input.poll(.016, profile);
}
key('keydown', 'ArrowUp'); assert.ok(input.poll(.016, controls('whale','cavern')).leap);
key('keyup', 'ArrowUp'); input.poll(.016);
key('keydown', 'Space'); assert.ok(input.poll(.016).confirm, 'Space still confirms menus');
console.log('Keyboard actions, held jumps, directional exceptions and menu confirmation pass');
