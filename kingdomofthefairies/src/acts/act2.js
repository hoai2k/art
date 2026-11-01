// Act II — The Sleepers' Grotto. The sailor wakes on the sea floor, swims
// down through the grotto on a flying harness after the sinking guitar,
// wakes the drowned revellers, and is offered the sea rose at the cave floor.
// Then the moon-boat interlude carries him on to the Sea King's court.
// Headless: drawing is in act2-art.js. Design: design/acts.md, Act II.
import { clamp, lerp } from './shared.js';
import { FILM, words } from '../theme.js';
import * as art from './act2-art.js';

// ---------------------------------------------------------------- tuning
export const BEAT_LEN = 60 / 76.5;      // seconds per beat (for omens and fallbacks)
export const WORLD_H = 4200;            // the descent, in stage pixels
export const VIEW_H = 590;              // playfield height (y 60..650)
export const CAM_MAX = WORLD_H - VIEW_H;
export const FLOOR = 4150;              // the cave floor
export const SHELF_Y = 470;             // the wreck shelf where the act opens
export const BOUNDS = { x0: 215, x1: 1065, y0: 90 };
export const REST = { x: 640, y: 4100 }; // where the guitar comes to rest

export const TUNE = {
  accel: 640, drag: 2.4, max: 220, drift: 22,
  kick: 340, kickCD: 0.85,
  air: 42,           // seconds of air from full
  airRefill: 0.55,   // per second in a vent's bubbles
  airAfterOut: 0.4,  // what is left after running out costs a lantern
  ventH: 300, ventW: 52,
  horn: 14,          // seconds a conch's song lasts
  wakeR: 150,        // how close you must swim to wake a sleeper
  grace: 1.6,
  clamPearls: 2,     // pearls per clam: its own, then one regrown; then it stays shut and grey
  clamRest: 6,       // s a clam stays shut after its first pearl is taken
  clamGrow: 2.4,     // s of being open (about three openings) to regrow a pearl
  eelReach: 300, eelGlow: 1.0, eelCD: 2.6,
  guitarLead: 110,   // he can never get closer than this above the guitar
};
// The film edition's dive: the sword sinks quicker (so it rarely holds him
// up), and X takes what is within reach: an open clam's pearl or a sleeper.
// sink: the sword's pace (px/s) by how far behind he is; three-quarters of
// what it was, so it falls slower, as play-testing asked (31 Oct 2026)
export const FILM_DIVE = { lead: 80, sink: [22.5, 60, 112.5, 172.5], reach: 110, wakeR: 170 };

// Cues in the take: the rose leaves her hand, reaches him, the sleepers rise.
export const ROSE_CUES = { fly: 0.7, arrive: 1.5, wake: 1.6 };
// Where the Water Fairy stands (film edition): he swims to her for her blessing.
export const FAIRY_AT = { x: 1000, y: 4150 - 320 };
export const PHASE_LEN = { open: 6.4, choice: 4.4, ride: 20, iris: 1.4, drown: 2.0 };

// ---------------------------------------------------------------- the set
// Every position is in world pixels: x on the stage, y down the descent.
const REVELLERS = ['reveller-yellow', 'reveller-shaggy', 'reveller-jester', 'reveller-lady'];
export const SLEEPERS = [
  // the revellers lying on the wreck shelf beside the sailor
  [300, 462], [440, 462], [830, 462], [985, 462],
  // on ledges down the grotto
  [290, 1600], [880, 1840], [960, 2650], [330, 2900], [870, 3090],
  // on the cave floor (for the guitar)
  [300, 4140], [455, 4140], [830, 4140],
];
export const CONCHES = [[700, 466], [420, 1470], [840, 2480]];
export const VENTS = [[330, 980], [950, 1780], [330, 2590], [935, 3340]];
// x, ledge top y, opens one beat in every `every`, on beats ≡ off
export const CLAMS = [
  [905, 840, 2, 0], [330, 1210, 2, 1], [640, 1660, 2, 0], [940, 2080, 3, 1],
  [300, 2420, 3, 2], [860, 2860, 3, 0], [380, 3260, 3, 1], [900, 3720, 2, 1],
];
// hole x at the wall edge, y, side (+1 lunges right from the left wall)
export const EELS = [
  [215, 1320, 1], [1065, 1960, -1], [215, 2250, 1], [1065, 2720, -1], [215, 3130, 1], [1065, 3560, -1],
];
// centre x, y, swing x, bob y, speed, phase
export const JELLIES = [
  [560, 1020, 110, 25, 0.5, 0], [760, 1520, 150, 30, 0.45, 1.5], [480, 2150, 170, 30, 0.55, 3],
  [700, 2560, 190, 35, 0.4, 0.7], [560, 3000, 160, 30, 0.5, 2.2], [700, 3800, 200, 25, 0.35, 4],
];
export const DRAGON = { cx: 640, cy: 3460, ax: 320, ay: 200, period: 16 };
// The guitar's line down: [y, x] waypoints.
const GUITAR_PATH = [[0, 880], [700, 760], [1300, 640], [1700, 520], [2100, 720], [2500, 560], [2900, 640], [3300, 640], [3700, 560], [4100, 640]];

