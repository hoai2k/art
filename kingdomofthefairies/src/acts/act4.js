// Act IV — The Whale's Road. A climb across the floating wreckage inside the
// whale, as the whole set rocks on its cradle and the whale breathes every
// four bars. Then the beaching on the pink shore. Design: design/acts.md.
// Headless: drawing is in act4-art.js.
import { clamp, lerp, easeInOut } from './shared.js';
import { FILM } from '../theme.js';
import * as art from './act4-art.js';
import { createCavern, stepCavern, cavernProgress, CAVE_SCENES } from './act4cavern.js';

export const BEAT_S = 60 / 76.5;     // fallback beat length if no beat comes in
export const W = 6300;               // the set is this wide (world units = stage px)
export const WALL = [170, W - 150];  // the sailor stays between these
export const WATER = { mean: 490, high: 320, low: 625 };
export const BREATH_BEATS = 16;      // four bars of 4/4
export const TILT = 0.055;           // radians, the cradle's main swing
export const PIVOT = { x: 640, y: 800 }; // screen point the set rocks about
export const CAM_Y_MIN = -860;
export const SAILOR = { hw: 16, h: 110 };
// Catching an edge he just missed: falling past a platform's side within
// `reach` of where he could have landed, with its top between his chest and
// just above his raised hands, he grabs it and hangs (`drop` below its top,
// feet to hands). Toward it, up or A climbs (`climb` s); he climbs on his own
// after `auto` s; away or down lets go (no re-grab for `regrab` s).
export const HANG = { reach: 34, hi: 1.2, lo: 0.5, off: 12, drop: 130, climb: 0.4, auto: 0.7, regrab: 0.35 };
export const PHYS = { g: 2000, jump: 820, cut: 2600, walk: 280, accG: 2400, accA: 1500, fall: 1100, coyote: 0.1, buffer: 0.13, slide: 2000, damp: 1.6 };
export const GRACE = 1.6;
export const HOOK_R = 18;

// The stomach floor: a ridged lining, exposed at low tide.
export const floorY = (x) => 598 + 10 * Math.sin(x * 0.013) + 6 * Math.sin(x * 0.031 + 1);

// Rib ledges (fixed, dry: no slip). One-way platforms: land from above.
export const LEDGES = [
  { id: 'bank', x0: 150, x1: 380, y: 300, kind: 'bank' },
  { id: 'L1', x0: 1260, x1: 1440, y: 200 },
  { id: 'L2', x0: 1570, x1: 1730, y: 210 },
  { id: 'L2b', x0: 1830, x1: 1930, y: 100 },  // a side climb for pearls
  { id: 'LP', x0: 1640, x1: 1760, y: -30 },
  { id: 'L2c', x0: 1800, x1: 1910, y: 300 },
  { id: 'L3', x0: 2860, x1: 3020, y: 190 },
  { id: 'L4', x0: 3130, x1: 3250, y: 270 },
  { id: 'L5', x0: 3900, x1: 4060, y: 180 },
  { id: 'L5b', x0: 4180, x1: 4300, y: 290 },
  { id: 'L5c', x0: 4840, x1: 4980, y: 210 },
  { id: 'L6', x0: 5370, x1: 5530, y: 200 },
  // the climb up the ribcage to the throat
  { id: 'T1', x0: 5610, x1: 5730, y: 80 },
  { id: 'T2', x0: 5450, x1: 5570, y: -50 },
  { id: 'T3', x0: 5650, x1: 5770, y: -180 },
  { id: 'T4', x0: 5870, x1: 5990, y: -260 },
  { id: 'T5', x0: 5730, x1: 5840, y: -390 },
  { id: 'TSa', x0: 5580, x1: 5680, y: -500 },  // the detour to the stone
  { id: 'TS', x0: 5410, x1: 5520, y: -620, stone: true },
  { id: 'lip', x0: 5930, x1: 6150, y: -470, kind: 'lip' },
];

