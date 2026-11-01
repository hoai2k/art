// Saved settings and progress (best score per bird), in localStorage when it
// is available. The game works the same without it, it just forgets.

import { difficulty } from './games/difficulty.js';
import { multiplier } from './points.js';

const SETTINGS_KEY = 'icecreamcone.settings.v1';
const PROGRESS_KEY = 'icecreamcone.progress.v1';
const PHOTOS_KEY = 'icecreamcone.photos.v1';
const STICKERS_KEY = 'icecreamcone.stickers.v1';

export const DEFAULTS = {
  volume: 80,
  sound: true,
  vibration: true,
  difficulty: 'normal', // 'easier' | 'normal' | 'harder' (src/games/difficulty.js)
};
const LEVELS = ['easier', 'normal', 'harder'];

// Not settings the player changes: music and effects keep a fixed balance
// under the one volume, and motion follows the device's own preference.
const FIXED = {
  music: 50,
  sfx: 80,
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};

// In ?debug, progress and the sticker book are kept for this tab's session
// only: they start from what is saved, but every change (a score, a moved
// sticker, a reset) goes to sessionStorage and the saved game is untouched.
// Settings are always saved.
let scratch = null;
export function keepForSessionOnly() {
  try {
    scratch = sessionStorage;
  } catch {
    scratch = null;
  }
}
const SCRATCH = 'icecreamcone.debug.';

function read(key, { session = false } = {}) {
  try {
    if (session && scratch) {
      const v = scratch.getItem(SCRATCH + key);
      if (v !== null) return JSON.parse(v);
    }
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
function write(key, value, { session = false } = {}) {
  try {
    if (session && scratch) scratch.setItem(SCRATCH + key, JSON.stringify(value));
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage unavailable
  }
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY) || {};
  const own = Object.fromEntries(Object.keys(DEFAULTS).filter((k) => k in saved).map((k) => [k, saved[k]]));
  if (!LEVELS.includes(own.difficulty)) delete own.difficulty;
  return { ...DEFAULTS, ...own, ...FIXED };
}
export function saveSettings(s) {
  write(SETTINGS_KEY, Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, s[k]])));
}

// { [birdId]: { v, best, by?, tally?, plays, passed? } }.
//
// Bests are kept in points (src/points.js: the score scaled by the difficulty
// it was earned at), one per level: `best` is the Normal best, `by` holds the
// others ({ easier?, harder? }). `tally` holds the best plain score per level
// ({ normal?, easier?, harder? }): the bird's own count, which the pass mark
// is checked against. A pass at any level counts for good (`passed`).
//
// `v: 2` marks an entry in points. Older entries (no `v`) kept plain scores in
// `best` and `by`; `upgrade` turns each into points at the average multiplier
// of its level's curve (what an even round at that level earns per unit) and
// keeps the plain number as the tally. Saves from before the Difficulty
// setting had only `best`, a Normal best, so they carry over the same way.
export const level = (l) => (LEVELS.includes(l) ? l : 'normal');

// The average of (1 + d) over a round at each level: Easier about 1.18,
// Normal about 1.38, Harder about 1.68.
export const AVERAGE_MULTIPLIER = Object.fromEntries(
  LEVELS.map((l) => {
    const n = 1000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += multiplier(difficulty((i + 0.5) / n, l));
    return [l, sum / n];
  }),
);

// An entry in points, whatever its age. Returns the same entry if it is
// already in points (or missing), otherwise a new one.
export function upgrade(e) {
  if (!e || typeof e !== 'object' || e.v === 2) return e;
  const plain = { normal: e.best || 0, easier: e.by?.easier || 0, harder: e.by?.harder || 0 };
  const out = { ...e, v: 2, best: Math.round(plain.normal * AVERAGE_MULTIPLIER.normal) };
  delete out.by;
  delete out.tally;
  for (const l of LEVELS) {
    if (!plain[l]) continue;
    out.tally = { ...out.tally, [l]: plain[l] };
    if (l !== 'normal') out.by = { ...out.by, [l]: Math.round(plain[l] * AVERAGE_MULTIPLIER[l]) };
  }
  return out;
}

// Every entry of a progress object in points (in place); returns it.
export function upgradeAll(progress) {
  for (const id of Object.keys(progress)) progress[id] = upgrade(progress[id]);
  return progress;
}

// The best points at a level.
export function bestAt(e, l = 'normal') {
  const u = upgrade(e);
  if (!u) return 0;
  return (level(l) === 'normal' ? u.best : u.by?.[l]) || 0;
}

// The best plain score at a level (an old entry's plain best, before upgrade).
export function tallyAt(e, l = 'normal') {
  const u = upgrade(e);
  return u?.tally?.[level(l)] || 0;
}

export function loadProgress() {
  const p = read(PROGRESS_KEY, { session: true });
  return p && typeof p === 'object' ? upgradeAll(p) : {};
}

