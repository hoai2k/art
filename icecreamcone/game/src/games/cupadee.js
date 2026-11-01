// Cupadee: Tea Time.
//
// A row of Cupadees walks in under the hanging teapot, one at a time. Hold
// the action to tip the pot and pour; let go when the tea reaches the line
// on the cup. The stream takes a moment to fall, so the tea still in the air
// lands after you let go: let go a touch early. Close to the line scores,
// right on it is Perfect, and Perfects in a row build a combo. Fill past the
// brim and it spills: no points, a squawk, and the combo is gone. Later cups
// are smaller (they fill faster), bob up and down, or stroll on under the
// spout while you pour: the first third is big, still cups, and the mix
// hardens over the round along the shared difficulty curve (`g.d()`, see
// difficulty.js). Score: points.

import { drawBird, drawSprite, art, scene, band, blob, poly, wash, ink, hatch, eye, label, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

const DURATION = 45;
// The Cupadees walk along the top of the table in the painted scene (its
// top runs from y 565 at the back to 690 at the front edge).
const GROUND = 655;
const GRAVITY = 2600;
const FLOW = 0.42; // cup-fulls (of a big cup) per second at full tip

// The teapot hangs from a cord; it tips about its middle.
const POT_X = 830;
const POT_Y = 230;
// The painted teapot (1024px cell), drawn at POT_K about its middle (the
// pivot, in image px); its spout tip and cord loop measured from the image.
const POT_K = 0.38;
const POT_PIVOT = [590, 600];
const potPoint = (px, py) => [(px - POT_PIVOT[0]) * POT_K, (py - POT_PIVOT[1]) * POT_K];
const SPOUT = potPoint(128, 392); // the spout's tip, in the pot's own units
const POT_LOOP = potPoint(805, 165); // the top of the cord loop
const POT_TIP = -0.5; // radians at full tip

function spoutAt(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: POT_X + SPOUT[0] * c - SPOUT[1] * s, y: POT_Y + SPOUT[0] * s + SPOUT[1] * c };
}
const STREAM_X = spoutAt(POT_TIP).x - 4; // where the stream comes down
const QUEUE_GAP = 300;

// The painted open cup (cupadee-open.png, 1024px): its inside rim ellipse in
// image px, turned into bird units (PORTRAIT.cupadee: cx 0.55, feet 0.93, u 372).
const toBird = (px, py) => [(px / 1024 - 0.55) * 372, (py / 1024 - 0.93) * 372];
const [IN_X, IN_Y] = toBird(560, 168);
const IN_RX = (186 / 1024) * 372;
const IN_RY = (44 / 1024) * 372;
const painted = () => !!(art('bird.cupadee') && art('sprites.cupadeeOpen'));
// The tea's surface as the ellipse seen from above at fill f (0 empty .. 1 brim):
// it grows from a pool at the back of the cup to the full rim.
const surface = (f) => {
  const k = 0.3 + 0.7 * f;
  return { x: IN_X, y: IN_Y + (1 - f) * IN_RY * 0.55, rx: IN_RX * k, ry: IN_RY * k };
};

// Cup geometry, in the stand-in Cupadee's units (draw.js): the cup is drawn
// about (0, -225) from the feet, rim at -55, bottom at 60.
const CUP = [[-90, -55], [90, -55], [70, 40], [40, 60], [-40, 60], [-70, 40]];
const LEVEL = (f) => 52 - f * 104; // tea surface height in cup units, 0 empty .. 1 brim
const halfWidth = (y) => (y < 40 ? 90 - ((y + 55) / 95) * 20 : 70 - ((y - 40) / 20) * 30);

const SIZES = {
  big: { size: 350, cap: 1 },
  small: { size: 290, cap: 0.64 },
  tiny: { size: 240, cap: 0.45 },
};

