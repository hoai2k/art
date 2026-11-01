// Pincushion Piffle: Stitch in Time.
//
// A patchwork quilt scrolls down under the needle, seen from above, with a
// dotted chalk seam winding across it. Steer the needle left and right to keep
// it on the seam. The needle lays a stitch every little way: one on the seam
// (within a thread's breadth or so) is neat and scores; one off it is a wobbly
// stitch that doesn't. Hold the action to sew faster, which makes the seam
// harder to follow. Every 25 neat stitches in a row earns 5 more. The quilt
// speeds up and the seam gets twistier as time goes on.
//
// Score: the stitches sewn on the line (plus the run bonuses), in 45 seconds.

import { drawBird, scene, band, blob, wash, ink, poly, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

const DURATION = 45;
const STITCH = 46; // px of quilt between stitches
const TOL = 26; // how far off the seam a stitch may land and still be neat
const RUN_BONUS = 25; // every this many in a row...
const BONUS = 5; // ...earns this many more
const HURRY = 1.6; // speed while the action is held
const STEER = 760; // the needle's top sideways speed, px/s
const SLOW = 0.6; // everything, while B (or Shift) is held
const FINE = 0.4; // sideways only, with a trigger held all the way
const NEEDLE_Y = 610;
const Q0 = 250; // the quilt's left and right edges
const Q1 = 1350;
const PATCH = 183;
const SEAM_MIN = 390;
const SEAM_MAX = 1210;
const THREAD = '#b8323a';
const PIFFLE = { x: 1462, y: 880, size: 270 };

const PATCH_COLS = ['#c8d0a8', '#e6c0b4', '#ecdcaa', '#b8c8d4', '#efe6d0', '#d0b8c8', '#d8c890'];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    dist: 0, // how far the quilt has scrolled
    x: 800, // the needle
    vx: 0,
    next: STITCH, // distance of the next stitch
    stitches: [], // { s, x, on }
    seam: [{ s: -900, x: 800 }, { s: 520, x: 800 }], // control points
    run: 0,
    best: 0,
    neat: 0,
    wobbly: 0,
    bonus: 0,
    hurry: false,
    stab: 0, // the needle's dip at each stitch, 1 → 0
    pops: [],
    sparks: [],
    pointer: false,
  };

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js). It sets the
  // quilt's speed and how the seam bends. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(clamp(g.elapsed / DURATION, 0, 1));
  g.quiltSpeed = () => knob(g.d(), 150, 205, 270); // px/s the quilt runs, before hurrying or slowing
  g.bendGap = () => knob(g.d(), 360, 275, 170); // px between the seam's bends, times 0.85 to 1.15
  g.bendSwing = () => knob(g.d(), 110, 200, 320); // px a bend may swing sideways, at most

  // ---------- the seam ----------

  // Grow the seam ahead: control points, closer together and further apart
  // sideways as the game goes on; smooth S-bends between them.
  function growSeam(upTo) {
    while (g.seam[g.seam.length - 1].s < upTo) {
      const last = g.seam[g.seam.length - 1];
      const gap = g.bendGap() * (0.85 + rng() * 0.3);
      const amp = g.bendSwing();
      let x = last.x + (rng() * 2 - 1) * amp;
      if (x < SEAM_MIN) x = SEAM_MIN + (SEAM_MIN - x) * 0.5;
      if (x > SEAM_MAX) x = SEAM_MAX - (x - SEAM_MAX) * 0.5;
      g.seam.push({ s: last.s + gap, x: clamp(x, SEAM_MIN, SEAM_MAX) });
    }
    while (g.seam.length > 3 && g.seam[1].s < g.dist - 900) g.seam.shift();
  }
  // The seam's x at quilt distance s.
  function seamX(s) {
    const pts = g.seam;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].s < s) i++;
    const a = pts[i];
    const b = pts[i + 1];
    const u = clamp((s - a.s) / (b.s - a.s), 0, 1);
    return lerp(a.x, b.x, (1 - Math.cos(Math.PI * u)) / 2);
  }
  g.seamX = seamX;
  growSeam(2000);

  const speed = () => g.quiltSpeed() * (g.hurry ? HURRY : 1) * (g.slow ? SLOW : 1);
  g.speed = speed;

  // ---------- events ----------

  function pop(text, x, y, color = INK, size = 44, tag = '') {
    if (tag) g.pops = g.pops.filter((q) => q.tag !== tag);
    g.pops.push({ x, y, text, color, size, life: 1, tag });
  }

  function stitch() {
    const off = g.x - seamX(g.next);
    const on = Math.abs(off) <= TOL;
    g.stitches.push({ s: g.next, x: g.x, on, wob: rng() });
    if (g.stitches.length > 60) g.stitches.shift();
    g.stab = 1;
    if (on) {
      g.neat++;
      g.score++;
      g.run++;
      g.best = Math.max(g.best, g.run);
      sfx('stitch');
      if (g.run % RUN_BONUS === 0) {
        g.score += BONUS;
        g.bonus += BONUS;
        pop(`${g.run} in a row! +${BONUS}`, g.x, NEEDLE_Y - 190, '#8a5a1a', 44, 'run');
        sfx('ding', { pitch: Math.min(12, g.run / 25 * 2) });
        for (let i = 0; i < 14; i++) {
          const a = rng() * Math.PI * 2;
          g.sparks.push({ x: g.x, y: NEEDLE_Y - 60, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260 - 60, life: 0.8, col: PATCH_COLS[i % PATCH_COLS.length] });
        }
      } else if (g.run === 10) pop('Neat!', g.x, NEEDLE_Y - 170, '#5a7a2a', 42, 'run');
    } else {
      g.wobbly++;
      if (g.run >= 8) {
        pop('Tangled!', g.x, NEEDLE_Y - 170, PAL.brick, 42, 'run');
        sfx('miss');
        env.vibrate?.(30);
      }
      g.run = 0;
    }
  }

  // ---------- update ----------

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    // Hurry while the action is held. A finger on the screen is always down
    // while it steers, so with the pointer it's holding high up the quilt,
    // well ahead of the needle, that hurries.
    const ptr = input.pointer && input.pointer.active;
    g.pointer = ptr;
    // A or Space hurries (RT steers finely here instead); B or Shift slows the
    // whole quilt down, and a trigger slows just the steering.
    g.hurry = ptr ? !!input.pointer.down && input.pointer.y < NEEDLE_Y - 160 : !!(input.actionA ?? input.action);
    g.slow = !ptr && !!input.slow;
    const steer = STEER * (g.slow ? SLOW : 1) * lerp(1, FINE, clamp(input.trigger || 0, 0, 1));
    g.dist += speed() * dt;
    growSeam(g.dist + 1200);

    // Steer: follow the pointer, or push with the stick.
    const prev = g.x;
    if (input.pointer && input.pointer.active) {
      const want = approach(g.x, input.pointer.x, 14, dt);
      g.x += clamp(want - g.x, -STEER * 1.2 * dt, STEER * 1.2 * dt);
      g.vx = (g.x - prev) / Math.max(dt, 1e-4);
    } else {
      g.vx = approach(g.vx, (input.x || 0) * steer, 16, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, Q0 + 40, Q1 - 40);

    while (g.dist >= g.next) {
      stitch();
      g.next += STITCH;
    }

    g.stab = Math.max(0, g.stab - dt * 7);
    for (const q of g.pops) {
      q.life -= dt * 1.1;
      q.y -= dt * 30;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
    for (const p of g.sparks) {
      p.life -= dt;
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    g.sparks = g.sparks.filter((p) => p.life > 0);
  };

  g.hud = () => (g.run >= 3 ? `Stitches ${g.score} · run ${g.run}` : `Stitches ${g.score}`);
  g.summary = () => {
    const all = g.neat + g.wobbly;
    const pct = all ? Math.round((g.neat / all) * 100) : 0;
    return [`${g.neat} neat stitches of ${all} (${pct}% on the line).`, `Longest run: ${g.best}.${g.bonus ? ` Run bonuses: +${g.bonus}.` : ''}`];
  };

  // ---------- drawing ----------

  const yOf = (s) => NEEDLE_Y - (s - g.dist);
  const hash = (a, b) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  function drawPatch(c, x, y, row, col) {
    const h1 = hash(row, col);
    const h2 = hash(col + 7, row + 3);
    const color = PATCH_COLS[Math.floor(h1 * PATCH_COLS.length)];
    c.fillStyle = color;
    c.fillRect(x, y, PATCH, PATCH);
    c.save();
    c.beginPath();
    c.rect(x, y, PATCH, PATCH);
    c.clip();
    const kind = Math.floor(h2 * 5);
    c.globalAlpha = 0.22;
    if (kind === 0) {
      // polka dots
      c.fillStyle = INK;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        c.beginPath();
        c.arc(x + 16 + i * 31 + (j % 2) * 15, y + 16 + j * 31, 3.5, 0, Math.PI * 2);
        c.fill();
      }
    } else if (kind === 1) {
      // stripes
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.moveTo(x + 10 + i * 21, y);
        c.lineTo(x + 10 + i * 21, y + PATCH);
        ink(c, 6, i % 2 ? '#8a5a4a' : '#6a7a9a');
      }
    } else if (kind === 2) {
      // gingham: hatching both ways
      c.beginPath();
      c.rect(x, y, PATCH, PATCH);
      hatch(c, x, y, x + PATCH, y + PATCH, 16, 0.8, 1);
      c.beginPath();
      c.rect(x, y, PATCH, PATCH);
      hatch(c, x, y, x + PATCH, y + PATCH, 16, 0.8, -1);
    } else if (kind === 3) {
      // little flowers
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const fx = x + 24 + i * 45 + (j % 2) * 18;
        const fy = y + 24 + j * 45;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          c.beginPath();
          c.arc(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 4, 0, Math.PI * 2);
          c.fillStyle = '#b84a5a';
          c.fill();
        }
      }
    }
    c.restore();
  }

  // The work table: the painted scene, or this stand-in.
  function drawTable(c) {
    c.fillStyle = '#c89a5a';
    c.fillRect(0, 0, W, H);
    band(c, 0, 0, W, H, '#b07a40', 0.35, 4);
    c.save();
    c.globalAlpha = 0.25;
    for (let x = 18; x < W; x += 46) {
      if (x > Q0 - 20 && x < Q1 + 20) continue;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(x + 12, 300, x - 12, 600, x + 6, H);
      ink(c, 1.4, '#6a4420');
    }
    c.restore();
  }

  function drawQuilt(c) {
    // the quilt, scrolling
    c.save();
    c.beginPath();
    c.rect(Q0, 0, Q1 - Q0, H);
    c.clip();
    const r0 = Math.floor((g.dist - (H - NEEDLE_Y)) / PATCH) - 1;
    const r1 = Math.floor((g.dist + NEEDLE_Y) / PATCH) + 1;
    for (let r = r0; r <= r1; r++) {
      const y = yOf((r + 1) * PATCH);
      for (let col = 0; col < 6; col++) drawPatch(c, Q0 + col * PATCH, y, r, col);
    }
    // quilting stitches along the patch edges
    c.save();
    c.setLineDash([9, 9]);
    c.globalAlpha = 0.55;
    for (let r = r0; r <= r1; r++) {
      const y = yOf(r * PATCH);
      c.beginPath();
      c.moveTo(Q0, y - 4);
      c.lineTo(Q1, y - 4);
      ink(c, 2, '#fbf3df');
    }
    for (let col = 1; col < 6; col++) {
      c.beginPath();
      c.moveTo(Q0 + col * PATCH - 4, 0);
      c.lineTo(Q0 + col * PATCH - 4, H);
      ink(c, 2, '#fbf3df');
    }
    c.restore();
    for (let col = 1; col < 6; col++) {
      c.beginPath();
      c.moveTo(Q0 + col * PATCH, 0);
      c.lineTo(Q0 + col * PATCH, H);
      ink(c, 1.4, 'rgba(59,43,32,0.5)');
    }
    for (let r = r0; r <= r1; r++) {
      c.beginPath();
      c.moveTo(Q0, yOf(r * PATCH));
      c.lineTo(Q1, yOf(r * PATCH));
      ink(c, 1.4, 'rgba(59,43,32,0.5)');
    }
    // a soft shade at the far (top) edge, where the quilt comes from
    const sh = c.createLinearGradient(0, 0, 0, 120);
    sh.addColorStop(0, 'rgba(59,43,32,0.25)');
    sh.addColorStop(1, 'rgba(59,43,32,0)');
    c.fillStyle = sh;
    c.fillRect(Q0, 0, Q1 - Q0, 120);
    c.restore();
    // the quilt's edges: a binding strip
    for (const x of [Q0, Q1]) {
      poly(c, [[x - 10, -10], [x + 10, -10], [x + 10, H + 10], [x - 10, H + 10]], x, 1);
      wash(c, '#a85a5a');
      ink(c, 2.2);
    }
  }

  function drawSeam(c) {
    // tailor's chalk: dots along the seam, ahead of the needle and a little behind
    const sFrom = g.dist - (H - NEEDLE_Y) - 20;
    const sTo = g.dist + NEEDLE_Y + 20;
    let acc = 0;
    let px = seamX(sFrom);
    let py = yOf(sFrom);
    const dots = [];
    for (let s = sFrom; s <= sTo; s += 3) {
      const x = seamX(s);
      const y = yOf(s);
      acc += Math.hypot(x - px, y - py);
      px = x;
      py = y;
      if (acc >= 24) {
        acc = 0;
        dots.push([x, y, s]);
      }
    }
    for (const [x, y, s] of dots) {
      const ahead = s > g.dist;
      c.beginPath();
      c.arc(x, y, ahead ? 8 : 5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(251,243,223,0.95)';
      c.fill();
      c.beginPath();
      c.arc(x, y, ahead ? 5 : 3, 0, Math.PI * 2);
      c.fillStyle = ahead ? '#2e3a7a' : 'rgba(46,58,122,0.45)';
      c.fill();
    }
  }

  function drawStitches(c) {
    // a running stitch: the thread shows for the first part of each step
    let prev = null;
    for (const st of g.stitches) {
      const y = yOf(st.s);
      if (prev && y < H + 30) {
        const py = yOf(prev.s);
        const x0 = prev.x;
        const y0 = py;
        const x1 = lerp(prev.x, st.x, 0.62);
        const y1 = lerp(py, y, 0.62);
        c.beginPath();
        if (st.on) {
          c.moveTo(x0, y0);
          c.lineTo(x1, y1);
          ink(c, 8, 'rgba(59,43,32,0.5)');
          ink(c, 5.5, THREAD);
          c.beginPath();
          c.moveTo(x0 + 1, y0 - 1);
          c.lineTo(x1 + 1, y1 - 1);
          ink(c, 1.4, 'rgba(255,220,210,0.6)');
        } else {
          // wobbly: a loose, loopy bit of thread
          c.moveTo(x0, y0);
          const n = 6;
          for (let i = 1; i <= n; i++) {
            const u = i / n;
            const wob = Math.sin(u * Math.PI * 3 + st.wob * 6) * 7;
            c.lineTo(lerp(x0, x1, u) + wob, lerp(y0, y1, u) + wob * 0.4);
          }
          ink(c, 4, '#d0707a');
          c.beginPath();
          c.arc(x1, y1, 5, 0, Math.PI * 2);
          ink(c, 2.4, '#d0707a');
        }
      }
      prev = st;
    }
  }

  function drawNeedle(c, t) {
    const x = g.x;
    const sy = g.dist + 0; // the seam at the needle
    const off = x - seamX(sy);
    const on = Math.abs(off) <= TOL;
    const dip = g.stab * 10;
    // where the seam is at the needle: a marker the needle should sit on
    const mx = seamX(sy);
    c.beginPath();
    c.arc(mx, NEEDLE_Y, TOL + 6, 0, Math.PI * 2);
    ink(c, 3, on ? 'rgba(90,122,42,0.9)' : 'rgba(184,98,74,0.9)');
    if (!on) {
      // an arrow from the needle toward the seam
      const dir = Math.sign(mx - x);
      const ax = x + dir * 70;
      c.save();
      c.globalAlpha = clamp((Math.abs(off) - TOL) / 40, 0, 0.9);
      c.translate(ax, NEEDLE_Y + 46);
      poly(c, [[dir * 26, 0], [0, -14], [0, -6], [-dir * 18, -6], [-dir * 18, 6], [0, 6], [0, 14]], 3, 0.5);
      c.fillStyle = PAL.brick;
      c.fill();
      c.restore();
    }
    // the thread from the needle's eye back to the Piffle
    const eyeX = x + 3;
    const eyeY = NEEDLE_Y + 97 + dip;
    c.beginPath();
    c.moveTo(eyeX, eyeY);
    c.bezierCurveTo(eyeX + 40, eyeY + 160, PIFFLE.x - 260, PIFFLE.y - 40, PIFFLE.x - 60, PIFFLE.y - 140);
    ink(c, 4.5, 'rgba(59,43,32,0.4)');
    ink(c, 3, THREAD);
    // shadow
    c.save();
    c.globalAlpha = 0.25;
    c.beginPath();
    c.ellipse(x + 18, NEEDLE_Y + 48, 11, 72, 0.12, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
    c.restore();
    // the needle: point down on the seam, eye toward you
    c.save();
    c.translate(x, NEEDLE_Y + dip);
    const tilt = clamp(g.vx / STEER, -1, 1) * 0.18;
    c.rotate(tilt);
    c.scale(1.35, 1.35);
    c.beginPath();
    c.moveTo(0, -4);
    c.lineTo(-6, 40);
    c.lineTo(-6, 82);
    c.quadraticCurveTo(0, 94, 6, 82);
    c.lineTo(6, 40);
    c.closePath();
    const grd = c.createLinearGradient(-6, 0, 6, 0);
    grd.addColorStop(0, '#9aa0aa');
    grd.addColorStop(0.45, '#f4f6f8');
    grd.addColorStop(1, '#7a808a');
    c.fillStyle = grd;
    c.fill();
    ink(c, 1.8);
    c.beginPath();
    c.ellipse(0, 72, 2.2, 7, 0, 0, Math.PI * 2);
    c.fillStyle = '#5a5048';
    c.fill();
    c.restore();
    // the needle's point shows where the stitch goes
    c.beginPath();
    c.arc(x, NEEDLE_Y, 4, 0, Math.PI * 2);
    c.fillStyle = on ? '#5a7a2a' : PAL.brick;
    c.fill();
  }

  g.draw = (c, t) => {
    scene(c, 'piffle', W, H, drawTable);
    drawQuilt(c);
    drawSeam(c);
    drawStitches(c);
    if (g.hurry) {
      // speed lines at the quilt's edges
      c.save();
      c.globalAlpha = 0.35;
      for (let i = 0; i < 8; i++) {
        const y = ((t * 900 + i * 137) % (H + 200)) - 100;
        for (const x of [Q0 + 30, Q1 - 30]) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x, y + 70);
          ink(c, 3, '#fbf3df');
        }
      }
      c.restore();
    }
    drawNeedle(c, t);
    for (const p of g.sparks) {
      c.save();
      c.globalAlpha = clamp(p.life * 1.5, 0, 1);
      blob(c, p.x, p.y, 7, 5, 3, 0.1, 8);
      wash(c, p.col, 1);
      ink(c, 1.2);
      c.restore();
    }

    // the Piffle, on the table at the corner, holding the thread
    drawBird(c, 'piffle', { x: PIFFLE.x, y: PIFFLE.y, size: PIFFLE.size, t, pose: {} });
    // a cotton reel and a few buttons on the left
    const rx = 125;
    const ry = 760;
    poly(c, [[rx - 52, ry - 70], [rx + 52, ry - 70], [rx + 52, ry - 54], [rx - 52, ry - 54]], 1, 1);
    wash(c, '#d8b07a');
    ink(c, 2);
    blob(c, rx, ry, 42, 54, 2, 0.02, 14);
    wash(c, THREAD);
    ink(c, 2);
    blob(c, rx, ry, 42, 54, 2, 0.02, 14);
    hatch(c, rx - 50, ry - 60, rx + 50, ry + 60, 6, 0.3, 0.2);
    poly(c, [[rx - 52, ry + 54], [rx + 52, ry + 54], [rx + 52, ry + 70], [rx - 52, ry + 70]], 3, 1);
    wash(c, '#d8b07a');
    ink(c, 2);
    for (const [bx, by, col] of [[80, 560, PAL.slate], [170, 610, PAL.mustard], [110, 650, PAL.strawberry]]) {
      blob(c, bx, by, 20, 20, bx, 0.04, 12);
      wash(c, col);
      ink(c, 1.8);
      c.fillStyle = INK;
      for (const [dx, dy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) c.fillRect(bx + dx - 1.5, by + dy - 1.5, 3, 3);
    }
    // the run so far, on the left
    if (g.run >= 2) {
      label(c, String(g.run), 125, 300, { size: 76, weight: 800, color: '#8a5a1a' });
      label(c, 'in a row', 125, 350, { size: 24, weight: 700 });
      const toBonus = RUN_BONUS - (g.run % RUN_BONUS);
      label(c, `+${BONUS} in ${toBonus}`, 125, 386, { size: 20, weight: 600, color: '#6a4420' });
    }
    if (g.hurry) label(c, 'Hurry!', 1475, 300, { size: 40, weight: 800, color: '#8a2a2a' });
    else if (g.elapsed < 5) {
      label(c, g.pointer ? 'Hold up high' : 'Hold to', 1475, 280, { size: 24, weight: 600 });
      label(c, g.pointer ? 'to sew faster' : 'sew faster', 1475, 310, { size: 24, weight: 600 });
    }

    for (const q of g.pops) {
      c.save();
      c.globalAlpha = clamp(q.life * 2, 0, 1);
      const s = 1 + Math.max(0, q.life - 0.85) * 2;
      c.translate(q.x, q.y);
      c.scale(s, s);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.95)';
      c.font = `800 ${q.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(q.text, 0, 0);
      label(c, q.text, 0, 0, { size: q.size, color: q.color, weight: 800 });
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => g.x;
  g.span = 760;

  return g;
}