// Records a round at a level: its points and, when given, its plain score.
// Returns true when the points are a new best for that level. `passedNow`
// marks the bird passed for good: a pass is kept even if its pass mark rises
// later, and whichever level it was made at.
export function recordScore(progress, id, points, passedNow = false, at = 'normal', tally) {
  const e = upgrade(progress[id]) || { v: 2, best: 0, plays: 0 };
  const l = level(at);
  e.plays = (e.plays || 0) + 1;
  if (passedNow) e.passed = true;
  const isBest = points > bestAt(e, l);
  if (isBest) {
    if (l === 'normal') e.best = points;
    else e.by = { ...e.by, [l]: points };
  }
  if (tally > tallyAt(e, l)) e.tally = { ...e.tally, [l]: tally };
  e.best ||= 0;
  progress[id] = e;
  write(PROGRESS_KEY, progress, { session: true });
  return isBest;
}

// Forgetting the scores keeps them aside (the best of everything ever
// forgotten), so Restore can bring them back.
const BACKUP_KEY = 'icecreamcone.progress.backup.v1';
const STICKERS_BACKUP_KEY = 'icecreamcone.stickers.backup.v1';

// The higher best at each level, points and plain (and the larger number of
// plays) for every bird in either, old entries upgraded to points first.
export function mergeProgress(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = upgrade(a[id]) || { v: 2, best: 0, plays: 0 };
    const y = upgrade(b[id]) || { v: 2, best: 0, plays: 0 };
    out[id] = { v: 2, best: Math.max(x.best || 0, y.best || 0), plays: Math.max(x.plays || 0, y.plays || 0) };
    if (x.passed || y.passed) out[id].passed = true;
    for (const l of LEVELS.filter((l) => l !== 'normal')) {
      const v = Math.max(bestAt(x, l), bestAt(y, l));
      if (v) out[id].by = { ...out[id].by, [l]: v };
    }
    for (const l of LEVELS) {
      const v = Math.max(tallyAt(x, l), tallyAt(y, l));
      if (v) out[id].tally = { ...out[id].tally, [l]: v };
    }
  }
  return out;
}

export function resetProgress() {
  const now = loadProgress();
  if (Object.keys(now).length) write(BACKUP_KEY, mergeProgress(loadBackup(), now), { session: true });
  const book = loadStickers();
  if (book) write(STICKERS_BACKUP_KEY, book, { session: true });
  write(PROGRESS_KEY, {}, { session: true });
}

export function loadBackup() {
  const b = read(BACKUP_KEY, { session: true });
  return b && typeof b === 'object' ? upgradeAll(b) : {};
}

// True when the kept scores hold a best higher than today's for some bird.
export function canRestore(progress) {
  return Object.entries(loadBackup()).some(([id, e]) => LEVELS.some((l) => bestAt(e, l) > bestAt(progress[id], l)));
}

// Brings back the kept scores, merged with today's; the sticker book comes
// back too if it has been left empty since.
export function restoreProgress(progress) {
  const merged = mergeProgress(progress, loadBackup());
  write(PROGRESS_KEY, merged, { session: true });
  const kept = read(STICKERS_BACKUP_KEY, { session: true });
  if (kept && !loadStickers()) write(STICKERS_KEY, kept, { session: true });
  return merged;
}

// The sticker book: where the player has put each sticker, the picture
// behind them and the spread it is open at (see stickerbook.js, which checks
// what comes back). Raw here; null when nothing is saved.
export function loadStickers() {
  return read(STICKERS_KEY, { session: true });
}
export function saveStickers(book) {
  write(STICKERS_KEY, book, { session: true });
}
export function resetStickers() {
  if (scratch) {
    write(STICKERS_KEY, null, { session: true });
    return;
  }
  try {
    localStorage.removeItem(STICKERS_KEY);
  } catch {
    /* storage unavailable */
  }
}

// Saves from before passes were kept: a bird counts as passed if its best
// plain score at Normal reaches its mark, or if any bird after it in the guide has been played
// (its page could only have been opened by passing this one). Returns true if
// anything changed. Run once, on a save that has no kept passes yet.
export function keepOldPasses(progress, birds) {
  if (Object.values(progress).some((e) => e && 'passed' in e)) return false;
  let changed = false;
  let later = false;
  for (let i = birds.length - 1; i >= 0; i--) {
    const e = progress[birds[i].id];
    if (e && (later || tallyAt(e, 'normal') >= birds[i].pass)) {
      e.passed = true;
      changed = true;
    }
    if (e && e.plays > 0) later = true;
  }
  if (changed) write(PROGRESS_KEY, progress, { session: true });
  return changed;
}


export const loadPhotos = () => read(PHOTOS_KEY, { session: true });
export const savePhotos = photos => write(PHOTOS_KEY, photos, { session: true });
