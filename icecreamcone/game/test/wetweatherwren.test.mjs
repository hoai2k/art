import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/wetweatherwren.js';
import entry from '../src/more/wetweatherwren.js';
import { run, env, blank } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const pass = entry.pass;
const FOOT = 22;

// A walker who watches the next puddle and hops it. `lead` is how early it
// presses (jittered by `slop`); it floats over the puddle and lets go once
// past; it keeps the umbrella shut near awnings (a quick tap hop for a
// puddle near one); it opens over a little bird when it remembers to.
// `missK` makes it forget a puddle more often as the street speeds up (per
// 1000 px/s of street).
function walker({ lead = 70, slop = 0, kind = 0.9, miss = 0, missK = 0, seed = 1 } = {}) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let tap = 0;
  let jitter = 0;
  let target = null;
  return (game) => {
    const d = game.d;
    const next = game.puddles.filter((p) => !p.hit && !p.counted && p.x1 - FOOT > d).sort((a, b) => a.x0 - b.x0)[0];
    const awn = game.awnings.find((a) => !a.hit && a.x1 > d - 160 && a.x0 < d + 260);
    if (tap > 0) {
      tap--;
      return { action: true };
    }
    if (next !== target) {
      target = next;
      jitter = rnd() < miss + (missK * game.speed) / 1000 ? -1e4 : (rnd() - 0.5) * 2 * slop;
    }
    if (game.grounded) {
      if (next && next.x0 - d < lead + jitter + game.speed * 0.05 && next.x0 - d > -FOOT) {
        if (awn || next.under) {
          tap = 1;
          return { action: true };
        }
        return { action: true };
      }
      const chick = game.chicks.find((c) => c.state === 'wait' && Math.abs(c.x - d) < 45);
      if (chick && !awn && rnd() < kind) return { action: true };
      return {};
    }
    // In the air: float over the puddle, drop once past it or near an awning.
    if (awn) return {};
    if (next && d < next.x1 + 10) return { action: true };
    const chick = game.chicks.find((c) => c.state === 'wait' && Math.abs(c.x - d) < 60);
    return { action: !!chick };
  };
}

