import { LEGACY, BAY_TITLE } from '../theme.js';
// Act V — Widow's Bay (design/acts.md). Part 1: climb the cliff from the
// shore to the stone house, past loose stones and the band at impossible
// scales. Part 2: the witch's storm sets the house alight; its front swings
// open like a dollhouse; climb to the beloved, carry her down a different
// way and across the quay as the house falls. Then the ending chosen by what
// he carried, and the pageant. Headless: drawing is in act5-art.js.
import { beatPhase, clamp, lerp, rng } from './shared.js';
import { createWall, stepWall, jolt, mantleTo, CLIMB } from './climb.js';
import * as art from './act5-art.js';

export const BEAT_S = 60 / 76.5;          // one beat of the song, seconds
export const GRACE = 1.6;                 // invulnerable after a hit
export const LANTERNS = 3;

// ---------------------------------------------------------------- the cliff
// World units: x as on stage, y upward from the shore (0) to the clifftop.
const TOP = 1990;
export const CLIFF = {
  top: TOP,           // the grass edge
  reach: 130,         // a plain climb move
  leap: 190,          // A: leap between ledges
  climbT: 0.34, leapT: 0.55, fallT: 0.5,
  crumbleT: 0.7,      // a loose hold gives way this long after you take it
  camMax: TOP - 330,       // the camera's highest point during the climb
  bootLift: 100,      // how high the giant raises his boot on the beat
  stoneWarn: 1.1,     // dust gathers this long before a stone drops
  stoneEvery: [2.0, 3.0],
};

// Kinds: ledge (wide), hold, crumble (gives way), gap (the tiny guitarist's
// sheltered handhold: stones can't reach it), boot (the giant's, moves on the
// beat), top (the clifftop; only reachable from the boot, over the lip).
export const HOLDS = [
  // the shore and a warm-up zigzag
  { x: 420, y: 0, kind: 'ledge' }, { x: 540, y: 0, kind: 'ledge', start: true }, { x: 660, y: 0, kind: 'ledge' },
  { x: 560, y: 95 }, { x: 700, y: 100 }, { x: 640, y: 190 }, { x: 790, y: 195 },
  { x: 720, y: 285 }, { x: 870, y: 290, pearl: true }, { x: 800, y: 380 },
  // a traverse left across the open face, under the stones
  { x: 740, y: 470 }, { x: 630, y: 465 }, { x: 520, y: 470 }, { x: 410, y: 475, pearl: true },
  { x: 330, y: 560 }, { x: 360, y: 650, kind: 'ledge' },
  // back up to the right, past a loose hold with a pearl on it
  { x: 450, y: 740 }, { x: 560, y: 745 }, { x: 540, y: 850, kind: 'crumble', pearl: true },
  { x: 650, y: 830 }, { x: 760, y: 840 }, { x: 850, y: 930 }, { x: 900, y: 1030, kind: 'ledge' },
  // a blank wall: leap it, then traverse
  { x: 820, y: 1185 }, { x: 710, y: 1190 }, { x: 600, y: 1180 }, { x: 490, y: 1190 },
  { x: 400, y: 1290, kind: 'crumble' }, { x: 530, y: 1295 }, { x: 650, y: 1285, kind: 'crumble' },
  { x: 480, y: 1390 }, { x: 590, y: 1400 }, { x: 700, y: 1390 }, { x: 810, y: 1400, pearl: true },
  // up under the huge guitarist, and back across to the left
  // the tiny guitarist's gap is the safe handhold after the loose one, in the
  // dark cleft painted on the cliff
  { x: 860, y: 1490 }, { x: 900, y: 1585, kind: 'crumble' }, { x: 790, y: 1580, kind: 'gap' },
  { x: 670, y: 1590 }, { x: 560, y: 1600 }, { x: 450, y: 1610, pearl: true },
  { x: 400, y: 1700 }, { x: 450, y: 1790 }, { x: 420, y: 1830, kind: 'ledge' }, { x: 580, y: 1760, pearl: true },
  // the giant's boot, then over the lip
  { x: 450, y: TOP - 65, kind: 'boot' },
  { x: 570, y: TOP + 6, kind: 'top' }, { x: 690, y: TOP + 6, kind: 'top' },
];

export const bootLift = (beat) => (((Math.floor(beat) % 2) + 2) % 2 === 0 ? Math.sin(Math.PI * beatPhase(beat)) : 0);
export const holdY = (h, beat) => h.y + (h.kind === 'boot' ? bootLift(beat) * CLIFF.bootLift : 0);

