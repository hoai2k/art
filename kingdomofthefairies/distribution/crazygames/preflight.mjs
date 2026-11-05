// Repeatable static preflight; write evidence beside (not inside) the ZIP.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { themeManifest } from '../../src/theme.js';
const root = fileURLToPath(new URL('../../dist/crazygames/', import.meta.url));
const list = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).filter(e => !e.name.startsWith('._') && e.name !== '.DS_Store').map(e => e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
const files = await list(root), names = new Set(files.map(f => path.relative(root, f)));
const checks = [];
function check(name, fn) { fn(); checks.push({ name, status: 'passed' }); }
const info = JSON.parse(await fs.readFile(root + 'release-info.json'));
check('250 MB / 1500 files', () => { assert.ok(info.bytes < 250e6); assert.ok(names.size <= 1500); });
check('50 MB conservative initial budget', () => assert.ok(info.conservativeInitialBytes < 50e6));
const manifest = JSON.parse(await fs.readFile(root + 'assets/manifest.json'));
const sourceManifest = themeManifest(JSON.parse(await fs.readFile(new URL('../../assets/manifest.json', import.meta.url))), 'film');
check('Complete film/shared manifest retained, independently of sampled act lists', () => {
  for (const [id, slot] of Object.entries(sourceManifest.slots)) {
    if (id === 'playbill') continue; // The other edition's title; film uses playbill-film.
    assert.ok(manifest.slots[id], `Asset was culled: ${id}`);
    const tinted = sourceManifest.slots[id + '-tinted'];
    assert.equal(manifest.slots[id].file, tinted?.status === 'delivered' ? tinted.file : slot.file, `Unexpected asset mapping: ${id}`);
  }
});
check('Manifest asset paths exist with exact case', () => {
  for (const slot of [...Object.values(manifest.slots), ...Object.values(manifest.anims || {}), ...Object.values(manifest.sfx || {}), ...Object.values(manifest.audio.period)]) {
    if (slot.status !== 'delivered') continue;
    for (const key of ['file', 'meta']) if (slot[key]) assert.ok(names.has('assets/' + slot[key]), slot[key]);
  }
});
check('No legacy song/band/workbench assets', () => { assert.equal(manifest.audio.song, undefined); assert.ok(![...names].some(n => /(?:widowsbay|band-trio|workbench)/.test(n))); });
const html = await fs.readFile(root + 'index.html', 'utf8');
check('HTML entry, SDK v3, no custom analytics or external promotion', () => {
  assert.ok(html.includes('crazygames-sdk-v3.js'));
  assert.ok(html.includes('src/bootstrap.js'));
  assert.ok(!html.includes('goatcounter'));
  assert.ok(!/<a\b[^>]*href=["']https?:/i.test(html));
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (/^https?:/.test(ref)) continue;
    assert.ok(!ref.startsWith('/'), ref);
    assert.ok(names.has(ref), ref);
  }
});
for (const file of files.filter(f => f.endsWith('.js'))) {
  const text = await fs.readFile(file, 'utf8');
  for (const [, ref] of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    if (!ref.startsWith('.')) continue;
    const target = path.relative(root, path.resolve(path.dirname(file), ref));
    assert.ok(names.has(target), `Missing module ${target}`);
  }
}
checks.push({ name: 'Relative ES module imports resolve with exact case', status: 'passed' });
const report = {
  checks,
  manualOrPortalChecks: [
    'CrazyGames preview QA: actual iframe, CDN initial-byte measurement, SDK mute and fullscreen',
    'Real CrazyGames guest/account cloud-save persistence and cross-device restore; enable Data module in portal',
    'Chrome and Edge; real Safari/iOS interruption recovery; low-memory Chromebook performance',
    'Human review of text readability and game clarity at all required iframe sizes',
    'Real controllers and device safe areas in the Android/iOS CrazyGames App',
    'Physical 144/165 Hz displays and end-to-end complete playthrough',
    'All required covers/previews, accurate metadata, content suitability and distribution rights',
    'Editorial originality/quality review and Basic Launch engagement evaluation',
    'Ads callback integration and ads-disabled/blocked recovery if monetization is added'
  ],
  sources: ['https://docs.crazygames.com/requirements/technical/', 'https://docs.crazygames.com/requirements/gameplay/', 'https://docs.crazygames.com/requirements/game-covers/', 'https://docs.crazygames.com/resources/basic-launch-metrics/'],
  limits: 'Local checks are evidence, not a certification or guarantee of CrazyGames acceptance.'
};
await fs.writeFile(root + '../crazygames-preflight.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${checks.length} static preflight checks passed; report: ${root}../crazygames-preflight.json`);
