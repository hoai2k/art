// Records which images each act draws, per edition and cast look, into
// src/act-art.js, so the shell loads (and waits for) only the art of the act
// being played, ahead of the rest (src/main.js, out.want in src/art.js).
//
// Every scene of every act is created and played for a while with varied
// input (walking both ways, leaping, the second button, up and down), plus
// a separate idle run. Render before the first step and every few frames:
// standing/reference poses must be present even without background loading.
// Also include every named asset in each act's local module graph. Timed
// passers and late endings must not depend on a simulation reaching them.
//
//   node kingdomofthefairies/qa/build-act-art.mjs           write src/act-art.js
//   node kingdomofthefairies/qa/build-act-art.mjs --check   fail if it is out of date
// (CHROMIUM_PATH as for the browser checks)
import { readFile, writeFile } from 'node:fs/promises';
import { serve, playwright } from '../../shared/test/lib.mjs';
import { ACT_MODULES, collectActDependencies } from './lib/collect-art-dependencies.mjs';

const OUT = new URL('../src/act-art.js', import.meta.url);
const check = process.argv.includes('--check');
const namedArt = Object.fromEntries(await Promise.all(Object.keys(ACT_MODULES).map(async key => [key, await collectActDependencies(key)])));
const server = await serve(new URL('../', import.meta.url).pathname), { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const result = {};
try {
  for (const [edition, query, looks] of [['film', '', [true, false]], ['widowsbay', '&widowsbay=on', [false]]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '/?qa' + query);
    await page.waitForFunction(() => window.__kingdomOfTheFairies?.assets?.all && !document.body.classList.contains('booting'));
    await page.evaluate(() => window.__kingdomOfTheFairies.assets.all);
    result[edition] = await page.evaluate(async ({ looks, namedArt }) => {
      const { createRenderer } = await import('/src/art.js'), { ACTS } = await import('/src/acts/index.js');
      const { FILM, FILM_CAST } = await import('/src/theme.js');
      const { expandAssetDependencies } = await import('/qa/lib/art-dependencies.mjs');
      const assets = window.__kingdomOfTheFairies.assets, images = assets.images, used = new Set();
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const view = { ...assets, images: new Proxy(images, { get: (t, id) => { if (typeof id === 'string' && t[id]) used.add(id); return t[id]; } }) };
      const out = {};
      for (const act of ACTS) {
        const byLook = {};
        for (const tinted of looks) {
          used.clear();
          const renderer = createRenderer(canvas, view);
          const draw = frame => {
            if (renderer.render(frame) === false) throw new Error('Unresolved artwork while recording ' + (act.key || act.id) + ': ' + JSON.stringify(assets.recovery?.()));
          };
          for (let scene = 0; scene < (act.scenes?.length || 1); scene++) for (const mode of ['idle', 'active', 'stop-start']) {
            const st = act.create({ seed: 7, carry: { tea: 3, guitar: true, rose: false, pearl: true, stone: true, sleepers: 6, pearls: 20 }, from: scene ? { scene, introDone: true } : null });
            draw({ act, state: st, t: 0, curtain: 1, film: 'off', tinted, hud: true });
            // The prologue's staged Aurora delivery can take longer than
            // twenty seconds before the prince receives his armour.
            for (let f = 0; f < (act.key === 'prologue' ? 3600 : 1200) && st.status === 'play'; f++) {
              const tt = f / 60, dir = Math.floor(tt / 3) % 3 === 2 ? -1 : 1;
              const input = { moveX: dir, moveY: Math.floor(tt / 2) % 2 ? -1 : 1, up: f % 50 === 0, down: f % 77 === 0,
                a: f % 30 === 0, aHeld: f % 30 < 12, x: f % 41 === 0, xHeld: f % 90 < 20, beat: tt / 0.784 };
              const stopped = mode === 'idle' || (mode === 'stop-start' && f % 300 >= 180);
              act.step(st, 1 / 60, stopped ? { beat: input.beat } : input);
              for (const e of st.events || []) renderer.onEvent(e, { act, state: st });
              if (st.events) st.events.length = 0;
              if (f % 12 === 0) draw({ act, state: st, t: tt, curtain: 1, film: 'off', tinted, hud: true });
            }
          }
          // Shore arrivals are a timed ending, not guaranteed to be reached
          // by a short traversal through the whale. Sample every survivor's
          // crawl and standing pose before publishing its preload list.
          if (act.key === 'whale') {
            const { MAX_REVELLERS, shoreTimes } = await import('/src/acts/act4.js');
            const st = act.create({ carry: { sleepers: MAX_REVELLERS } });
            st.phase = 'shore';
            const T = shoreTimes(MAX_REVELLERS);
            const times = [T.crawl + .1, T.crawl + 1.6, T.crawl + 2.1, T.tail + 1];
            for (let i = 0; i < MAX_REVELLERS; i++) times.push(T.out + i * T.gap + .1, T.out + i * T.gap + 1.5);
            for (const t of times) { st.phaseT = t; draw({ act, state: st, t, curtain: 1, film: 'off', tinted, hud: true }); }
          }
          const names = namedArt[act.key || String(act.id)];
          if (!names) throw new Error('Missing asset source module for ' + act.key);
          const dependencies = expandAssetDependencies(names, { slots: assets.slots, cast: FILM ? { ...FILM_CAST, ...act.cast } : {}, tinted });
          for (const id of dependencies) {
            if (!images[id]) throw new Error('Undelivered dependency for ' + act.key + ': ' + id);
            used.add(id);
          }
          byLook[tinted ? 'tinted' : 'original'] = [...used].sort();
        }
        out[act.key || String(act.id)] = byLook;
      }
      return out;
    }, { looks, namedArt });
    if (errors.length) throw new Error(edition + ': ' + errors.join('; '));
    await page.close();
  }
} finally { await browser.close(); server.close(); }

const body = `// Generated by qa/build-act-art.mjs: the images each act draws, per edition
// and cast look (the shell loads an act's ahead of the rest, and waits for
// them before it starts). Rerun it after adding art or changing what a scene
// draws; --check verifies it.
export const ACT_ART = ${JSON.stringify(result, null, 1)};
`;
if (check) {
  const now = await readFile(OUT, 'utf8').catch(() => '');
  if (now !== body) { console.error('src/act-art.js is out of date: rerun qa/build-act-art.mjs'); process.exit(1); }
  console.log('Act art lists up to date');
} else {
  await writeFile(OUT, body);
  for (const [ed, acts] of Object.entries(result)) console.log(ed, Object.entries(acts).map(([k, v]) => `${k}:${Object.entries(v).map(([l, ids]) => l[0] + ids.length).join('/')}`).join(' '));
}
