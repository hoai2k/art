// Act I — The Crossing. Pure game state: no DOM, no canvas, no audio, so the
// rules can be simulated headless (qa/board.test.mjs). The renderer reads the
// state; the shell drains `events` for sound, haptics and announcements.

import CONFIG from './game_config.js';

export const STAGE = { left: 120, right: 1160, width: 1280, height: 720 };
// Three cranked wave rows, back to front. `y` is the waterline of the row.
export const ROWS = [
  { y: 432, scale: 0.72 },
  { y: 512, scale: 0.86 },
  { y: 596, scale: 1.0 },
];
// Three tea leaves float past, once each; together they complete the reading.
export const LEAVES = 3;

export const TUNING = {
  duration: 100, // seconds of sailing at speed 1 to reach the bay
  scroll: 170, // px/s the scenery passes at speed 1
  shipMin: 210, shipMax: 930, shipSpeed: 280,
  rowTween: 0.22,
  leapTime: 0.78, leapHeight: 96, leapClear: 26,
  hull: CONFIG.act1.lanterns, invuln: 1.6,
  pearlsPerLantern: CONFIG.act1.pearlsPerLantern, // each pearl mends 1/n of a lantern (src/game_config.js)
  wind: { tail: 1.25, head: 0.72, pushTail: 22, pushHead: -60, every: [10, 15], warn: 2.2, first: 13 },
  rock: { warn: 0.95, hitW: 44 },
  bolt: { warn: 1.35, strike: 0.32, hitW: 62, from: 0.1 },
  keepsakeAt: [0.22, 0.5, 0.78],
  arriveTime: 2.4, // the harbour bell rings twice, then land ho
};

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function createBoard(seed = Date.now()) {
  return {
    seed, rand: rng(seed), t: 0, progress: 0, speed: 1, scrolled: 0,
    phase: 'sail', phaseT: 0,
    ship: { x: 330, row: 1, rowFrom: 1, rowT: 1, leapT: 0, hull: TUNING.hull, invuln: 0 },
    wind: { dir: 1, next: TUNING.wind.first, warn: 0 },
    hazards: [], pickups: [],
    spawnIn: 2.2, keepsakesSpawned: 0,
    leaves: 0,
    pearls: 0, score: 0,
    events: [],
  };
}

export const effectiveRow = (ship) => (ship.rowT < 0.5 ? ship.rowFrom : ship.row);
export const rowPos = (ship) => {
  const k = Math.min(1, ship.rowT);
  const e = k * k * (3 - 2 * k);
  return ship.rowFrom + (ship.row - ship.rowFrom) * e;
};
export const leapHeight = (ship) =>
  ship.leapT > 0 ? Math.sin(Math.PI * (1 - ship.leapT / TUNING.leapTime)) * TUNING.leapHeight : 0;

const emit = (b, type, data = {}) => b.events.push({ type, ...data });