// Scenes, for checkpoints and the scene select. Scenes 1-3 begin in the
// bubbles of a vent partway down; `y` is where the sailor starts.
export const SCENES = [
  { name: 'The Wreck' },
  { name: 'Into the Grotto', vent: 0 },
  { name: 'The Deep Caves', vent: 2 },
  { name: "The Dragon's Floor", vent: 3 },
  { name: "The Witch's Offer" },
  { name: 'The Moon-Boat Ride' },
];
// The descent scene a depth belongs to (0..3), by vent boundaries.
const SCENE_Y = [0, 800, 2400, 3150]; // just above each scene's vent spot
export const sceneAt = (y) => SCENE_Y.reduce((k, y0, i) => (y >= y0 ? i : k), 0);
// Where the sailor stands in a vent's bubbles.
const ventSpot = (i) => ({ x: VENTS[i][0], y: VENTS[i][1] - 120 });

// The hazard clock for a resume at (x, y): the one that keeps the dragon and
// the jellyfish furthest from that spot for the first eight seconds, so a
// retry never starts in the dragon's path.
function safeClock(x, y) {
  let best = 3, bestD = -1;
  for (let c = 0; c < DRAGON.period; c += 0.25) {
    let d = Infinity;
    for (let tau = 0; tau <= 8; tau += 0.25) {
      const p = dragonPos(c + tau); d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      for (const j of JELLIES) { const q = jellyPos({ cx: j[0], cy: j[1], ax: j[2], ay: j[3], w: j[4], p: j[5] }, c + tau); d = Math.min(d, Math.hypot(q.x - x, q.y - y)); }
    }
    if (d > bestD) { bestD = d; best = c; }
  }
  return best;
}

// The moon-boat ride plays like Act I's voyage: sail forward and back within
// the stage, change row, leap. Some pearls float high and need a leap.
export const RIDE = { boatX: 470, speed: 300, pearls: 16, minX: 210, maxX: 930, sail: 280,
  leapTime: 0.78, leapHeight: 96, highAt: 44,
  // how far from the carriage's centre a pearl is caught: the bow alone, or
  // (film) anywhere along the dolphin carriage, drawn 234 px wide
  catchX: FILM ? 130 : 55 };

// ---------------------------------------------------------------- helpers
export const clamOpen = (cl, beat) => Math.floor(beat) % cl.every === cl.off;
export const clamSpent = (cl) => cl.got >= TUNE.clamPearls;
// Open now: on its beat, unless spent or resting (but a clam just emptied
// stays open to the end of that beat rather than snapping on him).
export const clamIsOpen = (cl, beat) => clamOpen(cl, beat) && (cl.lastBeat === Math.floor(beat) || (!clamSpent(cl) && cl.rest <= 0));
// Its pearl can be taken: the first, or a regrown one at full size.
export const clamRipe = (cl) => !clamSpent(cl) && (cl.got === 0 || cl.grow >= 1);
export function jellyPos(j, time) {
  return { x: j.cx + j.ax * Math.sin(time * j.w + j.p), y: j.cy + j.ay * Math.sin(time * j.w * 1.7 + j.p) };
}
export function dragonPos(time) {
  const a = (time / DRAGON.period) * Math.PI * 2;
  return { x: DRAGON.cx + DRAGON.ax * Math.sin(a), y: DRAGON.cy + DRAGON.ay * Math.sin(2 * a), face: Math.cos(a) >= 0 ? 1 : -1 };
}
export function guitarX(y) {
  for (let i = 1; i < GUITAR_PATH.length; i++) {
    const [y1, x1] = GUITAR_PATH[i];
    if (y <= y1) { const [y0, x0] = GUITAR_PATH[i - 1]; return lerp(x0, x1, clamp((y - y0) / (y1 - y0), 0, 1)); }
  }
  return GUITAR_PATH[GUITAR_PATH.length - 1][1];
}
// The eel's reach (0..1) for its state.
export function eelExt(e) {
  if (e.state === 'lunge') return clamp(e.t / 0.22, 0, 1);
  if (e.state === 'hold') return 1;
  if (e.state === 'back') return 1 - clamp(e.t / 0.5, 0, 1);
  return 0;
}
// Ride pearls: when each enters (s) and on which row.
function ridePearls() {
  const rows = [1, 1, 0, 0, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0, 0, 1];
  // pearls to leap for float only above the top row (film), where they read
  // clearly against the open water
  const high = new Set(FILM ? [3, 8, 13] : [4, 9, 13]);
  return rows.map((row, i) => ({ at: 1.6 + i * 1.05, row, high: high.has(i), got: false }));
}
const newRide = () => ({ x: RIDE.boatX, row: 1, from: 1, rowT: 1, leapT: 0, pearls: ridePearls() });
export const rideLeapH = (r) => (r.leapT > 0 ? Math.sin(Math.PI * (1 - r.leapT / RIDE.leapTime)) * RIDE.leapHeight : 0);
export const rideRowPos = (r) => (r.rowT >= 1 ? r.row : lerp(r.from, r.row, r.rowT));
export const rideEffRow = (r) => (r.rowT > 0.5 ? r.row : r.from);
export const ridePearlX = (p, rideT) => 1250 - (rideT - p.at) * RIDE.speed;

