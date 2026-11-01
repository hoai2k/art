import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import create, { BEAK_PX, TALL_BEAK, BOWL_HALF } from '../src/games/buttonbeaks.js';
import entry from '../src/more/buttonbeaks.js';
import { run, env, blank } from './harness.mjs';

const pass = entry.pass;

// A tailor: takes the coat furthest along the line that still has an open
// hole it can reach, fetches that button (the tall bird's beak over its
// bowl) and tosses it up under the coat; a button nobody wants it lets go
// with B.
// `skill` 0..1 sets its speed, how long it looks, and how often it picks up
// a look-alike by mistake (below 0, slower and sloppier still).
function tailor(skill = 1, seed = 1) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let plan = null; // { coat, hole, bowl }
  let thinkUntil = 0;
  let pressed = false;
  const speed = 0.45 + 0.55 * skill;
  return (game, t) => {
    if (pressed) {
      pressed = false;
      return {};
    }
    if (game.daze > 0 || t < thinkUntil) return {};
    const reachable = (coat) => coat.x - 60 > 140 + (Math.abs(coat.x - game.x) + 600) * 0.12;
    if (game.holding === null) {
      if (!plan || plan.hole.sewn || !game.coats.includes(plan.coat) || !reachable(plan.coat)) {
        const coats = game.coats.filter((c) => c.x < 1500 && reachable(c) && c.holes.some((h) => !h.sewn)).sort((a, b) => a.x - b.x);
        const coat = coats[0];
        if (!coat) return { x: (800 - game.x) / 300 };
        const hole = coat.holes.find((h) => !h.sewn);
        let bowl = hole.kind;
        if (rnd() > 0.88 + 0.12 * skill) bowl = (bowl + 4) % game.bowls === bowl ? (bowl + 1) % game.bowls : (bowl + 4) % game.bowls;
        if (bowl >= game.bowls) bowl = hole.kind;
        plan = { coat, hole, bowl };
        thinkUntil = t + (1 - skill) * 0.9 + 0.25;
        return {};
      }
      const d = game.pickX(plan.bowl) - game.x;
      if (Math.abs(d) < 30) {
        pressed = true;
        return { action: true };
      }
      return { x: Math.max(-1, Math.min(1, d / 50)) * speed };
    }
    // holding: find a coat that wants this button
    const coats = game.coats.filter((c) => c.x > 160 && c.x < 1520 && c.holes.some((h) => !h.sewn && h.kind === game.holding)).sort((a, b) => a.x - b.x);
    const coat = coats[0];
    if (!coat) {
      // nobody wants it: let go of it with B
      plan = null;
      return { bPressed: true };
    }
    const d = coat.x - 40 - game.x;
    if (Math.abs(d) < 40) {
      pressed = true;
      plan = null;
      return { action: true };
    }
    return { x: Math.max(-1, Math.min(1, d / 50)) * speed };
  };
}

// Walking up and down pressing all the time.
const masher = () => {
  let d = 1;
  return (game, t) => {
    if (game.x > 1300) d = -1;
    if (game.x < 300) d = 1;
    return { x: d * 0.7, action: Math.floor(t * 4) % 2 === 0 };
  };
};

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: () => masher(),
  clumsy: (seed) => tailor(-0.15, seed), // slower to walk and to look, picks look-alikes more
  medium: (seed) => tailor(0.3, seed), // the old beginner
  good: (seed) => tailor(1, seed),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`buttonbeaks pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('buttonbeaks: at Normal a medium tailor passes, a good one more; mashing and idling do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) * 1.15, `good ${t.good}`);
  assert.ok(passRate(t.clumsy) < 0.5, `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('buttonbeaks: Easier lets a clumsy tailor pass; mashing and idling still do not', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.75, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.clumsy) > passRate(TABLE.normal.clumsy), `clumsy at Normal ${TABLE.normal.clumsy}`);
  for (const n of ['idle', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('buttonbeaks: Harder ends hard: the good tailor scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) * 1.5, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.clumsy) < mean(TABLE.normal.clumsy), `clumsy ${mean(t.clumsy)} vs Normal ${mean(TABLE.normal.clumsy)}`);
});

// The round starts gentle and ends harder, read from the coats the line
// actually brings: early coats have fewer holes, come slower and use fewer
// kinds of button than late ones. Third by third from its own knobs, the
// first third stays gentle.
test('buttonbeaks: the line starts gentle and ends harder', () => {
  const game = create(env(3));
  const seen = new Set(game.coats);
  const early = [];
  const late = [];
  const knobs = () => ({ speed: game.lineSpeed(), gap: game.coatGap(), holes: game.holesMean() });
  const looks = [knobs()];
  const bowls0 = game.bowls;
  for (let i = 0; i < 45 * 60 && !game.done; i++) {
    game.update(1 / 60, blank());
    if (i === 15 * 60 || i === 30 * 60 || i === 45 * 60 - 1) looks.push(knobs());
    for (const c of game.coats) {
      if (seen.has(c)) continue;
      seen.add(c);
      (game.elapsed < 15 ? early : game.elapsed > 30 ? late : []).push(c);
    }
  }
  const holes = (a) => a.reduce((s, c) => s + c.holes.length, 0) / a.length;
  const kinds = (a) => Math.max(...a.flatMap((c) => c.holes.map((h) => h.kind))) + 1;
  console.log('buttonbeaks ramp', { early: [early.length, holes(early), kinds(early)], late: [late.length, holes(late), kinds(late)], looks, bowls: [bowls0, game.bowls] });
  assert.ok(holes(early) < 1.3 && holes(late) >= 1.5, 'one hole a coat at first, two or three by the end');
  assert.ok(kinds(early) <= 4 && kinds(late) > 4, 'look-alike buttons only later');
  assert.ok(looks[3].speed > looks[0].speed * 1.6, 'the line speeds up');
  assert.ok(late.length > early.length, 'coats come thicker');
  for (let i = 1; i < looks.length; i++) {
    const [x, y] = [looks[i - 1], looks[i]];
    assert.ok(x.speed < y.speed && x.gap > y.gap && x.holes < y.holes, `third ${i} is harder than the one before`);
  }
  assert.ok(looks[1].speed - looks[0].speed < (looks[3].speed - looks[0].speed) / 3, 'the first third stays on the gentle side');
  // Easier never brings the look-alikes; Harder has them from the start.
  assert.equal(create(env(1, { difficulty: 'harder' })).bowls, 6);
  const easy = create(env(1, { difficulty: 'easier' }));
  for (let i = 0; i < 45 * 60 && !easy.done; i++) easy.update(1 / 60, blank());
  assert.equal(easy.bowls, 4);
});

test('buttonbeaks: the matching button sews into its hole', () => {
  const game = create(env(1));
  const coat = game.coats[0];
  const hole = coat.holes[0];
  game.x = game.pickX(hole.kind);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.holding, hole.kind);
  game.x = coat.x;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.holding, null);
  for (let i = 0; i < 30; i++) game.update(1 / 60, blank());
  assert.ok(hole.sewn);
  assert.equal(game.score, 1);
});

