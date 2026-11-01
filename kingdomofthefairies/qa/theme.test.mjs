import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url)));
const original = JSON.stringify(manifest);
delete process.env.KOTF_EDITION;
for (const [search, edition] of [['', 'film'], ['?qa', 'film'], ['?widowsbay', 'film'], ['?qa&widowsbay=', 'film'],
  ['?widowsbay=1', 'film'], ['?widowsbay=partial', 'partial'], ['?qa&widowsbay=Partial', 'partial'],
  ['?widowsbay=off', 'film'], ['?qa&widowsbay=OFF', 'film'], ['?widowsbay=on', 'widowsbay'], ['?qa&widowsbay=On', 'widowsbay']]) {
  const legacy = edition === 'widowsbay';
  globalThis.location = { search };
  const theme = await import('../src/theme.js?mode=' + encodeURIComponent(search));
  assert.equal(theme.EDITION, edition, search);
  assert.equal(theme.LEGACY, legacy);
  assert.equal(theme.FILM, edition === 'film');
  assert.equal(theme.CLASSIC, edition !== 'film');
  assert.equal(theme.TITLE, legacy ? "Widow's Bay" : 'Kingdom of the Fairies');
  // the partial and film editions swap the guitar for the sword in words
  assert.equal(theme.words('Catch the guitar'), edition === 'widowsbay' ? 'Catch the guitar' : 'Catch the sword');
  assert.equal(new Set([theme.STORAGE_PREFIX]).size, 1);
  const result = theme.themeManifest(manifest);
  assert.equal(!!result.audio.song, legacy);
  assert.equal(!!result.slots['band-trio'], legacy);
  assert.equal(Object.keys(result.slots).some(id => id.startsWith('band-')), legacy);
  assert.equal(result.slots.logo.file, legacy ? 'logo.webp' : 'fairies-title.webp');
  // The supplied wedding recording joins the five existing period pieces.
  assert.equal(Object.values(result.audio.period).filter((v) => v.status === 'delivered').length, 6);
  assert.deepEqual(result.audio.period['period-wedding'].moods, ['wedding']);
  assert.ok(result.slots['sailor-stand']);
  // film-only slots stay out of the query edition; interim cut-outs load in the film edition
  assert.equal(Object.values(result.slots).some((sl) => sl.edition === 'film'), !legacy);
  if (!legacy) {
    assert.equal(result.slots['prince-stand'].status, 'delivered');
    for (const [id, sl] of Object.entries(manifest.slots)) if (sl.edition === 'film') {
      // delivered art loads as delivered; a slot still requested loads its interim cut-out
      if (sl.status === 'delivered') assert.equal(result.slots[id].file, sl.file, id);
      else if (sl.interim) assert.equal(result.slots[id].file, sl.interim, id);
    }
    assert.ok(result.slots['tableau-curse']);
  } else assert.equal(result.slots['prince-stand'], undefined);
  assert.equal(JSON.stringify(manifest), original, 'shared source manifest is untouched');
}
delete globalThis.location;
console.log('All three editions: theme manifests and query semantics pass');
