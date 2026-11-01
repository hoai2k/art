import test from 'node:test';
import assert from 'node:assert/strict';
import create from '../src/games/coot.js';
import { BIRDS } from '../src/birds.js';
import { run, blank, env } from './harness.mjs';

const pass = BIRDS.find((b) => b.id === 'coot').pass;

// A good player: run under the lowest good scoop, and lean against the stack.
function chaser(game) {
  const top = { x: game.x - 86 };
  const good = game.items.filter((i) => i.kind !== 'pickle' && i.kind !== 'sock').sort((a, b) => b.y - a.y)[0];
  const bad = game.items.filter((i) => (i.kind === 'pickle' || i.kind === 'sock') && i.y > 300).sort((a, b) => b.y - a.y)[0];
  let target = good ? good.x : top.x;
  if (bad && Math.abs(bad.x - top.x) < 90) target = top.x + (bad.x > top.x ? -200 : 200);
  const d = target - top.x;
  return { x: Math.max(-1, Math.min(1, d / 60)) };
}

test('coot: a careful chaser opens the next page; idle earns nothing', () => {
  const scores = [1, 2, 3, 4].map((seed) => run(create, { seed, bot: chaser }).game.score);
  const idle = run(create, { seed: 1 }).game.score;
  assert.ok(idle < pass, `idle ${idle}`);
  assert.ok(Math.max(...scores) >= pass, `chaser best ${scores}`);
  console.log('coot chaser scores', scores, 'pass', pass);
});

// A beginner: reacts late, aims loosely, runs at partial speed and pays no
// heed to pickles and socks. This is the medium player: it handles medium.
// `clumsy` looks up less often, aims looser and runs slower still.
const CL = { look: 0.6, aim: 180, speed: 0.5 };
function beginner(seed, clumsy = false) {
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let target = null;
  let wait = 0;
  return (game) => {
    const top = game.x - 86;
    wait -= 1 / 60;
    if (wait <= 0) {
      wait = (clumsy ? CL.look : 0.45) + rnd() * 0.3; // looks up now and then
      const good = game.items.filter((i) => i.kind !== 'pickle' && i.kind !== 'sock').sort((a, b) => b.y - a.y)[0];
      // the faster it falls, the looser the aim (110 px across at medium speed)
      target = good ? good.x + (rnd() - 0.5) * (clumsy ? CL.aim : 110) * (good.vy / 340) : null;
    }
    if (target === null) return {};
    return { x: Math.max(-1, Math.min(1, (target - top) / 80)) * (clumsy ? CL.speed : 0.6) };
  };
}
// Mashing: running back and forth at random.
function masher(seed) {
  let r = seed * 31;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  let d = 0;
  return () => {
    if (rnd() < 0.03) d = rnd() * 2 - 1;
    return { x: d, action: rnd() < 0.5 };
  };
}

const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const BOTS = {
  idle: () => () => ({}),
  mash: (seed) => masher(seed),
  clumsy: (seed) => beginner(seed, true),
  medium: (seed) => beginner(seed),
  good: () => chaser,
};
const TABLE = {};
for (const level of ['easier', 'normal', 'harder']) {
  TABLE[level] = {};
  for (const [name, bot] of Object.entries(BOTS)) TABLE[level][name] = SEEDS.map((seed) => run(create, { seed, bot: bot(seed), difficulty: level }).game.score);
}
const passRate = (a) => a.filter((s) => s >= pass).length / a.length;
console.log(`coot pass ${pass}`);
for (const [level, row] of Object.entries(TABLE)) console.log(level, Object.entries(row).map(([n, a]) => `${n} ${Math.round(mean(a))} [${Math.min(...a)}-${Math.max(...a)}] ${Math.round(passRate(a) * 100)}%`).join(' · '));

