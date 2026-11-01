// Ten O'clock Tit Trush: Clock Hop.
//
// The Ten O'clock Tit Trush is a gold pocket watch, and it gets about town on
// clock hands. Clocks hang in the air over the town square (the church clock,
// the station clock, the town hall clock, later the cuckoo clock, which runs
// backwards); the Trush perches on the tip of one clock's long hand and is
// carried round and round as it sweeps. A dotted line runs on from the tip
// the way the hand points: press the action to let go, and the Trush flies
// straight along it. Reach another clock and it grabs that clock's hand
// (+1, +2 for a bullseye through the middle of the dial); the clock it left
// chimes and fades, and a new one swings in. Miss them all and it tumbles
// onto the cobbles and flutters back to the clock it left, which costs only
// time. Pressing again before it has a grip on a new hand only makes it
// grab on again. Now and then the gold ten o'clock watch, the Trush's own hour, shows
// up for a few seconds: reaching it is worth three. Every fifth hop in a row
// earns one more. As time goes on the hands sweep faster, the clocks get
// smaller and start to sway and drift, and the dotted line gets shorter.
// Score: points.

import { drawBird, drawSprite, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.watchFace': [1, 1], // the gold watch face, no hands (the ten o'clock bonus clock)
  'sprites.townClocks': [2, 2], // church tower clock, station clock, town hall clock, cuckoo clock: faces without hands
  'sprites.titthrushSing': [1, 1], // the Tit Trush with its beak open, singing (landing)
  'sprites.watchCrown': [1, 1], // the watch's winding crown and ring bow, on top of the gold watch
  'sprites.titthrushFluster': [1, 1], // flustered (a tumble on the cobbles)
  'sprites.titthrushHop': [2, 1], // perched on a hand's tip (claws at 0.5, 0.92), flying (lid shut, case centred)
  'sprites.clockHands': [2, 1], // long hand, short hand; pointing up, the pivot at the cell's centre
});

const DURATION = 45;
const GOLD = 4; // the kind of the gold ten o'clock watch
const KINDS = [
  { name: 'church', rim: '#a9a090', face: '#f2ead8', roman: true, pitch: -5 },
  { name: 'station', rim: '#3a3a40', face: '#fbf8ee', roman: false, pitch: -1 },
  { name: 'town hall', rim: '#c9a83a', face: '#f6efd8', roman: true, pitch: 2 },
  { name: 'cuckoo', rim: '#8a5a30', face: '#efe2c0', roman: false, pitch: 5 },
  { name: 'gold', rim: '#d8b040', face: '#fbf6e4', roman: false, pitch: 9 },
];
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
// Where clock centres may be: kept to the middle of the square so a narrow
// screen sees them all, and low enough that the Trush, perched on a hand
// pointing straight up, stays on screen.
export const BOX = { x0: 470, x1: 1130, y0: 290, y1: 650 };
const GROUND = 830; // the cobbles
const HOP_H = 170; // the Trush's height while hopping
const REACH = 1.2; // the long hand's length, in dial radii (it reaches out past the dial)
const SPEED = 1500; // flight, units a second
const GRIP = 0.25; // seconds after landing before the Trush can let go
const BULL = 0.4; // a bullseye passes this close to the middle, in dial radii
const CATCH = 4; // how far outside the dial a passing Trush still grabs it
const MISS_T = 1.6; // seconds on the cobbles before fluttering back
const BACK_T = 0.45; // the flutter back
const GOLD_LIFE = 6;
// Every painted pose is drawn so the Trush is the same size as when it is
// perched (the pose seen most): each cell is drawn at the perched cell's
// size times the scale the Trush is painted at in the perched cell over the
// scale it is painted at in this one (measured against the portrait:
// design/source/pose-scales.json). Before, the singing and flustered poses
// were drawn at the portrait's framing and the Trush shrank by an eighth
// each time it landed and sang.
const HOP_CELL = HOP_H / 0.7; // the perched and flying cells' width
const PAINTED = { hop: 0.831, fly: 0.789, sing: 0.995, fluster: 0.958 };
const POSE_CELL = { hop: HOP_CELL, fly: (HOP_CELL * PAINTED.hop) / PAINTED.fly, sing: (HOP_CELL * PAINTED.hop) / PAINTED.sing, fluster: (HOP_CELL * PAINTED.hop) / PAINTED.fluster };

