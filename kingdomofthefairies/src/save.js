import { STORAGE_PREFIX } from './theme.js';
// Progress across acts, in its own save slot. Keepsakes are carried forward:
// each act starts with the merged results of the acts before it.
const KEY = STORAGE_PREFIX + '.save.v1';

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return s; } catch { /* storage unavailable */ }
  return { v: 1, unlocked: 1, results: {}, best: {} };
}
export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

// What the player carries into act `id`: keepsakes and totals from acts 1..id-1.
export function carryInto(save, id) {
  const carry = { tea: 0, guitar: false, rose: false, pearl: false, stone: false, sleepers: 0, score: 0, pearls: 0 };
  for (let a = 1; a < id; a++) {
    const r = save.results[a];
    if (!r) continue;
    Object.assign(carry, r.keepsakes || {});
    carry.sleepers += r.sleepers || 0;
    carry.score += r.score || 0;
    carry.pearls += r.pearls || 0;
  }
  return carry;
}

export function recordResult(save, id, result, total) {
  save.results[id] = result;
  save.best[id] = Math.max(save.best[id] || 0, result.score || 0);
  save.unlocked = Math.max(save.unlocked, Math.min(total, id + 1));
  if (id === total && result.ending) save.endings = { ...(save.endings || {}), [result.ending]: true };
  writeSave(save);
}