// ---------------------------------------------------------------- module
export default {
  id: 2, key: 'grotto', kicker: 'Act II', title: FILM ? 'The Water Fairy' : "The Sleepers' Grotto", size: 110,
  sub: FILM ? 'Follow the sinking sword down.\nX takes a pearl from an open clam, or wakes a sleeping crewman.'
    : words('Follow the sinking guitar down.\nSound the conch horns to wake the drowned.'),
  // The film edition: the Water Fairy in the witch's place, and the marine
  // procession's dolphin carriage for the moon boat.
  cast: FILM ? { 'witch-stand': 'water-fairy-stand', 'witch-moonboat': 'dolphin-carriage' } : undefined,
  action: 'A: kick',
  scenes: SCENES,

  // `from` (optional): { scene } to start at a scene, plus the fields of a
  // checkpoint this act made (see `snapshot`).
  create({ carry = {}, from = null } = {}) {
    const st = {
      status: 'play', statusT: 0, events: [], result: null,
      phase: 'open', phaseT: 0, t: 0, hzT: 0, beat: 0,
      tea: (carry.tea || 0) >= 3,
      sailor: { x: 570, y: 425, vx: 0, vy: 0, face: 1, kickCD: 0, kickT: 0, stroke: 0, strokeT: 0, grace: 0, wake: 0 },
      cam: 0, air: 1, airLowed: false, inVent: false,
      lanterns: 3, pearls: 0, score: 0, woken: 0,
      hornT: 0,
      guitar: { x: 880, y: -140, settled: false, held: false },
      sleepers: SLEEPERS.map(([x, y], i) => ({ x, y, id: REVELLERS[i % 4], kind: i % 4, floor: y > FLOOR - 100, state: 'asleep', t: 0 })),
      conches: CONCHES.map(([x, y]) => ({ x, y, used: false })),
      clams: CLAMS.map(([x, y, every, off]) => ({ x, y, every, off, got: 0, lastBeat: null, wasOpen: false, rest: 0, grow: 0 })),
      eels: EELS.map(([x, y, side]) => ({ x, y, side, state: 'idle', t: 0, cd: 0 })),
      jellies: JELLIES.map(([cx, cy, ax, ay, w, p]) => ({ cx, cy, ax, ay, w, p })),
      vents: VENTS.map(([x, y]) => ({ x, y })),
      omens: [],
      offer: null, rose: false, choice: null, roseRisers: 0,
      ride: null, lastSnap: null, checkpoint: null,
    };
    const k = Math.max(0, Math.min(SCENES.length - 1, from?.scene | 0));
    if (k <= 0) return st;
    // Progress: a checkpoint's data, or nothing (zero score and pearls).
    st.score = from.score ?? 0; st.pearls = from.pearls ?? 0; st.woken = from.woken ?? 0;
    (from.sleepers || []).forEach((i) => { const sl = st.sleepers[i]; if (sl) { sl.state = 'rising'; sl.t = 6; } });
    (from.conches || []).forEach((i) => { if (st.conches[i]) st.conches[i].used = true; });
    (from.clams || []).forEach((n, i) => { if (st.clams[i]) st.clams[i].got = n; });
    (from.clamGrow || []).forEach((g, i) => { if (st.clams[i]) st.clams[i].grow = g; });
    st.phase = 'swim'; st.phaseT = 0; st.hzT = 3; st.air = 1; st.lanterns = 3;
    const s = st.sailor, g = st.guitar;
    s.wake = 1; s.grace = TUNE.grace; // a moment to settle in; hazards start afresh
    if (k <= 3) {
      const v = ventSpot(SCENES[k].vent);
      s.x = from.x ?? v.x; s.y = from.y ?? v.y;
      g.y = Math.min(REST.y, Math.max(from.gy ?? 0, s.y + 160), s.y + 700); g.x = guitarX(g.y);
      st.cam = clamp(s.y - 230, 0, CAM_MAX);
      st.inVent = ventAt(st);
      st.hzT = safeClock(s.x, s.y);
    } else {
      s.x = from.x ?? REST.x; s.y = from.y ?? REST.y - 40;
      g.x = REST.x; g.y = REST.y; g.settled = true; g.held = true;
      st.cam = CAM_MAX;
      st.hornT = 0;
      if (k === 4) { st.phase = 'offer'; st.offer = { said: false }; }
      else {
        st.choice = from.choice ?? 'refuse'; st.rose = st.choice === 'take';
        if (st.rose) { st.massWoken = true; for (const sl of st.sleepers) if (sl.state === 'asleep') { sl.state = 'rising'; sl.t = 6; st.woken++; } }
        st.phase = 'ride'; st.ride = newRide();
        st.events.push({ type: 'rideStart' });
      }
    }
    st.checkpoint = { ...from, scene: k };
    return st;
  },

  step(st, dt, input = {}) {
    st.statusT += dt; st.t += dt;
    st.beat = input.beat ?? st.t / BEAT_LEN;
    if (st.status !== 'play') return;
    st.phaseT += dt;
    for (const sl of st.sleepers) if (sl.state === 'rising') sl.t += dt;
    if (st.phase === 'open') return stepOpen(st);
    if (st.phase === 'swim' || st.phase === 'offer') return stepSwim(st, dt, input);
    if (st.phase === 'choice') return stepChoice(st, dt, input);
    if (st.phase === 'ride') return stepRide(st, dt, input);
    if (st.phase === 'iris') { if (st.phaseT >= PHASE_LEN.iris) win(st); return; }
    if (st.phase === 'drown') {
      st.sailor.y += 30 * dt;
      if (st.phaseT >= PHASE_LEN.drown) { st.status = 'lost'; st.statusT = 0; }
    }
  },

  // touch shows its B button for X in the film's dive, and for refusing
  needB: (st) => (FILM ? st.phase === 'swim' : st.phase === 'offer'),
  // on touch in the dive, a tap anywhere wakes or takes (no button for it),
  // and a tap on a sleeper or a clam swims him to it (tapAim)
  touchTap: (st) => (FILM && st.phase === 'swim' ? 'x' : null),

  hud(st) {
    if (st.phase === 'open' || st.phase === 'iris' || st.phase === 'drown') return null;
    const keepsakes = [{ id: 'guitar', have: st.guitar.held }, { id: 'rose', have: st.rose }];
    const progress = st.phase === 'ride' ? clamp(st.phaseT / PHASE_LEN.ride, 0, 1)
      : st.phase === 'swim' ? clamp((st.sailor.y - SHELF_Y) / (REST.y - SHELF_Y), 0, 1) : null;
    return { lanterns: st.lanterns, maxLanterns: 3, pearls: st.pearls, progress, keepsakes };
  },

  announce(e) {
    if (FILM) {
      const film = {
        sailorWake: 'The Water Fairy breathes life into the prince. He wakes among his drowned crew.',
        swimStart: 'Swim down after the sword. Press A to kick. Press X beside an open clam to take its pearl, or beside a sleeping crewman to wake him.',
        conchBlow: 'The conch sings. Swim close to your crew to wake them.',
        guitarCatch: 'You catch the enchanted sword.',
        witchOffer: 'The Water Fairy waits by the wreck. Swim to her for her blessing.',
        roseTake: 'Her blessing revives the rest of your crew.',
        rideStart: 'The marine procession. Sail, change row and leap to gather the pearls.',
        drown: 'The prince sinks.',
      }[e.type];
      if (film) return film;
      if (e.type === 'sleeperWake') return `A crewman wakes. ${e.n} woken.`;
    }
    switch (e.type) {
      case 'sailorWake': return 'The witch breathes life into the sailor. He wakes among the drowned.';
      case 'swimStart': return words('Swim down after the guitar. Press A to kick. Sound the conch to wake the sleepers.');
      case 'conchBlow': return 'The conch sings. Swim close to the sleepers to wake them.';
      case 'sleeperWake': return `A sleeper wakes. ${e.n} woken.`;
      case 'hit': return `Hit. ${e.lanterns} lantern${e.lanterns === 1 ? '' : 's'} left.`;
      case 'airLow': return 'Air running low. Find a vent.';
      case 'eelGlow': return 'Eyes glow in a hole.';
      case 'guitarCatch': return words('You catch the guitar.');
      case 'witchOffer': return 'The witch offers the sea rose. A to take it, B to refuse.';
      case 'roseTake': return 'You take the sea rose. Every sleeper wakes.';
      case 'witchLaugh': return 'You refuse the rose. The witch laughs.';
      case 'rideStart': return 'The moon boat. Sail, change row and leap to gather the pearls.';
      case 'drown': return 'The sailor sinks.';
      default: return null;
    }
  },

  focus: art.focus, draw: art.draw, drawOver: art.drawOver, onEvent: art.onEvent,
};

