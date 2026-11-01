// Garbage Canary: Bin Day.
//
// A windy street on bin day, and things blowing down it from the right at
// all depths, some along the pavement, some out over the cobbles. The Garbage
// Canary is a dustbin on legs with a canary living inside it. You walk the
// bin about (left and right a little, and back and forth across the pavement
// and the road) and hold the action to lift its lid. While the lid is up the
// canary rises out of the bin, reaches for whatever passes within reach in
// the bin's lane, grips it in its beak, pulls it down into the bin and pops
// back up. Anything that passes right through the open mouth falls in too.
//
// Rubbish in the bin: +1, and every five in a row earns a bonus that grows
// with the run. But not everything is rubbish: a cat, a gentleman's hat, a
// letter, a sparrow (each glows gold). Swallow one and the canary splutters
// it out (−1) and the lid stays shut a moment. Keep the lid shut, or step
// into another lane, to let those go by without knocking them away.
//
// The lid is physical. Shut it while the canary is pulling something in and
// the lid slams it home; shut it while the canary is still reaching and the
// lid pushes canary and catch into the bin; shut it on something just at the
// mouth and that is caught too (snap down on top). Open it under something
// just above or behind the lid and the lid knocks that thing back out of the
// way. It starts gentle; things come faster and closer together as time goes
// on, more of them aren't rubbish, and gusts hurry some along. Score: points.
//
// Controls: the stick, D-pad, arrows or WASD walk the bin (up and down is
// across the street); hold the action for the lid. Mouse or touch: press on
// the bin and hold to lift the lid, dragging moves it with the lid up; press
// anywhere else and the bin walks to that spot with its lid shut.

import { drawBird, drawSprite, scene, art, SHEETS, band, blob, poly, wash, ink, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  // paper ball, banana peel, tin can, apple core, fish bone; hat, letter, cat, sparrow, old boot
  'sprites.garbageItems': [5, 2],
  // the bin without its lid; the lid with the canary's head under it (same placement)
  'sprites.garbagecanaryLid': [2, 1],
  // the lid piece again, the canary squawking (spitting something out); singing (a run)
  'sprites.garbagecanaryCall': [2, 1],
  // the canary out of the bin: ready, reaching, gripping; pulling in, squawking, singing
  'sprites.garbagecanaryNeck': [3, 2],
  // the lid alone, no canary under it
  'sprites.garbagecanaryLidOnly': [1, 1],
  // the bin piece walking, four frames
  'sprites.garbagecanaryWalk': [4, 1],
});

const DURATION = 45;
// The street (IC-M08a): the paving runs from the house fronts at 582 px to
// the kerb at 705, the cobbles from 745 to the bottom. The bin's feet walk
// anywhere from just in front of the houses to well out on the road, and
// things blow along at any depth in that band.
const PAVE = 690; // (the stand-in street's pavement)
const DEPTH0 = 612;
const DEPTH1 = 862;
const X0 = 200; // how far the bin may walk left and right
const X1 = 900;
const WALK = 430; // px/s left and right
const STEP = 300; // px/s across the street
const SIZE = 300; // the bin's drawn size at the middle of the band
const depthScale = (y) => lerp(0.88, 1.12, (y - DEPTH0) / (DEPTH1 - DEPTH0));
// The bin's rim and the lid's hinge, in bird units (feet at 0, facing left
// as drawn; the game flips it to face the wind). The painting's rim slants a
// little, higher at the front; measured on the 1024 px painting: front rim
// (278, 245) px, back rim and hinge (725, 290) px.
const RIM = {
  // the mouth (the rim's middle) is at (476, 285) px in the bin piece's cell, 15 units in front of the centre line
  painted: { front: [-140, -303], back: [140, -285], hinge: [104, -276], mouth: [-15, -290] }, // hinge: the lid's back corner, (766, 319) px
  standin: { front: [-140, -250], back: [140, -250], hinge: [92, -250], mouth: [0, -250] },
};
const OPEN_ANGLE = 1.15;
const JAM = 0.6; // seconds the lid stays shut after swallowing something that isn't rubbish
const LANE = 85; // how close in depth something must pass to be in the bin's lane
const CURIOUS = 200; // px/s: how fast cats and sparrows turn towards an open bin
// The canary's reach, in bird units: its head sits NECK_UP above the mouth
// when ready and can stretch NECK_REACH towards something.
const NECK_UP = 50;
const NECK_REACH = 130;
const HEAD_SPEED = 1900; // px/s, reaching
const RISE_SPEED = 280; // px/s, climbing out of the bin
const PULL_SPEED = 420; // px/s, pulling something down into the bin (slow enough to see)
// A bin left gaping: after FRESH seconds open without catching anything the
// canary loses interest and ducks back in; after WHISK seconds the wind
// starts whisking the top piece of rubbish back out, every WHISK_EVERY.
const FRESH = 1.3;
const WHISK = 2.4;
const WHISK_EVERY = 1.2;
const LEAD_IN = 300; // things start this far off the right edge, shown by an arrow there
const MOUTH_R = 95; // bird units: anything passing this close to the mouth's middle falls in
// The canary neck sheet (IC-M08e): each cell's neck base on its centre line
// 88% down.
const NECK_BASE = 0.88; // (as requested; the delivered sheet is registered by REG below)
// How the delivered pieces register: every piece is drawn at the scale of
// the bin-and-lid sheet (IC-M08c, the portrait's framing), worked out from a
// feature that never changes size, measured on every cell by
// design/source/measure_sprites.py (sprite-measures.json; the test checks
// them): the bin's rim width, each lid's length from front tip to back
// corner, the canary's eye. Never from a cell's or a painting's height.
//  - Walk frames (IC-M08g): painted smaller (rim 390-396 px against 482) and
//    lower, each a little shifted; each frame's rim top-middle goes on the
//    sheet's (476.5, 269).
//  - The lid alone (IC-M08f): longer (548 against 594) and placed elsewhere;
//    its front tip goes on the shut lid's.
//  - The calling lids (IC-M08d): bigger (644 and 636 against 594), likewise.
//  - The canary's head and neck (IC-M08e): smaller (eye 41-44 px against
//    57.5); each pose is placed by its eye, which is where the game's head
//    is, with its neck's base and beak tip as measured.
const SHEET_RIM = { x: 476.5, top: 269, width: 482 };
const LID = { front: [207, 118.5], back: [766, 319] };
const EYE = 57.5;
const lidLen = (l) => Math.hypot(l.back[0] - l.front[0], l.back[1] - l.front[1]);
const onLid = (l) => ({ from: l.front, to: LID.front, s: lidLen(LID) / lidLen(l) });
const WALK_RIMS = [[274, 663, 447], [244, 639, 439], [245, 635, 447], [245, 640, 439]]; // x0, x1, top
export const REG = {
  walk: WALK_RIMS.map(([x0, x1, top]) => ({ from: [(x0 + x1) / 2, top], to: [SHEET_RIM.x, SHEET_RIM.top], s: SHEET_RIM.width / (x1 - x0 + 1) })),
  lidOnly: onLid({ front: [242, 165], back: [758, 349.5] }),
  call: [onLid({ front: [160, 122], back: [767, 338.5] }), onLid({ front: [167, 125], back: [767, 337] })],
  neck: [
    { eye: [441, 765], base: [498, 906], tip: [290, 772], eyeD: 44 }, // ready
    { eye: [433, 630], base: [508, 902], tip: [296, 635], eyeD: 41 }, // reaching
    { eye: [442, 653], base: [515, 902], tip: [314, 632], eyeD: 41 }, // gripping
    { eye: [403, 817], base: [507, 902], tip: [284, 879], eyeD: 41 }, // pulling in
    { eye: [441, 745], base: [469, 902], tip: [284, 703], eyeD: 41 }, // squawking
    { eye: [459, 748], base: [478, 902], tip: [296, 703], eyeD: 41 }, // singing
  ].map((n) => ({ ...n, s: EYE / n.eyeD })),
};
const BIG = 1.3; // things on the wind are drawn this much bigger than their base size
// The painted things on the wind (IC-M08b), measured: each one's painted
// width and height in its 512 px cell, and the length the game draws its
// longer side at.
const ITEM_BOX = [[281, 238], [400, 244], [306, 199], [183, 282], [404, 179], [255, 205], [299, 227], [405, 222], [273, 230], [330, 218]];
const ITEM_LONG = { cat: 130, sparrow: 84, fishbone: 112, peel: 100, boot: 100, letter: 92 };
const ITEM_R = 40; // a thing's catching radius at depth scale 1