const DIRS = { up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

// The hold a move in `dir` reaches from hold index `from`, or -1.
export function pickHold(st, from, dir, leap = false) {
  const a = st.holds[from], ay = holdY(a, st.beat);
  const max = leap ? CLIFF.leap : CLIFF.reach;
  let best = -1, bs = Infinity, far = -1, fs = Infinity;
  st.holds.forEach((h, i) => {
    if (i === from || h.gone) return;
    if (h.kind === 'top' && a.kind !== 'boot' && a.kind !== 'top' && !st.climb?.openTop) return; // the lip overhangs
    const dx = h.x - a.x, dy = holdY(h, st.beat) - ay, d = Math.hypot(dx, dy);
    if (d > max || d < 1) return;
    const along = dx * dir.x + dy * dir.y;
    // Within 50 degrees of the stick; from the boot, any push up or across
    // toward the grass steps onto it.
    if (along < (h.kind === 'top' && a.kind === 'boot' ? -0.2 * d : 0.64 * d)) return;
    // Sideways, prefer the higher hold: this is a climb.
    const s = d + Math.abs(dx * dir.y - dy * dir.x) * 0.8 - (Math.abs(dir.y) < 0.5 ? dy * 0.3 : 0);
    if (s < bs) { bs = s; best = i; }
    if (d > CLIFF.reach * 0.8 && s < fs) { fs = s; far = i; }
  });
  return leap && far >= 0 ? far : best;
}

// Where each press would take him from the hold he is on, for showing the
// player: the hold each direction reaches (-1 for none) and where A would
// leap (in the direction held, else up). `leap` is -1 when it would land on
// the same hold as an ordinary climb that way.
export function climbOptions(st, aim = null) {
  const at = st.cl.at, out = {};
  for (const [name, d] of Object.entries(DIRS)) out[name] = pickHold(st, at, d, false);
  const ld = aim || DIRS.up;
  const leap = pickHold(st, at, ld, true), plain = pickHold(st, at, ld, false);
  out.leap = leap !== plain ? leap : -1;
  return out;
}
export const CLIMB_BUFFER = 0.3; // a press this close to the end of a move happens on arrival

// ---------------------------------------------------------------- the house
// Stage coordinates, fixed camera. Floors 0 (ground) to 2 (the bedroom).
export const HOUSE = {
  x0: 380, x1: 900, wallL: 396, wallR: 884, door: 402,
  floors: [626, 452, 278], storey: 174,
  walk: 190, carryWalk: 118, jump: 560, gravity: 1500,
  beloved: 830,
  // The shutter painted in stone-house.webp: its centre, mapped through
  // HOUSE_ART (act5-art.js) onto the stage, at the middle floor. The stone
  // sailor throws (or finds it locked) standing shutterNear = [36, 96] px to the
  // right of its centre: past the launch point for the leap over the burnt gap
  // (x 650-686), so A there still leaps.
  shutterX: 651, shutterY: 337, shutterNear: [36, 96],
  beamWarn: 1.0, beamFall: 0.28, hazEvery: [1.9, 2.6],
  climb: { ladder: 140, stairs: 170, ivy: 125, slope: 150 }, carryClimb: 0.62,
};
const SPANS_START = () => [[[380, 900]], [[380, 580], [650, 900]], [[380, 600], [660, 900]]];
const CONNS_START = () => [
  { id: 'stairs', kind: 'stairs', a: { x: 560, f: 0 }, b: { x: 760, f: 1 }, on: true },
  { id: 'ladderUp', kind: 'ladder', a: { x: 450, f: 1 }, b: { x: 450, f: 2 }, on: true },
  { id: 'ivy', kind: 'ivy', a: { x: 872, f: 1 }, b: { x: 872, f: 2 }, on: false },
  { id: 'ladderDown', kind: 'ladder', a: { x: 720, f: 1 }, b: { x: 720, f: 2 }, on: false },
  { id: 'slope', kind: 'slope', a: { x: 876, f: 0 }, b: { x: 800, f: 1 }, on: false },
];

export const QUAY = { y: 604, x0: 300, x1: 1050, warn: 0.9, every: [1.3, 1.8] };

// Cut-scene lengths, seconds.
export const T = { storm: 4.8, ending: 12, pageant: 11.5, iris: 1.6, defeat: 1.8, lift: 0.8 };

const PROG = { cliff: [0, 0.45], up: [0.45, 0.7], carry: [0.7, 0.9], quay: [0.9, 1] };

// Scenes, for checkpoints and the scene select.
export const SCENES = [
  { name: 'The Cliff Foot' },
  { name: 'Halfway Up the Cliff' },
  { name: 'The Burning House' },
  { name: 'Carrying Her Down' },
  { name: 'The Quay' },
  { name: 'The Ending' },
  { name: 'The Pageant' },
];
// The solid ledge about halfway up (the checkpoint hold).
export const HALF = HOLDS.findIndex((h) => h.x === 900 && h.y === 1030);

export function endingFor(carry = {}) {
  if (carry.rose) return 'witch';
  if (carry.pearl) return 'lamp';
  return 'dark';
}

export default {
  id: 5, kicker: 'Act V', title: BAY_TITLE, size: 120,
  sub: 'Climb the cliff to the stone house.\nCarry her out of the fire.',
  // Shown as a silent-film intertitle after the act card.
  intertitle: 'Climb anywhere on the rock:\nfastest up the ivy and the cracks.\nPush up into a ledge to haul yourself onto it.\n\nOnly the giant\'s boot lifts you over the lip:\nride it up on the beat.\nDust above means a stone is about to fall.',
  action: 'A: leap',
  scenes: SCENES,

  // `from` (optional): { scene } to start at a scene, plus the fields of a
  // checkpoint this act made (hold, taken, score, pearls, house state).
  create({ seed = 1, carry = {}, from = null } = {}) {
    const holds = HOLDS.map((h) => ({ kind: 'hold', ...h, gone: false }));
    const start = holds.findIndex((h) => h.start);
    const st = {
      status: 'play', statusT: 0, events: [], result: null, checkpoint: null,
      carry: { tea: 0, guitar: false, rose: false, pearl: false, stone: false, sleepers: 0, ...carry },
      omen: (carry.tea || 0) >= 3,
      ending: endingFor(carry),
      rand: rng(seed), clock: 0, beat: 0, lastBeat: 0,
      phase: 'cliff', phaseT: 0,
      lanterns: LANTERNS, inv: 0, defeatT: null,
      score: 0, pearls: 0,
      // cliff
      holds, camY: 0,
      cl: { at: start, from: start, moveT: 0, moveDur: 0, kind: null, crumbleT: 0 },
      rocks: [], nextRock: 3.2,
      // storm and house
      fire: 0, open: 0, walkFromX: 0,
      spans: SPANS_START(), conns: CONNS_START(),
      p: { x: HOUSE.door, y: HOUSE.floors[0], vy: 0, vx: 0, f: 0, conn: null, face: 1, carry: false, airTop: 0, liftT: 0, stepT: 0 },
      haz: [], nextHaz: 1.6,
      stoneThrown: false, throwT: null, shutter: 'shut', shortcut: false, lockedT: 0,
      ladderDropT: null, broke: false,
      // quay, ending, pageant
      quayT: 0, joined: 0, sleepersShown: Math.min(12, Math.max(0, carry.sleepers || 0)),
    };
    const k = clamp(from?.scene | 0, 0, SCENES.length - 1);
    if (k <= 1) startCliffWall(st, k === 1 ? from : null);
    if (k <= 0) return st;
    st.score = from.score ?? 0;
    st.pearls = from.pearls ?? 0;
    if (k === 1) {
      st.nextRock = 3.2;
    } else {
      // The house, burning and open, with the stage camera at the clifftop.
      Object.assign(st, { camY: CLIFF.top, cam0: CLIFF.top, fire: 1, open: 1, struck: true, opened: true, walkFromX: 570 });
      st.cl.at = st.cl.from = holds.findIndex((h) => h.kind === 'top');
      for (const h of holds) if (h.pearl) h.taken = true;
      restoreHouse(st, from, k);
      if (k === 2) { setPhase(st, 'house'); }
      else if (k === 3) { setPhase(st, 'house'); }
      else {
        st.p = { ...st.p, x: k === 4 ? QUAY.x0 : QUAY.x1, y: QUAY.y, f: 0, conn: null, face: 1 };
        if (k === 4) { setPhase(st, 'quay'); st.nextHaz = 1.2; }
        else { st.quayT = 6; setPhase(st, k === 5 ? 'ending' : 'pageant'); }
        st.ending = endingFor(carry);
        if (k === 5) st.events.push({ type: 'ending', ending: st.ending });
        if (k === 6) st.events.push({ type: 'pageant' });
      }
    }
    st.checkpoint = { ...from, scene: k };
    return st;
  },

  step(st, dt, input = {}) {
    st.statusT += dt;
    st.clock += dt;
    st.beat = input.beat ?? st.clock / BEAT_S;
    if (st.status !== 'play') return;
    st.phaseT += dt;
    st.inv = Math.max(0, st.inv - dt);
    if (st.defeatT != null) {
      st.defeatT += dt;
      if (st.phase === 'cliff') st.camY = Math.max(0, st.camY - dt * 120);
      if (st.defeatT >= T.defeat) { st.status = 'lost'; st.statusT = 0; }
      return;
    }
    const busy = st.phase === 'cliff' || st.phase === 'house' || st.phase === 'quay';
    const inp = busy ? input : {};
    if (st.phase === 'cliff' && st.wall) stepCliffWall(st, dt, inp);
    else if (st.phase === 'cliff') stepCliff(st, dt, inp);
    else if (st.phase === 'storm') stepStorm(st, dt);
    else if (st.phase === 'house') stepHouse(st, dt, inp);
    else if (st.phase === 'quay') stepQuay(st, dt, inp);
    else if (st.phase === 'ending') stepEnding(st);
    else if (st.phase === 'pageant') stepPageant(st);
    else if (st.phase === 'iris' && st.phaseT >= T.iris) win(st);
    st.lastBeat = st.beat;
  },

  hud(st) {
    if (!['cliff', 'storm', 'house', 'quay'].includes(st.phase)) return null;
    const c = st.carry;
    const keepsakes = [
      { id: 'tea', have: c.tea >= 3 }, { id: 'guitar', have: !!c.guitar },
      { id: 'pearl', have: !!c.pearl }, { id: 'stone', have: !!c.stone && !st.stoneThrown },
    ];
    if (c.rose) keepsakes.push({ id: 'rose', have: true });
    return { lanterns: st.lanterns, maxLanterns: LANTERNS, pearls: st.pearls, progress: progress(st), keepsakes };
  },

  announce(e) {
    if (e.type === 'hit') return `Hit. ${e.lanterns} lantern${e.lanterns === 1 ? '' : 's'} left.`;
    if (e.type === 'stoneWarn') return 'Dust above: a stone is about to fall.';
    if (e.type === 'holdCrumble') return 'The hold crumbles away.';
    if (e.type === 'clifftop') return 'The clifftop. The stone house.';
    if (e.type === 'houseOpen') return 'The house is burning. Its front swings open. Climb to her.';
    if (e.type === 'beamWarn') return 'The ceiling shudders.';
    if (e.type === 'shutterLocked') return 'The shutter is locked fast.';
    if (e.type === 'shutterSmash') return 'The stone breaks the shutter. Climb the ivy.';
    if (e.type === 'liftHer') return 'You lift her. Carry her down: no leaping now.';
    if (e.type === 'floorBreak') return 'The way you came is gone. A ladder drops at the right.';
    if (e.type === 'houseFall') return 'Out onto the quay. The house is falling.';
    if (e.type === 'ending') return { witch: "The Sea Witch's. Her moon boat claims him.", lamp: 'A lamp in the window.', dark: 'The window is dark.' }[e.ending];
    if (e.type === 'pageant') return 'The pageant.';
    return null;
  },

  focus: art.focus, draw: art.draw, drawOver: art.drawOver, onEvent: art.onEvent,
};

// ---------------------------------------------------------------- shared
export function setPhase(st, ph) { st.phase = ph; st.phaseT = 0; }

// The house state a checkpoint keeps, as plain JSON.
export function houseSnap(st) {
  return {
    spans: st.spans.map((f) => f.map((r) => [...r])),
    conns: st.conns.map((c) => ({ id: c.id, on: c.on })),
    stoneThrown: st.stoneThrown, shutter: st.shutter, shortcut: st.shortcut,
    escapeT: st.escapeT, escapeFire: st.escapeFire,
    broke: st.broke, ladderDropT: st.ladderDropT == null ? null : Math.min(1, st.ladderDropT),
  };
}
export function checkpoint(st, scene, extra = {}) {
  st.checkpoint = { scene, score: st.score, pearls: st.pearls, ...extra };
}

// Puts the house back as a scene (2: the start of the climb; 3 and later: she
// is lifted and the way up has broken away) or as a checkpoint stored it.
export function restoreHouse(st, from, k) {
  const H = HOUSE;
  if (k >= 3) breakAway(st);
  st.ladderDropT = k >= 3 ? 1 : null;
  if (from.stoneThrown) { st.stoneThrown = true; st.shutter = 'broken'; st.shortcut = true; }
  if (from.spans) st.spans = from.spans.map((f) => f.map((r) => [...r]));
  if (from.conns) for (const c of st.conns) { const o = from.conns.find((x) => x.id === c.id); if (o) c.on = !!o.on; }
  if (from.shutter) st.shutter = from.shutter;
  if (from.shortcut != null) st.shortcut = from.shortcut;
  if (from.broke != null) st.broke = from.broke;
  if (from.ladderDropT !== undefined && from.spans) st.ladderDropT = from.ladderDropT;
  st.conns.find((c) => c.id === 'ivy').on = st.shutter === 'broken' && !st.broke;
  if (k >= 3) { st.p = { ...st.p, x: H.beloved, y: H.floors[2], f: 2, carry: true, face: -1 }; }
  else st.p = { ...st.p, x: H.door, y: H.floors[0], f: 0 };
  st.events.length = 0;
}

export function hit(st, extra = {}) {
  if (st.inv > 0 || st.defeatT != null) return false;
  st.lanterns--;
  st.inv = GRACE;
  st.events.push({ type: 'hit', lanterns: st.lanterns, ...extra });
  if (st.lanterns <= 0) {
    st.defeatT = 0;
    st.lostTitle = st.phase === 'cliff' ? 'The Cliff\nGives Way' : 'The Fire Takes\nthe House';
    st.lostSub = st.phase === 'cliff' ? 'Watch the dust: the stone falls where it gathers.' : 'The ceiling shudders before it falls.';
  }
  return true;
}

function progress(st) {
  const span = (k, f) => lerp(PROG[k][0], PROG[k][1], clamp(f, 0, 1));
  if (st.phase === 'cliff') return span('cliff', climberPos(st).y / climbCfg(st).top);
  if (st.phase === 'storm') return PROG.up[0];
  if (st.phase === 'house') {
    const p = st.p, f = p.conn ? lerp(p.conn.c.a.f, p.conn.c.b.f, p.conn.u) : p.f >= 0 ? p.f : (HOUSE.floors[0] - p.y) / HOUSE.storey;
    return p.carry ? span('carry', 1 - f / 2) : span('up', f / 2);
  }
  if (st.phase === 'quay') return span('quay', (st.p.x - QUAY.x0) / (QUAY.x1 - QUAY.x0));
  return 1;
}

function directionOf(input) {
  if (input.up) return DIRS.up;
  if (input.down) return DIRS.down;
  if (input.left) return DIRS.left;
  if (input.right) return DIRS.right;
  const mx = input.moveX || 0, my = -(input.moveY || 0), m = Math.hypot(mx, my);
  return m > 0.5 ? { x: mx / m, y: my / m } : null;
}

// ---------------------------------------------------------------- part 1
// The climber's current world position (interpolated during a move).
export function climberPos(st) {
  if (st.wall) return { x: st.wall.x, y: st.wall.y, moving: st.wall.mode !== 'wall' && st.wall.mode !== 'ledge' };
  const cl = st.cl, b = st.holds[cl.at], by = holdY(b, st.beat);
  if (cl.moveDur <= 0 || cl.moveT >= cl.moveDur) return { x: b.x, y: by, moving: false };
  const a = st.holds[cl.from], k = cl.moveT / cl.moveDur, ay = cl.fromY ?? holdY(a, st.beat);
  const arc = cl.kind === 'leap' ? Math.sin(Math.PI * k) * 40 : 0;
  return { x: lerp(cl.fromX ?? a.x, b.x, k), y: lerp(ay, by, k) + arc, moving: true, k };
}

function moveTo(st, i, kind) {
  const cl = st.cl, pos = climberPos(st);
  cl.from = cl.at; cl.fromX = pos.x; cl.fromY = pos.y;
  cl.at = i; cl.moveT = 0; cl.kind = kind;
  cl.moveDur = kind === 'leap' ? CLIFF.leapT : kind === 'fall' ? CLIFF.fallT : CLIFF.climbT;
  cl.crumbleT = st.holds[i].kind === 'crumble' ? CLIFF.crumbleT + cl.moveDur : 0;
  st.events.push({ type: kind === 'leap' ? 'leap' : kind === 'fall' ? 'fall' : 'rockScrape' });
}

// The climb's top, camera limit and halfway checkpoint: the cliff's, unless
// the state carries another climb's (the film edition's tower wall).
const climbCfg = (st) => st.climb || { top: CLIFF.top, camMax: CLIFF.camMax, half: HALF, halfScene: 1 };

export function stepCliff(st, dt, input) {
  const cl = st.cl, cfg = climbCfg(st);
  cl.moveT += dt;
  const arrived = cl.moveDur > 0 && cl.moveT >= cl.moveDur && cl.moveT - dt < cl.moveDur;
  const h = st.holds[cl.at];
  if (arrived) {
    if (h.pearl && !h.taken) { h.taken = true; st.pearls++; st.score += 10; st.events.push({ type: 'pearl', x: h.x, y: h.y }); }
    if ((st.checkpoint?.scene | 0) < cfg.halfScene && h.y >= st.holds[cfg.half].y && h.kind !== 'top') {
      checkpoint(st, cfg.halfScene, { hold: cfg.half, taken: st.holds.map((o, j) => (o.taken ? j : -1)).filter((j) => j >= 0) });
    }
    if (h.kind === 'top' && st.part) { reachTop(st, h); return; }
    if (h.kind === 'top') {
      st.score += 200; st.walkFromX = h.x;
      st.events.push({ type: 'clifftop' });
      setPhase(st, 'storm');
      return;
    }
  }
  const idle = cl.moveT >= cl.moveDur;

  // A loose hold gives way under you: fall to the hold below.
  if (h.kind === 'crumble' && !h.gone && cl.crumbleT > 0) {
    cl.crumbleT -= dt;
    if (cl.crumbleT <= 0) {
      h.gone = true;
      st.events.push({ type: 'holdCrumble', x: h.x, y: h.y });
      let best = -1, bd = Infinity;
      st.holds.forEach((o, i) => {
        if (o.gone || o.y >= h.y || o.kind === 'boot' || o.kind === 'top') return;
        const d = Math.abs(o.x - h.x) * 1.5 + (h.y - o.y);
        if (d < bd) { bd = d; best = i; }
      });
      moveTo(st, best, 'fall');
      hit(st, { cause: 'crumble' });
      return;
    }
  }

  // What the player is pressing: kept as the aim (the art shows where A
  // would leap that way), and a fresh press made mid-move is buffered so it
  // happens on arrival rather than being lost.
  const dir = directionOf(input);
  cl.aim = dir;
  if (cl.bump) { cl.bump.t -= dt; if (cl.bump.t <= 0) cl.bump = null; }
  const fresh = input.a || input.up || input.down || input.left || input.right;
  // (Only presses in the last CLIMB_BUFFER s of a move, so an early press
  // on a long leap doesn't fire a surprise second move.)
  if (!idle && fresh && cl.moveDur - cl.moveT <= CLIMB_BUFFER) cl.queued = { a: !!input.a, dir };
  if (idle) {
    const q = cl.queued; cl.queued = null;
    const wantA = input.a || (q && q.a), d = dir || (q && q.dir);
    if (wantA) {
      const i = pickHold(st, cl.at, d || DIRS.up, true);
      if (i >= 0) moveTo(st, i, 'leap');
      else { st.events.push({ type: 'noHold', dir: d || DIRS.up, leap: true }); cl.bump = { dir: d || DIRS.up, t: 0.4 }; }
    } else if (d) {
      const i = pickHold(st, cl.at, d, false);
      if (i >= 0) moveTo(st, i, 'climb');
      else if (fresh || q) { st.events.push({ type: 'noHold', dir: d }); cl.bump = { dir: d, t: 0.4 }; }
    }
  }

  // The giant shifts his weight on every beat.
  const pos = climberPos(st);
  if (!st.part && Math.floor(st.beat) !== Math.floor(st.lastBeat) && pos.y > CLIFF.top - 450) st.events.push({ type: 'giantStep', foot: ((Math.floor(st.beat) % 2) + 2) % 2 });

  // The camera follows, like a cliff flat winched down through the floor.
  const want = clamp(pos.y - 250, 0, cfg.camMax);
  st.camY += (want - st.camY) * Math.min(1, dt * 3);

  stepRocks(st, dt, pos);
}

// ---------------------------------------------------------------- the continuous climb
// The cliff is climbed anywhere on its painted face (climb.js, on the map
// read from the cloth). This edition keeps its own cliff: the giant's boot,
// lifting on the beat, is the only way over the overhanging lip; the tiny
// guitarist's gap in the cleft shelters from stones; its loose holds are
// patches that give way if he lingers on them.
const BOOT = { x0: 412, x1: 492 };                  // the giant's left boot (LEGS[0] 450 in the art)
const BOOT_Y = HOLDS.find((h) => h.kind === 'boot').y;
const TOP_AT = { x: 570, y: TOP };                  // where he comes up over the lip
function startCliffWall(st, from) {
  const extra = [{ x0: BOOT.x0, x1: BOOT.x1, y: BOOT_Y, boot: true }];
  const opts = { floor: 40, capY: TOP - 60 - CLIMB.hands, closedTop: true, extraLedges: extra };   // his hands reach the planted boot, not the lip
  const probe = createWall('cliff', [], { x: 0, y: 0 }, opts);
  // start on the lowest painted ledge, or the one nearest a checkpoint's place
  const near = (x, y) => probe.ledges.filter((l) => !l.boot).reduce((a, l) => (Math.hypot((l.x0 + l.x1) / 2 - x, l.y - y) < Math.hypot((a.x0 + a.x1) / 2 - x, a.y - y) ? l : a));
  const half = HOLDS[HALF];
  const at = from?.wy != null ? { x: from.wx, y: from.wy }
    : from ? (({ x0, x1, y }) => ({ x: (x0 + x1) / 2, y }))(near(half.x, half.y))
      : (({ x0, x1, y }) => ({ x: (x0 + x1) / 2, y }))(probe.ledges.filter((l) => !l.boot).reduce((a, l) => (l.y < a.y ? l : a)));
  st.wall = createWall('cliff', HOLDS, at, opts);
  st.shelter = HOLDS.find((h) => h.kind === 'gap');
  st.climb = { top: CLIFF.top, camMax: CLIFF.camMax, half: HALF, halfScene: 1, halfY: near(half.x, half.y).y };
  if (from) {
    const taken = from.taken ?? st.wall.pearls.map((p, i) => (p.y <= at.y + 4 ? i : -1)).filter((i) => i >= 0);
    for (const i of taken) if (st.wall.pearls[i]) st.wall.pearls[i].taken = true;
  }
  st.camY = clamp(st.wall.y - 250, 0, CLIFF.camMax);
}

function stepCliffWall(st, dt, input) {
  const w = st.wall, cfg = st.climb, boot = w.ledges.find((l) => l.boot);
  boot.y = BOOT_Y + bootLift(st.beat) * CLIFF.bootLift;
  const ctx = {
    events: st.events,
    hit: (cause) => hit(st, { cause }),
    pearl: (p) => { st.pearls++; st.score += 10; st.events.push({ type: 'pearl', x: p.x, y: p.y }); },
  };
  const onBoot = w.mode === 'ledge' && w.ledges[w.ledge] === boot;
  const up = input.up || (input.moveY || 0) < -0.5;
  let r = null;
  // from the boot: up while it is raised, or a spring at any time, over the lip
  if (onBoot && ((up && bootLift(st.beat) > 0.6) || input.a)) mantleTo(w, TOP_AT.x, TOP_AT.y, 'top', ctx);
  else r = stepWall(w, dt, input, ctx);
  if (r === 'top') {
    st.score += 200; st.walkFromX = w.x;
    st.events.push({ type: 'clifftop' });
    setPhase(st, 'storm');
    return;
  }
  if ((st.checkpoint?.scene | 0) < cfg.halfScene && w.mode === 'ledge' && !onBoot && w.y >= cfg.halfY - 6) {
    checkpoint(st, cfg.halfScene, { wx: w.x, wy: w.y, taken: w.pearls.map((p, i) => (p.taken ? i : -1)).filter((i) => i >= 0) });
  }
  // The giant shifts his weight on every beat.
  if (Math.floor(st.beat) !== Math.floor(st.lastBeat) && w.y > CLIFF.top - 450) st.events.push({ type: 'giantStep', foot: ((Math.floor(st.beat) % 2) + 2) % 2 });
  const want = clamp(w.y - 250, 0, cfg.camMax);
  st.camY += (want - st.camY) * Math.min(1, dt * 3);
  const before = st.lanterns;
  stepRocks(st, dt, climberPos(st));
  if (st.lanterns < before) jolt(w);
}

export function stepRocks(st, dt, pos) {
  st.nextRock -= dt;
  if (st.nextRock <= 0 && pos.y < climbCfg(st).top - 120) {
    const [lo, hi] = CLIFF.stoneEvery;
    st.nextRock = lo + st.rand() * (hi - lo);
    const lead = CLIFF.stoneWarn + (st.omen ? BEAT_S : 0);
    st.rocks.push({ x: clamp(pos.x + (st.rand() - 0.5) * 30, 280, 960), wait: lead, warn: CLIFF.stoneWarn, omen: st.omen, y: null, vy: 0, spin: st.rand() * 6, warned: false, done: false });
  }
  const h = st.wall ? null : st.holds[st.cl.at];
  const sheltered = st.wall
    ? !!st.shelter && st.wall.mode === 'wall' && Math.abs(pos.x - st.shelter.x) < 40 && Math.abs(pos.y - st.shelter.y) < 60
    : !!h && h.kind === 'gap' && !pos.moving;
  for (const r of st.rocks) {
    r.wait -= dt;
    if (r.y == null) {
      if (!r.warned && r.wait <= r.warn) { r.warned = true; st.events.push({ type: 'stoneWarn', x: r.x }); }
      if (r.wait <= 0) { r.y = st.camY + 640; r.vy = 260; st.events.push({ type: 'stoneFall', x: r.x }); }
      continue;
    }
    const prev = r.y;
    r.vy += 1600 * dt; r.y -= r.vy * dt;
    // The climber's body spans y .. y + 100 (world, upward).
    if (!r.done && Math.abs(r.x - pos.x) < 44 && prev >= pos.y && r.y <= pos.y + 100) {
      r.done = true;
      if (!sheltered) hit(st, { cause: 'stone' });
      else st.events.push({ type: 'stoneGlance', x: r.x });
    }
  }
  st.rocks = st.rocks.filter((r) => r.y == null || r.y > st.camY - 120);
}

// ---------------------------------------------------------------- storm
function stepStorm(st, dt) {
  const t = st.phaseT;
  if (t >= 1.0 && !st.struck) { st.struck = true; st.events.push({ type: 'strike' }); st.events.push({ type: 'fireRoar' }); }
  if (st.cam0 == null) st.cam0 = st.camY;
  // The camera rises with him as he walks, so the house roof is in view when the bolt lands (t = 1.0).
  st.camY = lerp(st.cam0, CLIFF.top, smooth(t / 1.1));
  st.fire = smooth((t - 1.1) / 1.9);
  if (t >= 3.0 && !st.opened) { st.opened = true; st.events.push({ type: 'houseOpen' }); }
  st.open = smooth((t - 3.0) / 1.4);
  st.rocks.length = 0;
  if (t >= T.storm) {
    setPhase(st, 'house');
    checkpoint(st, 2, houseSnap(st));
    st.events.push({ type: 'fireCrackle' });
  }
}
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---------------------------------------------------------------- part 2
const connY = (c, end) => HOUSE.floors[c[end].f];
export function playerFloorY(st) { return st.p.f >= 0 ? HOUSE.floors[st.p.f] : null; }
const onSpan = (st, f, x) => st.spans[f].some(([a, b]) => x >= a - 2 && x <= b + 2);

export function stepHouse(st, dt, input) {
  const p = st.p, H = HOUSE;
  p.landT = Math.max(0, (p.landT || 0) - dt);
  const mx = input.moveX || (input.left ? -1 : 0) || (input.right ? 1 : 0);
  const wantUp = input.up || (input.moveY || 0) < -0.5;
  const wantDown = input.down || (input.moveY || 0) > 0.5;

  // The ladder at the right drops on its hinge once you have her.
  if (st.ladderDropT != null) st.ladderDropT += dt;
  if (p.liftT > 0) { p.liftT -= dt; stepHazards(st, dt); return; }

  // The stone flies to the shutter.
  if (st.throwT != null) {
    st.throwT += dt;
    if (st.throwT >= 0.35 && st.shutter === 'shut') {
      st.shutter = 'broken'; st.shortcut = true; st.score += 50;
      st.conns.find((c) => c.id === 'ivy').on = true;
      st.events.push({ type: 'shutterSmash' });
    }
  }
  st.lockedT = Math.max(0, st.lockedT - dt);

  if (p.conn) {
    // On stairs, a ladder, the ivy or the broken slope.
    const c = p.conn.c, ya = connY(c, 'a'), yb = connY(c, 'b');
    const ux = c.b.x - c.a.x, uy = yb - ya, len = Math.hypot(ux, uy);
    const proj = ((mx * ux) + ((input.moveY || 0) + (wantUp ? -1 : 0) + (wantDown ? 1 : 0)) * uy) / len;
    const speed = H.climb[c.kind] * (p.carry ? H.carryClimb : 1);
    if (Math.abs(proj) > 0.3) {
      p.conn.u += Math.sign(proj) * speed * dt / len;
      if (ux) p.face = Math.sign(ux * proj);
    }
    p.x = lerp(c.a.x, c.b.x, clamp(p.conn.u, 0, 1)); p.y = lerp(ya, yb, clamp(p.conn.u, 0, 1));
    if (p.conn.u >= 1 || p.conn.u <= 0) {
      const end = p.conn.u >= 1 ? 'b' : 'a';
      p.f = c[end].f; p.x = c[end].x; p.y = H.floors[p.f]; p.conn = null;
      st.events.push({ type: 'landing', floor: p.f });
    }
  } else {
    const speed = p.carry ? H.carryWalk : H.walk;
    p.vx = mx * speed;
    p.x = clamp(p.x + p.vx * dt, H.wallL, H.wallR);
    if (Math.abs(mx) > 0.2) p.face = Math.sign(mx);
    if (p.f >= 0 && Math.abs(mx) > 0.2) {
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = p.carry ? 0.42 : 0.3; if (p.carry) st.events.push({ type: 'carryStep' }); }
    }

    if (p.f >= 0) {
      // Mount a connector at its foot (up) or its head (down); walk into the slope.
      for (const c of st.conns) {
        if (!c.on) continue;
        if (c.a.f === p.f && Math.abs(p.x - c.a.x) < 22 && wantUp) { p.conn = { c, u: 0.001 }; break; }
        if (c.b.f === p.f && Math.abs(p.x - c.b.x) < 22 && (wantDown || (c.kind === 'slope' && Math.sign(mx) === Math.sign(c.a.x - c.b.x) && Math.abs(mx) > 0.2))) { p.conn = { c, u: 0.999 }; break; }
      }
      if (p.conn) { p.x = lerp(p.conn.c.a.x, p.conn.c.b.x, p.conn.u); }
      else {
        const nearShutter = p.f === 1 && st.shutter === 'shut' && p.x >= H.shutterX + H.shutterNear[0] && p.x <= H.shutterX + H.shutterNear[1] && !p.carry;
        if (input.a && nearShutter) {
          if (st.carry.stone && !st.stoneThrown) { st.stoneThrown = true; st.throwT = 0; st.events.push({ type: 'stoneThrow' }); }
          else if (st.lockedT <= 0 && st.throwT == null) { st.lockedT = 0.8; st.events.push({ type: "shutterLocked" }); }
        } else if (input.a && !p.carry) {
          p.vy = -H.jump; p.f = -1; p.airTop = p.y; st.events.push({ type: 'leap' });
        } else if (!onSpan(st, p.f, p.x)) {
          p.vy = 0; p.f = -1; p.airTop = p.y;
        }
      }
    }
    if (p.f < 0 && !p.conn) {
      const oy = p.y;
      p.vy += H.gravity * dt; p.y += p.vy * dt;
      p.airTop = Math.min(p.airTop, p.y);
      if (p.vy > 0) {
        for (let f = 0; f < H.floors.length; f++) {
          const fy = H.floors[f];
          if (oy <= fy && p.y >= fy && onSpan(st, f, p.x)) {
            p.f = f; p.y = fy; p.vy = 0;
            p.landT = 0.16;
            const drop = fy - p.airTop;
            st.events.push({ type: drop > 130 ? 'thud' : 'landing', floor: f });
            if (drop > 130) hit(st, { cause: 'fall' });
            break;
          }
        }
      }
      if (p.y > 700) { p.y = H.floors[0]; p.f = 0; p.vy = 0; }
    }
  }

  // Reach her: lift her, and the way you came breaks away behind you.
  if (!p.carry && p.f === 2 && Math.abs(p.x - H.beloved) < 30) {
    p.carry = true; p.liftT = T.lift; p.face = -1;
    st.score += 300;
    st.events.push({ type: 'liftHer' });
    breakAway(st);
    checkpoint(st, 3, houseSnap(st));
  }
  // Out of the door with her.
  const exitRight = st.houseExit?.side === 'right';
  const exitX = st.houseExit?.x ?? H.door;
  if (p.carry && p.f === 0 && (exitRight ? p.x >= exitX - 4 : p.x <= exitX + 4)) {
    setPhase(st, 'quay');
    st.p = { ...p, x: QUAY.x0, y: QUAY.y, f: 0, conn: null, face: 1 };
    st.haz = []; st.nextHaz = 1.2;
    st.events.push({ type: 'houseFall' });
    checkpoint(st, 4, houseSnap(st));
    return;
  }
  stepHazards(st, dt);
}