// ---------------------------------------------------------------- opening
function stepOpen(st) {
  const pt = st.phaseT, s = st.sailor;
  st.guitar.y = lerp(-140, 560, clamp(pt / 5.2, 0, 1));
  st.guitar.x = guitarX(st.guitar.y);
  once(st, 'oDragon', pt >= 0.6, { type: 'dragonPass' });
  once(st, 'oBreath', pt >= 3.6, { type: 'witchBreath' });
  once(st, 'oWake', pt >= 4.9, { type: 'sailorWake' });
  s.wake = clamp((pt - 4.9) / 0.9, 0, 1);
  if (pt >= PHASE_LEN.open) { setPhase(st, 'swim'); st.events.push({ type: 'swimStart' }); }
}

// ---------------------------------------------------------------- taps (touch)
// A tap on the dive (stage coordinates): on a sleeping crewman or a clam, he
// swims to it (the target) and wakes him or takes its pearl there; anywhere
// else, or already in reach, the tap is just the action (input.x).
function tapAim(st, tap) {
  const wx = tap.x, wy = tap.y + st.cam - 60;   // stage to world (sy, act2-art.js)
  const sl = st.sleepers.find((q) => q.state === 'asleep' && Math.abs(wx - q.x) < 90 && wy > q.y - 80 && wy < q.y + 25);
  const cl = !sl && st.clams.find((q) => !clamSpent(q) && Math.abs(wx - q.x) < 70 && wy > q.y - 120 && wy < q.y + 10);
  const ref = sl || cl;
  if (ref) { st.tapTarget = { ref, kind: sl ? 'sleeper' : 'clam', t: 0 }; st.events.push({ type: 'tapMark', x: ref.x, y: ref.y - 40 }); }
}
function tapTargetAt(tt) {
  const r = tt.ref;
  return tt.kind === 'sleeper' ? (r.state === 'asleep' ? { x: r.x, y: r.y - 50 } : null) : { x: r.x, y: r.y - 48 - 70 };
}

