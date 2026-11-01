// Glove Dove: Slippery Dishes.
//
// The washing-up is done, but every dish is wet and soapy and slippery. They
// pop up out of the suds in the sink on the left, and the Glove Dove, a long
// pink rubber glove, runs along the counter beneath them. Hold the action to
// crouch: the Dove sinks, its long glove neck held level like a tray, and a
// dish that comes down on it settles there (it can be carried along). Let go
// to spring up and bump it up and away to the right, towards the plate rack;
// a dish that drops into the rack is put away. Crouch long enough to wind
// right up (the Dove turns its head to aim) and the bump is a "Hup!", high
// and long and aimed at the rack; let go sooner and it is only a hop along.
// Let go just as a dish lands and it is bumped straight away. Standing up,
// a dish just bounces off the rubber, low and short, and the second time it
// slips off. A dish that reaches the counter or the floor smashes (no points
// lost, but the dish is gone); one that drops back into the sink pops up
// again later. More dishes come, faster, and heavy pans join in.
// Score: points (3 for each dish put away, 1 for each "Hup!").

import { drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, SHEETS, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.dishes': [3, 2], // plate, bowl, cup, saucepan, frying pan, pie dish: side views, handles to the right
  'sprites.glovedoveToss': [2, 1], // ready to catch (fingers up), flicking a dish up
  'sprites.dishShards': [3, 2], // each dish smashed, in the dishes' order (requested, IC-M11g)
  'sprites.glovedoveBump': [3, 2], // sinking, crouched, head turning, aiming, bump, looking back (requested, IC-M11h)
  'sprites.glovedovePoses': [2, 1], // cheering (a dish put away), dismayed (a dish smashed)
});

const DURATION = 45;
// Measured on the delivered scene (1920 x 1080, drawn at 1600 x 900): the
// counter top's front edge is at 554, the sink (suds at 375 to 533) takes
// the left 367, the wire rack stands on its tray from 1221 to 1579 with its
// wires' tops at about 304 to 380.
const COUNTER = 540; // where the Dove's feet stand, near the front of the counter top
const SIZE = 290;
// The Dove's art was painted at different scales: the portrait
// (subjects/glovedove.png), the cheer/dismay sheet and the crouch-and-bump
// sheet each show the bird at its own size. So every cell is drawn at a
// scale measured on the art, not fitted to its cell or its height (a crouch
// is shorter and would grow). Measured on every cell against the portrait:
// the eye's diameter, the square root of the blue-grey feather area, and the
// square root of the ochre leg area; the scale s is their common value
// (portrait 1; cheer and dismay 0.92; the bump sheet 0.68, its deep crouch
// 0.655). Each cell stands with its feet (`fx`, the middle of the feet
// along the bottom of its painting, `bot` its lowest pixel) where the
// portrait's feet are. The test test/glovedove.test.mjs re-measures the
// three features on every cell and checks they stay within 4% of the
// portrait's on screen.
const K_SIZE = SIZE / 400;
const PXK = (420 / 1024) * K_SIZE; // screen px per portrait px
const FEET_X = (432 - 512) * PXK; // the portrait's feet, from the middle of its image
// [sheet, cell, s, fx, bot, cell size, eye x, eye y] (px on the sheets)
export const DOVE_POSES = {
  stand: ['subject.glovedove', 0, 1, 432, 997, 1024, 235, 193],
  sink: ['sprites.glovedoveBump', 0, 0.68, 496, 1014, 1024, 337, 522],
  crouch: ['sprites.glovedoveBump', 1, 0.655, 535, 1015, 1024, 339, 583],
  turn: ['sprites.glovedoveBump', 2, 0.68, 490, 1015, 1024, 409, 579],
  aim: ['sprites.glovedoveBump', 3, 0.68, 536, 1019, 1024, 472, 555],
  bump: ['sprites.glovedoveBump', 4, 0.68, 530, 1020, 1024, 485, 419],
  look: ['sprites.glovedoveBump', 5, 0.68, 481, 1022, 1024, 319, 528],
  cheer: ['sprites.glovedovePoses', 0, 0.92, 460, 1023, 1024, 254, 290],
  dismay: ['sprites.glovedovePoses', 1, 0.92, 527, 1023, 1024, 221, 388],
};
// The glove's top: standing (the portrait), 832 px above its feet over the
// middle of the glove; crouched (bump sheet cells 1 to 3), a level line 378
// px above the feet on cells drawn at 0.655 to 0.68: 378 / 0.665 portrait px.
const HANDS = COUNTER - Math.round(832 * PXK); // where a falling dish meets the standing glove
const CROUCH_Y = COUNTER - Math.round((378 / 0.665) * PXK); // the crouched glove's level top
// The middle of the crouched glove's level part (sheet x 650, 115 px behind
// the feet), from the Dove's x: where a dish is caught and rests.
const ARM_C = Math.round(FEET_X + (115 / 0.665) * PXK);
const SINK_X1 = 360; // the sink, left of here
const SINK_Y = 390; // its suds
const RACK_X0 = 1250; // the plate rack
const RACK_X1 = 1560;
const RACK_Y = 360; // a dish falling through here (the wires' tops) into the rack is put away
const RACK_MID = (RACK_X0 + RACK_X1) / 2;
const HUP_REACH = 520; // the fastest a "Hup!" sends a dish along
const DOVE_MIN = 390;
const DOVE_MAX = 1150;
const SPEED = 1000;
const REACH = 88; // how far from the glove's middle a dish can be flicked
// The space above the counter is low, so everything flies on a smaller
// scale: lower gravity and launches, the same times in the air.
const GRAV = 1140;
const FULL = 0.45; // seconds of crouching to wind right up: the bump is a "Hup!"
const SPRING = 0.15; // after letting go, a dish landing on the glove is still bumped
const CROUCH_SPEED = 0.6; // crouched, the Dove shuffles along slower
const BUMP_T = 0.25; // the bump pose
const LOOK_T = 0.3; // then the head swings back to the left