function breakAway(st) {
  st.broke = true;
  for (const c of st.conns) {
    if (c.id === 'stairs' || c.id === 'ladderUp' || c.id === 'ivy') c.on = false;
    if (c.id === 'ladderDown' || c.id === 'ladderDown2' || c.id === 'slope') c.on = true;
  }
  st.spans[1] = [[380, 580], [650, 800]];
  st.ladderDropT = 0;
  st.events.push({ type: 'floorBreak' });
}

// Beams and stones drop on cue: a shudder and dust first.
export function stepHazards(st, dt) {
  const p = st.p, quay = st.phase === 'quay';
  st.nextHaz -= dt;
  if (st.nextHaz <= 0) {
    const [lo, hi] = quay ? QUAY.every : HOUSE.hazEvery;
    st.nextHaz = lo + st.rand() * (hi - lo);
    const f = quay ? 0 : p.conn ? (p.conn.c.b.f) : p.f >= 0 ? p.f : nearestFloor(p.y);
    const kind = quay || st.rand() < 0.45 ? 'stones' : 'beam';
    const warn = quay ? QUAY.warn : HOUSE.beamWarn;
    const lead = warn + (st.omen ? BEAT_S : 0);
    const lo2 = quay ? QUAY.x0 + 60 : HOUSE.wallL + 20, hi2 = quay ? QUAY.x1 + 40 : HOUSE.wallR - 20;
    const x = clamp(p.x + (p.vx || 0) * (lead * 0.7) + (st.rand() - 0.5) * 30, lo2, hi2);
    st.haz.push({ kind, x, f, wait: lead, warn, omen: st.omen, fallT: 0, landed: false, warned: false, life: 1.4 });
  }
  const floorY = (h) => (quay ? QUAY.y : HOUSE.floors[h.f]);
  for (const h of st.haz) {
    h.wait -= dt;
    if (!h.warned && h.wait <= h.warn) { h.warned = true; st.events.push({ type: h.kind === 'beam' ? 'beamWarn' : 'stoneWarn', x: h.x }); }
    if (h.wait > 0) continue;
    if (!h.landed) {
      h.fallT += dt;
      if (h.fallT >= HOUSE.beamFall) {
        h.landed = true;
        st.events.push({ type: h.kind === 'beam' ? 'beamCrash' : 'debrisCrash', x: h.x, y: floorY(h) });
        const fy = floorY(h), hw = h.kind === 'beam' ? 72 : 44;
        if (Math.abs(p.x - h.x) < hw && p.y <= fy + 4 && p.y > fy - HOUSE.storey + 30) hit(st, { cause: h.kind });
      }
    } else h.life -= dt;
  }
  st.haz = st.haz.filter((h) => h.life > 0);
}
const nearestFloor = (y) => HOUSE.floors.reduce((bi, fy, i) => (Math.abs(fy - y) < Math.abs(HOUSE.floors[bi] - y) ? i : bi), 0);

