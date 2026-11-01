import assert from 'node:assert/strict';

process.env.KOTF_EDITION = 'film';
const { loadAssets } = await import('../src/art.js');
const slots = {
  'prince-stand': { status: 'delivered', file: 'prince-stand.webp', edition: 'film' },
  'prince-stand-tinted': { status: 'delivered', file: 'prince-stand-tinted.webp', edition: 'film' },
  'sea-king-throne': { status: 'delivered', file: 'sea-king-throne.webp' },
  'sea-king-throne-tinted': { status: 'delivered', file: 'sea-king-throne-tinted.webp', edition: 'film' },
};
const requests = [];
const previousFetch = globalThis.fetch, previousImage = globalThis.Image;
globalThis.fetch = async (url) => {
  assert.equal(url, '/review-assets/manifest.json');
  return { json: async () => ({ slots, anims: {}, audio: {} }) };
};
globalThis.Image = class {
  set src(url) { requests.push(url); queueMicrotask(() => this.onload()); }
};
try {
  const assets = await loadAssets('/review-assets/', { first: ['prince-stand-tinted'] });
  await assets.ready;
  assert.ok(assets.images['prince-stand-tinted']);
  await assets.all;
  assert.deepEqual(requests.sort(), [
    '/review-assets/fairies-title.webp',
    '/review-assets/prince-stand.webp',
    '/review-assets/prince-stand-tinted.webp',
    '/review-assets/sea-king-throne.webp',
    '/review-assets/sea-king-throne-tinted.webp',
  ].sort(), 'original and tinted sprites both use the supplied asset base URL');
  assert.equal(assets.images['prince-stand-tinted'].fitBox, true);
  assert.deepEqual(assets.failed,[]);
  assert.equal(assets.images['sea-king-throne-tinted'].fitBox, undefined,
    'a tinted legacy sprite retains its original stretched fitting');
  globalThis.Image = class { set src(url) { queueMicrotask(() => url.endsWith('prince-stand.webp') ? this.onerror() : this.onload()); } };
  const failed = await loadAssets('/review-assets/'); await failed.all;
  assert.deepEqual(failed.failed,['prince-stand']);
  assert.equal(failed.images['prince-stand'],undefined,'failed artwork is reported instead of treated as loaded');
} finally {
  globalThis.fetch = previousFetch;
  globalThis.Image = previousImage;
}
console.log('Original/tinted asset URLs, opening load wave and sprite fitting pass');
