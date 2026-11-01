import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhotos, nextPhotoRound } from '../src/photo-album.js';
import { SUBJECT_IDS, SUBJECTS } from '../src/subjects.js';
import { BIRDS } from '../src/birds.js';

const photo = (key, pinned = false) => ({ key, pinned, src: 'data:image/webp;base64,aGVsbG8=', name: 'Coot', pts: 60 });
test('only pins survive repeated rounds; unpinning releases an old photo next round', () => {
  let photos = [photo('old', true), photo('latest')];
  for (let i = 0; i < 100; i++) photos = [...nextPhotoRound(photos), photo('round-' + i)];
  assert.deepEqual(photos.map(p => p.key), ['old', 'round-99']);
  photos[0].pinned = false;
  assert.deepEqual(nextPhotoRound(photos), []);
});
test('saved photos validate image data and remove duplicate keys', () => {
  assert.deepEqual(normalizePhotos(null), []);
  assert.equal(normalizePhotos([photo('a'), photo('a'), { ...photo('b'), src: 'https://example.test' }]).length, 1);
});
test('Shuttercluck has every guide bird and all ten pocket birds', () => {
  for (const bird of BIRDS) assert.ok(SUBJECT_IDS.includes(bird.id), bird.id);
  assert.equal(SUBJECT_IDS.filter(id => SUBJECTS[id].pocket).length, 10);
});
