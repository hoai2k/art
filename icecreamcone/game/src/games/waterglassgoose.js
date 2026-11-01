// Waterglass Goose: Glass Harp.
//
// A row of drinking glasses stands on the table, each filled to its own
// level, so each rings its own note when tapped (more water, a lower note).
// The Goose plays a little tune on them, tapping each glass with its beak;
// then it's your turn to play the same tune back. Move along the glasses
// (stick, D-pad or arrows, or point at one) and press the action to tap the
// glass the Goose stands at. Each right note scores one (two if it follows
// the last within 0.8 s, so a quick, sure player always has more to win),
// and a whole tune played back three more. A wrong glass, or waiting too long, cracks a
// glass and ends that tune: three cracks and the concert is over. Eight
// tunes: they start with two notes on three glasses and grow, along the
// shared difficulty curve, to as many as eight notes on five, played faster. Score: points.

import { art, drawBird, drawSprite, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.harpGlass': [2, 1], // an empty tumbler, and the same tumbler cracked
  'sprites.gooseTap': [2, 1], // the Goose tapping with its beak, and honking with its head up
  'sprites.gooseMoves': [2, 1], // the Goose mid-stride, and recoiling from a cracked glass
});

// Eight tunes. How many glasses, how many notes and the seconds between notes
// follow the shared difficulty curve (see difficulty.js) from the first tune
// to the last: short tunes on few glasses played slowly at first, longer and
// quicker towards the end.
const TUNES = 8;
const MAX_CRACKS = 3;
const BONUS = 3; // for a whole tune
const PATIENCE = 5; // seconds to tap the next note before it counts as wrong
const TABLE = 690; // the table top, where the glasses stand
const GLASS_H = 230;
const GLASS_W = 120;
// Five glasses, low to high: C D E G A (no wrong-sounding pair among them).
const NOTES = [523.25, 587.33, 659.25, 783.99, 880];
const LEVELS = [0.86, 0.72, 0.58, 0.42, 0.28];
// blue, green, yellow, pink, orange: no two a child could mix up
const TINTS = ['#7f93a8', '#a9b88a', '#efd96a', '#ea8fb0', '#e09a48'];
const QUICK = 0.8; // a right note within this many seconds of the last scores one extra
const GOOSE = 300;
// The scale the Goose is painted at in each pose cell, against its portrait
// (measured in design/source/pose-scales.json).
const POSE_PAINTED = { 'sprites.gooseTap': [0.957, 0.966], 'sprites.gooseMoves': [0.966, 0.955] };
// The Goose stands just behind the row, to the right of the glass it plays,
// so that leaning in (0.3 rad about its feet) brings its beak tip down onto
// the glass's rim, on the painting (beak tip at about (-165, -362) in bird
// units) and the stand-in alike. It is drawn before the glasses, so they
// stand in front of it.
const STAND = 170;
const BACK = 20;

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    score: 0,
    done: false,
    round: -1,
    phase: 'intro', // intro | show | play | good | oops | end
    pt: 0, // seconds in this phase
    tune: [],
    pos: 0, // the note being shown, or the next one to play
    sel: 1, // the glass the Goose stands at
    gx: 800, // the Goose, drawn
    glasses: [],
    cracks: 0,
    quick: 0, // notes played quickly, straight after the last
    notes: 0, // right notes
    tunes: 0, // whole tunes played back
    tap: 0, // the Goose's beak tap, 1 → 0
    idle: 0, // seconds since the last tap in play
    stepT: 0, // stick auto-repeat
    lastX: 0,
    rings: [], // ripples and notes floating up
    pops: [],
    shown: -1, // the glass lit in the show
  };
  g.TUNES = TUNES;
  // How hard tune i is, along the curve for the chosen Difficulty. Each knob:
  // easy, medium, hard.
  const dAt = curve(env);
  g.d = (i = g.round) => dAt(clamp(i, 0, TUNES - 1) / (TUNES - 1));
  g.tuneAt = (i = g.round) => {
    const d = g.d(i);
    return {
      n: Math.round(knob(d, 3, 4.4, 5)), // glasses on the table
      len: Math.round(knob(d, 2, 4, 8)), // notes in the tune
      gap: knob(d, 0.9, 0.66, 0.4), // seconds between the Goose's notes
    };
  };
  const R = () => g.tuneAt();
  g.noteGap = () => R().gap; // seconds between the Goose's notes this tune
  g.glassX = (i, n = g.glasses.length) => 800 + (i - (n - 1) / 2) * (n > 4 ? 250 : n > 3 ? 290 : 330);

  function pop(text, x, y, color = INK, size = 44) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  // Which of the five notes are on the table: spread wide while there are
  // few, so they are easy to tell apart by ear and by eye.
  const SETS = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };
  function setGlasses(n) {
    const old = g.glasses;
    g.glasses = SETS[n].map((note, i) => ({ note, lit: 0, shake: 0, cracked: old[i]?.cracked || 0 }));
  }

  function makeTune(len, n) {
    const t = [];
    for (let i = 0; i < len; i++) {
      let k = Math.floor(rng() * n);
      // no three alike in a row, and no repeat at all in the first tunes
      if (i > 0 && k === t[i - 1] && (g.round < 4 || (i > 1 && t[i - 2] === k))) k = (k + 1 + Math.floor(rng() * (n - 1))) % n;
      t.push(k);
    }
    return t;
  }

  function nextRound() {
    g.round++;
    if (g.round >= TUNES || g.cracks >= MAX_CRACKS) {
      g.phase = 'end';
      g.pt = 0;
      return;
    }
    const r = R();
    if (r.n !== g.glasses.length) setGlasses(r.n);
    g.tune = makeTune(r.len, r.n);
    g.pos = 0;
    g.phase = 'show';
    g.pt = -0.5;
    g.shown = -1;
  }

  function ring(i, by = 'you') {
    const gl = g.glasses[i];
    gl.lit = 1;
    gl.shake = 0.3;
    g.tap = 1;
    const note = NOTES[gl.note];
    sfx('note', { freq: note, dur: 0.6 });
    sfx('note', { freq: note * 2, dur: 0.25 });
    g.rings.push({ x: g.glassX(i), y: TABLE - GLASS_H * LEVELS[gl.note] - 10, life: 1, note: by === 'you' ? '♪' : '♫', col: TINTS[gl.note] });
  }

  function crack(i, why) {
    g.cracks++;
    if (i >= 0) {
      g.glasses[i].cracked = 1;
      g.glasses[i].shake = 0.5;
    }
    pop(why, 800, 190, PAL.brick, 52);
    sfx('wrong');
    sfx('bonk');
    env.vibrate?.(120);
    g.phase = 'oops';
    g.pt = 0;
  }

  setGlasses(g.tuneAt(0).n);
  g.sel = 1;
  g.gx = g.glassX(1) + STAND;

  g.update = (dt, input) => {
    if (g.done) return;
    g.pt += dt;
    g.tap = Math.max(0, g.tap - dt * 4);
    for (const gl of g.glasses) {
      gl.lit = Math.max(0, gl.lit - dt * 2.2);
      gl.shake = Math.max(0, gl.shake - dt);
    }

    if (g.phase === 'intro') {
      if (g.pt > 0.6) nextRound();
    } else if (g.phase === 'show') {
      // The Goose walks to each glass of the tune in turn and taps it.
      const gap = R().gap;
      const k = Math.floor(g.pt / gap);
      if (g.pt >= 0 && k > g.shown) {
        g.shown = k;
        if (k < g.tune.length) {
          g.sel = g.tune[k];
          ring(g.sel, 'goose');
        }
      }
      if (g.pt >= gap * (g.tune.length + 0.4)) {
        g.phase = 'play';
        g.pt = 0;
        g.pos = 0;
        g.idle = 0;
        g.lastX = input.x;
        sfx('go');
      }
    } else if (g.phase === 'play') {
      // Move along the glasses.
      const n = g.glasses.length;
      if (input.pointer.active) {
        let best = 0;
        for (let i = 1; i < n; i++) if (Math.abs(g.glassX(i) - input.pointer.x) < Math.abs(g.glassX(best) - input.pointer.x)) best = i;
        if (best !== g.sel) sfx('move');
        g.sel = best;
      } else {
        const dir = input.x > 0.5 ? 1 : input.x < -0.5 ? -1 : 0;
        const was = g.lastX > 0.5 ? 1 : g.lastX < -0.5 ? -1 : 0;
        g.stepT -= dt;
        if (dir && (dir !== was || g.stepT <= 0)) {
          const s = clamp(g.sel + dir, 0, n - 1);
          if (s !== g.sel) sfx('move');
          g.sel = s;
          g.stepT = dir !== was ? 0.32 : 0.16;
        }
        g.lastX = input.x;
      }
      g.idle += dt;
      if (input.actionPressed) {
        const quick = g.pos > 0 && g.idle <= QUICK;
        g.idle = 0;
        ring(g.sel);
        if (g.sel === g.tune[g.pos]) {
          g.pos++;
          g.notes++;
          g.score++;
          if (quick) {
            // played straight on, without a pause: one extra
            g.score++;
            g.quick++;
            pop('Quick! +1', g.glassX(g.sel), TABLE - GLASS_H - 70, PAL.orange, 34);
          }
          if (g.pos >= g.tune.length) {
            g.tunes++;
            g.score += BONUS;
            pop(`Just right!  +${BONUS}`, 800, 190, PAL.magenta, 56);
            sfx('right');
            env.vibrate?.(30);
            g.phase = 'good';
            g.pt = 0;
          }
        } else crack(g.sel, 'Crack! Not that one');
      } else if (g.idle > PATIENCE) crack(-1, 'Too slow!');
    } else if (g.phase === 'good' || g.phase === 'oops') {
      if (g.pt > (g.phase === 'good' ? 1.1 : 1.5)) nextRound();
    } else if (g.phase === 'end') {
      if (g.pt > 0.8) g.done = true;
    }

    g.gx = approach(g.gx, g.glassX(g.sel) + STAND, 12, dt);
    for (const r of g.rings) r.life -= dt * 0.9;
    g.rings = g.rings.filter((r) => r.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 30 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Tune ${clamp(g.round + 1, 1, TUNES)}/${TUNES} · ${g.score}`;
  g.summary = () => [
    `${g.tunes} of ${TUNES} tunes played back just right, ${g.notes} right note${g.notes === 1 ? '' : 's'} (${g.quick} quick).`,
    g.cracks ? `${g.cracks} cracked glass${g.cracks === 1 ? '' : 'es'}.` : 'Not a single crack!',
  ];

  // ---------- drawing ----------

  function standinScene(c) {
    // a warm wall, a window with the evening outside, the table
    band(c, 0, 0, W, TABLE, '#e8d8b8', 0.5, 1);
    poly(c, [[1180, 90], [1480, 90], [1480, 420], [1180, 420]], 2, 1);
    wash(c, '#9fb4c8', 0.6);
    ink(c, 2.4);
    c.beginPath();
    c.moveTo(1330, 90);
    c.lineTo(1330, 420);
    c.moveTo(1180, 255);
    c.lineTo(1480, 255);
    ink(c, 3, '#8a6a4a');
    c.beginPath();
    c.arc(1420, 150, 22, 0, Math.PI * 2);
    c.fillStyle = 'rgba(250,240,200,0.8)';
    c.fill();
    // a lamp's warm glow
    const grd = c.createRadialGradient(240, 220, 10, 240, 220, 360);
    grd.addColorStop(0, 'rgba(255,230,160,0.45)');
    grd.addColorStop(1, 'rgba(255,230,160,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, 700, 700);
    // the table: its top and its front
    poly(c, [[20, TABLE - 20], [W - 20, TABLE - 20], [W, TABLE + 40], [0, TABLE + 40]], 3, 1);
    wash(c, '#c9925a');
    ink(c, 2.4);
    poly(c, [[0, TABLE + 40], [W, TABLE + 40], [W, H], [0, H]], 4, 1);
    wash(c, '#a8703f');
    ink(c, 2);
    poly(c, [[0, TABLE + 40], [W, TABLE + 40], [W, H], [0, H]], 4, 1);
    hatch(c, 0, TABLE + 40, W, H, 16, 0.2, 1);
    // a lace runner on the table
    band(c, 120, TABLE - 14, W - 240, 30, '#f7f0dc', 0.6, 5);
  }

  function drawGlass(c, i, t) {
    const gl = g.glasses[i];
    const x = g.glassX(i) + (gl.shake > 0 && !env.reduceMotion ? Math.sin(gl.shake * 70) * 4 : 0);
    const level = LEVELS[gl.note];
    const top = TABLE - GLASS_H;
    const inset = 14;
    // the glow when it rings
    if (gl.lit > 0) {
      c.save();
      c.globalAlpha = gl.lit * 0.7;
      const grd = c.createRadialGradient(x, TABLE - GLASS_H * 0.5, 10, x, TABLE - GLASS_H * 0.5, 170);
      grd.addColorStop(0, TINTS[gl.note]);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grd;
      c.fillRect(x - 180, TABLE - GLASS_H - 120, 360, GLASS_H + 160);
      c.restore();
    }
    // the water inside (drawn first, so a painted glass sits over it)
    // the painted tumbler has a thick glass foot (about 30 px at this size):
    // the water starts above it
    const base = art('sprites.harpGlass') ? TABLE - 30 : TABLE - 12;
    const wy = base + 2 - (GLASS_H - 24 - (TABLE - 12 - base)) * level;
    const half = (y) => lerp(GLASS_W / 2 - inset - 6, GLASS_W / 2 - inset, (TABLE - y) / GLASS_H);
    const wob = gl.lit * Math.sin(t * 30) * 4;
    c.beginPath();
    c.moveTo(x - half(wy), wy + wob);
    c.quadraticCurveTo(x, wy - wob, x + half(wy), wy + wob);
    c.lineTo(x + half(base), base);
    c.lineTo(x - half(base), base);
    c.closePath();
    c.save();
    c.globalAlpha = 0.72 + gl.lit * 0.28;
    c.fillStyle = TINTS[gl.note];
    c.fill();
    c.restore();
    c.beginPath();
    c.ellipse(x, wy, half(wy), 7, 0, 0, Math.PI * 2);
    c.save();
    c.globalAlpha = 0.6;
    c.fillStyle = '#f4f8fa';
    c.fill();
    c.restore();
    ink(c, 1.2, '#5a7a8a');
    if (!drawSprite(c, 'sprites.harpGlass', gl.cracked ? 1 : 0, x, TABLE, { h: GLASS_H })) {
      poly(c, [[x - GLASS_W / 2, top], [x + GLASS_W / 2, top], [x + GLASS_W / 2 - 8, TABLE], [x - GLASS_W / 2 + 8, TABLE]], i + 11, 0.8);
      c.save();
      c.globalAlpha = 0.18;
      c.fillStyle = '#dfeaf0';
      c.fill();
      c.restore();
      ink(c, 2.2, '#4a5a64');
      c.beginPath();
      c.ellipse(x, top, GLASS_W / 2, 10, 0, 0, Math.PI * 2);
      ink(c, 2, '#4a5a64');
      // a glint
      c.beginPath();
      c.moveTo(x - GLASS_W / 2 + 16, top + 26);
      c.lineTo(x - GLASS_W / 2 + 22, TABLE - 30);
      ink(c, 4, 'rgba(255,255,255,0.75)');
      if (gl.cracked) {
        c.beginPath();
        c.moveTo(x + 20, top + 4);
        c.lineTo(x + 6, top + 50);
        c.lineTo(x + 26, top + 86);
        c.lineTo(x + 12, top + 130);
        ink(c, 2, '#3a4a54');
      }
    }
  }

  // A ringing glass shines with its colour all round.
  function drawShine(c, i) {
    const gl = g.glasses[i];
    if (gl.lit <= 0) return;
    const x = g.glassX(i);
    const top = TABLE - GLASS_H;
    c.save();
    c.globalAlpha = gl.lit;
    poly(c, [[x - GLASS_W / 2 - 6, top - 6], [x + GLASS_W / 2 + 6, top - 6], [x + GLASS_W / 2 - 2, TABLE + 4], [x - GLASS_W / 2 + 2, TABLE + 4]], i + 60, 0.5);
    ink(c, 9, TINTS[gl.note]);
    c.restore();
  }

  function drawGoose(c, t) {
    const x = g.gx;
    const honk = g.phase === 'good';
    const oops = g.phase === 'oops' && g.pt < 0.9;
    const walking = Math.abs(g.gx - (g.glassX(g.sel) + STAND)) > 12;
    const lean = g.tap > 0 ? -0.3 * g.tap : oops ? 0.14 : 0;
    const shake = oops && !env.reduceMotion ? Math.sin(g.pt * 50) * 3 : 0;
    const bob = walking ? -Math.abs(Math.sin(t * 14)) * 6 : 0;
    c.save();
    c.translate(x + shake, TABLE - BACK + bob);
    c.rotate(lean);
    // The variants are painted in square cells framed like the portrait, but
    // the Goose in them is a little smaller (POSE_PAINTED), so each is drawn
    // that much bigger and the Goose stays one size whatever it does. Each is
    // placed by its lowest painted point (the tapping cells' feet are at 0.99
    // of the cell, the moving cells' at 0.93), so the feet stay on the floor.
    const FEET = { 'sprites.gooseTap': 0.99, 'sprites.gooseMoves': 0.93 };
    const pose = (key, i) => {
      const h = (GOOSE * 1.05) / POSE_PAINTED[key][i];
      return drawSprite(c, key, i, 0, (1 - FEET[key]) * h, { h, whole: true });
    };
    let drawn = false;
    if (g.tap > 0.3) drawn = pose('sprites.gooseTap', 0);
    else if (oops) drawn = pose('sprites.gooseMoves', 1);
    else if (honk) drawn = pose('sprites.gooseTap', 1);
    else if (walking) drawn = pose('sprites.gooseMoves', 0);
    if (!drawn) drawBird(c, 'waterglassgoose', { x: 0, y: 0, size: GOOSE, t, pose: { tap: g.tap, honk, oops, walking } });
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'waterglassgoose', W, H, standinScene);

    // whose turn
    if (g.phase === 'show') label(c, 'Listen…', 800, 110, { size: 50, color: PAL.slate, weight: 700, halo: true });
    else if (g.phase === 'play') label(c, 'Your turn!', 800, 110, { size: 50, color: PAL.magenta, weight: 800, halo: true });
    // the tune as a row of dots: filled as you play them back
    if (g.phase === 'show' || g.phase === 'play' || g.phase === 'good' || g.phase === 'oops') {
      const n = g.tune.length;
      for (let k = 0; k < n; k++) {
        const x = 800 + (k - (n - 1) / 2) * 48;
        c.beginPath();
        c.arc(x, 165, 13, 0, Math.PI * 2);
        const done = g.phase === 'good' || (g.phase === 'play' && k < g.pos) || (g.phase === 'show' && k <= g.shown);
        c.fillStyle = done ? (g.phase === 'show' ? PAL.slate : PAL.magenta) : 'rgba(250,244,228,0.9)';
        c.fill();
        ink(c, 2);
      }
    }
    // cracks so far, as three little glasses under the dots (in the phone view)
    for (let k = 0; k < MAX_CRACKS; k++) {
      const x = 754 + k * 46;
      const y0 = 200;
      poly(c, [[x - 15, y0], [x + 15, y0], [x + 12, y0 + 40], [x - 12, y0 + 40]], k + 40, 0.5);
      c.fillStyle = k < g.cracks ? 'rgba(184,98,74,0.5)' : 'rgba(201,217,224,0.7)';
      c.fill();
      ink(c, 1.8);
      if (k < g.cracks) {
        c.beginPath();
        c.moveTo(x + 4, y0);
        c.lineTo(x - 4, y0 + 18);
        c.lineTo(x + 6, y0 + 38);
        ink(c, 1.6);
      }
    }

    drawGoose(c, t);
    for (let i = 0; i < g.glasses.length; i++) drawShine(c, i);
    for (let i = 0; i < g.glasses.length; i++) {
      // in your turn, the glass the Goose is at lifts a little, ringed in yellow
      const lift = g.phase === 'play' && i === g.sel;
      if (lift) {
        const x = g.glassX(i);
        c.save();
        c.globalAlpha = 0.2;
        c.beginPath();
        c.ellipse(x, TABLE + 2, GLASS_W / 2, 9, 0, 0, Math.PI * 2);
        c.fillStyle = INK;
        c.fill();
        c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
        poly(c, [[x - GLASS_W / 2 - 12, TABLE - GLASS_H - 24], [x + GLASS_W / 2 + 12, TABLE - GLASS_H - 24], [x + GLASS_W / 2 + 4, TABLE - 6], [x - GLASS_W / 2 - 4, TABLE - 6]], 70, 0.5);
        ink(c, 8, PAL.lemon);
        ink(c, 2, PAL.mustard);
        c.restore();
        c.save();
        c.translate(0, -14);
      }
      drawGlass(c, i, t);
      if (lift) c.restore();
    }
    // a marker under the glass the Goose is at, in your turn
    if (g.phase === 'play') {
      const x = g.glassX(g.sel);
      c.save();
      c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6);
      poly(c, [[x - 18, TABLE + 52], [x + 18, TABLE + 52], [x, TABLE + 26]], 50, 0.4);
      wash(c, PAL.lemon);
      ink(c, 2);
      c.restore();
    }

    for (const q of g.rings) {
      c.save();
      c.globalAlpha = q.life;
      c.beginPath();
      c.ellipse(q.x, q.y, 70 * (1.4 - q.life), 12 * (1.4 - q.life), 0, 0, Math.PI * 2);
      ink(c, 2, q.col);
      label(c, q.note, q.x + 30 - (1 - q.life) * 20, q.y - 60 - (1 - q.life) * 90, { size: 46, color: INK, weight: 700 });
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
    if (g.round <= 0 && (g.phase === 'intro' || g.phase === 'show' || g.phase === 'play')) {
      hint(c, g.phase === 'play' ? 'Move to a glass · press to tap it' : 'Watch the Goose play, then play it back', 800, 830, { focus: g.focus(), span: g.span, size: 34, weight: 600 });
    }
  };

  // On a narrow screen, keep every glass in view.
  g.focus = () => W / 2;
  g.span = 1300;

  return g;
}
