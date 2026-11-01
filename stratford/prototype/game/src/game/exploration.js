// The exploration rules: landmarks found, nuts picked up, buried and dug up,
// eaten. No rendering here (nutview.js draws the nuts); events go out to the
// shell, which turns them into cards, sounds and rumble.

import { defaultSave, loadSave, writeSave, clearSave } from './save.js';
import { newDiscoveries } from './discover.js';
import { nutWithin } from './nuts.js';

export function createExploration({ landmarks = [], nuts = [], storage = globalThis.localStorage, now = () => Date.now() } = {}) {
  let save = loadSave(storage);
  const listeners = new Map();
  const emit = (name, data) => { for (const fn of listeners.get(name) || []) fn(data); };
  const persist = () => writeSave(save, storage);
  const byId = new Map(nuts.map((n) => [n.id, n]));

  const api = {
    get save() { return save; },
    landmarks,
    nuts,
    on(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    isFound: (id) => !!save.discovered[id],
    get landmarksFound() { return landmarks.filter((l) => save.discovered[l.id]).length; },
    get landmarkTotal() { return landmarks.length; },
    // Placed nuts picked up so far (carried, eaten or buried again).
    get nutsFound() { return save.collected.filter((id) => byId.has(id)).length; },
    get nutTotal() { return nuts.length; },
    get carried() { return save.carried.length; },
    get buriedCount() { return save.buried.length; },
    // Nuts still lying about: for the view.
    lying() { const got = new Set(save.collected); return nuts.filter((n) => !got.has(n.id)); },
    buried() { return save.buried; },

    // Every simulation step with the squirrel's position.
    update(pos) {
      for (const lm of newDiscoveries(landmarks, pos, save.discovered)) {
        save.discovered[lm.id] = now();
        persist();
        emit('discover', { landmark: lm, found: api.landmarksFound, total: landmarks.length });
      }
      const got = new Set(save.collected);
      const lying = nuts.filter((n) => !got.has(n.id));
      const n = nutWithin(lying, pos);
      if (n) {
        save.collected.push(n.id);
        save.carried.push(n.kind);
        persist();
        emit('nut', { nut: n, found: api.nutsFound, total: nuts.length, carried: save.carried.length });
        return;
      }
    },

    // Y: bury a carried nut where the squirrel stands, or dig one up.
    dig(pos) {
      const near = nutWithin(save.buried, pos, 1.3, 2);
      if (near) {
        save.buried = save.buried.filter((b) => b !== near);
        save.carried.push(near.kind);
        persist();
        emit('dig', { nut: near, carried: save.carried.length });
        return { action: 'dig', nut: near };
      }
      if (save.carried.length) {
        const kind = save.carried.pop();
        const b = { id: `b${save.nextBuryId++}`, x: pos.x, y: pos.y, z: pos.z, kind };
        save.buried.push(b);
        persist();
        emit('bury', { nut: b, carried: save.carried.length });
        return { action: 'bury', nut: b };
      }
      emit('nothing', {});
      return { action: 'none' };
    },

    // X while carrying a nut: sit up and eat it.
    eat() {
      if (!save.carried.length) return false;
      save.carried.pop();
      save.eaten++;
      persist();
      emit('eat', { carried: save.carried.length, eaten: save.eaten });
      return true;
    },

    reset() {
      clearSave(storage);
      save = defaultSave();
      emit('reset', {});
    },
  };
  return api;
}
