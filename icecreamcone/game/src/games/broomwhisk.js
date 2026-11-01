// The Broomwhisk: Clean Sweep.
//
// Leaves drop from the courtyard's fig tree and dust gathers on the
// flagstones. Steer the Broomwhisk across the floor: whatever its bristles
// touch is pushed along with the broom's own speed and slides on after it,
// so sweeping is a push with momentum: line up behind a leaf, then sweep it
// towards the dustpan. Press the action for a hard flick of the bristles
// that sends everything in front of the broom skidding. Only what the broom
// has touched goes into the pan; anything else bumps off its lip. Every so
// often a gust (warned by the tree rustling and the door rattling) scatters
// everything loose across the floor. The pan moves to another wall after
// every eight sweepings. It starts gentle (few leaves, a wide pan, soft
// gusts); the leaves fall faster, the pan's mouth narrows, and the gusts come
// more often and blow harder as time goes on. A golden leaf is worth three. Score: points.

import { drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.sweepings': [4, 2], // four leaves (olive, mustard, brick, sage), a dust ball, a feather, a golden leaf, a sweet wrapper
  'sprites.dustpan': [2, 1], // seen from the side (opening to the right), seen from the front
  'sprites.broomwhiskSweep': [2, 1], // bristles swept back, bristles flicked forward
  'sprites.broomwhiskPoses': [3, 1], // pushing straight ahead (bristles splayed), braced against a gust, pleased
});

const DURATION = 45;
const FLOOR_T = 470; // the back of the floor, where the wall stands
const FLOOR_B = 872;
const R = 74;
// Where the broom can go, and where loose things can lie.
export const B_L = 80;
export const B_R = 1520;
export const B_T = FLOOR_T + 12;
const I_L = 112;
const I_R = 1488;
const I_T = FLOOR_T + 42;
const I_B = FLOOR_B - 12; // the bristles' reach, in floor units (y counts double: the floor is foreshortened)
const SIZE = 300;
const FLICK = 0.45;
const FUNNEL = 130; // how near the mouth a swept thing is drawn in
const PER_PAN = 8; // sweepings before the pan moves
const SWEPT = 3; // seconds a touched thing still counts as swept
// The dustpan's places: against the left wall, the right wall, the back wall.
// `dx, dy` is the way its mouth faces, in floor units.
const PANS = [
  { x: 150, y: 690, dx: 1, dy: 0 },
  { x: 1450, y: 690, dx: -1, dy: 0 },
  { x: 800, y: FLOOR_T + 34, dx: 0, dy: 1 },
];
const KINDS = {
  leaf: { r: 20, fric: 2.4, gust: 360, pts: 1 },
  dust: { r: 24, fric: 3.6, gust: 200, pts: 1 },
  gold: { r: 20, fric: 2.4, gust: 340, pts: 3 },
};
const LEAF_COLS = [PAL.olive, PAL.mustard, PAL.brick, PAL.sage];

// IC-M06f/g: each complete pose is normalized to the portrait's scale.
// Foot anchors are measured after atlas fitting; see the delivery placement.json.
const POSE_CELLS = {
  'sprites.broomwhiskSweep': [{ fx: 655, feet: 986, painted: 1 }, { fx: 582, feet: 986, painted: 1 }],
  'sprites.broomwhiskPoses': [{ fx: 509, feet: 986, painted: 1 }, { fx: 704, feet: 985, painted: 1 }, { fx: 624, feet: 986, painted: 1 }],
};
// A painted pose, its feet on (x, y), facing left unless flipped.
function drawPose(c, key, i, x, y, s, flip, rot) {
  const sp = spriteCell(key, i);
  if (!sp) return false;
  const m = POSE_CELLS[key][i];
  const k = (((SIZE * s) / 400) * (420 / 1024)) / m.painted;
  const cl = sp.cell;
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (flip) c.scale(-1, 1);
  c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, -m.fx * k, -m.feet * k, cl.w * k, cl.h * k);
  c.restore();
  return true;
}