// Mashing: press, let go, press, let go.
const masher = (every = 6) => {
  let k = 0;
  return () => ({ action: k++ % every < every / 2 });
};

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  hold: () => () => ({ action: true }),
  mash: (s) => masher([2, 4, 6, 10, 20, 40][s % 6]),
  clumsy: (seed) => walker({ lead: 90, slop: 70, kind: 0.3, missK: 0.9, seed }), // forgets 27% of puddles at the start, 47% at the end
  medium: (seed) => walker({ lead: 90, slop: 70, kind: 0.4, miss: 0.15, seed }), // the old beginner
  good: (seed) => walker({ lead: 60, slop: 10, kind: 1, seed }),
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, b] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: b(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`wetweatherwren pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

test('wetweatherwren: at Normal a medium walker passes, a good one more; idling, holding and mashing do not', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) > mean(t.medium) + 2, `good ${t.good}`);
  assert.ok(mean(t.clumsy) < mean(t.medium), `clumsy ${t.clumsy}`);
  for (const n of ['idle', 'hold', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

// Points are puddles hopped, and a faster, busier street lays more puddles in
// the same 45 s: at Easier there are fewer to hop, so every walker scores a
// little less there. Easier is calmer, not higher-scoring; a clumsy walker
// still passes about half the time, and idling and mashing never do.
test('wetweatherwren: Easier is calmer; a clumsy walker still passes about half the time; idling, holding and mashing fail', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.5, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  for (const n of ['idle', 'hold', 'mash']) assert.ok(Math.max(...t[n]) < pass, `${n} ${t[n]}`);
});

test('wetweatherwren: Harder ends hard: the good walker scores clearly more than the medium one', () => {
  const t = TABLE.harder;
  assert.ok(mean(t.good) > mean(t.medium) + 4, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(mean(t.good) > mean(TABLE.normal.good), 'a faster street pays the good walker more');
});

test('wetweatherwren: the knobs, third by third at each level', () => {
  for (const level of ['easier', 'normal', 'harder']) {
    const game = create(env(1, { difficulty: level }));
    const look = () => ({ speed: game.speedNow(), dry: game.dryNow(), width: game.widthNow() + game.widthSpread() / 2 });
    const at = [look()];
    for (let third = 0; third < 3; third++) {
      // walk with the umbrella open so nothing stops the clock
      for (let i = 0; i < 15 * 60 - (third === 2 ? 1 : 0); i++) game.update(1 / 60, blank());
      at.push(look());
    }
    console.log('wetweatherwren ramp', level, at.map((a) => `${a.speed.toFixed(0)} px/s dry ${a.dry.toFixed(0)} width ${a.width.toFixed(0)}`).join(' | '));
    for (let i = 1; i < at.length; i++) assert.ok(at[i].speed >= at[i - 1].speed && at[i].dry <= at[i - 1].dry, `${level} gets harder`);
    if (level === 'normal') {
      assert.equal(at[0].speed, 300);
      assert.ok(at[1].speed < (at[0].speed + at[3].speed) / 2, 'the first third stays gentle');
      assert.ok(at[3].speed > 500, 'the end is fast');
    }
    if (level === 'easier') assert.ok(at[3].speed < 400, 'Easier never gets near medium');
    if (level === 'harder') assert.ok(at[0].speed > 400 && at[3].speed > 565, 'Harder opens near medium and ends at hard');
  }
});

test('wetweatherwren: the street starts slow and sparse and ends fast and crowded, with awnings, double puddles and gusts only later', () => {
  const early = { speed: [], widths: [], gaps: [], awnings: 0, gust: false };
  const late = { speed: [], widths: [], gaps: [], awnings: 0, gust: false };
  for (const seed of [1, 2, 3, 4]) {
    const seen = new Set();
    let last = null; // the end of the hazard laid before
    const laid = (part, x0, x1) => {
      if (last !== null && x0 > last) part.gaps.push(x0 - last);
      last = Math.max(last ?? x1, x1);
    };
    const bot = walker({ lead: 60, slop: 10, kind: 1, seed });
    run(create, {
      seed,
      bot: (game, t) => {
        const p = game.elapsed / 45;
        const part = p < 1 / 3 ? early : p > 2 / 3 ? late : null;
        if (!part) last = null;
        if (part) {
          if (game.recoverT < 0 && game.grounded && !game.stun) part.speed.push(game.speed);
          if (game.gust > 0) part.gust = true;
          const fresh = [...game.puddles, ...game.awnings].filter((q) => !seen.has(q)).sort((a, b) => a.x0 - b.x0);
          for (const q of fresh) {
            seen.add(q);
            if (game.awnings.includes(q)) part.awnings++;
            else part.widths.push(q.x1 - q.x0);
            laid(part, q.x0, q.x1);
          }
        }
        return bot(game, t);
      },
    });
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const s0 = Math.max(...early.speed);
  const s1 = Math.max(...late.speed);
  assert.ok(s1 > s0 * 1.4, `speed early ${s0.toFixed(0)}, late ${s1.toFixed(0)}`);
  assert.ok(mean(late.widths) > mean(early.widths) + 40, `puddle width early ${mean(early.widths).toFixed(0)}, late ${mean(late.widths).toFixed(0)}`);
  assert.ok(mean(late.gaps) < mean(early.gaps) * 0.75, `dry gaps early ${mean(early.gaps).toFixed(0)}, late ${mean(late.gaps).toFixed(0)}`);
  assert.equal(early.gust, false, 'no gusts early');
  assert.ok(late.gust, 'gusts late');
  assert.ok(late.awnings > early.awnings, `awnings early ${early.awnings}, late ${late.awnings}`);
});

test('wetweatherwren: walking into a puddle slips, falls, gets up and shakes before resuming', () => {
  const game = create(env(1));
  game.update(1 / 60, blank());
  const p = game.puddles[0];
  for (let i = 0; i < 60 * 6 && !game.splashes; i++) game.update(1 / 60, blank());
  assert.equal(game.splashes, 1);
  assert.ok(p.hit);
  assert.equal(game.poseName(), 'slip');
  const start = game.d;
  const poses = new Set();
  let sprayed = false;
  for (let i = 0; i < 90; i++) {
    game.update(1 / 60, blank({ action: true, actionPressed: true }));
    if (game.recoverT >= 0) {
      poses.add(game.poseName());
      assert.equal(game.open, false, 'recovery finishes before hopping');
      if (game.poseName() === 'shakeDry') sprayed ||= game.bits.some(b => Math.abs(b.vx) >= 180);
    }
  }
  for (const pose of ['slip', 'fallen', 'getUp', 'shakeDry']) assert.ok(poses.has(pose), pose);
  assert.ok(sprayed, 'wings spray water');
  assert.ok(game.d > start, 'slips forwards into water');
  assert.equal(game.recoverT, -1);
  assert.ok(game.speed > 0, 'continues on');
  assert.equal(game.score, 0);
});

test('wetweatherwren: hopping over a puddle with the umbrella open scores', () => {
  const game = create(env(1));
  game.update(1 / 60, blank());
  const p = game.puddles[0];
  while (p.x0 - game.d > 50) game.update(1 / 60, blank());
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  assert.ok(!game.grounded && game.open);
  for (let i = 0; i < 60 * 3 && game.d < p.x1 + 20; i++) game.update(1 / 60, blank({ action: true }));
  assert.equal(game.splashes, 0);
  assert.equal(game.score, 1);
});

test('wetweatherwren: an open umbrella catches on an awning; a furled one walks under', () => {
  const game = create(env(1));
  game.update(1 / 60, blank());
  game.awnings.push({ x0: game.d + 100, x1: game.d + 500, color: 0 });
  game.puddles = [];
  game.nextX = game.d + 5000;
  for (let i = 0; i < 60 * 3; i++) game.update(1 / 60, blank());
  assert.equal(game.snags, 0, 'walking under, furled');
  game.awnings.push({ x0: game.d + 200, x1: game.d + 600, color: 0 });
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60 * 2 && !game.snags; i++) game.update(1 / 60, blank({ action: true }));
  assert.equal(game.snags, 1);
  assert.ok(!game.open);
});

test('wetweatherwren: an open canopy over a little bird keeps it dry', () => {
  const game = create(env(1));
  game.update(1 / 60, blank());
  game.puddles = [];
  game.chicks.push({ x: game.d + 300, state: 'wait', t: 0, color: '#fff' });
  game.nextX = game.d + 5000;
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60 * 2; i++) game.update(1 / 60, blank({ action: game.grounded ? false : true, actionPressed: false }));
  // walking with it open from the ground works too
  const c2 = { x: game.d + 300, state: 'wait', t: 0, color: '#fff' };
  game.chicks.push(c2);
  game.update(1 / 60, blank({ action: true, actionPressed: true }));
  for (let i = 0; i < 60 * 2; i++) game.update(1 / 60, blank({ action: true }));
  assert.equal(game.sheltered, 2);
  assert.equal(c2.state, 'dry');
});

// ---------- measuring the art (a minimal PNG reader: 8-bit RGBA, not interlaced) ----------
const pngCache = new Map();
function readPng(path) {
  if (pngCache.has(path)) return pngCache.get(path);
  const buf = readFileSync(new URL('../' + path, import.meta.url));
  let pos = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      assert.equal(data[8], 8, '8-bit');
      assert.equal(data[9], 6, 'RGBA');
      assert.equal(data[12], 0, 'not interlaced');
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const img = { w, h, px };
  pngCache.set(path, img);
  return img;
}
// The bounding box (w, h) of the 4-connected patch of pixels passing `test`
// nearest (cx, cy), within `r` of it; for an eye, its diameter.
// Gaps up to 2 * `bridge` px (a pupil's rim, an eyelid's line) are bridged.
function patchBox(img, ox, oy, cx, cy, test, r = 60, bridge = 5) {
  const on = (x, y) => {
    const i = ((oy + y) * img.w + ox + x) * 4;
    return test(img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3]);
  };
  const near = new Map();
  const at = (x, y) => {
    const k = x + ',' + y;
    if (!near.has(k)) {
      let v = false;
      for (let dy = -bridge; dy <= bridge && !v; dy++) for (let dx = -bridge; dx <= bridge && !v; dx++) v = on(x + dx, y + dy);
      near.set(k, v);
    }
    return near.get(k);
  };
  let seed = null;
  for (let d = 0; d < r && !seed; d++) {
    for (let dy = -d; dy <= d && !seed; dy++) for (let dx = -d; dx <= d && !seed; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === d && at(cx + dx, cy + dy)) seed = [cx + dx, cy + dy];
  }
  assert.ok(seed, `no feature near ${cx},${cy}`);
  const seen = new Set([seed[0] + ',' + seed[1]]);
  const q = [seed];
  let x0 = seed[0], x1 = seed[0], y0 = seed[1], y1 = seed[1];
  while (q.length) {
    const [x, y] = q.pop();
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = nx + ',' + ny;
      if (seen.has(k) || Math.abs(nx - cx) > r || Math.abs(ny - cy) > r || !at(nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return [x1 - x0 + 1 - 2 * bridge, y1 - y0 + 1 - 2 * bridge];
}
// How many pixels of a cell pass `test`.
function countIn(img, ox, oy, size, test) {
  let n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = ((oy + y) * img.w + ox + x) * 4;
      if (test(img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3])) n++;
    }
  }
  return n;
}
// Where a pose's cell is on its sheet.
const cellOf = (img, grid, i, size) => [(i % grid[0]) * size, Math.floor(i / grid[0]) * size];

test('wetweatherwren: every pose shows the bird at one size (its eye within 4% of the walking pose\'s)', async () => {
  const { WREN_POSES } = await import('../src/games/wetweatherwren.js');
  const { SHEETS } = await import('../src/draw.js');
  const { ASSETS } = await import('../src/asset-list.js');
  // the eye: a cream disc; its diameter is the mean of its width and height,
  // or (shut tight in the drenched pose) its height
  const cream = (r, g, b, a) => a > 200 && (r + g + b) / 3 > 185 && b > 110;
  const size = {};
  for (const [name, [key, i, s, , , cw, ex, ey]] of Object.entries(WREN_POSES)) {
    if (!ASSETS[key]?.delivered) continue;
    const img = readPng(ASSETS[key].file);
    const [ox, oy] = cellOf(img, SHEETS[key], i, cw);
    const [w, h] = patchBox(img, ox, oy, ex, ey, cream);
    size[name] = (name === 'splash' ? h : (w + h) / 2) / s;
  }
  const ref = size.walk0;
  console.log('wetweatherwren eye on screen, relative to walking:', Object.fromEntries(Object.entries(size).map(([k, v]) => [k, +(v / ref).toFixed(3)])));
  for (const [name, v] of Object.entries(size)) assert.ok(Math.abs(v / ref - 1) <= 0.04, `${name}: ${(v / ref).toFixed(3)}`);
});