const GRADES = [
  { name: 'Perfect!', within: 0.04, points: 100, color: '#c0407a' },
  { name: 'Great!', within: 0.09, points: 60, color: '#4a7a3a' },
  { name: 'Good', within: 0.16, points: 30, color: INK },
];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    tip: 0, // 0..1, how far the pot is tipped
    pouring: false,
    birds: [], // { x, y, size, cap, motion, line, fill, state, ... }
    parcels: [], // falling tea: { x, y, vx, vy, vol }
    drops: [], // splashes
    puddles: [],
    pops: [], // popping text
    made: 0, // Cupadees sent in so far
    served: 0,
    perfects: 0,
    spills: 0,
    streak: 0,
    bestStreak: 0,
    flash: 0,
    pourSound: 0,
    streamX: STREAM_X, // where the stream lands (for tests and bots)
  };

  // The front bird: the first one not yet done.
  const front = () => g.birds.find((b) => b.state === 'walk' || b.state === 'serve') || null;

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js). Each Cupadee
  // takes its cup from it as it joins the queue: big, still cups and a line
  // near the middle at first; then smaller cups, bobbing and strolling ones,
  // and lines further off. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  g.lineSpread = () => knob(g.d(), 0.1, 0.27, 0.3); // how far the line strays, in cup-fulls (total width)
  g.tinyChance = () => knob(g.d(), 0, 0.07, 0.4); // share of tiny cups
  g.smallChance = () => knob(g.d(), 0, 0.58, 0.65); // share of small (or tiny) cups
  g.bobChance = () => knob(g.d(), 0, 0.2, 0.3); // share of bobbing Cupadees
  g.strollChance = () => knob(g.d(), 0, 0.1, 0.45); // share of strolling ones
  g.strollSpeed = () => knob(g.d(), 34, 49, 68); // px/s a strolling Cupadee walks on
  g.patienceNow = () => knob(g.d(), 5.5, 4.6, 3.5); // seconds before a Cupadee gives up

  function makeBird() {
    const n = g.made++;
    let size = 'big';
    let motion = 'still';
    let line = 0.72;
    if (n >= 2) {
      line = 0.72 + (rng() - 0.5) * g.lineSpread();
      const r = rng();
      if (r < g.tinyChance()) size = 'tiny';
      else if (r < g.smallChance()) size = 'small';
      const m = rng();
      if (m < g.bobChance()) motion = 'bob';
      else if (m < g.bobChance() + g.strollChance()) motion = 'stroll';
    }
    const S = SIZES[size];
    g.birds.push({
      x: Math.max(W + 220, ...g.birds.map((b) => b.x + QUEUE_GAP)),
      size: S.size,
      cap: S.cap,
      kind: size,
      motion,
      line,
      fill: 0,
      state: 'queue',
      phase: rng() * 6,
      walk: 0,
      hop: 0,
      squash: 0,
      tilt: 0,
      wait: 0,
      settle: 0,
      patience: g.patienceNow(),
      grade: null,
    });
  }

  // Where the front of the cup's rim is, in the world.
  function rim(b) {
    const s = b.size / 400;
    if (painted()) return { x: b.x + IN_X * s, y: b.y + IN_Y * s * (1 - b.squash) + b.hop, half: IN_RX * 0.95 * s };
    return { x: b.x, y: b.y - 280 * s * (1 - b.squash) + b.hop, half: 84 * s };
  }

  function pop(text, x, y, color = INK, size = 46) {
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  function splash(x, y, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      g.drops.push({ x, y, vx: (rng() - 0.5) * 420 * spread, vy: -150 - rng() * 320, life: 0.6 + rng() * 0.4, r: 3 + rng() * 4 });
    }
  }

  function judge(b) {
    b.state = 'done';
    b.doneT = 0;
    const r = rim(b);
    if (b.fill <= 0.001) {
      g.streak = 0;
      b.grade = 'thirsty';
      pop('Thirsty…', r.x, r.y - 90, '#8a6a5a', 40);
      sfx('wrong');
      return;
    }
    g.served++;
    const err = Math.abs(b.fill - b.line);
    const grade = GRADES.find((gr) => err <= gr.within);
    if (!grade) {
      g.streak = 0;
      const pts = b.fill > 0.25 ? 10 : 0;
      g.score += pts;
      b.grade = 'miss';
      pop(b.fill < b.line ? 'A bit low' : 'A bit high', r.x, r.y - 90, '#8a6a5a', 40);
      if (pts) pop(`+${pts}`, r.x + 10, r.y - 140, '#8a6a5a', 34);
      sfx('tick');
      return;
    }
    let pts = grade.points;
    if (grade.points >= 60) {
      g.streak++;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      pts += Math.min(g.streak - 1, 5) * 10;
    } else g.streak = 0;
    if (grade.points === 100) {
      g.perfects++;
      g.flash = 0.18;
      sfx('right');
      env.vibrate?.(40);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        g.drops.push({ x: r.x, y: r.y - 20, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320 - 120, life: 0.7, r: 5, star: true });
      }
    } else sfx('ding', { pitch: grade.points >= 60 ? 4 : 0 });
    g.score += pts;
    b.grade = grade.name;
    pop(grade.name, r.x, r.y - 100, grade.color, grade.points === 100 ? 64 : 50);
    pop(`+${pts}`, r.x + 10, r.y - 160, grade.color, 38);
    if (g.streak >= 2) pop(`Combo ×${g.streak}`, r.x, r.y - 215, PAL.magenta, 30);
  }

  function spill(b) {
    b.state = 'done';
    b.doneT = 0;
    b.grade = 'spill';
    g.spills++;
    g.served++;
    g.streak = 0;
    const r = rim(b);
    splash(r.x - r.half * 0.6, r.y, 18, 1.4);
    g.puddles.push({ x: r.x - 40, w: 60, life: 4 });
    pop('Spilt!', r.x, r.y - 100, '#b8624a', 58);
    sfx('splash');
    sfx('squawk');
    env.vibrate?.(90);
    if (!env.reduceMotion) g.flash = 0.12;
  }

  for (let i = 0; i < 3; i++) makeBird();

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }

    // Pour: the pot tips while the action is held.
    g.pouring = !!input.action;
    g.tip = approach(g.tip, g.pouring ? 1 : 0, g.pouring ? 14 : 11, dt);
    const flow = g.tip > 0.25 ? FLOW * Math.min(1, (g.tip - 0.25) / 0.6) : 0;
    if (flow > 0) {
      const sp = spoutAt(POT_TIP * g.tip);
      g.parcels.push({ x: sp.x, y: sp.y, vx: -30, vy: 220, vol: flow * dt });
      g.pourSound -= dt;
      if (g.pourSound <= 0) {
        sfx('pour');
        g.pourSound = 0.09;
      }
    }

    // The birds: the front one walks under the spout; the others queue.
    let k = 0;
    let ahead = null;
    for (const b of g.birds) {
      const s = b.size / 400;
      b.phase += dt;
      b.y = GROUND;
      if (b.state === 'queue' || b.state === 'walk') {
        if (b.state === 'queue' && k === 0) b.state = 'walk';
        // stand under the spout, or keep a bird's length behind the one ahead
        let stop = b.motion === 'stroll' && k === 0 ? STREAM_X + 110 * s : STREAM_X + k * QUEUE_GAP;
        if (k > 0 && ahead) stop = Math.max(stop, ahead.x + QUEUE_GAP * (0.5 + s * 0.45));
        const speed = 620;
        const dx = stop - b.x;
        b.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
        b.walk = Math.abs(dx) > 1 ? b.walk + dt * 11 : 0;
        if (k === 0 && Math.abs(dx) < 1) {
          b.state = 'serve';
          b.wait = 0;
        }
        k++;
      } else if (b.state === 'serve') {
        k++;
        b.wait += dt;
        if (b.motion === 'stroll') {
          b.x -= g.strollSpeed() * dt;
          b.walk += dt * 4;
        } else b.walk = 0;
        if (b.motion === 'bob') b.squash = Math.sin(b.phase * 3.4) * 0.075;
        // Settled: the pot is up and no tea is still falling.
        const falling = g.parcels.length > 0 || g.tip > 0.25;
        if (b.fill >= 1) spill(b);
        else if (b.fill > 0 && !falling) {
          b.settle += dt;
          if (b.settle > 0.35) judge(b);
        } else {
          b.settle = 0;
          if (b.fill === 0 && b.wait > b.patience) judge(b);
          if (b.motion === 'stroll' && b.x < STREAM_X - rim(b).half - 20) judge(b);
        }
      } else if (b.state === 'done') {
        b.doneT += dt;
        b.squash = approach(b.squash, 0, 8, dt);
        if (b.grade === 'spill') b.tilt = approach(b.tilt, -0.55, 10, dt);
        else if (b.grade !== 'thirsty' && b.grade !== 'miss') b.tilt = Math.sin(b.doneT * 9) * 0.06 * Math.max(0, 1 - b.doneT * 2);
        if (b.doneT > 0.55) b.state = 'leave';
      } else if (b.state === 'leave') {
        b.tilt = approach(b.tilt, 0, 5, dt);
        b.x -= 700 * dt;
        b.walk += dt * 12;
      }
      b.hop = b.walk ? -Math.abs(Math.sin(b.walk)) * 12 * s : 0;
      if (b.state !== 'done' && b.state !== 'leave') ahead = b;
    }
    g.birds = g.birds.filter((b) => b.x > -260);
    while (g.birds.filter((b) => b.state !== 'leave').length < 3) makeBird();

    // The falling tea: into the front cup, or onto the floor.
    const fb = g.birds.find((b) => b.state === 'serve' || b.state === 'walk');
    const r = fb ? rim(fb) : null;
    for (const p of g.parcels) {
      const py = p.y;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (r && fb.state === 'serve' && py < r.y && p.y >= r.y && Math.abs(p.x - r.x) < r.half) {
        p.dead = true;
        fb.fill += p.vol / fb.cap;
        if (rng() < 0.08) g.drops.push({ x: p.x, y: r.y, vx: (rng() - 0.5) * 120, vy: -120 - rng() * 80, life: 0.3, r: 3 });
      } else if (p.y >= GROUND - 4) {
        p.dead = true;
        if (rng() < 0.3) splash(p.x, GROUND - 4, 1, 0.5);
        const pud = g.puddles.find((q) => Math.abs(q.x - p.x) < 50);
        if (pud) {
          pud.w = Math.min(90, pud.w + 0.6);
          pud.life = 4;
        } else g.puddles.push({ x: p.x, w: 16, life: 4 });
      }
    }
    g.parcels = g.parcels.filter((p) => !p.dead);

    for (const d of g.drops) {
      d.vy += 1400 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    g.drops = g.drops.filter((d) => d.life > 0 && d.y < H);
    for (const q of g.puddles) q.life -= dt * 0.5;
    g.puddles = g.puddles.filter((q) => q.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
    g.flash = Math.max(0, g.flash - dt);
  };

  g.hud = () => (g.streak >= 2 ? `Cups ${g.served} · Combo ×${g.streak}` : `Cups ${g.served}`);
  g.summary = () => [
    `${g.served} cup${g.served === 1 ? '' : 's'} poured: ${g.perfects} perfect, ${g.spills} spilt.`,
    g.bestStreak >= 2 ? `Best combo: ${g.bestStreak} in a row.` : 'Line up a few Perfects in a row for a combo.',
  ];

  // ---------- drawing ----------

  // The same transform drawBird uses, up to the cup's own centre.
  function toCup(c, b) {
    const s = b.size / 400;
    c.translate(b.x, b.y + b.hop);
    if (b.rot) c.rotate(b.rot);
    c.scale(s * (1 + b.squash * 0.6), s * (1 - b.squash));
    if (painted()) return;
    c.translate(0, -225);
    c.rotate(b.tilt);
  }

  // The tea inside the painted cup's rim, and the fill line on it.
  function drawTea(c, b, t, isFront) {
    c.save();
    toCup(c, b);
    const E = { x: IN_X, y: IN_Y, rx: IN_RX, ry: IN_RY };
    c.beginPath();
    c.ellipse(E.x, E.y, E.rx * 0.98, E.ry * 0.96, 0, 0, Math.PI * 2);
    c.clip();
    if (b.fill > 0) {
      const f = clamp(b.fill, 0, 1);
      const sf = surface(f);
      const wob = b.state === 'serve' && g.tip > 0.3 ? Math.sin(t * 22) * 1.6 : 0;
      // the wall of tea down the far side, then the surface
      c.beginPath();
      c.ellipse(sf.x, sf.y + sf.ry * 0.25, sf.rx, sf.ry, 0, 0, Math.PI * 2);
      c.fillStyle = '#7a4420';
      c.globalAlpha = 0.9;
      c.fill();
      c.beginPath();
      c.ellipse(sf.x, sf.y - wob * 0.5, sf.rx * 0.92, sf.ry * 0.82, 0, 0, Math.PI * 2);
      c.fillStyle = '#b87a40';
      c.fill();
      c.beginPath();
      c.ellipse(sf.x - sf.rx * 0.25, sf.y - sf.ry * 0.2 - wob, sf.rx * 0.35, sf.ry * 0.28, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,235,190,0.45)';
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
    // the fill line: a dashed ring on the inside of the cup, at the line's height
    c.save();
    toCup(c, b);
    const L = surface(b.line);
    const pulse = isFront && b.state === 'serve' ? 1 + Math.sin(t * 8) * 0.25 : 1;
    c.beginPath();
    c.ellipse(E.x, E.y, E.rx * 0.98, E.ry * 0.96, 0, 0, Math.PI * 2);
    c.clip();
    c.setLineDash([11, 7]);
    c.beginPath();
    c.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, Math.PI * 2);
    c.lineWidth = (isFront ? 4.5 : 3) * pulse;
    c.strokeStyle = 'rgba(250,244,226,0.9)';
    c.stroke();
    c.lineWidth = isFront ? 3 : 2;
    c.strokeStyle = '#b8303a';
    c.stroke();
    c.restore();
  }

  // The tea seen through the glaze, and the fill line, drawn over the bird.
  function drawCup(c, b, t, isFront) {
    c.save();
    toCup(c, b);
    const lvl = LEVEL(clamp(b.fill, 0, 1));
    // porcelain, a little see-through
    poly(c, CUP, 2, 0);
    c.save();
    c.clip();
    c.fillStyle = 'rgba(250,244,226,0.82)';
    c.fillRect(-100, -60, 200, 130);
    if (b.fill > 0) {
      const wob = b.state === 'serve' && g.tip > 0.3 ? Math.sin(t * 22) * 2.5 : 0;
      c.beginPath();
      c.moveTo(-100, lvl + wob);
      c.quadraticCurveTo(0, lvl - wob * 2, 100, lvl + wob);
      c.lineTo(100, 70);
      c.lineTo(-100, 70);
      c.closePath();
      c.fillStyle = '#9a5a2a';
      c.globalAlpha = 0.85;
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.ellipse(0, lvl, halfWidth(lvl), 6, 0, 0, Math.PI * 2);
      c.fillStyle = '#c08a50';
      c.fill();
    }
    // the glaze and the pink band, washed over the tea
    c.fillStyle = 'rgba(239,217,106,0.32)';
    c.fillRect(-100, -60, 200, 130);
    poly(c, [[-100, -50], [100, -50], [100, -30], [-100, -30]], 3, 0);
    c.fillStyle = 'rgba(217,164,160,0.55)';
    c.fill();
    c.restore();
    poly(c, CUP, 2, 0.8);
    ink(c, 3);
    // the fill line: dashed across the cup, with a solid tick out each side
    const ly = LEVEL(b.line);
    const hw = halfWidth(ly);
    const pulse = isFront && b.state === 'serve' ? 1 + Math.sin(t * 8) * 0.25 : 1;
    c.save();
    c.setLineDash([12, 8]);
    c.beginPath();
    c.moveTo(-hw + 4, ly);
    c.lineTo(hw - 4, ly);
    ink(c, isFront ? 4 : 2.5, '#b8303a');
    c.restore();
    for (const d of [-1, 1]) {
      c.beginPath();
      c.moveTo(d * (hw - 2), ly);
      c.lineTo(d * (hw + 20), ly);
      ink(c, 5 * pulse, '#b8303a');
      c.beginPath();
      c.arc(d * (hw + 24), ly, 5 * pulse, 0, Math.PI * 2);
      c.fillStyle = '#b8303a';
      c.fill();
    }
    // the painted eye sits on the cup
    eye(c, -40, -5, 13);
    c.restore();
  }

  function drawPot(c, t) {
    const a = POT_TIP * g.tip;
    const pot = art('sprites.teapot');
    // the cord
    const lx = pot ? POT_LOOP[0] : 0;
    const ly = pot ? POT_LOOP[1] : -95;
    c.beginPath();
    c.moveTo(POT_X + lx, 0);
    c.quadraticCurveTo(POT_X + lx + 4 + a * 20, (POT_Y + ly) / 2, POT_X + lx * Math.cos(a) - ly * Math.sin(a), POT_Y + lx * Math.sin(a) + ly * Math.cos(a));
    ink(c, 2);
    c.save();
    c.translate(POT_X, POT_Y);
    c.rotate(a);
    if (drawSprite(c, 'sprites.teapot', 0, (512 - POT_PIVOT[0]) * POT_K, (512 - POT_PIVOT[1]) * POT_K, { h: 1024 * POT_K, anchor: 'center', whole: true })) {
      c.restore();
      drawSteam(c, t);
      return;
    }
    // the stand-in, moved so its spout tip lands on the painted one
    c.translate(SPOUT[0] + 150, SPOUT[1] - 6);
    // handle (behind)
    c.beginPath();
    c.ellipse(108, -4, 38, 46, 0, -Math.PI * 0.55, Math.PI * 0.55);
    c.lineWidth = 16;
    c.strokeStyle = '#dfe4e2';
    c.stroke();
    ink(c, 2);
    // spout
    poly(c, [[-80, 20], [-118, -2], [-152, 0], [-146, 12], [-116, 16], [-86, 48]], 4, 1);
    wash(c, '#dfe4e2');
    ink(c);
    // body
    blob(c, 0, 18, 112, 82, 3, 0.03, 22);
    wash(c, '#e6ebe8');
    ink(c, 2.8);
    blob(c, 0, 18, 112, 82, 3, 0.03, 22);
    hatch(c, -40, -60, 120, 100, 9, 0.18, 1);
    // a band of mauve flowers
    poly(c, [[-108, 8], [108, 8], [106, 34], [-106, 34]], 6, 0.6);
    c.save();
    blob(c, 0, 18, 112, 82, 3, 0.03, 22);
    c.clip();
    poly(c, [[-120, 8], [120, 8], [120, 34], [-120, 34]], 6, 0.6);
    wash(c, PAL.mauve, 0.7);
    for (let i = -4; i <= 4; i++) {
      c.beginPath();
      c.arc(i * 24, 21, 6, 0, Math.PI * 2);
      c.fillStyle = PAL.lemon;
      c.fill();
      ink(c, 1);
    }
    c.restore();
    // lid and knob
    blob(c, 0, -62, 64, 14, 8, 0.04);
    wash(c, '#dfe4e2');
    ink(c, 2);
    blob(c, 0, -82, 13, 12, 9, 0.05);
    wash(c, PAL.mauve);
    ink(c, 2);
    c.restore();
    drawSteam(c, t);
  }

  function drawSteam(c, t) {
    // steam curls when the pot is upright
    c.save();
    c.globalAlpha = 0.35 * (1 - g.tip);
    for (let i = 0; i < 2; i++) {
      const sx = POT_X + SPOUT[0] + 4 + i * 14;
      const ph = t * 1.5 + i * 2;
      c.beginPath();
      c.moveTo(sx, POT_Y + SPOUT[1] - 10);
      for (let j = 1; j < 6; j++) c.lineTo(sx + Math.sin(ph + j) * 8, POT_Y + SPOUT[1] - 10 - j * 14);
      ink(c, 1.6);
    }
    c.restore();
  }

  function drawStream(c) {
    if (!g.parcels.length) return;
    // join parcels that left the spout one after another
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [w, col] of [[12, '#8a4e22'], [5, '#c08a50']]) {
      c.beginPath();
      let prev = null;
      for (const p of g.parcels) {
        if (prev && Math.abs(p.y - prev.y) < 60) c.lineTo(p.x, p.y);
        else c.moveTo(p.x, p.y);
        prev = p;
      }
      c.lineWidth = w * Math.max(0.5, g.tip);
      c.strokeStyle = col;
      c.stroke();
    }
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'cupadee', W, H, (c) => {
      // a quiet parlour: striped wallpaper, a picture rail, floorboards
      band(c, 0, 0, W, 760, PAL.lemon, 0.22, 1);
      c.save();
      c.globalAlpha = 0.12;
      for (let x = 30; x < W; x += 90) {
        c.fillStyle = PAL.dusty;
        c.fillRect(x, 120, 22, 640);
      }
      c.restore();
      c.beginPath();
      c.moveTo(0, 118);
      c.lineTo(W, 122);
      ink(c, 2);
      // a little framed picture of a bird on the wall
      poly(c, [[1250, 230], [1440, 230], [1440, 420], [1250, 420]], 2);
      wash(c, '#ece2c8');
      ink(c, 3);
      poly(c, [[1268, 248], [1422, 248], [1422, 402], [1268, 402]], 3, 1);
      wash(c, PAL.sage, 0.5);
      ink(c, 1.5);
      c.beginPath();
      c.moveTo(1345, 230);
      c.lineTo(1345, 122);
      ink(c, 1.2);
      blob(c, 1345, 330, 34, 26, 5);
      wash(c, PAL.slate, 0.6);
      ink(c, 1.5);
      c.beginPath();
      c.moveTo(1312, 326);
      c.lineTo(1280, 332);
      c.moveTo(1345, 356);
      c.lineTo(1338, 392);
      c.moveTo(1352, 356);
      c.lineTo(1362, 392);
      ink(c, 1.5);
      // skirting and floor
      band(c, 0, 760, W, 140, PAL.wafer, 0.5, 3);
      c.beginPath();
      c.moveTo(0, 760);
      c.lineTo(W, 756);
      ink(c, 2.4);
      c.save();
      c.globalAlpha = 0.3;
      for (let y = 790; y < H; y += 34) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y + 3);
        ink(c, 1.2);
      }
      c.restore();
    });

    // where to stand: a little mark under the spout
    c.save();
    c.globalAlpha = 0.35;
    blob(c, STREAM_X, GROUND + 6, 70, 10, 4, 0.08);
    c.fillStyle = PAL.ochre;
    c.fill();
    c.restore();

    for (const q of g.puddles) {
      c.save();
      c.globalAlpha = Math.min(0.8, q.life);
      blob(c, q.x, GROUND + 2, q.w, 7, q.x, 0.15);
      wash(c, '#9a5a2a');
      ink(c, 1);
      c.restore();
    }

    // the queue back to front, then the filled ones leaving, and last, in
    // front of them all, the one the tea is pouring for
    const fb = front();
    const waiting = g.birds.filter((b) => b.state === 'queue').reverse();
    const leaving = g.birds.filter((b) => b.state === 'done' || b.state === 'leave');
    const order = [...waiting, ...leaving, ...(fb ? [fb] : [])];
    for (const b of order) {
      const pose = { fill: 0, tip: 0.22 - Math.sin(t * 1.6) * 0.03 + b.tilt, open: true };
      const wobble = b.walk ? Math.sin(b.walk) * 0.05 : 0;
      const pa = painted();
      b.rot = pa ? wobble + b.tilt * 0.5 : wobble; // painted: the whole bird tips, about its feet
      drawBird(c, 'cupadee', { x: b.x, y: b.y + b.hop, size: b.size, t, pose, rot: b.rot, squash: b.squash });
      if (pa) drawTea(c, b, t, b === fb);
      else drawCup(c, b, t, b === fb);
      if (b === fb && b.state === 'serve' && b.fill === 0 && b.wait > b.patience * 0.55) {
        const r = rim(b);
        label(c, '?', r.x - r.half - 30, r.y - 60 + Math.sin(t * 6) * 4, { size: 54, color: '#b8624a', weight: 800 });
      }
    }

    drawStream(c);
    drawPot(c, t);

    for (const d of g.drops) {
      c.save();
      c.globalAlpha = clamp(d.life * 2, 0, 1);
      if (d.star) {
        c.translate(d.x, d.y);
        c.rotate(d.life * 6);
        poly(c, [[0, -10], [3, -3], [10, 0], [3, 3], [0, 10], [-3, 3], [-10, 0], [-3, -3]], 1, 0);
        c.fillStyle = PAL.lemon;
        c.fill();
        ink(c, 1.2);
      } else {
        c.beginPath();
        c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        c.fillStyle = '#9a5a2a';
        c.fill();
      }
      c.restore();
    }

    for (const p of g.pops) {
      const k = Math.min(1, (1.3 - p.life) * 8);
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(0.6 + 0.4 * k + (k < 1 ? 0.15 : 0), 0.6 + 0.4 * k + (k < 1 ? 0.15 : 0));
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${p.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(p.text, 0, 0);
      label(c, p.text, 0, 0, { size: p.size, color: p.color, weight: 800 });
      c.restore();
    }

    if (g.flash > 0) {
      c.fillStyle = `rgba(255,250,235,${env.reduceMotion ? g.flash * 0.6 : g.flash * 1.6})`;
      c.fillRect(0, 0, W, H);
    }
    if (g.elapsed < 3.5) {
      c.save();
      c.globalAlpha = Math.min(1, 3.5 - g.elapsed);
      label(c, 'Hold to pour · let go at the line', W / 2, 860, { size: 34, weight: 600, color: INK });
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => STREAM_X + 120;
  g.span = 1000;

  return g;
}
