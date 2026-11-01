// The Buttonbeaks: Button Up.
//
// Coats, cardigans and waistcoats come along the washing line, each with
// empty buttonholes, and every hole shows the button it is missing (its
// colour, its shape and its holes). The two Buttonbeaks stand behind the
// open button tin. Walk them to the bowl with the right button and press to
// pick it up, then walk under the coat as it passes and press again to toss
// it up: it sews itself into the matching hole. A button that doesn't match
// anything on that coat bounces off and is lost, and the Buttonbeaks are
// dazed for a moment. Coats with open holes simply carry on and away. It
// starts slow, one hole a coat; the line runs faster as time goes on, coats
// come with more holes, and two more bowls of look-alike buttons join the tin. Score: buttons sewn on.

import { art, drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';
import { subjectShape } from '../subjects.js';

Object.assign(SHEETS, {
  'sprites.buttons': [3, 2], // the six buttons, in KINDS order
  'sprites.coats': [4, 1], // coat, cardigan, waistcoat, jacket, each hung from two pegs
  'sprites.buttonBowl': [1, 1],
  'sprites.buttonbeaksToss': [2, 1], // holding a button up between them, tossing it
  'sprites.buttonbeaksPoses': [4, 1], // walking mid-stride, pecking into a bowl, dazed, cheering
});

const DURATION = 45;
// Measured on the delivered scene (IC-M05a): the line's hooks on the two
// posts, the open tin's rim.
const LINE_Y = 116; // the washing line, at its hooks
const HOOK_L = 98;
const HOOK_R = 1502;
const SAG = 26;
const COAT_W = 230;
const COAT_H = 290;
const HOLE_DY = [80, 155, 228]; // the buttonholes, below the line: on each painted coat's centre strip
const GROUND = 748; // the Buttonbeaks' feet, on the lawn just behind the tin
const SIZE = 280;
const K = SIZE / 400;
// Where the held button sits, and how tall the pair stands: in the painting
// it sits between their two heads, above the pink one's beak (372 units
// up, 26 right), and the taller bird's head is 362 up; in the stand-in, 205 and 230.
const painted = () => !!subjectShape('buttonbeaks').feet;
// Measured on the delivered pose sheets, in each cell's pixels: where the
// claws stand (the middle of the feet and their lowest point), and the scale
// the pair is painted at in that cell against the portrait (they were painted
// smaller, and not all alike: design/source/pose-scales.json). Each cell is
// drawn that much bigger, so the pair stay one size. The portrait's feet are
// centred 33 px right of its middle, at 1024 x 1024.
const KP = (SIZE / 400) * (420 / 1024); // screen px per portrait px
const POSES = {
  'sprites.buttonbeaksToss': { cells: [{ fx: 530, feet: 988, painted: 0.905 }, { fx: 493, feet: 946, painted: 0.899 }] },
  'sprites.buttonbeaksPoses': { cells: [{ fx: 545, feet: 923, painted: 0.857 }, { fx: 498, feet: 912, painted: 0.784 }, { fx: 547, feet: 924, painted: 0.82 }, { fx: 583, feet: 920, painted: 0.819 }] },
};
// Screen px per pixel of a pose cell.
const poseK = (key, i) => KP / POSES[key].cells[i].painted;
// In the holding pose (IC-M05e, cell 0) their beak tips meet at (543, 184):
// the button sits just above them.
const HOLD_CELL = { x: 543, y: 150 };
const holdingPainted = () => !!art('sprites.buttonbeaksToss');
const holdY = () => (holdingPainted() ? GROUND - (POSES['sprites.buttonbeaksToss'].cells[0].feet - HOLD_CELL.y) * poseK('sprites.buttonbeaksToss', 0) : GROUND - (painted() ? 372 : 205) * K);
const holdDX = () => (holdingPainted() ? 33 * KP + (HOLD_CELL.x - POSES['sprites.buttonbeaksToss'].cells[0].fx) * poseK('sprites.buttonbeaksToss', 0) : painted() ? 26 * K : 0);
// A painted pose, its feet on (x, y).
function drawPose(c, key, i, x, y, rot = 0) {
  const sp = spriteCell(key, i);
  if (!sp) return false;
  const m = POSES[key].cells[i];
  const k = poseK(key, i);
  const cl = sp.cell;
  c.save();
  c.translate(x + 33 * KP, y);
  if (rot) c.rotate(rot);
  c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, -m.fx * k, -m.feet * k, cl.w * k, cl.h * k);
  c.restore();
  return true;
}
const TALL = () => (painted() ? 362 : 230) * K;
// The taller (yellow-headed) bird's beak tip, measured on the delivered
// pictures' alpha: the farthest opaque pixel of its beak towards the left,
// where it points (the top one of a tie). In the portrait (standing) at (50, 192) of 1024 x 1024
// (feet at PAINTED.feet 0.942 of its height, drawn 420 units wide, centred);
// striding (poses cell 0) at (112, 287); cheering (poses cell 3) at
// (174, 186), its lower beak's corner. As screen offsets from the pair's
// feet point (g.x, GROUND): about (-133, -222), (-136, -213), (-134, -257),
// so whichever is showing, the tip stands within 3 px over the same spot.
// The stand-in: the left bird's button head, its left edge (-137, -150) units.
// (The pink one's beak tip is about (487, 352) in the portrait, 7 px left of
// g.x: the old reach round the pair's middle is the reach under its beak.)
export const BEAK_PX = { portrait: [50, 192], stride: [112, 287], cheer: [174, 186] };
const PORTRAIT_FEET = 0.942;
export const TALL_BEAK = {
  portrait: [(BEAK_PX.portrait[0] - 512) * KP, (BEAK_PX.portrait[1] - PORTRAIT_FEET * 1024) * KP],
  stride: poseBeak('sprites.buttonbeaksPoses', 0, BEAK_PX.stride),
  cheer: poseBeak('sprites.buttonbeaksPoses', 3, BEAK_PX.cheer),
  standin: [-137 * K, -150 * K],
};
function poseBeak(key, i, [px, py]) {
  const m = POSES[key].cells[i];
  return [33 * KP + (px - m.fx) * poseK(key, i), (py - m.feet) * poseK(key, i)];
}
// How far from a bowl's middle the tall beak tip is still over it: the bowl
// is drawn 150 wide (its painted rim, trimmed).
export const BOWL_HALF = 75;
const BOWL_Y = 756; // the bowls' rims, set into the tin
// Measured on the delivered coats (IC-M05c), in each cell's pixels: the
// centre strip's x and the shoulders' y (drawn at the line), and the scale.
const COAT_CELLS = [{ x: 246, top: 292 }, { x: 250, top: 294 }, { x: 246, top: 306 }, { x: 244, top: 304 }];
const COAT_K = 0.72;
const BOWL_GAP = 176;
const REACH = 80; // how near a bowl they must be to pick from it
const DAZE = 1;