// Floating wreckage, each riding in its own slot of the stage floor: it slides
// up to `range` either side of `home` as the set tilts. fb = freeboard (how
// far its top stands above the water).
export const FLOAT_KINDS = {
  barrel: { w: 70, fb: 55 },
  crate: { w: 90, fb: 50 },
  debris: { w: 230, fb: 35 },
  piano: { w: 170, fb: 95 },
  figurehead: { w: 50, fb: 60 },
};
export const FLOATERS = [
  { id: 'F1', kind: 'barrel', home: 470, range: 35 },
  { id: 'F2', kind: 'crate', home: 660, range: 40 },
  { id: 'F3', kind: 'debris', home: 910, range: 30 },
  { id: 'F4', kind: 'piano', home: 1175, range: 40 },
  { id: 'F5', kind: 'figurehead', home: 2080, range: 45 },
  { id: 'F6', kind: 'barrel', home: 2290, range: 40 },
  { id: 'F7', kind: 'crate', home: 2470, range: 40 },
  { id: 'F8', kind: 'debris', home: 2720, range: 40 },
  { id: 'F9', kind: 'crate', home: 3380, range: 40 },
  { id: 'F10', kind: 'piano', home: 3600, range: 45 },
  { id: 'F11', kind: 'barrel', home: 3820, range: 40 },
  { id: 'F12', kind: 'debris', home: 4470, range: 40 },
  { id: 'F13', kind: 'figurehead', home: 4740, range: 45 },
  { id: 'F14', kind: 'crate', home: 5100, range: 40 },
  { id: 'F15', kind: 'barrel', home: 5290, range: 40 },
].map((f) => ({ ...FLOAT_KINDS[f.kind], ...f }));

// Swallowed fish-hooks on lines from the dark above, swinging on the beat.
// Each sweeps `sweep` either side of `ax` at about `tipY`: across a gap, never
// over the whole of a platform, so there is always somewhere safe to stand.
const ALL_HOOKS = [
  { ax: 1515, tipY: 140, sweep: 90, phase: 0 },
  { ax: 1795, tipY: -150, sweep: 100, phase: Math.PI },
  { ax: 2380, tipY: 250, sweep: 120, phase: 1 },
  { ax: 3490, tipY: 250, sweep: 110, phase: 2.5 },
  { ax: 4615, tipY: 260, sweep: 70, phase: 0.5 },
  { ax: 5160, tipY: 240, sweep: 60, phase: 3 },
  { ax: 5570, tipY: 20, sweep: 100, phase: 2 },
  { ax: 5790, tipY: -220, sweep: 80, phase: 3.5 },
  { ax: 5890, tipY: -460, sweep: 90, phase: 1.2 },
  { ax: 5510, tipY: -560, sweep: 80, phase: 0 },
];
// The film edition hangs four of them, two of those higher, so they threaten
// a leap across a gap rather than every step of the way.
const FILM_HOOKS = [
  { ax: 2380, tipY: 140, sweep: 120, phase: 1 },
  { ax: 3490, tipY: 250, sweep: 110, phase: 2.5 },
  { ax: 4615, tipY: 150, sweep: 70, phase: 0.5 },
  { ax: 5570, tipY: 20, sweep: 100, phase: 2 },
];
export const HOOKS = (FILM ? FILM_HOOKS : ALL_HOOKS).map((h) => {
  const ay = Math.min(-1300, h.tipY - 700), len = h.tipY - ay;
  return { ...h, ay, len, amp: Math.asin(h.sweep / len), period: 4 };
});

// A pearl over every platform (at mean water for the wreckage), and a few in the gaps.
export const PEARLS = [
  ...LEDGES.filter((l) => !l.kind && !l.stone).map((l) => [(l.x0 + l.x1) / 2, l.y - 50]),
  ...FLOATERS.map((f) => [f.home, WATER.mean - f.fb - 50]),
  [1515, 80], [1700, -80], [5790, -330], [5460, -680], [6040, -530],
];
export const STONE = { x: 5465, y: -620 };
export const THROAT = { x: 6090, y: -620, enterX: 6015 };
export const LANTERN_XS = [900, 2300, 3450, 4600, 5250];

// Hand-off timing (seconds).
export const OUTRO = { throat: 1.6, iris: 1.4 };
export const MAX_REVELLERS = 8;
export function shoreTimes(n) {
  const crawl = 0.8, out = 3, gap = 0.55;
  const slide = out + n * gap + 1.4;
  return { crawl, out, gap, slide, tail: slide + 1.4, end: slide + 5 };
}

