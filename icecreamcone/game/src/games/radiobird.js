// The Radio Bird: Tune In.
//
// Three little listeners sit on the sofa, and one of them calls for a
// station: the fiddle tunes, the trumpet, the drum band, the bells, the
// cuckoo clock or the weather. Turn the Radio Bird's dial through the static
// (tilt the stick or hold the arrows to sweep, spin the stick for fine
// tuning, or drag the needle along the dial). The speaker rides along under
// the needle: it crackles with static, and as a station comes near its
// picture fades in through the crackle, and the listeners lean forward when
// it's getting near the one they want. Press the action on the right one to
// play it (with a pointer, let go of the needle on it): the needle settles on
// the station by itself and the song plays for a moment. A song scores 10,
// and up to 10 more for finding it quickly. Stations you play, or rest on for
// a moment, are pencilled on the dial, but the stations drift, more and more
// as time goes on, and get narrower too. Score: points.

import { art, drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint as showHint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.stations': [3, 2], // fiddle, trumpet, drum, bells, cuckoo clock, rain cloud
  'sprites.listeners': [3, 2], // three little birds: waiting (top row), delighted (bottom row)
  'sprites.dialPanel': [1, 1], // the long tuning-dial window
  'sprites.radiobirdPoses': [3, 1], // listening through the static, singing, startled
  'sprites.radioParts': [2, 1], // the speaker cabinet (its round grille left open), the tuning knob
});