// ---------------------------------------------------------------- the quay
export function stepQuay(st, dt, input) {
  const p = st.p;
  st.quayT += dt;
  const mx = input.moveX || (input.left ? -1 : 0) || (input.right ? 1 : 0);
  p.vx = mx * HOUSE.carryWalk;
  p.x = clamp(p.x + p.vx * dt, QUAY.x0 - 60, QUAY.x1 + 20);
  if (Math.abs(mx) > 0.2) {
    p.face = Math.sign(mx);
    p.stepT -= dt;
    if (p.stepT <= 0) { p.stepT = 0.42; st.events.push({ type: 'carryStep' }); }
  }
  if (p.x >= QUAY.x1) {
    st.score += 200 + st.lanterns * 100;
    // The film edition (act5film.js) goes on to the barrel, not an ending.
    if (st.part) { st.haz = []; setPhase(st, 'barrel'); st.events.push({ type: 'witchReturns' }); checkpoint(st, 5); return; }
    setPhase(st, 'ending');
    st.haz = [];
    st.events.push({ type: 'ending', ending: st.ending });
    checkpoint(st, 5, houseSnap(st));
    return;
  }
  stepHazards(st, dt);
}

// ---------------------------------------------------------------- endings
export const ENDING_CUES = {
  witch: [[2.2, 'moonboatRise'], [5.2, 'witchClaim']],
  lamp: [[2.4, 'lampLit']],
  dark: [[3.2, 'stoneThrow'], [4.1, 'stonePlop']],
};

