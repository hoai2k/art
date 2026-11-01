// Steampresser Sparrow: Pressing Business.
//
// The laundry's ironing board, and a basket of crumpled washing. One garment
// at a time slides onto the board, crossed with creases. The Steampresser
// Sparrow is the iron: move it anywhere on the board (stick, arrows or
// pointer), and any crease under its sole is pressed flat as it passes;
// each crease pressed out scores one. Press the action for a puff of steam,
// which presses much faster for a moment (three puffs in the tank, refilling
// as you go). But an iron left lingering heats the cloth, and steam heats
// it faster: let it get too hot and it scorches (−1, and the garment's
// bonus is lost). Keep it moving. Press
// out every crease of a garment without a scorch for a bonus of two. The
// next garment comes when this one is done or its time runs out; later ones
// have more creases, less time, and some are delicate silk that scorches
// sooner. Score: points.

import { drawBird, drawSprite, scene, art, SHEETS, band, blob, poly, wash, ink, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  // shirt, handkerchief, trousers, silk scarf, pillowcase, tablecloth: laid flat, seen from above
  'sprites.pressGarments': [3, 2],
  // the Sparrow pressing, legs tucked under; the same with steam billowing from its sole
  'sprites.sparrowPress': [2, 1],
  // scorched: jerked up off the cloth in alarm, beak open, a wisp of smoke
  'sprites.sparrowScorch': [1, 1],
});

const DURATION = 45;
// The ironing board, seen from above.
// The painted board (IC-M09a) runs from its point at x 95 to its square end
// at 1470, its top from 362 down to 728 px.
const BX0 = 150;
const BX1 = 1450;
const BY0 = 362;
const BY1 = 728;
// Where the iron can go (its sole's centre).
const IX0 = 230;
const IX1 = 1390;
const IY0 = 395;
const IY1 = 700;
const CELL = 40;
const COLS = Math.ceil((BX1 - BX0) / CELL);
const ROWS = Math.ceil((BY1 - BY0) / CELL);

const SOLE_RX = 78;
const SOLE_RY = 40;
const PRESS = 1.4; // pressing per second under the sole
const STEAM_PRESS = 2.7;
const STEAM_SIZE = 1.25;
const PUFF = 0.65; // seconds of steam per puff
const TANK = 3;
const REFILL = 1.3; // seconds per puff
const HEAT = 0.4; // heat per second while lingering, dry
const STEAM_HEAT = 1.5;
const COOL = 0.9;
const STILL = 400; // at or above this speed, the cloth doesn't heat
const SPEED = 640;
const SIZE = 290;
const K = SIZE / 400;
// The painting, measured on its 1024 px square: the sole runs from the toe
// (240, 566) px down to the heel (895, 694) px, tipped 0.19 rad, its middle
// 23 units right of centre and 140 units above the feet; drawn at this size
// its sole is as long as the footprint the game presses with.
const PAINTED = { size: 250, sole: [23, -140], tilt: 0.19 };
// The pressing sprites (IC-M09c, IC-M09d), measured on their 1024 px cells:
// the press sheet's sole runs from x 230 to 960 with its underside at 816,
// so its middle (595, 816) goes over the footprint's middle; the scorched
// pose is tipped up with its heel at (871, 877), which is put where the
// press pose's heel is (365 px right of the middle), so the heel stays on
// the cloth as it swaps in. At this scale the sole is 170 px long.
const PRESS_SCALE = 170 / 730;
const PRESS_CELLS = { press: [595, 816], scorch: [871 - 365, 877] };

