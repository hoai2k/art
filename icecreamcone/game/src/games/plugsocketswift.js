// Plugsocket Swift: Lights On.
//
// Dusk falls on a tall house with twelve windows. One by one the little
// creatures inside go to their window and ask for a light (a bulb in a
// bubble, with a ring that runs down). The Swift zips from window to window:
// press the action at an asking window to plug its lamp in. The creature
// reads by it, and when its book is done it falls asleep (one point: a room
// lit). A sleeper's lamp is still on, so press again to unplug it.
//
// The fuse box on the garden wall shows how many lamps are on. Three is
// safe; a fourth makes the fuse warm up, and more make it heat fast. When it
// blows, every lamp goes out, the readers give up, and nothing plugs in
// until the Swift flies to the fuse box and flips it back. A creature kept
// waiting too long gives up too. Requests come faster, and the books get
// longer, as dusk turns to night. Score: rooms lit.

import { art, drawBird, drawSprite, SHEETS, scene, band, blob, poly, wash, ink, hatch, label, hint, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.swiftHouse': [3, 2], // dark window, asking, reading by a lamp, asleep with the lamp on, fuse box, fuse box blown
  'sprites.swiftPoses': [3, 1], // in flight; plugging in (diving, bulb blazing); singed (bulb out, feathers ruffled)
});