function stepEnding(st) {
  for (const [at, type] of ENDING_CUES[st.ending]) {
    if (st.phaseT >= at && !st['cue_' + type]) { st['cue_' + type] = true; st.events.push({ type }); }
  }
  if (st.phaseT >= T.ending) {
    setPhase(st, 'pageant');
    st.events.push({ type: 'pageant' });
    checkpoint(st, 6, houseSnap(st));
  }
}

// Pageant schedule: the backcloth flies in, the dancers take the line, each
// woken reveller steps in, the Sea King and the witch, then the band.
export const PAGEANT = { fly: 1.6, dancers: 1.0, joinFrom: 2.4, joinTo: 6.0, court: 3.2, band: 4.0, applause: 8.5 };
export const joinAt = (i, n) => PAGEANT.joinFrom + (n <= 1 ? 0 : (i * (PAGEANT.joinTo - PAGEANT.joinFrom)) / (n - 1));

function stepPageant(st) {
  const n = st.sleepersShown;
  while (st.joined < n && st.phaseT >= joinAt(st.joined, n)) { st.joined++; st.events.push({ type: 'pageantJoin', n: st.joined }); }
  if (st.phaseT >= PAGEANT.applause && !st.applauded) { st.applauded = true; st.events.push({ type: 'pageantApplause' }); }
  if (st.phaseT >= T.pageant) setPhase(st, 'iris');
}

// The film edition's climbs (act5film.js): the cliff's top leads to the dive,
// the tower wall's to the window.
export function reachTop(st, h) {
  st.score += 200; st.walkFromX = h.x;
  st.events.push({ type: 'clifftop' });
  setPhase(st, st.phase === 'cliff' ? 'dive' : 'window');
}

function win(st) {
  st.status = 'won'; st.statusT = 0;
  st.result = { ending: st.ending, keepsakes: {}, score: st.score, pearls: st.pearls };
}