// Each garment's size is the painted one's (IC-M09b) shape, measured on its
// 1024 x 512 cell, and `cloth` lists where creases may go, as fractions of
// that painted box (inside the shirt's body and sleeves, the trousers' legs,
// the scarf without its fringe, inside the borders).
const GARMENTS = [
  { kind: 'hanky', w: 500, h: 326, col: '#f4f0e4', i: 1, cloth: [[0.08, 0.1, 0.92, 0.9]] },
  { kind: 'shirt', w: 880, h: 328, col: '#dfe8f0', i: 0, cloth: [[0.28, 0.08, 0.72, 0.94], [0.08, 0.3, 0.92, 0.5]] },
  { kind: 'pillow', w: 700, h: 328, col: '#f2e8d8', i: 4, cloth: [[0.04, 0.07, 0.86, 0.93]] },
  { kind: 'trousers', w: 920, h: 326, col: '#9aa0a8', i: 2, cloth: [[0.03, 0.1, 0.97, 0.42], [0.03, 0.58, 0.97, 0.9], [0.03, 0.1, 0.3, 0.9]] },
  { kind: 'cloth', w: 700, h: 327, col: '#f0e6dc', i: 5, cloth: [[0.06, 0.1, 0.94, 0.9]] },
  { kind: 'scarf', w: 1000, h: 180, col: '#eab0c4', i: 3, silk: true, cloth: [[0.1, 0.16, 0.9, 0.84]] },
];
const onCloth = (G, cx, cy, x, y) => {
  const u = (x - cx) / G.w + 0.5;
  const v = (y - cy) / G.h + 0.5;
  return G.cloth.some(([u0, v0, u1, v1]) => u > u0 && u < u1 && v > v0 && v < v1);
};

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 800,
    y: 590,
    vx: 0,
    vy: 0,
    speed: 0,
    steam: 0, // seconds of steam left in this puff
    tank: TANK,
    garment: null,
    leaving: null, // the last one, sliding off
    gT: 0,
    heat: new Float32Array(COLS * ROWS),
    scorchCool: 0,
    pops: [],
    puffs: [],
    count: 0,
    creases: 0,
    scorches: 0,
    perfect: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js). Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.creaseCount = () => knob(g.d(), 2, 4.1, 6.6); // creases per garment (before size and luck)
  g.timeLimit = () => knob(g.d(), 14, 11.2, 7.5); // seconds per garment (plus 0.6 s a crease)
  g.silkChance = () => knob(g.d(), 0.1, 0.23, 0.4); // chance of a silk scarf, after the first third
  function pop(text, x, y, color = INK, size = 42) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }
  const add = (n) => {
    g.score = Math.max(0, g.score + n);
  };

  // A garment with its creases: each crease a wavy line of points, each
  // point pressed flat 0..1.
  function nextGarment() {
    const p = progress();
    g.count++;
    // The first third brings the smaller, plainer pieces; trousers, shirts
    // and (later still) silk join as the round goes on.
    let pool = GARMENTS.filter((G) => !G.silk && (p > 1 / 3 || G.w < 850) && (p < 2 / 3 || G.w > 600));
    if (g.count === 1) pool = [GARMENTS[0]];
    else if (p > 1 / 3 && rng() < g.silkChance()) pool = [GARMENTS[5]];
    const G = pool[Math.floor(rng() * pool.length)];
    const cx = 830;
    const cy = 545;
    const n = Math.min(7, Math.round(g.creaseCount() + (G.w > 850 ? 1 : 0) + (rng() < 0.4 ? 1 : 0)));
    const creases = [];
    for (let k = 0; k < n; k++) {
      let tries = 0;
      let c = null;
      while (tries++ < 60) {
        // a crease that will not fit is tried shorter
        const len = lerp(150, 290, rng()) * (0.8 + 0.45 * k) * Math.max(0.4, 1 - tries / 50);
        const a = (rng() - 0.5) * 2.2;
        const mx = cx + (rng() - 0.5) * (G.w - len * 0.8 - 60);
        const my = cy + (rng() - 0.5) * (G.h - 80);
        const x0 = mx - (Math.cos(a) * len) / 2;
        const y0 = my - (Math.sin(a) * len) / 2;
        const bend = (rng() - 0.5) * 50;
        const pts = [];
        const m = Math.max(4, Math.round(len / 22));
        for (let i = 0; i <= m; i++) {
          const u = i / m;
          const off = Math.sin(u * Math.PI) * bend;
          pts.push({ x: x0 + Math.cos(a) * len * u - Math.sin(a) * off, y: y0 + Math.sin(a) * len * u + Math.cos(a) * off, flat: 0 });
        }
        if (pts.every((q) => q.x > IX0 && q.x < IX1 && q.y > IY0 && q.y < IY1 && onCloth(G, cx, cy, q.x, q.y))) {
          if (!creases.some((o) => o.pts.some((q) => pts.some((r) => Math.hypot(q.x - r.x, q.y - r.y) < 40)))) {
            c = { pts, done: false, seed: rng() * 100 };
            break;
          }
        }
      }
      if (c) creases.push(c);
    }
    const limit = g.timeLimit() + creases.length * 0.6;
    g.garment = { ...G, cx, cy, creases, limit, at: g.elapsed, t: 0, slide: 1, scorched: 0, marks: [] };
    g.heat.fill(0);
    sfx('page');
  }
  nextGarment();

  // Bot and test helpers.
  g.open = () => (g.garment ? g.garment.creases.filter((c) => !c.done) : []);
  g.solePoint = (q, steam = g.steam > 0) => {
    const s = steam ? STEAM_SIZE : 1;
    const dx = (q.x - (g.x - 10)) / (SOLE_RX * s);
    const dy = (q.y - g.y) / (SOLE_RY * s);
    return dx * dx + dy * dy <= 1;
  };
  g.heatAt = (x, y) => {
    const i = Math.floor((x - BX0) / CELL);
    const j = Math.floor((y - BY0) / CELL);
    if (i < 0 || j < 0 || i >= COLS || j >= ROWS) return 0;
    return g.heat[j * COLS + i];
  };

  function finishGarment(timeUp) {
    const G = g.garment;
    if (!timeUp && !G.scorched) {
      add(2);
      g.perfect++;
      pop('Perfectly pressed!  +2', G.cx, BY0 - 50, PAL.magenta, 50);
      sfx('bloom');
    } else if (!timeUp) {
      pop('Pressed!', G.cx, BY0 - 50, PAL.green, 46);
      sfx('right');
    } else {
      pop('Next!', G.cx, BY0 - 50, PAL.slate, 44);
      sfx('page');
    }
    g.leaving = { ...G, out: 0 };
    nextGarment();
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    // Move the iron.
    const x0 = g.x;
    const y0 = g.y;
    if (input.pointer.active) {
      g.x = approach(g.x, input.pointer.x, 10, dt);
      g.y = approach(g.y, input.pointer.y, 10, dt);
    } else {
      // keys ease the iron in, so a short tap nudges it; a stick is direct
      const rate = input.kind === 'keyboard' ? 4 : 12;
      g.vx = approach(g.vx, clamp(input.x, -1, 1) * SPEED, rate, dt);
      g.vy = approach(g.vy, clamp(input.y, -1, 1) * SPEED, rate, dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    g.x = clamp(g.x, IX0, IX1);
    g.y = clamp(g.y, IY0, IY1);
    const v = Math.hypot(g.x - x0, g.y - y0) / dt;
    g.speed = approach(g.speed, v, 10, dt);

    // Steam: a puff on each press, while the tank has some.
    // With a pointer, every finger-down is a press: only a tap on the iron
    // itself puffs steam, so putting a finger on the board just moves it.
    g.pointer = !!input.pointer.active;
    const onIron = !g.pointer || Math.hypot(input.pointer.x - g.x, input.pointer.y - (g.y - 50)) < 130;
    if (input.actionPressed && onIron) {
      if (g.tank >= 1) {
        g.tank -= 1;
        g.steam = PUFF;
        sfx('splash');
      } else sfx('tick');
    }
    g.steam = Math.max(0, g.steam - dt);
    g.scorchT = Math.max(0, (g.scorchT || 0) - dt);
    g.tank = Math.min(TANK, g.tank + dt / REFILL);
    const steaming = g.steam > 0;
    if (steaming && Math.random() < 0.6) g.puffs.push({ x: g.x - 10 + (Math.random() - 0.5) * 140, y: g.y - 18, vx: (Math.random() - 0.5) * 60, vy: -80 - Math.random() * 80, life: 0.9, r: 12 + Math.random() * 10 });

    const G = g.garment;
    G.slide = Math.max(0, G.slide - dt * 4);
    G.t += dt;
    g.leaving && (g.leaving.out += dt * 3);
    if (g.leaving && g.leaving.out > 1) g.leaving = null;

    // Pressing: every crease point under the sole.
    if (G.slide <= 0) {
      const rate = steaming ? STEAM_PRESS : PRESS;
      for (const c of G.creases) {
        if (c.done) continue;
        for (const q of c.pts) if (q.flat < 1 && g.solePoint(q, steaming)) q.flat = Math.min(1, q.flat + rate * dt);
        if (c.pts.every((q) => q.flat >= 0.95)) {
          c.done = true;
          for (const q of c.pts) q.flat = 1;
          g.creases++;
          add(1);
          const mid = c.pts[Math.floor(c.pts.length / 2)];
          pop('+1', mid.x, mid.y - 50, PAL.green, 40);
          sfx('grow', { pitch: 4 + (g.creases % 5) * 2 });
        }
      }

      // Heat: lingering warms the cloth under the sole; steam, and silk, more.
      const still = 1 - clamp(g.speed / STILL, 0, 1);
      const heatRate = (steaming ? STEAM_HEAT : HEAT) * (G.silk ? 1.7 : 1) * still;
      for (let i = 0; i < g.heat.length; i++) g.heat[i] = Math.max(0, g.heat[i] - COOL * dt);
      let hot = 0;
      const ci0 = Math.floor((g.x - SOLE_RX - BX0) / CELL);
      const ci1 = Math.floor((g.x + SOLE_RX - BX0) / CELL);
      const cj0 = Math.floor((g.y - SOLE_RY - BY0) / CELL);
      const cj1 = Math.floor((g.y + SOLE_RY - BY0) / CELL);
      for (let j = Math.max(0, cj0); j <= Math.min(ROWS - 1, cj1); j++) {
        for (let i = Math.max(0, ci0); i <= Math.min(COLS - 1, ci1); i++) {
          const cx = BX0 + (i + 0.5) * CELL;
          const cy = BY0 + (j + 0.5) * CELL;
          const dx = (cx - g.x) / SOLE_RX;
          const dy = (cy - g.y) / SOLE_RY;
          const d = dx * dx + dy * dy;
          if (d > 1.2) continue;
          const k = j * COLS + i;
          g.heat[k] += (heatRate + COOL) * dt * (1 - d * 0.4);
          hot = Math.max(hot, g.heat[k]);
        }
      }
      g.hot = hot;
      g.scorchCool = Math.max(0, g.scorchCool - dt);
      if (hot >= 1 && g.scorchCool <= 0) {
        // Scorched! An iron-shaped mark is left on the cloth.
        g.scorches++;
        G.scorched++;
        add(-1);
        G.marks.push({ x: g.x, y: g.y, rot: (rng() - 0.5) * 0.2 });
        g.scorchCool = 1;
        g.scorchT = 0.7;
        for (let k = 0; k < g.heat.length; k++) g.heat[k] = Math.min(g.heat[k], 0.3);
        pop('Scorched!  −1', g.x, g.y - 120, PAL.brick, 46);
        sfx('wrong');
        env.vibrate?.(140);
      }
    }

    if (G.creases.every((c) => c.done)) finishGarment(false);
    else if (G.t >= G.limit) finishGarment(true);

    for (const p of g.puffs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += 20 * dt;
      p.life -= dt;
    }
    g.puffs = g.puffs.filter((p) => p.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Points ${g.score} · Steam ${'●'.repeat(Math.floor(g.tank))}${'○'.repeat(TANK - Math.floor(g.tank))}`;
  g.summary = () => {
    const lines = [`${g.creases} crease${g.creases === 1 ? '' : 's'} pressed out, ${g.perfect} garment${g.perfect === 1 ? '' : 's'} pressed perfectly.`];
    lines.push(g.scorches ? `${g.scorches} scorch mark${g.scorches === 1 ? '' : 's'}.` : 'Not a single scorch!');
    return lines;
  };

  // ---------- drawing ----------

  function garmentShape(c, G, x, y) {
    const w = G.w;
    const h = G.h;
    const L = x - w / 2;
    const T = y - h / 2;
    if (G.kind === 'shirt') {
      poly(c, [[L + w * 0.2, T], [L + w * 0.8, T], [L + w, T + h * 0.3], [L + w * 0.86, T + h * 0.45], [L + w * 0.8, T + h * 0.35], [L + w * 0.8, T + h], [L + w * 0.2, T + h], [L + w * 0.2, T + h * 0.35], [L + w * 0.14, T + h * 0.45], [L, T + h * 0.3]], 3, 1.5);
    } else if (G.kind === 'trousers') {
      poly(c, [[L, T], [L + w, T], [L + w, T + h * 0.48], [L + w * 0.35, T + h * 0.52], [L + w, T + h * 0.56], [L + w, T + h], [L, T + h]], 4, 1.5);
    } else {
      poly(c, [[L, T], [L + w, T], [L + w, T + h], [L, T + h]], 5, 1.5);
    }
  }

  function drawGarment(c, G, dx) {
    const x = G.cx + dx;
    const y = G.cy;
    c.save();
    if (!drawSprite(c, 'sprites.pressGarments', G.i, x, y, { w: G.w, anchor: 'center' })) {
      garmentShape(c, G, x, y);
      wash(c, G.col, 0.95);
      ink(c, 2.2);
      c.save();
      garmentShape(c, G, x, y);
      c.clip();
      if (G.kind === 'cloth') {
        // plain in the middle, a checked band round the edge only
        c.globalAlpha = 0.22;
        c.fillStyle = PAL.brick;
        const L = x - G.w / 2;
        const T = y - G.h / 2;
        for (let i = 0; i < G.w; i += 28) {
          if ((i / 28) % 2) continue;
          c.fillRect(L + i, T, 14, 14);
          c.fillRect(L + i, T + G.h - 14, 14, 14);
        }
        for (let j = 0; j < G.h; j += 28) {
          if ((j / 28) % 2) continue;
          c.fillRect(L, T + j, 14, 14);
          c.fillRect(L + G.w - 14, T + j, 14, 14);
        }
      } else if (G.kind === 'hanky') {
        c.strokeStyle = PAL.slate;
        c.lineWidth = 6;
        c.strokeRect(x - G.w / 2 + 22, y - G.h / 2 + 22, G.w - 44, G.h - 44);
      } else if (G.kind === 'pillow') {
        c.strokeStyle = 'rgba(185,138,163,0.5)';
        c.lineWidth = 10;
        c.strokeRect(x + G.w / 2 - 90, y - G.h / 2, 40, G.h);
      } else if (G.kind === 'scarf') {
        // plain silk with a sheen, a narrow border and fringed ends
        c.globalAlpha = 0.35;
        c.fillStyle = '#fff';
        c.fillRect(x - G.w / 2, y - G.h * 0.22, G.w, 10);
        c.globalAlpha = 0.6;
        c.strokeStyle = PAL.magenta;
        c.lineWidth = 4;
        c.strokeRect(x - G.w / 2 + 12, y - G.h / 2 + 10, G.w - 24, G.h - 20);
        c.globalAlpha = 1;
        for (const e of [-1, 1]) {
          for (let k = 0; k < 12; k++) {
            c.beginPath();
            c.moveTo(x + e * G.w / 2, y - G.h / 2 + 10 + k * ((G.h - 20) / 11));
            c.lineTo(x + e * (G.w / 2 + 16), y - G.h / 2 + 10 + k * ((G.h - 20) / 11));
            ink(c, 1.6, PAL.magenta);
            c.stroke();
          }
        }
      } else if (G.kind === 'shirt') {
        c.beginPath();
        c.moveTo(x, y - G.h / 2);
        c.lineTo(x, y + G.h / 2);
        ink(c, 1.4);
        c.stroke();
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x + 12, y - G.h / 2 + 60 + k * 70, 5, 0, Math.PI * 2);
          c.fillStyle = '#f8f8f8';
          c.fill();
          ink(c, 1.2);
          c.stroke();
        }
      }
      c.restore();
    }
    if (G.silk) {
      // a little sewn-in label: delicate
      poly(c, [[x - G.w / 2 + 20, y - G.h / 2 + 14], [x - G.w / 2 + 120, y - G.h / 2 + 14], [x - G.w / 2 + 120, y - G.h / 2 + 46], [x - G.w / 2 + 20, y - G.h / 2 + 46]], 6, 0.6);
      wash(c, '#fbf4e4');
      ink(c, 1.4);
      label(c, 'silk', x - G.w / 2 + 70, y - G.h / 2 + 31, { size: 22, color: PAL.magenta, weight: 700 });
    }
    // scorch marks: brown iron shapes
    for (const m of G.marks) {
      c.save();
      c.translate(m.x + dx, m.y);
      c.rotate(m.rot);
      c.beginPath();
      c.moveTo(-SOLE_RX - 12, 0);
      c.quadraticCurveTo(-SOLE_RX * 0.3, -SOLE_RY, SOLE_RX * 0.8, -SOLE_RY * 0.9);
      c.lineTo(SOLE_RX * 0.8, SOLE_RY * 0.9);
      c.quadraticCurveTo(-SOLE_RX * 0.3, SOLE_RY, -SOLE_RX - 12, 0);
      c.closePath();
      c.fillStyle = 'rgba(120,64,24,0.8)';
      c.fill();
      ink(c, 2.2, '#5a3010');
      c.stroke();
      // the steam holes, pale
      c.fillStyle = 'rgba(240,220,190,0.6)';
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.arc(-SOLE_RX * 0.3 + (k % 3) * 26, (k < 3 ? -1 : 1) * 12, 4, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }
    // the creases: dark folds that fade as they're pressed
    for (const cr of G.creases) {
      const pts = cr.pts;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const left = 1 - Math.min(a.flat, b.flat);
        if (left <= 0.02) continue;
        c.save();
        c.globalAlpha = 0.25 + 0.75 * left;
        // the fold's shadow
        c.beginPath();
        c.moveTo(a.x + dx, a.y + 5);
        c.lineTo(b.x + dx, b.y + 5);
        ink(c, 9 * left + 2, 'rgba(90,80,100,0.35)');
        c.stroke();
        // the zigzag of the fold
        c.beginPath();
        const mx = (a.x + b.x) / 2 + dx;
        const my = (a.y + b.y) / 2;
        const nx = -(b.y - a.y);
        const ny = b.x - a.x;
        const nl = Math.hypot(nx, ny) || 1;
        const z = (i % 2 ? 1 : -1) * 6 * left;
        c.moveTo(a.x + dx, a.y);
        c.lineTo(mx + (nx / nl) * z, my + (ny / nl) * z);
        c.lineTo(b.x + dx, b.y);
        ink(c, 2.2);
        c.stroke();
        c.restore();
      }
    }
  }

  function drawIron(c, t) {
    const steaming = g.steam > 0;
    const hot = g.hot || 0;
    // the sole's footprint: a glow that warms from yellow to red with the heat
    c.save();
    const s = steaming ? STEAM_SIZE : 1;
    c.globalAlpha = 0.25 + 0.45 * hot;
    c.beginPath();
    c.ellipse(g.x - 10, g.y, SOLE_RX * s, SOLE_RY * s, 0, 0, Math.PI * 2);
    const col = hot > 0.7 ? '#d0402a' : hot > 0.4 ? '#e09a48' : '#f0d878';
    c.fillStyle = col;
    c.fill();
    c.globalAlpha = 0.8;
    ink(c, 2, hot > 0.7 ? '#a02a1a' : 'rgba(59,43,32,0.4)');
    c.setLineDash([8, 8]);
    c.stroke();
    c.restore();
    // the Sparrow, its sole on the cloth (legs tucked out of sight)
    const lean = clamp(g.vx / SPEED, -1, 1) * 0.06;
    const shake = hot > 0.75 && !env.reduceMotion ? Math.sin(t * 50) * 2 : 0;
    const frame = steaming ? 1 : 0;
    // Everything is drawn from the middle of the sole, over the footprint's
    // middle (see PRESS_CELLS for the painted poses).
    const painted = !!art('subject.steampressersparrow');
    const size = painted ? PAINTED.size : SIZE;
    c.save();
    c.translate(g.x - 10 + shake, g.y + 6);
    c.rotate(lean);
    // a 1024 px cell drawn so its point (px, py) lands here, at PRESS_SCALE
    const at = (key, i, [px, py]) => drawSprite(c, key, i, (512 - px) * PRESS_SCALE, (1024 - py) * PRESS_SCALE, { h: 1024 * PRESS_SCALE, whole: true });
    const yelp = g.scorchT > 0 && at('sprites.sparrowScorch', 0, PRESS_CELLS.scorch);
    if (!yelp && !at('sprites.sparrowPress', frame, PRESS_CELLS.press)) {
      // the bird jumps off the cloth when it scorches
      if (g.scorchT > 0) c.translate(0, -30 * Math.sin((g.scorchT / 0.7) * Math.PI));
      // the painting's sole is tipped: level it on the cloth
      if (painted) c.rotate(-PAINTED.tilt);
      c.beginPath();
      c.rect(-size, -size * 1.2, size * 2, size * 1.2);
      c.clip();
      const k = size / 400;
      if (painted) drawBird(c, 'steampressersparrow', { x: -PAINTED.sole[0] * k, y: -PAINTED.sole[1] * k, size, t });
      else drawBird(c, 'steampressersparrow', { x: 10, y: 130 * k, size, t });
    }
    c.restore();
  }

  function drawLaundry(c) {
    // the laundry wall: tiles and a window of steam
    band(c, 0, 0, W, 360, '#d8e2dc', 0.6, 1);
    for (let x = 0; x < W; x += 80) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 340);
      ink(c, 1, 'rgba(59,43,32,0.15)');
      c.stroke();
    }
    for (let y = 0; y < 340; y += 80) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      ink(c, 1, 'rgba(59,43,32,0.15)');
      c.stroke();
    }
    // the floor
    band(c, 0, 340, W, H - 340, '#c9a87a', 0.55, 2);
    hatch(c, 0, 340, W, H, 18, 0.12, 1);
    // the basket of washing, top right; the folded pile, top left
    blob(c, 1460, 300, 120, 60, 7, 0.06);
    wash(c, PAL.wafer);
    ink(c, 2.2);
    hatch(c, 1340, 250, 1580, 350, 10, 0.25, 2);
    for (let i = 0; i < 4; i++) {
      blob(c, 1410 + i * 35, 250 - (i % 2) * 14, 40, 22, 20 + i, 0.25);
      wash(c, ['#dfe8f0', '#eab0c4', '#f2e8d8', '#9aa0a8'][i], 0.9);
      ink(c, 1.4);
    }
    for (let i = 0; i < 4; i++) {
      poly(c, [[60, 330 - i * 26], [240, 330 - i * 26], [236, 306 - i * 26], [64, 306 - i * 26]], 30 + i, 1);
      wash(c, ['#f4f0e4', '#dfe8f0', '#f0e6dc', '#9aa0a8'][i], 0.9);
      ink(c, 1.6);
    }
    // the ironing board: a long padded plank, pointed at the left
    c.beginPath();
    c.moveTo(BX0 - 40, (BY0 + BY1) / 2);
    c.quadraticCurveTo(BX0, BY0 - 10, BX0 + 200, BY0);
    c.lineTo(BX1, BY0);
    c.quadraticCurveTo(BX1 + 30, BY0, BX1 + 30, BY0 + 30);
    c.lineTo(BX1 + 30, BY1 - 30);
    c.quadraticCurveTo(BX1 + 30, BY1, BX1, BY1);
    c.lineTo(BX0 + 200, BY1);
    c.quadraticCurveTo(BX0, BY1 + 10, BX0 - 40, (BY0 + BY1) / 2);
    c.closePath();
    wash(c, '#e8dcc0', 0.95);
    ink(c, 2.6);
    c.save();
    c.clip();
    c.globalAlpha = 0.18;
    for (let x = BX0 - 40; x < BX1 + 40; x += 34) {
      for (let y = BY0; y < BY1; y += 34) {
        c.beginPath();
        c.arc(x + ((y / 34) % 2) * 17, y, 4, 0, Math.PI * 2);
        c.fillStyle = PAL.slate;
        c.fill();
      }
    }
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'steampressersparrow', W, H, drawLaundry);

    if (g.leaving) drawGarment(c, g.leaving, -g.leaving.out * 1200);
    drawGarment(c, g.garment, g.garment.slide * 1100);

    // how long this garment has: a ribbon along the board's top edge
    const G = g.garment;
    const left = clamp(1 - G.t / G.limit, 0, 1);
    c.save();
    poly(c, [[BX0 + 200, BY0 - 26], [BX1, BY0 - 26], [BX1, BY0 - 12], [BX0 + 200, BY0 - 12]], 9, 0.5);
    c.fillStyle = 'rgba(250,244,228,0.8)';
    c.fill();
    c.fillStyle = left < 0.25 ? PAL.brick : PAL.sage;
    c.fillRect(BX0 + 200, BY0 - 26, (BX1 - BX0 - 200) * left, 14);
    ink(c, 1.4);
    c.strokeRect(BX0 + 200, BY0 - 26, BX1 - BX0 - 200, 14);
    c.restore();

    drawIron(c, t);

    // the painted steaming pose has its own steam
    for (const p of art('sprites.sparrowPress') ? [] : g.puffs) {
      c.save();
      c.globalAlpha = clamp(p.life, 0, 1) * 0.55;
      blob(c, p.x, p.y, p.r, p.r * 0.8, Math.floor(p.r), 0.15, 10);
      c.fillStyle = '#ffffff';
      c.fill();
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

    if (g.elapsed < 4.5) {
      c.save();
      c.globalAlpha = Math.min(1, 4.5 - g.elapsed);
      // two short lines, centred on what a narrow screen shows, on a soft
      // paper backing so they read over the painting
      const hx = clamp(g.focus(), 390, W - 390);
      const hl = ['Glide over the creases · keep moving!', g.pointer ? 'Tap the iron for a puff of steam' : 'Press for a puff of steam'];
      c.fillStyle = 'rgba(250,244,228,0.75)';
      c.fillRect(hx - 370, 200 - 34, 740, 112);
      hl.forEach((s, i) => label(c, s, hx, 200 + i * 44, { size: 34, weight: 600 }));
      c.restore();
    }
  };

  g.focus = () => clamp(g.x, 450, W - 450);
  g.span = 900;

  return g;
}