// ---------------------------------------------------------------- the descent
function stepSwim(st, dt, input) {
  const s = st.sailor, g = st.guitar, offering = st.phase === 'offer';
  st.hzT += dt;
  s.grace = Math.max(0, s.grace - dt);
  s.kickCD = Math.max(0, s.kickCD - dt);
  s.kickT = Math.max(0, s.kickT - dt);

  // A tap on the screen (touch): on a sleeper or a clam, he swims to it and
  // acts there; the stick takes over again as soon as it is used.
  if (FILM && !offering && input.tapAt) tapAim(st, input.tapAt);
  if (Math.hypot(input.moveX || 0, input.moveY || 0) > 0.15) st.tapTarget = null;
  // Swim: the stick pushes, the water drags, he drifts slowly down.
  let mx = input.moveX || 0, my = input.moveY || 0;
  const tg = st.tapTarget && tapTargetAt(st.tapTarget);
  if (tg) {
    st.tapTarget.t += dt;
    const dx = tg.x - s.x, dy = tg.y - s.y, dl = Math.hypot(dx, dy);
    if (st.tapTarget.t > 8 || st.tapTarget.done) st.tapTarget = null;
    else if (dl > 50) { mx = dx / dl; my = dy / dl; }
  }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  s.vx += mx * TUNE.accel * dt; s.vy += (my * TUNE.accel + TUNE.drift) * dt;
  const d = Math.exp(-TUNE.drag * dt); s.vx *= d; s.vy *= d;
  let sp = Math.hypot(s.vx, s.vy);
  if (sp > TUNE.max && s.kickT <= 0) { const k = lerp(1, TUNE.max / sp, clamp(dt * 8, 0, 1)); s.vx *= k; s.vy *= k; }
  if (input.a && !offering && s.kickCD <= 0) {
    let kx = mx, ky = my;
    if (Math.hypot(kx, ky) < 0.2) { if (sp > 40) { kx = s.vx / sp; ky = s.vy / sp; } else { kx = 0; ky = 1; } }
    const kl = Math.hypot(kx, ky) || 1;
    s.vx += (kx / kl) * TUNE.kick; s.vy += (ky / kl) * TUNE.kick;
    s.kickCD = TUNE.kickCD; s.kickT = 0.35;
    st.events.push({ type: 'swimKick' });
  }
  s.x += s.vx * dt; s.y += s.vy * dt;
  if (Math.abs(mx) > 0.2) s.face = Math.sign(mx); else if (Math.abs(s.vx) > 40) s.face = Math.sign(s.vx);
  sp = Math.hypot(s.vx, s.vy);
  s.strokeT += dt * (0.8 + sp / 110);
  if (s.strokeT >= 0.7) { s.strokeT = 0; s.stroke ^= 1; if (s.stroke === 0 && sp > 90) st.events.push({ type: 'swimStroke' }); }

  // The guitar sinks ahead, always just out of reach, until it rests.
  if (!g.settled) {
    const gap = g.y - s.y;
    // It sets the pace: quicker when he is close behind, waiting when he lags.
    const sink = FILM ? FILM_DIVE.sink : [12, 28, 42, 52];
    g.y += (gap > 520 ? sink[0] : gap > 300 ? sink[1] : gap > 160 ? sink[2] : sink[3]) * dt;
    if (g.y >= REST.y) { g.y = REST.y; g.settled = true; st.events.push({ type: 'guitarSettle' }); }
    g.x = lerp(g.x, guitarX(g.y), clamp(dt * 2, 0, 1));
  } else if (!g.held) {
    g.x = lerp(g.x, REST.x, clamp(dt * 2, 0, 1));
    if (Math.hypot(s.x - g.x, s.y - g.y) < 90) {
      g.held = true; st.score += 200;
      st.events.push({ type: 'guitarCatch' });
      setPhase(st, 'offer'); st.offer = { said: false };
      st.checkpoint = snapshot(st, 4, s.x, Math.min(s.y, FLOOR - 60), REST.y);
    }
  }

  // Bounds: the rock walls, the surface, the floor, and the guitar below.
  keepInBounds(st);

  // Camera: keep him a little above the middle, so you see what's below.
  const target = clamp(s.y - 230, 0, CAM_MAX);
  st.cam += (target - st.cam) * clamp(dt * 4, 0, 1);

  // Air: drains, refills in a vent's bubbles; empty costs a lantern.
  const vent = ventAt(st);
  if (vent && !st.inVent) {
    st.events.push({ type: 'airVent' });
    // Each vent reached is a checkpoint: a retry starts in its bubbles.
    if (!offering) {
      const i = st.vents.findIndex((v) => Math.abs(s.x - v.x) < TUNE.ventW && s.y < v.y + 10 && s.y > v.y - TUNE.ventH);
      const sp = ventSpot(i);
      if (!st.checkpoint || (st.checkpoint.y ?? 0) <= sp.y) st.checkpoint = snapshot(st, sceneAt(sp.y), sp.x, sp.y, Math.max(g.y, sp.y + 160));
    }
  }
  st.inVent = vent;
  if (!offering) {
    if (vent && st.air < 1) {
      st.air = Math.min(1, st.air + TUNE.airRefill * dt);
      // once per filling: staying in the vent, it would fire every frame and
      // stack the words into streaks
      if (st.air >= 1 && !st.airFulled) { st.airFulled = true; st.events.push({ type: 'airFull' }); }
    }
    else st.air = Math.max(0, st.air - dt / TUNE.air);
    if (!vent || st.air < 0.9) st.airFulled = false;
    if (st.air < 0.25 && !st.airLowed) { st.airLowed = true; st.events.push({ type: 'airLow' }); }
    if (st.air > 0.4) st.airLowed = false;
    if (st.air <= 0 && hurt(st, 'airOut', s.x, s.y + 40)) st.air = TUNE.airAfterOut;
  }

  // Conch horns: swim into one to sound it.
  for (const c of st.conches) {
    if (!c.used && Math.hypot(s.x - c.x, s.y - (c.y - 25)) < 60) {
      c.used = true; st.hornT = TUNE.horn; st.events.push({ type: 'conchBlow', x: c.x, y: c.y });
    }
  }
  st.hornT = Math.max(0, st.hornT - dt);
  // Sleepers wake as he passes, while the conch sings or the guitar is his;
  // in the film edition X wakes one within reach at any time.
  const grab = FILM && !offering && !!input.x;
  const aimed = (ref) => st.tapTarget?.ref === ref;   // he swam here at a tap: act on arrival
  st.reach = null;
  for (const sl of st.sleepers) {
    if (sl.state !== 'asleep') continue;
    const d = Math.hypot(s.x - sl.x, s.y - sl.y);
    if ((st.hornT > 0 || g.held) && d < TUNE.wakeR) wake(st, sl, 'sleeperWake');
    else if (FILM && d < FILM_DIVE.wakeR) {
      if (grab || aimed(sl)) { wake(st, sl, 'sleeperWake'); if (aimed(sl)) st.tapTarget.done = true; }
      else st.reach = { kind: 'sleeper', x: sl.x, y: sl.y - 60 };
    }
  }
  // the first time each kind is in reach (the touch prompt shows then)
  if (st.reach && st.firstReach?.[st.reach.kind] == null) (st.firstReach ||= {})[st.reach.kind] = st.t;

  // Clams open on the beat, for one beat. Open: a pearl. Closed: solid.
  // Taken, a clam rests shut, then regrows its pearl once, growing only
  // while it is open (in view); taken again, it is spent.
  const bi = Math.floor(st.beat);
  let snap = false;
  for (const cl of st.clams) {
    cl.rest = Math.max(0, cl.rest - dt);
    const open = clamIsOpen(cl, st.beat);
    if (open && cl.got > 0 && cl.grow < 1 && cl.lastBeat !== bi) cl.grow = Math.min(1, cl.grow + dt / TUNE.clamGrow);
    if (cl.wasOpen && !open && Math.abs(cl.y - s.y) < 400) snap = true;
    cl.wasOpen = open;
    const ex = 60, ey = 48, cy = cl.y - 48; // the painted shell spans y -96..0
    const dx = (s.x - cl.x) / ex, dy = (s.y - cy) / ey, dd = Math.hypot(dx, dy);
    // film: a visible pearl is his on touch, or with X from within reach
    const near = FILM && open && cl.lastBeat !== bi && clamRipe(cl) && Math.hypot(s.x - cl.x, s.y - cy) < FILM_DIVE.reach;
    const take = grab || (aimed(cl) && near);
    if (near && !take && dd >= 1) st.reach = { kind: 'pearl', x: cl.x, y: cy - 60 };
    if (aimed(cl) && near) st.tapTarget.done = true;
    if (aimed(cl) && clamSpent(cl)) st.tapTarget = null;
    if (dd >= 1 && !(near && take)) continue;
    if (open) {
      if (cl.lastBeat !== bi && clamRipe(cl)) {
        cl.lastBeat = bi; cl.got++; st.pearls++; st.score += 50; cl.grow = 0; cl.rest = TUNE.clamRest;
        st.events.push({ type: 'pearl', x: cl.x, y: cy - 20 });
      }
    } else {
      const nx = dd > 1e-6 ? dx / dd : 0, ny = dd > 1e-6 ? dy / dd : -1;
      s.x = cl.x + nx * ex; s.y = cy + ny * ey;
      const vn = s.vx * nx + s.vy * ny; // remove the push into the shell
      if (vn < 0) { s.vx -= nx * vn; s.vy -= ny * vn; }
    }
  }
  keepInBounds(st); // a shell may have pushed him
  if (snap && st.lastSnap !== bi) { st.lastSnap = bi; st.events.push({ type: 'clamSnap' }); }

  // Hazards. Harmless once the guitar is in his hands (the witch is near).
  st.omens.length = 0;
  for (const e of st.eels) stepEel(st, e, dt, offering);
  if (!offering) {
    for (const j of st.jellies) {
      const p = jellyPos(j, st.hzT), cy = p.y + 18;
      if (Math.hypot(s.x - p.x, s.y - cy) < 40) hurt(st, 'jellySting', p.x, cy);
      else if (st.tea) {
        const q = jellyPos(j, st.hzT + BEAT_LEN);
        if (Math.hypot(s.x - q.x, s.y - (q.y + 18)) < 95) st.omens.push({ x: p.x, y: p.y - 46 });
      }
    }
    const dp = dragonPos(st.hzT);
    if (((s.x - dp.x) / 110) ** 2 + ((s.y - dp.y) / 40) ** 2 < 1) hurt(st, 'dragonBite', dp.x, dp.y);
    else if (st.tea) {
      const q = dragonPos(st.hzT + BEAT_LEN);
      if (((s.x - q.x) / 170) ** 2 + ((s.y - q.y) / 85) ** 2 < 1) st.omens.push({ x: dp.x, y: dp.y - 70 });
    }
  }
  if (st.phase === 'drown') return;

  // The close: the witch comes down and offers the rose.
  if (offering) {
    const o = st.offer, pt = st.phaseT;
    if (pt >= 1.6 && !o.said) { o.said = true; st.events.push({ type: 'witchOffer' }); }
    if (pt >= 2.0) {
      // The film has no bargain: he swims to the Water Fairy and she blesses
      // him, and the blessing revives the rest of his crew.
      if (FILM) { if (Math.abs(s.x - FAIRY_AT.x) < 140 && s.y > FAIRY_AT.y) choose(st, 'take'); }
      else if (input.a) choose(st, 'take');
      else if (input.b || s.y < FLOOR - 470) choose(st, 'refuse');
    }
  }
}

