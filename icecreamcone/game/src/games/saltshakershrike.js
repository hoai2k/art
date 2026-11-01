// Saltshaker Shrike: Just a Pinch.
//
// The Shrike hangs upside down from the brass rail over a big round
// revolving table, a lazy Susan, its perforated cap pointing down. The cook
// sets each plate down on the table's right-hand edge; the table turns it
// round the near side to the diner waiting at the left. Each plate has a
// little flag that shows how many pinches of salt it wants. Move along the
// rail and press the action to shake one pinch. Salt takes a moment to fall,
// and a plate on a turning table creeps at the ends and swings fast across
// the middle, so shake ahead of it, or catch it at the ends. At the left the
// diner tastes it: just right scores three, one pinch out scores one, and
// more than that gets a frown and nothing. Puddings (a flag with the shaker
// crossed out) want no salt at all: salting one costs one. The lunch rush
// builds over the round along the shared difficulty curve (`g.d()`, see
// difficulty.js): it opens with one-pinch plates on a slow table, far apart;
// twos, then puddings, join as it builds; by medium (about two-thirds of a
// Normal round) orders run to three; fours and fives, faster, are the hard
// end. Score: points.

import { art, drawBird, drawSprite, SHEETS, scene, band, blob, poly, wash, ink, hatch, label, hint, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.shrikePlates': [4, 2], // fried egg, chips, baked potato, corn cob, tomato soup, pretzel; cake slice, sundae (no salt)
  'sprites.shrikeDiners': [4, 2], // mole, mouse, frog, badger waiting; the same four pulling a face
  'sprites.shrikePoses': [4, 1], // hanging upside down from the rail; shaking; pleased; flinching
  'sprites.shrikeTable': [1, 1], // the round revolving table, in perspective
});

