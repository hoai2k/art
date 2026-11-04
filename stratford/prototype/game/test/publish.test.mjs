// The published copy (stratford/publish.sh) must hold everything the game loads.
// The other tests run the game from game/, so a file left out of the publish
// copy (as the four new creatures' models once were) passes them and only
// breaks on the live site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISH = join(GAME, '..', '..', 'publish.sh');

test('publish.sh copies every creature model, the sounds, data and web art', () => {
  const out = mkdtempSync(join(tmpdir(), 'stratford-publish-'));
  try {
    execFileSync('sh', [PUBLISH, join(out, 'stratford')], { stdio: 'pipe' });
    const pub = join(out, 'stratford', 'prototype');
    // Every creature in the registry, and the model files it loads.
    const registry = readFileSync(join(GAME, 'src', 'creatures', 'index.js'), 'utf8');
    const kinds = [...registry.matchAll(/^\s*(\w+): \(\) => import\(/gm)].map((m) => m[1]);
    assert.ok(kinds.length >= 5, `registry lists the creatures (${kinds.join(', ')})`);
    for (const k of kinds) {
      for (const f of [`${k}.json`, `${k}.bin`]) {
        assert.ok(existsSync(join(GAME, 'assets', k, f)), `built model exists: assets/${k}/${f}`);
        assert.ok(existsSync(join(pub, 'assets', k, f)), `published: assets/${k}/${f}`);
      }
    }
    // Every file the manifest and the sound index point at.
    const manifest = JSON.parse(readFileSync(join(pub, 'assets', 'manifest.json'), 'utf8'));
    for (const w of Object.values(manifest.web || {})) assert.ok(existsSync(join(pub, w)), `published: ${w}`);
    const sfx = JSON.parse(readFileSync(join(pub, 'web', 'sfx', 'index.json'), 'utf8'));
    for (const [name, v] of Object.entries(sfx)) {
      if (name.startsWith('_') || !Array.isArray(v)) continue;
      for (const f of v) assert.ok(existsSync(join(pub, 'web', f)), `published: web/${f}`);
    }
    for (const f of ['index.html', 'data/town.json', 'data/terrain.bin', 'data/facades.json']) assert.ok(existsSync(join(pub, f)), `published: ${f}`);
    // Nothing that must stay private or unpublished.
    for (const f of ['assets/textures', 'assets/sfx', 'assets/kit']) assert.ok(!existsSync(join(pub, f)), `not published: ${f}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
