// The save: progress in localStorage under `stratford.save`, versioned, and
// tolerant of anything found there (missing, corrupt, from the future).
// Settings live apart, under `stratford.settings`.

export const SAVE_KEY = 'stratford.save';
export const SETTINGS_KEY = 'stratford.settings';
export const SAVE_VERSION = 1;

export const defaultSave = () => ({
  version: SAVE_VERSION,
  discovered: {}, // landmark id -> time found (ms since 1970)
  collected: [], // ids of placed nuts picked up
  buried: [], // { id, x, y, z, kind } nuts the player buried
  carried: [], // kinds of nuts being carried, e.g. ['acorn', 'walnut']
  eaten: 0,
  nextBuryId: 1,
});

const KINDS = new Set(['acorn', 'walnut', 'conker']);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

// Anything -> a valid current save. Never throws.
export function sanitizeSave(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  // A save from a newer game is read as far as it makes sense, never rewritten smaller.
  if (raw.discovered && typeof raw.discovered === 'object' && !Array.isArray(raw.discovered)) {
    for (const [id, t] of Object.entries(raw.discovered)) if (typeof id === 'string' && id.length < 80) out.discovered[id] = num(t, 0);
  }
  if (Array.isArray(raw.collected)) out.collected = [...new Set(raw.collected.filter((v) => typeof v === 'string' && v.length < 40))];
  if (Array.isArray(raw.buried)) {
    for (const b of raw.buried.slice(0, 500)) {
      if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)) {
        out.buried.push({ id: typeof b.id === 'string' ? b.id : `b${out.buried.length + 1}`, x: b.x, y: b.y, z: b.z, kind: KINDS.has(b.kind) ? b.kind : 'acorn' });
      }
    }
  }
  if (Array.isArray(raw.carried)) out.carried = raw.carried.filter((k) => KINDS.has(k)).slice(0, 99);
  out.eaten = Math.max(0, Math.floor(num(raw.eaten, 0)));
  out.nextBuryId = Math.max(out.buried.length + 1, Math.floor(num(raw.nextBuryId, 1)));
  return out;
}

// Older versions are upgraded here, one step at a time. Only version 1 exists.
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultSave();
  return sanitizeSave(raw);
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(SAVE_KEY);
    if (!text) return defaultSave();
    return migrate(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* fine */ }
}

// Settings version 2 flipped the camera's vertical direction: what version 1
// called "not inverted" is now "Invert camera Y: On". Version 1 saved every key
// whether or not the player chose it, so its invertY says nothing: a version 1
// file takes the new default. From version 2 on, `changed` records the keys the
// player actually set, so a later change of default can keep their choice.
export const SETTINGS_VERSION = 2;
export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION, changed: [],
  camSens: 1, invertY: false, coat: 'grey', quality: 'medium', volume: 0.8, rumble: true, hints: true, sound: true,
};

export function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, changed: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  const version = Number.isInteger(raw.version) ? raw.version : 1;
  if (Array.isArray(raw.changed)) s.changed = [...new Set(raw.changed.filter((k) => typeof k === 'string' && k in DEFAULT_SETTINGS))];
  if (Number.isFinite(raw.camSens)) s.camSens = Math.min(2.5, Math.max(0.2, raw.camSens));
  // Version 1's invertY was the old default (or a choice we cannot tell apart from it): drop it.
  if (typeof raw.invertY === 'boolean' && version >= 2) s.invertY = raw.invertY;
  if (raw.coat === 'grey' || raw.coat === 'black') s.coat = raw.coat;
  if (['low', 'medium', 'high'].includes(raw.quality)) s.quality = raw.quality;
  if (Number.isFinite(raw.volume)) s.volume = Math.min(1, Math.max(0, raw.volume));
  if (typeof raw.rumble === 'boolean') s.rumble = raw.rumble;
  if (typeof raw.hints === 'boolean') s.hints = raw.hints;
  if (typeof raw.sound === 'boolean') s.sound = raw.sound;
  return s;
}

export function loadSettings(storage = globalThis.localStorage) {
  try { return sanitizeSettings(JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null')); } catch { return sanitizeSettings(null); }
}
export function writeSettings(s, storage = globalThis.localStorage) {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION })); } catch { /* fine */ }
}