export function step(b, dt, input) {
  dt = Math.min(dt, 0.05);
  b.t += dt; b.phaseT += dt;
  if (b.phase === 'wrecked' || b.phase === 'done') return b;

  const s = b.ship;
  const W = TUNING.wind;

  // --- Wind: the witch turns it, with a warning first.
  if (b.phase === 'sail') {
    b.wind.next -= dt;
    if (b.wind.next <= W.warn && b.wind.warn === 0) { b.wind.warn = 1; emit(b, 'windWarn', { to: -b.wind.dir }); }
    if (b.wind.next <= 0) {
      b.wind.dir *= -1; b.wind.warn = 0;
      b.wind.next = W.every[0] + b.rand() * (W.every[1] - W.every[0]);
      emit(b, 'wind', { dir: b.wind.dir });
    }
  }

  // --- Ship control.
  if (b.phase === 'sail') {
    s.x += (input.moveX || 0) * TUNING.shipSpeed * dt;
    s.x += (b.wind.dir > 0 ? W.pushTail : W.pushHead) * dt;
    if (input.rowUp && s.row > 0 && s.rowT >= 1) { s.rowFrom = s.row; s.row--; s.rowT = 0; emit(b, 'row'); }
    if (input.rowDown && s.row < 2 && s.rowT >= 1) { s.rowFrom = s.row; s.row++; s.rowT = 0; emit(b, 'row'); }
    if (input.leap && s.leapT <= 0) { s.leapT = TUNING.leapTime; emit(b, 'leap'); }
  } else {
    // Arriving: the ship glides to its mooring at centre stage.
    s.x += (560 - s.x) * Math.min(1, dt * 1.5);
  }
  s.x = Math.max(TUNING.shipMin, Math.min(TUNING.shipMax, s.x));
  if (s.rowT < 1) s.rowT = Math.min(1, s.rowT + dt / TUNING.rowTween);
  if (s.leapT > 0) s.leapT = Math.max(0, s.leapT - dt);
  if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);

  // --- Voyage progress.
  const lean = (s.x - 560) / 370; // pressing ahead gains a little
  b.speed = (b.wind.dir > 0 ? W.tail : W.head) * (1 + 0.14 * lean);
  if (b.phase === 'arrive') b.speed *= Math.max(0, 1 - b.phaseT / 2);
  const px = TUNING.scroll * b.speed * dt;
  b.scrolled += px;
  if (b.phase === 'sail') {
    b.progress = Math.min(1, b.progress + (b.speed * dt) / TUNING.duration);
    if (b.progress >= 1) {
      b.phase = 'arrive'; b.phaseT = 0;
      b.hazards = b.hazards.filter((h) => h.type === 'rock' && h.x < s.x - 80);
      b.pickups = []; // the stage is cleared for the arrival
      emit(b, 'arrive');
    }
  }

  // --- Spawning.
  if (b.phase === 'sail') {
    while (b.keepsakesSpawned < LEAVES && b.progress >= TUNING.keepsakeAt[b.keepsakesSpawned]) {
      b.keepsakesSpawned++;
      b.pickups.push({ type: 'keepsake', kind: 'leaf', row: Math.floor(b.rand() * 3), x: STAGE.right + 60, t: 0 });
    }
    b.spawnIn -= dt * b.speed;
    if (b.spawnIn <= 0) spawn(b);
  }

  // --- Hazards.
  const row = effectiveRow(s);
  const height = leapHeight(s);
  for (const h of b.hazards) {
    h.t += dt;
    if (h.type === 'rock') {
      h.x -= px;
      if (h.state === 'warn' && h.t >= TUNING.rock.warn) { h.state = 'up'; h.t = 0; emit(b, 'rockUp'); }
      if (h.state === 'up' && h.row === row && Math.abs(h.x - s.x) < TUNING.rock.hitW * ROWS[h.row].scale + 18 && height < TUNING.leapClear) {
        hurt(b, h);
      }
    } else if (h.type === 'bolt') {
      if (h.state === 'warn' && h.t >= TUNING.bolt.warn) { h.state = 'strike'; h.t = 0; emit(b, 'strike', { row: h.row }); }
      if (h.state === 'strike') {
        if (h.row === row && Math.abs(h.x - s.x) < TUNING.bolt.hitW) hurt(b, h);
        if (h.t >= TUNING.bolt.strike) h.state = 'gone';
      }
    }
  }
  b.hazards = b.hazards.filter((h) => h.state !== 'gone' && h.x > STAGE.left - 120);

  // --- Pickups.
  for (const p of b.pickups) {
    p.t += dt; p.x -= px;
    if (!p.taken && p.row === row && Math.abs(p.x - s.x) < 46 && b.phase === 'sail') {
      p.taken = true;
      if (p.type === 'pearl') {
        b.pearls++; b.score += 10;
        // A pearl mends part of a lantern (the hull may be fractional).
        const n = TUNING.pearlsPerLantern, was = s.hull;
        if (n > 0 && s.hull < TUNING.hull) s.hull = Math.min(TUNING.hull, Math.round((s.hull + 1 / n) * 1e6) / 1e6);
        emit(b, 'pearl', { hull: s.hull, mended: Math.floor(s.hull) > Math.floor(was) });
      }
      else { b.leaves++; b.score += 100; emit(b, 'keepsake', { kind: p.kind, n: b.leaves }); }
    }
  }
  b.pickups = b.pickups.filter((p) => !p.taken && p.x > STAGE.left - 80);

  // The voyage ends a moment after arrival; Act I's ending takes over then.
  if (b.phase === 'arrive' && b.phaseT >= TUNING.arriveTime) {
    b.phase = 'done';
    b.score += Math.round(s.hull * 50);
    emit(b, 'landed');
  }
  return b;
}

function hurt(b, h) {
  const s = b.ship;
  if (s.invuln > 0 || b.phase !== 'sail') return;
  s.hull--; s.invuln = TUNING.invuln;
  emit(b, 'hit', { by: h.type, hull: s.hull });
  if (s.hull <= 0) { b.phase = 'wrecked'; b.phaseT = 0; emit(b, 'wreck'); }
}

function spawn(b) {
  const r = b.rand;
  const p = b.progress;
  // Gaps tighten as the voyage goes on.
  b.spawnIn = 1.75 - 0.85 * p + r() * 0.5;
  const roll = r();
  if (p > TUNING.bolt.from && roll < 0.27) {
    // Lightning aims near where the ship is now; static on stage.
    const row = r() < 0.6 ? effectiveRow(b.ship) : Math.floor(r() * 3);
    const x = Math.max(260, Math.min(1000, b.ship.x + (r() - 0.3) * 180));
    b.hazards.push({ type: 'bolt', row, x, t: 0, state: 'warn' });
    emit(b, 'boltWarn', { row });
  } else if (roll < 0.75) {
    const row = Math.floor(r() * 3);
    const x = 760 + r() * 360;
    // Never wall off every row near the same spot.
    const near = b.hazards.filter((h) => h.type === 'rock' && Math.abs(h.x - x) < 140);
    if (near.length >= 2 || near.some((h) => h.row === row)) return;
    b.hazards.push({ type: 'rock', row, x, t: 0, state: 'warn' });
    emit(b, 'rockWarn', { row });
  } else {
    const n = 3 + Math.floor(r() * 3);
    const zig = r() < 0.4;
    let row = Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      b.pickups.push({ type: 'pearl', row, x: STAGE.right + 40 + i * 64, t: i * 0.3 });
      if (zig) row = Math.max(0, Math.min(2, row + (r() < 0.5 ? -1 : 1)));
    }
  }
}
