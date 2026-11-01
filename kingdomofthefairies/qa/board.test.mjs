// Headless checks for Act I's rules. Run: node kingdomofthefairies/qa/board.test.mjs
import assert from 'node:assert/strict';
import { createBoard, step, TUNING, ROWS, effectiveRow } from '../src/board.js';

const idle = {};
const run = (b, sec, input = idle, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) step(b, dt, input); return b; };
const drain = (b) => { const e = b.events.slice(); b.events.length = 0; return e; };
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('determinism: same seed, same voyage', () => {
  const a = run(createBoard(7), 30), b = run(createBoard(7), 30);
  assert.equal(a.progress, b.progress);
  assert.deepEqual(a.hazards.map((h) => [h.type, h.row, Math.round(h.x)]), b.hazards.map((h) => [h.type, h.row, Math.round(h.x)]));
});

test('row changes are edges, clamped, and tweened', () => {
  const b = createBoard(1);
  step(b, 1 / 60, { rowUp: true }); assert.equal(b.ship.row, 0);
  run(b, 0.5);
  step(b, 1 / 60, { rowUp: true }); assert.equal(b.ship.row, 0, 'cannot go behind the back row');
  step(b, 1 / 60, { rowDown: true }); assert.equal(b.ship.row, 1);
  step(b, 1 / 60, { rowDown: true }); assert.equal(b.ship.row, 1, 'no second change mid-tween');
  assert.equal(effectiveRow(b.ship), 0, 'still counts as the old row early in the tween');
});

test('leap clears a risen rock; standing still does not', () => {
  const place = (leap) => {
    const b = createBoard(3);
    b.spawnIn = 1e9; b.wind.next = 1e9;
    b.hazards.push({ type: 'rock', row: 1, x: b.ship.x + 120, t: 0, state: 'up' });
    let hit = false;
    for (let t = 0; t < 1.6; t += 1 / 60) {
      const near = b.hazards[0] && b.hazards[0].x - b.ship.x < 90;
      step(b, 1 / 60, { leap: leap && near && b.ship.leapT <= 0 });
      if (drain(b).some((e) => e.type === 'hit')) hit = true;
    }
    return hit;
  };
  assert.equal(place(false), true);
  assert.equal(place(true), false);
});

test('lightning ignores leaping but changing row dodges it', () => {
  const strike = (dodge) => {
    const b = createBoard(4);
    b.spawnIn = 1e9; b.wind.next = 1e9;
    b.hazards.push({ type: 'bolt', row: 1, x: b.ship.x, t: 0, state: 'warn' });
    step(b, 1 / 60, dodge ? { rowDown: true } : { leap: true });
    run(b, TUNING.bolt.warn + 0.3);
    return b.ship.hull;
  };
  assert.equal(strike(false), TUNING.hull - 1);
  assert.equal(strike(true), TUNING.hull);
});

test('invulnerability after a hit, wreck at zero hull', () => {
  const b = createBoard(5);
  b.spawnIn = 1e9; b.wind.next = 1e9;
  for (let k = 0; k < 3; k++) {
    b.hazards.push({ type: 'rock', row: 1, x: b.ship.x, t: 0, state: 'up' });
    step(b, 1 / 60, idle);
    run(b, TUNING.invuln + 0.1);
    b.hazards.length = 0;
  }
  assert.equal(b.ship.hull, 0);
  assert.equal(b.phase, 'wrecked');
});

test('wind warns before it turns, and a headwind slows the voyage', () => {
  const b = createBoard(6);
  b.spawnIn = 1e9;
  run(b, TUNING.wind.first - TUNING.wind.warn + 0.05);
  assert.ok(drain(b).some((e) => e.type === 'windWarn'));
  run(b, TUNING.wind.warn);
  assert.equal(b.wind.dir, -1);
  const p0 = b.progress; run(b, 2); const head = b.progress - p0;
  b.wind.dir = 1; const p1 = b.progress; run(b, 2); const tail = b.progress - p1;
  assert.ok(tail > head * 1.4, `tail ${tail} vs head ${head}`);
});

test('three tea leaves float by once each, and the voyage then lands', () => {
  const b = createBoard(8);
  b.spawnIn = 1e9; b.wind.next = 1e9;
  const seen = [];
  let guard = 0;
  while (b.phase !== 'done' && guard++ < 60 * 200) {
    // steer onto any leaf's row
    const k = b.pickups.find((p) => p.type === 'keepsake');
    const input = {};
    if (k && b.ship.rowT >= 1) { if (k.row < b.ship.row) input.rowUp = true; if (k.row > b.ship.row) input.rowDown = true; }
    step(b, 1 / 60, input);
    for (const e of drain(b)) { if (e.type === 'keepsake') seen.push(e.kind); if (e.type === 'landed') seen.push('landed'); }
  }
  assert.deepEqual(seen, ['leaf', 'leaf', 'leaf', 'landed']);
  assert.equal(b.leaves, 3);
  assert.ok(b.progress === 1);
});