// Each button: colour, shape and its holes. The last two look like the first
// two at a glance (same colours), and join the tin later.
export const KINDS = [
  { c: PAL.strawberry, d: '#b8506e', shape: 'round', holes: 4 },
  { c: PAL.slate, d: '#4f6a88', shape: 'round', holes: 2 },
  { c: PAL.lemon, d: '#b8a030', shape: 'square', holes: 4 },
  { c: PAL.sage, d: '#5f7f48', shape: 'flower', holes: 2 },
  { c: PAL.strawberry, d: '#b8506e', shape: 'square', holes: 2 },
  { c: PAL.slate, d: '#4f6a88', shape: 'flower', holes: 4 },
];
const COAT_COLS = [PAL.mustard, PAL.olive, PAL.dusty, PAL.ochre, '#9aa8b8', PAL.mauve, '#c9b48a'];

export const bowlX = (i, n) => 800 + (i - (n - 1) / 2) * BOWL_GAP;
const lineY = (x) => LINE_Y + SAG * Math.max(0, 1 - Math.pow((x - 800) / ((HOOK_R - HOOK_L) / 2), 2));

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 800,
    vx: 0,
    holding: null, // the kind of button they hold
    coats: [], // { x, col, style, holes: [{ dy, kind, sewn, t }], done }
    flying: [], // tossed buttons: { kind, x, y, vy, state }
    bowls: 4,
    daze: 0,
    pickT: 0, // pecking a button out of a bowl
    cheerT: 0, // a button sewn on
    moving: false,
    tossT: 0,
    nextCoat: 0,
    sewn: 0,
    wrong: 0,
    dropped: 0, // buttons let go with B
    open: 0, // holes that went by unfilled
    full: 0, // coats buttoned all the way
    pops: [],
  };

  function pop(text, x, y, color = INK, size = 44) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  // How hard it is now, 0 to 1, along the shared curve for the chosen
  // Difficulty (see difficulty.js): a slow line, one hole a coat and four
  // bowls at first. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  g.lineSpeed = () => knob(g.d(), 75, 98, 150); // px/s
  g.coatGap = () => knob(g.d(), 330, 297, 220); // px of line between coats, plus up to 80
  g.holesMean = () => knob(g.d(), 1, 1.45, 2.7); // holes on a coat, on average
  // the two bowls of look-alikes join a little before medium (about 19 s in
  // at Normal; never at Easier)
  g.bowlsNow = () => (g.d() < 0.36 ? 4 : 6);
  // holes on a coat: one at first, about one and a half at medium, two or
  // three (mostly three) at hard
  const holesNow = (r) => {
    const h = g.holesMean();
    return Math.floor(h) + (r < h - Math.floor(h) ? 1 : 0);
  };
  g.bowls = g.bowlsNow();

  function addCoat(x) {
    const kinds = g.bowlsNow();
    const n = holesNow(rng());
    const rows = n === 1 ? [1] : n === 2 ? [0, 2] : [0, 1, 2];
    g.coats.push({
      x,
      col: COAT_COLS[Math.floor(rng() * COAT_COLS.length)],
      style: Math.floor(rng() * 4),
      holes: rows.map((r) => ({ dy: HOLE_DY[r], kind: Math.floor(rng() * kinds), sewn: false, t: 0 })),
      swing: 0,
      ph: rng() * 6,
    });
  }
  // Two coats already on their way in.
  addCoat(W - 420);
  addCoat(W - 70);
  g.nextCoat = g.coatGap() - 70;

  g.coatTop = (coat) => lineY(coat.x) + 8;
  g.bowlX = (i) => bowlX(i, g.bowls);
  // The tall bird's beak tip on screen, standing (the portrait), or the
  // stand-in's until the painting loads.
  g.beak = (x = g.x) => {
    const [dx, dy] = painted() ? TALL_BEAK.portrait : TALL_BEAK.standin;
    return { x: x + dx, y: GROUND + dy };
  };
  // Where the pair stand to hold the tall beak over bowl i.
  g.pickX = (i) => clamp(bowlX(i, g.bowls) - (g.beak(0).x), 140, W - 140);
  // The bowl under a point, within dx of its middle, if any.
  const bowlAt = (x, dx) => {
    for (let i = 0; i < g.bowls; i++) if (Math.abs(bowlX(i, g.bowls) - x) < dx) return i;
    return -1;
  };
  // The bowl they pick from, if any: the one under the tall bird's beak tip
  // (he's the dominant one, so his comes first), else the one in front of
  // the pair's middle, under the pink one's beak.
  g.overBowl = (x = g.x) => {
    const tall = bowlAt(g.beak(x).x, BOWL_HALF + 0.5);
    return tall >= 0 ? tall : bowlAt(x, REACH);
  };
  // The coat a toss from x would reach.
  g.coatAbove = (x = g.x) => g.coats.find((c) => Math.abs(c.x - x) < COAT_W / 2 - 10) || null;

  function pick(i) {
    g.holding = i;
    g.pickT = 0.25;
    sfx('catch', { pitch: i });
    pop('Got it', bowlX(i, g.bowls), BOWL_Y - 70, INK, 30);
  }

  // B: let go of the button they hold. It drops into the grass, lost but
  // harmless: no daze, nothing counted against them.
  function discard() {
    g.flying.push({ kind: g.holding, x: g.x + holdDX(), y: holdY(), vy: -350, vx: (rng() - 0.5) * 240, state: 'off', spin: 0 });
    g.holding = null;
    g.dropped++;
    sfx('pour', { pitch: -4 });
    pop('Dropped', g.x + holdDX(), holdY() - 50, PAL.grey, 30);
  }

  function toss() {
    g.flying.push({ kind: g.holding, x: g.x + holdDX(), y: holdY(), vy: -1500, vx: 0, state: 'up', spin: 0 });
    g.holding = null;
    g.tossT = 0.3;
    sfx('pour');
  }

  // A tossed button reaches a coat: into the matching open hole, or off.
  function land(b, coat) {
    const top = g.coatTop(coat);
    const hole = coat.holes
      .filter((h) => !h.sewn && h.kind === b.kind)
      .sort((a, c) => Math.abs(top + a.dy - b.y) - Math.abs(top + c.dy - b.y))[0];
    if (hole) {
      hole.sewn = true;
      hole.t = 0.5;
      b.state = 'gone';
      g.score++;
      g.sewn++;
      g.cheerT = 0.6;
      coat.swing = 0.6;
      sfx('ding', { pitch: (g.sewn % 5) * 2 });
      env.vibrate?.(25);
      pop('+1', coat.x + 60, top + hole.dy - 30, PAL.magenta, 44);
      if (coat.holes.every((h) => h.sewn)) {
        g.full++;
        pop('All buttoned!', coat.x, top + COAT_H + 40, PAL.magenta, 40);
        sfx('right');
      }
    } else {
      b.state = 'off';
      b.vy = 300;
      b.vx = (rng() - 0.5) * 300;
      g.wrong++;
      g.daze = DAZE;
      coat.swing = 0.4;
      sfx('bonk');
      env.vibrate?.(60);
      pop(coat.holes.some((h) => !h.sewn) ? 'Not that one!' : 'All done already!', coat.x, top + COAT_H + 40, PAL.brick, 38);
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
    g.daze = Math.max(0, g.daze - dt);
    g.tossT = Math.max(0, g.tossT - dt);
    g.pickT = Math.max(0, g.pickT - dt);
    g.cheerT = Math.max(0, g.cheerT - dt);
    const was = g.x;
    const nb = g.bowlsNow();
    if (nb !== g.bowls) {
      g.bowls = nb;
      pop('New buttons!', 800, BOWL_Y - 120, PAL.magenta, 46);
      sfx('bloom');
      if (g.holding !== null && g.holding >= nb) g.holding = null;
    }

    // Walk: follow the pointer, or run with the stick.
    if (input.pointer.active) g.x = approach(g.x, input.pointer.x, 12, dt);
    else {
      g.vx = approach(g.vx, input.x * 950, 14, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, 140, W - 140);
    g.moving = Math.abs(g.x - was) > 40 * dt;

    // B lets go of a held button (dazed or not).
    if (input.bPressed && g.holding !== null) discard();
    else if (input.actionPressed && g.daze <= 0) {
      if (input.pointer.active) {
        // touch: tap a bowl to pick from it, tap up by the coats to toss
        g.x = clamp(input.pointer.x, 140, W - 140);
        if (input.pointer.y > 712) {
          const i = bowlAt(input.pointer.x, REACH);
          if (i >= 0) pick(i);
        } else if (g.holding !== null) toss();
      } else if (g.holding !== null) toss();
      else {
        const i = g.overBowl();
        if (i >= 0) pick(i);
      }
    }

    // The line moves along.
    const v = g.lineSpeed();
    for (const coat of g.coats) {
      coat.x -= v * dt;
      coat.swing = Math.max(0, coat.swing - dt);
      for (const h of coat.holes) h.t = Math.max(0, h.t - dt);
      if (coat.x < -COAT_W && !coat.gone) {
        coat.gone = true;
        const open = coat.holes.filter((h) => !h.sewn).length;
        g.open += open;
      }
    }
    g.coats = g.coats.filter((c) => !c.gone);
    g.nextCoat -= v * dt;
    if (g.nextCoat <= 0) {
      addCoat(W + COAT_W / 2 + 20);
      g.nextCoat = g.coatGap() + rng() * 80;
    }

    for (const b of g.flying) {
      b.spin += dt * 12;
      if (b.state === 'up') {
        b.y += b.vy * dt;
        const coat = g.coats.find((c) => Math.abs(c.x - b.x) < COAT_W / 2 - 10 && b.y < g.coatTop(c) + COAT_H - 20);
        if (coat) land(b, coat);
        else if (b.y < -40) {
          b.state = 'gone';
          pop('Missed', b.x, 120, PAL.grey, 32);
        }
      } else if (b.state === 'off') {
        b.vy += 2000 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y > H + 40) b.state = 'gone';
      }
    }
    g.flying = g.flying.filter((b) => b.state !== 'gone');

    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Buttons ${g.score}`;
  g.summary = () => {
    const lines = [`${g.sewn} button${g.sewn === 1 ? '' : 's'} sewn on, ${g.full} coat${g.full === 1 ? '' : 's'} buttoned all the way.`];
    lines.push(g.wrong ? `${g.wrong} button${g.wrong === 1 ? '' : 's'} bounced off.` : 'Not one button bounced off!');
    return lines;
  };

  // ---------- drawing ----------

  // A button, drawn r across (or its ghost in an empty hole).
  function drawButton(c, kind, x, y, r, { ghost = false, rot = 0 } = {}) {
    const k = KINDS[kind];
    if (!ghost && drawSprite(c, 'sprites.buttons', kind, x, y, { h: r * 2, anchor: 'center', rot })) return;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    if (ghost) c.globalAlpha *= 0.85 + 0.15 * Math.sin(g.elapsed * 5);
    if (k.shape === 'round') blob(c, 0, 0, r, r, kind + 1, 0.02);
    else if (k.shape === 'square') poly(c, [[-r * 0.86, -r * 0.86], [r * 0.86, -r * 0.86], [r * 0.86, r * 0.86], [-r * 0.86, r * 0.86]], kind, 1);
    else {
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const rr = r * (0.82 + 0.18 * Math.cos(a * 5));
        if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    }
    if (ghost) {
      c.fillStyle = k.c;
      c.globalAlpha *= 0.75;
      c.fill();
      c.globalAlpha /= 0.75;
      c.save();
      c.setLineDash([5, 5]);
      ink(c, 2.4, k.d);
      c.restore();
    } else {
      wash(c, k.c, 1);
      ink(c, 2.2);
      // the rim
      if (k.shape === 'round') {
        c.beginPath();
        c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        ink(c, 1.2, k.d);
      }
    }
    // the thread holes
    c.fillStyle = ghost ? k.d : INK;
    const h = r * 0.26;
    const pts = k.holes === 2 ? [[-h, 0], [h, 0]] : [[-h, -h], [h, -h], [-h, h], [h, h]];
    for (const [px, py] of pts) {
      c.beginPath();
      c.arc(px, py, Math.max(2.5, r * 0.11), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function drawCoat(c, coat, t) {
    const top = g.coatTop(coat);
    const sw = coat.swing > 0 && !env.reduceMotion ? Math.sin(coat.swing * 20) * 0.04 * coat.swing : 0;
    c.save();
    c.translate(coat.x, top);
    c.rotate(sw + Math.sin(t * 1.4 + coat.ph) * 0.012);
    const sp = spriteCell('sprites.coats', coat.style);
    if (sp) {
      // the painted garment: its centre strip on the line of holes, its
      // shoulders just under the pegs
      const m = COAT_CELLS[coat.style];
      const cl = sp.cell;
      c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, -m.x * COAT_K, -m.top * COAT_K, cl.w * COAT_K, cl.h * COAT_K);
    } else {
      const w = COAT_W / 2;
      const sleeve = coat.style !== 2; // the waistcoat has none
      const len = coat.style === 1 ? COAT_H - 10 : coat.style === 2 ? COAT_H - 16 : COAT_H;
      poly(c, [[-w + 30, 0], [-26, 10], [0, 40], [26, 10], [w - 30, 0], [w, 40], [w - 10, len], [-w + 10, len], [-w, 40]], coat.style + 2, 1.5);
      wash(c, coat.col);
      ink(c, 2.4);
      poly(c, [[-w + 30, 0], [-26, 10], [0, 40], [26, 10], [w - 30, 0], [w, 40], [w - 10, len], [-w + 10, len], [-w, 40]], coat.style + 2, 1.5);
      hatch(c, -w, 0, w, len, 12, 0.14, 1);
      if (sleeve) {
        for (const s of [-1, 1]) {
          poly(c, [[s * (w - 6), 36], [s * (w + 40), 150], [s * (w + 16), 168], [s * (w - 10), 96]], s + 5, 1.2);
          wash(c, coat.col);
          ink(c, 2.2);
        }
      }
      // the collar and the placket down the middle
      poly(c, [[-26, 10], [0, 40], [26, 10], [10, 4], [0, 22], [-10, 4]], 3, 0.8);
      wash(c, '#f2e6c8', 0.8);
      ink(c, 1.6);
      c.beginPath();
      c.moveTo(0, 40);
      c.lineTo(0, len);
      ink(c, 1.8);
      // pockets
      for (const s of [-1, 1]) {
        poly(c, [[s * 68 - 24, len - 90], [s * 68 + 24, len - 90], [s * 68 + 22, len - 40], [s * 68 - 22, len - 40]], s + 9, 1);
        ink(c, 1.6);
      }
    }
    // the clothes pegs
    for (const s of [-1, 1]) {
      poly(c, [[s * 80 - 7, -22], [s * 80 + 7, -22], [s * 80 + 6, 24], [s * 80 - 6, 24]], s + 11, 0.8);
      wash(c, '#d9b98a');
      ink(c, 1.6);
    }
    // the buttonholes: a slit and the button it wants, or the button sewn on
    for (const h of coat.holes) {
      if (h.sewn) {
        const s = 1 + h.t * 0.6;
        drawButton(c, h.kind, 0, h.dy, 24 * s);
        c.beginPath();
        c.moveTo(-6, h.dy - 6);
        c.lineTo(6, h.dy + 6);
        ink(c, 1.4, '#f4ecd8');
      } else {
        // a pale patch so the wanted button reads on any cloth
        blob(c, 0, h.dy, 36, 36, h.dy, 0.05);
        wash(c, '#faf3e0', 0.9);
        c.save();
        c.setLineDash([3, 5]);
        ink(c, 1.4);
        c.restore();
        drawButton(c, h.kind, 0, h.dy, 26, { ghost: true });
        if (g.holding === h.kind) {
          // the button they hold fits here: a pulsing ring says where to run
          const k = 0.5 + 0.5 * Math.sin(t * 8);
          c.beginPath();
          c.arc(0, h.dy, 44 + k * 8, 0, Math.PI * 2);
          ink(c, 4, `rgba(192,64,122,${0.55 + 0.45 * k})`);
        }
        c.beginPath();
        c.moveTo(-14, h.dy + 46);
        c.lineTo(14, h.dy + 46);
        ink(c, 3, INK);
      }
    }
    c.restore();
  }

  function drawBowl(c, i, t) {
    const x = bowlX(i, g.bowls);
    const near = g.overBowl() === i;
    c.save();
    if (near) {
      c.beginPath();
      c.ellipse(x, BOWL_Y + 4, 84, 30, 0, 0, Math.PI * 2);
      c.save();
      c.setLineDash([8, 8]);
      ink(c, 3, PAL.magenta);
      c.restore();
    }
    if (!drawSprite(c, 'sprites.buttonBowl', 0, x, BOWL_Y + 42, { w: 150 })) {
      c.beginPath();
      c.moveTo(x - 72, BOWL_Y - 8);
      c.quadraticCurveTo(x - 66, BOWL_Y + 36, x, BOWL_Y + 38);
      c.quadraticCurveTo(x + 66, BOWL_Y + 36, x + 72, BOWL_Y - 8);
      c.closePath();
      wash(c, '#c9925a');
      ink(c, 2.2);
      c.beginPath();
      c.ellipse(x, BOWL_Y - 8, 72, 16, 0, 0, Math.PI * 2);
      wash(c, '#8a5a3a', 0.9);
      ink(c, 2);
    }
    // a little heap of its buttons
    for (const [dx, dy, r] of [[-30, -16, 20], [30, -14, 20], [0, -26, 22]]) drawButton(c, i, x + dx, BOWL_Y + dy, r, { rot: dx * 0.02 });
    c.restore();
  }

  function drawBeaks(c, t) {
    const daze = g.daze > 0 && !env.reduceMotion ? Math.sin(g.daze * 40) * 0.06 : 0;
    const walk = g.moving ? Math.abs(Math.sin(t * 12)) * 8 : 0;
    const toss = g.tossT > 0 ? g.tossT / 0.3 : 0;
    // The painted poses: tossing, pecking, dazed, cheering, holding a button
    // up, striding; otherwise the portrait. Each stands on its own claws.
    const stride = g.moving && Math.floor(t * 7) % 2;
    const pose = toss > 0 ? ['sprites.buttonbeaksToss', 1]
      : g.pickT > 0 ? ['sprites.buttonbeaksPoses', 1]
      : g.daze > 0 ? ['sprites.buttonbeaksPoses', 2]
      : g.cheerT > 0 && g.holding === null ? ['sprites.buttonbeaksPoses', 3]
      : g.holding !== null ? ['sprites.buttonbeaksToss', 0]
      : stride ? ['sprites.buttonbeaksPoses', 0] : null;
    const drawn = pose && drawPose(c, pose[0], pose[1], g.x, GROUND - (pose[0] === 'sprites.buttonbeaksToss' && pose[1] === 0 ? walk : 0), daze);
    if (!drawn) {
      c.save();
      c.translate(g.x, GROUND - walk - g.cheerT * 30);
      c.rotate(daze);
      drawBird(c, 'buttonbeaks', { x: 0, y: 0, size: SIZE, t, squash: toss * -0.08 });
      c.restore();
    }
    if (g.holding !== null && g.pickT <= 0) {
      const hy = holdY() - walk + Math.sin(t * 4) * 2;
      if (!holdingPainted()) {
        // a thread from the beaks up to the button
        c.beginPath();
        if (painted()) {
          c.moveTo(g.x - 150 * K, GROUND - 300 * K - walk);
          c.quadraticCurveTo(g.x - 60 * K, hy - 30, g.x + holdDX(), hy);
          c.quadraticCurveTo(g.x + 10 * K, hy + 40, g.x - 9 * K, GROUND - 252 * K - walk);
        } else {
          c.moveTo(g.x - 40, hy + 60);
          c.quadraticCurveTo(g.x, hy - 10, g.x + 40, hy + 60);
        }
        ink(c, 1.6, '#b8506e');
      }
      drawButton(c, g.holding, g.x + holdDX(), hy, 28);
    }
    if (g.daze > 0) label(c, '✶  ✶', g.x, GROUND - TALL() - 24, { size: 30, color: PAL.ochre, weight: 800 });
  }


  g.draw = (c, t) => {
    scene(c, 'buttonbeaks', W, H, (c) => {
      band(c, 0, 0, W, 600, PAL.sky, 0.5, 1);
      for (const [cx, cy] of [[300, 90], [1200, 70], [760, 520]]) {
        blob(c, cx, cy, 120, 32, cx, 0.12);
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fill();
      }
      // a hedge and the garden
      blob(c, 800, 640, 900, 90, 4, 0.04, 30);
      wash(c, PAL.green, 0.5);
      band(c, 0, 640, W, H - 640, PAL.sage, 0.55, 3);
      band(c, 0, 760, W, H - 760, '#b8c49a', 0.45, 6);
      // the two posts and the line
      for (const px of [HOOK_L - 36, HOOK_R + 36]) {
        poly(c, [[px - 14, LINE_Y - 30], [px + 14, LINE_Y - 30], [px + 16, 720], [px - 16, 720]], px, 1);
        wash(c, '#a87444');
        ink(c, 2.2);
      }
      // the button tin, open, the bowls set in it
      poly(c, [[200, 740], [W - 200, 740], [W - 200, 900], [200, 900]], 8, 1.2);
      wash(c, '#9aa8b8');
      ink(c, 2.4);
      poly(c, [[200, 740], [W - 200, 740], [W - 200, 900], [200, 900]], 8, 1.2);
      hatch(c, 196, 736, W - 196, 904, 10, 0.18, 1);
    });
    // the line itself, drawn in code because the coats hang on it
    c.beginPath();
    c.moveTo(HOOK_L, lineY(HOOK_L));
    for (let x = HOOK_L + 39; x <= HOOK_R; x += 39) c.lineTo(x, lineY(x));
    ink(c, 2.4);

    for (const coat of g.coats) drawCoat(c, coat, t);
    // where a toss would go
    const above = g.holding !== null ? g.coatAbove(g.x + holdDX()) : null;
    c.save();
    c.setLineDash([4, 10]);
    c.beginPath();
    c.moveTo(g.x + holdDX(), holdY() - 40);
    c.lineTo(g.x + holdDX(), above ? g.coatTop(above) + COAT_H : holdY() - 140);
    ink(c, 2, g.holding === null ? 'rgba(59,43,32,0)' : above ? PAL.magenta : 'rgba(59,43,32,0.35)');
    c.restore();

    drawBeaks(c, t);
    for (let i = 0; i < g.bowls; i++) drawBowl(c, i, t);
    for (const b of g.flying) drawButton(c, b.kind, b.x, b.y, 26, { rot: b.spin });

    for (const p of g.pops) {
      const k = Math.min(1, (1.3 - p.life) * 8);
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

    if (g.elapsed < 4) {
      c.save();
      c.globalAlpha = Math.min(1, 4 - g.elapsed);
      hint(c, 'Pick the button it needs · toss it up under the coat', W / 2, 560, { focus: g.focus(), span: g.span, size: 34, weight: 600 });
      c.restore();
    }
  };

  g.focus = () => g.x;
  g.span = 1000;

  return g;
}