// Scenes, for checkpoints and the scene select. Each begins on a fixed ledge
// (`on`, standing at `x`) just past a lantern's stretch of the stage. The stone
// is a detour within the last scene, so no scene starts with it. (The lip by
// the throat makes no scene: the last hook reaches every spot on it.)
export const SCENES = [
  { name: 'The Belly', on: 'bank', x: 260 },
  { name: 'The Rib Ledges', on: 'L1', x: 1320 },
  { name: 'The Wreck Field', on: 'L3', x: 2940 },
  { name: 'The Far Wreckage', on: 'L5', x: 3980 },
  { name: 'The Ribcage', on: 'L6', x: 5450 },
];

// ---------------------------------------------------------------- machines
const cyc = (beat) => ((beat % BREATH_BEATS) + BREATH_BEATS) % BREATH_BEATS;

// Where in the breath the beat falls, and the stomach water's level.
export function breath(beat) {
  const b = cyc(beat), { mean: M, high: H, low: L } = WATER;
  if (b < 4) return { b, phase: 'inhale', level: M + (H - M) * easeInOut(b / 4) };
  if (b < 7) return { b, phase: 'high', level: H };
  if (b < 10) return { b, phase: 'exhale', level: H + (L - H) * easeInOut((b - 7) / 3) };
  if (b < 12) return { b, phase: 'low', level: L };
  return { b, phase: 'cue', level: L + (M - L) * easeInOut((b - 12) / 4) };
}
export const waterY = (beat) => breath(beat).level;

// The cradle's tilt: + is clockwise (the right side down, so downhill is +x).
export const tilt = (beat) => TILT * Math.sin((2 * Math.PI * beat) / 8) + 0.015 * Math.sin((2 * Math.PI * beat) / 22);

export function hookAngle(h, beat) { return h.amp * Math.sin((2 * Math.PI * beat) / h.period + h.phase); }
export function hookTip(h, beat) {
  const a = hookAngle(h, beat);
  return { x: h.ax + h.len * Math.sin(a), y: h.ay + h.len * Math.cos(a) };
}

// A floater's top surface for the current water (grounded on the floor at low tide).
function floaterTop(f, x, water) {
  const ground = floorY(x) - 22;
  return { top: Math.min(water, ground) - f.fb, grounded: water > ground };
}

export function platformOf(st, id) {
  return st.ledges.find((p) => p.id === id) || st.floaters.find((p) => p.id === id);
}
// Current extents of any platform: { x0, x1, y }.
export function extent(p) {
  return p.home != null ? { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y: p.top } : { x0: p.x0, x1: p.x1, y: p.y };
}

// World point -> stage point, through the camera and the cradle's tilt.
export function toScreen(st, x, y) {
  const sx = x - st.cam.x - PIVOT.x, sy = y - st.cam.y - PIVOT.y, a = st.tilt;
  return { x: PIVOT.x + sx * Math.cos(a) - sy * Math.sin(a), y: PIVOT.y + sx * Math.sin(a) + sy * Math.cos(a) };
}

