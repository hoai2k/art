// Prologue — The Betrothal (film edition only; design/film-adaptation.md).
// Tableaux 1-11 of the film, played on the delivered sets with the cast's
// cut-outs, leading straight into Act I (`intro: true`, src/main.js):
// - the betrothal court: the prince, in his court dress, receives the four
//   fairies' gifts for his bride and takes Azurine's hand; the uninvited witch
//   curses the betrothal, and she and her demons seize Azurine and fly off
//   with her;
// - the rampart: her demons' chariot of fire carries Azurine off, and he runs
//   after it along the parapet, leaping the fire it drops;
// - the armoury: the witch binds him and he struggles against her cords
//   until Aurora comes on and breaks the spell; he takes up the helmet,
//   shield and enchanted sword she gives him, lying between them, each worn
//   as a badge until all three turn him into the armoured prince. He kneels
//   while she goes off to the left, up the stairs, and then goes to his ship
//   off either side.
// The fire it drops burns on: leap it, or each touch costs one of three
// lanterns of health; at none the chase starts again. B skips a scene.
// Headless: drawing is in prologue-art.js.
import { clamp } from './shared.js';
import * as art from './prologue-art.js';

export const BEAT_S = 60 / 76.5;
export const FLOOR = 600;                       // the court's floor
export const ARM_FLOOR = 650;                   // the armoury's flagstones, toward their front edge (by the racks' bases)
export const PHYS = { g: 2000, jump: 760, walk: 250, acc: 2200, cut: 2400, buffer: 0.13 };
export const REACH = 70;                        // how near he must stand to take or give
// Who stands where in the court (stage px, feet on the floor unless `y`).
export const GIFTS = ['flower', 'ring', 'crown', 'gold'];
// `hand`: where she holds her gift out, stage px from her centre (toward him).
export const FAIRIES = [
  { gift: 'flower', id: 'aurora-stand', x: 300, hand: -34, name: 'Aurora' },
  { gift: 'ring', id: 'fairy-ring', x: 450, hand: -50, name: 'the fairy of the ring' },
  { gift: 'crown', id: 'fairy-crown', x: 600, hand: -38, name: 'the fairy of the crown' },
  { gift: 'gold', id: 'fairy-gold', x: 750, hand: -46, name: 'the fairy of gold' },
];
// He takes a gift with either hand, within GRASP of where she holds it: the
// outstretched one (prince-court's right hand, HAND ahead of his centre) or
// the one at his side (NEAR_HAND behind it).
export const HAND = 55, NEAR_HAND = -18, GRASP = 42;
export const handX = (p) => p.x + p.face * HAND;
export const handsX = (p) => [p.x + p.face * HAND, p.x + p.face * NEAR_HAND];
export const AZURINE_X = 1080;
export const COURT_START = 205;   // just inside the left curtain
// The rampart: a 2560-wide walk along the parapet; the chariot stays ahead.
// y: where he walks on the painted parapet: the front of rampart-strip's coping
// (its top face runs y 482-490), in line with the gargoyles' bases
// The coping steps down in perspective over the strip's first 600 px.
export const rampartFloor = (x) => (x <= 440 ? 508 : x >= 600 ? 494 : 508 - ((x - 440) / 160) * 14);
export const RAMPART = { w: 2560, y: 494, end: 2260, lead: 340, speed: 210, catchUp: 320, dropEvery: 1.25, fireW: 30, knock: 330, grace: 1.6 };
export const LANTERNS = 3;
// Stage x past which a figure is hidden by the right curtain and off.
export const OFFSTAGE_X = 1180;
export const CHARIOT_Y = 165;
// The armoury: he is bound at the right; Aurora comes on from the stairs at
// the left, and his arms lie between, in the order he reaches them.
export const BOUND_X = 1010;
export const ARMS = [{ id: 'helmet', x: 820 }, { id: 'shield', x: 640 }, { id: 'sword', x: 460 }];
export const AURORA = { from: -110, at: 250, to: -140 };   // her glide on, where she casts, and off
export const EXIT_X = [50, 1180];   // the ways out of the armoury, once armed: up the stairs at the left, or off at the right
export const WIGGLES = 4;     // pulls against the cords: any button or push of the stick
// bind: the witch's binding; free: Aurora glides on (on) and the witch flees
// (flee to fled), Aurora casts (cast: the cords break) and the scene moves on; knighted: the last badge settles
// (badge), he is armoured at `armed` and kneels while she glides off (from
// `leave`, taking `off`), and stands again at `risen`.
export const T = {
  defeat: 1.4, curse: 6.6, escape: 1.1, bind: 1.8, strained: 0.5, free: 2.3, on: 1.2, cast: 1.9, flee: 0.35, fled: 1.25,
  badge: 1.75, armed: 3.85, leave: 4.5, off: 1.5, risen: 6.1, iris: 1.3, fade: 0.6,
};
const ORDER = ['court', 'curse', 'rampart', 'escape', 'bind', 'free', 'armoury', 'knighted', 'iris'];
// The curse, then the abduction (curse phase, seconds): Azurine swoons, the
// witch takes flight and her demons run on, they seize the princess and fly
// off with her into the night.
export const ABDUCT = { swoon: 2.4, swoop: 2.8, seize: 3.8, off: 4.4, gone: 6.0 };
export const SCENES = [{ name: 'The Betrothal' }, { name: 'The Abduction' }, { name: 'The Arming' }];
const SCENE_PHASE = ['court', 'rampart', 'bind'];
export const sceneOf = (phase) => (['court', 'curse'].includes(phase) ? 0 : ['rampart', 'escape'].includes(phase) ? 1 : 2);