const DURATION = 45;
const COLS = [530, 710, 890, 1070];
const ROWS = [320, 497, 674]; // under the painted eaves (y 230) and above the lawn (790)
const WIN_W = 124;
const WIN_H = 132;
const GROUND = 800;
const FUSE = { x: 255, y: 600 }; // on the blank patch of the painted garden wall
const FUSE_HIT = { x0: FUSE.x - 110, x1: FUSE.x + 110, y0: FUSE.y - 170, y1: FUSE.y + 190 };
const SAFE = 3; // lamps the fuse carries without warming
const SIZE = 190; // the Swift
// In the pose sheet (three 1024 px cells: flying, plugging in, singed): the
// socket's offset from each cell's centre, and the bulb's from the socket.
const POSE_SOCKET = [[-135, 144], [-4, 116], [-32, 116]];
const POSE_BULB = [[-56, -237], [-232, -42], [-84, -223]];
const PK = (SIZE * 1.5) / 1024; // the poses are drawn at this scale
// The beak's tip in each cell, measured on the PNG's alpha (the farthest
// opaque pixel of the beak): flying (107, 442), plugging in (195, 784),
// singed (191, 464). As an offset from the socket, in screen px, facing left.
const POSE_BEAK_PX = [[107, 442], [195, 784], [191, 464]];
export const POSE_BEAK = POSE_BEAK_PX.map(([bx, by], i) => [(bx - 512 - POSE_SOCKET[i][0]) * PK, (by - 512 - POSE_SOCKET[i][1]) * PK]);
// What the beak (or the socket, or the pointer) can touch. A window: its
// pane with a margin. Its request bubble, while it asks: a circle over the
// drawn bubble and timer ring (radius 34, ring 6 wide) with a margin. The
// fuse box: everything drawn for it, the FUSE card at the top (y - 154) to
// the box's foot (y + 175), with a margin, so its switch counts.
const WIN_HIT = { x: WIN_W / 2 + 28, y: WIN_H / 2 + 26 };
const BUBBLE_UP = WIN_H / 2 + 34; // the bubble's centre above the window's
const BUBBLE_R = 52;
const CREATURES = ['#c9a080', '#a9b0b8', '#d9b0a0', '#b8a070']; // mouse, rabbit, hedgehog, mole: their fur in the dark

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 800,
    y: 470,
    vx: 0,
    vy: 0,
    face: -1, // -1 facing left (as drawn), 1 right
    rooms: [],
    heat: 0,
    blown: false,
    blownT: 0,
    pending: null,
    spawnT: 0.6,
    flash: 0,
    shake: 0,
    pops: [],
    sparks: [],
    served: 0,
    gaveUp: 0,
    fuses: 0,
    unplugged: 0,
  };
  ROWS.forEach((y, r) => COLS.forEach((x, c) => g.rooms.push({ i: g.rooms.length, x, y, state: 'dark', t: 0, cool: rng() * 1.5, patience: 8, readT: 3, prog: 0, who: (r * 4 + c * 3) % 4, mood: 0 })));

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets how often windows ask, how long a creature
  // waits, and how long its book is (longer books keep more lamps on, which
  // is what heats the fuse). Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.askGap = () => knob(g.d(), 2.5, 1.65, 0.6); // seconds between requests (±20%)
  g.patienceNow = () => knob(g.d(), 9.5, 7.4, 4.8); // seconds a window asks before giving up (±10%)
  g.readNow = () => knob(g.d(), 3, 4.5, 6.3); // seconds a reader reads, plus up to 1.5
  function pop(text, x, y, color = INK, size = 34) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }
  // Lamps on: readers and sleepers.
  g.load = () => g.rooms.filter((r) => r.state === 'lit' || r.state === 'sleep').length;
  g.asking = () => g.rooms.filter((r) => r.state === 'ask');
  g.sleepers = () => g.rooms.filter((r) => r.state === 'sleep');
  g.fuse = FUSE;

  // What a point (the beak, the socket, or the pointer) is over: a window
  // (its pane, or its request bubble while it asks) or the fuse box.
  function targetAt(px, py) {
    if (px > FUSE_HIT.x0 && px < FUSE_HIT.x1 && py > FUSE_HIT.y0 && py < FUSE_HIT.y1) return 'fuse';
    let best = null;
    let bd = Infinity;
    for (const r of g.rooms) {
      const dx = Math.abs(px - r.x);
      const dy = Math.abs(py - r.y);
      if (dx < WIN_HIT.x && dy < WIN_HIT.y && dx + dy < bd) {
        best = r;
        bd = dx + dy;
      }
      if (r.state === 'ask') {
        const d = Math.hypot(px - r.x, py - (r.y - BUBBLE_UP));
        if (d < BUBBLE_R && d < bd) {
          best = r;
          bd = d;
        }
      }
    }
    return best;
  }
  g.targetAt = targetAt;
  const where = (tg) => (tg === 'fuse' ? FUSE : tg);
  // The pose being drawn, and the tip of its beak on screen.
  g.pose = () => (g.blown ? 2 : g.flash > 0 ? 1 : 0);
  g.beak = () => {
    const [bx, by] = POSE_BEAK[g.pose()];
    return { x: g.x + (g.face > 0 ? -bx : bx), y: g.y + by };
  };
  // Whether pressing now would do something at this target.
  const useful = (tg) => (tg === 'fuse' ? g.blown : !!tg && tg.state !== 'dark');
  // What the Swift is touching: the beak's target first, then the socket's
  // (the body), preferring whichever a press would act on.
  function reach() {
    const b = g.beak();
    const hits = [targetAt(b.x, b.y), targetAt(g.x, g.y)].filter(Boolean);
    return hits.find(useful) || hits[0] || null;
  }
  g.reach = reach;
  const touching = (tg) => {
    const b = g.beak();
    return targetAt(b.x, b.y) === tg || targetAt(g.x, g.y) === tg || Math.hypot(where(tg).x - g.x, where(tg).y - g.y) < 60;
  };

  function giveUp(r, text = 'Too dark!') {
    r.state = 'dark';
    r.cool = 2 + rng() * 2;
    r.mood = -1.2;
    g.gaveUp++;
    pop(text, r.x, r.y - WIN_H / 2 - 30, PAL.brick, 30);
  }

  function blow() {
    g.blown = true;
    g.blownT = 0;
    g.fuses++;
    g.heat = 1;
    g.shake = 0.5;
    for (const r of g.rooms) {
      if (r.state === 'lit') giveUp(r, 'Oh!');
      else if (r.state === 'sleep') {
        r.state = 'dark';
        r.cool = 1.5 + rng() * 2;
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const v = 150 + rng() * 380;
      g.sparks.push({ x: FUSE.x, y: FUSE.y - 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160, life: 0.5 + rng() * 0.6, smoke: i % 3 === 0 });
    }
    pop('POP! The fuse blew', FUSE.x + 60, FUSE.y - 190, PAL.brick, 40);
    sfx('topple');
    env.vibrate?.(140);
  }

  function act(tg) {
    if (tg === 'fuse') {
      if (!g.blown) return;
      if (g.blownT < 0.6) {
        pop('Too hot!', FUSE.x, FUSE.y - 150, PAL.brick, 30);
        return;
      }
      g.blown = false;
      g.heat = 0.35;
      pop('Power back on', FUSE.x + 40, FUSE.y - 160, PAL.green, 34);
      sfx('go');
      return;
    }
    const r = tg;
    if (r.state === 'ask') {
      if (g.blown) {
        pop('No power: flip the fuse!', r.x, r.y - WIN_H / 2 - 30, PAL.brick, 28);
        sfx('wrong');
        return;
      }
      r.state = 'lit';
      r.prog = 0;
      r.t = 0;
      r.mood = 1;
      g.flash = 0.35;
      sfx('switch');
      sfx('ding', { pitch: (r.i % 4) * 2 });
      env.vibrate?.(20);
    } else if (r.state === 'sleep') {
      r.state = 'dark';
      r.cool = 1.2 + rng() * 2;
      g.unplugged++;
      pop('Night night', r.x, r.y - WIN_H / 2 - 26, PAL.slate, 28);
      sfx('switch');
    } else if (r.state === 'lit') {
      pop('Still reading!', r.x, r.y - WIN_H / 2 - 26, INK, 26);
      sfx('tick');
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
    // Fly: follow the pointer, or the stick.
    const ox = g.x;
    const oy = g.y;
    if (input.pointer.active) {
      g.x = approach(g.x, input.pointer.x, 10, dt);
      g.y = approach(g.y, input.pointer.y, 10, dt);
    } else {
      g.vx = approach(g.vx, input.x * 1150, 12, dt);
      g.vy = approach(g.vy, input.y * 1150, 12, dt);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    g.x = clamp(g.x, 90, W - 90);
    g.y = clamp(g.y, 150, GROUND - 4); // low enough for the beak to reach the fuse switch
    const mvx = (g.x - ox) / Math.max(dt, 1e-6);
    if (Math.abs(mvx) > 40) g.face = mvx > 0 ? 1 : -1;
    g.speed = Math.hypot(g.x - ox, g.y - oy) / Math.max(dt, 1e-6);

    // Requests.
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      g.spawnT = g.askGap() * (0.8 + rng() * 0.4);
      const free = g.rooms.filter((r) => r.state === 'dark' && r.cool <= 0);
      if (free.length) {
        const r = free[Math.floor(rng() * free.length)];
        r.state = 'ask';
        r.t = 0;
        r.patience = g.patienceNow() * (0.9 + rng() * 0.2);
        r.readT = g.readNow() + rng() * 1.5;
        r.who = Math.floor(rng() * CREATURES.length);
        sfx('tick');
      }
    }

    // The action: whatever the Swift's beak (or body) touches, or where the
    // pointer pressed away from the Swift (it zips there and plugs in when
    // its beak or body arrives).
    if (input.actionPressed) {
      const here = reach();
      const p = input.pointer;
      const there = input.pointer.active ? targetAt(p.x, p.y) : null;
      const near = !input.pointer.active || Math.hypot(p.x - g.x, p.y - g.y) < 130;
      if (here && (near || there === here) && (useful(here) || !there)) act(here);
      else if (there) {
        if (touching(there)) act(there);
        else g.pending = there;
      }
    }
    if (g.pending) {
      if (touching(g.pending)) {
        act(g.pending);
        g.pending = null;
      } else if (input.pointer.active && targetAt(input.pointer.x, input.pointer.y) !== g.pending) g.pending = null;
    }

    // The rooms.
    for (const r of g.rooms) {
      r.mood = approach(r.mood, 0, 1.2, dt);
      if (r.state === 'dark') r.cool -= dt;
      else if (r.state === 'ask') {
        r.t += dt;
        if (r.t >= r.patience) giveUp(r);
      } else if (r.state === 'lit') {
        r.prog += dt;
        if (r.prog >= r.readT) {
          r.state = 'sleep';
          r.t = 0;
          g.score++;
          g.served++;
          pop('+1', r.x, r.y - WIN_H / 2 - 24, PAL.magenta, 40);
          sfx('catch', { pitch: (g.served % 5) * 2 });
        }
      } else if (r.state === 'sleep') r.t += dt;
    }

    // The fuse.
    if (g.blown) g.blownT += dt;
    else {
      const load = g.load();
      const rate = load <= SAFE ? -0.4 : load === SAFE + 1 ? 0.3 : 0.3 + 0.55 * (load - SAFE - 1);
      g.heat = clamp(g.heat + rate * dt, 0, 1);
      if (g.heat >= 1) blow();
      else if (load > SAFE && rng() < dt * 6 * g.heat) g.sparks.push({ x: FUSE.x + (rng() - 0.5) * 60, y: FUSE.y - 60, vx: (rng() - 0.5) * 200, vy: -120 - rng() * 160, life: 0.3 + rng() * 0.3 });
    }

    g.flash = Math.max(0, g.flash - dt);
    g.shake = Math.max(0, g.shake - dt);
    for (const s of g.sparks) {
      s.vy += (s.smoke ? -60 : 700) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    g.sparks = g.sparks.filter((s) => s.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Lit ${g.score}`;
  g.summary = () => {
    const lines = [`${g.served} room${g.served === 1 ? '' : 's'} lit till bedtime.`];
    const woes = [];
    if (g.gaveUp) woes.push(`${g.gaveUp} left in the dark`);
    if (g.fuses) woes.push(`${g.fuses} blown fuse${g.fuses === 1 ? '' : 's'}`);
    lines.push(woes.length ? `Along the way: ${woes.join(', ')}.` : 'Not one fuse blown, and nobody left in the dark!');
    return lines;
  };

  // ---------- drawing ----------

  function creature(c, r, x, y, s, pose) {
    // a small round creature, in silhouette against the window
    const col = CREATURES[r.who];
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (pose === 'sleep') {
      // in bed under a blanket, head on the pillow
      blob(c, 10, 18, 46, 14, r.i, 0.05);
      wash(c, '#f2ead6');
      ink(c, 1.4);
      blob(c, -26, 4, 16, 13, r.i + 1, 0.06);
      wash(c, col);
      ink(c, 1.4);
      blob(c, 16, 20, 40, 16, r.i + 2, 0.08);
      wash(c, [PAL.strawberry, PAL.sage, PAL.slate, PAL.mauve][r.who]);
      ink(c, 1.4);
      c.beginPath();
      c.arc(-30, 2, 4, 0.2, Math.PI - 0.2);
      ink(c, 1.4);
    } else {
      blob(c, 0, 26, 26, 30, r.i, 0.06);
      wash(c, col);
      ink(c, 1.6);
      blob(c, 0, -12, 22, 20, r.i + 3, 0.06);
      wash(c, col);
      ink(c, 1.6);
      // ears
      for (const d of [-1, 1]) {
        blob(c, d * 14, -30, 7, r.who === 1 ? 16 : 8, r.i + d, 0.1);
        wash(c, col);
        ink(c, 1.2);
      }
      c.fillStyle = INK;
      for (const d of [-1, 1]) {
        c.beginPath();
        c.arc(d * 8, -14, 2.6, 0, Math.PI * 2);
        c.fill();
      }
      if (pose === 'read') {
        // an open book
        poly(c, [[-26, 18], [0, 24], [26, 18], [26, 36], [0, 42], [-26, 36]], r.i, 0.6);
        wash(c, '#fbf6e8');
        ink(c, 1.4);
        c.beginPath();
        c.moveTo(0, 24);
        c.lineTo(0, 42);
        ink(c, 1.2);
      } else {
        // a paw raised, waving
        blob(c, 26, -6 + Math.sin(r.t * 8) * 4, 7, 9, r.i, 0.1);
        wash(c, col);
        ink(c, 1.2);
      }
    }
    c.restore();
  }

  function bulbIcon(c, x, y, s, lit) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    blob(c, 0, -6, 13, 14, 2, 0.04);
    wash(c, lit ? '#ffe680' : '#f7f0dc');
    ink(c, 1.6);
    poly(c, [[-6, 6], [6, 6], [5, 15], [-5, 15]], 1, 0.4);
    wash(c, '#b0a070');
    ink(c, 1.4);
    c.restore();
  }

  function drawWindow(c, r, t) {
    const { x, y } = r;
    const on = r.state === 'lit' || r.state === 'sleep';
    if (on) {
      const grd = c.createRadialGradient(x, y, 20, x, y, 150);
      grd.addColorStop(0, 'rgba(255,224,130,0.55)');
      grd.addColorStop(1, 'rgba(255,224,130,0)');
      c.fillStyle = grd;
      c.fillRect(x - 160, y - 160, 320, 320);
    }
    const cell = r.state === 'ask' ? 1 : r.state === 'lit' ? 2 : r.state === 'sleep' ? 3 : 0;
    if (!drawSprite(c, 'sprites.swiftHouse', cell, x, y, { h: WIN_H + 24, anchor: 'center' })) {
      const x0 = x - WIN_W / 2;
      const y0 = y - WIN_H / 2;
      const pts = [[x0, y0], [x0 + WIN_W, y0], [x0 + WIN_W, y0 + WIN_H], [x0, y0 + WIN_H]];
      poly(c, pts, r.i + 20, 1);
      wash(c, on ? '#f6d878' : '#2e3852', 1);
      if (on) {
        c.save();
        poly(c, pts, r.i + 20, 1);
        c.clip();
        // the lamp: a pleated shade on a little table
        const lx = x + 34;
        const ly = y + 26;
        const grd = c.createRadialGradient(lx, ly - 18, 4, lx, ly - 18, 90);
        grd.addColorStop(0, 'rgba(255,250,210,0.95)');
        grd.addColorStop(1, 'rgba(255,240,170,0)');
        c.fillStyle = grd;
        c.fillRect(x0, y0, WIN_W, WIN_H);
        c.restore();
        poly(c, [[lx - 16, ly - 4], [lx + 16, ly - 4], [lx + 10, ly - 26], [lx - 10, ly - 26]], r.i, 0.5);
        wash(c, PAL.strawberry);
        ink(c, 1.4);
        c.beginPath();
        c.moveTo(lx, ly - 4);
        c.lineTo(lx, ly + 22);
        ink(c, 2);
        creature(c, r, x - 18, y + 14, 0.9, r.state === 'sleep' ? 'sleep' : 'read');
      } else if (r.state === 'ask') creature(c, r, x, y + 16, 0.95, 'ask');
      // curtains and frame
      for (const d of [-1, 1]) {
        poly(c, [[x + d * (WIN_W / 2), y0], [x + d * (WIN_W / 2 - 22), y0], [x + d * (WIN_W / 2 - 12), y0 + WIN_H], [x + d * (WIN_W / 2), y0 + WIN_H]], r.i + d, 0.6);
        wash(c, on ? PAL.dusty : '#5a5470', 0.85);
        ink(c, 1.2);
      }
      poly(c, pts, r.i + 20, 1);
      ink(c, 3);
      c.beginPath();
      c.moveTo(x0 - 10, y0 + WIN_H + 4);
      c.lineTo(x0 + WIN_W + 10, y0 + WIN_H + 4);
      ink(c, 6, '#8a6a4a');
    }
    // what the window needs
    const top = y - WIN_H / 2;
    if (r.state === 'ask') {
      const left = 1 - r.t / r.patience;
      const bx = x;
      const by = top - 34 + Math.sin(t * 4 + r.i) * 3;
      blob(c, bx, by, 30, 26, r.i, 0.05);
      wash(c, '#fbf6e8', 0.95);
      ink(c, 1.8);
      bulbIcon(c, bx, by, 1.15, false);
      c.beginPath();
      c.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ink(c, 6, left < 0.3 ? PAL.brick : left < 0.6 ? PAL.ochre : PAL.green);
    } else if (r.state === 'lit') {
      // reading: a bar of pages left
      const k = r.prog / r.readT;
      poly(c, [[x - 46, top - 22], [x + 46, top - 22], [x + 46, top - 10], [x - 46, top - 10]], r.i, 0.4);
      wash(c, '#fbf6e8');
      c.fillStyle = PAL.ochre;
      c.fillRect(x - 46, top - 22, 92 * k, 12);
      ink(c, 1.4);
    } else if (r.state === 'sleep') {
      const z = (t * 0.8 + r.i * 0.3) % 1;
      c.save();
      c.globalAlpha = 1 - z;
      label(c, 'z', x + 30 + z * 20, top - 6 - z * 40, { size: 24 + z * 14, color: PAL.slate, weight: 800 });
      c.restore();
      // the plug to pull
      const blink = Math.sin(t * 6) > 0 ? 1 : 0.55;
      c.save();
      c.globalAlpha = blink;
      label(c, 'unplug', x - 14, top - 20, { size: 22, color: PAL.slate, weight: 700 });
      c.restore();
    }
    if (r.mood < -0.2) {
      c.save();
      c.globalAlpha = Math.min(1, -r.mood);
      label(c, '☹', x, y, { size: 56, color: '#f7f0dc', weight: 700 });
      c.restore();
    }
  }

  function drawFuse(c, t) {
    const { x, y } = FUSE;
    const sh = g.shake > 0 && !env.reduceMotion ? Math.sin(g.shake * 70) * 4 : 0;
    // the cable over to the house
    c.beginPath();
    c.moveTo(x + 40, y + 110);
    c.quadraticCurveTo(x + 90, GROUND - 20, COLS[0] - 120, GROUND - 70);
    ink(c, 4, '#3a3028');
    // The painted box (measured in its 512 px cell: x 108-401, y 33-433; the
    // blown one sits left of centre, x 57-340, its smoke trailing right) is
    // drawn 190 tall with its foot at y + 175.
    const FK = 190 / 400;
    if (drawSprite(c, 'sprites.swiftHouse', g.blown ? 5 : 4, x + sh + (g.blown ? (256 - 198) * FK : 0), y + 175 - (433 - 256) * FK, { h: 512 * FK, anchor: 'center', whole: true })) {
      // the painted box sits below a little card of lamps and the heat gauge
      poly(c, [[x - 84, y - 108], [x + 84, y - 108], [x + 84, y - 18], [x - 84, y - 18]], 8, 0.8);
      wash(c, '#f2ead6', 0.95);
      ink(c, 2);
    } else {
      poly(c, [[x - 80 + sh, y - 120], [x + 80 + sh, y - 120], [x + 80 + sh, y + 110], [x - 80 + sh, y + 110]], 5, 1);
      wash(c, '#9aa4ac');
      ink(c, 2.6);
      hatch(c, x - 84, y - 124, x + 84, y + 114, 10, 0.15, 1);
      // the switch
      const up = !g.blown;
      poly(c, [[x - 20 + sh, y + 40], [x + 20 + sh, y + 40], [x + 20 + sh, y + 96], [x - 20 + sh, y + 96]], 6, 0.6);
      wash(c, '#4a4440');
      ink(c, 1.6);
      blob(c, x + sh, up ? y + 50 : y + 86, 16, 10, 2, 0.05);
      wash(c, up ? PAL.green : PAL.brick);
      ink(c, 1.6);
    }
    // how many lamps are on: three safe, then amber, then red
    const load = g.blown ? 0 : g.load();
    for (let i = 0; i < 6; i++) {
      const bx = x - 62 + i * 25;
      const by = y - 86;
      c.beginPath();
      c.arc(bx, by, 10, 0, Math.PI * 2);
      // three safe places in green, the rest in red: lit when a lamp is on
      c.fillStyle = i < load ? (i < SAFE ? '#6ccf5a' : i === SAFE ? '#f0a040' : '#e05030') : i < SAFE ? '#c4dcb8' : '#e8b4a4';
      c.fill();
      ink(c, 1.4);
    }
    c.beginPath();
    c.moveTo(x - 72 + SAFE * 25, y - 104);
    c.lineTo(x - 72 + SAFE * 25, y - 68);
    ink(c, 2, INK);
    // the heat gauge
    poly(c, [[x - 66, y - 48], [x + 66, y - 48], [x + 66, y - 28], [x - 66, y - 28]], 7, 0.5);
    wash(c, '#fbf6e8');
    c.fillStyle = g.heat > 0.66 ? '#d04a30' : g.heat > 0.33 ? '#e09a48' : '#c9b060';
    c.fillRect(x - 66, y - 48, 132 * g.heat, 20);
    ink(c, 1.6);
    // its name on a little card, readable against the painted wall and hedge
    poly(c, [[x - 46, y - 154], [x + 46, y - 154], [x + 46, y - 120], [x - 46, y - 120]], 12, 0.6);
    wash(c, '#f2ead6', 0.95);
    ink(c, 1.6);
    label(c, 'FUSE', x, y - 137, { size: 26, weight: 800, color: '#3a3028' });
    // warnings below the box, on the lawn, with a paper outline to read on the painting
    const warn = g.blown ? (Math.sin(t * 8) > -0.3 ? 'Flip me!' : '') : g.load() > SAFE && Math.sin(t * 10) > 0 ? 'Too many lamps!' : '';
    if (warn) {
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.92)';
      c.font = '800 32px Fraunces, Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(warn, x + 20, y + 205);
      label(c, warn, x + 20, y + 205, { size: 32, weight: 800, color: PAL.brick });
    }
  }

  function drawSwift(c, t) {
    const flip = g.face > 0;
    const plugging = g.flash > 0;
    const singed = g.blown;
    const bob = singed ? Math.sin(t * 3) * 3 : Math.sin(t * 9) * 5;
    const x = g.x;
    const y = g.y + bob;
    const pose = singed ? 2 : plugging ? 1 : 0;
    // the body (the socket) is held at (g.x, g.y): painting's socket at (-46, -192)
    // in bird units from the feet (39%, 52% of the PNG, feet at 97.7%), stand-in (0, -160)
    const painted = !!art('subject.plugsocketswift');
    const body = painted ? 192 : 160;
    // the painted poses are framed like the portrait, the body at the cell's centre
    // the painted poses, placed by their socket (measured in each 1024 px cell)
    const [sdx, sdy] = POSE_SOCKET[pose];
    const sprite = drawSprite(c, 'sprites.swiftPoses', pose, x - (flip ? -sdx : sdx) * PK, y - sdy * PK, { h: 1024 * PK, anchor: 'center', flip, whole: true });
    if (!sprite) {
      // wings: beating, swept back for the plug-in dive, drooping when singed
      const flap = singed ? 0.9 : plugging ? -0.5 : Math.sin(t * 22) * 0.6;
      // (the portrait has its own wings; the stand-in gets these)
      for (const d of art('subject.plugsocketswift') ? [] : [-1, 1]) {
        c.save();
        c.translate(x + d * 10, y - 20);
        c.rotate(d * (0.5 + flap));
        poly(c, [[0, 0], [d * 120, -40], [d * 150, -20], [d * 40, 20]], d + 3, 1);
        wash(c, singed ? '#4a4c54' : '#6a7080');
        ink(c, 1.8);
        c.restore();
      }
      c.save();
      c.translate(x, y);
      if (plugging) c.rotate((flip ? 1 : -1) * 0.35); // diving head first at the socket
      const bodyX = painted ? 46 * (flip ? -1 : 1) * (SIZE / 400) : 0; // put the socket on (g.x, g.y)
      drawBird(c, 'plugsocketswift', { x: bodyX, y: body * (SIZE / 400), size: SIZE, t, flip });
      c.restore();
      if (singed) {
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.7 + i / 3) % 1;
          c.save();
          c.globalAlpha = 0.5 * (1 - k);
          blob(c, x + (painted ? 0 : flip ? 10 : -10) + Math.sin(i * 2 + t) * 8, y - (painted ? 95 : 60) - k * 70, 10 + k * 14, 8 + k * 10, i, 0.15);
          wash(c, '#8a8480');
          c.restore();
        }
      }
    }
    // the bulb glows, brightest just after a lamp goes in, and is dark while the fuse is out
    if (singed) return;
    const s = SIZE / 400;
    // the bulb, in bird units across from the socket and up from the feet:
    // painting (0, -326) (bulb at 39%, 20% of the PNG), stand-in (-10, -290)
    const [bx, by] = painted ? [0, -326] : [-10, -290];
    let hx = x + (flip ? -bx : bx) * s;
    let hy = y + body * s + by * s;
    if (sprite) {
      // the painted pose's bulb, from its socket
      const [ux, uy] = POSE_BULB[pose];
      hx = x + (flip ? -ux : ux) * PK;
      hy = y + uy * PK;
    }
    const glow = 0.35 + g.flash * 2.5;
    const grd = c.createRadialGradient(hx, hy, 6, hx, hy, 90);
    grd.addColorStop(0, `rgba(255,240,160,${Math.min(0.9, glow)})`);
    grd.addColorStop(1, 'rgba(255,240,160,0)');
    c.fillStyle = grd;
    c.fillRect(hx - 90, hy - 90, 180, 180);
  }

  // On a narrow screen the fuse box can be out of view: when it's heating
  // or blown, a small copy of its gauge rides at the view's left edge.
  function fuseBadge(c, t) {
    const cv = c.canvas;
    if (!cv || cv.width / cv.height > (W / H) * 0.8) return; // a wide screen shows the whole house
    const left = g.x - g.span / 2;
    if (FUSE.x + 90 > left) return; // the box itself is in view
    const load = g.blown ? 0 : g.load();
    if (!g.blown && load <= SAFE && g.heat < 0.15) return;
    const x = left + 110;
    const y = GROUND + 48; // on the lawn, clear of the windows
    poly(c, [[x - 90, y - 50], [x + 90, y - 50], [x + 90, y + 50], [x - 90, y + 50]], 9, 0.8);
    wash(c, '#f2ead6', 0.95);
    ink(c, 2.4, g.blown || g.heat > 0.5 ? PAL.brick : INK);
    label(c, g.blown ? '◀ Flip the fuse!' : '◀ FUSE', x, y - 26, { size: 22, weight: 800, color: g.blown ? PAL.brick : '#3a3028' });
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(x - 62 + i * 25, y + 2, 8, 0, Math.PI * 2);
      c.fillStyle = i < load ? (i < SAFE ? '#6ccf5a' : i === SAFE ? '#f0a040' : '#e05030') : i < SAFE ? '#c4dcb8' : '#e8b4a4';
      c.fill();
      ink(c, 1.2);
    }
    c.fillStyle = g.heat > 0.66 ? '#d04a30' : g.heat > 0.33 ? '#e09a48' : '#c9b060';
    c.fillRect(x - 70, y + 20, 140 * g.heat, 12);
    poly(c, [[x - 70, y + 20], [x + 70, y + 20], [x + 70, y + 32], [x - 70, y + 32]], 3, 0.3);
    ink(c, 1.2);
    if (g.heat > 0.5 && Math.sin(t * 10) > 0) {
      poly(c, [[x - 90, y - 50], [x + 90, y - 50], [x + 90, y + 50], [x - 90, y + 50]], 9, 0.8);
      ink(c, 4, PAL.brick);
    }
  }

  g.draw = (c, t) => {
    scene(c, 'plugsocketswift', W, H, (c) => {
      // dusk: a deepening sky, neighbours' roofs, a garden wall
      band(c, 0, 0, W, 300, '#4a5a7a', 0.75, 1);
      band(c, 0, 240, W, 260, PAL.mauve, 0.6, 2);
      band(c, 0, 460, W, 300, '#e0a070', 0.5, 3);
      c.fillStyle = '#fff6d0';
      c.beginPath();
      c.arc(1380, 140, 34, 0, Math.PI * 2);
      c.fill();
      ink(c, 1.4);
      const roofs = [[20, 560, 220], [1250, 520, 170], [1420, 580, 180]];
      roofs.forEach(([x, y, w], i) => {
        poly(c, [[x, GROUND], [x, y], [x + w / 2, y - 70], [x + w, y], [x + w, GROUND]], i + 3, 1.5);
        wash(c, '#5a5870', 0.85);
        ink(c, 1.6);
      });
      // the tall house
      const hx0 = COLS[0] - 120;
      const hx1 = COLS[3] + 120;
      poly(c, [[hx0, GROUND], [hx0, 200], [hx1, 200], [hx1, GROUND]], 11, 1.5);
      wash(c, '#d8b890');
      ink(c, 2.6);
      poly(c, [[hx0, GROUND], [hx0, 200], [hx1, 200], [hx1, GROUND]], 11, 1.5);
      hatch(c, hx0, 200, hx1, GROUND, 16, 0.12, 1);
      poly(c, [[hx0 - 40, 206], [(hx0 + hx1) / 2, 90], [hx1 + 40, 206]], 12, 1.5);
      wash(c, PAL.brick);
      ink(c, 2.6);
      poly(c, [[hx1 - 150, 150], [hx1 - 150, 70], [hx1 - 100, 70], [hx1 - 100, 120]], 13, 1);
      wash(c, PAL.brick, 0.9);
      ink(c, 2);
      // the ground
      band(c, 0, GROUND, W, H - GROUND, PAL.green, 0.75, 5);
      c.beginPath();
      c.moveTo(0, GROUND);
      c.lineTo(W, GROUND + 2);
      ink(c, 2);
      // the garden wall the fuse box hangs on
      poly(c, [[60, GROUND], [60, FUSE.y - 170], [400, FUSE.y - 170], [400, GROUND]], 14, 1.5);
      wash(c, '#b8a890');
      ink(c, 2.2);
      poly(c, [[60, GROUND], [60, FUSE.y - 170], [400, FUSE.y - 170], [400, GROUND]], 14, 1.5);
      hatch(c, 60, FUSE.y - 170, 400, GROUND, 22, 0.15, 0);
    });

    // night deepens as the game goes on
    c.save();
    c.globalAlpha = 0.25 * progress();
    c.fillStyle = PAL.night;
    c.fillRect(0, 0, W, H);
    c.restore();

    drawFuse(c, t);
    for (const r of g.rooms) drawWindow(c, r, t);

    // which window the Swift's beak (or body) is at
    const tg = reach();
    if (tg && tg !== 'fuse') {
      c.save();
      c.globalAlpha = 0.6 + Math.sin(t * 8) * 0.2;
      poly(c, [[tg.x - WIN_W / 2 - 10, tg.y - WIN_H / 2 - 10], [tg.x + WIN_W / 2 + 10, tg.y - WIN_H / 2 - 10], [tg.x + WIN_W / 2 + 10, tg.y + WIN_H / 2 + 10], [tg.x - WIN_W / 2 - 10, tg.y + WIN_H / 2 + 10]], 1, 0.8);
      ink(c, 4, '#fff2b0');
      c.restore();
    }

    for (const s of g.sparks) {
      c.save();
      c.globalAlpha = clamp(s.life * 2, 0, 1);
      if (s.smoke) {
        blob(c, s.x, s.y, 16 + (1 - s.life) * 20, 12 + (1 - s.life) * 16, 3, 0.15);
        wash(c, '#8a8480', 0.6);
      } else {
        c.beginPath();
        c.arc(s.x, s.y, 4, 0, Math.PI * 2);
        c.fillStyle = '#ffd040';
        c.fill();
      }
      c.restore();
    }

    drawSwift(c, t);
    fuseBadge(c, t);

    for (const p of g.pops) {
      const k = Math.min(1, (1.2 - p.life) * 8);
      const s = 0.6 + 0.4 * k;
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(s, s);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.92)';
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
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = '700 36px Fraunces, Georgia, serif';
      c.textAlign = 'center';
      c.strokeText('Fly to a window that asks · press to plug in', W / 2, 860);
      hint(c, 'Fly to a window that asks · press to plug in', W / 2, 860, { focus: g.focus(), span: g.span, size: 36, weight: 700 });
      c.restore();
    }
  };

  g.focus = () => g.x;
  g.span = 820;

  return g;
}