// ---------------------------------------------------------------- module
export default {
  id: 4, key: 'whale', kicker: 'Act IV', title: FILM ? "The Whale's Passage" : "The Whale's Road", size: 120,
  sub: FILM ? "Neptune's whale carries you toward the tower.\nRide the wreckage up on its breath to the daylight in its throat."
    : 'Swallowed whole. Ride the wreckage up on the whale\'s breath\nand climb to the daylight in its throat.',
  action: 'A: leap',

  // The film edition goes on from the beach through the cavern route
  // (act4cavern.js), with its own two scenes.
  scenes: FILM ? [...SCENES, ...CAVE_SCENES] : SCENES,

  // `from` (optional): { scene } to start at a scene, or a checkpoint this act
  // made: { scene, on, x, stone, got, pearls, score, hits }.
  create({ carry = {}, from = null } = {}) {
    const st = {
      status: 'play', statusT: 0, events: [], result: null,
      phase: 'climb', phaseT: 0, t: 0, beat: 0, lastBeat: null,
      carry: { tea: carry.tea || 0, sleepers: carry.sleepers || 0 },
      revellers: Math.min(MAX_REVELLERS, Math.max(0, carry.sleepers | 0)),
      lanterns: 3, grace: 0, pearls: 0, score: 0, stone: false, hits: 0,
      ledges: LEDGES.map((l) => ({ ...l })),
      floaters: FLOATERS.map((f) => ({ ...f, x: f.home, v: 0, top: 0, prevTop: 0, grounded: false })),
      pearlsLeft: PEARLS.map(([x, y], i) => ({ i, x, y, got: false })),
      water: WATER.mean, breath: breath(0), tilt: 0, tiltV: 0,
      s: { x: 260, y: 300, vx: 0, vy: 0, face: 1, on: 'bank', onT: 0, coyote: 0, buffer: 0, safe: 'bank', walk: 0, air: false, hang: null, noGrab: 0 },
      cam: { x: 0, y: 0 },
      best: 0, scene: 0, checkpoint: null,
    };
    if (FILM && (from?.scene | 0) >= SCENES.length) {
      const c = Math.min(CAVE_SCENES.length - 1, (from.scene | 0) - SCENES.length);
      Object.assign(st, { phase: 'cavern', stone: from.stone ?? false, pearls: from.pearls ?? 0, score: from.score ?? 0, hits: from.hits ?? 0, grace: GRACE });
      st.cv = createCavern({ x: from.x ?? CAVE_SCENES[c].x, got: from.caveGot });
      st.checkpoint = { ...from, scene: SCENES.length + c };
      settle(st, 0);
      return st;
    }
    const k = Math.max(0, Math.min(SCENES.length - 1, from?.scene | 0));
    if (k > 0 || from?.on) {
      const sc = SCENES[k], on = from.on ?? sc.on, led = LEDGES.find((l) => l.id === on) || LEDGES.find((l) => l.id === sc.on);
      const x = clamp(from.x ?? sc.x, led.x0 + 15, led.x1 - 15);
      st.scene = k;
      st.stone = from.stone ?? false;
      for (const i of from.got || []) if (st.pearlsLeft[i]) st.pearlsLeft[i].got = true;
      st.pearls = from.pearls ?? 0; st.score = from.score ?? 0; st.hits = from.hits ?? 0;
      Object.assign(st.s, { x, y: led.y, on: led.id, safe: led.id, onT: 1 });
      st.best = x; st.grace = GRACE;
      st.checkpoint = { ...from, scene: k };
    }
    settle(st, 0);
    for (const f of st.floaters) f.prevTop = f.top;
    st.cam.x = clamp(st.s.x - 560, 0, W - 1280);
    st.cam.y = clamp(Math.min(st.s.y, 440) - 300, CAM_Y_MIN, 0);
    st.camInit = true;
    return st;
  },

  step(st, dt, input = {}) {
    st.statusT += dt; st.t += dt;
    st.beat = input.beat ?? st.t / BEAT_S;
    if (st.status !== 'play') { settle(st, dt); return; }
    st.phaseT += dt;
    if (st.phase !== 'cavern') beatEvents(st);
    settle(st, dt);
    if (st.phase === 'climb') climb(st, dt, input);
    else if (st.phase === 'down') { st.s.vy = Math.min(st.s.vy + 600 * dt, 200); st.s.y += st.s.vy * dt; if (st.phaseT > 1.8) setStatus(st, 'lost'); }
    else if (st.phase === 'throat') { st.s.x += 90 * dt; if (st.phaseT >= OUTRO.throat) toPhase(st, 'shore'); }
    else if (st.phase === 'shore') shore(st);
    else if (st.phase === 'cavern') cavern(st, dt, input);
    else if (st.phase === 'iris' && st.phaseT >= OUTRO.iris) win(st);
    if (st.phase !== 'cavern' && !st.cv) camera(st, dt);
  },

  hud(st) {
    if (st.phase === 'cavern') return { lanterns: st.lanterns, maxLanterns: 3, pearls: st.pearls, progress: cavernProgress(st.cv), keepsakes: [{ id: 'stone', have: st.stone }] };
    if (st.phase !== 'climb' && st.phase !== 'down') return null;
    return { lanterns: st.lanterns, maxLanterns: 3, pearls: st.pearls, progress: clamp((st.best - 260) / (THROAT.enterX - 260), 0, 1), keepsakes: [{ id: 'stone', have: st.stone }] };
  },

  announce(e) {
    if (e.type === 'hit') return `Hit. ${e.lanterns} lantern${e.lanterns === 1 ? '' : 's'} left.`;
    if (e.type === 'breathCue' && e.n === 1) return 'The whale is about to breathe in.';
    if (e.type === 'whaleInhale') return 'The whale breathes in. The water rises.';
    if (e.type === 'lowTide') return 'Low tide. The stomach floor is bare.';
    if (e.type === 'stoneFound') return FILM ? "Aurora's lamp." : 'The stone.';
    if (e.type === 'daylight') return 'Daylight in the throat.';
    if (e.type === 'caveEnter') return "Aurora points the prince to a cave in the cliff: the way to the witch's tower." + (e.lamp ? ' Her lamp lights the dark.' : '');
    if (e.type === 'dropShake') return 'A stalactite shakes loose above.';
    if (e.type === 'caveExit') return 'Out of the cavern, onto the night sea.';
    if (e.type === 'beachSurf') return FILM ? 'The whale sets you down on a rocky shore. Aurora points the way.' : 'The whale lies beached on a rocky shore.';
    return null;
  },

  focus: art.focus, draw: art.draw, drawOver: art.drawOver, onEvent: art.onEvent,
};