export default {
  id: 0, key: 'prologue', kicker: 'Prologue', title: 'The Betrothal', size: 120, page: 6, intro: true,
  sub: 'Receive the fairies’ gifts for your bride.',
  action: 'A: take, give, leap',
  scenes: SCENES,
  mood: (st) => (['curse', 'rampart', 'escape', 'bind'].includes(st.phase) ? 'storm' : ['free', 'armoury', 'knighted', 'iris'].includes(st.phase) ? 'tender' : 'revel'),
  touchVerbB: (st) => (st.status === 'play' && st.phase !== 'iris' ? 'Skip' : ''),
  touchLive: (st) => ['court', 'rampart', 'armoury'].includes(st.phase) || (st.phase === 'knighted' && st.phaseT >= T.risen),
  touchVerb: (st) => (st.phase === 'rampart' ? 'Leap' : st.near ? st.near.verb : ''),
  touchHint: 'drag to walk, tap to take or leap',
  touchScheme: () => ({ mode: 'swipe', hint: 'Drag ↔ to walk · tap to take, give or leap' }),

  create({ from = null } = {}) {
    const st = {
      status: 'play', statusT: 0, events: [], result: null, checkpoint: null,
      phase: 'court', phaseT: 0, t: 0, beat: 0, fade: 0,
      p: { x: COURT_START, y: FLOOR, vx: 0, vy: 0, face: 1, on: true, walk: 0, buffer: 0, knockT: 0 },
      gifts: [], betrothed: false, near: null,
      chariot: { x: 0, y: 250, up: 0 }, fires: [], dropT: 0, knocks: 0, lanterns: LANTERNS, grace: 0, defeatT: null,
      arms: [], armed: false, score: 0, struggle: { n: 0, dir: 0, tilt: 0, doneT: 0, held: false },
    };
    const k = clamp(from?.scene | 0, 0, SCENES.length - 1);
    if (k > 0) { enter(st, SCENE_PHASE[k]); st.gifts = [...GIFTS]; st.betrothed = true; st.checkpoint = { scene: k }; }
    return st;
  },

  step(st, dt, input = {}) {
    st.statusT += dt; st.t += dt;
    st.beat = input.beat ?? st.t / BEAT_S;
    if (st.status !== 'play') return;
    st.phaseT += dt;
    st.fade = Math.max(0, st.fade - dt / T.fade);
    const ph = st.phase;
    // B skips to the next scene (or out of the prologue from the last).
    if (st.defeatT != null) {
      // out of lanterns: he falls, then the retry card (the chase again)
      st.defeatT += dt;
      if (st.defeatT >= T.defeat) { st.status = 'lost'; st.statusT = 0; }
      return;
    }
    if (input.b && st.phaseT > 0.3) return skip(st);
    if (ph === 'court') court(st, dt, input);
    else if (ph === 'curse') {
      walk(st, dt, input.moveX || 0, input, { x1: AZURINE_X - 50 });
      const was = st.phaseT - dt, at = (q) => was < q && st.phaseT >= q;
      if (at(ABDUCT.swoop)) st.events.push({ type: 'witchSwoop', sound: 'witchBreath', gain: 0.7 });
      if (at(ABDUCT.seize)) st.events.push({ type: 'seized', sound: 'fireRoar', gain: 0.5 });
      // her cackle over the wind machine, as in the Crossing
      if (at(ABDUCT.off)) st.events.push({ type: 'carriedOff', sound: 'windWarn' });
      if (st.phaseT >= T.curse) next(st);
    }
    else if (ph === 'rampart') rampart(st, dt, input);
    // at the door he runs on through it himself, at full stride, and the
    // scene moves on only once he is off the stage (past the right curtain)
    // as the chariot climbs away
    else if (ph === 'escape') {
      st.p.vx = Math.max(st.p.vx, PHYS.walk);
      walk(st, dt, 1, {}, { floor: rampartFloor, x0: 60, x1: RAMPART.w + 400 }); st.chariot.up += dt;
      if (st.p.x - (RAMPART.w - 1280) > OFFSTAGE_X + 70 || st.phaseT >= T.escape * 3) next(st);   // his whole figure (half 70 px) past it
    }
    else if (ph === 'bind') bind(st, dt, input);
    else if (ph === 'free') {
      const was = st.phaseT - dt;
      if (was < T.flee && st.phaseT >= T.flee) st.events.push({ type: 'witchFlees', sound: 'witchBreath', gain: 0.7 });
      if (was < T.cast && st.phaseT >= T.cast) st.events.push({ type: 'unbound', x: st.p.x, sound: 'keepsake', gain: 0.8 });
      walk(st, dt, st.phaseT >= T.cast ? input.moveX || 0 : 0, input, { floor: ARM_FLOOR, x1: 1200 });
      if (st.phaseT >= T.free) next(st);
    }
    else if (ph === 'armoury') armoury(st, dt, input);
    else if (ph === 'knighted') knighted(st, dt, input);
    else if (ph === 'iris') { walk(st, dt, st.exitSide || -1, {}, { floor: ARM_FLOOR, x0: -200, x1: 1480 }); if (st.phaseT >= T.iris) finish(st); }
  },

  hud: (st) => (st.phase === 'rampart' || st.phase === 'escape'
    ? { lanterns: st.lanterns, maxLanterns: LANTERNS, pearls: 0, progress: clamp(st.p.x / RAMPART.end, 0, 1), keepsakes: null } : null),

  announce(e) {
    if (e.type === 'scene') return {
      court: 'The betrothal court. Walk to each fairy and press A to receive her gift for Princess Azurine.',
      curse: 'The witch, uninvited, curses the betrothal.',
      rampart: "Her demons bear Azurine away in a chariot of fire. Run after it along the rampart; leap the fire it drops.",
      bind: 'In the armoury the witch binds the prince, and laughs at him.',
      free: 'Aurora comes; the witch flees, and Aurora breaks the spell.',
      armoury: 'Take up the helmet, the shield and the enchanted sword Aurora gives you.',
    }[e.phase] || null;
    if (e.type === 'gift') return `${e.from} gives ${e.gift === 'gold' ? 'gold' : 'the ' + e.gift}.`;
    if (e.type === 'betrothed') return 'The prince takes Azurine’s hand.';
    if (e.type === 'witchFlees') return 'The witch flees from Aurora.';
    if (e.type === 'seized') return 'The witch and her demons seize the princess.';
    if (e.type === 'carriedOff') return 'They carry Azurine away.';
    if (e.type === 'arm') return `The ${e.arm}.`;
    if (e.type === 'armed') return 'Armed for the rescue.';
    if (e.type === 'toShip') return 'Go to your ship.';
    return null;
  },

  focus: art.focus, draw: art.draw, drawOver: art.drawOver, onEvent: art.onEvent,
};