const ventAt = (st) => st.vents.some((v) => Math.abs(st.sailor.x - v.x) < TUNE.ventW && st.sailor.y < v.y + 10 && st.sailor.y > v.y - TUNE.ventH);

// A checkpoint: plain JSON with everything create() needs to put him back.
function snapshot(st, scene, x, y, gy) {
  const idx = (list, f) => list.map((q, i) => (f(q) ? i : -1)).filter((i) => i >= 0);
  return {
    scene, x: Math.round(x), y: Math.round(y), gy: Math.round(gy),
    score: st.score, pearls: st.pearls, woken: st.woken,
    sleepers: idx(st.sleepers, (q) => q.state !== 'asleep'),
    conches: idx(st.conches, (c) => c.used),
    clams: st.clams.map((c) => c.got),
    clamGrow: st.clams.map((c) => Math.round(c.grow * 100) / 100),
  };
}

function keepInBounds(st) {
  const s = st.sailor, g = st.guitar;
  s.x = clamp(s.x, BOUNDS.x0, BOUNDS.x1);
  const yMax = g.settled ? FLOOR - 30 : g.y - (FILM ? FILM_DIVE.lead : TUNE.guitarLead);
  if (s.y > yMax) { s.y = yMax; s.vy = Math.min(0, s.vy); }
  if (s.y < BOUNDS.y0) { s.y = BOUNDS.y0; s.vy = Math.max(0, s.vy); }
}