const DURATION = 45;
const RAIL_Y = 108;
const SIZE = 320;
const S = SIZE / 400;
const CAP_Y = RAIL_Y + 268 * S; // where the salt comes out (the Shrike hangs head down)
// The table: plates ride its rim, an ellipse, from angle 0 (right) round the
// near side to PI (left), where the diner takes them.
const TX = 860;
const TY = 560;
const TRX = 600;
const TRY = 108; // the plates' rim, 87% of the way out on the painted top
const FOOD_UP = 42; // salt lands this far above a plate's foot
const FOOD_HALF = 50; // how wide a plate catches salt
const DINER_X = 320; // behind the table's left end, the table hiding the diner's waist
const DINER_Y = 600;
const WALL_Y = 470; // where the wall meets the floor
const SALT_V = 250; // the pinch leaves the cap downward at this speed
const SALT_G = 1800;
const fallTime = (y) => (-SALT_V + Math.sqrt(SALT_V * SALT_V + 2 * SALT_G * (y - CAP_Y))) / SALT_G;
const rimX = (a) => TX + TRX * Math.cos(a);
const rimY = (a) => TY + TRY * Math.sin(a);
const COOL = 0.2; // between shakes
// The painting's domed cap, where the salt comes out, is high and forward of
// its feet: at (-83, -375) in bird units (measured on the PNG: 30%, 7% of the
// square, feet at 97.6%). It is drawn a little smaller than the stand-in so
// its cap hangs at the same height, and shifted so the cap is over the salt's line.
const PORTRAIT_SIZE = Math.round((268 * SIZE) / 375);
const PORTRAIT_CAP_DX = (83 * PORTRAIT_SIZE) / 400;
// The cap's holes in each pose cell (still, shaking, pleased, flinching).
const POSE_CAP = [[503, 782], [503, 763], [484, 763], [521, 726]];
// How high each dish's food stands above its plate's foot, as drawn.
const FOOD_TOP = [50, 64, 64, 52, 66, 70, 92, 110];
const DESSERTS = [6, 7];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 900,
    vx: 0,
    cool: 0,
    shakeT: 0,
    plates: [],
    puffs: [], // pinches of salt in the air
    grains: [], // what lands, for show
    heaps: [], // spilt salt on the counter
    pops: [],
    spawnT: 0.2,
    nextId: 1,
    diner: { who: 0, mood: 0, t: 0 },
    perfect: 0,
    near: 0,
    frowns: 0,
    puddings: 0,
    spilt: 0,
    turn: 0, // the table's own angle, for drawing
    mood: 0, // the Shrike's own: > 0 pleased, < 0 flinching, counting down
    moodKind: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // The lunch rush: how hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard),
  // along the shared curve for the chosen Difficulty.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  // Each knob: easy, medium, hard.
  g.omega = () => knob(g.d(), 0.36, 0.55, 0.78); // the table's turn, radians per second
  g.gap = () => knob(g.d(), 2.7, 1.95, 1.15); // seconds between plates, give or take 15%
  g.puddingChance = () => knob(g.d(), 0, 0.15, 0.22);
  // Pinches an order wants: from the low end up by a random share of the
  // spread: all ones at easy, ones to threes at medium, twos to fives at hard.
  g.order = (r) => clamp(Math.floor(knob(g.d(), 1, 1, 2) + r * knob(g.d(), 1, 2.4, 3.6)), 1, 5);
  // Where a plate is `ahead` seconds from now: x, its foot's y, the food's y.
  g.at = (p, ahead = 0) => {
    const a = Math.min(Math.PI, p.a + g.omega() * ahead);
    return { x: rimX(a), y: rimY(a), food: rimY(a) - FOOD_UP };
  };
  g.fall = fallTime;
  const add = (n) => {
    g.score = Math.max(0, g.score + n);
  };
  function pop(text, x, y, color = INK, size = 34) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.2 });
  }

  function spawn() {
    const dessert = rng() < g.puddingChance();
    const n = dessert ? 0 : g.order(rng());
    const kind = dessert ? DESSERTS[Math.floor(rng() * 2)] : Math.floor(rng() * 6);
    g.plates.push({ id: g.nextId++, a: 0, x: rimX(0), y: rimY(0), n, got: 0, kind, dessert, who: Math.floor(rng() * 4), wob: 0, set: 0.3 });
  }

  function judge(p) {
    const d = p.got - p.n;
    let pts = 0;
    let text;
    let mood;
    if (p.dessert) {
      if (p.got) {
        pts = -1;
        text = 'Salty pudding!';
        mood = -1;
        g.frowns++;
      } else {
        text = 'Lovely, no salt';
        mood = 1;
        g.puddings++;
      }
    } else if (d === 0) {
      pts = 3;
      text = 'Just right!';
      mood = 1;
      g.perfect++;
    } else if (Math.abs(d) === 1 && p.got > 0) {
      pts = 1;
      text = d < 0 ? 'A little bland' : 'A little salty';
      mood = 0.3;
      g.near++;
    } else {
      text = d < 0 ? 'Bland!' : 'Too salty!';
      mood = -1;
      g.frowns++;
    }
    add(pts);
    g.diner = { who: p.who, mood, t: 1.1 };
    if (mood > 0.5 || mood < 0) {
      g.mood = 0.8;
      g.moodKind = mood > 0.5 ? 1 : -1;
    }
    pop(text, DINER_X + 90, DINER_Y - 300, mood > 0.5 ? PAL.green : mood > 0 ? PAL.ochre : PAL.brick, 36);
    if (pts) pop(pts > 0 ? `+${pts}` : `${pts}`, DINER_X + 90, DINER_Y - 355, pts > 0 ? PAL.magenta : PAL.brick, 42);
    sfx(mood > 0.5 ? 'right' : mood > 0 ? 'catch' : 'squawk');
    if (mood < 0) env.vibrate?.(60);
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }
    const k = progress();

    // Along the rail.
    const ox = g.x;
    if (input.pointer.active) g.x = approach(g.x, input.pointer.x, 12, dt);
    else {
      g.vx = approach(g.vx, input.x * 950, 14, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, 220, W - 80);
    g.lean = clamp((g.x - ox) / Math.max(dt, 1e-6) / 2500, -0.25, 0.25);

    // Shake a pinch.
    g.cool -= dt;
    g.shakeT = Math.max(0, g.shakeT - dt);
    if (input.actionPressed && g.cool <= 0) {
      g.cool = COOL;
      g.shakeT = 0.18;
      g.puffs.push({ x: g.x, y: CAP_Y, vy: SALT_V });
      sfx('shuffle');
    }
    for (const f of g.puffs) {
      const py = f.y;
      f.vy += SALT_G * dt;
      f.y += f.vy * dt;
      // it lands on the first plate whose food it falls past
      const p = g.plates.find((p) => Math.abs(p.x - f.x) < FOOD_HALF && py < p.y - FOOD_UP && f.y >= p.y - FOOD_UP);
      const floor = TY + TRY * Math.sqrt(Math.max(0, 1 - ((f.x - TX) / (TRX + 60)) ** 2)) + 20;
      if (p || f.y >= floor) {
        f.dead = true;
        const ly = p ? p.y - FOOD_UP : floor;
        for (let i = 0; i < 8; i++) g.grains.push({ x: f.x + (rng() - 0.5) * 50, y: ly - rng() * 10, floor: ly + 12, vx: (rng() - 0.5) * 120, vy: -60 - rng() * 120, life: 0.4 + rng() * 0.2, on: p });
        if (p) {
          p.got++;
          p.wob = 0.25;
          sfx('tick');
          if (!p.dessert && p.got === p.n) pop('✓', p.x, p.y - 160, PAL.green, 40);
          if (p.dessert || p.got > p.n) sfx('miss');
        } else {
          g.spilt++;
          g.heaps.push({ x: f.x, y: floor - 16, life: 2.5 });
        }
      }
    }
    g.puffs = g.puffs.filter((f) => !f.dead);

    // Plates round the table.
    const w = g.omega();
    g.turn += w * dt;
    for (const p of g.plates) {
      const ox = p.x;
      p.a = Math.min(Math.PI, p.a + w * dt);
      p.x = rimX(p.a);
      p.y = rimY(p.a);
      p.vx = (p.x - ox) / Math.max(dt, 1e-6);
      p.wob = Math.max(0, p.wob - dt);
      p.set = Math.max(0, p.set - dt);
      if (p.a >= Math.PI && !p.done) {
        p.done = true;
        judge(p);
      }
    }
    g.plates = g.plates.filter((p) => !p.done);
    g.spawnT -= dt;
    const last = g.plates[g.plates.length - 1];
    if (g.spawnT <= 0 && (!last || last.a > 0.6)) {
      spawn();
      g.spawnT = g.gap() * (0.85 + rng() * 0.3);
    }

    g.diner.t = Math.max(0, g.diner.t - dt);
    g.mood = Math.max(0, g.mood - dt);
    for (const s of g.grains) {
      s.vy += 900 * dt;
      s.x += s.vx * dt + (s.on ? s.on.vx * dt : 0);
      s.y = Math.min(s.floor, s.y + s.vy * dt);
      s.life -= dt;
    }
    g.grains = g.grains.filter((s) => s.life > 0);
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
    const lines = [`${g.perfect} plate${g.perfect === 1 ? '' : 's'} just right, ${g.near} nearly.`];
    const woes = [];
    if (g.frowns) woes.push(`${g.frowns} frown${g.frowns === 1 ? '' : 's'}`);
    if (g.spilt) woes.push(`${g.spilt} pinch${g.spilt === 1 ? '' : 'es'} on the table`);
    lines.push(woes.length ? `Along the way: ${woes.join(', ')}.` : 'Not one frown, and not a grain spilt!');
    return lines;
  };

  // ---------- drawing ----------

  function plate(c, x, y) {
    c.beginPath();
    c.ellipse(x, y - 8, 92, 20, 0, 0, Math.PI * 2);
    c.fillStyle = '#fbf8f0';
    c.fill();
    ink(c, 2);
    c.beginPath();
    c.ellipse(x, y - 10, 62, 12, 0, 0, Math.PI * 2);
    ink(c, 1, 'rgba(59,43,32,0.4)');
  }

  function food(c, kind, x, y) {
    const b = y - 14;
    switch (kind) {
      case 0: // fried egg
        blob(c, x, b - 4, 58, 16, 2, 0.12);
        wash(c, '#fffaf0');
        ink(c, 1.8);
        blob(c, x + 6, b - 12, 22, 15, 3, 0.05);
        wash(c, '#f2b830');
        ink(c, 1.6);
        break;
      case 1: // chips
        for (let i = 0; i < 9; i++) {
          const cx = x - 44 + i * 11;
          poly(c, [[cx - 5, b], [cx + 5, b], [cx + 8 + (i % 3) * 3, b - 34 - (i % 4) * 6], [cx - 2 + (i % 3) * 3, b - 36 - (i % 4) * 6]], i, 0.5);
          wash(c, '#ecc860');
          ink(c, 1.2);
        }
        break;
      case 2: // baked potato
        blob(c, x, b - 22, 56, 28, 4, 0.08);
        wash(c, '#b88850');
        ink(c, 1.8);
        blob(c, x, b - 40, 26, 9, 5, 0.1);
        wash(c, '#f6e2a0');
        ink(c, 1.4);
        break;
      case 3: // corn cob
        blob(c, x, b - 18, 60, 20, 6, 0.04);
        wash(c, '#f0cc40');
        ink(c, 1.8);
        hatch(c, x - 60, b - 40, x + 60, b + 2, 8, 0.4, 0);
        break;
      case 4: // a bowl of tomato soup
        poly(c, [[x - 58, b - 34], [x + 58, b - 34], [x + 40, b], [x - 40, b]], 7, 0.8);
        wash(c, '#f3eee2');
        ink(c, 1.8);
        c.beginPath();
        c.ellipse(x, b - 34, 58, 11, 0, 0, Math.PI * 2);
        c.fillStyle = '#d0583a';
        c.fill();
        ink(c, 1.6);
        break;
      case 5: // pretzel
        for (const d of [-1, 1]) {
          c.beginPath();
          c.ellipse(x + d * 22, b - 24, 26, 20, 0, 0, Math.PI * 2);
          ink(c, 11, '#a8682e');
          ink(c, 1.4);
        }
        break;
      case 6: // a slice of cake
        poly(c, [[x - 50, b], [x + 46, b], [x + 46, b - 48], [x - 50, b - 22]], 8, 0.8);
        wash(c, '#f6e0b0');
        ink(c, 1.8);
        poly(c, [[x - 50, b - 22], [x + 46, b - 48], [x + 46, b - 58], [x - 54, b - 28]], 9, 0.8);
        wash(c, PAL.strawberry);
        ink(c, 1.6);
        c.beginPath();
        c.arc(x + 30, b - 64, 8, 0, Math.PI * 2);
        c.fillStyle = '#c03040';
        c.fill();
        ink(c, 1.2);
        break;
      default: // a sundae
        poly(c, [[x - 28, b - 30], [x + 28, b - 30], [x + 8, b - 4], [x - 8, b - 4]], 10, 0.6);
        wash(c, '#e8f0f0', 0.8);
        ink(c, 1.6);
        c.beginPath();
        c.moveTo(x, b - 4);
        c.lineTo(x, b);
        ink(c, 3);
        for (const [dx, dy, col] of [[-12, -42, PAL.strawberry], [12, -44, '#f6eed8'], [0, -60, '#8a5a3a']]) {
          blob(c, x + dx, b + dy, 18, 15, dx + 30, 0.08);
          wash(c, col);
          ink(c, 1.4);
        }
    }
  }

  function flag(c, p, t) {
    const x = p.x - 40;
    const y = p.y - FOOD_UP - 70;
    c.beginPath();
    c.moveTo(x, p.y - FOOD_UP - 10);
    c.lineTo(x, y - 40);
    ink(c, 2.2, '#a08050');
    const w = p.dessert ? 56 : Math.max(56, Math.max(p.n, p.got) * 22 + 14);
    poly(c, [[x, y - 40], [x + w, y - 40], [x + w, y - 6], [x, y - 6]], p.id, 0.5);
    wash(c, '#fbf6e8');
    ink(c, 1.6);
    if (p.dessert) {
      // a little shaker, crossed out
      const sx = x + w / 2;
      poly(c, [[sx - 8, y - 12], [sx + 8, y - 12], [sx + 6, y - 30], [sx - 6, y - 30]], 1, 0.3);
      wash(c, '#e8ecec');
      ink(c, 1.4);
      c.beginPath();
      c.moveTo(sx - 18, y - 10);
      c.lineTo(sx + 18, y - 36);
      ink(c, 3.4, p.got ? PAL.brick : '#c04040');
      return;
    }
    for (let i = 0; i < Math.max(p.n, p.got); i++) {
      const dx = x + 18 + i * 22;
      c.beginPath();
      c.arc(dx, y - 23, 9, 0, Math.PI * 2);
      if (i < p.n) {
        c.fillStyle = i < p.got ? '#8a9098' : '#fbf6e8';
        c.fill();
        ink(c, 1.6);
      } else {
        c.fillStyle = PAL.brick;
        c.fill();
        ink(c, 1.4);
      }
    }
  }

  function diner(c, t) {
    const d = g.diner;
    // whoever's plate is next to arrive waits; the last one reacts for a moment
    const next = g.plates[0];
    const who = d.t > 0 ? d.who : next ? next.who : d.who;
    const mood = d.t > 0 ? d.mood : 0;
    const frown = mood < 0;
    const x = DINER_X;
    const y = DINER_Y;
    const bounce = mood > 0.5 && d.t > 0 ? Math.abs(Math.sin(t * 14)) * 10 : 0;
    if (drawSprite(c, 'sprites.shrikeDiners', who + (frown ? 4 : 0), x, y - bounce, { h: 220 })) return;
    const fur = ['#6a5a50', '#b0a8a0', '#8aa860', '#8a8478'][who];
    c.save();
    c.translate(x, y - bounce);
    blob(c, 0, -90, 70, 90, who, 0.05);
    wash(c, fur);
    ink(c, 2.2);
    blob(c, 0, -210, 56, 50, who + 5, 0.05);
    wash(c, fur);
    ink(c, 2.2);
    if (who === 3) {
      // a badger's stripe
      poly(c, [[-12, -258], [12, -258], [10, -180], [-10, -180]], 3, 0.6);
      wash(c, '#f6f2e6');
    }
    for (const s of [-1, 1]) {
      blob(c, s * 40, who === 2 ? -250 : -252, who === 2 ? 14 : 16, who === 1 ? 22 : 12, s + 9, 0.1);
      wash(c, who === 2 ? '#f6f2e6' : fur);
      ink(c, 1.6);
      c.beginPath();
      c.arc(s * (who === 2 ? 40 : 20), who === 2 ? -250 : -218, 5, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
    }
    // the mouth: content, pleased or pulling a face
    c.beginPath();
    if (frown) c.arc(0, -172, 16, Math.PI * 1.15, Math.PI * 1.85);
    else c.arc(0, -196, 14, Math.PI * 0.15, Math.PI * 0.85);
    ink(c, 2.6);
    // a napkin and a fork
    poly(c, [[-30, -150], [30, -150], [0, -100]], 4, 0.6);
    wash(c, '#fbf8f0');
    ink(c, 1.4);
    c.beginPath();
    c.moveTo(70, -40);
    c.lineTo(80, -170);
    ink(c, 3, '#8a9098');
    c.restore();
  }

  // The revolving table, its top an ellipse round the plates' rim.
  function drawTable(c, t) {
    // The painted table (one 2048 x 1024 cell): its top is an oval centred at
    // (1024, 222), 1002 px across to each side (measured); drawn so that oval
    // is 690 to each side round (TX, TY).
    const k = (TRX + 90) / 1002;
    if (drawSprite(c, 'sprites.shrikeTable', 0, TX, TY + (512 - 222) * k, { h: 1024 * k, anchor: 'center', whole: true })) return;
    // the pedestal and its foot
    poly(c, [[TX - 40, TY + 80], [TX + 40, TY + 80], [TX + 50, H - 70], [TX - 50, H - 70]], 3, 1);
    wash(c, '#8a5a34');
    ink(c, 2.2);
    c.beginPath();
    c.ellipse(TX, H - 60, 170, 26, 0, 0, Math.PI * 2);
    c.fillStyle = '#7a4a2a';
    c.fill();
    ink(c, 2.2);
    // the edge, then the top
    c.beginPath();
    c.ellipse(TX, TY + 22, TRX + 90, TRY + 55, 0, 0, Math.PI);
    c.lineTo(TX - TRX - 90, TY);
    c.ellipse(TX, TY, TRX + 90, TRY + 55, 0, Math.PI, 0, true);
    c.closePath();
    c.fillStyle = '#9a6a3e';
    c.fill();
    ink(c, 2.4);
    c.beginPath();
    c.ellipse(TX, TY, TRX + 90, TRY + 55, 0, 0, Math.PI * 2);
    c.fillStyle = '#d4a46a';
    c.fill();
    ink(c, 2.4);
    c.beginPath();
    c.ellipse(TX, TY, TRX - 110, TRY - 20, 0, 0, Math.PI * 2);
    ink(c, 1.4, 'rgba(59,43,32,0.35)');
    // knots in the wood go round with it, to show it turning
    for (let i = 0; i < 10; i++) {
      const a = g.turn + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 0.45 : 0.8;
      c.beginPath();
      c.ellipse(TX + Math.cos(a) * TRX * r, TY + Math.sin(a) * TRY * r, 14, 4, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(110,70,40,0.45)';
      c.fill();
    }
  }

  function shrike(c, t) {
    const jig = g.shakeT > 0 ? Math.sin(g.shakeT * 70) * (env.reduceMotion ? 4 : 12) : 0;
    const pleased = g.mood > 0 && g.moodKind > 0;
    const flinch = g.mood > 0 && g.moodKind < 0;
    const pose = g.shakeT > 0 ? 1 : pleased ? 2 : flinch ? 3 : 0;
    const bounce = pleased && !env.reduceMotion ? Math.abs(Math.sin(g.mood * 18)) * 8 : 0;
    const shiver = flinch && !env.reduceMotion ? Math.sin(g.mood * 60) * 4 : 0;
    c.save();
    c.translate(g.x + shiver, RAIL_Y);
    c.rotate(-(g.lean || 0));
    c.translate(0, jig - bounce);
    // The painted poses already hang head down, claws on the rail at the top of
    // the cell; the portrait (or stand-in) is turned upside down instead.
    // The painted poses hang from claws at the top of each 1024 px cell; each
    // is placed by its cap's holes (measured per cell) over the salt's line.
    const [capX] = POSE_CAP[pose];
    const PK = (CAP_Y - RAIL_Y) / 772;
    if (!drawSprite(c, 'sprites.shrikePoses', pose, -(capX - 512) * PK, 512 * PK, { h: 1024 * PK, anchor: 'center', whole: true })) {
      c.scale(1, -1);
      if (flinch) c.scale(1, 0.94);
      if (art('subject.saltshakershrike')) {
        drawBird(c, 'saltshakershrike', { x: -PORTRAIT_CAP_DX, y: 0, size: PORTRAIT_SIZE, t, flip: true });
      } else drawBird(c, 'saltshakershrike', { x: 0, y: 0, size: SIZE, t, flip: true });
    }
    c.restore();
    // where the salt will land
    c.save();
    c.globalAlpha = 0.25;
    c.setLineDash([6, 10]);
    c.beginPath();
    c.moveTo(g.x, CAP_Y + 24);
    c.lineTo(g.x, TY + TRY);
    ink(c, 2, '#6a7080');
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'saltshakershrike', W, H, (c) => {
      // a little café: striped wallpaper, a menu board, a clock, the kitchen hatch, a tiled floor
      c.save();
      c.globalAlpha = 0.35;
      for (let x = 0; x < W; x += 80) {
        c.fillStyle = (x / 80) % 2 ? PAL.sage : '#e8e4c8';
        c.fillRect(x, 0, 80, WALL_Y);
      }
      c.restore();
      poly(c, [[1420, 300], [1600, 300], [1600, 520], [1420, 520]], 2, 1);
      wash(c, '#5a4a40', 0.85);
      ink(c, 2.4);
      blob(c, 1510, 380, 40, 30, 3, 0.15);
      wash(c, '#f0f0e8', 0.5); // steam from the kitchen
      poly(c, [[60, 150], [330, 150], [330, 330], [60, 330]], 4, 1);
      wash(c, '#3a4038');
      ink(c, 2.4);
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(90, 190 + i * 36);
        c.lineTo(230 + ((i * 37) % 70), 190 + i * 36);
        ink(c, 3, 'rgba(240,236,220,0.7)');
      }
      c.beginPath();
      c.arc(1340, 220, 44, 0, Math.PI * 2);
      c.fillStyle = '#fbf6e8';
      c.fill();
      ink(c, 2.4);
      c.beginPath();
      c.moveTo(1340, 220);
      c.lineTo(1340, 190);
      c.moveTo(1340, 220);
      c.lineTo(1362, 228);
      ink(c, 2.4);
      // the floor
      poly(c, [[0, WALL_Y], [W, WALL_Y], [W, H], [0, H]], 7, 1);
      wash(c, '#e6dcc8');
      ink(c, 2);
      c.save();
      c.globalAlpha = 0.18;
      c.fillStyle = PAL.slate;
      for (let y = WALL_Y, r = 0; y < H; y += 46, r++) for (let x = (r % 2) * 46; x < W; x += 92) c.fillRect(x, y, 46, 46);
      c.restore();
    });

    diner(c, t); // behind the table: its top hides the diner's waist
    drawTable(c, t);

    // the brass rail
    c.beginPath();
    c.moveTo(0, RAIL_Y);
    c.lineTo(W, RAIL_Y);
    ink(c, 10, '#c9a24a');
    c.beginPath();
    c.moveTo(0, RAIL_Y - 5);
    c.lineTo(W, RAIL_Y - 5);
    ink(c, 1.4);
    for (const bx of [60, W / 2, W - 60]) {
      c.beginPath();
      c.moveTo(bx, 0);
      c.lineTo(bx, RAIL_Y);
      ink(c, 4, '#a08038');
    }


    // spilt salt
    for (const h of g.heaps) {
      c.save();
      c.globalAlpha = Math.min(1, h.life);
      blob(c, h.x, h.y, 18, 5, 3, 0.2);
      wash(c, '#ffffff');
      ink(c, 0.8, '#8a9098');
      c.restore();
    }

    for (const p of [...g.plates].sort((a, b) => a.y - b.y)) {
      const wob = p.wob > 0 ? Math.sin(p.wob * 60) * 2 : 0;
      const drop = p.set * 120; // the cook sets it down
      c.save();
      if (p.set > 0) c.globalAlpha = 1 - p.set * 2;
      if (!drawSprite(c, 'sprites.shrikePlates', p.kind, p.x + wob, p.y + 6 - drop, { w: 200 })) {
        plate(c, p.x, p.y - drop);
        food(c, p.kind, p.x + wob, p.y - drop);
      }
      c.restore();
      // the salt on it
      if (p.got) {
        c.fillStyle = '#ffffff';
        for (let i = 0; i < p.got * 7; i++) {
          const a = i * 2.39;
          const rr = 6 + (i % 7) * 6;
          c.fillRect(p.x + Math.cos(a) * rr * 1.3 - 2, p.y - FOOD_TOP[p.kind] + Math.sin(a) * rr * 0.35, 4, 4);
        }
      }
      flag(c, p, t);
    }

    shrike(c, t);

    // salt in the air
    for (const f of g.puffs) {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 9; i++) {
        const gx = f.x + Math.sin(i * 2.1) * (6 + (f.y - CAP_Y) * 0.06);
        const gy = f.y - i * 7;
        c.fillRect(gx - 2.5, gy - 2.5, 5, 5);
        c.strokeStyle = 'rgba(59,43,32,0.5)';
        c.lineWidth = 1;
        c.strokeRect(gx - 2.5, gy - 2.5, 5, 5);
      }
    }
    for (const s of g.grains) {
      c.save();
      c.globalAlpha = clamp(s.life * 3, 0, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(s.x - 2, s.y - 2, 4, 4);
      c.restore();
    }

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
      hint(c, 'One press, one pinch · shake as many as the flag shows', W / 2, 866, { focus: g.focus(), span: g.span, size: 36, weight: 700, color: INK });
      c.restore();
    }
  };

  g.focus = () => clamp(g.x - 120, 380, W - 380);
  g.span = 900;

  return g;
}