// The score is the tallest stack, so luck plays a part: a random runner now
// and then has scoops land on its head (about one round in twenty at Normal,
// as before the curve; the pass mark was lowered to 6 on purpose). So the
// checks on idling and mashing are on how often, not never.
test('coot: at Normal a medium player passes; idle and mashing seldom, and well below on average', () => {
  const t = TABLE.normal;
  assert.ok(passRate(t.medium) >= 0.75, `medium ${t.medium}`);
  assert.ok(mean(t.good) >= pass * 3, `good ${t.good}`);
  for (const name of ['idle', 'mash']) {
    assert.ok(passRate(t[name]) <= 0.1, `${name} ${t[name]}`);
    assert.ok(mean(t[name]) < pass * 0.6, `${name} ${t[name]}`);
  }
});

test('coot: Easier: a clumsy player passes about half the time, the medium player nearly always; idling never', () => {
  const t = TABLE.easier;
  assert.ok(passRate(t.clumsy) >= 0.45, `clumsy ${t.clumsy}`);
  assert.ok(passRate(t.medium) >= 0.85 && mean(t.medium) >= mean(TABLE.normal.medium), `medium ${t.medium}`);
  assert.ok(Math.max(...t.idle) < pass, `idle ${t.idle}`);
  assert.ok(passRate(t.mash) <= 0.15 && mean(t.mash) < pass * 0.6, `mash ${t.mash}`);
});

test('coot: Harder ends hard: fewer clumsy passes; the good chaser still builds far taller than the medium player', () => {
  const t = TABLE.harder;
  assert.ok(passRate(t.clumsy) < passRate(TABLE.normal.clumsy), `clumsy ${t.clumsy}`);
  assert.ok(mean(t.good) > mean(t.medium) * 2.5, `good ${mean(t.good)} vs medium ${mean(t.medium)}`);
  assert.ok(Math.max(...t.idle, ...t.mash) < pass, 'no luck at Harder');
});

test('coot: an off-centre stack spills from its weak point, keeping what is below it', () => {
  const game = create({ W: 1600, H: 900, rng: () => 0.5, sfx: () => {} });
  game.spawn = 1e9;
  // straight up for four, then a kink: the top two lean past the third scoop
  for (const dx of [0, 0, 0, 0, 50, 30]) game.stack.push({ dx, color: '#fff', kind: 'scoop', count: 1 });
  game.update(1 / 60, blank());
  assert.equal(game.stack.length, 3, `kept the straight part (${game.stack.length})`);
  assert.ok(game.spilled === 3 && game.topples === 0, `three slid off, not a topple (${game.spilled}, ${game.topples})`);
});

test('coot: a stack leaning too far on the head sheds from the top until it steadies', () => {
  const game = create({ W: 1600, H: 900, rng: () => 0.5, sfx: () => {} });
  game.spawn = 1e9;
  for (let i = 0; i < 6; i++) game.stack.push({ dx: 18, color: '#fff', kind: 'scoop', count: 1 });
  step(game, 2);
  assert.ok(game.stack.length > 0 && game.stack.length < 6, `some left (${game.stack.length})`);
});

// ---------- clinging scoops ----------

function quiet(seed = 1) {
  const g = create(env(seed));
  g.spawn = 1e9; // nothing falls unless a test drops it
  return g;
}
const scoop = (x, y) => ({ x, y, vy: 300, kind: 'scoop', color: '#ea8fb0', spin: 0, a: 0 });
function step(g, s, inp = blank()) {
  for (let t = 0; t < s; t += 1 / 60) g.update(1 / 60, inp);
}

test('coot: a scoop that hits the side of the stack clings there, then slips off', () => {
  const g = quiet();
  for (let i = 0; i < 5; i++) g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.update(1 / 60, blank());
  const col = g.stack.length;
  // drop one beside the middle of the stack
  const mid = g.column()[3];
  g.items.push(scoop(mid.x + 38, mid.y - 30));
  step(g, 0.1);
  assert.equal(g.stack.length, col, 'the stack did not grow');
  assert.equal(g.clingers.length, 1, 'it clings');
  step(g, 4);
  assert.equal(g.clingers.length, 0, 'it slipped down and fell');
});