function stepEel(st, e, dt, calm) {
  const s = st.sailor;
  e.t += dt; e.cd = Math.max(0, e.cd - dt);
  if (e.state === 'idle') {
    if (!calm && e.cd <= 0 && Math.abs(s.y - e.y) < 170) { e.state = 'omen'; e.t = 0; }
  } else if (e.state === 'omen') {
    if (calm) { e.state = 'idle'; } else if (e.t >= BEAT_LEN) { e.state = 'glow'; e.t = 0; st.events.push({ type: 'eelGlow' }); }
  } else if (e.state === 'glow') {
    if (calm) { e.state = 'idle'; } else if (e.t >= TUNE.eelGlow) { e.state = 'lunge'; e.t = 0; st.events.push({ type: 'eelLunge' }); }
  } else if (e.state === 'lunge') {
    if (e.t >= 0.22) { e.state = 'hold'; e.t = 0; }
  } else if (e.state === 'hold') {
    if (e.t >= 0.45) { e.state = 'back'; e.t = 0; }
  } else if (e.state === 'back') {
    if (e.t >= 0.5) { e.state = 'idle'; e.t = 0; e.cd = TUNE.eelCD; }
  }
  if (st.tea && (e.state === 'omen' || e.state === 'glow')) st.omens.push({ x: e.x + e.side * 46, y: e.y - 44 });
  const ext = eelExt(e);
  if (ext > 0.25 && !calm) {
    // The eel is a segment from the hole out to its head.
    const hx = e.x + e.side * TUNE.eelReach * ext;
    const lo = Math.min(e.x, hx), hi = Math.max(e.x, hx);
    const px = clamp(s.x, lo, hi);
    if (Math.hypot(s.x - px, s.y - e.y) < 38) hurt(st, 'eelBite', px, e.y);
  }
}

