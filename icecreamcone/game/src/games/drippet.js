// The Drippet: Drip Drop Dash.
//
// The Drippet is a blue water tap on legs, and it never quite turns off: it
// drips as it runs about the kitchen, and every drip spreads into a puddle
// on the tiles. Thirsty things wait around the floor (a drooping fern, the
// cat's empty bowl, a glass, a vase of tired daisies): run to one and stand
// over it while the tap fills it. A fresh drip is harmless, but a puddle a
// moment old is slippery: run into one and the Drippet slides with momentum
// across the floor, losing time. Press the action to hop over a puddle; a
// hop lands with a splash that leaves a puddle of its own, so hopping all
// the time only floods the floor. The drips come faster and the puddles grow
// bigger and last longer as time goes on, and later two things are thirsty
// at once. Score: drinks.

import { art, drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.drippetThings': [4, 2], // fern, cat bowl, glass, daisies: thirsty (top row), refreshed (bottom row)
  'sprites.puddles': [3, 1], // three watercolour puddle shapes, seen from above at a slant
  'sprites.drippetPoses': [2, 1], // mid-hop, skidding
  'sprites.drippetMore': [2, 1], // running mid-stride, leaning over to pour
});

const DURATION = 45;
// The scale the Drippet is painted at in each pose cell, against its portrait
// (design/source/pose-scales.json; matched over the whole bird, since the
// cross handle, measured before, is foreshortened when the tap tips).
const POSE_PAINTED = { 'sprites.drippetPoses': [0.766, 0.784], 'sprites.drippetMore': [0.868, 0.846] };
// The floor, as painted in the scene: the Drippet's feet stay inside it.
const FLOOR_TOP = 560; // just below the painted skirting board
const FLOOR_BOT = 860;
const FLOOR_X0 = 110;
const FLOOR_X1 = 1490;
const SPEED = 430;
const FRESH = 1.1; // a puddle is harmless this long after its first drip
const SLIP = 2.2;
const HOP = 0.55;
const HOP_REST = 1; // no hopping again this soon after landing (and a stumble at first)
const FILL = 0.7; // seconds over a thirsty thing to fill it
const REACH = 64; // how near the tap must be
const KINDS = ['fern', 'bowl', 'glass', 'daisies'];