test('an idle voyage is survivable in rough length and never walls off all rows', () => {
  for (const seed of [11, 12, 13, 14, 15]) {
    const b = createBoard(seed);
    b.ship.hull = 1e9; // observe spawns without wrecking
    let worst = 0, t = 0;
    while (b.phase === 'sail' && t < 400) {
      step(b, 1 / 60, idle); t += 1 / 60; drain(b);
      for (const r of b.hazards) {
        if (r.type !== 'rock') continue;
        const rows = new Set(b.hazards.filter((h) => h.type === 'rock' && Math.abs(h.x - r.x) < 60).map((h) => h.row));
        worst = Math.max(worst, rows.size);
      }
    }
    assert.ok(worst < 3, `seed ${seed} walled off all rows`);
    assert.ok(t > 75 && t < 140, `voyage took ${t.toFixed(1)}s`);
    assert.ok(ROWS.length === 3);
  }
});


test('pearls mend the hull: pearlsPerLantern pearls survive one more hit (src/game_config.js)', () => {
  const N = TUNING.pearlsPerLantern;
  assert.ok(N > 0, 'healing is on in the config');
  const pearlAt = (b) => b.pickups.push({ type: 'pearl', row: b.ship.row, x: b.ship.x, t: 0 });
  const hitNow = (b) => { b.ship.invuln = 0; b.hazards.push({ type: 'bolt', row: effectiveRow(b.ship), x: b.ship.x, t: 0, state: 'strike' }); step(b, 1 / 60, {}); b.hazards = []; };
  const b = createBoard(5); b.spawnIn = 1e9; b.wind.next = 1e9;
  for (let i = 0; i < TUNING.hull - 1; i++) hitNow(b);
  assert.equal(b.ship.hull, 1);
  for (let i = 0; i < N; i++) { pearlAt(b); step(b, 1 / 60, {}); }
  assert.equal(b.ship.hull, 2, `${N} pearls mend one lantern`);
  hitNow(b); assert.equal(b.phase, 'sail', 'survives the extra hit');
  hitNow(b); assert.equal(b.phase, 'wrecked', 'and the next one sinks it');
  // never above the full hull
  const f = createBoard(6); f.spawnIn = 1e9; f.wind.next = 1e9;
  for (let i = 0; i < N * 2; i++) { pearlAt(f); step(f, 1 / 60, {}); }
  assert.equal(f.ship.hull, TUNING.hull);
  // part-mended: half the pearls give half a lantern
  const h = createBoard(7); h.spawnIn = 1e9; h.wind.next = 1e9; hitNow(h);
  for (let i = 0; i < N / 2; i++) { pearlAt(h); step(h, 1 / 60, {}); }
  assert.ok(Math.abs(h.ship.hull - (TUNING.hull - 0.5)) < 1e-6);
});

// ---------------------------------------------------------------- Act I's ending
const { default: act1, ENDING, LANTERNS, SPOTS } = await import('../src/acts/act1.js');
const { beatHit } = await import('../src/acts/shared.js');
const endingRun = (seed, lightOnBeat) => {
  const st = act1.create({ seed, from: { scene: 3, progress: 0.999 } });
  st.board.ship.invuln = 99;
  const seen = [];
  for (let t = 0; t < 60 && st.status === 'play'; t += 1 / 60) {
    const beat = t * 76.5 / 60 + 0.33;
    act1.step(st, 1 / 60, { beat, a: lightOnBeat && st.phase === 'party' && beatHit(beat, 0.05) != null });
    if (seen[seen.length - 1]?.phase !== st.phase) seen.push({ phase: st.phase, t });
    st.events.length = 0;
  }
  return { st, seen };
};

test('the ending: bell, deck party, turn, wreck, guitar, each kept brief', () => {
  const { st, seen } = endingRun(11, true);
  assert.equal(st.status, 'won');
  assert.deepEqual(seen.map((s) => s.phase), ['voyage', 'landho', 'party', 'turn', 'wreck', 'sink', 'iris']);
  const total = Object.values(ENDING).reduce((a, b) => a + b, 0);
  assert.ok(total <= 23, `ending runs ${total.toFixed(1)} s`);
  assert.equal(st.party.lit, LANTERNS); assert.ok(st.result.revelry, 'every lantern lit');
});

test('the revellers land in a different arrangement of the deck spots each time', () => {
  const layouts = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const { st } = endingRun(seed, false);
    const sp = st.party.spots;
    assert.equal(sp.length, 4); assert.equal(new Set(sp).size, 4);
    assert.ok(sp.every((i) => SPOTS[i]), 'real spots');
    assert.ok(!(sp.includes(0) && sp.includes(1)), 'never both barrels by the left hatch');
    layouts.add(sp.join());
  }
  assert.ok(layouts.size >= 6, `${layouts.size} layouts in 12 voyages`);
});

console.log(`\n${n} checks passed`);