// Floor depth: things further back are drawn smaller.
export const depth = (y) => 0.68 + 0.4 * clamp((y - FLOOR_T) / (FLOOR_B - FLOOR_T), 0, 1);

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    broom: { x: 800, y: 760, vx: 0, vy: 0, fx: -1, fy: 0 },
    items: [], // { kind, x, y, z, vx, vy, vz, rot, spin, col, swept }
    panI: 0,
    panMove: 0, // seconds of the pan sliding to its new place
    inPan: 0, // sweepings in this pan
    gust: null, // { dir, warn, t }
    gustT: 13, // the first gust comes after the easy start
    leafT: 1.5,
    flickT: 0,
    proudT: 0, // something just went in the pan
    flickCool: 0,
    swept: 0,
    golds: 0,
    gusts: 0,
    bumps: 0,
    pops: [],
    streaks: [],
  };
  g.pan = { ...PANS[0] };

  // How hard it is now, 0 to 1, along the shared curve for the chosen
  // Difficulty (see difficulty.js): few leaves, a wide pan mouth, no gust for
  // 13 s and soft ones after at first. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  g.leafGap = () => knob(g.d(), 2.0, 1.7, 1.0); // seconds between falling leaves
  g.gustGap = () => knob(g.d(), 14, 12, 7); // seconds between gusts
  g.gustPower = () => knob(g.d(), 0.7, 0.86, 1.25); // how hard a gust blows
  g.gustWarn = () => knob(g.d(), 1.6, 1.42, 1.0); // seconds of rustle before it blows
  g.mouth = () => knob(g.d(), 120, 114, 100); // half the pan's mouth, in floor units

  function pop(text, x, y, color = INK, size = 44) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  function addItem(kind, x, y, z = 0) {
    // a leaf now and then is a feather or a sweet wrapper instead
    const r = rng();
    const look = kind === 'leaf' && r < 0.1 ? 'feather' : kind === 'leaf' && r < 0.18 ? 'wrapper' : null;
    g.items.push({ kind, look, x, y, z, vx: 0, vy: 0, vz: 0, rot: rng() * 6.28, spin: 0, col: LEAF_COLS[Math.floor(rng() * LEAF_COLS.length)], swept: 0, ph: rng() * 6.28 });
  }
  // A start: leaves and dust in the middle of the floor, away from the pan.
  for (let i = 0; i < 7; i++) addItem(i % 3 === 2 ? 'dust' : 'leaf', 420 + rng() * 900, 560 + rng() * 260);

  // Pan coordinates of a point: how far in front of its mouth, and how far to the side.
  const panLocal = (x, y) => {
    const p = g.pan;
    const ux = x - p.x;
    const uy = (y - p.y) * 2;
    return { along: ux * p.dx + uy * p.dy, side: Math.abs(ux * p.dy - uy * p.dx) };
  };
  g.panLocal = panLocal;

  function collect(it) {
    it.dead = true;
    const pts = KINDS[it.kind].pts;
    g.score += pts;
    g.swept++;
    g.inPan++;
    g.proudT = 0.6;
    if (it.kind === 'gold') g.golds++;
    pop(it.kind === 'gold' ? 'Golden! +3' : '+' + pts, g.pan.x, g.pan.y - 90, PAL.magenta, it.kind === 'gold' ? 52 : 44);
    sfx(it.kind === 'gold' ? 'right' : 'plop');
    env.vibrate?.(20);
    if (g.inPan >= PER_PAN) {
      g.inPan = 0;
      let next = Math.floor(rng() * (PANS.length - 1));
      if (next >= g.panI) next++;
      g.panI = next;
      g.panMove = 0.8;
      g.panFrom = { ...g.pan };
      pop('The dustpan moves!', 800, 420, PAL.magenta, 46);
      sfx('shuffle');
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
    const b = g.broom;
    g.proudT = Math.max(0, g.proudT - dt);

    // Steer the broom. It has some weight: it speeds up and slows down.
    let tvx, tvy;
    if (input.pointer.active) {
      const px = clamp(input.pointer.x, B_L, B_R);
      const py = clamp(input.pointer.y, B_T, FLOOR_B);
      tvx = clamp((px - b.x) * 6, -900, 900);
      tvy = clamp((py - b.y) * 6, -480, 480);
    } else {
      tvx = input.x * 760;
      tvy = input.y * 420;
    }
    b.vx = approach(b.vx, tvx, 7, dt);
    b.vy = approach(b.vy, tvy, 7, dt);
    b.x = clamp(b.x + b.vx * dt, B_L, B_R);
    b.y = clamp(b.y + b.vy * dt, B_T, FLOOR_B);
    const sp = Math.hypot(b.vx, b.vy * 2);
    if (sp > 60) {
      b.fx = b.vx / sp;
      b.fy = (b.vy * 2) / sp;
    }

    // The flick.
    g.flickCool = Math.max(0, g.flickCool - dt);
    g.flickT = Math.max(0, g.flickT - dt);
    if (input.actionPressed && g.flickCool <= 0) {
      g.flickCool = FLICK;
      g.flickT = 0.25;
      sfx('page');
      for (const it of g.items) {
        if (it.z > 0) continue;
        const dx = it.x - b.x;
        const dy = (it.y - b.y) * 2;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R * 1.9 && (dx * b.fx + dy * b.fy) / d > 0.1) {
          const k = it.kind === 'dust' ? 480 : 660;
          it.vx += b.fx * k;
          it.vy += (b.fy * k) / 2;
          it.spin = (rng() - 0.5) * 14;
          it.swept = SWEPT;
        }
      }
    }

    // The pan slides to its new place.
    if (g.panMove > 0) {
      g.panMove = Math.max(0, g.panMove - dt);
      const k = 1 - g.panMove / 0.8;
      const to = PANS[g.panI];
      g.pan = { ...to, x: lerp(g.panFrom.x, to.x, k), y: lerp(g.panFrom.y, to.y, k) };
    }

    // Gusts: a warning, then the wind.
    if (!g.gust) {
      g.gustT -= dt;
      if (g.gustT <= 0) {
        g.gust = { dir: rng() < 0.5 ? -1 : 1, warn: g.gustWarn(), t: 1.5, ty: (rng() - 0.5) * 0.6, power: g.gustPower() };
        g.gusts++;
        sfx('shuffle');
      }
    } else if (g.gust.warn > 0) {
      g.gust.warn -= dt;
      if (g.gust.warn <= 0) sfx('splash');
    } else {
      g.gust.t -= dt;
      if (rng() < dt * 30) g.streaks.push({ x: g.gust.dir > 0 ? -100 : W + 100, y: FLOOR_T - 200 + rng() * 600, life: 0.8, dir: g.gust.dir });
      if (g.gust.t <= 0) {
        g.gust = null;
        g.gustT = g.gustGap() + rng() * 2;
      }
    }
    const blowing = g.gust && g.gust.warn <= 0;

    // Leaves fall from the tree.
    g.leafT -= dt;
    const onFloor = g.items.length;
    if (g.leafT <= 0) {
      g.leafT = g.leafGap() * (0.7 + rng() * 0.6);
      if (onFloor < 18) {
        const kind = rng() < 0.09 ? 'gold' : rng() < 0.25 ? 'dust' : 'leaf';
        if (kind === 'dust') addItem('dust', 250 + rng() * 1100, 560 + rng() * 280);
        else addItem(kind, 220 + rng() * 900, 540 + rng() * 300, 260 + rng() * 120);
      }
    }

    // Everything on the floor.
    for (const it of g.items) {
      const K = KINDS[it.kind];
      it.swept = Math.max(0, it.swept - dt);
      if (it.z > 0) {
        // still falling: a slow, swaying drop
        it.z = Math.max(0, it.z - 160 * dt);
        it.x += Math.sin(g.elapsed * 3 + it.ph) * 60 * dt;
        it.rot += dt * 2;
        continue;
      }
      // Gusts blow only what lies loose: a swept thing is on its way to the pan.
      if (blowing && it.swept <= 0) {
        const power = g.gust.power ?? 1;
        it.vx += g.gust.dir * K.gust * power * dt;
        it.vy += g.gust.ty * K.gust * power * 0.5 * dt;
        it.spin += g.gust.dir * dt * 6;
      }
      // The bristles push whatever they touch.
      const dx = it.x - b.x;
      const dy = (it.y - b.y) * 2;
      const d = Math.hypot(dx, dy);
      const reach = R + K.r;
      if (d < reach) {
        const nx = d > 0.01 ? dx / d : b.fx;
        const ny = d > 0.01 ? dy / d : b.fy;
        it.x = b.x + nx * reach;
        it.y = b.y + (ny * reach) / 2;
        let vmx = it.vx;
        let vmy = it.vy * 2;
        const bvx = b.vx;
        const bvy = b.vy * 2;
        const bn = bvx * nx + bvy * ny;
        const vn = vmx * nx + vmy * ny;
        if (bn > 0 && vn < bn * 1.15) {
          vmx += nx * (bn * 1.15 - vn);
          vmy += ny * (bn * 1.15 - vn);
          it.swept = SWEPT;
          it.spin = (bvx * ny - bvy * nx) * 0.004;
        }
        // a little carried along sideways too
        const tx = -ny;
        const ty = nx;
        const bt = bvx * tx + bvy * ty;
        const vt = vmx * tx + vmy * ty;
        vmx += tx * (bt - vt) * 0.25;
        vmy += ty * (bt - vt) * 0.25;
        it.vx = vmx;
        it.vy = vmy / 2;
      }
      // The pan's funnel: a swept thing sliding near the mouth is drawn in.
      if (it.swept > 0 && g.panMove <= 0) {
        const p = panLocal(it.x, it.y);
        if (p.along < FUNNEL && p.along > -110 && p.side < FUNNEL) {
          const mx = g.pan.x + g.pan.dx * 10 - it.x;
          const my = (g.pan.y + (g.pan.dy * 10) / 2 - it.y) * 2;
          const md = Math.hypot(mx, my) || 1;
          it.vx += (mx / md) * 1100 * dt;
          it.vy += ((my / md) * 1100 * dt) / 2;
        }
      }
      const f = Math.exp(-K.fric * dt);
      it.vx *= f;
      it.vy *= f;
      const v = Math.hypot(it.vx, it.vy * 2);
      if (v > 1300) {
        it.vx *= 1300 / v;
        it.vy *= 1300 / v;
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      it.spin *= Math.exp(-3 * dt);
      // the walls
      // the walls: things stop a little short of them, so the broom can get behind
      if (it.x < I_L) (it.x = I_L), (it.vx = Math.abs(it.vx) * 0.3);
      if (it.x > I_R) (it.x = I_R), (it.vx = -Math.abs(it.vx) * 0.3);
      if (it.y < I_T) (it.y = I_T), (it.vy = Math.abs(it.vy) * 0.3);
      if (it.y > I_B) (it.y = I_B), (it.vy = -Math.abs(it.vy) * 0.3);
      // the dustpan
      if (g.panMove <= 0) {
        const p = panLocal(it.x, it.y);
        if (p.side < g.mouth() && p.along < 48 && p.along > -110) {
          if (it.swept > 0) collect(it);
          else if (!it.bumped) {
            // not swept: it bumps off the lip
            it.bumped = 0.6;
            it.vx = g.pan.dx * 160 + (rng() - 0.5) * 60;
            it.vy = g.pan.dy * 80 + (rng() - 0.5) * 30;
            it.x += g.pan.dx * (40 - p.along);
            it.y += (g.pan.dy * (40 - p.along)) / 2;
            g.bumps++;
          }
        }
      }
      if (it.bumped) it.bumped = Math.max(0, it.bumped - dt) || undefined;
    }
    g.items = g.items.filter((it) => !it.dead);

    for (const s of g.streaks) {
      s.x += s.dir * 1600 * dt;
      s.life -= dt;
    }
    g.streaks = g.streaks.filter((s) => s.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Points ${g.score}`;
  g.summary = () => {
    const lines = [`${g.swept} sweeping${g.swept === 1 ? '' : 's'} in the pan${g.golds ? `, ${g.golds} of them golden` : ''}.`];
    lines.push(`${g.gusts} gust${g.gusts === 1 ? '' : 's'} of wind.`);
    return lines;
  };

  // ---------- drawing ----------

  function drawItem(c, it, t) {
    const s = depth(it.y);
    const y = it.y - it.z;
    // its shadow while it falls
    if (it.z > 0) {
      c.save();
      c.globalAlpha = 0.2;
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(it.x, it.y, 16 * s, 5 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // a pink glow under anything swept: it counts, and the wind leaves it be
    if (it.swept > 0 && it.z <= 0) {
      c.save();
      c.globalAlpha = 0.25 + 0.35 * (it.swept / SWEPT);
      c.fillStyle = PAL.strawberry;
      c.beginPath();
      c.ellipse(it.x, it.y, 40 * s, 16 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    const cell = it.kind === 'dust' ? 4 : it.kind === 'gold' ? 6 : it.look === 'feather' ? 5 : it.look === 'wrapper' ? 7 : Math.max(0, LEAF_COLS.indexOf(it.col));
    if (drawSprite(c, 'sprites.sweepings', cell, it.x, y, { w: 84 * s, anchor: 'center', rot: it.kind === 'dust' ? 0 : it.rot })) return;
    c.save();
    c.translate(it.x, y);
    c.scale(s * 1.45, s * 1.45);
    if (it.kind === 'dust') {
      blob(c, 0, -6, 26, 18, 7 + Math.floor(it.ph), 0.18, 14);
      wash(c, '#7a7068', 0.95);
      ink(c, 1.8, '#3b2f28');
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = it.ph + i;
        c.moveTo(Math.cos(a) * 14, -6 + Math.sin(a) * 9);
        c.lineTo(Math.cos(a) * 30, -6 + Math.sin(a) * 18);
      }
      ink(c, 1.2, '#3b2f28');
    } else if (it.look === 'wrapper') {
      c.rotate(it.rot);
      poly(c, [[-22, -10], [-8, -16], [6, -8], [22, -14], [18, 6], [4, 12], [-12, 8], [-20, 14]], 5, 2);
      wash(c, PAL.strawberry);
      ink(c, 1.5);
    } else if (it.look === 'feather') {
      c.rotate(it.rot);
      c.scale(1, 0.62);
      c.beginPath();
      c.moveTo(-28, 0);
      c.quadraticCurveTo(0, -16, 28, -4);
      c.quadraticCurveTo(0, 12, -28, 0);
      wash(c, '#c8c4bc');
      ink(c, 1.2, '#6a6660');
      c.beginPath();
      c.moveTo(-32, 2);
      c.lineTo(26, -3);
      ink(c, 1.2, '#6a6660');
    } else {
      c.rotate(it.rot);
      c.scale(1.1, 0.8); // lying on the floor
      c.beginPath();
      c.moveTo(-26, 0);
      c.quadraticCurveTo(-4, -28, 26, 0);
      c.quadraticCurveTo(-4, 28, -26, 0);
      wash(c, it.kind === 'gold' ? '#e8c040' : it.col);
      ink(c, 1.6);
      c.beginPath();
      c.moveTo(-30, 0);
      c.lineTo(22, 0);
      ink(c, 1.1);
      if (it.kind === 'gold') {
        c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8 + it.ph);
        label(c, '✦', 10, -20, { size: 22, color: '#c08a10', weight: 800 });
      }
    }
    c.restore();
  }

  function drawPan(c, t) {
    const p = g.pan;
    const s = depth(p.y);
    const side = p.dy === 0;
    c.save();
    c.translate(p.x, p.y);
    if (side && p.dx < 0) c.scale(-1, 1);
    const sp = spriteCell('sprites.dustpan', side ? 0 : 1);
    if (sp) {
      // the painted pan, its mouth's lip where the game's mouth is: from the
      // side, the scoop's tip (959, 823 in the cell) just past the pan's
      // point; from the front, the bottom of the mouth (510, 831) on it
      const m = side ? { x: 959, y: 823, w: 876, at: [50, 12] } : { x: 510, y: 831, w: 827, at: [0, 26] };
      const k = (230 * s) / m.w;
      const cl = sp.cell;
      c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, m.at[0] - m.x * k, m.at[1] - m.y * k, cl.w * k, cl.h * k);
    } else if (side) {
      c.scale(s * 1.4, s * 1.4);
      // seen from the side: a flat scoop with its mouth to the right, a handle up the wall
      poly(c, [[-70, -80], [30, -10], [34, 6], [-70, 6]], 3, 1);
      wash(c, '#8aa0a8');
      ink(c, 2.4);
      poly(c, [[-70, -80], [30, -10], [34, 6], [-70, 6]], 3, 1);
      hatch(c, -74, -84, 36, 10, 9, 0.2, 1);
      c.beginPath();
      c.moveTo(-60, -60);
      c.lineTo(-90, -150);
      ink(c, 9, '#6a7c84');
      ink(c, 1.6);
    } else {
      c.scale(s * 1.4, s * 1.4);
      // seen from the front: the wide mouth facing us
      poly(c, [[-100, -60], [100, -60], [110, 8], [-110, 8]], 4, 1);
      wash(c, '#8aa0a8');
      ink(c, 2.4);
      poly(c, [[-86, -50], [86, -50], [94, 2], [-94, 2]], 5, 1);
      wash(c, '#4a5a62', 0.8);
      ink(c, 1.6);
      c.beginPath();
      c.moveTo(0, -60);
      c.lineTo(0, -140);
      ink(c, 9, '#6a7c84');
      ink(c, 1.6);
    }
    c.restore();
    // a dotted ring on the floor in front of the mouth: sweep things here
    c.save();
    c.globalAlpha = 0.45 + 0.25 * Math.sin(t * 4);
    c.setLineDash([8, 10]);
    c.beginPath();
    c.ellipse(p.x + p.dx * 70, p.y + p.dy * 30, 70 * (side ? 0.7 : 1.3), 40 * (side ? 1 : 0.5), 0, 0, Math.PI * 2);
    ink(c, 2.4, PAL.magenta);
    c.restore();
  }

  function drawBroom(c, t) {
    const b = g.broom;
    const s = depth(b.y);
    // where pushed things will slide: a dotted line ahead of the moving broom
    const sp = Math.hypot(b.vx, b.vy * 2);
    if (sp > 120) {
      const len = Math.min(320, sp * 0.4);
      c.save();
      c.globalAlpha = Math.min(0.8, (sp - 120) / 300);
      c.setLineDash([6, 10]);
      c.beginPath();
      c.moveTo(b.x + b.fx * R * 1.1, b.y + (b.fy * R * 1.1) / 2);
      c.lineTo(b.x + b.fx * (R + len), b.y + (b.fy * (R + len)) / 2);
      ink(c, 3, PAL.magenta);
      c.restore();
    }
    // the way to the pan, when it is far off to the side (off a phone's view)
    const pdx = g.pan.x - b.x;
    if (Math.abs(pdx) > 420) {
      const dir = Math.sign(pdx);
      const ax = b.x + dir * 130;
      const ay = b.y - 150 * s;
      c.save();
      c.translate(ax + Math.sin(t * 6) * 6 * dir, ay);
      c.scale(dir, 1);
      poly(c, [[-26, -12], [6, -12], [6, -24], [32, 0], [6, 24], [6, 12], [-26, 12]], 2, 0.5);
      wash(c, PAL.strawberry, 0.85);
      ink(c, 2);
      c.restore();
      label(c, 'pan', ax, ay + 40, { size: 24, color: PAL.magenta, weight: 800 });
    }
    const flip = b.fx > 0.2;
    const lean = clamp(b.vx / 900, -1, 1) * -0.22 + (g.flickT > 0 ? (flip ? 1 : -1) * 0.25 * (g.flickT / 0.25) : 0);
    // its shadow on the flagstones
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(b.x, b.y + 4, R * s * 1.1, 16 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    // The painted poses: flicking, braced against a gust (facing into it),
    // sweeping across, pushing into or out of the picture, pleased; otherwise
    // the portrait.
    const braced = g.gust && g.gust.warn <= 0;
    const pose = g.flickT > 0 ? ['sprites.broomwhiskSweep', 1, flip]
      : braced ? ['sprites.broomwhiskPoses', 1, g.gust.dir < 0]
      : Math.abs(b.vx) > 120 ? ['sprites.broomwhiskSweep', 0, flip]
      : Math.abs(b.vy) > 80 ? ['sprites.broomwhiskPoses', 0, flip]
      : g.proudT > 0 ? ['sprites.broomwhiskPoses', 2, flip] : null;
    if (pose && drawPose(c, pose[0], pose[1], b.x, b.y + 6, s, pose[2], lean * 0.5)) return;
    c.save();
    c.translate(b.x, b.y + 6 - g.proudT * 20 * s);
    c.rotate(lean + (braced && !env.reduceMotion ? g.gust.dir * -0.12 + Math.sin(t * 30) * 0.02 : 0));
    drawBird(c, 'broomwhisk', { x: 0, y: 0, size: SIZE * s, t, flip });
    c.restore();
    if (g.flickT > 0) {
      // a swish of ink in front of the bristles
      c.save();
      c.globalAlpha = g.flickT / 0.25;
      c.beginPath();
      const a = Math.atan2(b.fy / 2, b.fx);
      c.ellipse(b.x, b.y, R * 1.7 * s, R * 0.85 * s, 0, a - 0.8, a + 0.8);
      ink(c, 3, PAL.ochre);
      c.restore();
    }
  }

  g.draw = (c, t) => {
    const warn = g.gust && g.gust.warn > 0;
    scene(c, 'broomwhisk', W, H, (c) => {
      // the back wall, plastered and sunny
      band(c, 0, 0, W, FLOOR_T + 10, '#efe2bc', 0.7, 1);
      // a door and a window
      poly(c, [[1130, 150], [1290, 150], [1290, FLOOR_T], [1130, FLOOR_T]], 2, 1.5);
      wash(c, PAL.slate, 0.8);
      ink(c, 2.4);
      poly(c, [[1130, 150], [1290, 150], [1290, FLOOR_T], [1130, FLOOR_T]], 2, 1.5);
      hatch(c, 1126, 146, 1294, FLOOR_T + 4, 12, 0.2, 1);
      poly(c, [[420, 150], [600, 150], [600, 330], [420, 330]], 3, 1.5);
      wash(c, PAL.sky, 0.9);
      ink(c, 2.4);
      c.beginPath();
      c.moveTo(510, 150);
      c.lineTo(510, 330);
      c.moveTo(420, 240);
      c.lineTo(600, 240);
      ink(c, 2);
      // the fig tree in its tub, overhanging the courtyard
      poly(c, [[110, FLOOR_T - 120], [250, FLOOR_T - 120], [236, FLOOR_T + 20], [124, FLOOR_T + 20]], 4, 1);
      wash(c, PAL.brick, 0.8);
      ink(c, 2.4);
      c.beginPath();
      c.moveTo(180, FLOOR_T - 120);
      c.quadraticCurveTo(200, 250, 300, 160);
      ink(c, 14, '#8a6a4a');
      ink(c, 2);
      for (const [x, y, rx, ry] of [[320, 120, 220, 90], [560, 70, 200, 70], [180, 150, 130, 80], [880, 40, 260, 60]]) {
        blob(c, x, y, rx, ry, x, 0.12);
        wash(c, PAL.green, 0.75);
        ink(c, 2);
      }
      // the flagstones, in perspective
      band(c, 0, FLOOR_T, W, H - FLOOR_T, '#d8ccb0', 0.85, 4);
      c.beginPath();
      for (let i = 0; i <= 5; i++) {
        const y = FLOOR_T + Math.pow(i / 5, 1.3) * (H - FLOOR_T);
        c.moveTo(0, y);
        c.lineTo(W, y + (i % 2 ? 3 : -3));
      }
      for (let i = -6; i <= 6; i++) {
        c.moveTo(800 + i * 150, FLOOR_T);
        c.lineTo(800 + i * 230, H);
      }
      ink(c, 1.4, 'rgba(59,43,32,0.35)');
      c.beginPath();
      c.moveTo(0, FLOOR_T);
      c.lineTo(W, FLOOR_T);
      ink(c, 2.4);
    });
    // the leaves on the tree shiver before a gust
    if (warn && !env.reduceMotion) {
      c.save();
      c.globalAlpha = 0.7;
      for (let i = 0; i < 6; i++) {
        const x = 200 + i * 80 + Math.sin(t * 30 + i) * 8;
        label(c, '~', x, 120 + (i % 3) * 30, { size: 40, color: PAL.green, weight: 800 });
      }
      c.restore();
      label(c, g.gust.dir > 0 ? 'Gust! →' : '← Gust!', 800, 410, { size: 48, color: PAL.slate, weight: 800 });
    }

    drawPan(c, t);
    // the floor's things and the broom, back to front
    const all = [...g.items.filter((it) => it.z <= 0).map((it) => ({ y: it.y, f: () => drawItem(c, it, t) })), { y: g.broom.y + 1, f: () => drawBroom(c, t) }];
    all.sort((a, b) => a.y - b.y).forEach((o) => o.f());
    for (const it of g.items) if (it.z > 0) drawItem(c, it, t);

    // the wind
    c.save();
    for (const s of g.streaks) {
      c.globalAlpha = s.life;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.bezierCurveTo(s.x - s.dir * 60, s.y - 20, s.x - s.dir * 120, s.y + 20, s.x - s.dir * 200, s.y);
      ink(c, 2, PAL.slate);
    }
    c.restore();

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
      hint(c, 'Push the leaves into the dustpan · press to flick', W / 2, 440, { focus: g.focus(), span: g.span, size: 34, weight: 600 });
      c.restore();
    }
  };

  // On a narrow screen: keep the broom in view, and as much of the way to
  // the pan as fits.
  g.span = 1000;
  g.focus = () => {
    const bx = g.broom.x;
    const px = g.pan.x;
    if (Math.abs(px - bx) < g.span - 260) return (bx + px) / 2;
    return bx + Math.sign(px - bx) * (g.span / 2 - 150);
  };

  return g;
}