// What blows down the street. `rub`: rubbish. `move`: how it travels.
const KINDS = {
  paper: { rub: true, move: 'flutter', col: '#efe6cc', i: 0, name: 'paper' },
  peel: { rub: true, move: 'flutter', col: PAL.lemon, i: 1, name: 'banana peel' },
  tin: { rub: true, move: 'bounce', col: '#a8aeb0', i: 2, name: 'tin' },
  core: { rub: true, move: 'bounce', col: '#d8c890', i: 3, name: 'apple core' },
  fishbone: { rub: true, move: 'flutter', col: '#e8e0d0', i: 4, name: 'fish bones' },
  boot: { rub: true, move: 'bounce', col: '#7a5a3a', i: 9, name: 'old boot' },
  hat: { rub: false, move: 'flutter', col: '#3a3030', i: 5, name: 'hat' },
  letter: { rub: false, move: 'flutter', col: '#f6f0e0', i: 6, name: 'letter' },
  cat: { rub: false, move: 'leap', col: PAL.orange, i: 7, name: 'cat' },
  sparrow: { rub: false, move: 'fly', col: '#a07a50', i: 8, name: 'sparrow' },
};
const RUBBISH = ['paper', 'peel', 'tin', 'core', 'fishbone', 'boot'];
const KEEP = ['hat', 'letter', 'cat', 'sparrow'];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const rim = art('subject.garbagecanary') ? RIM.painted : RIM.standin;
  const RIM_U = rim.mouth[1]; // the mouth's height, bird units (negative)
  const MOUTH_DX = -rim.mouth[0]; // and how far in front of the feet (the bin faces right)
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    bx: 520, // the bin's feet
    by: 700,
    walkT: 0, // walk cycle, in steps
    moving: 0,
    target: null, // where a pointer sent it
    grabbed: null, // pointer holding the bin: offset from finger to feet
    open: 0, // the lid, 0 shut .. 1 up
    holding: false,
    // the canary: 'in' (under the lid) | 'rise' | 'up' | 'reach' | 'pull' | 'pop'
    can: 'in',
    canT: 0,
    head: [0, 0], // the head, relative to the mouth, px
    held: null, // what it has in its beak
    aim: null, // what it is reaching for
    items: [],
    pops: [],
    litter: [],
    wind: [],
    spawnT: 1.0,
    streak: 0,
    binned: 0,
    swallowed: 0,
    missed: 0,
    letPast: 0,
    knocked: 0,
    slams: 0,
    gulp: 0,
    spit: 0,
    sing: 0,
    jam: 0,
    lastKeep: false,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // How hard it is now, 0 to 1, along the shared curve for the chosen
  // Difficulty (see difficulty.js): slow things, mostly rubbish, mostly in
  // the bin's own lane and no gusts at first. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.windSpeed = () => knob(g.d(), 225, 320, 550); // how fast things blow along, px/s
  g.keepChance = () => knob(g.d(), 0.22, 0.32, 0.55); // share that isn't rubbish
  g.nearShare = () => knob(g.d(), 1, 0.3, 0.25); // rubbish that comes near the bin's lane
  g.nearSpread = () => knob(g.d(), 150, 230, 420); // how far from the bin's lane "near" is, px across
  g.gustChance = () => (g.elapsed > 14 ? knob(g.d(), 0.05, 0.15, 0.4) : 0); // no gusts in the first 14 s
  g.spawnGap = () => knob(g.d(), 1.35, 1.1, 0.5); // seconds between things, on average
  function pop(text, x, y, color = INK, size = 44) {
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }
  const add = (n) => {
    g.score = Math.max(0, g.score + n);
  };

  // The bin's geometry, for its current place (also for the tests and bots).
  g.scale = () => depthScale(g.by);
  g.ks = () => (SIZE * g.scale()) / 400; // px per bird unit
  g.mouth = () => [g.bx + MOUTH_DX * g.ks(), g.by + RIM_U * g.ks()];
  g.inLane = (it) => Math.abs(it.lane - g.by) < LANE;
  const itemR = (it) => ITEM_R * depthScale(it.lane);

  function spawn() {
    // the first one is always rubbish; never three keepers in a row
    const keepChance = g.binned + g.missed + g.items.length === 0 ? 0 : g.keepChance();
    let keep = rng() < keepChance;
    if (g.lastKeep && keep && rng() < 0.5) keep = false;
    g.lastKeep = keep;
    const kind = keep ? KEEP[Math.floor(rng() * KEEP.length)] : RUBBISH[Math.floor(rng() * RUBBISH.length)];
    const k = KINDS[kind];
    const base = g.windSpeed();
    const speed = base * (0.9 + rng() * 0.2) * (kind === 'cat' ? 0.85 : 1);
    // early on, rubbish comes near the bin's lane; later, anywhere
    const near = clamp(g.by + (rng() - 0.5) * g.nearSpread(), DEPTH0 + 8, DEPTH1 - 8);
    // things that aren't rubbish tend to come your way (step aside, or keep
    // the lid shut); rubbish comes anywhere, but near you at first
    const anywhere = DEPTH0 + 8 + rng() * (DEPTH1 - DEPTH0 - 16);
    const lane = !k.rub ? clamp(g.by + (rng() - 0.5) * 140, DEPTH0 + 8, DEPTH1 - 8) : rng() < g.nearShare() ? near : anywhere;
    const gust = rng() < g.gustChance() ? 1100 - rng() * 300 : null;
    g.items.push({ kind, rub: k.rub, lane, x: W + LEAD_IN, y: lane, vx: -speed, vy: 0, t: 0, phase: rng() * 6, amp: 40 + rng() * 60, hop: 220 + rng() * 140, gust, gusted: false, state: 'come', rot: 0, spin: (rng() - 0.5) * 4, life: 0 });
    g.spawnT = Math.max(0.42, g.spawnGap() * (0.75 + rng() * 0.5));
  }

  // How high it is above its lane's ground: it drifts about, and settles to
  // the height of a bin's mouth as it comes up to the bin.
  function altitude(it) {
    const k = KINDS[it.kind];
    const mouthH = -RIM_U * (SIZE * depthScale(it.lane)) / 400;
    const dx = it.x - g.bx;
    const fade = clamp((Math.abs(dx) - 40) / 600, 0, 1);
    if (k.move === 'flutter') return mouthH + 10 + Math.sin(it.phase + it.t * 3.2) * it.amp * fade;
    if (k.move === 'fly') return mouthH + 30 * fade + Math.sin(it.phase + it.t * 9) * 12 * fade;
    if (k.move === 'bounce') return mouthH + Math.abs(Math.sin((Math.PI * dx) / it.hop)) * 100 * Math.min(1, fade + 0.5);
    // the cat trots along, and leaps as it comes up to the bin
    const r = 260;
    if (Math.abs(dx) > r) return 10;
    return 10 + (mouthH + 20) * (1 - (dx / r) * (dx / r));
  }

  // Bot and test helpers.
  g.coming = () => g.items.filter((it) => it.state === 'come').sort((a, b) => a.x - b.x);
  g.eta = (it) => (it.x - g.bx) / -it.vx;
  g.distToMouth = (it) => {
    const [mx, my] = g.mouth();
    return Math.hypot(it.x - mx, it.y - my);
  };

  // Into the bin it goes: rubbish scores, anything else is spat out.
  function stow(it, how = 'in') {
    const [mx, my] = g.mouth();
    g.gape = 0;
    if (it.rub) {
      it.state = 'gone';
      it.dead = true;
      g.binned++;
      g.streak++;
      add(1);
      g.gulp = 0.25;
      sfx('catch', { pitch: Math.min(12, g.streak) });
      pop(how === 'slam' ? 'Slam! +1' : '+1', mx, my - 130, PAL.green, 44);
      if (g.streak % 5 === 0) {
        const b = g.streak / 5;
        add(b);
        sfx('bloom');
        g.sing = 0.8;
        pop(`${g.streak} in a row!  +${b}`, mx + 60, my - 190, PAL.magenta, 46);
      }
    } else {
      it.state = 'spat';
      it.vx = -260 - rng() * 80;
      it.vy = -680;
      it.x = mx;
      it.y = my - 10;
      it.lane = g.by;
      g.swallowed++;
      g.streak = 0;
      add(-1);
      g.spit = 0.6;
      g.jam = JAM;
      sfx('squawk');
      env.vibrate?.(120);
      pop('Not rubbish!  −1', mx + 40, my - 160, PAL.brick, 46);
    }
    if (g.held === it) g.held = null;
    if (g.aim === it) g.aim = null;
  }

  // The lid comes down: whatever the canary has, or is just reaching, goes
  // in with it, and so does anything right at the mouth.
  function slam() {
    const [mx, my] = g.mouth();
    const ks = g.ks();
    if (g.held) {
      g.slams++;
      stow(g.held, 'slam');
    }
    if (g.aim && g.aim.state === 'come' && Math.hypot(g.aim.x - mx - g.head[0], g.aim.y - my - g.head[1]) < itemR(g.aim) + 40 * ks) {
      g.slams++;
      stow(g.aim, 'slam');
    }
    for (const it of g.items) {
      if (it.state !== 'come' || !g.inLane(it)) continue;
      if (Math.abs(it.x - mx) < (MOUTH_R + 30) * ks + itemR(it) && it.y < my + 10 * ks && it.y > my - 140 * ks) {
        g.slams++;
        stow(it, 'slam');
      }
    }
    g.aim = null;
    g.can = 'pop';
    g.canT = 0;
    sfx('switch');
  }

  // The lid flies up: anything just above or behind it is knocked back.
  function knock() {
    const [mx, my] = g.mouth();
    const ks = g.ks();
    for (const it of g.items) {
      if (it.state !== 'come' || !g.inLane(it)) continue;
      const dx = it.x - mx;
      // above the shut lid, over its length (not at the mouth, where the
      // canary will have it)
      if (dx > -150 * ks && dx < 110 * ks && it.y < my - 70 * ks && it.y > my - 230 * ks) {
        it.state = 'knocked';
        it.vx = 650 + rng() * 180; // back against the wind, visibly away from the bin
        it.vy = -620 - rng() * 200;
        it.spin = (rng() < 0.5 ? -1 : 1) * 9;
        g.knocked++;
        sfx('bonk');
        pop('Bonk!', it.x, it.y - 50, PAL.slate, 34);
      }
    }
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    // Walking: the stick, or towards where a pointer sent it.
    const p = input.pointer;
    let lidHeld = !!input.action;
    if (p.active) {
      const sc = g.scale();
      if (input.actionPressed) {
        const onBin = Math.abs(p.x - g.bx) < 130 * sc && p.y > g.by - 320 * sc && p.y < g.by + 30;
        g.grabbed = onBin ? [g.bx - p.x, g.by - p.y] : null;
      }
      if (p.down || input.action) g.target = g.grabbed ? [p.x + g.grabbed[0], p.y + g.grabbed[1]] : [p.x, p.y];
      lidHeld = !!input.action && !!g.grabbed;
      if (!input.action) g.grabbed = null;
    }
    const x0 = g.bx;
    const y0 = g.by;
    if (p.active && g.target) {
      const dx = g.target[0] - g.bx;
      const dy = g.target[1] - g.by;
      g.bx += clamp(dx * 8, -WALK, WALK) * dt;
      g.by += clamp(dy * 8, -STEP, STEP) * dt;
    } else {
      g.bx += clamp(input.x, -1, 1) * WALK * dt;
      g.by += clamp(input.y, -1, 1) * STEP * dt;
    }
    g.bx = clamp(g.bx, X0, X1);
    g.by = clamp(g.by, DEPTH0, DEPTH1);
    const moved = Math.hypot(g.bx - x0, g.by - y0);
    g.moving = approach(g.moving, moved / dt > 20 ? 1 : 0, 12, dt);
    g.walkT += moved / (60 * g.scale());

    // The lid: up while held (and not spluttering).
    const was = g.holding;
    g.holding = lidHeld;
    if (g.holding && !was) sfx('switch');
    g.jam = Math.max(0, g.jam - dt);
    const wasOpen = g.open;
    g.open = clamp(g.open + (g.holding && g.jam <= 0 ? 9 : -12) * dt, 0, 1);
    if (g.holding && !was && g.jam <= 0 && wasOpen < 0.5) knock();
    if (wasOpen >= 0.5 && g.open < 0.5 && g.can !== 'in' && g.can !== 'pop') slam();
    g.gulp = Math.max(0, g.gulp - dt);
    g.spit = Math.max(0, g.spit - dt);
    g.sing = Math.max(0, g.sing - dt);

    // The canary.
    const ks = g.ks();
    const [mx, my] = g.mouth();
    g.canT += dt;
    const ready = [0, -NECK_UP * ks];
    const toward = (pt, rate) => {
      const dx = pt[0] - g.head[0];
      const dy = pt[1] - g.head[1];
      const d = Math.hypot(dx, dy);
      const step = rate * dt;
      if (d <= step) g.head = [pt[0], pt[1]];
      else g.head = [g.head[0] + (dx / d) * step, g.head[1] + (dy / d) * step];
      return d <= step;
    };
    // how long the lid has been gaping without a catch
    g.gape = g.open > 0.5 ? (g.gape || 0) + dt : 0;
    const bored = g.gape > FRESH;
    if (g.gape > WHISK && g.score > 0 && !g.held) {
      g.whiskT = (g.whiskT || 0) - dt;
      if (g.whiskT <= 0) {
        // the wind takes the top piece back out of the gaping bin
        g.whiskT = WHISK_EVERY;
        g.whisked = (g.whisked || 0) + 1;
        g.streak = 0;
        add(-1);
        const kind = RUBBISH[Math.floor(rng() * RUBBISH.length)];
        g.items.push({ kind, rub: true, lane: g.by, x: mx, y: my - 10, vx: -380 - rng() * 120, vy: -520, t: 0, phase: 0, amp: 0, hop: 260, gust: null, gusted: true, state: 'over', landed: true, rot: 0, spin: 7, life: 0 });
        sfx('wind');
        sfx('wilt');
        pop('Whoosh!  −1', mx - 40, my - 170, PAL.slate, 42);
      }
    } else g.whiskT = 0.3;
    if (g.can === 'in') {
      g.head = [0, 0];
      if (g.open > 0.5 && !bored) {
        g.can = 'rise';
        g.canT = 0;
      }
    } else if (g.can === 'rise') {
      // it climbs out at its own pace: a lid flapped up and down never gets it out
      if (toward(ready, RISE_SPEED)) g.can = 'up';
    } else if (g.can === 'up' && bored) {
      // nothing to do: it ducks back down into the bin
      if (toward([0, 40 * ks], PULL_SPEED)) {
        g.can = 'in';
        pop('Yawn…', mx, my - 150, PAL.slate, 32);
      }
    } else if (g.can === 'up') {
      toward(ready, HEAD_SPEED);
      // the nearest thing within reach in its lane
      let best = null;
      let bd = Infinity;
      for (const it of g.items) {
        if (it.state !== 'come' || !g.inLane(it)) continue;
        // The whole rim is reachable, including behind the hinge.
        const dx = Math.max(0, Math.abs(it.x - mx) - 100 * ks);
        const dy = Math.max(0, Math.abs(it.y - (my - NECK_UP * ks)) - 55 * ks);
        const d = Math.hypot(dx, dy);
        if (d < NECK_REACH * ks + itemR(it) && d < bd) {
          best = it;
          bd = d;
        }
      }
      if (best && g.spit <= 0) {
        g.aim = best;
        g.can = 'reach';
        g.canT = 0;
      }
    } else if (g.can === 'reach') {
      const it = g.aim;
      if (!it || it.state !== 'come' || !g.inLane(it)) {
        g.aim = null;
        g.can = 'up';
      } else {
        // stretch towards it, as far as the neck goes
        let rx = it.x - mx;
        let ry = it.y - my;
        const d = Math.hypot(rx, ry);
        const max = (NECK_REACH + 100) * ks;
        if (d > max) {
          rx *= max / d;
          ry *= max / d;
        }
        toward([rx, ry], HEAD_SPEED);
        if (Math.hypot(it.x - mx - g.head[0] - Math.sign(rx || 1) * 40 * ks, it.y - my - g.head[1]) < itemR(it) + 50 * ks) {
          g.held = it;
          g.aim = null;
          it.state = 'held';
          g.can = 'pull';
          g.canT = 0;
          sfx('tick');
        } else if (d > max + itemR(it) + 60 * ks) {
          g.aim = null;
          g.can = 'up';
        }
      }
    } else if (g.can === 'pull') {
      // down into the bin with it
      if (toward([0, 40 * ks], PULL_SPEED)) {
        stow(g.held);
        g.can = 'pop';
        g.canT = 0;
      }
    } else if (g.can === 'pop') {
      if (g.open < 0.5) {
        g.head = [0, 0];
        if (g.canT > 0.18) g.can = 'in';
      } else if (toward(ready, HEAD_SPEED * 0.8)) g.can = 'up';
    }
    if (g.held) {
      // in the beak, which points into the wind
      // at the beak's tip (the gripping pose's, about 70 units in front of the eye)
      g.held.x = mx + g.head[0] + 66 * ks;
      g.held.y = my + g.head[1] - 6 * ks;
      g.held.lane = g.by;
    }

    g.spawnT -= dt;
    if (g.spawnT <= 0) spawn();

    for (const it of g.items) {
      it.t += dt;
      it.rot += it.spin * dt;
      if (it.state === 'come') {
        if (it.gust && !it.gusted && it.x < it.gust) {
          it.gusted = true;
          it.vx *= 1.5;
          for (let i = 0; i < 3; i++) g.wind.push({ x: it.x + 40 + i * 30, y: it.y - 40 + i * 30, life: 0.6 });
        }
        // an open bin smells interesting: cats and sparrows nearby turn
        // towards it
        if (g.open > 0.5 && (it.kind === 'cat' || it.kind === 'sparrow') && it.x - g.bx > 0 && it.x - g.bx < 350) {
          it.lane += clamp(g.by - it.lane, -CURIOUS * dt, CURIOUS * dt);
        }
        it.x += it.vx * dt;
        it.y = it.lane - altitude(it);
        if (!g.inLane(it)) {
          if (it.x < -120) {
            it.dead = true;
            if (it.rub) g.missed++;
          }
          continue;
        }
        const r = itemR(it);
        // straight through the open mouth: in it falls
        // (only what comes down into it: something passing above the rim
        // needs the canary)
        if (g.open > 0.55 && g.jam <= 0 && (g.gape || 0) <= FRESH && Math.abs(it.x - mx) < MOUTH_R * ks + r * 0.5 && it.y > my - 60 * ks && it.y < my + 30 * ks) {
          stow(it);
          continue;
        }
        if (it.x < -120) {
          it.dead = true;
          if (it.rub) g.missed++;
        }
      } else if (it.state === 'over' || it.state === 'spat' || it.state === 'knocked') {
        it.vy += 1500 * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        const floor = it.lane - 10;
        if (it.kind === 'sparrow') {
          it.vy = Math.min(it.vy, -40);
        } else if (it.y > floor) {
          it.y = floor;
          it.vy = -Math.abs(it.vy) * 0.3;
          if (it.state === 'over' && it.rub && !it.landed) {
            it.landed = true;
            g.litter.push({ kind: it.kind, x: it.x - 60 - rng() * 120, lane: it.lane, rot: rng() * 6 });
            if (g.litter.length > 8) g.litter.shift();
          }
          if (it.state === 'knocked') it.state = 'over';
        }
        if (it.x < -120 || it.y < -150) it.dead = true;
      }
    }
    g.items = g.items.filter((it) => !it.dead);

    if (rng() < dt * 1.5) g.wind.push({ x: W + 20, y: 140 + rng() * 520, life: 2.2 });
    for (const w of g.wind) {
      w.x -= 900 * dt;
      w.life -= dt;
    }
    g.wind = g.wind.filter((w) => w.life > 0);
    for (const q of g.pops) {
      q.life -= dt;
      q.y -= 40 * dt;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
  };

  g.hud = () => `Points ${g.score}${g.streak >= 2 ? ` · ${g.streak} in a row` : ''}`;
  g.summary = () => {
    const lines = [`${g.binned} bit${g.binned === 1 ? '' : 's'} of rubbish in the bin.`];
    if (g.swallowed) lines.push(g.swallowed === 1 ? '1 thing swallowed that wasn’t rubbish.' : `${g.swallowed} things swallowed that weren’t rubbish.`);
    else lines.push('Nothing swallowed that wasn’t rubbish!');
    return lines;
  };

  // ---------- drawing ----------
  function drawItem(c, it, x, y, rot, sc = 1) {
    const k = KINDS[it.kind];
    c.save();
    c.translate(x, y);
    if (sc !== 1) c.scale(sc, sc);
    const flap = it.kind === 'sparrow' || it.kind === 'cat';
    if (!flap) c.rotate(rot);
    const h = (it.kind === 'cat' ? 92 : it.kind === 'sparrow' ? 56 : it.kind === 'letter' ? 52 : 64) * BIG;
    // the painted things (IC-M08b) are sized by their longer side
    const [bw, bh] = ITEM_BOX[k.i];
    const L = ITEM_LONG[it.kind] || 92;
    const fit = bw >= bh ? { w: L } : { h: L };
    if (!k.rub && it.state !== 'in') {
      // the shared cue for "not rubbish, keep the lid shut": a soft gold glow
      // and a twinkle
      const r = h * 0.85;
      const grd = c.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      grd.addColorStop(0, 'rgba(255,226,120,0.55)');
      grd.addColorStop(1, 'rgba(255,226,120,0)');
      c.fillStyle = grd;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ink(c, 3, 'rgba(201,150,42,0.7)');
      c.stroke();
      const tw = 0.6 + 0.4 * Math.sin((it.t || 0) * 9);
      c.save();
      c.translate(r * 0.62, -r * 0.62);
      c.scale(tw, tw);
      c.beginPath();
      c.moveTo(0, -12);
      c.lineTo(3, -3);
      c.lineTo(12, 0);
      c.lineTo(3, 3);
      c.lineTo(0, 12);
      c.lineTo(-3, 3);
      c.lineTo(-12, 0);
      c.lineTo(-3, -3);
      c.closePath();
      c.fillStyle = '#e8b830';
      c.fill();
      c.restore();
    }
    if (!drawSprite(c, 'sprites.garbageItems', k.i, 0, 0, { ...fit, anchor: 'center' })) {
      c.scale(BIG, BIG);
      drawItemStandin(c, it, k);
    }
    c.restore();
  }

  function drawItemStandin(c, it, k) {
    const kind = it.kind;
    if (kind === 'paper') {
      blob(c, 0, 0, 30, 27, 3, 0.22, 12);
      wash(c, k.col);
      ink(c, 2);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(-18 + i * 10, -14);
        c.lineTo(-8 + i * 12, 12);
        ink(c, 1);
        c.stroke();
      }
    } else if (kind === 'peel') {
      for (const a of [-0.9, 0, 0.9]) {
        c.save();
        c.rotate(a);
        blob(c, 0, -20, 9, 26, a * 10 + 4, 0.1, 10);
        wash(c, k.col);
        ink(c, 1.8);
        c.restore();
      }
      blob(c, 0, 4, 10, 10, 5, 0.1, 8);
      wash(c, '#8a6a3a');
    } else if (kind === 'tin') {
      poly(c, [[-22, -30], [22, -30], [22, 30], [-22, 30]], 6, 1);
      wash(c, k.col);
      ink(c, 2.2);
      c.fillStyle = PAL.brick;
      c.fillRect(-22, -12, 44, 22);
      hatch(c, -22, -30, 22, 30, 8, 0.2, 1);
    } else if (kind === 'core') {
      blob(c, 0, -22, 22, 12, 7, 0.1);
      wash(c, PAL.brick);
      ink(c, 1.8);
      blob(c, 0, 0, 12, 18, 8, 0.1);
      wash(c, k.col);
      ink(c, 1.8);
      blob(c, 0, 22, 20, 11, 9, 0.1);
      wash(c, PAL.brick);
      ink(c, 1.8);
    } else if (kind === 'fishbone') {
      c.beginPath();
      c.moveTo(-34, 0);
      c.lineTo(28, 0);
      for (let i = -20; i <= 16; i += 9) {
        c.moveTo(i, -14);
        c.lineTo(i + 5, 0);
        c.lineTo(i, 14);
      }
      ink(c, 2.4, '#7a7060');
      c.stroke();
      blob(c, -36, 0, 13, 11, 10, 0.1);
      wash(c, k.col);
      ink(c, 1.8);
      poly(c, [[28, 0], [44, -14], [44, 14]], 11, 1);
      wash(c, k.col);
      ink(c, 1.8);
    } else if (kind === 'boot') {
      poly(c, [[-14, -32], [14, -32], [14, 12], [36, 16], [36, 30], [-18, 30]], 12, 1.5);
      wash(c, k.col);
      ink(c, 2.2);
      hatch(c, -18, -32, 36, 30, 9, 0.25, 2);
      // a hole in the toe
      c.beginPath();
      c.ellipse(28, 22, 6, 4, 0, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
    } else if (kind === 'hat') {
      poly(c, [[-22, -34], [22, -34], [24, 10], [-24, 10]], 13, 1);
      wash(c, k.col);
      ink(c, 2.2);
      c.fillStyle = PAL.mauve;
      c.fillRect(-24, -2, 48, 10);
      blob(c, 0, 12, 42, 7, 14, 0.04);
      wash(c, k.col);
      ink(c, 2);
    } else if (kind === 'letter') {
      poly(c, [[-34, -22], [34, -22], [34, 22], [-34, 22]], 15, 1);
      wash(c, k.col);
      ink(c, 2.2);
      c.beginPath();
      c.moveTo(-34, -22);
      c.lineTo(0, 4);
      c.lineTo(34, -22);
      ink(c, 1.6);
      c.stroke();
      c.fillStyle = PAL.strawberry;
      c.fillRect(16, -18, 13, 15);
      c.beginPath();
      c.arc(0, 6, 6, 0, Math.PI * 2);
      c.fillStyle = PAL.brick;
      c.fill();
    } else if (kind === 'cat') {
      // a ginger cat, leaping, facing left
      const leg = Math.sin(it.t * 14) * 8;
      blob(c, 6, 0, 42, 22, 16, 0.05);
      wash(c, k.col);
      ink(c, 2.2);
      hatch(c, -30, -20, 46, 20, 10, 0.2, 2);
      blob(c, -38, -16, 18, 16, 17, 0.05);
      wash(c, k.col);
      ink(c, 2.2);
      poly(c, [[-50, -28], [-46, -44], [-38, -30]], 18, 0.5);
      wash(c, k.col);
      ink(c, 1.6);
      poly(c, [[-34, -30], [-28, -46], [-24, -28]], 19, 0.5);
      wash(c, k.col);
      ink(c, 1.6);
      c.beginPath();
      c.arc(-44, -18, 3, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      c.beginPath();
      c.moveTo(-20, 16);
      c.lineTo(-26 - leg, 34);
      c.moveTo(28, 16);
      c.lineTo(34 + leg, 34);
      c.moveTo(46, -4);
      c.quadraticCurveTo(70, -30, 62, -44);
      ink(c, 4, '#c07a30');
      c.stroke();
    } else if (kind === 'sparrow') {
      const flap = Math.sin(it.t * 22);
      blob(c, 0, 0, 22, 16, 20, 0.05);
      wash(c, k.col);
      ink(c, 2);
      blob(c, -20, -10, 11, 10, 21, 0.05);
      wash(c, k.col);
      ink(c, 1.8);
      c.beginPath();
      c.arc(-23, -12, 2.5, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      poly(c, [[-30, -8], [-42, -6], [-30, -4]], 22, 0.3);
      wash(c, PAL.ochre);
      poly(c, [[-2, -6], [20, -6 - 26 * flap], [14, 0]], 23, 0.5);
      wash(c, '#7a5a3a');
      ink(c, 1.6);
    }
  }
  function drawStreet(c) {
    // the sky and the houses across the street
    band(c, 0, 0, W, 360, PAL.sky, 0.55, 1);
    for (let i = 0; i < 6; i++) {
      const x0 = 40 + i * 270;
      const top = 150 + ((i * 53) % 70);
      poly(c, [[x0, top], [x0 + 250, top], [x0 + 250, 620], [x0, 620]], 30 + i, 1.2);
      wash(c, [PAL.dusty, '#c9b89a', PAL.sage, '#d8c8a0', PAL.mauve, '#c9b89a'][i], 0.55);
      ink(c, 1.8);
      poly(c, [[x0 - 10, top], [x0 + 125, top - 70], [x0 + 260, top]], 40 + i, 1.2);
      wash(c, '#8a6a5a', 0.6);
      ink(c, 1.8);
      for (const wx of [x0 + 40, x0 + 150]) {
        poly(c, [[wx, top + 60], [wx + 60, top + 60], [wx + 60, top + 140], [wx, top + 140]], wx, 0.8);
        wash(c, '#f2ead0', 0.8);
        ink(c, 1.4);
      }
      poly(c, [[x0 + 100, 520], [x0 + 150, 520], [x0 + 150, 620], [x0 + 100, 620]], 50 + i, 0.8);
      wash(c, '#6a5040', 0.7);
      ink(c, 1.4);
    }
    // the pavement, the kerb and the road
    poly(c, [[0, 620], [W, 620], [W, PAVE + 40], [0, PAVE + 40]], 60, 1);
    wash(c, '#d8d0c0', 0.8);
    ink(c, 1.8);
    for (let x = 60; x < W; x += 160) {
      c.beginPath();
      c.moveTo(x, 620);
      c.lineTo(x - 40, PAVE + 40);
      ink(c, 1);
      c.stroke();
    }
    poly(c, [[0, PAVE + 40], [W, PAVE + 40], [W, PAVE + 56], [0, PAVE + 56]], 61, 0.8);
    wash(c, '#a8a090');
    ink(c, 1.8);
    band(c, 0, PAVE + 56, W, H - PAVE - 56, '#8a8a88', 0.6, 62);
    hatch(c, 0, PAVE + 56, W, H, 14, 0.12, 1);
    // a lamp-post
    c.beginPath();
    c.moveTo(1240, PAVE + 20);
    c.lineTo(1240, 260);
    ink(c, 8, '#3a4a40');
    c.stroke();
    poly(c, [[1214, 260], [1266, 260], [1256, 210], [1224, 210]], 63, 1);
    wash(c, '#f2e2a0');
    ink(c, 2);
  }

  // ---------- the bin and its canary ----------

  // Where the bin is drawn: its feet, size, and the lid's hinge.
  function binPose() {
    const S = SIZE * g.scale();
    const ks = S / 400;
    const bob = env.reduceMotion ? 0 : g.moving * Math.abs(Math.sin(g.walkT * Math.PI)) * 5 * ks;
    const shake = g.gulp > 0 && !env.reduceMotion ? Math.sin(g.gulp * 60) * 3 : 0;
    const x = g.bx + shake;
    const y = g.by - bob;
    return { x, y, S, ks, hinge: [x - rim.hinge[0] * ks, y + rim.hinge[1] * ks] };
  }
  // The portrait cut along its rim, for when the bin's pieces aren't painted.
  function rimCut(c, P, above) {
    const [fx, fy] = [P.x - rim.front[0] * P.ks, P.y + rim.front[1] * P.ks];
    const [bx, by] = [P.x - rim.back[0] * P.ks, P.y + rim.back[1] * P.ks];
    const ext = 120 * P.ks;
    const sl = (fy - by) / (fx - bx);
    const y0 = by - sl * ext;
    const y1 = fy + sl * ext;
    c.beginPath();
    c.moveTo(bx - ext, y0);
    c.lineTo(fx + ext, y1);
    if (above) {
      c.lineTo(fx + ext, y1 - 400 * P.ks);
      c.lineTo(bx - ext, y0 - 400 * P.ks);
    } else {
      c.lineTo(fx + ext, P.y + 60);
      c.lineTo(bx - ext, P.y + 60);
    }
    c.closePath();
    c.clip();
  }
  const cellAt = (P) => [P.x, P.y + 0.033 * P.S, { h: 1.05 * P.S, whole: true, flip: true }];
  // Draw a cell so that its point `from` (cell px) lands on the bin piece's
  // point `to` (cell px, the portrait framing), `s` times the size.
  const cellMapped = (P, { from, to, s }) => {
    const u = (1.05 * P.S) / 1024;
    const wx = P.x - (to[0] - 512) * u; // flipped: the bin faces right
    const wy = P.y + 0.033 * P.S - (1024 - to[1]) * u;
    return [wx + (from[0] - 512) * u * s, wy + (1024 - from[1]) * u * s, { h: 1024 * u * s, whole: true, flip: true }];
  };

  function drawBody(c, t, P) {
    // the bin's shadow on the ground
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(P.x, g.by + 4, 110 * P.ks, 18 * P.ks, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    const walking = g.moving > 0.4;
    const frame = Math.floor(g.walkT * 2) % 4;
    if (walking && drawSprite(c, 'sprites.garbagecanaryWalk', frame, ...cellMapped(P, REG.walk[frame]))) return;
    if (drawSprite(c, 'sprites.garbagecanaryLid', 0, ...cellAt(P))) return;
    c.save();
    rimCut(c, P, false);
    drawBird(c, 'garbagecanary', { x: P.x, y: P.y, size: P.S, t, flip: true });
    c.restore();
    if (!art('subject.garbagecanary') || g.open > 0.05) {
      // the dark open mouth (the painted bin piece has its own)
      const [mx, my] = [P.x + MOUTH_DX * P.ks, P.y + RIM_U * P.ks];
      c.save();
      c.beginPath();
      const tilt = Math.atan2(rim.back[1] - rim.front[1], rim.front[0] - rim.back[0]);
      c.ellipse(mx, my + 4 * P.ks, 94 * P.ks, 22 * P.ks, tilt, 0, Math.PI * 2);
      c.fillStyle = '#2a2420';
      c.fill();
      c.restore();
    }
  }

  // The lid shut down (or swinging) with the canary's head peeping under it.
  function drawLidWithHead(c, t, P, angle, lift) {
    c.save();
    c.translate(P.hinge[0], P.hinge[1] - lift);
    c.rotate(-angle);
    c.translate(-P.hinge[0], -P.hinge[1]);
    const call = g.spit > 0 ? 0 : g.sing > 0 ? 1 : -1;
    const drawn = (call >= 0 && drawSprite(c, 'sprites.garbagecanaryCall', call, ...cellMapped(P, REG.call[call]))) || drawSprite(c, 'sprites.garbagecanaryLid', 1, ...cellAt(P));
    if (!drawn) {
      rimCut(c, P, true);
      drawBird(c, 'garbagecanary', { x: P.x, y: P.y, size: P.S, t, flip: true });
    }
    c.restore();
  }

  // The lid alone, up on its hinge while the canary is out.
  function drawLidOnly(c, P, angle) {
    c.save();
    c.translate(P.hinge[0], P.hinge[1]);
    c.rotate(-angle);
    c.translate(-P.hinge[0], -P.hinge[1]);
    if (!drawSprite(c, 'sprites.garbagecanaryLidOnly', 0, ...cellMapped(P, REG.lidOnly))) {
      // stand-in: a dented galvanised lid with a handle on top
      const ks = P.ks;
      const cx = P.x + 8 * ks;
      const cy = P.y + (RIM_U - 14) * ks;
      c.beginPath();
      c.ellipse(cx, cy, 108 * ks, 26 * ks, -0.06, Math.PI, 0);
      c.lineTo(cx + 112 * ks, cy + 8 * ks);
      c.ellipse(cx, cy + 8 * ks, 112 * ks, 12 * ks, -0.06, 0, Math.PI);
      c.closePath();
      wash(c, '#a8aeb0');
      ink(c, 2.4);
      hatch(c, cx - 110 * ks, cy - 26 * ks, cx + 110 * ks, cy + 14 * ks, 9, 0.18, 1);
      c.fillStyle = 'rgba(160,90,40,0.35)';
      for (const [dx, dy] of [[-50, -8], [30, -14], [70, 0]]) {
        c.beginPath();
        c.arc(cx + dx * ks, cy + dy * ks, 5 * ks, 0, Math.PI * 2);
        c.fill();
      }
      poly(c, [[cx - 24 * ks, cy - 24 * ks], [cx - 20 * ks, cy - 44 * ks], [cx + 20 * ks, cy - 44 * ks], [cx + 24 * ks, cy - 24 * ks]], 5, 0.6, false);
      ink(c, 5 * ks + 1, '#8a9094');
      c.stroke();
    }
    c.restore();
  }

  // The canary out of the bin: its neck from the mouth, its head, and what
  // it has in its beak. Clipped at the mouth, so going down into the bin
  // hides it.
  function drawCanaryOut(c, t, P) {
    const ks = P.ks;
    const [mx, my] = [P.x + MOUTH_DX * ks, P.y + RIM_U * ks];
    const head = g.can === 'in' ? [0, 6 * ks] : g.head; // inside, it peeks over the rim
    const [hx, hy] = [mx + head[0], my + head[1]];
    c.save();
    c.beginPath();
    c.rect(mx - 600 * ks, my - 700 * ks, 1200 * ks, 700 * ks + 6 * ks);
    c.clip();
    const pose = g.spit > 0 ? 4 : g.sing > 0 ? 5 : g.can === 'reach' ? 1 : g.can === 'pull' ? (head[1] < -30 * ks ? 2 : 3) : 0;
    // the painted pose, its eye on the head's place; reaching, it turns so
    // its neck runs back to the mouth
    const R = REG.neck[pose];
    const u = (1.05 * P.S) / 1024;
    const backwards = head[0] < -10 * ks;
    let rot = 0;
    if (pose === 1 || pose === 2) {
      const want = Math.atan2(-head[1], -head[0]); // from the head back down to the mouth
      const has = Math.atan2(R.base[1] - R.eye[1], (backwards ? 1 : -1) * (R.base[0] - R.eye[0])); // eye to base, flipped
      rot = clamp(want - has, -1.1, 1.1);
    }
    c.save();
    c.translate(hx, hy);
    c.rotate(rot);
    const painted = drawSprite(c, 'sprites.garbagecanaryNeck', pose, (backwards ? -1 : 1) * (R.eye[0] - 512) * u * R.s, (1024 - R.eye[1]) * u * R.s, { h: 1024 * u * R.s, whole: true, flip: !backwards });
    c.restore();
    if (!painted) {
      // stand-in: a feathery yellow neck and the canary's head
      const bx = mx;
      const by = my + 10 * ks;
      const cx = bx + g.head[0] * 0.15;
      const cy = (by + hy) / 2;
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(cx, cy, hx, hy + 14 * ks);
      ink(c, 40 * ks, INK);
      c.stroke();
      ink(c, 34 * ks, '#efcf46');
      c.stroke();
      for (let i = 1; i < 4; i++) {
        const u = i / 4;
        const px = (1 - u) * (1 - u) * bx + 2 * u * (1 - u) * cx + u * u * hx;
        const py = (1 - u) * (1 - u) * by + 2 * u * (1 - u) * cy + u * u * (hy + 14 * ks);
        c.beginPath();
        c.arc(px - 6 * ks, py, 6 * ks, 0.3, 2.6);
        ink(c, 1.4, '#a8862a');
        c.stroke();
      }
      // the head: facing into the wind, or at what it reaches for
      const aimAt = g.aim || g.held;
      const dir = aimAt && g.can === 'reach' ? Math.atan2(aimAt.y - hy, aimAt.x - hx) : g.spit > 0 || g.sing > 0 ? -0.6 : g.can === 'pull' ? 0.5 : 0;
      blob(c, hx, hy, 46 * ks, 40 * ks, 7, 0.05);
      wash(c, '#f2d24a');
      ink(c, 2.4);
      hatch(c, hx - 46 * ks, hy - 40 * ks, hx + 46 * ks, hy + 40 * ks, 9, 0.12, 2);
      const open = g.spit > 0 || g.sing > 0 || (g.can === 'reach' && !g.held) ? 0.32 : 0.06;
      c.save();
      c.translate(hx, hy);
      c.rotate(dir);
      for (const s of [-1, 1]) {
        poly(c, [[30 * ks, 0], [100 * ks, s * open * 34 * ks], [30 * ks, s * 13 * ks]], 3 + s, 0.4);
        wash(c, PAL.ochre);
        ink(c, 1.8);
      }
      c.restore();
      c.beginPath();
      c.arc(hx + 10 * ks, hy - 13 * ks, 16 * ks, 0, Math.PI * 2);
      c.fillStyle = '#fff';
      c.fill();
      ink(c, 2);
      c.stroke();
      c.beginPath();
      c.arc(hx + 10 * ks + Math.cos(dir) * 7 * ks, hy - 13 * ks + Math.sin(dir) * 7 * ks, 6 * ks, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(hx - 10 * ks + i * 10 * ks, hy - 38 * ks);
        c.quadraticCurveTo(hx - 26 * ks + i * 8 * ks, hy - 68 * ks, hx - 42 * ks + i * 10 * ks, hy - 62 * ks);
        ink(c, 2.4, '#c9a42a');
        c.stroke();
      }
    }
    if (g.held) drawItem(c, g.held, g.held.x, g.held.y, g.held.rot, depthScale(g.by) * 0.9);
    c.restore();
  }

  function drawBin(c, t) {
    const P = binPose();
    const angle = g.open * OPEN_ANGLE + (g.spit > 0 && g.open < 0.5 ? Math.sin(g.spit * 40) * 0.08 : 0);
    drawBody(c, t, P);
    const out = g.can !== 'in' && !(g.can === 'pop' && g.open < 0.5);
    if (!out && g.can === 'in' && g.open > 0.05) {
      // up, with the canary down inside (bored, or not yet risen): its head
      // just shows over the rim
      drawCanaryOut(c, t, P);
      drawLidOnly(c, P, angle);
    } else if (out) {
      drawCanaryOut(c, t, P);
      drawLidOnly(c, P, angle);
    } else {
      // after a slam, the head pops back up under the lid
      const lift = g.can === 'pop' ? Math.sin(Math.min(1, g.canT / 0.18) * Math.PI) * 8 * P.ks : 0;
      drawLidWithHead(c, t, P, angle, lift);
    }
  }

  g.draw = (c, t) => {
    scene(c, 'garbagecanary', W, H, drawStreet);

    for (const w of g.wind) {
      c.save();
      c.globalAlpha = clamp(w.life, 0, 0.5) * 0.6;
      c.beginPath();
      c.moveTo(w.x, w.y);
      c.quadraticCurveTo(w.x + 60, w.y - 10, w.x + 140, w.y);
      ink(c, 2, PAL.slate);
      c.stroke();
      c.restore();
    }

    // Everything in depth order: litter, the things on the wind and the bin.
    const list = [];
    for (const l of g.litter) list.push([l.lane - 1, () => drawItem(c, { kind: l.kind, t: 0 }, l.x, l.lane - 6, l.rot, depthScale(l.lane))]);
    for (const it of g.items) {
      if (it.state === 'held' || it.dead) continue;
      list.push([it.lane, () => {
        if (it.state === 'come') {
          // its shadow on the ground, darker when it's in the bin's lane
          c.save();
          c.globalAlpha = g.inLane(it) ? 0.38 : 0.16;
          c.fillStyle = INK;
          c.beginPath();
          c.ellipse(it.x, it.lane, 30 * depthScale(it.lane), 6 * depthScale(it.lane), 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
        drawItem(c, it, it.x, it.y, it.rot, depthScale(it.lane));
      }]);
    }
    list.push([g.by + 0.5, () => drawBin(c, t)]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [, f] of list) f();

    // Coming in from the right: an arrow at the edge at each thing's height,
    // bold when it's in the bin's lane, gold when it isn't rubbish.
    for (const it of g.items) {
      if (it.state !== 'come' || it.x < W - 40) continue;
      const lane = g.inLane(it);
      const ay = clamp(it.y, 120, H - 40);
      const k = (lane ? 1.9 : 1.3) * depthScale(it.lane);
      c.save();
      c.translate(W - 30, ay);
      c.scale(k, k);
      c.globalAlpha = lane ? 0.95 : 0.55;
      poly(c, [[-26, 0], [6, -20], [6, -8], [22, -8], [22, 8], [6, 8], [6, 20]], 70, 0.6);
      wash(c, it.rub ? '#f4ecd8' : '#f2cf5a');
      ink(c, lane ? 3 : 2, it.rub ? INK : '#a8862a');
      c.stroke();
      c.restore();
    }

    for (const p of g.pops) {
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${p.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(p.text, p.x, p.y);
      label(c, p.text, p.x, p.y, { size: p.size, color: p.color, weight: 800 });
      c.restore();
    }

    if (g.elapsed < 5) {
      c.save();
      c.globalAlpha = Math.min(1, 5 - g.elapsed);
      // two short lines, centred on what a narrow screen shows, on a soft
      // paper backing so they read over the painting
      const hx = clamp(g.focus(), 390, W - 390);
      const hl = ['Walk into the rubbish’s lane, hold to open:', 'the canary grabs it. Dodge what glows!'];
      c.fillStyle = 'rgba(250,244,228,0.78)';
      c.fillRect(hx - 380, 170 - 34, 760, 112);
      hl.forEach((s, i) => label(c, s, hx, 170 + i * 44, { size: 32, weight: 600 }));
      c.restore();
    }
  };

  g.focus = () => clamp(g.bx + 260, 450, W - 450);
  g.span = 900;

  return g;
}
