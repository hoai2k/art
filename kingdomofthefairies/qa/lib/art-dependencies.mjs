import { WALK_PHASES } from '../../src/walking.js';
import { imageDependencies } from '../../src/art-dependencies.js';

export function literalDependencies(source) {
  return {
    ids: [...source.matchAll(/(['"])([a-z][a-z0-9-]*)\1/g)].map(m => m[2]),
    suffixes: [...source.matchAll(/(['"])(-[a-z][a-z0-9-]*)\1/g)].map(m => m[2]),
    walks: [...source.matchAll(/\bwalkFrame(?:FromSwing)?\(\s*(['"])([a-z][a-z0-9-]*)\1/g)].map(m => m[2]),
  };
}

// Expand generated names before resolving cast/walk/tint aliases. In
// particular CREW_OF[legacyId] + '-sit-up' has no complete literal ID for a
// text scanner to find. Resolve the base first, then apply known suffixes.
export function expandAssetDependencies(source, { slots, cast = {}, tinted = false }) {
  const available = id => !!slots[id];
  const options = { cast, tinted, available }, result = new Set();
  const candidates = new Set(source.ids);
  for (const prefix of source.walks) for (const phase of WALK_PHASES) candidates.add(prefix + '-' + phase);
  for (const raw of candidates) {
    if (raw.endsWith('-')) for (const id of Object.keys(slots)) if (id.startsWith(raw)) candidates.add(id);
  }
  // Only delivered names enter the closure, so arbitrary prose strings and
  // failed suffix combinations cannot produce downloads or unbounded growth.
  const queue = [...candidates], seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const raw = queue[i].replace(/-tinted$/, '');
    if (seen.has(raw)) continue;
    seen.add(raw);
    const mapped = available(cast[raw]) ? cast[raw] : raw;
    for (const id of imageDependencies(raw, options)) result.add(id);
    for (const root of [raw, mapped]) for (const suffix of source.suffixes) {
      const child = root + suffix;
      if (available(child) && !seen.has(child)) queue.push(child);
    }
  }
  return [...result].sort();
}