test('buttonbeaks: a button that matches nothing bounces off and dazes them', () => {
  const game = create(env(1));
  const coat = game.coats[0];
  const kind = [0, 1, 2, 3].find((k) => !coat.holes.some((h) => h.kind === k));
  game.x = game.pickX(kind);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  game.x = coat.x;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 20; i++) game.update(1 / 60, blank());
  assert.equal(game.score, 0);
  assert.equal(game.wrong, 1);
  assert.ok(game.daze > 0);
  assert.ok(coat.holes.every((h) => !h.sewn));
});

test('buttonbeaks: more bowls, and coats with more holes, later on', () => {
  const game = create(env(2));
  assert.equal(game.bowls, 4);
  for (let i = 0; i < 60 * 40; i++) game.update(1 / 60, blank());
  assert.equal(game.bowls, 6);
  // three holes on a coat by the end at Harder
  const hard = create(env(2, { difficulty: 'harder' }));
  let most = 0;
  for (let i = 0; i < 60 * 45 && !hard.done; i++) {
    hard.update(1 / 60, blank());
    for (const c of hard.coats) most = Math.max(most, c.holes.length);
  }
  assert.equal(most, 3);
});

// The pair are one size whatever they do: standing (their portrait), holding
// a button up, tossing it, striding, pecking, dazed and cheering, measured
// against how big each picture is painted (design/source/pose-scales.json).
test('buttonbeaks: every painted pose shows the pair the same size', async () => {
  const { withArt, shownSizes, sizeCheck } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    const at = (o) => (gm) => Object.assign(gm, { tossT: 0, pickT: 0, daze: 0, cheerT: 0, holding: null, moving: false }, o);
    const sizes = shownSizes(game, 'buttonbeaks', {
      standing: at({}),
      holding: at({ holding: 0 }),
      tossing: at({ tossT: 0.2 }),
      striding: at({ moving: true }),
      pecking: at({ pickT: 0.2 }),
      dazed: at({ daze: 0.5 }),
      cheering: at({ cheerT: 0.4 }),
    }, ['subject.buttonbeaks', 'sprites.buttonbeaksToss', 'sprites.buttonbeaksPoses']);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('buttonbeaks pose sizes', table);
    assert.equal(Object.keys(table).length, 7, 'each pose drew one picture');
    assert.deepEqual(fails, []);
  } finally {
    undo();
  }
});

// ---------- B, and the tall bird's beak ----------

test('buttonbeaks: B lets go of the held button, with no daze and nothing counted', () => {
  const game = create(env(1));
  game.x = game.pickX(2);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.holding, 2);
  game.update(1 / 60, blank({ bPressed: true }));
  assert.equal(game.holding, null);
  assert.equal(game.dropped, 1);
  assert.equal(game.wrong, 0);
  assert.equal(game.daze, 0);
  assert.equal(game.flying.length, 1, 'it falls');
  for (let i = 0; i < 90; i++) game.update(1 / 60, blank());
  assert.equal(game.flying.length, 0, 'and is gone');
  assert.equal(game.score, 0);
  assert.ok(game.coats.every((c) => c.holes.every((h) => !h.sewn)), 'nothing sewn');
  // B with empty beaks does nothing; A still picks up after
  game.update(1 / 60, blank({ bPressed: true }));
  assert.equal(game.dropped, 1);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.equal(game.holding, 2);
});

