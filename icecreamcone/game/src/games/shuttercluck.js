// Shuttercluck: Say Cheese.
//
// You are the Shuttercluck's one glass eye. Any bird in the guide,
// plus ten pocket birds (`env.subjects`, chosen by the shell) peek out of six hiding
// places in a meadow (a bush, a stone wall, a knothole in the old tree, the
// gate pillar, the hedge and the tall grass) for a moment, then duck back.
// A hiding place rustles just before a bird appears. Move the viewfinder and
// press the action to take a picture: a bird in the middle of the frame and
// wholly inside it scores most, rarer birds score more, and two birds in one
// photo score a bonus. Ten shots; the photos are kept along the bottom.

import { drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, PAL, INK, PAPER } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';
import { SUBJECTS, SUBJECT_IDS, drawSubject, subjectShape } from '../subjects.js';

const SHOTS = 10;
const SAFETY = 60; // the film's light runs out after this, shots or not
const FW = 340; // the viewfinder
const FH = 250;
const COOLDOWN = 0.45; // the lens re-opening between shots
const STRIP_Y = 790; // the photos along the bottom

// The birds it can photograph (see ../subjects.js): their drawing box in
// drawBird's 400-unit space (feet at the origin) and where the head is, for
// peeking out of the knothole.
const BOX = Object.fromEntries(SUBJECT_IDS.map((id) => {
  const { box, head } = subjectShape(id);
  return [id, { ...box, hx: head[0], hy: head[1] }];
}));

// Rarer birds are worth more and peek for less time. What a round scores
// depends on these, not on how many birds there are to find.
const TIERS = [
  { name: 'common', value: 60, up: [1.5, 2.0], rustle: 0.6 },
  { name: 'uncommon', value: 100, up: [1.0, 1.4], rustle: 0.5 },
  { name: 'rare', value: 180, up: [0.6, 0.9], rustle: 0.4 },
];

const NAMES = Object.fromEntries(SUBJECT_IDS.map((id) => [id, SUBJECTS[id].name]));

// The hiding places. `line` is the top edge a bird rises over; `clip` is the
// region where a bird there can be seen.
const SPOTS = [
  { kind: 'bush', x0: 170, x1: 330, line: 585, pad: 12, size: 220 },
  { kind: 'wall', x0: 480, x1: 790, line: 540, pad: 6, size: 190 },
  { kind: 'knot', x: 1060, y: 330, r: 54, size: 170 },
  { kind: 'gate', post: 1290, ground: 668, size: 210 },
  { kind: 'hedge', x0: 1400, x1: 1480, line: 470, pad: 12, size: 230 },
  { kind: 'grass', x0: 640, x1: 980, line: 708, pad: 18, size: 270 },
];

// The same six places when the painted hide sprites are delivered: `cell` is
// the sprite in sprites.hides, `cx`/`gy`/`h` where it stands (centre, ground,
// painted height). The trunk's knothole is measured on the painted sprite.
const ART_SPOTS = [
  { kind: 'bush', x0: 170, x1: 330, line: 430, pad: 14, size: 220, cell: 0, cx: 250, gy: 690, h: 300 },
  { kind: 'wall', x0: 480, x1: 790, line: 562, pad: 6, size: 190, cell: 1, cx: 640, gy: 702, h: 200 },
  // The knothole is the one painted in the scene's own oak, at the left edge.
  { kind: 'knot', x: 139, y: 292, r: 30, rx: 27, ry: 70, size: 120, inScene: true },
  { kind: 'gate', post: 1235, ground: 690, size: 210, cell: 3, cx: 1290, gy: 696, h: 290 },
  { kind: 'hedge', x0: 1400, x1: 1480, line: 560, pad: 12, size: 230, cell: 4, cx: 1470, gy: 712, h: 220 },
  { kind: 'grass', x0: 640, x1: 980, line: 668, pad: 18, size: 270, cell: 5, cx: 810, gy: 800, h: 290 },
];
const painted = () => !!spriteCell('sprites.hides', 0);
const S = () => (painted() ? ART_SPOTS : SPOTS);

