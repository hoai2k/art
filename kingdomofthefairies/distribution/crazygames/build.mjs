// Adapt copies, never the website source. Checked replacements deliberately
// fail if upstream code changes, rather than quietly producing a broken build.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ACT_ART } from '../../src/act-art.js';
import { validateActArt } from '../../qa/lib/validate-act-art.mjs';
import { themeManifest, RETIRED_IDLE } from '../../src/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
// Refuse to publish a stale preload list: recovery screens are for failures,
// never for image dependencies omitted during development. This also runs
// in normal website publication, which builds its preview alongside it.
await validateActArt(ACT_ART, JSON.parse(await fs.readFile(path.join(root, 'assets/manifest.json'), 'utf8')));
const args = process.argv.slice(2);
const preview = args.includes('--preview');
const outputArg = args.indexOf('--out');
if (outputArg !== -1 && !args[outputArg + 1]) throw new Error('--out requires a directory');
const out = outputArg === -1 ? path.join(root, preview ? 'dist/crazygames-preview' : 'dist/crazygames') : path.resolve(args[outputArg + 1]);
// Never allow an output path to remove source directories or the checkout.
if (out === root || root.startsWith(out + path.sep) || ['src', 'assets', 'design', 'distribution'].some(d => out === path.join(root, d) || out.startsWith(path.join(root, d) + path.sep))) throw new Error('Unsafe distribution output directory');
await fs.mkdir(path.dirname(out), { recursive: true });
const stage = await fs.mkdtemp(path.join(path.dirname(out), '.crazygames-'));
const read = (name) => fs.readFile(path.join(root, name), 'utf8');
const write = async (name, text) => { await fs.mkdir(path.dirname(path.join(stage, name)), { recursive: true }); await fs.writeFile(path.join(stage, name), text); };
function replace(text, before, after, label) {
  if (text.split(before).length !== 2) throw new Error(`CrazyGames adaptation needs updating: ${label}`);
  return text.replace(before, after);
}
async function copyTree(source, target) {
  await fs.mkdir(target, { recursive: true });
  for (const item of await fs.readdir(source, { withFileTypes: true })) {
    if (item.name.startsWith('._') || item.name === '.DS_Store') continue;
    const a = path.join(source, item.name), b = path.join(target, item.name);
    if (item.isDirectory()) await copyTree(a, b);
    else if (item.isFile()) await fs.copyFile(a, b);
  }
}
try {
  await copyTree(path.join(root, 'src'), path.join(stage, 'src'));
  await write('styles.css', await read('styles.css') + '\n/* CrazyGames owns mute, fullscreen and orientation. */\n#btn-sound, [data-key="sound"], #btn-fullscreen, [data-key="castLook"], #bars-hint { display: none !important; }\nbody { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }\n' + (preview ? '\n#preview-controls { position: fixed; z-index: 30; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); display: flex; gap: 6px; align-items: center; font: 12px system-ui; background: #230b16df; color: #fff0c7; padding: 5px 8px; border-radius: 8px; }\n#preview-controls button { font: inherit; padding: 4px 8px; min-height: 28px; }\n' : ''));
  let html = await read('index.html');
  // Installation metadata is for the standalone website, not a portal iframe.
  html = html.replace(/^.*<link rel="(?:manifest|icon|apple-touch-icon)"[^\n]*\n/gm, '');
  html = replace(html, 'name="kotf-widowsbay" content="on"', 'name="kotf-widowsbay" content="off"', 'film edition metadata');
  html = replace(html, '<script type="module" src="src/main.js"></script>', (preview ? '' : '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  ') + '<script type="module" src="src/bootstrap.js"></script>', 'SDK entry point');
  if (preview) html = html.replace('<title>Kingdom of the Fairies</title>', '<title>Kingdom of the Fairies · CrazyGames preview</title>');
  // Keep custom analytics out of this distribution; SDK lifecycle is separate.
  html = html.replace(/  <!-- Visit counting[^\n]*\n  <script>window.goatcounter[^\n]*\n  <script data-goatcounter[^\n]*\n/, '');
  if (html.includes('goatcounter')) throw new Error('Unrecognized analytics markup');
  await write('index.html', html);
  for (const name of ['platform.js', 'bootstrap.js']) await write('src/' + name, await fs.readFile(path.join(here, name), 'utf8'));
  if (preview) await write('src/platform.js', await fs.readFile(path.join(here, 'preview-platform.js'), 'utf8'));

  let theme = await read('src/theme.js');
  theme = replace(theme, "export const EDITION = env ? (env === 'widowsbay' ? 'widowsbay' : 'film') : editionOf(query);", "export const EDITION = 'film';", 'edition lock');
  theme = replace(theme, "export const LOOK_PARAM = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('look') : null;", "export const LOOK_PARAM = 'tinted';", 'colorized lock');
  await write('src/theme.js', theme);

  // Keep original slot metadata for fitting, but map every available original
  // to its tinted file. No untinted alternative is shipped for those sprites.
  const manifest = themeManifest(JSON.parse(await read('assets/manifest.json')), 'film');
  const shell = ['logo', 'playbill-film', 'rotate-card', 'touch-stick-base', 'touch-stick-knob', 'touch-button', 'touch-pause', 'proscenium', 'curtain-panel', 'footlight', 'sky-backdrop', 'moon-face', 'cloud', 'waves-back', 'waves-mid', 'waves-front'];
  // ACT_ART schedules downloads; sampled playthroughs cannot prove that an
  // unobserved sprite is unused. Retain the full film/shared manifest, with
  // only the established retired frames and the other edition's playbill out.
  // themeManifest already excludes the legacy band and song.
  manifest.slots = Object.fromEntries(Object.entries(manifest.slots).filter(([id]) => id !== 'playbill' && !RETIRED_IDLE.test(id)));
  for (const [id, slot] of Object.entries(manifest.slots)) {
    const tinted = manifest.slots[id + '-tinted'];
    if (tinted?.status === 'delivered') slot.file = tinted.file;
  }
  const files = new Set();
  for (const slot of [...Object.values(manifest.slots), ...Object.values(manifest.anims || {}), ...Object.values(manifest.sfx || {}), ...Object.values(manifest.audio.period || {})]) {
    if (slot.status === 'delivered') for (const key of ['file', 'meta']) if (slot[key]) files.add(slot[key]);
  }
  for (const file of files) {
    if (path.isAbsolute(file) || file.split('/').includes('..')) throw new Error(`Unsafe asset path ${file}`);
    await fs.mkdir(path.dirname(path.join(stage, 'assets', file)), { recursive: true });
    await fs.copyFile(path.join(root, 'assets', file), path.join(stage, 'assets', file));
  }
  await write('assets/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  let main = await read('src/main.js');
  main = "import { platform } from './platform.js';\n" + main;
  main = replace(main, 'const audio = createAudio();', `const audio = createAudio();
// Start visually without a title gate. Browsers may require the first real
// gesture before permitting sound; unlock it without blocking the game.
for (const event of ['pointerdown', 'keydown', 'touchend', 'click']) {
  addEventListener(event, () => {
    if (document.querySelector('#asset-loading')?.hidden === false) return;
    audio.unlock(); audio.startMusic();
  }, { capture: true });
}`, 'gesture audio unlock');
  main = replace(main, "if (settings.cast !== 'original') settings.cast = 'tinted';", "settings.cast = 'tinted';", 'saved look lock');
  main = replace(main, "if (k === 'castLook') settings.cast = settings.cast === 'tinted' ? 'original' : 'tinted';", "if (k === 'castLook') settings.cast = 'tinted';", 'look toggle lock');
  // Ignore old local mute preferences: their controls are hidden here, so
  // only the platform may mute/unmute. Keep music/effects mix preferences.
  main = replace(main, 'audio.setSound(settings.sound !== false);', 'audio.setSound(!platform.muted);', 'platform-owned mute');
  main = replace(main, 'syncSettingsUI();\n\n// ---------------------------------------------------------------- state', 'syncSettingsUI();\nplatform.onSoundChange(syncSettingsUI);\n\n// ---------------------------------------------------------------- state', 'mute settings listener');
  main = replace(main, 'assets.want(actArt(i)).then(() => { if (wantedAct === key && i + 1 < ACTS.length) assets.want(actArt(i + 1)); });', "assets.want(actArt(i));\n  if (ACTS[i]?.id === 2) assets.wantAnimations?.();", 'remove next-act prefetch');
  main = replace(main, "loadAssets('assets/', { first: FIRST_ART,", `loadAssets('assets/', { first: ${JSON.stringify(shell)},`, 'opening assets');
  main = replace(main, 'if (editorWanted()) {', 'if (false) {', 'disable unlock editor');
  // Open directly on the first act card; cards advance automatically once
  // required scene art is ready. The story itself stays playable.
  main = replace(main, 'S.skipIntertitle = !!from?.retry;', 'S.skipIntertitle = true;', 'one-click onboarding');
  main = replace(main, "const wants = (go && S.readyT > 0.4) || S.readyT > (S.card.body ? 12 : 6) || S.card.waiting;", 'const wants = (go && S.readyT > 0.4) || S.readyT > 1.5 || S.card.waiting;', 'automatic act cards');
  main = replace(main, '    booted = true;', "    booted = true;\n    startGame();\n    $('#title').hidden = true;", 'start at opening act introduction');
  main = replace(main, "if (TOUCH) screen.orientation?.lock?.('landscape').catch(() => { /* not allowed here; the rotate card covers it */ });", '// CrazyGames handles landscape orientation.', 'platform orientation');
  main = replace(main, '  update(dt, i);', `  update(dt, i);
  platform.sync({
    active: S.mode === 'play' && !S.paused && !dialogs.length && S.curtain > 0.9 && touchLive(),
    waiting: S.mode === 'intro' && (!songSettled() || !actArtReady(S.actIndex)),
  });`, 'SDK lifecycle');
  await write('src/main.js', main);
  await write('src/chrome.js', `// CrazyGames owns fullscreen, orientation and browser chrome.
export const fullscreenElement = () => null;
export const canFullscreen = () => false;
export function requestFullscreen() {}
export function exitFullscreen() {}
export function createChrome() { return { update() {}, scrollTrick: false, isIOS: false, standalone: true }; }
`);
  let save = await read('src/save.js');
  save = "import { platform } from './platform.js';\n" + save.replaceAll('localStorage.', 'platform.storage.');
  await write('src/save.js', save);

  let art = await read('src/art.js');
  // Cast resolution and walking pairs check base IDs before selecting tint.
  // Alias the decoded tinted image under its base ID without another fetch.
  art = replace(art, 'out.images[id] = img; onImage?.(id, img); settle(id);', "out.images[id] = img; if (id.endsWith('-tinted')) out.images[id.slice(0, -7)] = img; onImage?.(id, img); settle(id);", 'decoded colorized aliases');
  art = replace(art, '  const restDone = load(rest);\n  out.all = Promise.all([out.ready, restDone, out.ready.then(loadAnimations)]);', `  // Only explicitly requested scene images load. The optional jellyfish
  // animation belongs to the grotto, not the initial download.
  let animationsRequested = false;
  out.wantAnimations = () => {
    if (!animationsRequested) {
      animationsRequested = true;
      void loadAnimations();
    }
  };
  out.all = Promise.all(Object.keys(out.slots).map(whenSettled));`, 'defer other acts and animation');
  await write('src/art.js', art);
  let audio = await read('src/audio.js');
  audio = replace(audio, "if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }", "if (ac) { if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume().catch(() => {}); return true; }", 'iOS audio interruption recovery');
  audio = replace(audio, "const p = periods.find((q) => q.state === 'idle' && fits(q, mood)) || periods.find((q) => q.state === 'idle');", "const p = periods.find((q) => q.state === 'idle' && fits(q, mood));", 'defer unrelated score');
  audio = replace(audio, '      mood = m;\n      if (!ac', '      mood = m;\n      loadPeriods();\n      if (!ac', 'load score on mood changes');
  await write('src/audio.js', audio);

  const list = async (dir) => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).filter(e => !e.name.startsWith('._') && e.name !== '.DS_Store').map(async e => e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
  const shipped = await list(stage);
  const sizes = await Promise.all(shipped.map(async file => ({ file: path.relative(stage, file), bytes: (await fs.stat(file)).size })));
  const total = sizes.reduce((n, f) => n + f.bytes, 0);
  if (sizes.length > 1500 || total > 250e6 || sizes.some(f => f.file.startsWith('._'))) throw new Error('CrazyGames bundle limits exceeded');
  // Conservative startup bound: shell + whole prologue + every SFX and score
  // track (the runtime actually defers unrelated score tracks).
  const initialIds = new Set([...shell, ...ACT_ART.film.prologue.tinted]);
  const initialFiles = new Set([...initialIds].map(id => manifest.slots[id]?.file).filter(Boolean));
  for (const slot of [...Object.values(manifest.sfx || {}), ...Object.values(manifest.audio.period || {})]) if (slot.file) initialFiles.add(slot.file);
  const startupBound = sizes.filter(f => !f.file.startsWith('assets/') || initialFiles.has(f.file.slice(7))).reduce((n, f) => n + f.bytes, 0);
  if (startupBound > 50e6) throw new Error('Conservative initial download exceeds 50 MB');
  await write('release-info.json', JSON.stringify({ edition: 'film', look: 'tinted', target: preview ? 'web-preview' : 'crazygames', sdk: preview ? null : 3, files: sizes.length + 1, bytes: total, conservativeInitialBytes: startupBound, progressSave: preview ? 'Isolated browser-local preview storage' : 'SDK Data module', sources: 'Current working tree; no source files modified by builder' }, null, 2) + '\n');
  await fs.rm(out, { recursive: true, force: true });
  await fs.rename(stage, out);
  // Python's ZIP writer avoids Finder metadata and keeps index.html at root.
  if (!preview) execFileSync('python3', ['-c', 'import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(str(p)+".zip","w",zipfile.ZIP_DEFLATED) as z:\n for f in sorted(p.rglob("*")):\n  if f.is_file() and not f.name.startswith("._") and f.name != ".DS_Store": z.write(f,f.relative_to(p))', out]);
  console.log(`${preview ? 'CrazyGames web preview' : 'CrazyGames'}: ${out}${preview ? '/' : '.zip'}\n${sizes.length + 1} files, ${(total / 1e6).toFixed(1)} MB; conservative initial bound ${(startupBound / 1e6).toFixed(1)} MB`);
} finally { await fs.rm(stage, { recursive: true, force: true }); }
