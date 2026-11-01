// Act IV, part two (film edition only): the cavern route. On the beach Aurora
// points the prince to a cave in the cliff; through it lies the way to the
// witch's tower (tableaux 23-24 of the film; design/film-adaptation.md).
// A side-on run through the dark: rock floors broken by black pools, cavern
// ledges to leap between, and stalactites that shake loose as he passes
// beneath. He sees only by his own light, or much further by Aurora's lamp
// if he found it in the whale. Act IV owns the state (st.cv) and the
// lanterns; this file is its rules, cavern-art.js its drawing. Headless.
import { clamp } from './shared.js';

export const CW = 4300;                 // the cavern is this wide (world units = stage px)
export const EXIT_X = 4140;             // walking into the far opening ends it
export const POOL_Y = 610;              // below this he has fallen into a pool
export const WATER_Y = 562;             // the pools' surface, drawn
export const CEIL_Y = -20;              // ceiling roots extend beyond the top of the stage
export const PHYS = { g: 2000, jump: 820, cut: 2600, walk: 280, accG: 2400, accA: 1500, fall: 1100, coyote: 0.1, buffer: 0.13 };
export const BODY = { hw: 16, h: 110 };
export const LIGHT = { own: 360, lamp: 540 };   // how far he sees, stage px
export const GRACE = 1.6;
// A stalactite shakes for `shake` s once he comes within `near` px of it
// (from either side, ahead of him more), then falls; it strikes within
// `hw` px of its tip.
// Keep the hanging tips at y 210 while the larger painted roots reach the
// top of the scene; the fall warning and time to ground stay the same.
export const DROP = { near: 150, behind: 30, shake: 0.75, g: 1800, hw: 24, len: 230 };

// Walkable rock: floors along the bottom (one-way ledges above the pools).
export const FLOORS = [
  { x0: -40, x1: 560, y: 520 },
  { x0: 720, x1: 1080, y: 520 },
  { x0: 1300, x1: 1500, y: 520 },
  { x0: 1900, x1: 2300, y: 490 },
  { x0: 2520, x1: 2700, y: 510 },
  { x0: 3000, x1: 3400, y: 520 },
  { x0: 3560, x1: CW + 40, y: 520 },
];
export const LEDGES = [
  { id: 'L1', x0: 1140, x1: 1250, y: 450 },
  { id: 'L2', x0: 1560, x1: 1720, y: 440 },
  { id: 'L3', x0: 1780, x1: 1880, y: 390 },
  { id: 'L4', x0: 2360, x1: 2470, y: 440 },
  { id: 'L5', x0: 2760, x1: 2870, y: 420 },
  { id: 'L6', x0: 2900, x1: 2990, y: 460 },
  { id: 'L7', x0: 2700, x1: 2800, y: 270 },   // a high shelf of pearls
];
export const STALACTITES = [850, 1360, 1620, 2050, 2210, 2600, 3150, 3310, 3700, 3900].map((x, i) => ({ i, x }));
export const PEARLS = [
  ...LEDGES.map((l) => [(l.x0 + l.x1) / 2, l.y - 50]),
  [640, 420], [2100, 390], [2750, 210], [3200, 420], [3480, 390], [3800, 420],
];
// Checkpoints: the cave mouth, and the far side of the widest pool.
export const CAVE_SCENES = [{ name: 'The Cave Mouth', x: 140 }, { name: 'The Dark Pools', x: 1980 }];

export const surfaces = () => [...FLOORS.map((f, i) => ({ id: 'F' + i, ...f })), ...LEDGES];

export function createCavern(from = {}) {
  const x = from.x ?? CAVE_SCENES[0].x, on = surfaceUnder(x, 9999);
  return {
    t: 0, done: false, doneT: 0, best: x,
    s: { x, y: on ? on.y : 520, vx: 0, vy: 0, face: 1, on: on?.id ?? null, coyote: 0, buffer: 0, walk: 0, landT: 0, safe: { x, y: on ? on.y : 520 } },
    drops: STALACTITES.map((d) => ({ ...d, state: 'hang', t: 0, y: CEIL_Y })),
    pearls: PEARLS.map(([px, py], i) => ({ i, x: px, y: py, got: from.got?.includes(i) ?? false })),
  };
}

// The highest surface top at or below y under x (for landing and spawning).
function surfaceUnder(x, y) {
  let best = null;
  for (const p of surfaces()) if (x >= p.x0 && x <= p.x1 && p.y <= y && (!best || p.y < best.y)) best = p;
  return best;
}

