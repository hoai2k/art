import { ACTS } from '../../src/acts/index.js';
import { EDITION, FILM, FILM_CAST, themeManifest } from '../../src/theme.js';
import { collectActDependencies } from './collect-art-dependencies.mjs';
import { expandAssetDependencies } from './art-dependencies.mjs';

export async function validateActArt(catalog, manifest) {
  const slots = themeManifest(manifest).slots, missing = [], results = [];
  for (const act of ACTS) {
    const key = act.key || String(act.id), source = await collectActDependencies(key);
    for (const look of FILM ? ['tinted', 'original'] : ['original']) {
      const expected = expandAssetDependencies(source, { slots, cast: FILM ? { ...FILM_CAST, ...act.cast } : {}, tinted: look === 'tinted' });
      const listed = new Set(catalog[EDITION]?.[key]?.[look] || []);
      for (const id of expected) if (!listed.has(id)) missing.push(`${EDITION}/${key}/${look}: ${id}`);
      results.push({ edition: EDITION, act: key, look, dependencies: expected.length });
    }
  }
  if (missing.length) throw new Error('Scene preload catalog is incomplete. Run qa/build-act-art.mjs before publishing:\n' + missing.join('\n'));
  return results;
}