// An 8-bit RGBA PNG's alpha (non-interlaced), as the browser has it.
function pngAlpha(file) {
  const b = readFileSync(new URL(file, new URL('..', import.meta.url)));
  const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
  assert.ok(b[24] === 8 && b[25] === 6 && b[28] === 0, `${file} is 8-bit RGBA`);
  const idat = [];
  for (let o = 8; o < b.length; o += 12 + b.readUInt32BE(o)) if (b.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + b.readUInt32BE(o)));
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  let prev = Buffer.alloc(stride);
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0;
      const up = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c;
        const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - up), Math.abs(p - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) alpha[y * w + x] = cur[x * 4 + 3];
    prev = cur;
  }
  return { w, h, alpha };
}
// The leftmost opaque pixel in a box of the picture (x0..x1, y0..y1), the
// topmost of those.
function leftmost({ w, alpha }, x0, y0, x1, y1) {
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (alpha[y * w + x] > 128) return [x - (x0 - (x0 % 1024)), y];
  return null;
}

test('buttonbeaks: the tall bird\'s beak tip is where the pictures paint it', async () => {
  // measured again from the PNGs: the yellow beak points left, so its tip is
  // the leftmost opaque pixel around his head
  const portrait = pngAlpha('assets/subjects/buttonbeaks.png');
  const poses = pngAlpha('assets/sprites/buttonbeaks-poses.png');
  assert.deepEqual(leftmost(portrait, 0, 100, 400, 320), BEAK_PX.portrait);
  assert.deepEqual(leftmost(poses, 0, 150, 400, 420), BEAK_PX.stride);
  assert.deepEqual(leftmost(poses, 3072, 100, 3072 + 500, 330), BEAK_PX.cheer);
  // on screen, from the feet point: standing, striding and cheering put the
  // tip within 3 px of the same x, 130-odd px left of the pair's middle
  const near = (a, b, d = 0.1) => Math.abs(a - b) < d;
  assert.ok(near(TALL_BEAK.portrait[0], -132.6) && near(TALL_BEAK.portrait[1], -221.8), `portrait ${TALL_BEAK.portrait}`);
  for (const k of ['stride', 'cheer']) assert.ok(Math.abs(TALL_BEAK[k][0] - TALL_BEAK.portrait[0]) < 3.5, `${k} ${TALL_BEAK[k]}`);
  // and the game uses it once the painting has loaded
  const { withArt } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    const game = create(env(1));
    const b = game.beak();
    assert.ok(near(b.x, game.x + TALL_BEAK.portrait[0], 1e-9) && near(b.y, 748 + TALL_BEAK.portrait[1], 1e-9), `beak ${b.x}, ${b.y}`);
  } finally {
    undo();
  }
});

test('buttonbeaks: a bowl under the tall bird\'s beak tip is picked from first; just outside it is not', async () => {
  const { withArt } = await import('./sprite-rig.mjs');
  await import('../src/subjects.js');
  const undo = withArt();
  try {
    // put the tip at x, and press A
    const pressAt = (bx) => {
      const game = create(env(1));
      assert.equal(game.bowls, 4);
      game.x = bx - TALL_BEAK.portrait[0];
      assert.ok(Math.abs(game.beak().x - bx) < 1e-9, 'tip placed');
      game.update(1 / 60, blank({ action: true, actionPressed: true }));
      return { game, held: game.holding };
    };
    const bx = (i) => create(env(1)).bowlX(i);
    // the right bowl (the pair clear of every other one): just inside its
    // rim on either side, picked; just outside, nothing
    assert.equal(pressAt(bx(3) + BOWL_HALF - 1).held, 3);
    assert.equal(pressAt(bx(3) - BOWL_HALF + 1).held, 3);
    const out = pressAt(bx(3) + BOWL_HALF + 1);
    assert.equal(out.held, null, 'just past the rim');
    assert.equal(out.game.overBowl(), -1);
    // the first bowl's right rim under his beak while the pink one's beak
    // is over the second bowl: his comes first
    const both = pressAt(bx(0) + BOWL_HALF - 1);
    assert.ok(Math.abs(both.game.x - bx(1)) < 80, 'the pink beak is over bowl 1 too');
    assert.equal(both.held, 0);
    // nothing under his beak: the pair's middle (the pink one's beak) picks
    const pink = create(env(1));
    pink.x = bx(0) + 20; // his beak is out past the first bowl's left rim
    assert.equal(pink.overBowl(), 0);
    assert.ok(pink.beak().x < bx(0) - BOWL_HALF);
  } finally {
    undo();
  }
});