// Walking (and leaping, where `leap`): the floor at the scene's height, or
// a function of x where the painted floor is not level.
function walk(st, dt, mx, input = {}, { leap = false, floor = FLOOR, x0 = 40, x1 = 1240 } = {}) {
  const p = st.p, floorAt = typeof floor === 'function' ? floor : () => floor;
  if (p.knockT > 0) { p.knockT -= dt; mx = 0; }
  if (Math.abs(mx) > 0.15) p.face = Math.sign(mx);
  p.vx += clamp(mx * PHYS.walk - p.vx, -PHYS.acc * dt, PHYS.acc * dt);
  p.buffer = input.a ? PHYS.buffer : Math.max(0, p.buffer - dt);
  if (leap && p.on && p.buffer > 0) { p.vy = -PHYS.jump; p.on = false; p.buffer = 0; st.events.push({ type: 'hop' }); }   // silent: only the landing is heard
  if (!p.on) {
    p.vy += (PHYS.g + (p.vy < 0 && !input.aHeld ? PHYS.cut : 0)) * dt;
    p.y += p.vy * dt;
    if (p.y >= floorAt(p.x)) { p.y = floorAt(p.x); p.vy = 0; p.on = true; st.events.push({ type: 'land', sound: 'thud', gain: 0.22 }); }
  }
  p.x = clamp(p.x + p.vx * dt, x0, x1);
  if (p.on) { p.y = floorAt(p.x); p.walk += Math.abs(p.vx) * dt; }
}