// Depth: things further back (smaller y) are drawn smaller.
const depth = (y) => clamp((y - FLOOR_TOP) / (FLOOR_BOT - FLOOR_TOP), 0, 1);
const scaleAt = (y) => lerp(0.78, 1.1, depth(y));

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: W / 2,
    y: 700,
    vx: 0,
    vy: 0,
    face: -1, // -1 facing left (the tap's spout on the left)
    hop: 0, // seconds left in the air
    hopRest: 0,
    slip: 0, // seconds left skidding
    spinA: 0,
    walk: 0,
    dripT: 0.3,
    drops: [], // falling: { x, y, gy, vy }
    puddles: [], // { x, y, r, max, age, life }
    things: [], // { kind, x, y, fill, wait, patience, done, perk }
    bits: [],
    pops: [],
    slips: 0,
    hops: 0,
    missed: 0,
    nextThing: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets how often the tap drips, how big puddles grow
  // and how long they last, and how long a thirsty thing waits; a second
  // thirsty thing joins after the first third. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  const dripEvery = () => knob(g.d(), 0.38, 0.29, 0.18); // seconds between drips (±15%)
  const puddleLife = () => knob(g.d(), 6, 9.2, 13); // seconds a puddle lasts
  const puddleMax = () => knob(g.d(), 32, 45, 60); // how big a puddle grows, px
  const patience = () => knob(g.d(), 12, 9.5, 6.5); // seconds a thirsty thing waits
  const wanted = () => (progress() > 1 / 3 ? 2 : 1);
  g.knobs = () => ({ drip: dripEvery(), life: puddleLife(), size: puddleMax(), patience: patience(), wanted: wanted() });

  function pop(text, x, y, color = INK, size = 44) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }

  // Where the spout is, and where its drips land.
  // The Drippet's size on screen, and where its spout's mouth is, in drawBird
  // units: measured on the painting (the stand-in's own until it loads).
  const painted = () => !!art('subject.drippet');
  g.size = (y = g.y) => (painted() ? 250 : 300) * scaleAt(y);
  const SPOUT = { painted: [163, -229], standin: [150, -135] };
  g.spout = () => {
    const [sx, sy] = SPOUT[painted() ? 'painted' : 'standin'];
    const u = g.size() / 400;
    return { x: g.x + g.face * sx * u, y: g.y + sy * u - g.hopH() };
  };
  g.hopH = () => (g.hop > 0 ? Math.sin((1 - g.hop / HOP) * Math.PI) * 70 : 0);
  // The spot on the floor a drip from the spout lands on.
  const dripSpot = () => ({ x: g.spout().x, y: g.y + 4 });

  // A puddle is slippery once it has sat a moment.
  g.slippery = (p) => p.age > FRESH && p.r > 14;
  g.inPuddle = (x, y, p) => {
    const dx = (x - p.x) / p.r;
    const dy = (y - p.y) / (p.r * 0.48);
    return dx * dx + dy * dy < 0.75;
  };
  g.puddleAt = (x, y) => g.puddles.find((p) => g.slippery(p) && g.inPuddle(x, y, p)) || null;

  function addWater(x, y, amount = 1) {
    // A drip that lands in a puddle swells it instead of making a new one.
    const p = g.puddles.find((q) => Math.hypot(x - q.x, (y - q.y) * 2) < q.r * 0.9);
    if (p) {
      p.max = Math.min(puddleMax() * 1.6, p.max + 4 * amount);
      p.life = Math.max(p.life, puddleLife());
      return p;
    }
    const q = { x, y, r: 6, max: puddleMax() * (0.8 + rng() * 0.3) * (amount > 1 ? 1.15 : 1), age: 0, life: puddleLife(), seed: Math.floor(rng() * 1000), shape: Math.floor(rng() * 3) };
    g.puddles.push(q);
    return q;
  }

  function splash(x, y, n = 8, color = '#5a8ab8') {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * rng());
      const v = 120 + rng() * 200;
      g.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rng() * 0.3, color, kind: 'drop' });
    }
  }

  function placeThing() {
    for (let tries = 0; tries < 40; tries++) {
      // the last try goes to the far side of the floor: never under the Drippet
      const x = tries === 39 ? (g.x < (FLOOR_X0 + FLOOR_X1) / 2 ? FLOOR_X1 - 90 : FLOOR_X0 + 90) : lerp(FLOOR_X0 + 90, FLOOR_X1 - 90, rng());
      const y = lerp(FLOOR_TOP + 40, FLOOR_BOT - 30, rng());
      const far = Math.hypot(x - g.x, (y - g.y) * 1.4) > 330;
      const clear = g.things.every((t) => Math.hypot(x - t.x, y - t.y) > 260);
      const dry = g.puddles.every((p) => Math.hypot(x - p.x, (y - p.y) * 2) > p.r + 60);
      if ((far && clear && dry) || tries === 39) {
        const used = g.things.map((t) => t.kind);
        const free = KINDS.filter((k) => !used.includes(k));
        const kind = free[Math.floor(rng() * free.length)] || KINDS[0];
        g.things.push({ kind, x, y, fill: 0, wait: 0, patience: patience(), done: 0, perk: 0, born: 0 });
        return;
      }
    }
  }

  function startSlip(dirx, diry) {
    g.slip = SLIP;
    g.slips++;
    // Keep the incoming momentum rather than throwing the bird sideways.
    g.vx = dirx;
    g.vy = diry;
    g.hop = 0;
    pop('Whoops!', g.x, g.y - 210, PAL.slate, 46);
    splash(g.x, g.y, 12);
    sfx('splash');
    env.vibrate?.(80);
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    // Thirsty things: keep one (later two) waiting.
    while (g.things.filter((t) => !t.over).length < wanted()) placeThing();

    // Moving.
    const px = g.x;
    const py = g.y;
    const sliding = g.slip > 0;
    g.slip = Math.max(0, g.slip - dt);
    g.spinA = sliding ? g.spinA + dt * 6 : 0;
    {
      let mx = 0;
      let my = 0;
      if (input.pointer && input.pointer.active) {
        const tx = clamp(input.pointer.x, FLOOR_X0, FLOOR_X1);
        const ty = clamp(input.pointer.y, FLOOR_TOP, FLOOR_BOT);
        const dx = tx - g.x;
        const dy = ty - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
          const s = Math.min(1, d / 90);
          mx = (dx / d) * s;
          my = (dy / d) * s;
        }
      } else {
        mx = input.x || 0;
        my = input.y || 0;
        const m = Math.hypot(mx, my);
        if (m > 1) {
          mx /= m;
          my /= m;
        }
      }
      const boost = g.hop > 0 ? 0.8 : g.hopRest > HOP_REST - 0.25 ? 0.5 : 1;
      g.vx = approach(g.vx, mx * SPEED * boost, sliding ? 1.1 : 14, dt);
      g.vy = approach(g.vy, my * SPEED * 0.8 * boost, sliding ? 1.1 : 14, dt);
      if (Math.abs(g.vx) > 40) g.face = g.vx < 0 ? -1 : 1;
      // Hop.
      g.hopRest = Math.max(0, g.hopRest - dt);
      if (input.actionPressed && g.hop <= 0 && g.hopRest <= 0) {
        g.hop = HOP;
        g.slip = 0;
        g.hops++;
        sfx('catch', { pitch: 5 });
      }
    }
    g.x = clamp(g.x + g.vx * dt, FLOOR_X0, FLOOR_X1);
    g.y = clamp(g.y + g.vy * dt, FLOOR_TOP, FLOOR_BOT);
    if (g.x === FLOOR_X0 || g.x === FLOOR_X1) g.vx *= g.slip > 0 ? -0.6 : 1;
    if (g.y === FLOOR_TOP || g.y === FLOOR_BOT) g.vy *= g.slip > 0 ? -0.6 : 1;
    g.walk += Math.hypot(g.x - px, g.y - py) / 60;

    if (g.hop > 0) {
      g.hop -= dt;
      if (g.hop <= 0) {
        // Landing: a splash of water, and a skid if it lands in a puddle.
        g.hop = 0;
        g.hopRest = HOP_REST;
        // (landing in any puddle skids, even a fresh one: it's a splash-down)
        const p = g.puddles.find((q) => q.r > 14 && g.inPuddle(g.x, g.y, q));
        addWater(g.x - g.face * 20, g.y + 2, 3);
        // and the jolt shakes a few more drips out round about
        for (let i = 0; i < 3; i++) {
          const ang = rng() * Math.PI * 2;
          const r = 80 + rng() * 80;
          addWater(clamp(g.x + Math.cos(ang) * r, FLOOR_X0, FLOOR_X1), clamp(g.y + Math.sin(ang) * r * 0.5, FLOOR_TOP, FLOOR_BOT));
        }
        sfx('plop');
        if (p) startSlip(g.vx, g.vy);
      }
    } else if (g.slip <= 0) {
      const p = g.puddleAt(g.x, g.y);
      if (p) startSlip(g.vx, g.vy);
    }

    // The tap drips.
    g.dripT -= dt;
    if (g.dripT <= 0) {
      g.dripT += dripEvery() * (0.85 + rng() * 0.3);
      const s = g.spout();
      const spot = dripSpot();
      // (while it pours, the painted pose shows the stream itself)
      if (!(g.pouring > 0 && art('sprites.drippetMore'))) g.drops.push({ x: s.x, y: s.y, gx: spot.x, gy: spot.y, vy: 0, vx: g.vx * 0.6 });
    }
    for (const d of g.drops) {
      d.vy += 2200 * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.y >= d.gy) {
        d.dead = true;
        // A drip into a thirsty thing is a sip, not a puddle.
        const t = g.things.find((t) => !t.over && Math.hypot(d.x - t.x, (d.gy - t.y) * 1.6) < REACH);
        if (!t) addWater(d.x, d.gy);
        if (rng() < 0.5) g.bits.push({ x: d.x, y: d.gy, vx: (rng() - 0.5) * 80, vy: -60 - rng() * 60, life: 0.25, color: '#5a8ab8', kind: 'drop' });
      }
    }
    g.drops = g.drops.filter((d) => !d.dead);

    // Puddles spread, sit, and dry.
    for (const p of g.puddles) {
      p.age += dt;
      p.life -= dt;
      if (p.life > 0) p.r = approach(p.r, p.max, 2.2, dt);
      else p.r -= 22 * dt;
    }
    g.puddles = g.puddles.filter((p) => p.r > 4);

    // Filling: stand still enough over a thirsty thing.
    g.pouring = Math.max(0, (g.pouring || 0) - dt);
    const spot = dripSpot();
    for (const t of g.things) {
      if (t.over) {
        t.done -= dt;
        t.perk = Math.min(1, t.perk + dt * 3);
        continue;
      }
      t.born = Math.min(1, t.born + dt * 3);
      t.wait += dt;
      // The cat doesn't like wet paws: it noses its bowl away from puddles.
      if (t.kind === 'bowl') {
        for (const q of g.puddles) {
          if (!g.slippery(q)) continue;
          const dx = t.x - q.x;
          const dy = (t.y - q.y) * 2;
          const d = Math.hypot(dx, dy);
          if (d < q.r + 70 && d > 0.01) {
            t.x = clamp(t.x + (dx / d) * 70 * dt, FLOOR_X0 + 60, FLOOR_X1 - 60);
            t.y = clamp(t.y + (dy / d) * 35 * dt, FLOOR_TOP + 30, FLOOR_BOT - 20);
            t.nudged = 0.3;
          }
        }
        t.nudged = Math.max(0, (t.nudged || 0) - dt);
      }
      const near = Math.hypot(spot.x - t.x, (spot.y - t.y) * 1.6) < REACH || Math.hypot(g.x - t.x, (g.y - t.y) * 1.6) < REACH * 0.9;
      if (near && g.hop <= 0) {
        g.pouring = 0.15;
        g.pourOn = t;
        t.fill += dt / FILL;
        if (Math.floor(t.fill * 6) !== Math.floor((t.fill - dt / FILL) * 6)) sfx('pour');
        if (t.fill >= 1) {
          t.done = 1.1;
          t.over = true;
          g.score++;
          pop('+1', t.x, t.y - 150, PAL.magenta, 48);
          sfx('ding', { pitch: (g.score % 5) * 2 });
          env.vibrate?.(25);
        }
      } else t.fill = Math.max(0, t.fill - dt * 0.6);
      if (!t.over && t.wait > t.patience) {
        t.done = 0.6;
        t.over = true;
        t.gaveUp = true;
        g.missed++;
        pop('Too late', t.x, t.y - 140, PAL.brick, 34);
        sfx('wilt');
      }
    }
    g.things = g.things.filter((t) => !t.over || t.done > 0);

    for (const b of g.bits) {
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    g.bits = g.bits.filter((b) => b.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Drinks ${g.score}`;
  g.summary = () => {
    const lines = [`${g.score} thirsty thing${g.score === 1 ? '' : 's'} given a drink.`];
    lines.push(g.slips ? `${g.slips} skid${g.slips === 1 ? '' : 's'} in a puddle.` : 'Not a single skid!');
    return lines;
  };

  // ---------- drawing ----------

  function drawFloor(c) {
    // the kitchen wall
    band(c, 0, 0, W, FLOOR_TOP - 30, '#dfe6d8', 0.7, 1);
    // a window with the rain outside
    poly(c, [[1040, 90], [1340, 90], [1340, 330], [1040, 330]], 2, 1.2);
    wash(c, '#b9cbd6', 0.8);
    ink(c, 2.4);
    c.beginPath();
    c.moveTo(1190, 90);
    c.lineTo(1190, 330);
    c.moveTo(1040, 210);
    c.lineTo(1340, 210);
    ink(c, 3, '#8a6a4a');
    c.save();
    c.globalAlpha = 0.35;
    c.beginPath();
    for (let i = 0; i < 14; i++) {
      const x = 1055 + ((i * 37) % 270);
      const y = 105 + ((i * 53) % 200);
      c.moveTo(x, y);
      c.lineTo(x - 6, y + 18);
    }
    ink(c, 1.2, '#5a7a9a');
    c.restore();
    // the sink and cupboard along the back
    poly(c, [[180, 300], [760, 300], [760, 470], [180, 470]], 4, 1.2);
    wash(c, '#c9b48a', 0.75);
    ink(c, 2.2);
    for (const x of [180, 373, 566]) {
      poly(c, [[x + 14, 318], [x + 180, 318], [x + 180, 456], [x + 14, 456]], x, 1);
      ink(c, 1.4);
      c.beginPath();
      c.arc(x + 160, 386, 5, 0, Math.PI * 2);
      ink(c, 1.4);
    }
    poly(c, [[160, 282], [780, 282], [780, 300], [160, 300]], 5, 1);
    wash(c, '#e8e0cc');
    ink(c, 2);
    // the skirting board
    poly(c, [[0, FLOOR_TOP - 34], [W, FLOOR_TOP - 34], [W, FLOOR_TOP - 14], [0, FLOOR_TOP - 14]], 6, 1);
    wash(c, '#a88a62', 0.8);
    ink(c, 1.8);
    // tiles in perspective
    c.save();
    poly(c, [[0, FLOOR_TOP - 14], [W, FLOOR_TOP - 14], [W, H], [0, H]], 7, 0.5);
    c.clip();
    c.fillStyle = '#efe6cf';
    c.fillRect(0, FLOOR_TOP - 14, W, H);
    const rows = [FLOOR_TOP - 14];
    let y = FLOOR_TOP - 14;
    let h = 46;
    while (y < H) {
      y += h;
      h *= 1.16;
      rows.push(y);
    }
    const vx = W / 2;
    const vy = -900;
    for (let r = 0; r < rows.length - 1; r++) {
      for (let i = -14; i < 14; i++) {
        if ((i + r) % 2 === 0) continue;
        const xAt = (yy, k) => vx + (k * 120 - 0) * (yy - vy) / (FLOOR_TOP + 200 - vy) + 0;
        const y0 = rows[r];
        const y1 = rows[r + 1];
        c.beginPath();
        c.moveTo(xAt(y0, i), y0);
        c.lineTo(xAt(y0, i + 1), y0);
        c.lineTo(xAt(y1, i + 1), y1);
        c.lineTo(xAt(y1, i), y1);
        c.closePath();
        c.globalAlpha = 0.55;
        c.fillStyle = '#b9c8b0';
        c.fill();
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }

  function drawPuddle(c, p) {
    const a = clamp(p.r / 20, 0, 1) * (p.life > 0 ? 1 : 0.8);
    const slick = g.slippery(p);
    c.save();
    c.globalAlpha = a * 0.85;
    const pd = spriteCell('sprites.puddles', p.shape);
    if (pd) {
      // The painted puddle, fitted to the puddle's oval (2r by about r: a
      // little taller than painted, to match where it is slippery). A fresh
      // one is faint, an old one full strength.
      const tr = pd.trim;
      c.globalAlpha = a * (slick ? 0.95 : 0.5);
      c.drawImage(pd.img, tr.x, tr.y, tr.w, tr.h, p.x - p.r * 1.05, p.y - p.r * 0.46, p.r * 2.1, p.r * 0.92);
    } else {
      blob(c, p.x, p.y, p.r, p.r * 0.48, p.seed, 0.08, 20);
      c.globalAlpha = a * (slick ? 0.62 : 0.32);
      c.fillStyle = '#6f9cc4';
      c.fill();
      c.globalAlpha = a * (slick ? 0.8 : 0.4);
      ink(c, 1.5, '#3f6f98');
      // a glint
      c.globalAlpha = a * 0.7;
      c.beginPath();
      c.ellipse(p.x - p.r * 0.3, p.y - p.r * 0.12, p.r * 0.28, p.r * 0.07, -0.1, 0, Math.PI * 2);
      c.fillStyle = '#f4f8ff';
      c.fill();
    }
    c.restore();
  }

  function drawThing(c, t, tm) {
    const k = scaleAt(t.y) * (0.6 + 0.4 * (t.born || 1));
    const perk = t.gaveUp ? 0 : t.perk;
    const fade = t.over ? clamp(t.done * 2, 0, 1) : 1;
    c.save();
    c.globalAlpha = fade;
    // a ring on the floor showing where to stand, and how full it is
    if (!t.over) {
      const urgent = t.patience - t.wait < 3;
      c.beginPath();
      c.ellipse(t.x, t.y + 4, REACH * k, REACH * 0.42 * k, 0, 0, Math.PI * 2);
      c.globalAlpha = 0.25;
      c.fillStyle = urgent && Math.sin(tm * 10) > 0 ? PAL.brick : PAL.lemon;
      c.fill();
      c.globalAlpha = 1;
      c.setLineDash([8, 8]);
      ink(c, 2, urgent ? PAL.brick : PAL.mustard);
      c.setLineDash([]);
      if (t.fill > 0) {
        c.beginPath();
        c.ellipse(t.x, t.y + 4, REACH * k, REACH * 0.42 * k, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, t.fill));
        ink(c, 6, '#3f6f98');
      }
    }
    const cell = KINDS.indexOf(t.kind) + (perk > 0.5 ? 4 : 0);
    // The painted things share one scale: each whole 512 px cell is drawn
    // 222 px tall (at depth scale 1), its painted base (about 52 px above the
    // cell's foot) on the floor. While filling, the watered one fades in.
    const pc = spriteCell('sprites.drippetThings', cell);
    if (pc) {
      const ch = 222 * k;
      const base = t.y + (52 / 512) * ch;
      const dry = KINDS.indexOf(t.kind);
      const f = t.over ? (perk > 0.5 ? 1 : 0) : clamp(t.fill, 0, 1);
      if (f < 1) drawSprite(c, 'sprites.drippetThings', dry, t.x, base, { h: ch, whole: true, alpha: 1 - f });
      if (f > 0) drawSprite(c, 'sprites.drippetThings', dry + 4, t.x, base, { h: ch, whole: true, alpha: f });
    } else {
      c.translate(t.x, t.y);
      c.scale(k * 1.3, k * 1.3);
      drawThingStandin(c, t.kind, perk, Math.min(1, t.fill), tm);
    }
    c.restore();
    // patience: a little clock of drops above it
    if (!t.over) {
      const left = clamp(1 - t.wait / t.patience, 0, 1);
      c.beginPath();
      c.moveTo(t.x, t.y - 150 * k);
      c.arc(t.x, t.y - 150 * k, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      c.closePath();
      c.fillStyle = left < 0.3 ? PAL.brick : '#6f9cc4';
      c.fill();
      c.beginPath();
      c.arc(t.x, t.y - 150 * k, 14, 0, Math.PI * 2);
      ink(c, 1.6);
    }
  }

  function drawThingStandin(c, kind, perk, fill, tm) {
    const droop = 1 - perk;
    if (kind === 'fern') {
      poly(c, [[-34, 0], [34, 0], [42, -56], [-42, -56]], 1, 1);
      wash(c, PAL.brick);
      ink(c, 2);
      for (let i = -2; i <= 2; i++) {
        const a = -Math.PI / 2 + i * 0.35 + droop * i * 0.45;
        c.beginPath();
        c.moveTo(i * 6, -56);
        c.quadraticCurveTo(i * 22, -100 + droop * 40, i * 6 + Math.cos(a) * 70, -56 + Math.sin(a) * 70 + droop * 50);
        ink(c, 6, perk > 0.5 ? PAL.green : PAL.olive);
        ink(c, 1.2);
      }
    } else if (kind === 'bowl') {
      c.beginPath();
      c.ellipse(0, -18, 50, 16, 0, 0, Math.PI);
      c.lineTo(-50, -18);
      c.closePath();
      wash(c, PAL.slate);
      ink(c, 2);
      c.beginPath();
      c.ellipse(0, -18, 50, 12, 0, 0, Math.PI * 2);
      c.fillStyle = '#e6e2d6';
      c.fill();
      ink(c, 2);
      if (fill > 0 || perk) {
        c.beginPath();
        c.ellipse(0, -18, 42 * Math.max(fill, perk), 9 * Math.max(fill, perk), 0, 0, Math.PI * 2);
        c.fillStyle = '#6f9cc4';
        c.fill();
      }
      label(c, 'CAT', 0, -2, { size: 14, weight: 800, color: '#f4ecd8' });
    } else if (kind === 'glass') {
      poly(c, [[-22, 0], [22, 0], [28, -90], [-28, -90]], 3, 0.6);
      c.fillStyle = 'rgba(220,235,240,0.6)';
      c.fill();
      ink(c, 2);
      const lvl = Math.max(fill, perk) * 70;
      if (lvl > 1) {
        poly(c, [[-21, -3], [21, -3], [21 + lvl * 0.07, -3 - lvl], [-21 - lvl * 0.07, -3 - lvl]], 4, 0.3);
        c.fillStyle = 'rgba(90,140,190,0.7)';
        c.fill();
      }
    } else {
      // a vase of daisies
      blob(c, 0, -34, 28, 34, 5, 0.04);
      wash(c, PAL.mauve);
      ink(c, 2);
      for (let i = -1; i <= 1; i++) {
        const tipx = i * 30 + droop * i * 30 - droop * 10;
        const tipy = -120 + droop * 50 + Math.abs(i) * 10;
        c.beginPath();
        c.moveTo(i * 5, -64);
        c.quadraticCurveTo(i * 12, -100, tipx, tipy);
        ink(c, 2.5, PAL.green);
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + tm * 0;
          blob(c, tipx + Math.cos(a) * 10, tipy + Math.sin(a) * 10 * (1 - droop * 0.4), 7, 4, j, 0.1, 8);
          c.fillStyle = '#fbf6e8';
          c.fill();
          ink(c, 1);
        }
        c.beginPath();
        c.arc(tipx, tipy, 5, 0, Math.PI * 2);
        c.fillStyle = PAL.lemon;
        c.fill();
      }
    }
  }

  // One painted pose cell, its painted part standing on (0, 0), centred as
  // its cell is; `k` is screen pixels per image pixel.
  function drawPose(c, key, i, k, flip) {
    const sp = spriteCell(key, i);
    if (!sp) return false;
    const { cell, trim } = sp;
    c.save();
    if (flip) c.scale(-1, 1);
    c.drawImage(sp.img, trim.x, trim.y, trim.w, trim.h, (trim.x - cell.x - cell.w / 2) * k, -trim.h * k, trim.w * k, trim.h * k);
    c.restore();
    return true;
  }

  function drawDrippet(c, t) {
    const k = scaleAt(g.y);
    const size = g.size();
    const lift = g.hopH();
    // shadow
    c.save();
    c.globalAlpha = 0.2;
    c.beginPath();
    c.ellipse(g.x + (g.drawOx || 0), g.y + 3, 52 * k * (1 - lift / 200), 12 * k, 0, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
    c.restore();
    const moving = Math.hypot(g.vx, g.vy) > 60 && g.slip <= 0 && g.hop <= 0;
    const bob = moving ? Math.abs(Math.sin(g.walk * 2.2)) * 8 : 0;
    // Skidding and hopping, then pouring, then a two-step run (the portrait
    // and the mid-stride pose by turns); standing still is the portrait.
    const flip = g.face > 0;
    let sheet = null;
    let cell = 0;
    if (g.slip > 0) [sheet, cell] = ['sprites.drippetPoses', 1];
    else if (g.hop > 0) [sheet, cell] = ['sprites.drippetPoses', 0];
    else if (g.pouring > 0) [sheet, cell] = ['sprites.drippetMore', 1];
    else if (moving && Math.sin(g.walk * 2.2) > 0) [sheet, cell] = ['sprites.drippetMore', 0];
    // Pouring, it leans over so its stream falls into the thing it fills
    // rather than standing on top of it (drawn only: where it is stays put).
    const want = g.pouring > 0 && g.pourOn ? clamp(g.pourOn.x - g.spout().x, -90, 90) : 0;
    const step = Math.min(0.1, Math.max(0, t - (g.drawT ?? t)));
    g.drawT = t;
    g.drawOx = (g.drawOx || 0) + (want - (g.drawOx || 0)) * (1 - Math.exp(-14 * step));
    c.save();
    c.translate(g.x + g.drawOx, g.y - lift - bob);
    if (g.slip > 0 && !env.reduceMotion) c.rotate(Math.sin(g.spinA) * 0.08);
    else if (moving) c.rotate(Math.sin(g.walk * 2.2) * 0.05);
    else if (g.pouring > 0 && !art(sheet)) c.rotate(g.face * 0.12);
    // The painted poses are at a little less than the portrait's scale in
    // their cells, each its own (POSE_PAINTED), so they are scaled up to
    // match; their lowest point stands on the ground.
    const pk = sheet ? ((size / 400) * (420 / 1024)) / POSE_PAINTED[sheet][cell] : 0;
    if (!sheet || !drawPose(c, sheet, cell, pk, flip)) {
      drawBird(c, 'drippet', { x: 0, y: 0, size, t, flip });
    }
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'drippet', W, H, drawFloor);

    for (const p of g.puddles) drawPuddle(c, p);

    // Things and the Drippet, back to front.
    const items = g.things.map((th) => ({ y: th.y, draw: () => drawThing(c, th, t) }));
    items.push({ y: g.y, draw: () => drawDrippet(c, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // drips in the air
    c.fillStyle = '#4f86bf';
    for (const d of g.drops) {
      c.beginPath();
      c.moveTo(d.x, d.y - 12);
      c.quadraticCurveTo(d.x + 6, d.y, d.x, d.y + 5);
      c.quadraticCurveTo(d.x - 6, d.y, d.x, d.y - 12);
      c.fill();
    }
    for (const b of g.bits) {
      c.save();
      c.globalAlpha = clamp(b.life * 3, 0, 1);
      c.beginPath();
      c.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      c.fillStyle = b.color;
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

    if (g.elapsed < 4) {
      c.save();
      c.globalAlpha = Math.min(1, 4 - g.elapsed);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = '600 34px Fraunces, Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText('Run to the thirsty things · hop over old puddles', W / 2, 872);
      hint(c, 'Run to the thirsty things · hop over old puddles', W / 2, 872, { focus: g.focus(), span: g.span, size: 34, weight: 600 });
      c.restore();
    }
  };

  g.focus = () => g.x;
  g.span = 760;

  return g;
}
