// Regression cases for generated IDs that a literal-only scanner misses.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { literalDependencies, expandAssetDependencies } from './lib/art-dependencies.mjs';
import { EDITION, FILM, FILM_CAST, RETIRED_IDLE } from '../src/theme.js';
import { resolveImageId } from '../src/art-dependencies.js';
import { ACT_ART } from '../src/act-art.js';
import { validateActArt } from './lib/validate-act-art.mjs';
const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url)));
const slots = Object.fromEntries(Object.entries(manifest.slots).filter(([id, slot]) => slot.status === 'delivered' && !RETIRED_IDLE.test(id)));
for (const tinted of [false, true]) {
  const suffix = tinted ? '-tinted' : '';
  const expand = source => expandAssetDependencies(literalDependencies(source), { slots, cast: FILM_CAST, tinted });
  for (const [legacy, crew] of Object.entries({ 'reveller-yellow': 'crew-squire', 'reveller-shaggy': 'crew-bosun', 'reveller-jester': 'crew-helmsman', 'reveller-lady': 'crew-manatarms' })) {
    const images = expand(`const cast = ['${legacy}']; const poses = [CREW_OF[id] + '-crawl', CREW_OF[id] + '-sit-up', CREW_OF[id] + '-asleep', CREW_OF[id] + '-tumble'];`);
    for (const pose of ['crawl', 'sit-up', 'asleep', 'tumble']) assert.ok(images.includes(`${crew}-${pose}${suffix}`), `${crew}/${pose}/${suffix} is a generated dependency`);
    assert.ok(images.includes(crew), 'cast base probes remain loaded');
  }
  const walk = expand("walkFrame('sailor', distance); walkFrame('prince-court', distance); walkFrameFromSwing('sailor-carry', swing);");
  for (const id of ['prince-stride-a', 'prince-stride-b', 'prince-pass-a', 'prince-pass-b', 'prince-court-stride-a', 'prince-court-stride-b', 'prince-carry-walk-a', 'prince-carry-walk-b', 'prince-carry-pass-a', 'prince-carry-pass-b']) assert.ok(walk.includes(id + suffix), id);
  const attendants = expand("drawPose(k, 'attendant-' + kind + '-tumble');");
  for (const kind of ['pink', 'blue', 'green']) assert.ok(attendants.includes(`attendant-${kind}-tumble${suffix}`));
  const available = id => !!slots[id];
  assert.equal(resolveImageId('sailor-walk-a', { cast: FILM_CAST, available, tinted }), 'prince-stride-a' + suffix);
  assert.equal(resolveImageId('sailor-walk-b', { cast: FILM_CAST, available, tinted }), 'prince-stride-b' + suffix);
}
// Half a delivered stride pair must use the same fallback in drawing and
// in dependency generation; image-download timing must not affect selection.
const available = id => ['prince-walk-a', 'prince-walk-b', 'prince-stand', 'prince-stride-a'].includes(id);
assert.equal(resolveImageId('sailor-walk-a', { cast: FILM_CAST, available }), 'prince-walk-a');
assert.equal(resolveImageId('sailor-walk-b', { cast: FILM_CAST, available }), 'prince-stand');
await validateActArt(ACT_ART, manifest);
const stale = JSON.parse(JSON.stringify(ACT_ART));
const look = FILM ? 'tinted' : 'original', missingId = FILM ? 'crew-squire-crawl-tinted' : 'sailor-stand';
stale[EDITION].whale[look] = stale[EDITION].whale[look].filter(id => id !== missingId);
await assert.rejects(validateActArt(stale, manifest), error => error.message.includes('Run qa/build-act-art.mjs') && error.message.includes(missingId), 'publishing stale metadata must fail with an actionable missing-frame error');
console.log('Generated crew poses, walking cycles/stride pairs, arbitrary family prefixes and tint aliases share complete preload dependencies');
