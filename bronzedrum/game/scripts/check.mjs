// Syntax-check every module and confirm the manifest matches the game's
// asset hooks. Run with `npm run check` (no dependencies needed).
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
// Every source file under src/, including subfolders (src/render/), as paths relative to src/.
const sourceFiles = readdirSync(join(root, 'src'), { recursive: true })
  .filter((f) => f.endsWith('.js') && !basename(f).startsWith('._')).sort();
for (const f of sourceFiles) {
  try {
    execFileSync(process.execPath, ['--check', join(root, 'src', f)], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error(`syntax error in src/${f}\n${e.stderr}`);
  }
}
const manifest = JSON.parse(readFileSync(join(root, 'assets', 'manifest.json'), 'utf8'));
// The game's own code: src/gate/ is the shared invite door, kept byte-identical
// to the other games' copies, so its strings are not game asset or sound ids.
const page = readFileSync(join(root, 'index.html'), 'utf8');
const source = sourceFiles.filter((f) => !f.startsWith('gate')).map((f) => readFileSync(join(root, 'src', f), 'utf8')).join('\n');
for (const a of manifest.assets.filter((x) => x.runtime !== false && (x.status === 'stand-in' || x.status === 'delivered' || x.status === 'regenerate'))) {
  // Ids are used literally or as `prefix-${...}` templates (sky-*, card-*).
  const prefix = a.id.split('-')[0];
  // The page itself may load one directly (the title logo, so it shows at once).
  if (!source.includes(`'${a.id}'`) && !source.includes(`\`${prefix}-\${`) && !(a.web && page.includes(`"assets/${a.web}"`))) {
    failed++;
    console.error(`manifest id ${a.id} is not used by the game`);
  }
}
// Every sound the audio manifest lists must exist, and every sample the code
// plays by name must be one build_audio.py defines (generated or not).
import { existsSync } from 'node:fs';
const audio = JSON.parse(readFileSync(join(root, 'assets', 'audio.json'), 'utf8'));
for (const [id, e] of Object.entries(audio.sfx)) {
  for (const f of e.files) {
    if (!existsSync(join(root, 'assets', f))) {
      failed++;
      console.error(`audio.json: ${id} lists missing ${f}`);
    }
  }
}
const defined = readFileSync(join(root, '..', 'design', 'source', 'build_audio.py'), 'utf8');
for (const m of source.matchAll(/(?:play|has|startAmbience|playMusic|musicOverlay)\('([a-z-]+)'/g)) {
  if (!defined.includes(`"${m[1]}"`)) {
    failed++;
    console.error(`code plays '${m[1]}', which build_audio.py does not define`);
  }
}
const stagesSrc = readFileSync(join(root, 'src', 'stages.js'), 'utf8');
const stageSounds = [
  ...[...stagesSrc.matchAll(/ambience: '([a-z-]+)'/g)].map((m) => m[1]),
  ...[...stagesSrc.matchAll(/music: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1])),
];
for (const m of stageSounds.map((id) => [null, id])) {
  if (!defined.includes(`"${m[1]}"`)) {
    failed++;
    console.error(`stage sound '${m[1]}' is not defined in build_audio.py`);
  }
}
// A canvas filter drawn every frame is ruinously slow (it once made each
// battle frame ten times slower) and Safari has none: make darker or tinted
// copies once instead (Renderer.shaded).
for (const f of ['render.js', 'rig.js', ...sourceFiles.filter((x) => x.startsWith('render/'))]) {
  const text = readFileSync(join(root, 'src', f), 'utf8');
  // Filters used once while building an offscreen layer are fine: they say so
  // on the line ('built once') or draw on the offscreen context `o`.
  text.split('\n').forEach((line, i) => {
    if (/\.filter\s*=/.test(line) && !/built once/.test(line) && !/^\s*o\.filter/.test(line)) {
      failed++;
      console.error(`src/${f}:${i + 1}: canvas filter in the renderer (make a shaded copy once instead)`);
    }
  });
}
// A class method overwritten by a property of the same name breaks every
// later call to it (this.shake = t once replaced the renderer's shake()).
// The Renderer's methods are spread over render.js and render/*.js, so those
// files share one method list.
const isRender = (f) => f === 'render.js' || f.startsWith('render/');
const methodsOf = (src) => [...src.matchAll(/^  (?:async )?([a-zA-Z_]\w*)\([^)]*\) \{$/gm)].map((m) => m[1]).filter((n) => n !== 'constructor');
const renderMethods = new Set(sourceFiles.filter(isRender).flatMap((f) => methodsOf(readFileSync(join(root, 'src', f), 'utf8'))));
for (const f of sourceFiles) {
  const src = readFileSync(join(root, 'src', f), 'utf8');
  const methods = isRender(f) ? renderMethods : new Set(methodsOf(src));
  for (const m of src.matchAll(/this\.(\w+) = /g)) {
    if (methods.has(m[1])) {
      failed++;
      console.error(`${f}: this.${m[1]} = … overwrites the method ${m[1]}()`);
    }
  }
}
console.log(failed ? `${failed} problem(s)` : 'check ok');
process.exit(failed ? 1 : 0);