function setStatus(st, s) { st.status = s; st.statusT = 0; if (s === 'lost') { st.lostTitle = 'Swallowed\nWhole'; st.lostSub = 'The whale keeps what it takes.'; } }
function toPhase(st, p) {
  st.phase = p; st.phaseT = 0;
  if (p === 'throat') st.events.push({ type: 'daylight' });
  if (p === 'shore') st.events.push({ type: 'beachSurf' });
}
function win(st) {
  st.score = st.pearls * 10 + (st.stone ? 100 : 0) + st.lanterns * 50;
  st.result = { keepsakes: { stone: st.stone }, score: st.score, pearls: st.pearls };
  setStatus(st, 'won');
}

// Beat-driven cues: the breath and its four-lamp count-in, drips, the cradle creak.
function beatEvents(st) {
  const k = Math.floor(st.beat);
  if (st.lastBeat == null) { st.lastBeat = k; return; }
  if (k === st.lastBeat) return;
  st.lastBeat = k;
  const b = cyc(k);
  if (b === 0) st.events.push({ type: 'whaleInhale' });
  else if (b === 7) st.events.push({ type: 'whaleExhale' });
  else if (b === 10) st.events.push({ type: 'lowTide' });
  else if (b >= 12) st.events.push({ type: 'breathCue', n: b - 11 });
  else if (b === 5 || b === 9) st.events.push({ type: 'drip' });
  if (k % 4 === 2) st.events.push({ type: 'timberCreak' }); // the cradle at the end of each swing
}

// Water, tilt and the floaters riding in their slots.
function settle(st, dt) {
  st.breath = breath(st.beat);
  st.water = st.breath.level;
  st.tilt = tilt(st.beat);
  const s = Math.sin(st.tilt);
  for (const f of st.floaters) {
    f.prevTop = f.top;
    const prevX = f.x;
    const g = floaterTop(f, f.x, st.water);
    f.grounded = g.grounded;
    if (!f.grounded) f.v += (PHYS.slide * s - PHYS.damp * f.v) * dt;
    else f.v *= Math.max(0, 1 - 6 * dt);
    f.x += f.v * dt;
    if (f.x < f.home - f.range) { f.x = f.home - f.range; f.v = Math.max(0, f.v) * 0.2; }
    if (f.x > f.home + f.range) { f.x = f.home + f.range; f.v = Math.min(0, f.v) * 0.2; }
    f.dx = f.x - prevX;
    f.top = floaterTop(f, f.x, st.water).top;
  }
}