function holdTime(side) {
  const g = quiet();
  // a stack leaning left
  for (let i = 0; i < 5; i++) g.stack.push({ dx: -6, color: '#fff', kind: 'scoop', count: 1 });
  g.clingers.push({ lvl: 2, side, grip: 1.1, sliding: false, v: 0, t: 0, color: '#fff', kind: 'scoop', count: 1 });
  let t = 0;
  while (t < 10 && g.clingers[0] && !g.clingers[0].sliding) {
    g.update(1 / 60, blank());
    t += 1 / 60;
  }
  return t;
}

test('coot: a clinging scoop holds longer on the side the stack leans away from', () => {
  const right = holdTime(1);
  const left = holdTime(-1);
  assert.ok(right > left * 1.3, `right ${right.toFixed(2)}s vs left ${left.toFixed(2)}s`);
});

test('coot: running into a clinging scoop presses it on; running away peels it off', () => {
  const time = (dir) => {
    const g = quiet();
    for (let i = 0; i < 5; i++) g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
    g.clingers.push({ lvl: 2, side: 1, grip: 1.1, sliding: false, v: 0, t: 0, color: '#fff', kind: 'scoop', count: 1 });
    let t = 0;
    let k = 0;
    while (t < 10 && g.clingers[0] && !g.clingers[0].sliding) {
      // running back and forth, faster one way than the other
      g.update(1 / 60, blank({ x: k++ % 40 < 20 ? dir : -dir * 0.4 }));
      t += 1 / 60;
    }
    return t;
  };
  assert.ok(time(1) > time(-1), 'pressing holds longer than peeling');
});

test('coot: a slipping scoop comes to rest on a scoop that juts out below it', () => {
  const g = quiet();
  // scoop 2 juts out to the right of scoop 3
  for (const dx of [0, 0, 22, -22, 0]) g.stack.push({ dx, color: '#fff', kind: 'scoop', count: 1 });
  g.clingers.push({ lvl: 3.9, side: 1, grip: 0, sliding: true, v: 0, t: 0, color: '#fff', kind: 'scoop', count: 1 });
  step(g, 0.6);
  assert.equal(g.clingers.length, 1, 'still on the stack');
  assert.ok(!g.clingers[0].sliding, 'resting');
  assert.ok(Math.abs(g.clingers[0].lvl - 3.65) < 0.01, `on the ledge (lvl ${g.clingers[0].lvl})`);
});