const DURATION = 50;
const STATIONS = [
  { name: 'fiddle', color: '#b0703a', tune: [0, 4, 7, 4, 9, 7, 4, 2] },
  { name: 'trumpet', color: PAL.mustard, tune: [0, 0, 7, 7, 9, 9, 7, 5] },
  { name: 'drum', color: PAL.brick, tune: [0, 0, 0, 12, 0, 0, 12, 0] },
  { name: 'bells', color: PAL.lemon, tune: [12, 7, 9, 4, 12, 9, 7, 4] },
  { name: 'cuckoo', color: PAL.green, tune: [7, 4, 7, 4, 7, 4, 0, 0] },
  { name: 'weather', color: PAL.slate, tune: [0, 2, 3, 2, 0, -2, 0, 3] },
];
// The dial window, and where the needle's frequency 0..1 sits in it.
// (measured on the painted dial panel, drawn 1000 px wide: its brass bezel
// spans about x 530..1530, y 125..250, its cream face y 146..227)
const DIAL = { x0: 560, x1: 1500, y0: 125, y1: 250 };
const FACE = { y0: 146, y1: 227 };
const fx = (f) => lerp(DIAL.x0 + 30, DIAL.x1 - 30, f);
const xf = (x) => (x - DIAL.x0 - 30) / (DIAL.x1 - DIAL.x0 - 60);
const SONG = 1.8; // seconds of clear signal for a song
const SNAP = 3; // how fast the needle settles on a station near it
const SWEEP = 0.5; // dial widths per second at full tilt
const RADIO = { x: 300, y: 800, size: 520 };
const CARD = { y: 395, w: 230, h: 210 }; // the speaker that rides under the needle
// The sofa, as painted in the scene: its middle, and its seat's front edge.
const SOFA = { x: 1150, y: 680 };
const SEATS = [-225, 8, 233]; // the three cushions, from the sofa's middle
const BUBBLE = { x: 1290, y: 445 }; // the middle listener's speech bubble

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    n: 0.5, // the needle
    stations: [],
    want: 0, // the station asked for
    song: 0, // how far through its song, 0..1
    noteT: 0,
    noteI: 0,
    marks: {}, // station index -> where it was found
    wrongT: 0,
    wrongSaid: -1,
    cheer: 0,
    asked: 0,
    staticT: 0,
    knob: 0,
    pops: [],
    notes: [], // floating music notes
    found: 0,
    listenT: 0,
    locked: false, // a song is playing
    lostT: 0,
    grumble: 0, // the listeners grumbling at a wrong station
    findT: 0, // seconds since they asked
    restT: 0, // seconds resting on the same station, to pencil it
    restOn: -1,
    lastFind: 0,
    songs: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets how narrow the stations are and how far and fast
  // they drift from where they were pencilled. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  const width = () => knob(g.d(), 0.05, 0.039, 0.025); // a station's half-width, share of the dial
  g.width = width;
  g.drift = () => knob(g.d(), 0.008, 0.02, 0.034); // how far a station wanders, share of the dial
  g.wander = () => knob(g.d(), 0.45, 0.72, 1.05); // how fast it wanders, times its own rate

  // Spread the six stations across the dial, apart from each other.
  const order = STATIONS.map((_, i) => i).sort(() => rng() - 0.5);
  const slots = order.map((_, i) => (i + 0.5) / STATIONS.length);
  order.forEach((si, k) => {
    g.stations[si] = { base: clamp(slots[k] + (rng() - 0.5) * 0.08, 0.04, 0.96), phase: rng() * Math.PI * 2, rate: 0.5 + rng() * 0.6 };
  });
  g.freq = (i) => {
    const s = g.stations[i];
    return clamp(s.base + g.drift() * Math.sin(g.elapsed * s.rate * g.wander() + s.phase), 0.02, 0.98);
  };
  // How clearly station i comes in at the needle: 1 dead on, 0 off it.
  g.clarity = (i, n = g.n) => clamp(1 - Math.abs(n - g.freq(i)) / width(), 0, 1);
  // The strongest station near the needle, and the meter's reading (which
  // stirs a little before a station is reached).
  g.best = () => {
    let bi = -1;
    let bq = 0;
    g.stations.forEach((_, i) => {
      const q = g.clarity(i);
      if (q > bq) {
        bq = q;
        bi = i;
      }
    });
    return { i: bi, q: bq };
  };
  g.signal = () => {
    let s = 0;
    g.stations.forEach((_, i) => {
      const d = Math.abs(g.n - g.freq(i)) / width();
      s = Math.max(s, d < 1 ? 0.35 + 0.65 * (1 - d) : clamp(0.35 * (1 - (d - 1) / 3), 0, 0.35));
    });
    return s;
  };
  // The station tuned in well enough to hear, or -1.
  g.tuned = () => {
    const b = g.best();
    return b.q > 0.45 ? b.i : -1;
  };

  // How near the needle is to station i, 0 (far) .. 1 (on it), over a wider
  // range than `clarity`: the picture fades in, the listeners lean.
  g.near = (i) => clamp(1 - Math.abs(g.n - g.freq(i)) / (width() * 4), 0, 1);
  // The station nearest the needle.
  g.nearest = () => {
    let bi = 0;
    g.stations.forEach((_, i) => {
      if (Math.abs(g.freq(i) - g.n) < Math.abs(g.freq(bi) - g.n)) bi = i;
    });
    return bi;
  };
  function mark(i) {
    if (g.marks[i] === undefined) g.found++;
    g.marks[i] = g.freq(i);
  }

  // The speaker grille on the Radio Bird's body, where its music comes out:
  // measured on the painting (the stand-in's own until it loads).
  const grille = () => {
    const [ux, uy] = art('subject.radiobird') ? [24, -166] : [-20, -175];
    const u = RADIO.size / 400;
    return [RADIO.x + ux * u, RADIO.y + uy * u];
  };

  function pop(text, x, y, color = INK, size = 42) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  function ask() {
    let k = g.want;
    while (k === g.want) k = Math.floor(rng() * STATIONS.length);
    if (g.asked === 0) {
      // The first request: a station not too far from where the needle starts.
      const near = g.stations.map((s, i) => [Math.abs(s.base - g.n), i]).sort((a, b) => a[0] - b[0]);
      k = near[1][1];
    }
    g.want = k;
    g.asked++;
    g.song = 0;
    g.locked = false;
    g.findT = 0;
    g.wrongSaid = -1;
  }
  ask();

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    g.findT += dt;
    g.pointerUser = !!(input.pointer && input.pointer.active);
    g.grumble = Math.max(0, g.grumble - dt);

    // Turning the dial: the stick or arrows sweep it, a spin turns it finely,
    // a pointer drags it. Left alone near a station, it settles on it.
    const before = g.n;
    const p = input.pointer;
    let touched = false;
    if (p && p.active && p.down) {
      g.n = approach(g.n, clamp(xf(p.x), 0, 1), 14, dt);
      touched = true;
    } else {
      const x = input.x || 0;
      g.n += x * Math.abs(x) * SWEEP * dt;
      g.n += (input.spin || 0) * 0.018;
      touched = Math.abs(x) > 0.15 || Math.abs(input.spin || 0) > 0.01;
    }
    if (!touched) {
      const k = g.nearest();
      if (Math.abs(g.freq(k) - g.n) < width() * 1.4) g.n = approach(g.n, g.freq(k), SNAP, dt);
    }
    g.n = clamp(g.n, 0, 1);
    g.knob += (g.n - before) * 40;

    const tuned = g.tuned();
    // Resting on a station for a moment pencils it on the dial.
    if (tuned >= 0 && tuned === g.restOn) {
      g.restT += dt;
      if (g.restT > 1) mark(tuned);
    } else {
      g.restOn = tuned;
      g.restT = 0;
    }

    // Choosing a station: the action, or letting go of the needle.
    const pointing = p && p.active;
    const choose = pointing ? input.actionReleased : input.actionPressed;
    if (pointing && input.actionReleased) g.releaseT = 0.6;
    g.releaseT = Math.max(0, (g.releaseT || 0) - dt);
    // (let go just beside it, and it counts once the needle settles on it)
    const settled = pointing && g.releaseT > 0 && !touched && tuned === g.want;
    if ((choose || settled) && !g.locked && g.grumble <= 0) {
      if (tuned === g.want) {
        g.locked = true;
        g.lostT = 0;
        g.lastFind = g.findT;
        mark(tuned);
        sfx('ding', { pitch: 7 });
      } else if (tuned >= 0) {
        mark(tuned);
        g.grumble = 0.7;
                pop('Not that one!', clamp(fx(g.n), 300, W - 300), CARD.y + CARD.h / 2 + 40, PAL.brick, 34);
        sfx('wrong');
        env.vibrate?.(40);
      } else sfx('tick');
    }

    if (g.locked) {
      const q = tuned === g.want ? g.clarity(tuned) : 0;
      if (q > 0) {
        g.lostT = 0;
        g.song = Math.min(1, g.song + dt / SONG);
        g.noteT -= dt;
        if (g.noteT <= 0) {
          const st = STATIONS[g.want];
          g.noteT = 0.3;
          sfx('note', { freq: 392 * Math.pow(2, st.tune[g.noteI % st.tune.length] / 12), dur: 0.26 });
          g.noteI++;
          const [gx, gy] = grille();
          g.notes.push({ x: gx + (rng() - 0.5) * 60, y: gy - 40, vx: 60 + rng() * 60, vy: -50 - rng() * 30, life: 1.6, color: st.color });
        }
        if (g.song >= 1) {
          const quick = clamp(Math.round(10 - g.lastFind * 1.25), 0, 10);
          g.score += 10 + quick;
          g.songs++;
          g.cheer = 1.2;
          const where = clamp(fx(g.n), 300, W - 300);
          pop(quick >= 7 ? 'Quick!' : 'Hooray!', BUBBLE.x, BUBBLE.y - 80, PAL.magenta, 48);
          pop('+' + (10 + quick), where, CARD.y + CARD.h / 2 + 40, PAL.magenta, 44);
          sfx('right');
          env.vibrate?.(30);
          ask();
        }
      } else {
        g.lostT += dt;
        if (g.lostT > 0.5) {
          g.locked = false;
          g.song = 0;
          pop('Lost it!', clamp(fx(g.n), 300, W - 300), CARD.y + CARD.h / 2 + 40, PAL.brick, 34);
          sfx('miss');
        }
      }
    } else if (tuned < 0) {
      // static while the dial turns between stations
      g.staticT -= Math.abs(g.n - before) * 40 + dt * 0.5;
      if (g.staticT <= 0) {
        sfx('pour');
        g.staticT = 1;
      }
    }
    g.cheer = Math.max(0, g.cheer - dt);
    // Turning through the static, the Radio Bird cocks its head to listen.
    g.listenT = tuned < 0 && Math.abs(g.n - before) > 0.0003 ? 0.6 : Math.max(0, g.listenT - dt);

    for (const n of g.notes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.life -= dt;
    }
    g.notes = g.notes.filter((n) => n.life > 0);
    for (const o of g.pops) {
      o.life -= dt;
      o.y -= 36 * dt;
    }
    g.pops = g.pops.filter((o) => o.life > 0);
  };

  g.hud = () => `Points ${g.score}`;
  g.summary = () => [
    `${g.songs} song${g.songs === 1 ? '' : 's'} played for the listeners.`,
    `${Object.keys(g.marks).length} of ${STATIONS.length} stations found on the dial.`,
  ];

  // ---------- drawing ----------

  function drawRoom(c) {
    band(c, 0, 0, W, 600, '#e6d3b0', 0.7, 4);
    // wallpaper stripes
    c.save();
    c.globalAlpha = 0.12;
    for (let x = 0; x < W; x += 60) {
      c.fillStyle = PAL.mauve;
      c.fillRect(x, 0, 22, 600);
    }
    c.restore();
    // a lamp's warm glow
    const grd = c.createRadialGradient(1480, 380, 10, 1480, 380, 420);
    grd.addColorStop(0, 'rgba(255,220,140,0.45)');
    grd.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = grd;
    c.fillRect(1000, 0, 600, 800);
    // the floor and rug
    band(c, 0, 600, W, 300, '#a9865a', 0.7, 5);
    blob(c, 700, 790, 560, 70, 3, 0.03);
    wash(c, PAL.dusty, 0.55);
    ink(c, 1.4);
  }

  function drawStationIcon(c, i, x, y, s = 1, alpha = 1) {
    c.save();
    c.globalAlpha *= alpha;
    // the painted emblem, fitted inside a 90 x 90 box (times s)
    const sp = spriteCell('sprites.stations', i);
    if (sp) {
      const fit = (90 * s) / Math.max(sp.trim.w, sp.trim.h);
      drawSprite(c, 'sprites.stations', i, x, y, { w: sp.trim.w * fit, anchor: 'center' });
      c.restore();
      return;
    }
    c.translate(x, y);
    c.scale(s, s);
    const st = STATIONS[i];
    if (st.name === 'fiddle') {
      blob(c, 0, 14, 22, 26, 1, 0.04);
      wash(c, st.color);
      ink(c, 2);
      blob(c, 0, -18, 17, 18, 2, 0.04);
      wash(c, st.color);
      ink(c, 2);
      c.beginPath();
      c.moveTo(0, -36);
      c.lineTo(0, -56);
      ink(c, 5, INK);
      c.beginPath();
      c.moveTo(-34, 30);
      c.lineTo(34, -40);
      ink(c, 2);
    } else if (st.name === 'trumpet') {
      poly(c, [[-36, -6], [12, -6], [36, -24], [36, 24], [12, 6], [-36, 6]], 3, 0.6);
      wash(c, st.color);
      ink(c, 2);
      for (const k of [-16, -6, 4]) {
        c.beginPath();
        c.moveTo(k, -6);
        c.lineTo(k, -18);
        ink(c, 3);
      }
    } else if (st.name === 'drum') {
      c.beginPath();
      c.ellipse(0, -16, 32, 10, 0, 0, Math.PI * 2);
      c.fillStyle = '#f4ecd8';
      c.fill();
      ink(c, 2);
      poly(c, [[-32, -16], [32, -16], [32, 22], [-32, 22]], 4, 0.6);
      wash(c, st.color);
      ink(c, 2);
      c.beginPath();
      c.moveTo(-32, -10);
      for (let k = 0; k < 6; k++) c.lineTo(-32 + (k + 0.5) * 64 / 6, k % 2 ? -8 : 18);
      ink(c, 1.4);
    } else if (st.name === 'bells') {
      for (const dx of [-18, 18]) {
        poly(c, [[dx - 8, -28], [dx + 8, -28], [dx + 20, 18], [dx - 20, 18]], dx, 1);
        wash(c, st.color);
        ink(c, 2);
        c.beginPath();
        c.arc(dx, 22, 5, 0, Math.PI * 2);
        c.fillStyle = INK;
        c.fill();
      }
    } else if (st.name === 'cuckoo') {
      poly(c, [[-26, 30], [26, 30], [26, -10], [0, -38], [-26, -10]], 5, 0.8);
      wash(c, '#b0703a');
      ink(c, 2);
      c.beginPath();
      c.arc(0, 4, 13, 0, Math.PI * 2);
      c.fillStyle = '#f4ecd8';
      c.fill();
      ink(c, 1.6);
      blob(c, -4, -22, 9, 7, 1, 0.05);
      wash(c, st.color);
      ink(c, 1.4);
    } else {
      blob(c, 0, -10, 34, 20, 6, 0.08);
      wash(c, '#c8ccd2');
      ink(c, 2);
      c.fillStyle = st.color;
      for (const dx of [-16, 0, 16]) {
        c.beginPath();
        c.moveTo(dx, 16);
        c.quadraticCurveTo(dx + 5, 26, dx, 30);
        c.quadraticCurveTo(dx - 5, 26, dx, 16);
        c.fill();
      }
    }
    c.restore();
  }

  function drawDial(c, t) {
    const { x0, x1, y0, y1 } = DIAL;
    if (!drawSprite(c, 'sprites.dialPanel', 0, (x0 + x1) / 2, (y0 + y1) / 2, { w: 1000, anchor: 'center' })) {
      poly(c, [[x0 - 30, y0], [x1 + 30, y0], [x1 + 30, y1], [x0 - 30, y1]], 1, 1);
      wash(c, '#c9a24a');
      ink(c, 2.4);
      poly(c, [[x0 - 8, FACE.y0], [x1 + 8, FACE.y0], [x1 + 8, FACE.y1], [x0 - 8, FACE.y1]], 2, 0.8);
      wash(c, '#f3e6c4');
      ink(c, 2);
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = fx(i / 40);
        c.moveTo(x, FACE.y1 - 4);
        c.lineTo(x, FACE.y1 - (i % 5 ? 18 : 32));
      }
      ink(c, 1.6);
    }
    // the pencil marks of stations found
    for (const [k, f] of Object.entries(g.marks)) {
      const x = fx(f);
      c.save();
      c.globalAlpha = 0.75;
      drawStationIcon(c, +k, x, FACE.y0 + 20, 0.38);
      c.beginPath();
      c.moveTo(x, FACE.y0 + 38);
      c.lineTo(x, FACE.y0 + 46);
      ink(c, 1.4, '#6a6a6a');
      c.restore();
    }
    // the needle
    const nx = fx(g.n);
    c.beginPath();
    c.moveTo(nx, FACE.y0 + 2);
    c.lineTo(nx, FACE.y1 - 2);
    ink(c, 5, '#c0302a');
    // the knob
    c.save();
    c.translate(x0 - 82, (y0 + y1) / 2); // the knob, at the left end (the painted lamp stands at the right)
    if (spriteCell('sprites.radioParts', 1)) {
      drawSprite(c, 'sprites.radioParts', 1, 0, 0, { h: 92, anchor: 'center', rot: g.knob });
      c.restore();
      return;
    }
    c.beginPath();
    c.arc(0, 0, 44, 0, Math.PI * 2);
    c.fillStyle = '#7a5a3a';
    c.fill();
    ink(c, 2.4);
    c.rotate(g.knob);
    for (let i = 0; i < 12; i++) {
      c.rotate(Math.PI / 6);
      c.beginPath();
      c.moveTo(30, 0);
      c.lineTo(42, 0);
      ink(c, 2, '#e6d3b0');
    }
    c.beginPath();
    c.arc(0, -24, 6, 0, Math.PI * 2);
    c.fillStyle = '#e6d3b0';
    c.fill();
    c.restore();
  }

  // The speaker riding under the needle: static, the nearest station's
  // picture fading in through it as the needle comes near, and the station
  // they want in a little tag, so everything to watch stays by the needle.
  g.cardX = () => clamp(fx(g.n), DIAL.x0 + CARD.w / 2 - 10, DIAL.x1 - CARD.w / 2 + 10);
  function drawRider(c, t) {
    const nx = fx(g.n);
    const x = g.cardX();
    const y = CARD.y;
    c.beginPath();
    c.moveTo(nx, DIAL.y1 + 4);
    c.lineTo(x, y - CARD.h / 2);
    ink(c, 3, '#c0302a');
    const cab = spriteCell('sprites.radioParts', 0);
    if (!cab) {
      poly(c, [[x - CARD.w / 2, y - CARD.h / 2], [x + CARD.w / 2, y - CARD.h / 2], [x + CARD.w / 2, y + CARD.h / 2], [x - CARD.w / 2, y + CARD.h / 2]], 4, 1);
      wash(c, '#c7a86a');
      ink(c, 2.4);
    }
    const sx = x + 22;
    const sy = y + 6;
    c.beginPath();
    c.arc(sx, sy, 72, 0, Math.PI * 2);
    c.fillStyle = '#e9dcb8';
    c.fill();
    ink(c, 2.2);
    const k = g.nearest();
    const near = g.near(k);
    c.save();
    c.beginPath();
    c.arc(sx, sy, 68, 0, Math.PI * 2);
    c.clip();
    hatch(c, sx - 72, sy - 72, sx + 72, sy + 72, 9, 0.25, 1);
    drawStationIcon(c, k, sx, sy, 1.15, near * near);
    // static: thick far from a station, thinning as one comes in
    const flecks = Math.round(70 * (1 - near));
    c.fillStyle = 'rgba(60,50,40,0.6)';
    for (let i = 0; i < flecks; i++) {
      const a = Math.sin(i * 12.9 + t * 37) * 0.5 + 0.5;
      const b = Math.sin(i * 78.2 + t * 53) * 0.5 + 0.5;
      c.fillRect(sx - 64 + a * 128, sy - 64 + b * 128, 4, 4);
    }
    c.restore();
    // the painted cabinet goes over the speaker's contents: its round grille
    // opening (requested centred 60% across and 53% down, 62% of its width
    // across, the cabinet 230 x 210) frames them
    if (cab) drawSprite(c, 'sprites.radioParts', 0, x, y + CARD.h / 2, { w: CARD.w, h: CARD.h });
    if (g.locked || g.song > 0) {
      c.beginPath();
      c.arc(sx, sy, 80, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.song);
      ink(c, 9, STATIONS[g.want].color);
    }
    // the tag: what they want
    const tx = x - CARD.w / 2 + 6;
    const ty = y - CARD.h / 2 + 6;
    blob(c, tx, ty, 40, 36, 5, 0.05);
    c.fillStyle = 'rgba(250,246,234,0.97)';
    c.fill();
    ink(c, 2);
    drawStationIcon(c, g.want, tx, ty, 0.62);
    // a hint: press to play, when the wanted station is in
    if (!g.locked && g.tuned() === g.want && Math.sin(t * 8) > -0.3) {
      label(c, g.pointerUser ? 'let go!' : 'press!', x, y + CARD.h / 2 + 30, { size: 30, weight: 800, color: PAL.magenta });
    }
  }

  function listener(c, i, x, y, t) {
    const happy = g.cheer > 0 || (g.locked && g.song > 0.05);
    const sway = happy ? Math.sin(t * 5 + i) * 0.12 : 0;
    const lean = happy ? 0 : -0.35 * g.near(g.want);
    c.save();
    c.translate(x, y);
    c.rotate(sway + lean);
    // The painted listeners share one scale: each whole 512 px cell drawn
    // 195 px tall, its painted feet (about 52 px above the cell's foot) on
    // the cushion, so the singing row's notes don't shrink the birds.
    if (!drawSprite(c, 'sprites.listeners', i + (happy ? 3 : 0), 0, (52 / 512) * 195, { h: 195, whole: true })) {
      const cols = [PAL.lemon, PAL.sage, PAL.strawberry];
      blob(c, 0, -50, 44, 48, i + 2, 0.05);
      wash(c, cols[i]);
      ink(c, 2);
      if (happy) {
        c.beginPath();
        c.arc(-16, -66, 8, Math.PI * 1.1, Math.PI * 1.9);
        ink(c, 2.2);
      } else {
        c.beginPath();
        c.arc(-16, -66, 9, 0, Math.PI * 2);
        c.fillStyle = '#fff';
        c.fill();
        ink(c, 1.6);
        c.beginPath();
        c.arc(-19, -66, 3, 0, Math.PI * 2);
        c.fillStyle = INK;
        c.fill();
      }
      poly(c, [[-38, -56], [-66, -48], [-38, -44]], i, 0.5);
      wash(c, PAL.ochre);
      ink(c, 1.6);
    }
    c.restore();
  }

  g.draw = (c, t) => {
    const painted = scene(c, 'radiobird', W, H, drawRoom);

    // The sofa (painted in the scene once it arrives) and the listeners.
    if (!painted) {
      poly(c, [[SOFA.x - 370, SOFA.y - 250], [SOFA.x + 370, SOFA.y - 250], [SOFA.x + 370, SOFA.y - 60], [SOFA.x - 370, SOFA.y - 60]], 7, 2);
      wash(c, PAL.sage, 0.85);
      ink(c, 2.4);
      poly(c, [[SOFA.x - 400, SOFA.y - 80], [SOFA.x + 400, SOFA.y - 80], [SOFA.x + 400, SOFA.y], [SOFA.x - 400, SOFA.y]], 8, 2);
      wash(c, PAL.olive, 0.85);
      ink(c, 2.4);
    }
    SEATS.forEach((dx, i) => listener(c, i, SOFA.x + dx, SOFA.y - 72, t));

    // The request bubble, with the song's progress round it.
    const bx = BUBBLE.x;
    const by = BUBBLE.y;
    poly(c, [[bx - 50, by + 20], [bx - 30, by + 40], [bx - 95, by + 75]], 3, 0.8);
    c.fillStyle = 'rgba(250,246,234,0.97)';
    c.fill();
    ink(c, 2);
    blob(c, bx, by, 66, 54, 9, 0.04);
    c.fillStyle = 'rgba(250,246,234,0.97)';
    c.fill();
    ink(c, 2.4);
    drawStationIcon(c, g.want, bx, by, 0.85);

    drawDial(c, t);
    drawRider(c, t);

    // The Radio Bird itself: it sings (and sways) when the right station
    // plays or the listeners cheer, starts back at a wrong station, cocks
    // its head to listen while the dial turns through the static, and
    // otherwise stands as in its portrait.
    const tuned = g.tuned();
    const playing = (g.locked && tuned === g.want) || g.cheer > 0;
    const startled = g.grumble > 0;
    const cell = playing ? 1 : startled ? 2 : g.listenT > 0 ? 0 : -1;
    const bob = playing && !env.reduceMotion ? Math.sin(t * 8) * 0.03 : 0;
    c.save();
    c.translate(RADIO.x, RADIO.y);
    c.rotate(bob);
    // The painted poses are a little smaller in their cells than the portrait
    // (the startled bird stands 810 px tall to the portrait's 868), so they
    // are all drawn at one scale, 0.57 screen px per image px at this size,
    // their feet on the rug and centred as in their cells.
    const ps = cell >= 0 && spriteCell('sprites.radiobirdPoses', cell);
    if (ps) {
      const k = (RADIO.size / 400) * (420 / 1024) * (868 / 810);
      const { cell: cl, trim } = ps;
      c.drawImage(ps.img, trim.x, trim.y, trim.w, trim.h, (trim.x - cl.x - cl.w / 2) * k, -trim.h * k, trim.w * k, trim.h * k);
    } else {
      // the stand-in: a lean for listening, a jolt back when startled
      if (cell === 0) c.rotate(-0.05);
      if (cell === 2 && !env.reduceMotion) c.translate(Math.sin(t * 40) * 3, 0);
      drawBird(c, 'radiobird', { x: 0, y: 0, size: RADIO.size, t });
    }
    c.restore();

    for (const n of g.notes) {
      c.save();
      c.globalAlpha = clamp(n.life, 0, 1);
      label(c, '♪', n.x, n.y, { size: 40, color: n.color, weight: 800, font: 'Georgia, serif' });
      c.restore();
    }

    for (const o of g.pops) {
      c.save();
      c.globalAlpha = Math.min(1, o.life * 2);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${o.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(o.text, o.x, o.y);
      label(c, o.text, o.x, o.y, { size: o.size, color: o.color, weight: 800 });
      c.restore();
    }

    if (g.elapsed < 4.5) {
      c.save();
      c.globalAlpha = Math.min(1, 4.5 - g.elapsed);
      const msg = g.pointerUser ? 'Drag the needle to their station · let go on it' : 'Turn the dial to their station · press to play it';
      showHint(c, msg, clamp(g.cardX(), 380, W - 380), 575, { focus: g.focus(), span: g.span, size: 30 });
      c.restore();
    }
  };

  g.focus = () => fx(g.n);
  g.span = 760;

  return g;
}