// The dishes: half-width, how high a flick sends it (heavier is lower), and
// their look for the stand-in.
const KINDS = [
  { name: 'plate', half: 70, lift: 1, face: '#f6f3ea', rim: '#7f93a8' },
  { name: 'bowl', half: 55, lift: 1, face: '#f2ead8', rim: '#c9a83a' },
  { name: 'cup', half: 40, lift: 1.05, face: '#e8e2d4', rim: '#b98aa3' },
  { name: 'saucepan', half: 60, lift: 0.88, face: '#b8bcc0', rim: '#7a7f86' },
  { name: 'frying pan', half: 65, lift: 0.85, face: '#5a5a60', rim: '#3a3a40' },
  { name: 'pie dish', half: 62, lift: 0.95, face: '#e8d0a0', rim: '#c9925a' },
];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 640, // the Dove
    vx: 0,
    crouch: false, // the action is held: crouched, glove level
    charge: 0, // seconds crouched
    held: null, // the dish resting on the glove
    turnT: 0, // seconds since the head started to turn (dish settled or fully wound)
    springT: 9, // seconds since letting go
    power: 0, // how wound up the last spring was (0..1)
    bumpT: 0, // the bump pose
    lookT: 0, // the head swinging back
    cheer: 0,
    dismay: 0,
    dishes: [], // in the air: { kind, x, y, vx, vy, spin, a, flicks }
    racked: [], // kinds put away, for the picture
    shards: [],
    heaps: [], // smashed dishes lying on the counter for a moment
    pops: [],
    spawnT: 0.8,
    queue: 0, // dishes that fell back into the sink, to pop up again
    put: 0,
    hups: 0,
    smashed: 0,
    flicks: 0,
    bounces: 0,
    caught: 0, // dishes settled on the glove
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets how often dishes come, how many may be out at
  // once, and how many are heavy pans. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.maxOut = () => Math.round(knob(g.d(), 2, 3.9, 6.4)); // most dishes out at once
  g.spawnGap = () => knob(g.d(), 3.1, 2.15, 1.0); // seconds between dishes (±15%)
  g.panChance = () => knob(g.d(), 0.3, 0.46, 0.68); // share of pans and pie dishes, after the first third
  function pop(text, x, y, color = INK, size = 42) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.1 });
  }

  // A dish pops up out of the suds.
  function spawn() {
    const n = g.put + g.smashed;
    const r = rng();
    const kind = n < 2 ? 0 : progress() < 1 / 3 ? Math.floor(r * 3) : r < g.panChance() ? 3 + Math.floor(rng() * 3) : Math.floor(rng() * 3);
    g.dishes.push({ kind, x: 170 + rng() * 80, y: SINK_Y, vx: 250 + rng() * 90, vy: -(650 + rng() * 100), spin: (rng() - 0.5) * 6, a: 0, flicks: 0 });
    sfx('plop');
  }

  // When (seconds) and where (x) a falling dish next reaches the fingers, or null.
  g.catchX = () => g.x + ARM_C;
  // The glove's top: lower while crouched.
  g.gloveY = () => (g.crouch ? CROUCH_Y : HANDS);
  g.landing = (d) => {
    if (d.held) return null;
    const dy = g.gloveY() - d.y;
    const disc = d.vy * d.vy + 2 * GRAV * dy;
    if (disc < 0) return null;
    const t = (-d.vy + Math.sqrt(disc)) / GRAV;
    if (t < 0) return null;
    return { t, x: d.x + d.vx * t };
  };

  function smash(d, x, y) {
    d.dead = true;
    g.smashed++;
    g.dismay = 0.8;
    sfx('topple');
    env.vibrate?.(70);
    pop('Crash!', x, y - 70, PAL.brick, 46);
    const K = KINDS[d.kind];
    g.heaps.push({ x, y, kind: d.kind, life: 1.4 });
    for (let i = 0; i < 9; i++) g.shards.push({ x, y: y - 6, vx: (rng() - 0.5) * 520, vy: -200 - rng() * 380, a: rng() * 6, va: (rng() - 0.5) * 16, life: 1 + rng() * 0.5, color: i % 2 ? K.face : K.rim });
  }

  // Seconds for a dish thrown up at vy (negative) to come down `drop` below.
  const flight = (vy, drop) => (-vy + Math.sqrt(vy * vy + 2 * GRAV * drop)) / GRAV;

  // A bump off the glove: wound right up it is a "Hup!" aimed at the rack;
  // less, a hop along to the right.
  function bump(d, power) {
    const K = KINDS[d.kind];
    const hup = power >= 1;
    d.held = false;
    d.bounced = false;
    d.vy = -(hup ? 750 : 430 + 240 * power) * K.lift;
    if (hup) {
      const air = flight(d.vy, Math.max(0, RACK_Y - d.y));
      d.vx = clamp((RACK_MID - d.x) / air, 120, HUP_REACH);
    } else d.vx = 110 + 170 * power;
    d.spin = (rng() - 0.5) * 10;
    d.flicks++;
    g.flicks++;
    if (hup) {
      g.hups++;
      g.score++;
      sfx('catch', { pitch: Math.min(12, d.flicks * 3) });
      pop('Hup! +1', d.x, d.y - 90, PAL.magenta, 40);
    } else {
      sfx('bonk');
      pop(power < 0.4 ? 'Hop' : 'Bump', d.x, d.y - 80, PAL.slate, 32);
    }
  }

  // The dish meets the glove.
  function meet(d) {
    const off = clamp(d.x - g.catchX(), -REACH, REACH);
    if (g.springT < SPRING) {
      bump(d, g.power); // let go just as it landed
      return;
    }
    if (g.crouch && !g.held) {
      // it settles on the level glove, and goes where the Dove goes
      g.held = d;
      d.held = true;
      d.off = clamp(off, -40, 40);
      d.vx = 0;
      d.vy = 0;
      d.spin = 0;
      g.caught++;
      sfx('plop');
      return;
    }
    if (d.bounced) {
      // a second time without a bump: too slippery, it slides off the glove
      d.slipped = true;
      d.vy = 120;
      d.vx = off >= 0 ? 260 : -260;
      sfx('miss');
      pop('Slippery!', d.x, d.y - 80, PAL.slate, 34);
      return;
    }
    // standing (or already holding one): it bounces off the rubber once
    d.bounced = true;
    d.vy = -312;
    d.vx = d.vx * 0.3 + off * 1.2;
    g.bounces++;
    sfx('bonk');
  }

  // Letting go: spring up, and bump whatever is on the glove.
  function release() {
    g.crouch = false;
    g.power = clamp(g.charge / FULL, 0, 1);
    g.springT = 0;
    g.bumpT = BUMP_T;
    g.lookT = 0;
    if (g.held) {
      const d = g.held;
      g.held = null;
      bump(d, g.power);
    }
    // a dish just coming down past the rising glove is caught in the spring
    for (const d of g.dishes) {
      if (!d.held && !d.slipped && d.vy > 0 && d.y > HANDS - 30 && d.y < CROUCH_Y + 10 && Math.abs(d.x - g.catchX()) < REACH) bump(d, g.power);
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

    // More dishes, and faster, as the pile goes down.
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.dishes.length < g.maxOut()) {
      spawn();
      g.spawnT = g.spawnGap() * (0.85 + rng() * 0.3);
      if (g.queue > 0) g.queue--;
    } else if (g.spawnT <= 0) g.spawnT = 0.3;

    // The Dove runs along the counter.
    const px = g.x;
    if (input.pointer.active) {
      const tx = clamp(input.pointer.x - ARM_C, DOVE_MIN, DOVE_MAX); // the glove goes to the pointer
      const k = 1 - Math.exp(-16 * dt);
      const cap = (input.action ? CROUCH_SPEED : 1) * 1600 * dt;
      g.x += clamp((tx - g.x) * k, -cap, cap);
    } else {
      g.vx = approach(g.vx, (input.x || 0) * SPEED * (input.action ? CROUCH_SPEED : 1), 18, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, DOVE_MIN, DOVE_MAX);
    if (input.pointer.active) g.vx = (g.x - px) / Math.max(dt, 1e-3);

    // Hold to crouch; let go to spring.
    g.springT += dt;
    if (input.action && !g.crouch) {
      g.crouch = true;
      g.charge = 0;
      g.turnT = 0;
      g.bumpT = 0;
      g.lookT = 0;
    }
    if (g.crouch) {
      g.charge += dt;
      if (g.held || g.charge >= FULL) g.turnT += dt;
      if (!input.action) release();
    }
    if (g.bumpT > 0) {
      g.bumpT -= dt;
      if (g.bumpT <= 0) g.lookT = LOOK_T;
    } else g.lookT = Math.max(0, g.lookT - dt);
    g.cheer = Math.max(0, g.cheer - dt);
    g.dismay = Math.max(0, g.dismay - dt);

    for (const d of g.dishes) {
      if (d.held) {
        // resting on the crouched glove, carried along
        d.x = g.catchX() + d.off;
        d.y = g.gloveY() - 12;
        d.a = 0;
        continue;
      }
      const py = d.y;
      d.vy += GRAV * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.a += d.spin * dt;
      if (d.x < 30) {
        d.x = 30;
        d.vx = Math.abs(d.vx) * 0.5;
      }
      // onto the glove's fingers
      const gy = g.gloveY();
      if (!d.slipped && d.vy > 0 && py < gy && d.y >= gy && Math.abs(d.x - g.catchX()) < REACH + KINDS[d.kind].half * 0.4 && d.x > SINK_X1) {
        d.y = gy;
        meet(d);
        continue;
      }
      // into the rack
      if (d.vy > 0 && py < RACK_Y && d.y >= RACK_Y && d.x > RACK_X0 && d.x < RACK_X1) {
        d.dead = true;
        g.put++;
        g.score += 3;
        g.racked.push(d.kind);
        g.cheer = 0.9;
        sfx('right');
        env.vibrate?.(30);
        pop('Put away! +3', d.x, RACK_Y - 120, PAL.magenta, 46);
        continue;
      }
      // back into the sink: it will pop up again
      if (d.x < SINK_X1 && d.y > SINK_Y + 20 && d.vy > 0) {
        d.dead = true;
        g.queue++;
        g.spawnT = Math.min(g.spawnT, 0.8);
        sfx('splash');
        continue;
      }
      // onto the counter, or off the end onto the floor
      if (d.y > COUNTER - 10 && d.x >= SINK_X1 && d.x <= RACK_X0) smash(d, d.x, COUNTER);
      else if (d.y > H + 40) smash(d, clamp(d.x, 40, W - 40), H - 30);
      else if (d.x > W + 60) smash(d, W - 40, H - 30);
    }
    g.dishes = g.dishes.filter((d) => !d.dead);

    for (const s of g.shards) {
      s.vy += 1600 * dt;
      s.x += s.vx * dt;
      s.y = Math.min(s.y + s.vy * dt, H - 10);
      s.a += s.va * dt;
      s.life -= dt;
    }
    g.shards = g.shards.filter((s) => s.life > 0);
    for (const h of g.heaps) h.life -= dt;
    g.heaps = g.heaps.filter((h) => h.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Points ${g.score}`;
  g.summary = () => {
    const lines = [`${g.put} dish${g.put === 1 ? '' : 'es'} put away, ${g.hups} “Hup!” flick${g.hups === 1 ? '' : 's'}.`];
    lines.push(g.smashed ? `${g.smashed} smashed on the way.` : 'Not a single dish broken!');
    return lines;
  };

  // ---------- drawing ----------

  function standinKitchen(c) {
    // the wall, a window, the counter, the sink and the rack, from the side
    band(c, 0, 0, W, COUNTER, '#e4e6d2', 0.55, 1);
    c.save();
    c.globalAlpha = 0.22;
    for (let y = 80; y < COUNTER - 40; y += 70) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y + 2);
      ink(c, 1.2);
      c.stroke();
    }
    c.restore();
    poly(c, [[620, 60], [980, 60], [980, 260], [620, 260]], 2, 1);
    wash(c, '#c9d9e0', 0.8);
    ink(c, 2.4);
    c.beginPath();
    c.moveTo(800, 60);
    c.lineTo(800, 260);
    ink(c, 2);
    c.stroke();
    // the counter and the cupboards under it
    poly(c, [[0, COUNTER], [W, COUNTER + 2], [W, COUNTER + 26], [0, COUNTER + 24]], 3, 1);
    wash(c, '#c9925a');
    ink(c, 2.4);
    poly(c, [[0, COUNTER + 24], [W, COUNTER + 26], [W, H], [0, H]], 4, 1);
    wash(c, '#d9c8a0', 0.7);
    ink(c, 1.6);
    for (let x = 200; x < W; x += 260) {
      c.beginPath();
      c.moveTo(x, COUNTER + 34);
      c.lineTo(x, H);
      ink(c, 1.6);
      c.stroke();
    }
    // the sink: a white basin full of suds
    poly(c, [[30, SINK_Y - 20], [SINK_X1, SINK_Y - 20], [SINK_X1 - 20, COUNTER + 10], [50, COUNTER + 10]], 5, 1.5);
    wash(c, '#ece8de');
    ink(c, 2.6);
    for (let i = 0; i < 9; i++) {
      blob(c, 60 + i * 32, SINK_Y - 18 - (i % 3) * 10, 30, 20, i, 0.2);
      c.fillStyle = '#fbfaf4';
      c.fill();
      ink(c, 1.2, 'rgba(90,110,130,0.6)');
      c.stroke();
    }
    c.beginPath();
    c.moveTo(180, SINK_Y - 30);
    c.lineTo(180, SINK_Y - 150);
    c.quadraticCurveTo(180, SINK_Y - 190, 230, SINK_Y - 180);
    ink(c, 12, '#b8bcc0');
    c.stroke();
    // the plate rack: a wire frame on a tray
    poly(c, [[RACK_X0 - 20, COUNTER - 16], [RACK_X1 + 20, COUNTER - 16], [RACK_X1 + 20, COUNTER], [RACK_X0 - 20, COUNTER]], 6, 1);
    wash(c, '#a9b0b8');
    ink(c, 2);
    for (let i = 0; i <= 10; i++) {
      const x = RACK_X0 + (i * (RACK_X1 - RACK_X0)) / 10;
      c.beginPath();
      c.moveTo(x, COUNTER - 16);
      c.lineTo(x, RACK_Y + 10);
      ink(c, 2.2, '#7a848c');
      c.stroke();
    }
    c.beginPath();
    c.moveTo(RACK_X0, RACK_Y + 10);
    c.lineTo(RACK_X1, RACK_Y + 10);
    ink(c, 3, '#7a848c');
    c.stroke();
  }

  // A dish, from the side, centred on (0, 0).
  function dishShape(c, kind) {
    const K = KINDS[kind];
    const h = K.half;
    if (drawSprite(c, 'sprites.dishes', kind, 0, 0, { w: h * 2 + (kind >= 3 ? h * 0.9 : kind === 2 ? 20 : 0), anchor: 'center' })) return;
    if (K.name === 'plate' || K.name === 'pie dish') {
      blob(c, 0, 0, h, K.name === 'plate' ? 13 : 20, kind + 1, 0.04, 16);
      wash(c, K.face);
      ink(c, 2.2);
      c.beginPath();
      c.ellipse(0, -3, h * 0.7, 5, 0, 0, Math.PI * 2);
      ink(c, 2, K.rim);
      c.stroke();
    } else if (K.name === 'bowl') {
      c.beginPath();
      c.moveTo(-h, -16);
      c.quadraticCurveTo(-h * 0.9, 34, 0, 34);
      c.quadraticCurveTo(h * 0.9, 34, h, -16);
      c.closePath();
      wash(c, K.face);
      ink(c, 2.2);
      c.stroke();
      c.beginPath();
      c.moveTo(-h, -16);
      c.lineTo(h, -16);
      ink(c, 4, K.rim);
      c.stroke();
    } else if (K.name === 'cup') {
      poly(c, [[-h, -30], [h, -30], [h * 0.8, 30], [-h * 0.8, 30]], 3, 1);
      wash(c, K.face);
      ink(c, 2.2);
      c.beginPath();
      c.ellipse(h + 6, 0, 14, 18, 0, 0, Math.PI * 2);
      ink(c, 7, K.rim);
      c.stroke();
    } else {
      // pans: a body and a long handle to the right
      poly(c, [[h - 6, -10], [h + h * 0.9, -14], [h + h * 0.9, -2], [h - 6, 4]], 4, 1);
      wash(c, K.name === 'frying pan' ? '#3a2a20' : '#7a7f86');
      ink(c, 2);
      poly(c, [[-h, -14], [h, -14], [h * 0.92, K.name === 'saucepan' ? 40 : 12], [-h * 0.92, K.name === 'saucepan' ? 40 : 12]], 5, 1);
      wash(c, K.face);
      ink(c, 2.2);
    }
    // a wet shine
    c.save();
    c.globalAlpha = 0.6;
    c.beginPath();
    c.moveTo(-h * 0.5, -8);
    c.lineTo(-h * 0.2, -10);
    ink(c, 3, '#ffffff');
    c.stroke();
    c.restore();
  }

  function drawDove(c, t) {
    const x = g.x;
    // where each falling dish will come down: a ring on the counter under it
    for (const d of g.dishes) {
      const l = g.landing(d);
      if (!l || d.vy < -200 || l.x < SINK_X1 || l.x > RACK_X0) continue;
      const near = clamp(1 - l.t / 1.2, 0, 1);
      c.save();
      c.globalAlpha = 0.2 + 0.5 * near;
      c.beginPath();
      c.ellipse(l.x, COUNTER + 4, 30 + 30 * (1 - near), 8, 0, 0, Math.PI * 2);
      ink(c, 3, Math.abs(l.x - g.catchX()) < REACH ? PAL.magenta : '#5a6a88');
      c.stroke();
      c.restore();
    }
    // the shadow
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(x, COUNTER + 4, 80, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    const flip = false; // always facing the sink
    const run = Math.abs(g.vx) > 60 && !env.reduceMotion ? Math.abs(Math.sin(t * 16)) * 6 : 0;
    c.save();
    c.translate(x, COUNTER - run);
    c.rotate(clamp(g.vx / 9000, -0.1, 0.1));
    let pose = null;
    if (g.bumpT > 0) pose = 'bump';
    else if (g.crouch) pose = g.charge < 0.1 && !g.held ? 'sink' : g.held || g.charge >= FULL ? (g.turnT < 0.12 ? 'turn' : 'aim') : 'crouch';
    else if (g.dismay > 0) pose = 'dismay';
    else if (g.cheer > 0) pose = 'cheer';
    else if (g.lookT > 0) pose = 'look';
    let drawn = false;
    if (pose) {
      const [key, i, sc, fx, bot, cw] = DOVE_POSES[pose];
      const q = PXK / sc;
      drawn = drawSprite(c, key, i, FEET_X + (cw / 2 - fx) * q, (cw - bot) * q, { w: cw * q, whole: true, flip });
    }
    const squash = pose === 'sink' ? 0.95 : pose === 'crouch' || pose === 'turn' || pose === 'aim' ? 0.88 : 1;
    if (!drawn) {
      // the portrait: tipped back for the bump, squashed for the crouch,
      // hopping to cheer, drooping in dismay
      if (pose === 'bump') c.rotate(-0.14 * (g.bumpT / BUMP_T));
      if (squash < 1) c.scale(1.03, squash);
      if (pose === 'cheer' && !env.reduceMotion) c.translate(0, -Math.abs(Math.sin(g.cheer * 12)) * 22);
      if (pose === 'dismay') c.scale(1.06, 0.9);
      drawBird(c, 'glovedove', { x: 0, y: 0, size: SIZE, t, flip });
    }
    // how wound up the crouch is: a little arc of pink dots filling over the glove
    if (g.crouch) {
      const f = clamp(g.charge / FULL, 0, 1);
      const n = 5;
      for (let i = 0; i < n; i++) {
        c.beginPath();
        c.arc(ARM_C - 60 + i * 30, -(COUNTER - g.gloveY()) - 66, 7, 0, Math.PI * 2);
        c.fillStyle = i < Math.round(f * n) ? PAL.magenta : 'rgba(250,244,228,0.7)';
        c.fill();
        ink(c, 1.4);
        c.stroke();
      }
    }
    c.restore();
  }

  function drawRack(c) {
    const n = g.racked.length;
    const slots = 10;
    for (let i = Math.max(0, n - slots); i < n; i++) {
      const K = KINDS[g.racked[i]];
      const x = RACK_X0 + 14 + (i % slots) * ((RACK_X1 - RACK_X0 - 28) / (slots - 1));
      // a dish stood on its edge in the rack: its side view, turned upright
      if (drawSprite(c, 'sprites.dishes', g.racked[i], x, COUNTER - 16 - K.half, { w: K.half * 2, anchor: 'center', rot: -Math.PI / 2 })) continue;
      const h = K.half * 1.5;
      c.save();
      c.translate(x, COUNTER - 16);
      c.scale(0.22, 1);
      blob(c, 0, -h / 2, K.half, h / 2, i, 0.02);
      wash(c, K.face);
      ink(c, 6);
      c.restore();
    }
  }

  g.draw = (c, t) => {
    scene(c, 'glovedove', W, H, standinKitchen);
    drawRack(c);
    drawDove(c, t);
    for (const d of g.dishes) {
      c.save();
      c.translate(d.x, d.y);
      c.rotate(Math.sin(d.a) * 0.5);
      dishShape(c, d.kind);
      c.restore();
    }
    // a smashed dish: its painted heap, or (until that arrives) flying bits
    const painted = !!spriteCell('sprites.dishShards', 0);
    for (const h of g.heaps) {
      if (!painted) break;
      drawSprite(c, 'sprites.dishShards', h.kind, h.x, h.y + 6, { w: KINDS[h.kind].half * 2.4, alpha: clamp(h.life * 1.5, 0, 1) });
    }
    for (const s of painted ? [] : g.shards) {
      c.save();
      c.globalAlpha = clamp(s.life * 2, 0, 1);
      c.translate(s.x, s.y);
      c.rotate(s.a);
      poly(c, [[-10, -6], [12, -3], [2, 8]], 1, 0.5);
      wash(c, s.color);
      ink(c, 1.4);
      c.restore();
    }
    for (const p of g.pops) {
      const k = Math.min(1, (1.1 - p.life) * 8);
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${p.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(p.text, 0, 0);
      label(c, p.text, 0, 0, { size: p.size, color: p.color, weight: 800 });
      c.restore();
    }
    if (g.elapsed < 5) {
      c.save();
      c.globalAlpha = Math.min(1, 5 - g.elapsed);
      const msg = 'Hold to crouch under a dish · let go to bump it to the rack';
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = '600 34px Fraunces, Georgia, serif';
      c.textAlign = 'center';
      c.strokeText(msg, W / 2, 232);
      label(c, msg, W / 2, 232, { size: 34, weight: 600 });
      c.restore();
    }
  };

  // On a narrow screen: follow the Dove, leaning towards the rack.
  g.focus = () => clamp(g.x + 150, 650, 950);
  g.span = 1100;

  return g;
}
