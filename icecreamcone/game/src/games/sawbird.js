// The Saw Bird: Saw It Straight.
//
// A long plank lies across two sawhorses with a chalk line along it, and the
// Saw Bird (a carpenter's handsaw) cuts along the line from the right-hand
// end to the left. Push and pull the saw with long strokes (stick or arrows
// left and right, or drag back and forth): each stroke bites once it gets
// going, so short jiggles barely cut and a steady back-and-forth builds up
// speed. The cut heads the way the saw is tipped (stick or arrows up and
// down, or point where it should go), and the grain and the knots push it
// off the line, so keep steering it back. When the cut reaches the end the
// plank falls in two and is marked by how straight the cut is: dead
// straight, straight, a bit crooked or crooked. Planks get longer, the grain
// pulls harder and knots appear as time goes on. Score: points.

import { art, drawBird, drawSprite, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

Object.assign(SHEETS, {
  'sprites.planks': [1, 3], // three long planks seen from above at a slant: pale pine, honey oak, reddish cedar
  'sprites.sawhorse': [1, 1],
  'sprites.knots': [3, 1], // three knots in the wood, seen from above
  'sprites.sawbirdSawing': [1, 1], // the Saw Bird with its blade level, teeth down, legs tucked
  'sprites.sawbirdPoses': [2, 1], // snagged (blade bowed, same framing as sawing), standing proud
});

const DURATION = 50;
// Screen px per cell px for each painted pose, so the Saw Bird is one size:
// the sawing pose is drawn 0.33 (its blade about 195 px long), and each other
// pose by the scale it is painted at against the sawing one (measured on the
// whole bird and the wooden handle: design/source/pose-scales.json; the
// snagged blade is bowed, so its length is no guide).
const PAINTED = { sawing: 0.96, snag: 0.8, proud: 0.765 };
const POSE_K = { sawing: 0.33, snag: (0.33 * PAINTED.sawing) / PAINTED.snag, proud: (0.33 * PAINTED.sawing) / PAINTED.proud };
const PLANK_TOP = 430; // the plank's far edge
const PLANK_BOT = 610; // its near edge
const LINE_Y = 520; // the chalk line, give or take
const SAW_SIZE = 300;
const K = SAW_SIZE / 400;
const TEETH = -183; // the teeth's edge in the stand-in's units
const STROKE = 120; // half the stroke, in pixels
const MAXV = 5; // fastest the saw can travel, stroke-widths per second
const DEAD = 0.35; // each stroke cuts only after it has travelled this far
const BITE = 26; // pixels of cut per stroke-width travelled
const TURN = 0.38; // how much the saw's tip steers the cut
const GRADES = [
  [4, 10, 'Dead straight!', PAL.magenta],
  [10, 7, 'Straight!', PAL.green],
  [20, 4, 'A bit crooked', PAL.ochre],
  [Infinity, 1, 'Crooked!', PAL.brick],
];
const WOODS = ['#e2c48a', '#cf9f62', '#c27a58'];

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    s: 0, // the saw along its stroke, -1 (pushed forward, left) .. 1 (pulled back)
    tilt: 0, // which way the saw heads, -1 (up the page) .. 1 (down)
    dir: 0, // which way the stroke is going
    strokeFrom: 0,
    strokeLen: 0,
    rhythm: 0, // long strokes in a row, for the bite
    idle: 0,
    plank: null,
    planks: 0,
    grades: [],
    falling: [], // the two halves of a finished plank
    dust: [],
    pops: [],
    ref: null, // pointer: where the drag started
    pumped: false, // the action has been used to saw
    knotT: 0,
    knotsHit: 0,
    sawSound: 0,
  };

  const progress = () => Math.min(1, g.elapsed / DURATION);
  // Difficulty over the round: the shared curve for the chosen Difficulty
  // (see difficulty.js) sets each new plank's length, how hard its grain
  // pulls, and how many knots sit on its line. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(progress());
  g.plankLen = () => knob(g.d(), 600, 810, 1050); // plank length, px (±15%)
  g.grainPull = () => knob(g.d(), 0.05, 0.1, 0.16); // how hard the grain pulls the cut (×0.7-1.3)
  g.knotCount = () => knob(g.d(), 0.7, 1.9, 3.3); // knots on the line, plus up to 0.6, rounded down (3 at most)

  function pop(text, x, y, color = INK, size = 46) {
    // Stack above a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y -= size;
    g.pops.push({ text, x, y, color, size, life: 1.4 });
  }

  function newPlank() {
    const len = g.plankLen() * (0.85 + rng() * 0.3);
    const left = W / 2 - len / 2;
    const right = W / 2 + len / 2;
    const lineY = LINE_Y + (rng() - 0.5) * 30;
    const grain = (rng() < 0.5 ? -1 : 1) * g.grainPull() * (0.7 + rng() * 0.6);
    // Knots sit right on the line: saw round them, or grind slowly through.
    const knots = [];
    const n = g.planks === 0 ? 0 : clamp(Math.floor(g.knotCount() + rng() * 0.6), 0, 3);
    for (let i = 0; i < n; i++) {
      knots.push({ x: lerp(left + 110, right - 150, (i + 0.25 + rng() * 0.5) / n), dy: (rng() - 0.5) * 14, rx: lerp(24, 32, rng()), ry: lerp(16, 22, rng()), hit: false });
    }
    g.plank = { left, right, len, lineY, grain, knots, cutX: right, drift: 0, path: [[right, lineY]], slide: 1, wood: g.planks % 3, seed: Math.floor(rng() * 100) };
  }
  newPlank();
  g.plank.slide = 0;

  g.cutY = () => g.plank.lineY + g.plank.drift;
  // The knot the saw's teeth are in, if any.
  g.inKnot = () => {
    const p = g.plank;
    return p.knots.find((k) => {
      const dx = (p.cutX - 8 - k.x) / k.rx;
      const dy = (g.cutY() - p.lineY - k.dy) / k.ry;
      return dx * dx + dy * dy < 1;
    });
  };

  function finish() {
    const p = g.plank;
    // Going round a knot doesn't count against the cut: only the stretches
    // away from the knots are measured.
    const away = p.path.filter(([x]) => p.knots.every((k) => Math.abs(x - k.x) > k.rx + 90));
    const offs = (away.length ? away : p.path).map(([, y]) => Math.abs(y - p.lineY));
    const mean = offs.reduce((a, b) => a + b, 0) / Math.max(1, offs.length);
    const [, pts, text, color] = GRADES.find(([lim]) => mean <= lim);
    g.score += pts;
    g.planks++;
    g.grades.push(text);
    pop(text, (p.left + p.right) / 2, PLANK_TOP - 70, color, 54);
    pop('+' + pts, (p.left + p.right) / 2, PLANK_TOP - 130, color, 42);
    sfx(pts >= 7 ? 'right' : 'plop');
    if (pts >= 7) g.proud = 1.1;
    else g.snag = 0.6;
    env.vibrate?.(40);
    g.falling = [
      { plank: p, half: 'top', y: 0, vy: -40, rot: 0, vr: -0.05 },
      { plank: p, half: 'bottom', y: 0, vy: 60, rot: 0, vr: 0.12 },
    ];
    newPlank();
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.elapsed += dt;
    g.time = Math.max(0, DURATION - g.elapsed);
    if (g.time <= 0) {
      g.done = true;
      return;
    }
    const p = g.plank;
    g.kindNow = input.kind;

    // Where the hand wants the saw: along the stroke, and its tip's heading.
    let sT = g.s;
    let tT = 0;
    const ptr = input.pointer;
    if (ptr && ptr.active) {
      if (ptr.down) {
        if (!g.ref) g.ref = { x: ptr.x, s: g.s };
        sT = clamp(g.ref.s + (ptr.x - g.ref.x) / STROKE, -1, 1);
        tT = clamp((ptr.y - g.cutY()) / 70, -1, 1);
      } else g.ref = null;
    } else {
      // The stick or ← → saw directly; or hold the action to push the saw
      // and let go to pull it back (so on a controller the stick can just
      // steer).
      const x = input.x || 0;
      if (input.action) g.pumped = true;
      if (Math.abs(x) > (input.kind === 'controller' ? 0.4 : 0.05)) sT = clamp(x, -1, 1);
      else if (g.pumped) sT = input.action ? -1 : 1;
      tT = clamp(input.y || 0, -1, 1);
    }
    g.tilt = approach(g.tilt, tT, 10, dt);
    const prev = g.s;
    const want = approach(g.s, sT, 16, dt) - g.s;
    g.s += clamp(want, -MAXV * dt, MAXV * dt);
    const ds = g.s - prev;

    // Strokes: a turn of direction ends one.
    const d = Math.abs(ds) > 0.0008 ? Math.sign(ds) : 0;
    if (d && d !== g.dir) {
      if (g.dir) {
        const len = g.strokeLen;
        if (len > 1.1) g.rhythm = Math.min(5, g.rhythm + 1);
        else if (len < 0.6) g.rhythm = 0;
      }
      g.dir = d;
      g.strokeLen = 0;
    }
    g.strokeLen += Math.abs(ds);
    if (Math.abs(ds) < 0.0008) {
      g.idle += dt;
      if (g.idle > 0.8) g.rhythm = 0;
    } else g.idle = 0;

    // Cutting.
    if (p.slide <= 0 && g.strokeLen > DEAD) {
      const bite = Math.abs(ds) * BITE * (1 + g.rhythm * 0.1);
      let adv = Math.min(bite, p.cutX - p.left);
      const k = g.inKnot();
      if (k) {
        adv *= 0.12;
        g.snag = 0.25;
        g.knotT -= dt;
        if (g.knotT <= 0) {
          sfx('bonk');
          g.knotT = 0.45;
        }
        if (!k.hit) {
          k.hit = true;
          g.knotsHit++;
          pop('Knot! Steer round', k.x, PLANK_TOP - 30, PAL.brick, 34);
          env.vibrate?.(40);
        }
      }
      if (adv > 0) {
        p.cutX -= adv;
        p.drift += (g.tilt * TURN + p.grain) * adv;
        p.drift = clamp(p.drift, PLANK_TOP + 12 - p.lineY, PLANK_BOT - 12 - p.lineY);
        const last = p.path[p.path.length - 1];
        if (last[0] - p.cutX >= 6) p.path.push([p.cutX, g.cutY()]);
        if (rng() < adv * 0.4) g.dust.push({ x: p.cutX + 20 + rng() * 40, y: g.cutY(), vx: (rng() - 0.3) * 120, vy: -40 - rng() * 80, life: 0.7 + rng() * 0.5 });
        g.sawSound -= adv;
        if (g.sawSound <= 0) {
          sfx('shuffle');
          g.sawSound = 22;
        }
        if (p.cutX <= p.left + 0.5) finish();
      }
    }

    g.snag = Math.max(0, (g.snag || 0) - dt);
    g.proud = Math.max(0, (g.proud || 0) - dt);
    // A new plank slides in from the right.
    if (g.plank.slide > 0) g.plank.slide = Math.max(0, g.plank.slide - dt / 0.9);

    for (const f of g.falling) {
      f.vy += 1400 * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt * 3;
    }
    g.falling = g.falling.filter((f) => f.y < 900);
    for (const b of g.dust) {
      b.vy += 500 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    g.dust = g.dust.filter((b) => b.life > 0);
    for (const q of g.pops) {
      q.life -= dt;
      q.y -= 36 * dt;
    }
    g.pops = g.pops.filter((q) => q.life > 0);
  };

  g.hud = () => `Points ${g.score}`;
  g.summary = () => {
    if (!g.planks) return ['Not a plank sawn through.'];
    const lines = [`${g.planks} plank${g.planks === 1 ? '' : 's'} sawn through.`];
    const n = g.grades.filter((x) => x === GRADES[0][2]).length;
    if (n) lines.push(`${n} dead straight!`);
    return lines;
  };

  // ---------- drawing ----------

  function drawYard(c) {
    band(c, 0, 0, W, 330, '#d9e4e0', 0.7, 2);
    // the workshop's wall and window behind
    poly(c, [[0, 120], [W, 110], [W, 360], [0, 370]], 1, 2);
    wash(c, '#c79a6a', 0.55);
    ink(c, 1.6);
    poly(c, [[0, 120], [W, 110], [W, 360], [0, 370]], 1, 2);
    hatch(c, 0, 110, W, 370, 22, 0.15, 0.1);
    for (let x = 60; x < W; x += 120) {
      c.beginPath();
      c.moveTo(x, 118);
      c.lineTo(x + 2, 366);
      ink(c, 1, '#8a6040');
    }
    // tools hanging on the wall
    for (const [x, kind] of [[260, 'hammer'], [420, 'saw'], [1180, 'square'], [1330, 'hammer']]) {
      c.beginPath();
      c.arc(x, 150, 4, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      if (kind === 'hammer') {
        poly(c, [[x - 4, 152], [x + 4, 152], [x + 4, 250], [x - 4, 250]], x, 0.6);
        wash(c, '#b07a48');
        ink(c, 1.4);
        poly(c, [[x - 22, 150], [x + 24, 150], [x + 24, 168], [x - 22, 168]], x + 1, 0.6);
        wash(c, '#7a848c');
        ink(c, 1.4);
      } else if (kind === 'square') {
        poly(c, [[x - 6, 152], [x + 6, 152], [x + 6, 280], [x + 70, 280], [x + 70, 292], [x - 6, 292]], x, 0.6);
        wash(c, '#9aa4ac');
        ink(c, 1.4);
      } else {
        poly(c, [[x - 30, 156], [x + 60, 170], [x + 60, 200], [x - 30, 196]], x, 0.6);
        wash(c, '#b0b8c0', 0.6);
        ink(c, 1.2);
      }
    }
    // the yard
    band(c, 0, 360, W, H - 360, '#cbb98a', 0.75, 3);
    c.save();
    c.globalAlpha = 0.25;
    for (let i = 0; i < 70; i++) {
      const x = (i * 197) % W;
      const y = 380 + ((i * 83) % 500);
      c.beginPath();
      c.ellipse(x, y, 10, 3, 0, 0, Math.PI * 2);
      c.fillStyle = '#a07a48';
      c.fill();
    }
    c.restore();
  }

  function sawhorse(c, x) {
    // the painted sawhorse: its beam's top tucked just under the plank's
    // near edge, its feet on the yard
    if (drawSprite(c, 'sprites.sawhorse', 0, x, 790, { h: 200 })) return;
    poly(c, [[x - 110, PLANK_BOT - 10], [x + 110, PLANK_BOT - 10], [x + 110, PLANK_BOT + 14], [x - 110, PLANK_BOT + 14]], x, 1);
    wash(c, '#a77a4a');
    ink(c, 2);
    for (const [a, b] of [[-90, -130], [-70, -40], [70, 40], [90, 130]]) {
      c.beginPath();
      c.moveTo(x + a, PLANK_BOT + 10);
      c.lineTo(x + b, 760);
      ink(c, 12, '#9a6e40');
      ink(c, 1.6);
    }
  }

  // The plank's face, between two edges, from x0 to x1.
  function plankBody(c, p, x0, x1) {
    // The painted plank is stretched to the plank's length: its top face
    // fills PLANK_TOP..PLANK_BOT and its near edge the 18 px below.
    const sp = spriteCell('sprites.planks', p.wood);
    if (sp) c.drawImage(sp.img, sp.trim.x, sp.trim.y, sp.trim.w, sp.trim.h, x0, PLANK_TOP, x1 - x0, PLANK_BOT + 18 - PLANK_TOP);
    else {
      poly(c, [[x0, PLANK_TOP], [x1, PLANK_TOP], [x1, PLANK_BOT], [x0, PLANK_BOT]], p.seed, 1);
      wash(c, WOODS[p.wood]);
      c.save();
      c.clip();
      c.globalAlpha = 0.35;
      c.beginPath();
      for (let i = 0; i < 9; i++) {
        const y = PLANK_TOP + 14 + i * 20;
        c.moveTo(x0, y);
        for (let x = x0; x <= x1; x += 60) c.lineTo(x, y + Math.sin(x * 0.01 + i + p.seed) * 5);
      }
      ink(c, 1.2, '#7a5030');
      c.restore();
      // the near edge, seen a little from above
      poly(c, [[x0, PLANK_BOT], [x1, PLANK_BOT], [x1, PLANK_BOT + 18], [x0, PLANK_BOT + 18]], p.seed + 1, 0.6);
      wash(c, '#a77a4a');
      ink(c, 1.6);
      poly(c, [[x0, PLANK_TOP], [x1, PLANK_TOP], [x1, PLANK_BOT], [x0, PLANK_BOT]], p.seed, 1);
      ink(c, 2.2);
    }
    for (const k of p.knots) {
      const ky = p.lineY + k.dy;
      // the painted knot, sized to the knot's oval plus its ring of grain
      if (drawSprite(c, 'sprites.knots', Math.floor(k.x) % 3, k.x, ky, { w: (k.rx + 12) * 2, anchor: 'center' })) continue;
      blob(c, k.x, ky, k.rx * 0.6, k.ry * 0.6, k.x, 0.12);
      wash(c, '#6a3a1c', 0.9);
      ink(c, 1.6);
      blob(c, k.x, ky, k.rx, k.ry, k.x + 1, 0.1);
      wash(c, '#8a5a30', 0.35);
      ink(c, 1.4, '#6a3a1c');
      blob(c, k.x, ky, k.rx + 12, k.ry + 9, k.x + 2, 0.12);
      ink(c, 1, 'rgba(106,58,28,0.6)');
    }
  }

  function drawPlank(c, p, t) {
    const dx = p.slide * 1200;
    c.save();
    c.translate(dx, 0);
    plankBody(c, p, p.left, p.right);
    // the chalk line, and a faint band either side of it
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = '#ffffff';
    c.fillRect(p.left, p.lineY - 8, p.right - p.left, 16);
    c.restore();
    c.beginPath();
    c.moveTo(p.left - 6, p.lineY);
    c.lineTo(p.right + 6, p.lineY);
    ink(c, 5, 'rgba(250,252,255,0.7)');
    c.setLineDash([18, 6]);
    ink(c, 3, '#3f72b8');
    c.setLineDash([]);
    // the cut so far
    if (p.path.length > 1) {
      c.beginPath();
      p.path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.lineTo(p.cutX, g.cutY());
      ink(c, 6, '#3a2414');
      ink(c, 2, '#140a04');
    }
    c.restore();
  }

  function drawHalf(c, f) {
    const p = f.plank;
    c.save();
    c.translate(0, f.y);
    c.translate((p.left + p.right) / 2, (PLANK_TOP + PLANK_BOT) / 2);
    c.rotate(f.rot * (f.half === 'top' ? -0.2 : 1));
    c.translate(-(p.left + p.right) / 2, -(PLANK_TOP + PLANK_BOT) / 2);
    c.beginPath();
    if (f.half === 'top') {
      c.moveTo(p.left, PLANK_TOP - 30);
      c.lineTo(p.right, PLANK_TOP - 30);
    } else {
      c.moveTo(p.left, PLANK_BOT + 40);
      c.lineTo(p.right, PLANK_BOT + 40);
    }
    for (let i = p.path.length - 1; i >= 0; i--) c.lineTo(p.path[i][0], p.path[i][1]);
    c.closePath();
    c.clip();
    plankBody(c, p, p.left, p.right);
    c.restore();
  }

  function drawSaw(c, t) {
    const p = g.plank;
    if (g.proud > 0) {
      // After a straight cut it hops down and stands proud beside the plank.
      const hop = Math.abs(Math.sin(g.proud * 6)) * 14;
      // drawn the Saw Bird's sawing size (see POSE_K), standing on its claws
      const sp = spriteCell('sprites.sawbirdPoses', 1);
      if (!sp || !drawSprite(c, 'sprites.sawbirdPoses', 1, 1370, 770 - hop, { h: sp.trim.h * POSE_K.proud })) {
        drawBird(c, 'sawbird', { x: 1370, y: 770 - hop, size: SAW_SIZE, t });
      }
      return;
    }
    const shake = g.snag > 0 && !env.reduceMotion ? Math.sin(g.snag * 60) * 0.05 : 0;
    const rot = g.tilt * 0.12 + shake;
    const tipX = (p.slide > 0 ? p.right + 40 : p.cutX) - 55 + g.s * STROKE; // the blade's tip
    const lineY = p.slide > 0 ? p.lineY - 60 * p.slide : g.cutY();
    // A painted sawing pose (or, snagged, the bowed blade), measured on the
    // sheets: in the sawing picture the tip is at x 11 and the teeth along
    // y 845 of its 1024 px; in the snag cell the tip is at x 104, the teeth
    // about y 830. Tip leading, teeth on the cut, both at the same size (see
    // POSE_K).
    const snag = g.snag > 0 && spriteCell('sprites.sawbirdPoses', 0);
    const sp = snag || spriteCell('sprites.sawbirdSawing', 0);
    if (sp) {
      const [tx, ty, k] = snag ? [104, 830, POSE_K.snag] : [11, 845, POSE_K.sawing];
      const { cell } = sp;
      c.save();
      c.translate(tipX + 100, lineY);
      c.rotate(rot);
      c.drawImage(sp.img, cell.x, cell.y, cell.w, cell.h, -100 - tx * k, -ty * k, cell.w * k, cell.h * k);
      c.restore();
      return;
    }
    // Otherwise the bird itself, its saw levelled with the teeth on the cut
    // and what hangs below the teeth (its body and legs) hidden in the cut.
    // The painting's teeth run from (-185, -264) to (36, -218), about 0.2
    // rad off level; the stand-in's are level at TEETH.
    const pt = art('subject.sawbird');
    const [mx, my, ang, half] = pt ? [-75, -241, 0.203, 122] : [-105, TEETH, 0, 105];
    c.save();
    c.translate(tipX + half * K, lineY);
    c.rotate(rot);
    c.beginPath();
    c.rect(-400, -400, 800, 400 + 6);
    c.clip();
    c.rotate(-ang);
    c.translate(-mx * K, -my * K);
    drawBird(c, 'sawbird', { x: 0, y: 0, size: SAW_SIZE, t });
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'sawbird', W, H, drawYard);
    sawhorse(c, 640);
    sawhorse(c, 960);
    drawPlank(c, g.plank, t);
    for (const f of g.falling) drawHalf(c, f);
    drawSaw(c, t);

    for (const b of g.dust) {
      c.save();
      c.globalAlpha = clamp(b.life * 2, 0, 1);
      c.beginPath();
      c.arc(b.x, b.y, 3, 0, Math.PI * 2);
      c.fillStyle = '#e8c890';
      c.fill();
      c.restore();
    }

    // The stroke gauge: the saw's travel, with the rhythm lighting up.
    const gx = W / 2;
    const gy = 810;
    poly(c, [[gx - 230, gy - 12], [gx + 230, gy - 12], [gx + 230, gy + 12], [gx - 230, gy + 12]], 3, 0.6);
    c.fillStyle = 'rgba(250,244,228,0.9)';
    c.fill();
    ink(c, 1.8);
    for (const e of [-1, 1]) {
      c.fillStyle = 'rgba(160,190,120,0.55)';
      c.fillRect(gx + e * 230 - (e > 0 ? 70 : 0), gy - 12, 70, 24);
    }
    c.beginPath();
    c.arc(gx + g.s * 220, gy, 13, 0, Math.PI * 2);
    c.fillStyle = PAL.slate;
    c.fill();
    ink(c, 2);
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(gx - 48 + i * 24, gy + 40, 8, 0, Math.PI * 2);
      c.fillStyle = i < g.rhythm ? PAL.orange : 'rgba(0,0,0,0.1)';
      c.fill();
      ink(c, 1.2);
    }

    for (const q of g.pops) {
      c.save();
      c.globalAlpha = Math.min(1, q.life * 2);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${q.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(q.text, q.x, q.y);
      label(c, q.text, q.x, q.y, { size: q.size, color: q.color, weight: 800 });
      c.restore();
    }

    if (g.elapsed < 4.5) {
      c.save();
      c.globalAlpha = Math.min(1, 4.5 - g.elapsed);
      hint(c, g.kindNow === 'controller' ? 'Hold A to push, let go to pull · steer up and down round the knots' : g.kindNow === 'pointer' ? 'Drag back and forth · point where the cut should go' : 'Long strokes ← → (or hold Space and let go) · ↑ ↓ to steer', W / 2, 395, { focus: g.focus(), span: g.span, size: 30, weight: 600 });
      c.restore();
    }
  };

  g.focus = () => clamp(g.plank.cutX + 60, 380, W - 380);
  g.span = 760;

  return g;
}