function climb(st, dt, input) {
  const s = st.s;
  s.landT = Math.max(0, (s.landT || 0) - dt);
  st.grace = Math.max(0, st.grace - dt);
  const mx = clamp(input.moveX || 0, -1, 1);
  s.noGrab = Math.max(0, (s.noGrab || 0) - dt);
  if (s.hang) hangOn(st, dt, input, mx);
  else {
  if (Math.abs(mx) > 0.15) s.face = Math.sign(mx);

  // Carried by the platform underfoot: he rides the wreckage as it slides and
  // never slips on it, so a safe landing stays safe until he walks off.
  let cur = s.on ? platformOf(st, s.on) : null;
  if (cur) {
    if (cur.home != null) s.x += cur.dx;
    const e = extent(cur);
    if (s.x < e.x0 - SAILOR.hw * 0.75 || s.x > e.x1 + SAILOR.hw * 0.75) { s.on = null; s.coyote = PHYS.coyote; cur = null; }
    else { s.y = e.y; s.vy = 0; s.onT += dt; }
  }
  // Walk.
  const acc = cur ? PHYS.accG : PHYS.accA, want = mx * PHYS.walk;
  s.vx += clamp(want - s.vx, -acc * dt, acc * dt);
  if (cur) s.walk += Math.abs(s.vx) * dt;
  // Leap (with a little coyote time and press buffering).
  s.buffer = input.a ? PHYS.buffer : Math.max(0, s.buffer - dt);
  s.coyote = Math.max(0, s.coyote - dt);
  if (s.buffer > 0 && (cur || s.coyote > 0)) {
    s.vy = -PHYS.jump; s.on = null; cur = null; s.coyote = 0; s.buffer = 0; s.air = true;
    st.events.push({ type: 'leap' });
  }
  // Fall and land (remembering the highest his feet reach in the air).
  if (cur) { s.peak = s.y; s.left = cur.id; }
  else s.peak = Math.min(s.peak ?? s.y, s.y);
  if (!cur) {
    const g = s.vy < 0 && !input.aHeld ? PHYS.cut : PHYS.g;
    s.vy = Math.min(PHYS.fall, s.vy + g * dt);
    const prevY = s.y;
    s.y += s.vy * dt;
    if (s.vy >= 0) {
      for (const p of [...st.ledges, ...st.floaters]) {
        const e = extent(p), prevTop = p.home != null ? p.prevTop : p.y;
        if (s.x < e.x0 - SAILOR.hw * 0.75 || s.x > e.x1 + SAILOR.hw * 0.75) continue;
        if (prevY <= prevTop + 6 && s.y >= e.y) {
          s.y = e.y; s.vy = 0; s.on = p.id; s.onT = 0; s.air = false;
          s.landT = 0.16;
          const kind = p.home != null ? p.kind : 'ledge';
          st.events.push({ type: kind === 'piano' ? 'pianoPlink' : kind === 'ledge' ? 'boneTap' : 'barrelKnock', kind });
          break;
        }
      }
      if (!s.on) tryGrab(st);
    }
  }
  if (!s.hang) s.x = clamp(s.x + s.vx * dt, WALL[0], WALL[1]);
  }
  if (s.on && s.onT > 0.25) s.safe = s.on;
  st.best = Math.max(st.best, s.x);
  // A new scene begins when the sailor stands on its ledge.
  if (s.on && s.onT > 0.25) {
    for (let k = SCENES.length - 1; k > st.scene; k--) if (s.on === SCENES[k].on) { st.scene = k; saveCheckpoint(st, k, SCENES[k].on, SCENES[k].x); break; }
  }

  // Hazards: the deep water, the bare stomach floor, the hooks.
  const fy = floorY(s.x);
  if (!s.on && !s.hang && s.y > st.water + 26 && st.water < fy - 4) {
    st.events.push({ type: 'splash', x: s.x, y: st.water });
    hurt(st, 'deep');
    if (st.phase === 'climb') respawn(st);
    return;
  }
  if (!s.on && !s.hang && s.y >= fy) {
    st.events.push({ type: 'acidSting', x: s.x, y: fy });
    hurt(st, 'floor');
    if (st.phase === 'climb') respawn(st);
    else { s.y = fy; s.vy = -500; }
    return;
  }
  for (const h of HOOKS) {
    const tip = hookTip(h, st.beat);
    const nx = clamp(tip.x, s.x - SAILOR.hw, s.x + SAILOR.hw), ny = clamp(tip.y, s.y - SAILOR.h + 8, s.y);
    if ((tip.x - nx) ** 2 + (tip.y - ny) ** 2 < HOOK_R * HOOK_R && st.grace <= 0) {
      st.events.push({ type: 'hookSnag', x: tip.x, y: tip.y });
      hurt(st, 'hook');
      s.vx = (s.x < tip.x ? -1 : 1) * 320; s.vy = -420; s.on = null; s.hang = null; s.noGrab = HANG.regrab;
      return;
    }
  }

  // Pickups.
  for (const p of st.pearlsLeft) {
    if (p.got) continue;
    if (Math.abs(p.x - s.x) < SAILOR.hw + 14 && p.y > s.y - SAILOR.h - 14 && p.y < s.y + 14) {
      p.got = true; st.pearls++; st.events.push({ type: 'pearl', x: p.x, y: p.y });
    }
  }
  if (!st.stone && Math.abs(STONE.x - s.x) < 40 && Math.abs(STONE.y - s.y) < 40) {
    st.stone = true; st.events.push({ type: 'stoneFound', x: STONE.x, y: STONE.y - 20 });
    saveCheckpoint(st, st.scene, 'TS', STONE.x); // a retry stands by the stone's ledge, stone in hand
  }
  // The throat.
  if (s.on === 'lip' && s.x >= THROAT.enterX) { s.vx = 0; toPhase(st, 'throat'); }
}