// One frame. `hit(cause)` costs a lantern (Act IV's), `pearl()` scores one.
// Returns 'exit' when he walks out into the night.
export function stepCavern(cv, dt, input, { hit, pearl, events, graceLeft }) {
  cv.t += dt;
  const s = cv.s;
  if (cv.done) { cv.doneT += dt; s.x += 110 * dt; s.walk += 110 * dt; return; }
  s.landT = Math.max(0, s.landT - dt);
  const mx = clamp(input.moveX || 0, -1, 1);
  if (Math.abs(mx) > 0.15) s.face = Math.sign(mx);
  let cur = s.on ? surfaces().find((p) => p.id === s.on) : null;
  if (cur && (s.x < cur.x0 - BODY.hw * 0.75 || s.x > cur.x1 + BODY.hw * 0.75)) { cur = null; s.on = null; s.coyote = PHYS.coyote; }
  const acc = cur ? PHYS.accG : PHYS.accA;
  s.vx += clamp(mx * PHYS.walk - s.vx, -acc * dt, acc * dt);
  if (cur) s.walk += Math.abs(s.vx) * dt;
  s.buffer = input.a ? PHYS.buffer : Math.max(0, s.buffer - dt);
  s.coyote = Math.max(0, s.coyote - dt);
  if (s.buffer > 0 && (cur || s.coyote > 0)) {
    s.vy = -PHYS.jump; s.on = null; cur = null; s.coyote = 0; s.buffer = 0;
    events.push({ type: 'leap' });
  }
  if (!cur) {
    // a short hop when A is let go early
    s.vy = Math.min(PHYS.fall, s.vy + (PHYS.g + (s.vy < 0 && !input.aHeld ? PHYS.cut : 0)) * dt);
    const y0 = s.y;
    s.y += s.vy * dt;
    if (s.vy >= 0) {
      const land = surfaces().find((p) => s.x >= p.x0 - BODY.hw * 0.75 && s.x <= p.x1 + BODY.hw * 0.75 && y0 <= p.y + 1 && s.y >= p.y);
      if (land) {
        s.y = land.y; s.vy = 0; s.on = land.id; s.landT = 0.12;
        s.safe = { x: clamp(s.x, land.x0 + 20, land.x1 - 20), y: land.y };
      }
    }
  } else { s.y = cur.y; s.vy = 0; }
  s.x = clamp(s.x + s.vx * dt, 20, CW);
  cv.best = Math.max(cv.best, s.x);

  // Into a pool: a lantern, and back on the last firm rock.
  if (s.y > POOL_Y) {
    events.push({ type: 'poolSplash', x: s.x, y: WATER_Y });
    hit('pool');
    Object.assign(s, { x: s.safe.x, y: s.safe.y, vx: 0, vy: 0, on: surfaceUnder(s.safe.x, s.safe.y + 1)?.id ?? null });
  }

  // Stalactites: a shiver as he comes near, then the fall.
  for (const d of cv.drops) {
    if (d.state === 'hang' && s.x > d.x - DROP.near && s.x < d.x + DROP.behind) { d.state = 'shake'; d.t = 0; events.push({ type: 'dropShake', x: d.x }); }
    else if (d.state === 'shake' && (d.t += dt) >= DROP.shake) { d.state = 'fall'; d.t = 0; d.vy = 0; }
    else if (d.state === 'fall') {
      d.vy += DROP.g * dt; d.y += d.vy * dt;
      const tip = d.y + DROP.len, floor = surfaceUnder(d.x, 9999);
      if (graceLeft() <= 0 && Math.abs(s.x - d.x) < DROP.hw + BODY.hw && tip > s.y - BODY.h && d.y < s.y) { hit('stalactite'); d.state = 'broken'; d.landY = floor?.y ?? null; events.push({ type: 'dropShatter', x: d.x, y: s.y - 40 }); }
      else if (floor && tip >= floor.y) { d.state = 'broken'; d.landY = floor.y; events.push({ type: 'dropShatter', x: d.x, y: floor.y }); }
      else if (tip > POOL_Y + 40) { d.state = 'broken'; d.landY = null; events.push({ type: 'poolSplash', x: d.x, y: WATER_Y }); }
    }
  }

  for (const p of cv.pearls) if (!p.got && Math.abs(p.x - s.x) < 34 && p.y > s.y - BODY.h - 20 && p.y < s.y + 10) { p.got = true; pearl(); events.push({ type: 'pearl', x: p.x, y: p.y }); }

  if (s.x >= EXIT_X && s.on) { cv.done = true; cv.doneT = 0; events.push({ type: 'caveExit' }); return 'exit'; }
}

export const cavernProgress = (cv) => clamp((cv.best - CAVE_SCENES[0].x) / (EXIT_X - CAVE_SCENES[0].x), 0, 1);
export const camX = (cv) => clamp(cv.s.x - 480, 0, CW - 1280);