export default function create(env) {
  const { W, H, rng, sfx } = env;
  // All guide birds plus pocket birds, supplied by the shell.
  const pool = (env.subjects || SUBJECT_IDS).filter((id) => SUBJECTS[id]);
  const ids = pool.length ? pool : SUBJECT_IDS;
  let bag = [];
  let lastId = null;
  const g = {
    score: 0,
    done: false,
    time: undefined, // shown only when the light is running out
    fx: W / 2, // the viewfinder's centre
    fy: 380,
    birds: [],
    shots: [], // { id, pts, perfect, img, fly }
    shotsLeft: SHOTS,
    elapsed: 0,
    cool: 0,
    spawn: 1.2,
    ending: 0,
    flash: 0,
    since: 9, // seconds since the last shot
    pops: [],
    bits: [],
    pending: null, // a shot waiting to be captured into a thumbnail
    perfects: 0,
    wasted: 0,
  };
  const busy = new Set();

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js), by shots
  // taken or time spent, whichever is further. Birds peek longer and one at
  // a time at first; later they peek briefly, rustle less warning and come
  // up two or three at once. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(clamp(Math.max((SHOTS - g.shotsLeft) / SHOTS, g.elapsed / 45), 0, 1));
  g.upFactor = (d = g.d()) => knob(d, 1.3, 0.98, 0.6); // how long a bird stays up, times its tier's time
  g.rustleFactor = (d = g.d()) => knob(d, 1.15, 0.92, 0.65); // its warning rustle, times its tier's
  g.spawnGap = (d = g.d()) => knob(d, 1.15, 0.84, 0.45); // seconds between birds, plus up to 0.6
  g.maxUp = (d = g.d()) => Math.floor(knob(d, 1, 2.1, 3.2)); // birds up at once

  // Where a bird's feet are, given how far out it is (e, 0..1).
  function feet(b) {
    const sp = S()[b.spot];
    const s = sp.size / 400;
    const box = BOX[b.id];
    const h = -box.top * s;
    const e = b.e;
    if (sp.kind === 'knot') {
      const px = sp.x - box.hx * s;
      const py = sp.y - box.hy * s + 6;
      return { x: px, y: py + (1 - e) * ((sp.ry || sp.r) * 2 + 30) };
    }
    if (sp.kind === 'gate') {
      const hidden = sp.post - box.x0 * s + 6;
      const shown = sp.post - box.x0 * s - Math.min(0.7 * (box.x1 - box.x0) * s, 230);
      return { x: hidden + (shown - hidden) * e, y: sp.ground };
    }
    const show = sp.kind === 'grass' ? 0.66 : 0.6;
    const hidden = sp.line + h + 8;
    const shown = sp.line + h * (1 - show);
    return { x: b.x, y: hidden + (shown - hidden) * e };
  }

  // The rectangle a bird there can be seen in.
  function clipBox(sp) {
    if (sp.kind === 'knot') return { x0: sp.x - (sp.rx || sp.r), x1: sp.x + (sp.rx || sp.r), y0: sp.y - (sp.ry || sp.r), y1: sp.y + (sp.ry || sp.r) };
    if (sp.kind === 'gate') return { x0: 0, x1: sp.post, y0: 0, y1: sp.ground + 30 };
    return { x0: 0, x1: W, y0: 0, y1: sp.line + sp.pad };
  }

  // A bird's box, mirrored when it faces right.
  function boxOf(b) {
    const box = BOX[b.id];
    return b.flip ? { ...box, x0: -box.x1, x1: -box.x0 } : box;
  }

  // The part of the bird you can see, in logical pixels.
  function subject(b) {
    const sp = S()[b.spot];
    const s = sp.size / 400;
    const f = feet(b);
    const box = boxOf(b);
    const c = clipBox(sp);
    const r = { x0: Math.max(c.x0, f.x + box.x0 * s), x1: Math.min(c.x1, f.x + box.x1 * s), y0: Math.max(c.y0, f.y + box.top * s), y1: Math.min(c.y1, f.y) };
    if (r.x1 <= r.x0 || r.y1 <= r.y0) return null;
    return { ...r, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 };
  }
  g.subject = subject;

  // How good a photo of this bird the viewfinder would take now (0..1).
  function quality(b) {
    if (b.e < 0.3 || b.snapped) return 0;
    const r = subject(b);
    if (!r) return 0;
    const fx0 = g.fx - FW / 2;
    const fy0 = g.fy - FH / 2;
    const ix = Math.max(0, Math.min(r.x1, fx0 + FW) - Math.max(r.x0, fx0));
    const iy = Math.max(0, Math.min(r.y1, fy0 + FH) - Math.max(r.y0, fy0));
    const inside = (ix * iy) / ((r.x1 - r.x0) * (r.y1 - r.y0));
    if (inside < 0.25) return 0;
    const off = Math.hypot((r.cx - g.fx) / (FW / 2), (r.cy - g.fy) / (FH / 2));
    const centred = clamp(1 - off * 1.1, 0, 1);
    return inside * (0.3 + 0.7 * centred) * Math.min(1, b.e * 1.25);
  }
  g.quality = quality;

  function spawnBird() {
    const free = S().map((_, i) => i).filter((i) => !busy.has(i));
    if (!free.length) return;
    const spot = free[Math.floor(rng() * free.length)];
    const sp = S()[spot];
    const d = g.d();
    if (!bag.length) bag = [...new Set(ids)];
    const live = new Set(g.birds.map(b => b.id));
    let choices = bag.filter(id => id !== lastId && !live.has(id));
    if (!choices.length) choices = bag.filter(id => id !== lastId);
    if (!choices.length) choices = bag;
    // Weighted rarity, without replacement: see the whole pool before repeats.
    const weight = id => [5, 3, 1 + d][SUBJECTS[id].tier];
    let roll = rng() * choices.reduce((sum, id) => sum + weight(id), 0);
    const id = choices.find(id => (roll -= weight(id)) <= 0) || choices.at(-1);
    bag.splice(bag.indexOf(id), 1);
    lastId = id;
    const tier = SUBJECTS[id].tier;
    const T = TIERS[tier];
    const s = sp.size / 400;
    const b = {
      id, tier, spot, x: 0,
      state: 'rustle',
      t: T.rustle * g.rustleFactor(d),
      up: (T.up[0] + rng() * (T.up[1] - T.up[0])) * g.upFactor(d),
      e: 0,
      snapped: false,
      flip: sp.kind !== 'gate' && sp.kind !== 'knot' && rng() < 0.4,
    };
    if (sp.x0 !== undefined) {
      // the middle of the bird somewhere along its hiding place
      const box = boxOf(b);
      b.x = sp.x0 - ((box.x0 + box.x1) / 2) * s + rng() * (sp.x1 - sp.x0);
    }
    busy.add(spot);
    g.birds.push(b);
  }

  function shoot() {
    g.shotsLeft--;
    g.cool = COOLDOWN;
    g.since = 0;
    g.flash = 1;
    sfx('shutter');
    env.vibrate?.(30);
    let pts = 0;
    let best = null;
    let perfect = false;
    const hits = [];
    for (const b of g.birds) {
      const q = quality(b);
      if (q <= 0) continue;
      const T = TIERS[b.tier];
      let p = Math.round((T.value * q) / 10) * 10;
      if (q > 0.85) {
        p += 40;
        perfect = true;
      }
      hits.push({ b, p, q });
      pts += p;
      if (!best || p > best.p) best = { b, p };
    }
    if (hits.length > 1) pts += 40 * (hits.length - 1);
    let text;
    let sub = '';
    let color = INK;
    if (!hits.length) {
      text = 'Just grass!';
      color = '#8a7a6a';
      g.wasted++;
      sfx('miss');
    } else {
      text = `+${pts}`;
      if (hits.length > 1) sub = hits.length > 2 ? 'Three birds!' : 'Two birds!';
      else if (perfect) sub = 'Perfect!';
      else if (hits[0].q > 0.6) sub = 'Nice shot!';
      else sub = 'A bit blurry';
      if (perfect) {
        g.perfects++;
        color = '#b0402a';
      }
      sfx(perfect ? 'right' : 'ding', { pitch: Math.round(hits[0].q * 7) });
      for (const h of hits) {
        h.b.snapped = true;
        h.b.state = 'startle';
        h.b.t = 0.35;
        const r = subject(h.b);
        if (r) for (let i = 0; i < 10; i++) g.bits.push({ x: r.cx, y: r.cy, vx: (rng() - 0.5) * 500, vy: -150 - rng() * 300, life: 0.8, c: i % 2 ? PAL.lemon : '#fff' });
      }
    }
    g.score += pts;
    const above = g.fy - FH / 2 > 150;
    g.pops.push({ x: g.fx, y: above ? g.fy - FH / 2 - 80 : g.fy + FH / 2 + 40, text, sub, color, life: 1.3 });
    const shot = { id: best ? best.b.id : null, pts, perfect, img: null, fly: 0, from: { x: g.fx, y: g.fy } };
    g.shots.push(shot);
    g.pending = shot;
    if (g.shotsLeft <= 0) g.ending = 1.5;
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.since += dt;
    if (g.ending > 0) {
      g.ending -= dt;
      if (g.ending <= 0) g.done = true;
    } else if (g.elapsed >= SAFETY) {
      g.done = true;
      return;
    }
    const left = SAFETY - g.elapsed;
    g.time = left <= 15 && !g.ending ? Math.max(0, left) : undefined;

    // Move the viewfinder: follow the pointer, or steer with the stick.
    if (input.pointer.active) {
      g.fx = approach(g.fx, input.pointer.x, 16, dt);
      g.fy = approach(g.fy, input.pointer.y, 16, dt);
    } else {
      g.fx += input.x * 950 * dt;
      g.fy += input.y * 950 * dt;
    }
    g.fx = clamp(g.fx, 120, W - 120);
    g.fy = clamp(g.fy, 90, STRIP_Y - FH / 2);

    g.cool = Math.max(0, g.cool - dt);
    if (input.actionPressed && g.cool <= 0 && g.shotsLeft > 0 && !g.ending) shoot();

    // Birds come and go.
    const d = g.d();
    const maxUp = g.maxUp(d);
    g.spawn -= dt;
    if (g.spawn <= 0 && g.birds.length < maxUp && !g.ending) {
      spawnBird();
      g.spawn = g.spawnGap(d) + rng() * 0.6;
    }
    for (const b of g.birds) {
      b.t -= dt;
      if (b.state === 'rustle' && b.t <= 0) {
        b.state = 'rise';
        if (b.tier === 2) sfx('tick');
      } else if (b.state === 'rise') {
        b.e = Math.min(1, b.e + dt / 0.16);
        if (b.e >= 1) {
          b.state = 'up';
          b.t = b.up;
        }
      } else if (b.state === 'up' && b.t <= 0) b.state = 'sink';
      else if (b.state === 'startle' && b.t <= 0) b.state = 'sink';
      else if (b.state === 'sink') {
        b.e = Math.max(0, b.e - dt / 0.2);
        if (b.e <= 0) b.gone = true;
      }
    }
    for (const b of g.birds) if (b.gone) busy.delete(b.spot);
    g.birds = g.birds.filter((b) => !b.gone);

    for (const p of g.pops) p.life -= dt;
    g.pops = g.pops.filter((p) => p.life > 0);
    for (const p of g.bits) {
      p.vy += 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    g.bits = g.bits.filter((p) => p.life > 0);
    for (const s of g.shots) s.fly = Math.min(1, s.fly + dt / 0.6);
    g.flash = Math.max(0, g.flash - dt * 4);
  };

  g.hud = () => `Shots ${g.shotsLeft} · ${g.score}`;
  g.summary = () => {
    const good = g.shots.filter((s) => s.id).sort((a, b) => b.pts - a.pts);
    const lines = [];
    if (good.length) lines.push(`Best photo: ${NAMES[good[0].id]}, ${good[0].pts} points${good[0].perfect ? ' (perfect!)' : ''}.`);
    else lines.push('Not a single bird in the pictures!');
    const bits = [];
    if (g.perfects) bits.push(`${g.perfects} perfect`);
    if (g.wasted) bits.push(`${g.wasted} of just grass`);
    if (bits.length) lines.push(`Photos: ${bits.join(', ')}.`);
    return lines;
  };

  // ---------- drawing ----------

  // A hiding place's shiver while a bird is about to peek out of it.
  function rustleOf(i, t) {
    const b = g.birds.find((b) => b.spot === i && b.state === 'rustle');
    if (!b || env.reduceMotion) return { dx: 0, on: !!b, b };
    return { dx: Math.sin(t * 45 + i) * 3, on: true, b };
  }

  function rustleMarks(c, x, y, b, t) {
    c.save();
    c.globalAlpha = 0.8;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(x + s * 18, y, 16, s < 0 ? Math.PI * 0.7 : -Math.PI * 0.3, s < 0 ? Math.PI * 1.3 : Math.PI * 0.3);
      ink(c, 3);
      c.beginPath();
      c.arc(x + s * 18, y, 28, s < 0 ? Math.PI * 0.75 : -Math.PI * 0.25, s < 0 ? Math.PI * 1.25 : Math.PI * 0.25);
      ink(c, 2);
    }
    if (b.tier === 2) sparkle(c, x, y - 40, 12 + Math.sin(t * 12) * 3, PAL.lemon);
    c.restore();
  }

  function sparkle(c, x, y, r, color) {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? r * 0.35 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
    ink(c, 1.5);
  }

  function drawBirdsAt(c, i, t) {
    const sp = S()[i];
    for (const b of g.birds) {
      if (b.spot !== i || b.e <= 0) continue;
      const f = feet(b);
      c.save();
      c.beginPath();
      if (sp.kind === 'knot') c.ellipse(sp.x, sp.y, sp.rx || sp.r, sp.ry || sp.r * 1.1, 0, 0, Math.PI * 2);
      else {
        const r = clipBox(sp);
        c.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      }
      c.clip();
      const jump = b.state === 'startle' ? Math.sin((0.35 - b.t) * 30) * 6 : 0;
      drawSubject(c, b.id, { x: f.x, y: f.y + jump, size: sp.size, t: t + b.spot, flip: b.flip });
      c.restore();
      if (b.tier === 2 && b.e > 0.6 && !b.snapped) {
        const r = subject(b);
        if (r) sparkle(c, r.x1 - 6, r.y0 + 10, 10 + Math.sin(t * 10) * 3, PAL.lemon);
      }
    }
  }

  // An opaque wash, so the birds behind it stay hidden.
  function solid(c, color) {
    c.save();
    c.fillStyle = PAPER;
    c.fill();
    c.restore();
    wash(c, color, 0.95);
  }

  // The painted trunk is cut off flat at the top of its picture; fade the cut
  // into the sky so it doesn't look sawn off.
  let trunkImg = null;
  function drawTrunk(c, sp, dx) {
    const cell = spriteCell('sprites.hides', sp.cell);
    if (!trunkImg && typeof document !== 'undefined') {
      try {
        const k = 0.6;
        const o = document.createElement('canvas');
        o.width = Math.round(cell.trim.w * k);
        o.height = Math.round(cell.trim.h * k);
        const h = o.getContext('2d');
        h.drawImage(cell.img, cell.trim.x, cell.trim.y, cell.trim.w, cell.trim.h, 0, 0, o.width, o.height);
        const gr = h.createLinearGradient(0, 0, 0, o.height * 0.3);
        gr.addColorStop(0, 'rgba(0,0,0,1)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        h.globalCompositeOperation = 'destination-out';
        h.fillStyle = gr;
        h.fillRect(0, 0, o.width, o.height * 0.3);
        trunkImg = o;
      } catch {
        trunkImg = false;
      }
    }
    if (!trunkImg) return void drawSprite(c, 'sprites.hides', sp.cell, sp.cx + dx, sp.gy, { h: sp.h });
    const k = sp.h / trunkImg.height;
    c.drawImage(trunkImg, sp.cx + dx - (trunkImg.width * k) / 2, sp.gy - sp.h, trunkImg.width * k, sp.h);
  }

  // The painted hides, back to front. Each is drawn after the birds of its
  // place, so they peek out from behind (the trunk's bird from inside the hole).
  function drawHides(c, t) {
    const sway = (i) => rustleOf(i, t);
    const hide = (i, rot = 0) => {
      const sp = S()[i];
      const r = sway(i);
      const h = sp.h;
      const dx = r.dx;
      drawBirdsAt(c, i, t);
      // the sprite stands on its ground line; rustle shakes it sideways
      drawSprite(c, 'sprites.hides', sp.cell, sp.cx + dx, sp.gy, { h, rot: r.on && !env.reduceMotion ? rot * Math.sin(t * 45 + i) : 0 });
      return r;
    };
    let r;
    // the trunk first: its bird sits inside the knothole (drawn over the dark
    // hole, then the sprite is drawn with the hole cut open by drawing it first)
    {
      const sp = S()[2];
      r = sway(2);
      if (!sp.inScene) drawTrunk(c, sp, r.dx);
      drawBirdsAt(c, 2, t);
      if (r.on) rustleMarks(c, sp.x, sp.y - sp.ry - 30, r.b, t);
    }
    r = hide(1, 0.01);
    if (r.on) rustleMarks(c, r.b.x, S()[1].line - 50, r.b, t);
    r = hide(4, 0.008);
    if (r.on) rustleMarks(c, r.b.x, S()[4].line - 60, r.b, t);
    r = hide(0, 0.01);
    if (r.on) rustleMarks(c, r.b.x, S()[0].line - 60, r.b, t);
    r = hide(3, 0.006);
    if (r.on) rustleMarks(c, S()[3].cx - 150, 470, r.b, t);
    r = hide(5, 0.02);
    if (r.on) rustleMarks(c, r.b.x, S()[5].line - 70, r.b, t);
  }

  function drawWorld(c, t) {
    scene(c, 'shuttercluck', W, H, (c) => {
      band(c, 0, 0, W, 470, PAL.sky, 0.45, 1);
      // a few quiet clouds
      for (const [x, y, r] of [[300, 120, 70], [820, 90, 50], [1300, 150, 80]]) {
        blob(c, x, y, r * 1.6, r * 0.5, x, 0.08);
        c.save(); c.globalAlpha = 0.7; c.fillStyle = '#fbf7ea'; c.fill(); c.restore();
        ink(c, 1.2, 'rgba(59,43,32,0.4)');
      }
      // distant hills, a far hedgerow, and the meadow
      c.beginPath();
      c.moveTo(0, 470);
      for (let x = 0; x <= W; x += 40) c.lineTo(x, 430 - Math.sin(x / 260) * 40 - Math.sin(x / 90) * 6);
      c.lineTo(W, 520);
      c.lineTo(0, 520);
      c.closePath();
      wash(c, PAL.sage, 0.45);
      ink(c, 1.4, 'rgba(59,43,32,0.5)');
      band(c, 0, 470, W, 430, PAL.green, 0.38, 3);
      band(c, 0, 600, W, 300, PAL.olive, 0.25, 4);
      for (let i = 0; i < 26; i++) {
        blob(c, i * 64 + 20, 478 + Math.sin(i * 1.7) * 4, 34, 14, i + 200, 0.12, 10);
        wash(c, '#7f9068', 0.5);
      }
      // stipple and tiny flowers in the meadow
      c.save();
      for (let i = 0; i < 120; i++) {
        const x = (i * 137.5) % W;
        const y = 520 + ((i * 71) % 260);
        c.globalAlpha = 0.35;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 9); ink(c, 1.2);
        if (i % 7 === 0) {
          c.globalAlpha = 0.8;
          c.beginPath(); c.arc(x + 3, y - 11, 3.5, 0, Math.PI * 2);
          c.fillStyle = i % 2 ? '#f7f0dc' : PAL.lemon; c.fill();
        }
      }
      c.restore();
    });

    if (painted()) {
      drawHides(c, t);
      return;
    }

    // the old tree and its knothole
    const k = S()[2];
    const tr = rustleOf(2, t);
    poly(c, [[985, 690], [1000, 420], [990, 160], [1010, 0], [1120, 0], [1110, 180], [1125, 430], [1150, 690]], 1, 2);
    wash(c, '#8a7058');
    ink(c);
    poly(c, [[985, 690], [1000, 420], [990, 160], [1010, 0], [1120, 0], [1110, 180], [1125, 430], [1150, 690]], 1, 2);
    hatch(c, 980, 0, 1160, 700, 12, 0.22);
    blob(c, k.x + tr.dx, k.y, k.r, k.r * 1.1, 5, 0.04);
    c.fillStyle = '#2a1e18';
    c.fill();
    drawBirdsAt(c, 2, t);
    blob(c, k.x + tr.dx, k.y, k.r + 6, k.r * 1.1 + 6, 5, 0.04);
    ink(c, 6, '#6a5040');
    ink(c, 2);
    if (tr.on) rustleMarks(c, k.x, k.y - k.r - 30, tr.b, t);
    // branches and a few leaves
    for (const [x0, y0, x1, y1] of [[1010, 140, 880, 40], [1110, 120, 1260, 30], [1100, 250, 1220, 200]]) {
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, y0 - 40, x1, y1); ink(c, 12, '#8a7058'); ink(c, 2);
    }
    for (let i = 0; i < 14; i++) {
      blob(c, 860 + i * 30 + Math.sin(i * 2) * 20, 30 + Math.cos(i * 3) * 30, 30, 18, i + 70, 0.12, 10);
      wash(c, i % 3 ? PAL.sage : PAL.olive, 0.8);
      ink(c, 1.2);
    }

    // the stone wall
    const wr = rustleOf(1, t);
    drawBirdsAt(c, 1, t);
    c.save();
    c.translate(wr.dx, 0);
    poly(c, [[440, 548], [830, 535], [835, 690], [440, 690]], 2, 2);
    solid(c, '#c8c0b0');
    ink(c);
    for (let r = 0; r < 4; r++) {
      for (let s = 0; s < 6; s++) {
        const x = 445 + s * 66 + (r % 2) * 30;
        const y = 548 + r * 36;
        if (x > 800) continue;
        blob(c, x + 28, y + 16, 30, 15, r * 7 + s, 0.1, 10);
        wash(c, (r + s) % 3 ? '#b8b0a0' : '#a8a090', 0.6);
        ink(c, 1.3);
      }
    }
    c.restore();
    if (wr.on) rustleMarks(c, wr.b.x, 505, wr.b, t);

    // the gate: open slats, then the stone pillar the birds hide behind
    for (let i = 0; i < 5; i++) {
      const x = 1150 + i * 30;
      poly(c, [[x, 470 + i * 4], [x + 16, 470 + i * 4], [x + 16, 668], [x, 668]], i + 30, 1);
      wash(c, '#c0a070');
      ink(c, 1.6);
    }
    poly(c, [[1140, 500], [1295, 520], [1295, 536], [1140, 516]], 33, 1);
    wash(c, '#c0a070'); ink(c, 1.6);
    poly(c, [[1140, 610], [1295, 610], [1295, 626], [1140, 626]], 34, 1);
    wash(c, '#c0a070'); ink(c, 1.6);
    drawBirdsAt(c, 3, t);

    // the hedge, and the pillar in front of its end
    const hr = rustleOf(4, t);
    drawBirdsAt(c, 4, t);
    c.save();
    c.translate(hr.dx, 0);
    c.beginPath();
    c.moveTo(1360, 700);
    for (let i = 0; i <= 12; i++) c.lineTo(1360 + i * 21, 470 + Math.sin(i * 1.9) * 10 - (i % 2) * 12);
    c.lineTo(1620, 700);
    c.closePath();
    solid(c, '#6f8a4e');
    ink(c);
    c.beginPath();
    c.moveTo(1360, 700);
    for (let i = 0; i <= 12; i++) c.lineTo(1360 + i * 21, 470 + Math.sin(i * 1.9) * 10 - (i % 2) * 12);
    c.lineTo(1620, 700);
    c.closePath();
    hatch(c, 1350, 450, 1620, 710, 10, 0.25, -1);
    c.restore();
    if (hr.on) rustleMarks(c, hr.b.x, 430, hr.b, t);
    const gr = rustleOf(3, t);
    poly(c, [[1290 + gr.dx, 390], [1372 + gr.dx, 390], [1376, 700], [1286, 700]], 40, 1.5);
    solid(c, '#c8c0b0');
    ink(c);
    poly(c, [[1278 + gr.dx, 372], [1384 + gr.dx, 372], [1384 + gr.dx, 394], [1278 + gr.dx, 394]], 41, 1.5);
    solid(c, '#b0a898');
    ink(c);
    blob(c, 1331 + gr.dx, 356, 22, 18, 42, 0.05);
    solid(c, '#b0a898');
    ink(c);
    if (gr.on) rustleMarks(c, 1250, 470, gr.b, t);

    // the bush
    const br = rustleOf(0, t);
    drawBirdsAt(c, 0, t);
    for (let i = 0; i < 8; i++) {
      blob(c, 60 + i * 52 + br.dx, 630 + (i % 2) * 12 + Math.sin(i * 1.3) * 6, 72, 60, i + 50, 0.06, 14);
      solid(c, i % 2 ? '#7f9a5a' : '#8fa868');
      ink(c, 1.8);
    }
    for (let i = 0; i < 14; i++) {
      c.beginPath();
      c.arc(40 + i * 30 + br.dx, 640 + Math.sin(i * 2.3) * 40, 5, 0, Math.PI * 2);
      c.fillStyle = PAL.strawberry; c.fill(); ink(c, 1.2);
    }
    if (br.on) rustleMarks(c, br.b.x, 540, br.b, t);

    // the tall grass at the front
    const gs = rustleOf(5, t);
    drawBirdsAt(c, 5, t);
    c.save();
    c.beginPath();
    c.moveTo(560, 900);
    for (let i = 0; i <= 40; i++) {
      const x = 560 + i * 12.5;
      c.lineTo(x, 708 + (i % 2 ? -26 : 8) + Math.sin(i * 0.7) * 8 + (i % 2 ? gs.dx * 2 : 0));
    }
    c.lineTo(1060, 900);
    c.closePath();
    solid(c, '#a8b870');
    ink(c, 1.8);
    c.restore();
    c.save();
    c.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) {
      const x = 570 + i * 12;
      c.beginPath();
      c.moveTo(x, 900);
      c.quadraticCurveTo(x + 4, 790, x + Math.sin(i) * 10 + (i % 3 ? 0 : gs.dx * 2), 720 + (i % 4) * 8);
      ink(c, 1.4, '#5a6a3a');
    }
    c.restore();
    if (gs.on) rustleMarks(c, gs.b.x, 660, gs.b, t);

    // the meadow's front edge
    band(c, 0, 760, 560, 140, PAL.green, 0.35, 8);
    band(c, 1060, 740, 540, 160, PAL.green, 0.35, 9);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // Copies what is in the frame into a little picture, for the strip.
  function capture(c, shot) {
    if (typeof document === 'undefined' || !c.getTransform) return;
    try {
      const m = c.getTransform();
      const img = document.createElement('canvas');
      img.width = 408;
      img.height = 300;
      const h = img.getContext('2d');
      h.drawImage(c.canvas, (g.fx - FW / 2) * m.a + m.e, (g.fy - FH / 2) * m.d + m.f, FW * m.a, FH * m.d, 0, 0, img.width, img.height);
      shot.img = img;
      env.onPhoto?.({ src: img.toDataURL('image/webp', 0.85),
        name: NAMES[shot.id] || 'Just grass', pts: shot.pts });

    } catch {
      /* the strip shows a plain card instead */
    }
  }

  function polaroid(c, shot, x, y, w, rot) {
    const h = w * 0.86;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = 'rgba(59,43,32,0.18)';
    c.fillRect(-w / 2 + 4, -h / 2 + 5, w, h * 1.18);
    c.fillStyle = '#fbf8ef';
    c.fillRect(-w / 2, -h / 2, w, h * 1.18);
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.strokeRect(-w / 2, -h / 2, w, h * 1.18);
    const iw = w * 0.86;
    const ih = iw * (FH / FW);
    if (shot.img) c.drawImage(shot.img, -iw / 2, -h / 2 + w * 0.07, iw, ih);
    else {
      c.fillStyle = '#d8d4c4';
      c.fillRect(-iw / 2, -h / 2 + w * 0.07, iw, ih);
    }
    c.strokeRect(-iw / 2, -h / 2 + w * 0.07, iw, ih);
    if (shot.perfect) sparkle(c, w / 2 - 6, -h / 2 + 4, 11, PAL.lemon);
    label(c, shot.id ? String(shot.pts) : '—', 0, h / 2 + h * 0.04, { size: Math.max(14, w * 0.17), weight: 700, color: shot.perfect ? '#b0402a' : INK });
    c.restore();
  }

  g.draw = (c, t) => {
    drawWorld(c, t);
    if (g.pending) {
      capture(c, g.pending);
      g.pending = null;
    }

    // birds startled into the air after a photo: little feather bits
    for (const p of g.bits) {
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      blob(c, p.x, p.y, 7, 4, p.x, 0.2, 8);
      wash(c, p.c);
      ink(c, 1);
      c.restore();
    }

    // the viewfinder: dim the world outside it, then the frame
    const x0 = g.fx - FW / 2;
    const y0 = g.fy - FH / 2;
    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    roundRect(c, x0, y0, FW, FH, 18);
    c.fillStyle = 'rgba(40,30,24,0.22)';
    c.fill('evenodd');
    c.restore();
    let q = 0;
    for (const b of g.birds) q = Math.max(q, quality(b));
    const lock = q > 0.85 ? '#c0402a' : q > 0.4 ? '#d08a2a' : INK;
    roundRect(c, x0, y0, FW, FH, 18);
    ink(c, 2, 'rgba(255,255,255,0.8)');
    const L = 46;
    c.beginPath();
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + FW, y0, -1, 1], [x0, y0 + FH, 1, -1], [x0 + FW, y0 + FH, -1, -1]]) {
      c.moveTo(cx + sx * 6, cy + sy * L);
      c.lineTo(cx + sx * 6, cy + sy * 6);
      c.lineTo(cx + sx * L, cy + sy * 6);
    }
    ink(c, q > 0.4 ? 7 : 5, lock);
    c.beginPath();
    c.moveTo(g.fx - 22, g.fy); c.lineTo(g.fx - 8, g.fy);
    c.moveTo(g.fx + 8, g.fy); c.lineTo(g.fx + 22, g.fy);
    c.moveTo(g.fx, g.fy - 22); c.lineTo(g.fx, g.fy - 8);
    c.moveTo(g.fx, g.fy + 8); c.lineTo(g.fx, g.fy + 22);
    ink(c, 2.5, lock);
    c.beginPath();
    c.arc(g.fx, g.fy, 3, 0, Math.PI * 2);
    c.fillStyle = lock;
    c.fill();
    // the film counter and a red light while the lens re-opens
    roundRect(c, x0 + FW - 104, y0 + FH - 42, 90, 30, 15);
    c.fillStyle = 'rgba(244,236,216,0.85)';
    c.fill();
    label(c, `${g.shotsLeft} left`, x0 + FW - 59, y0 + FH - 27, { size: 22, weight: 700 });
    c.beginPath();
    c.arc(x0 + 24, y0 + 24, 7, 0, Math.PI * 2);
    c.fillStyle = g.cool > 0 ? '#e04a3a' : '#7ac06a';
    c.fill();
    ink(c, 1.5);

    // the strip of photos, and the Shuttercluck at its end
    c.save();
    c.fillStyle = 'rgba(244,236,216,0.9)';
    c.fillRect(0, STRIP_Y + 8, W, H - STRIP_Y);
    c.beginPath(); c.moveTo(0, STRIP_Y + 8); c.lineTo(W, STRIP_Y + 8); ink(c, 2);
    c.restore();
    const since = g.since;
    drawBird(c, 'shuttercluck', { x: 120, y: H - 14, size: 150, t, pose: { click: since < 0.25 ? (1 - since / 0.25) / 6 : 0 } });
    for (let i = 0; i < SHOTS; i++) {
      const sx = 290 + i * 128;
      const sy = STRIP_Y + 44;
      const shot = g.shots[i];
      if (!shot) {
        c.save();
        c.setLineDash([6, 6]);
        c.strokeStyle = 'rgba(59,43,32,0.35)';
        c.lineWidth = 2;
        c.strokeRect(sx - 48, sy - 36, 96, 92);
        c.restore();
        continue;
      }
      const k = shot.fly;
      const e = 1 - Math.pow(1 - k, 3);
      const px = shot.from.x + (sx - shot.from.x) * e;
      const py = shot.from.y + (sy + 5 - shot.from.y) * e;
      polaroid(c, shot, px, py, 200 + (96 - 200) * e, (i % 2 ? 0.04 : -0.04) * e);
    }

    // score pops
    for (const p of g.pops) {
      const a = Math.min(1, p.life * 2);
      const rise = (1.3 - p.life) * 40;
      const pop = 1 + Math.max(0, p.life - 1.1) * 3;
      c.save();
      c.globalAlpha = a;
      c.translate(p.x, p.y - rise);
      c.scale(pop, pop);
      label(c, p.text, 0, 0, { size: 64, weight: 800, color: p.color });
      if (p.sub) label(c, p.sub, 0, 50, { size: 36, weight: 700, color: p.color });
      c.restore();
    }

    if (g.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${g.flash * (env.reduceMotion ? 0.25 : 0.85)})`;
      c.fillRect(0, 0, W, H);
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => g.fx;
  g.span = 760;

  return g;
}