// A plain-JSON checkpoint: a fixed ledge to stand on, and what has been gathered.
function saveCheckpoint(st, scene, on, x) {
  const got = [];
  for (const p of st.pearlsLeft) if (p.got) got.push(p.i);
  st.checkpoint = { scene, on, x, stone: st.stone, got, pearls: st.pearls, score: st.score, hits: st.hits };
}

function hurt(st, why) {
  if (st.grace > 0) return;
  st.lanterns--; st.hits++; st.grace = GRACE;
  st.events.push({ type: 'hit', why, lanterns: st.lanterns });
  if (st.lanterns <= 0) { toPhase(st, 'down'); st.s.vy = -200; st.events.push({ type: 'swallowed' }); }
}

// Falling just past a platform's side: catch its edge.
function tryGrab(st) {
  const s = st.s;
  if (s.vy < 0 || s.noGrab > 0) return;
  const land = SAILOR.hw * 0.75;
  // Only an edge his feet rose above in this fall or leap (a landing he
  // missed, not something overhead he never reached), and never the one he
  // just stepped or leapt from: walking off an edge drops him.
  for (const p of [...st.ledges, ...st.floaters]) {
    if (p.kind === 'lip') continue;
    const e = extent(p);
    if (e.y < s.y - SAILOR.h * HANG.hi || e.y > s.y - SAILOR.h * HANG.lo || s.peak > e.y + 4 || p.id === s.left) continue;
    const side = s.x < e.x0 - land && s.x >= e.x0 - land - HANG.reach ? -1
      : s.x > e.x1 + land && s.x <= e.x1 + land + HANG.reach ? 1 : 0;
    if (!side) continue;
    s.hang = { id: p.id, side, t: 0, climb: -1 };
    s.vx = 0; s.vy = 0; s.air = false; s.face = -side;
    placeHanging(st);
    st.events.push({ type: 'grab', x: side < 0 ? e.x0 : e.x1, y: e.y });
    return;
  }
}
// Where a hanging (or climbing) sailor is, following the platform as it moves.
function placeHanging(st) {
  const s = st.s, h = s.hang, e = extent(platformOf(st, h.id));
  const edge = h.side < 0 ? e.x0 : e.x1;
  const hx = edge + h.side * HANG.off, hy = e.y + HANG.drop;
  if (h.climb < 0) { s.x = hx; s.y = hy; return; }
  const k = Math.min(1, h.climb / HANG.climb), up = Math.min(1, k / 0.7), over = Math.max(0, (k - 0.5) / 0.5);
  s.x = lerp(hx, edge - h.side * (SAILOR.hw + 6), over * over * (3 - 2 * over));
  s.y = lerp(hy, e.y, up * (2 - up));
}
function hangOn(st, dt, input, mx) {
  const s = st.s, h = s.hang;
  h.t += dt;
  if (h.climb >= 0) {
    h.climb += dt;
    placeHanging(st);
    if (h.climb >= HANG.climb) {
      s.on = h.id; s.onT = 0; s.vx = 0; s.vy = 0; s.hang = null; s.coyote = 0;
      st.events.push({ type: 'climbUp', x: s.x, y: s.y });
    }
    return;
  }
  placeHanging(st);
  const toward = mx * h.side < -0.15, away = mx * h.side > 0.5;
  if (input.down || away) { // let go
    s.hang = null; s.vy = 0; s.vx = h.side * 60; s.noGrab = HANG.regrab; s.air = true;
    return;
  }
  if (h.t > 0.12 && (toward || input.up || input.a || h.t >= HANG.auto)) { h.climb = 0; st.events.push({ type: 'pullUp' }); }
}