// A hit costs a lantern, then grace. Returns true if it landed.
function hurt(st, cause, fx, fy) {
  const s = st.sailor;
  if (s.grace > 0 || st.phase !== 'swim') return false;
  st.lanterns--; s.grace = TUNE.grace;
  const dx = s.x - fx, dy = s.y - fy, dl = Math.hypot(dx, dy) || 1;
  s.vx += (dx / dl) * 260; s.vy += (dy / dl) * 260;
  st.events.push({ type: cause, x: s.x, y: s.y });
  st.events.push({ type: 'hit', lanterns: st.lanterns, cause });
  if (st.lanterns <= 0) { setPhase(st, 'drown'); st.events.push({ type: 'drown' }); }
  return true;
}

function wake(st, sl, type) {
  sl.state = 'rising'; sl.t = 0; st.woken++; st.score += 100;
  st.events.push({ type, x: sl.x, y: sl.y, n: st.woken });
}

// ---------------------------------------------------------------- the close
function choose(st, choice) {
  st.choice = choice; st.rose = choice === 'take';
  setPhase(st, 'choice');
  if (choice === 'take') st.events.push({ type: 'roseTake' });
  else st.events.push({ type: 'witchLaugh' });
}

function stepChoice(st, dt, input) {
  const s = st.sailor;
  // He drifts, holding the guitar; the stick still nudges him.
  s.vx += (input.moveX || 0) * 200 * dt; s.vy += (input.moveY || 0) * 200 * dt;
  const d = Math.exp(-TUNE.drag * dt); s.vx *= d; s.vy *= d;
  s.x = clamp(s.x + s.vx * dt, BOUNDS.x0, BOUNDS.x1); s.y = clamp(s.y + s.vy * dt, FLOOR - 560, FLOOR - 30);
  s.strokeT += dt; if (s.strokeT >= 0.8) { s.strokeT = 0; s.stroke ^= 1; }
  // Taking the rose, in order: her wand sparkles (the spell begins), the rose
  // sparkles in her hand and flies to his head, and only when it reaches him
  // does the spell take: a flash on him, then every sleeper rises.
  if (st.choice === 'take') {
    once(st, 'cRoseFly', st.phaseT >= ROSE_CUES.fly, { type: 'roseFly' });
    once(st, 'cRoseArrive', st.phaseT >= ROSE_CUES.arrive, { type: 'roseArrive' });
  }
  if (st.choice === 'take' && st.phaseT >= ROSE_CUES.wake && !st.massWoken) {
    // With a wave of her wand she wakes every sleeper at once.
    st.massWoken = true;
    const left = st.sleepers.filter((sl) => sl.state === 'asleep');
    st.roseRisers = left.filter((sl) => !sl.floor).length;
    for (const sl of left) { sl.state = 'rising'; sl.t = 0; st.woken++; st.score += 100; }
    st.events.push({ type: 'sleepersRise', n: left.length });
  }
  if (st.phaseT >= PHASE_LEN.choice) {
    setPhase(st, 'ride');
    st.ride = newRide();
    st.events.push({ type: 'rideStart' });
    st.checkpoint = { ...snapshot(st, 5, REST.x, REST.y - 40, REST.y), choice: st.choice };
  }
}

// ---------------------------------------------------------------- the ride
function stepRide(st, dt, input) {
  const r = st.ride, rt = st.phaseT;
  if (r.rowT < 1) r.rowT = Math.min(1, r.rowT + dt / 0.3);
  else if (input.up && r.row > 0) { r.from = r.row; r.row--; r.rowT = 0; st.events.push({ type: 'rideRow' }); }
  else if (input.down && r.row < 2) { r.from = r.row; r.row++; r.rowT = 0; st.events.push({ type: 'rideRow' }); }
  r.x = clamp(r.x + (input.moveX || 0) * RIDE.sail * dt, RIDE.minX, RIDE.maxX);
  if (r.leapT > 0) { r.leapT = Math.max(0, r.leapT - dt); if (r.leapT === 0) st.events.push({ type: 'rideLand' }); }
  else if (input.a) { r.leapT = RIDE.leapTime; st.events.push({ type: 'leap' }); }
  const row = rideEffRow(r), h = rideLeapH(r);
  for (const p of r.pearls) {
    if (p.got || rt < p.at) continue;
    if (p.row === row && Math.abs(ridePearlX(p, rt) - r.x) < RIDE.catchX && (!p.high || h >= RIDE.highAt)) {
      p.got = true; st.pearls++; st.score += 25;
      st.events.push({ type: 'ridePearl', row: p.row, high: p.high });
    }
  }
  if (rt >= PHASE_LEN.ride) { setPhase(st, 'iris'); st.events.push({ type: 'irisOut' }); }
}

function win(st) {
  st.status = 'won'; st.statusT = 0;
  // (In the film edition the blessing is not a keepsake that changes later acts.)
  st.result = { keepsakes: FILM ? { guitar: true } : { guitar: true, rose: st.rose }, sleepers: st.woken, score: st.score, pearls: st.pearls };
}

function setPhase(st, p) { st.phase = p; st.phaseT = 0; }
function once(st, key, cond, ev) { if (cond && !st[key]) { st[key] = true; st.events.push(ev); } }