test('coot: a scoop cupped by a clinging scoop near the top is pushed up onto the stack', () => {
  const g = quiet();
  for (let i = 0; i < 4; i++) g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.clingers.push({ lvl: 3, side: 1, grip: 1.1, sliding: false, v: 0, t: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.update(1 / 60, blank());
  const before = g.stack.length;
  // drop one onto the clinging scoop
  const p = g.clingPos(g.clingers[0]);
  g.items.push(scoop(p.x + 2, p.y - 60));
  step(g, 0.3);
  assert.equal(g.stack.length, before + 1, 'the new scoop is on top');
  assert.equal(g.clingers.length, 1, 'and the one that cupped it is still holding on');
});

test('coot: a tall stack zooms the view out, keeping sky above it, and scoops start above the view', () => {
  const g = quiet();
  g.update(1 / 60, blank());
  assert.equal(g.zoom, 1, 'no zoom with an empty head');
  for (let i = 0; i < 18; i++) g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  step(g, 3);
  assert.ok(g.zoom * g.depth < 0.8, `zoomed out (${g.zoom.toFixed(2)} x ${g.depth.toFixed(2)})`);
  assert.ok(g.depth < 1, 'the Coot stepped back along the boardwalk');
  const top = g.column().at(-1).y;
  const viewTop = g.viewTop();
  assert.ok(top - viewTop > 300, `sky above the stack: ${Math.round(top - viewTop)} px`);
  g.spawn = 0;
  g.update(1 / 60, blank());
  assert.ok(g.items.length && g.items.at(-1).y < viewTop, 'a new scoop starts above the view');
});

test('coot: a scoop stays exactly where it lands, off-centre and lower', () => {
  const g = quiet();
  for (let i = 0; i < 3; i++) g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.update(1 / 60, blank());
  const top = g.column().at(-1);
  g.items.push(scoop(top.x + 38, top.y - 80));
  step(g, 0.4);
  assert.equal(g.stack.length, 4, 'caught on top');
  assert.ok(Math.abs(g.stack[3].dx - 38) < 4, `kept its spot (dx ${g.stack[3].dx.toFixed(1)})`);
  const col = g.column();
  assert.ok(col[3].y - col[4].y < 43.5 - 10, 'and sits lower, against the side of the one below');
});

test('coot: the bottom scoop settles into the head', () => {
  const g = quiet();
  g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.stack.push({ dx: 0, color: '#fff', kind: 'scoop', count: 1 });
  g.update(1 / 60, blank());
  const col = g.column();
  const headTop = col[0].y - 30 * 1.1;
  const gap = headTop - col[1].y; // from the top of the head up to the bottom scoop's centre
  assert.ok(gap < 25, `resting on the head, not floating above it (${gap.toFixed(1)} px)`);
});

// The Coot is one size in every painted pose (standing, striding, looking up), and stands on the
// same line: measured against how big each picture is painted
// (design/source/pose-scales.json).
test('coot: every painted pose shows the Coot the same size, on the same feet', async () => {
  const { withArt, birdSizes, sizeCheck } = await import('./sprite-rig.mjs');
  const undo = withArt();
  try {
    const feet = { 'bird.coot#0': 0.979, 'sprites.cootPoses#0': 0.96, 'sprites.cootPoses#1': 0.982 };
    const sizes = await birdSizes('coot', { standing: {}, striding: { frame: 'stride' }, 'looking up': { frame: 'lookup' } }, feet);
    const { fails, table } = sizeCheck(sizes, 'standing');
    console.log('coot pose sizes', table);
    assert.deepEqual(fails, []);
    const y0 = sizes.standing[0].feetY;
    for (const [name, [d]] of Object.entries(sizes)) assert.ok(Math.abs(d.feetY - y0) < 4, `${name}: feet at ${d.feetY.toFixed(1)}, standing at ${y0.toFixed(1)}`);
  } finally {
    undo();
  }
});

function thirds(difficulty) {
  const thirds = [0, 1, 2].map(() => ({ n: 0, vy: 0, bad: 0 }));
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const game = create(env(seed, { difficulty }));
    const seen = new Set();
    while (!game.done) {
      game.update(1 / 60, blank());
      for (const it of game.items) {
        if (seen.has(it)) continue;
        seen.add(it);
        const b = thirds[Math.min(2, Math.floor(game.elapsed / 15))];
        b.n++;
        b.vy += it.vy;
        if (it.kind === 'pickle' || it.kind === 'sock') b.bad++;
      }
    }
  }
  return thirds;
}

test('coot: the round starts gentle and ends hard: slower, sparser, fewer pickles and socks at first', () => {
  const [a, , c] = thirds('normal');
  assert.ok(c.vy / c.n > (a.vy / a.n) * 1.6, `falls faster: ${a.vy / a.n} vs ${c.vy / c.n}`);
  assert.ok(c.n > a.n * 1.25, `more often: ${a.n} vs ${c.n}`);
  assert.ok(c.bad / c.n > (a.bad / a.n) * 2, `more pickles and socks: ${a.bad}/${a.n} vs ${c.bad}/${c.n}`);
});

test('coot: Easier stays gentle all round; Harder ends busier than Normal', () => {
  const e = thirds('easier');
  const n = thirds('normal');
  const h = thirds('harder');
  assert.ok(e[2].vy / e[2].n < n[2].vy / n[2].n * 0.75, 'Easier ends slower');
  assert.ok(e[2].n < n[2].n, 'Easier ends sparser');
  assert.ok(h[2].n > n[2].n && h[2].bad / h[2].n > n[2].bad / n[2].n, 'Harder ends busier and nastier');
  assert.ok(h[0].vy / h[0].n > n[0].vy / n[0].n * 1.4, 'Harder opens near medium');
});