function respawn(st) {
  const s = st.s, p = platformOf(st, s.safe) || platformOf(st, 'bank'), e = extent(p);
  s.hang = null;
  s.x = (e.x0 + e.x1) / 2; s.y = e.y; s.vx = 0; s.vy = 0; s.on = p.id; s.onT = 0; s.air = false;
  st.events.push({ type: 'respawn', x: s.x, y: s.y });
}

function camera(st, dt) {
  const s = st.s, k = Math.min(1, dt * 5);
  const tx = clamp(s.x - 560, 0, W - 1280);
  const ty = clamp(Math.min(s.y, 440) - 300, CAM_Y_MIN, 0);
  if (st.camInit) { st.cam.x += (tx - st.cam.x) * k; st.cam.y += (ty - st.cam.y) * Math.min(1, dt * 3); }
  else { st.cam.x = tx; st.cam.y = ty; st.camInit = true; }
}

// The beached whale: cues for the crawl-out, the revellers, the slide and the tail.
// The cavern route (film edition): Act IV's lanterns and pearls carry on.
function cavern(st, dt, input) {
  st.grace = Math.max(0, st.grace - dt);
  const out = stepCavern(st.cv, dt, input, {
    hit: (why) => {
      if (st.grace > 0) return;
      st.lanterns--; st.hits++; st.grace = GRACE;
      st.events.push({ type: 'hit', why, lanterns: st.lanterns });
      if (st.lanterns <= 0) { setStatus(st, 'lost'); st.lostTitle = 'Lost in\nthe Dark'; st.lostSub = 'The cavern keeps the way to the tower.'; }
    },
    pearl: () => { st.pearls++; st.score += 10; },
    events: st.events, graceLeft: () => st.grace,
  });
  // the second checkpoint, past the widest pool
  if (st.checkpoint?.scene !== SCENES.length + 1 && st.cv.s.on && st.cv.s.x >= CAVE_SCENES[1].x && st.cv.s.x < CAVE_SCENES[1].x + 300) {
    st.checkpoint = { scene: SCENES.length + 1, x: CAVE_SCENES[1].x, stone: st.stone, pearls: st.pearls, score: st.score, hits: st.hits, caveGot: st.cv.pearls.filter((p) => p.got).map((p) => p.i) };
  }
  if (out === 'exit') st.exitT = 0;
  if (st.cv.done && st.cv.doneT >= 1.2) toPhase(st, 'iris');
}

function shore(st) {
  const T = shoreTimes(st.revellers), pt = st.phaseT;
  const cue = (name, at, extra) => { st.cues ??= {}; if (pt >= at && !st.cues[name]) { st.cues[name] = true; st.events.push({ type: extra?.type || name, ...extra }); } };
  cue('crawlOut', T.crawl);
  for (let i = 0; i < st.revellers; i++) cue('rev' + i, T.out + i * T.gap, { type: 'revellerOut', n: i + 1 });
  cue('whaleSlide', T.slide);
  cue('tailSplash', T.tail + 1.4);
  if (pt >= T.end) {
    if (!FILM) return toPhase(st, 'iris');
    // On through the cave Aurora points to.
    st.cv = createCavern();
    st.checkpoint = { scene: SCENES.length, stone: st.stone, pearls: st.pearls, score: st.score, hits: st.hits };
    toPhase(st, 'cavern');
    st.events.push({ type: 'caveEnter', lamp: st.stone });
  }
}