function court(st, dt, input) {
  walk(st, dt, input.moveX || 0, input, { x1: AZURINE_X - 50 });
  const p = st.p;
  // who he is beside, and what A does there
  const f = FAIRIES.find((q) => !st.gifts.includes(q.gift) && handsX(p).some((hx) => Math.abs(q.x + q.hand - hx) < GRASP));
  const done = st.gifts.length === GIFTS.length;
  st.near = f ? { verb: 'Receive', at: f.x, label: `Receive ${f.gift === 'gold' ? 'the gold' : 'the ' + f.gift}` }
    : done && Math.abs(AZURINE_X - 60 - p.x) < REACH ? { verb: 'Take her hand', at: AZURINE_X, label: 'Take her hand' }
      : null;
  if (!input.a || !st.near) return;
  if (f) {
    st.gifts.push(f.gift); st.score += 50;
    st.events.push({ type: 'gift', gift: f.gift, from: f.name, x: f.x, n: st.gifts.length, t: st.t });
  } else { st.betrothed = true; st.near = null; st.events.push({ type: 'betrothed' }); next(st); }
}

function rampart(st, dt, input) {
  const R = RAMPART, p = st.p, ch = st.chariot;
  walk(st, dt, input.moveX || 0, input, { leap: true, floor: rampartFloor, x0: 60, x1: R.w - 100 });
  // the chariot keeps its lead, faster when he gains on it
  const gap = ch.x - p.x;
  ch.x += (gap < R.lead ? R.catchUp : R.speed) * dt;
  ch.y = CHARIOT_Y + Math.sin(st.t * 1.7) * 14;   // above the gargoyles' heads (y 300)
  // it drops fire on the parapet ahead of him
  st.dropT += dt;
  if (st.dropT >= R.dropEvery && ch.x < R.end + 200) { st.dropT = 0; st.fires.push({ x: ch.x - 40, y: ch.y + 40, vy: 0, burn: 0, lit: false }); st.events.push({ type: 'fireDrop' }); }
  st.grace = Math.max(0, st.grace - dt);
  for (const f of st.fires) {
    if (!f.lit) { f.vy += 1400 * dt; f.y += f.vy * dt; if (f.y >= rampartFloor(f.x)) { f.y = rampartFloor(f.x); f.lit = true; st.events.push({ type: 'fireLand', x: f.x }); } }
    else f.burn += dt;
    // the fire burns on: leap it, or touching it costs a lantern
    if (f.lit && st.grace <= 0 && Math.abs(p.x - f.x) < R.fireW && p.y > rampartFloor(p.x) - 40) {
      p.knockT = 0.45; p.vx = -R.knock * Math.sign(f.x - p.x || 1); p.vy = -280; p.on = false; st.knocks++;
      st.lanterns--; st.grace = R.grace;
      st.events.push({ type: 'scorched', x: p.x }, { type: 'hit' });
      if (st.lanterns <= 0) {
        st.defeatT = 0;
        st.lostTitle = 'The Chariot\nGets Away'; st.lostSub = 'Leap the fire it drops: touching it costs a lantern.';
      }
    }
  }
  if (p.x >= R.end) next(st);
}

