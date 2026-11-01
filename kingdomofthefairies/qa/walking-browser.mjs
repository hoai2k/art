import assert from 'node:assert/strict';
import { serve, playwright } from '../../shared/test/lib.mjs';
const server = await serve(new URL('../', import.meta.url).pathname);
const { chromium } = await playwright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [edition, look] of [['film', 'tinted'], ['film', 'original'], ['partial', 'original'], ['widowsbay', 'original']]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url + '/?qa&widowsbay=' + ({ film: 'off', partial: 'partial', widowsbay: 'on' }[edition]) + '&look=' + look);
    await page.waitForFunction(() => window.__kingdomOfTheFairies);
    const result = await page.evaluate(async ({ edition, look }) => {
      const { loadAssets, createRenderer } = await import('/src/art.js');
      const { ACTS } = await import('/src/acts/index.js');
      const { walkFrame } = await import('/src/walking.js');
      const assets = await loadAssets('/assets/'); await assets.all;
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      const renderer = createRenderer(canvas, assets);
      const labels = new Map(Object.entries(assets.images).map(([id, image]) => [image, id]));
      const actualPassing = new Set();
      const drawAsset = renderer.kit.asset;
      renderer.kit.asset = (id, ...args) => {
        const resolved = labels.get(renderer.kit.img(id));
        if (resolved?.includes('-pass-')) actualPassing.add(resolved.replace(/-tinted$/, ''));
        return drawAsset(id, ...args);
      };
      let scenes = 0;
      for (const act of ACTS) for (let scene = 0; scene < (act.scenes?.length || 1); scene++) {
        const state = act.create({ from: { scene }, carry: { guitar: true, pearl: true, rose: true, stone: true, sleepers: 8, tea: 3 } });
        state.beat = 8; state.phaseT = 8;
        renderer.render({ act, state, t: 8, curtain: 1, film: 'off', tinted: look === 'tinted', extraAnimations: true, hud: true });
        // Drive actual scene actors through the four phases, not just the
        // resolver: this catches an artist retaining a two-contact selector.
        for (let phase = 0; phase < 4; phase++) {
          for (const actor of [state.p, state.w, state.s, state.tp, state.f, state.az, state.cv?.s]) {
            if (!actor || typeof actor !== 'object' || !('walk' in actor || 'vx' in actor)) continue;
            actor.vx = 100; actor.moving = true; actor.frozen = false;
            actor.walk = phase * 19 + 1;
            if (actor === state.p && act.id === 3 && edition !== 'film') actor.walk = phase * 0.1 + 0.01;
          }
          if (state.p && 'carry' in state.p && state.p.f >= 0 && !state.p.conn) {
            state.p.x = 608 + phase * 19 + 1; state.p.carry = true;
          }
          renderer.render({ act, state, t: 8, curtain: 1, film: 'off', tinted: look === 'tinted', extraAnimations: true, hud: true });
        }
        scenes++;
      }
      const act = ACTS[0], state = act.create({ from: { scene: 0 } });
      renderer.render({ act, state, t: 8, curtain: 1, film: 'off', tinted: look === 'tinted', hud: true });
      const prefixes = edition === 'film' ? ['prince', 'prince-court', 'azurine', 'sailor', 'sailor-carry'] : ['sailor', 'sailor-carry'];
      const sailorStrides = !!(assets.images['sailor-stride-a'] && assets.images['sailor-stride-b']);
      const selections = [];
      for (const prefix of prefixes) for (let phase = 0; phase < 4; phase++) {
        const requested = walkFrame(prefix, phase * 19 + 1);
        let expected = requested;
        if (edition === 'film') {
          expected = expected.replace(/^sailor/, 'prince');
          if (/^prince(?:-court)?-walk-/.test(expected)) expected = expected.replace('-walk-', '-stride-');
          if (look === 'tinted') expected += '-tinted';
        } else if (prefix === 'sailor' && !sailorStrides) {
          // his passing frames carry the sack his first walk frames lack:
          // each stride holds through its passing beat until F14 arrives
          expected = expected.replace('-pass-', '-walk-');
        } else if (prefix === 'sailor') expected = expected.replace('-walk-', '-stride-');
        const image = renderer.kit.img(requested);
        selections.push({ requested, expected, ok: !!image && image === assets.images[expected] && image.naturalWidth > 0 });
      }
      // Carrying artwork inherits the calibrated carrying body scale.
      const carryScale = edition !== 'film' || ['walk-a', 'pass-a', 'walk-b', 'pass-b'].every(pose =>
        assets.images['prince-carry-' + pose + (look === 'tinted' ? '-tinted' : '')].bodyScale === assets.images['prince-carry' + (look === 'tinted' ? '-tinted' : '')].bodyScale);
      return { scenes, selections, carryScale, sailorStrides, actualPassing: [...actualPassing] };
    }, { edition, look });
    assert.ok(result.selections.every(selection => selection.ok), JSON.stringify(result.selections));
    assert.equal(result.carryScale, true);
    const required = edition === 'film' ? ['prince', 'prince-court', 'azurine', 'prince-carry'] : result.sailorStrides ? ['sailor', 'sailor-carry'] : ['sailor-carry'];
    for (const prefix of required) for (const phase of ['a', 'b']) assert.ok(result.actualPassing.includes(prefix + '-pass-' + phase),
      `${edition}/${look}: actual scenes must draw ${prefix}-pass-${phase}; saw ${result.actualPassing}`);
    assert.deepEqual(errors, []);
    console.log(`${edition}/${look}: ${result.selections.length} contact/passing selections, ${result.scenes} scenes, no page errors`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