const TAU = Math.PI * 2;
const dirOf = (a) => [Math.sin(a), -Math.cos(a)]; // a: 0 = twelve o'clock, clockwise

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    clocks: [],
    on: null, // the clock the Trush rides
    from: null, // the clock it last let go of
    state: 'ride', // ride | fly | fall | back
    bx: 0, // the Trush, while not riding
    by: 0,
    vx: 0,
    vy: 0,
    launch: null, // where and which way it let go: [x, y, dx, dy]
    grip: 0.6,
    missT: 0,
    backT: 0,
    backFrom: [0, 0],
    sing: 0,
    shake: 0,
    streak: 0,
    best: 0,
    hops: 0,
    bulls: 0,
    golds: 0,
    misses: 0,
    fumbles: 0,
    fumbleT: 0,
    goldT: 7, // until the gold watch shows up
    spawnT: 0,
    tickA: 0,
    pops: [],
    bits: [],
    notes: [],
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets the hands' speed, the clocks' size, the dotted
  // line's length, and how much the clocks sway and drift. Each knob: easy,
  // medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.period = () => knob(g.d(), 3.7, 2.95, 2.0); // seconds for the long hand to go round
  g.radius = () => knob(g.d(), 100, 87, 70); // clock face radius, px
  g.aimLen = () => knob(g.d(), 1080, 780, 400); // dotted line's length, px
  g.sway = () => knob(g.d(), 10, 20, 32); // how far a clock sways, px, after the first third
  g.drift = () => knob(g.d(), 0.6, 0.85, 1.15); // drift speed, times 30-60 px/s, after 60%
  const reach = (k) => k.r * REACH;

  function pop(text, x, y, color = INK, size = 44) {
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 180 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x: clamp(x, 470, W - 470), y: Math.max(y, 150), color, size, life: 1.3 });
  }

  // ---------- the clocks ----------

  function apart(a, b) {
    return a.r + b.r + Math.max(reach(a), reach(b)) + 40;
  }
  function makeClock(kind, x, y, r) {
    return {
      kind, x, y, bx: x, by: y, r,
      a: rng() * TAU,
      hour: kind === GOLD ? (10 / 12) * TAU : rng() * TAU,
      dir: kind === 3 ? -1 : 1,
      born: 0,
      fade: 0, // fading out once left (or the gold watch's time is up)
      ring: 0,
      phase: rng() * TAU,
      sway: progress() > 1 / 3 ? g.sway() : 0,
      vx: progress() > 0.6 ? (rng() < 0.5 ? -1 : 1) * lerp(30, 60, rng()) * g.drift() : 0,
      life: kind === GOLD ? GOLD_LIFE : Infinity,
    };
  }
  // A new clock never swings in just where the hand is about to point: it
  // comes round to it.
  function ahead(x, y, r) {
    if (!g.on) return false;
    const bearing = Math.atan2(x - g.on.x, -(y - g.on.y));
    const half = Math.asin(Math.min(1, (r + CATCH) / Math.max(1, Math.hypot(x - g.on.x, y - g.on.y)))) + 0.1;
    const sweep = (TAU / g.period()) * 0.8; // the next 0.8 s of the hand
    let d = (bearing - g.on.a) * g.on.dir;
    d = ((d % TAU) + TAU) % TAU;
    return d < sweep + half || d > TAU - half;
  }
  // Somewhere free, a hop away from the clock the Trush is on.
  function place(kind, r, strict = false) {
    const probe = { r };
    let best = null;
    let bestScore = -Infinity;
    for (let k = 0; k < 200; k++) {
      const x = lerp(BOX.x0, BOX.x1, rng());
      const y = lerp(BOX.y0, BOX.y1, rng());
      let worst = Infinity;
      for (const c of g.clocks) {
        if (c.fade > 0) continue;
        const d = Math.hypot(c.x - x, c.y - y) - apart(c, probe);
        worst = Math.min(worst, d);
      }
      const far = g.on ? Math.hypot(g.on.x - x, g.on.y - y) : 500;
      const score = Math.min(worst, 0) * 4 - Math.max(0, far - 720) - (ahead(x, y, r) ? 200 : 0);
      if (worst >= 0 && far <= 720 && !ahead(x, y, r)) return makeClock(kind, x, y, r);
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
    return strict ? null : makeClock(kind, best[0], best[1], r);
  }
  function pickKind() {
    const kinds = progress() > 0.33 ? [0, 1, 2, 3] : [0, 1, 2];
    const used = g.clocks.filter((c) => c.fade <= 0).map((c) => c.kind);
    const fresh = kinds.filter((k) => !used.includes(k));
    const from = fresh.length ? fresh : kinds;
    return from[Math.floor(rng() * from.length)];
  }
  function spawn(kind = pickKind()) {
    const c = place(kind, kind === GOLD ? g.radius() * 0.85 : g.radius() * (0.92 + rng() * 0.16), kind === GOLD);
    if (!c) return null; // no room for the gold watch just now
    g.clocks.push(c);
    sfx('ui');
    return c;
  }
  const targets = () => g.clocks.filter((c) => c !== g.on && c.fade <= 0);
  const plain = () => targets().filter((c) => c.kind !== GOLD).length;

  // The start: the church clock in the middle and two more.
  {
    const first = makeClock(0, 800, 470, g.radius());
    first.a = (10 / 12) * TAU; // ten o'clock, of course
    first.born = 1;
    g.clocks.push(first);
    g.on = first;
    for (let i = 0; i < 2; i++) spawn().born = 1;
  }

  // The tip of a clock's long hand, where the Trush perches.
  g.tip = (k = g.on) => {
    const [dx, dy] = dirOf(k.a);
    return [k.x + dx * reach(k), k.y + dy * reach(k)];
  };

  // The first clock the dotted line (run on as far as it likes) passes
  // through, and how near its middle (0 = dead centre, 1 = the dial's edge).
  g.aim = (a = g.on.a) => {
    const [dx, dy] = dirOf(a);
    const x = g.on.x + dx * reach(g.on);
    const y = g.on.y + dy * reach(g.on);
    let hit = null;
    for (const c of targets()) {
      const rx = c.x - x;
      const ry = c.y - y;
      const along = rx * dx + ry * dy;
      if (along <= 0) continue;
      const off = Math.abs(rx * dy - ry * dx);
      if (off > c.r + CATCH) continue;
      if (!hit || along < hit.dist) hit = { clock: c, off: off / c.r, dist: along };
    }
    return hit;
  };

  // ---------- hopping ----------

  function letGo() {
    const [x, y] = g.tip();
    const [dx, dy] = dirOf(g.on.a);
    g.state = 'fly';
    g.bx = x;
    g.by = y;
    g.vx = dx * SPEED;
    g.vy = dy * SPEED;
    g.launch = [x, y, dx, dy];
    g.from = g.on;
    g.on = null;
    sfx('shuffle');
    sfx('catch', { pitch: 7 });
  }

  function land(c) {
    const [x0, y0, dx, dy] = g.launch;
    const off = Math.abs((c.x - x0) * dy - (c.y - y0) * dx) / c.r;
    const bull = off <= BULL;
    const gold = c.kind === GOLD;
    let worth = gold ? 3 : 1;
    if (bull) worth++;
    g.hops++;
    g.streak++;
    g.best = Math.max(g.best, g.streak);
    if (bull) g.bulls++;
    if (gold) {
      g.golds++;
      c.life = Infinity;
    }
    g.score += worth;
    const ty = c.y - c.r - 70;
    if (gold) pop(`Ten o’clock! Tit-trush! +${worth}`, c.x, ty, PAL.magenta, 46);
    else if (bull) pop('Bullseye! +2', c.x, ty, PAL.magenta, 46);
    else pop(c.kind === 3 ? 'Cuckoo! +1' : '+1', c.x, ty, INK, 44);
    if (g.streak % 5 === 0) {
      g.score++;
      pop(`${g.streak} in a row! +1`, c.x, ty - 52, PAL.ochre, 40);
      sfx('medal', { level: Math.min(2, g.streak / 5 - 1) });
    }
    // grab the hand where it arrives
    c.a = Math.atan2(g.bx - c.x, -(g.by - c.y));
    c.ring = 1;
    g.on = c;
    g.state = 'ride';
    g.grip = GRIP;
    g.sing = 0.55;
    g.shake = 0.15;
    sfx('ding', { pitch: KINDS[c.kind].pitch });
    if (bull || gold) sfx('right');
    if (gold) sfx('bloom');
    env.vibrate?.(bull || gold ? 40 : 25);
    for (let i = 0; i < (bull || gold ? 16 : 9); i++) {
      const a = (i / 9) * TAU + rng() * 0.5;
      const v = 160 + rng() * 220;
      g.bits.push({ kind: 'star', x: g.bx, y: g.by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + rng() * 0.3, color: gold ? PAL.mustard : bull ? PAL.magenta : PAL.ochre });
    }
    for (let i = 0; i < 3; i++) g.notes.push({ x: g.bx - 30, y: g.by - HOP_H, vx: -50 + i * 50, vy: -110 - i * 25, life: 1 });
    // the clock it left chimes and goes, and another swings in
    if (g.from && g.from !== c) {
      g.from.fade = 0.001;
      g.from.ring = 1;
    }
    g.from = null;
    g.spawnT = 0.3;
  }

  function miss(onGround) {
    g.misses++;
    g.streak = 0;
    g.state = 'fall';
    g.missT = MISS_T;
    g.shake = onGround ? 0.3 : 0;
    if (onGround) {
      g.by = GROUND;
      g.vy = -380;
      g.vx *= 0.15;
      sfx('bonk');
      for (let i = 0; i < 8; i++) g.bits.push({ kind: 'dust', x: g.bx + (rng() - 0.5) * 60, y: GROUND, vx: (rng() - 0.5) * 240, vy: -60 - rng() * 140, life: 0.5 });
    } else {
      // off the edge: it drops back in and tumbles down onto the cobbles
      g.bx = clamp(g.bx, 90, W - 90);
      g.by = clamp(g.by, -60, GROUND);
      g.vx = g.bx < W / 2 ? 120 : -120;
      g.vy = 0;
      sfx('miss');
    }
    sfx('wilt');
    env.vibrate?.(60);
    pop(onGround ? 'Bump! Missed' : 'Whoops! Missed', g.bx, GROUND - 230, PAL.brick, 40);
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.kind = input.kind;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }
    const t = g.elapsed;
    g.sing = Math.max(0, g.sing - dt);
    g.shake = Math.max(0, g.shake - dt);
    g.grip = Math.max(0, g.grip - dt);

    // The clocks: hands sweep round, some sway and drift, the left ones fade.
    const w = TAU / g.period();
    for (const c of g.clocks) {
      c.born = Math.min(1, c.born + dt / 0.35);
      c.ring = Math.max(0, c.ring - dt * 1.6);
      c.a += c.dir * w * dt;
      c.hour += c.dir * (w / 12) * dt;
      if (c.vx) {
        c.bx += c.vx * dt;
        if (c.bx < BOX.x0 || c.bx > BOX.x1) {
          c.vx = -c.vx;
          c.bx = clamp(c.bx, BOX.x0, BOX.x1);
        }
      }
      c.x = c.bx;
      c.y = c.by + Math.sin(t * 1.7 + c.phase) * c.sway;
      if (c.life !== Infinity && c !== g.on) {
        c.life -= dt;
        if (c.life <= 0 && c.fade <= 0) c.fade = 0.001;
      }
      if (c.fade > 0) c.fade += dt / 0.45;
    }
    g.clocks = g.clocks.filter((c) => c.fade < 1 || c === g.on || c === g.from);

    // Keep two clocks to hop to, and now and then the gold watch.
    if (g.spawnT > 0) g.spawnT -= dt;
    if (g.spawnT <= 0 && g.state === 'ride' && plain() < 2) spawn();
    g.goldT -= dt;
    if (g.goldT <= 0) {
      g.goldT = 8 + rng() * 3;
      if (g.state === 'ride' && !g.clocks.some((c) => c.kind === GOLD && c.fade <= 0)) {
        const c = spawn(GOLD);
        if (c) {
          sfx('ding', { pitch: 12 });
          pop('The gold watch! +3', c.x, c.y - c.r * 1.5 - 40, PAL.mustard, 40);
        } else g.goldT = 1; // try again in a moment
      }
    }

    if (g.state === 'ride') {
      // a tick for every hour mark the long hand passes
      const steps = Math.floor((g.on.a * 12) / TAU);
      if (steps !== g.tickA) sfx('tick');
      g.tickA = steps;
      if (input.actionPressed) {
        if (g.grip <= 0) letGo();
        else {
          // too soon: it hasn't a grip yet, and has to grab on again
          g.grip = GRIP;
          g.fumbles++;
          g.shake = 0.2;
          sfx('bonk');
          if (g.fumbles === 1 || g.elapsed - g.fumbleT > 2) pop('Hold on!', g.tip()[0], g.tip()[1] - HOP_H - 30, PAL.brick, 36);
          g.fumbleT = g.elapsed;
        }
      }
    } else if (g.state === 'fly') {
      const n = Math.ceil((SPEED * dt) / 20);
      for (let i = 0; i < n && g.state === 'fly'; i++) {
        g.bx += (g.vx * dt) / n;
        g.by += (g.vy * dt) / n;
        const hit = targets().find((c) => c !== g.from && c.born > 0.3 && Math.hypot(c.x - g.bx, c.y - g.by) < c.r + CATCH);
        if (hit) land(hit);
        else if (g.by >= GROUND) miss(true);
        else if (g.bx < -120 || g.bx > W + 120 || g.by < -160) miss(false);
      }
    } else if (g.state === 'fall') {
      g.missT -= dt;
      g.vy += 1800 * dt;
      g.bx += g.vx * dt;
      g.by = Math.min(GROUND, g.by + g.vy * dt);
      if (g.by >= GROUND && g.vy > 0) {
        if (g.vy > 300) {
          sfx('bonk');
          g.shake = 0.2;
        }
        g.vy = -g.vy * 0.35;
        g.vx *= 0.5;
      }
      if (g.missT <= 0) {
        g.state = 'back';
        g.backT = 0;
        g.backFrom = [clamp(g.bx, -60, W + 60), clamp(g.by, -60, GROUND)];
      }
    } else if (g.state === 'back') {
      g.backT += dt / BACK_T;
      const [tx, ty] = g.tip(g.from);
      const k = Math.min(1, g.backT);
      g.bx = lerp(g.backFrom[0], tx, k);
      g.by = lerp(g.backFrom[1], ty, k) - Math.sin(k * Math.PI) * 120;
      if (k >= 1) {
        g.on = g.from;
        g.from = null;
        g.state = 'ride';
        g.grip = GRIP;
      }
    }

    for (const b of g.bits) {
      b.vy += (b.kind === 'dust' ? 500 : 200) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    g.bits = g.bits.filter((b) => b.life > 0);
    for (const n of g.notes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.life -= dt;
    }
    g.notes = g.notes.filter((n) => n.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Points ${g.score}${g.streak >= 2 ? ` · ${g.streak} in a row` : ''}`;
  g.summary = () => {
    const lines = [`${g.hops} hop${g.hops === 1 ? '' : 's'} from clock to clock${g.bulls ? `, ${g.bulls} of them bullseye${g.bulls === 1 ? '' : 's'}` : ''}.`];
    if (g.golds) lines.push(`Reached the gold ten o’clock watch ${g.golds === 1 ? 'once' : `${g.golds} times`}.`);
    lines.push(g.misses ? `Longest run: ${g.best} in a row; ${g.misses} tumble${g.misses === 1 ? '' : 's'} on the cobbles.` : 'Not a single tumble!');
    return lines;
  };

  // ---------- drawing ----------

  function standinSquare(c) {
    band(c, 0, 0, W, 560, '#e8d8a8', 0.5, 1);
    band(c, 0, 0, W, 200, '#e0b890', 0.3, 2);
    const fronts = ['#d9a4a0', '#c9c09a', '#b8c0a0', '#d0b890', '#c0a8b8'];
    for (let i = 0; i < 8; i++) {
      const x0 = -40 + i * 215;
      const tall = 230 + ((i * 61) % 110);
      poly(c, [[x0, 640], [x0, 640 - tall], [x0 + 100, 560 - tall], [x0 + 200, 640 - tall], [x0 + 200, 640]], i + 5, 1.5);
      wash(c, fronts[i % fronts.length], 0.45);
      ink(c, 1.4);
    }
    band(c, 0, 640, W, H - 640, '#b8b0a0', 0.6, 9);
    c.save();
    c.globalAlpha = 0.3;
    for (let y = 670; y < H; y += 34) {
      for (let x = ((y / 34) % 2) * 30; x < W; x += 60) {
        blob(c, x, y, 26, 12, x + y, 0.15, 10);
        ink(c, 1.2);
        c.stroke();
      }
    }
    c.restore();
  }

  // A tapered hand from the pivot, pointing at angle a, `len` long.
  function hand(c, x, y, a, len, width, cell) {
    const key = 'sprites.clockHands';
    // the delivered hands point up with the pivot at the cell's centre: the
    // long hand's tip is 0.46 of the cell above it, the short one's 0.26
    if (drawSprite(c, key, cell, x, y, { w: len / (cell ? 0.26 : 0.46), anchor: 'center', whole: true, rot: a })) return;
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(-width * 0.6, len * 0.18);
    c.lineTo(-width * 0.5, -len * 0.7);
    c.lineTo(0, -len);
    c.lineTo(width * 0.5, -len * 0.7);
    c.lineTo(width * 0.6, len * 0.18);
    c.closePath();
    c.fillStyle = '#2c2c40';
    c.fill();
    ink(c, 1.4);
    c.stroke();
    if (!cell) {
      // a knob at the tip for the Trush to hold
      c.beginPath();
      c.arc(0, -len, width * 0.55, 0, TAU);
      c.fillStyle = '#2c2c40';
      c.fill();
      ink(c, 1.2);
      c.stroke();
    }
    c.restore();
  }

  function standinClock(c, k) {
    const C = KINDS[k.kind];
    const R = k.r;
    const s = R / 130;
    c.save();
    c.scale(s, s);
    const TR = 130;
    if (k.kind === 0) {
      poly(c, [[-TR - 30, -TR - 40], [0, -TR - 120], [TR + 30, -TR - 40], [TR + 30, TR + 40], [-TR - 30, TR + 40]], 1, 1.5);
      wash(c, '#c8bca8');
      ink(c, 2.4);
      hatch(c, -TR - 30, -TR - 110, TR + 30, TR + 40, 18, 0.15, 1);
    } else if (k.kind === 1) {
      c.beginPath();
      c.moveTo(0, -TR - 10);
      c.lineTo(0, -TR - 70);
      c.lineTo(TR + 40, -TR - 70);
      ink(c, 10, '#3a3a40');
      c.stroke();
    } else if (k.kind === 3) {
      poly(c, [[-TR - 40, -TR + 10], [0, -TR - 110], [TR + 40, -TR + 10], [TR + 30, TR + 60], [-TR - 30, TR + 60]], 4, 1.5);
      wash(c, '#a8784a');
      ink(c, 2.4);
    } else if (k.kind === 2) {
      for (const sx of [-1, 1]) {
        blob(c, sx * (TR + 10), 20, 26, 70, sx + 3, 0.2);
        wash(c, PAL.green, 0.7);
        ink(c, 1.4);
      }
    }
    c.beginPath();
    c.arc(0, 0, TR + 14, 0, TAU);
    c.fillStyle = C.rim;
    c.fill();
    ink(c, 2.4);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, TR, 0, TAU);
    c.fillStyle = C.face;
    c.fill();
    ink(c, 1.6);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      label(c, C.roman ? ROMAN[i] : String(i || 12), Math.sin(a) * (TR - 28), -Math.cos(a) * (TR - 28), { size: C.roman ? 22 : 26, weight: 700 });
    }
    c.restore();
  }

  function drawClock(c, k, t) {
    const grow = k.born < 1 ? 1 - Math.pow(1 - k.born, 3) + Math.sin(k.born * Math.PI) * 0.12 : 1;
    const fade = clamp(1 - k.fade, 0, 1);
    const wob = k.ring > 0 && !env.reduceMotion ? Math.sin(k.ring * 30) * 0.06 * k.ring : 0;
    c.save();
    c.globalAlpha *= fade;
    c.translate(k.x, k.y);
    c.scale(grow * (1 + (1 - fade) * 0.2), grow * (1 + (1 - fade) * 0.2));
    c.save();
    c.rotate(wob);
    if (k.kind === GOLD) {
      // the gold watch: its face (tick ring 0.36 of the image round 0.5, 0.495), the crown on top
      const fw = k.r / 0.36;
      const glow = 0.3 + 0.2 * Math.sin(t * 6);
      c.save();
      c.globalAlpha *= glow;
      const grd = c.createRadialGradient(0, 0, k.r * 0.8, 0, 0, k.r * 1.9);
      grd.addColorStop(0, 'rgba(255,230,140,0.9)');
      grd.addColorStop(1, 'rgba(255,230,140,0)');
      c.fillStyle = grd;
      c.fillRect(-k.r * 2, -k.r * 2, k.r * 4, k.r * 4);
      c.restore();
      const top = -fw * 0.5 + 0.028 * fw + 0.005 * fw;
      if (!drawSprite(c, 'sprites.watchCrown', 0, 0, top + 6, { h: k.r * 0.42 })) {
        poly(c, [[-12, top - 34], [12, top - 34], [12, top + 4], [-12, top + 4]], 3, 0.8);
        wash(c, '#d8b040');
        ink(c, 1.8);
      }
      if (!drawSprite(c, 'sprites.watchFace', 0, 0, 0.005 * fw, { w: fw, anchor: 'center', whole: true })) {
        c.beginPath();
        c.arc(0, 0, k.r * 1.25, 0, TAU);
        c.fillStyle = '#d8b040';
        c.fill();
        ink(c, 2.6);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, k.r * 1.04, 0, TAU);
        c.fillStyle = '#fbf6e4';
        c.fill();
        ink(c, 1.8);
        c.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          label(c, String(i || 12), Math.sin(a) * k.r * 0.8, -Math.cos(a) * k.r * 0.8, { size: k.r * 0.22, weight: 700 });
        }
      }
      // how long it will wait: a gold arc round the case
      if (k.life !== Infinity) {
        c.beginPath();
        c.arc(0, 0, k.r * 1.38, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(k.life / GOLD_LIFE, 0, 1));
        ink(c, 6, k.life < 2 && Math.sin(t * 14) > 0 ? PAL.brick : PAL.mustard);
        c.stroke();
      }
    } else if (!drawSprite(c, 'sprites.townClocks', k.kind, 0, 0, { w: k.r * 4, anchor: 'center', whole: true })) {
      standinClock(c, k);
    }
    c.restore();
    // its hands (not wobbling with the frame, so the aim stays true)
    c.restore();
    c.save();
    c.globalAlpha *= fade;
    hand(c, k.x, k.y, k.hour, k.r * 0.55, k.r * 0.13, 1);
    hand(c, k.x, k.y, k.a, reach(k), k.r * 0.09, 0);
    c.beginPath();
    c.arc(k.x, k.y, k.r * 0.07, 0, TAU);
    c.fillStyle = PAL.ochre;
    c.fill();
    ink(c, 1.4);
    c.stroke();
    if (k.dir < 0 && k.fade <= 0) {
      // a little backwards arrow over the cuckoo clock
      c.beginPath();
      c.arc(k.x, k.y, k.r + 22, -Math.PI * 0.35, -Math.PI * 0.65, true);
      ink(c, 3, PAL.brick);
      c.stroke();
      const ax = k.x + Math.cos(-Math.PI * 0.65) * (k.r + 22);
      const ay = k.y + Math.sin(-Math.PI * 0.65) * (k.r + 22);
      poly(c, [[ax - 12, ay - 6], [ax + 6, ay - 12], [ax + 2, ay + 8]], 2, 0.3);
      c.fillStyle = PAL.brick;
      c.fill();
    }
    c.restore();
  }

  // The dotted line on from the hand's tip.
  function drawAim(c, t) {
    if (g.state !== 'ride' || !g.on) return;
    const [x, y] = g.tip();
    const [dx, dy] = dirOf(g.on.a);
    const hit = g.aim();
    const len = g.aimLen();
    const lined = hit && hit.dist <= len + hit.clock.r;
    const col = !lined ? INK : hit.clock.kind === GOLD ? PAL.mustard : PAL.magenta;
    const ready = g.grip <= 0;
    c.save();
    for (let s = 34, i = 0; s < len; s += 26, i++) {
      const k = 1 - s / len;
      c.globalAlpha = (lined ? 1 : 0.8) * Math.min(1, k * 2.5) * (ready ? 1 : 0.45);
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, lined ? 8 : 6, 0, TAU);
      c.fillStyle = col;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.stroke();
    }
    c.restore();
    if (lined) {
      // ring the clock it would reach
      const k = hit.clock;
      c.save();
      c.setLineDash([12, 10]);
      c.lineDashOffset = -t * 40;
      c.beginPath();
      c.arc(k.x, k.y, k.r + CATCH + 6, 0, TAU);
      ink(c, hit.off <= BULL ? 5 : 3, col);
      c.stroke();
      c.restore();
    }
  }

  function drawTrush(c, t) {
    let x = g.bx;
    let y = g.by;
    if (g.state === 'ride' && g.on) [x, y] = g.tip();
    if (g.state === 'ride') {
      const sh = g.shake > 0 && !env.reduceMotion ? Math.sin(g.shake * 70) * 3 : 0;
      c.save();
      c.translate(x + sh, y);
      if (g.sing > 0) {
        if (!drawSprite(c, 'sprites.titthrushSing', 0, 0, (1 - 0.98) * POSE_CELL.sing, { w: POSE_CELL.sing, whole: true })) drawBird(c, 'titthrush', { x: 0, y: 0, size: HOP_H, t, squash: Math.sin(g.sing * 20) * 0.08 });
      } else {
        // perched: the claws (0.5, 0.92 of the cell) on the tip
        const cell = POSE_CELL.hop;
        if (!drawSprite(c, 'sprites.titthrushHop', 0, 0, 0.08 * cell, { w: cell, whole: true })) drawBird(c, 'titthrush', { x: 0, y: 0, size: HOP_H, t });
      }
      c.restore();
    } else if (g.state === 'fly' || g.state === 'back') {
      const dx = g.state === 'fly' ? g.vx : g.tip(g.from)[0] - g.backFrom[0];
      const dy = g.state === 'fly' ? g.vy : -1;
      const right = dx > 0;
      const ang = Math.atan2(dy, dx);
      const rot = right ? ang : ang - Math.PI;
      // a streak behind it
      if (g.state === 'fly') {
        c.save();
        c.globalAlpha = 0.35;
        for (let i = 1; i <= 5; i++) {
          c.beginPath();
          c.arc(x - (g.vx / SPEED) * i * 26, y - (g.vy / SPEED) * i * 26, 7 - i, 0, TAU);
          c.fillStyle = PAL.mustard;
          c.fill();
        }
        c.restore();
      }
      c.save();
      c.translate(x, y);
      const cell = POSE_CELL.fly;
      if (!drawSprite(c, 'sprites.titthrushHop', 1, 0, 0, { w: cell, anchor: 'center', whole: true, flip: right, rot: g.state === 'fly' ? rot : 0 })) {
        c.rotate(g.state === 'fly' ? rot * 0.6 : 0);
        drawBird(c, 'titthrush', { x: 0, y: HOP_H * 0.5, size: HOP_H, t, flip: right });
      }
      c.restore();
    } else {
      // tumbled on the cobbles
      c.save();
      c.translate(x, y);
      if (!drawSprite(c, 'sprites.titthrushFluster', 0, 0, (1 - 0.979) * POSE_CELL.fluster, { w: POSE_CELL.fluster, whole: true })) {
        if (!env.reduceMotion) c.rotate(Math.sin(t * 40) * 0.08);
        drawBird(c, 'titthrush', { x: 0, y: 0, size: HOP_H, t });
      }
      c.restore();
    }
    for (const n of g.notes) {
      c.save();
      c.globalAlpha = clamp(n.life, 0, 1);
      c.beginPath();
      c.ellipse(n.x, n.y, 10, 7, -0.4, 0, TAU);
      c.fillStyle = PAL.magenta;
      c.fill();
      c.beginPath();
      c.moveTo(n.x + 9, n.y - 2);
      c.lineTo(n.x + 9, n.y - 34);
      c.quadraticCurveTo(n.x + 23, n.y - 26, n.x + 20, n.y - 16);
      ink(c, 3, PAL.magenta);
      c.stroke();
      c.restore();
    }
  }

  g.draw = (c, t) => {
    scene(c, 'titthrush', W, H, standinSquare);
    // a soft shadow on the cobbles under the Trush
    const sx = g.state === 'ride' && g.on ? g.tip()[0] : g.bx;
    c.save();
    c.globalAlpha = 0.15;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(sx, GROUND + 6, 50, 9, 0, 0, TAU);
    c.fill();
    c.restore();

    for (const k of g.clocks) if (k !== g.on) drawClock(c, k, t);
    if (g.on) drawClock(c, g.on, t);
    drawAim(c, t);
    drawTrush(c, t);

    for (const b of g.bits) {
      c.save();
      c.globalAlpha = clamp(b.life * 2, 0, 1);
      if (b.kind === 'star') {
        c.translate(b.x, b.y);
        c.rotate(b.life * 6);
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 4 : 11;
          pts.push([Math.cos((i / 10) * TAU) * r, Math.sin((i / 10) * TAU) * r]);
        }
        poly(c, pts, 1, 0.2);
        c.fillStyle = b.color;
        c.fill();
        ink(c, 1);
      } else {
        blob(c, b.x, b.y, 9, 6, 1, 0.2, 8);
        wash(c, '#c8bca8', 0.8);
      }
      c.restore();
    }

    for (const p of g.pops) {
      const k = Math.min(1, (1.3 - p.life) * 8);
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      label(c, p.text, 0, 0, { size: p.size, color: p.color, weight: 800, halo: true });
      c.restore();
    }

    if (g.elapsed < 5) {
      c.save();
      c.globalAlpha = Math.min(1, 5 - g.elapsed);
      const how = g.kind === 'pointer' ? 'Tap' : g.kind === 'controller' ? 'Press A' : 'Press Space';
      hint(c, `${how} when the dotted line points at a clock · through the middle is a bullseye`, W / 2, 870, { focus: g.focus(), span: g.span, size: 30 });
      c.restore();
    }
  };

  // On a narrow screen: the middle of the square, where all the clocks are.
  g.focus = () => 800;
  g.span = 1060;

  return g;
}