// Bound: once the witch has gone, whatever he presses (a button, or a push
// of the stick or keys in any direction) is a pull against her cords, each
// the other way from the last; no instruction is needed. They strain at
// every pull, as if they might give; then Aurora comes.
function bind(st, dt, input) {
  const s = st.struggle, mx = input.moveX || 0, my = input.moveY || 0;
  // the witch laughs at him once she has bound him, and again as he strains
  const was = st.phaseT - dt;
  if (was < T.bind && st.phaseT >= T.bind) laugh(st);
  if (st.phaseT < T.bind) return;
  const pushing = Math.hypot(mx, my) > 0.5, side = Math.abs(mx) > 0.5 ? Math.sign(mx) : 0;
  const fresh = input.a || input.x || (pushing && (!s.held || (side && side !== s.heldSide)));
  s.held = pushing; s.heldSide = side;
  if (fresh && s.n < WIGGLES) {
    // the way he leans: the stick's, when it is pushed sideways, else the
    // other way from his last pull
    s.dir = Math.abs(mx) > 0.5 && Math.sign(mx) !== s.dir ? Math.sign(mx) : -(s.dir || 1);
    s.n++; s.pullT = 0.3;
    st.events.push({ type: 'strain', n: s.n, x: st.p.x, sound: 'timberCreak', gain: 0.25 + 0.08 * s.n });
    if (s.n === 2) laugh(st);
  }
  // he leans into each pull, and back upright between them
  s.pullT = Math.max(0, (s.pullT || 0) - dt);
  const want = s.n < WIGGLES || s.pullT > 0 ? (s.pullT > 0 || pushing ? s.dir : 0) * 0.16 : 0;
  s.tilt += (want - s.tilt) * Math.min(1, dt * 14);
  if (s.n >= WIGGLES && (s.doneT += dt) >= T.strained) next(st);
}

// The witch's cackle (witchCackle, design/source/build_sfx.py).
function laugh(st) {
  st.laughAt = st.phaseT;
  st.events.push({ type: 'witchCackle', sound: 'witchCackle', gain: 0.8 });
}

function armoury(st, dt, input) {
  walk(st, dt, input.moveX || 0, input, { floor: ARM_FLOOR, x1: 1200 });
  const p = st.p, a = ARMS.find((q) => !st.arms.includes(q.id) && Math.abs(q.x - p.x) < REACH);
  st.near = a ? { verb: 'Take', at: a.x, label: `Take the ${a.id}` } : null;
  if (input.a && a) {
    st.arms.push(a.id); st.score += 50;
    st.events.push({ type: 'arm', arm: a.id, x: a.x, n: st.arms.length, t: st.t });
    if (st.arms.length === ARMS.length) { st.events.push({ type: 'knighted' }); next(st); }
  }
}

// The last badge settles, the three are drawn into him and he is armoured;
// he kneels while Aurora glides off, then goes out to his ship, off either
// side.
function knighted(st, dt, input) {
  const was = st.phaseT - dt;
  if (was < T.armed && st.phaseT >= T.armed) { st.armed = true; st.events.push({ type: 'armed', x: st.p.x, sound: 'lampLit' }); }
  if (was < T.risen && st.phaseT >= T.risen) st.events.push({ type: 'toShip' });
  if (st.phaseT < T.risen) { st.p.vx = 0; return; }
  walk(st, dt, input.moveX || 0, input, { floor: ARM_FLOOR, x0: -100, x1: 1400 });
  if (st.p.x <= EXIT_X[0] || st.p.x >= EXIT_X[1]) { st.exitSide = st.p.x <= EXIT_X[0] ? -1 : 1; next(st); }
}

function enter(st, phase) {
  st.phase = phase; st.phaseT = 0; st.near = null;
  const p = st.p;
  if (phase === 'rampart') { Object.assign(p, { x: 240, y: rampartFloor(240), vx: 0, vy: 0, on: true, face: 1, knockT: 0 }); st.chariot = { x: 480, y: CHARIOT_Y, up: 0 }; st.fires = []; st.dropT = 0; st.fade = 1; st.lanterns = LANTERNS; st.grace = 0; }
  if (phase === 'bind') { Object.assign(p, { x: BOUND_X, y: ARM_FLOOR, vx: 0, vy: 0, on: true, face: -1 }); st.fade = 1; st.struggle = { n: 0, dir: 0, tilt: 0, doneT: 0, held: false }; st.armed = false; }
  if (phase === 'curse') p.vx = 0;
  st.events.push({ type: 'scene', phase });
  const k = SCENE_PHASE.indexOf(phase);
  if (k > 0) st.checkpoint = { scene: k };
}
function next(st) { enter(st, ORDER[ORDER.indexOf(st.phase) + 1]); }

// B: on to the start of the next scene (taking what the skipped one gave).
function skip(st) {
  const k = sceneOf(st.phase);
  if (k === 0) { st.gifts = [...GIFTS]; st.betrothed = true; return enter(st, 'rampart'); }
  if (k === 1) return enter(st, 'bind');
  st.arms = ARMS.map((a) => a.id); st.armed = true;
  return st.phase === 'iris' ? finish(st) : enter(st, 'iris');
}

function finish(st) {
  st.status = 'won'; st.statusT = 0;
  st.result = { keepsakes: {}, score: st.score, pearls: 0 };
}
