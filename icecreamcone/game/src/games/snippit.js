// The Cutitup Snippit: Snip the String.
//
// A bunch of balloons and kites is tied to the fence along the bottom of the
// fair, and the wind has crossed their strings into a tangle. A tag under the
// clock shows the one to let go. Follow its string down with your eye, walk
// the Snippit to the knot where it is tied, and snip. The right string lets
// that balloon float away (10 points, 5 more if you were quick); a wrong one
// loses a balloon nobody asked for, costs 5 points and jams the blades for a
// moment. Every snipped balloon is replaced by a new one. It starts gentle:
// more balloons join the bunch as time goes on, their strings curl more, and
// later they jostle in the wind, more and more often, and drift past each
// other while you look. Score: points.

import { drawBird, spriteCell, scene, band, blob, poly, wash, ink, hatch, label, hint, SHEETS, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';
import { subjectShape } from '../subjects.js';

Object.assign(SHEETS, {
  'sprites.balloons': [6, 2], // round balloons in the six colours, then diamond kites in the same six
  'sprites.snippitSnip': [2, 1], // blades open, blades shut
  'sprites.snippitPoses': [3, 1], // mid-stride, jammed, looking up after a balloon it let go
});

const DURATION = 45;
// Measured on the delivered scene (IC-M04a): the top rail's top edge.
const PEG_Y = 674; // where the strings are tied, on top of the rail
const RAIL_Y = PEG_Y + 8;
const GROUND = 894; // the Snippit's feet
const SKY_Y = 300; // the middle of the bunch
const X0 = 400; // the outermost knots
const X1 = 1200;
// The blades cut out toward their tip, which points away from the hinge the
// way the Snippit faces (the paintings face left; facing right they are
// mirrored about the eye): measured on the poses, the point is 112 to 132 px
// out from the eye. A knot anywhere along the open blades, from just past the
// tip back to the hinge, can be cut; with several there, the one nearest the
// tip is.
const TIP = 104; // the aim point, a little inside the very point
const PAST_TIP = 34; // how far beyond it a knot is still caught
const TO_HINGE = 96; // and back toward the hinge
// The stand-in's hinge (its eye) is at (-30, -220) from its feet: the snip point.
// The snip point is the hinge (its eye), held just above the knots: the bird
// is sized so its eye is there. In the painting the eye is 322 units above
// its feet and 25 to the left of them; in the stand-in, 220 and 30.
const HINGE_Y = PEG_Y - 10;
const hinge = () => (subjectShape('snippit').feet ? { dx: -29, up: 321 } : { dx: -30, up: 220 });
// Measured on the delivered pose sheets, in each cell's pixels: the eye (the
// hinge) and the claws' lowest point; and the scale the Snippit is painted
// at in the cell, against its portrait (design/source/pose-scales.json).
// Every pose is drawn so the Snippit is one size: its claws on the ground
// and its eye over the snip point. (Scaling each pose to fit its eye-to-claws
// height between the two, as before, drew a stooping pose bigger and one
// looking up smaller.)
const POSE_CELLS = {
  'sprites.snippitSnip': [{ ex: 422, ey: 226, feet: 973, painted: 0.975 }, { ex: 383, ey: 231, feet: 971, painted: 0.997 }],
  'sprites.snippitPoses': [{ ex: 432, ey: 321, feet: 985, painted: 0.928 }, { ex: 443, ey: 302, feet: 980, painted: 0.939 }, { ex: 410, ey: 308, feet: 1007, painted: 0.851 }],
};
// The standing pose (blades open) fits its eye-to-claws height between the
// snip point and the ground; that sets the Snippit's size for every pose.
const STAND = POSE_CELLS['sprites.snippitSnip'][0];
const SHOWN = ((GROUND - HINGE_Y) / (STAND.feet - STAND.ey)) * STAND.painted;
// And on the balloon sheet: where the string ties on (a balloon's knot, a
// kite's bottom point, above its tail), and how big each is drawn.
const BALLOON_CELLS = [292, 274, 263, 244, 235, 216].map((ax) => ({ ax, ay: 466, k: 140 / 422 }))
  .concat([286, 280, 264, 252, 240, 231].map((ax, i) => ({ ax, ay: [300, 314, 316, 301, 318, 299][i], k: 124 / 295 })));
const ATTACH = (kite) => (kite ? 62 : 70); // string tie below the balloon's middle
const RIGHT = 10;
const QUICK = 5;
const QUICK_T = 3;
const WRONG = 5;
const JAM = 0.8;
const TURN = 0.12; // seconds for the flip from one way to the other
const FULL_TILT = 0.85; // how far the stick must go to turn the Snippit round

export const COLORS = [
  { name: 'pink', c: PAL.strawberry, d: '#c0607a' },
  { name: 'yellow', c: PAL.lemon, d: '#b8a030' },
  { name: 'blue', c: PAL.slate, d: '#4f6a88' },
  { name: 'green', c: PAL.sage, d: '#6a8a50' },
  { name: 'purple', c: PAL.mauve, d: '#86587a' },
  { name: 'orange', c: PAL.orange, d: '#b0702a' },
];

const slotX = (i, n) => (n <= 1 ? 800 : X0 + ((X1 - X0) * i) / (n - 1));

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: 800, // the snip point (the Snippit's hinge)
    vx: 0,
    face: -1, // -1 faces left (the way the paintings face), 1 right
    turn: -1, // the drawn facing, flipping toward face
    balloons: [], // tied: { color, kite, pegK, skyK, px, bx, by, w1, w2, ph, grow }
    loose: [], // floating away
    stubs: [], // cut ends falling from the knots
    want: null, // the balloon asked for
    wantT: 0,
    pending: 0, // replacements on their way
    pendT: 0,
    jam: 0,
    snipT: 0,
    happyT: 0, // watching a balloon it let go float off
    moving: false,
    swapT: 6,
    swaps: 0, // times the wind has jostled the bunch
    right: 0,
    wrong: 0,
    quick: 0,
    pops: [],
  };

  function pop(text, x, y, color = INK, size = 46) {
    // Never over the tag at the top, nor clipped at the sides.
    y = Math.max(y, 300); // it rises 50 px as it fades: stays under the tag
    x = clamp(x, 220, W - 220);
    // Stack below a pop still showing nearby rather than on top of it.
    while (g.pops.some((p) => p.life > 0.5 && Math.abs(p.x - x) < 160 && Math.abs(p.y - y) < size)) y += size;
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  // How hard it is now, 0 to 1, along the shared curve for the chosen
  // Difficulty (see difficulty.js): three or four balloons on gently curled
  // strings and no wind at first; curlier strings, more balloons and the wind
  // jostling the bunch more often later. Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  g.bunchSize = () => Math.round(knob(g.d(), 3, 4.6, 6)); // balloons in the bunch
  g.curl = () => knob(g.d(), 25, 76, 195); // how far a string may curl, px
  // Seconds between the wind swapping two neighbours: no wind until just
  // before medium, then every 5 s, down to every 2.4 s at hard.
  g.swapGap = () => (g.d() < 0.45 ? Infinity : knob(g.d(), 5, 5, 2.4));
  const curl = g.curl;

  // A new balloon (or kite) in a colour nobody in the bunch has, tied to a
  // knot somewhere along the rail and floating somewhere in the bunch.
  function addBalloon(fresh = true) {
    const used = new Set(g.balloons.map((b) => b.color));
    const free = COLORS.map((_, i) => i).filter((i) => !used.has(i));
    if (!free.length) return null;
    const color = free[Math.floor(rng() * free.length)];
    const c = curl();
    const b = {
      color,
      kite: rng() < 0.4,
      pegK: rng(),
      skyK: rng(),
      px: 800,
      bx: 800,
      placed: false,
      by: SKY_Y + (rng() - 0.5) * 120,
      w1: (rng() - 0.5) * 2 * c,
      w2: (rng() - 0.5) * 2 * c,
      ph: rng() * 6.28,
      grow: fresh ? 0 : 1,
    };
    g.balloons.push(b);
    layout(0);
    if (fresh) {
      // come down into the bunch from above
      b.by0 = b.by;
      b.byNow = -120;
    }
    return b;
  }

  // Knot and bunch positions from each balloon's rank. A new balloon is put
  // straight in its place; the others slide over to make room.
  function layout(dt) {
    const n = g.balloons.length;
    [...g.balloons].sort((a, b) => a.pegK - b.pegK).forEach((b, i) => {
      const x = slotX(i, n);
      b.px = b.placed ? approach(b.px, x, 6, dt) : x;
    });
    [...g.balloons].sort((a, b) => a.skyK - b.skyK).forEach((b, i) => {
      const x = slotX(i, n) + (n > 3 ? (i % 2 ? 30 : -30) : 0);
      b.bx = b.placed ? approach(b.bx, x, 1.6, dt) : x;
      b.placed = true;
    });
  }

  function ask() {
    const last = g.want;
    const cands = g.balloons.filter((b) => b !== last && b.grow > 0.5);
    const from = cands.length ? cands : g.balloons;
    g.want = from[Math.floor(rng() * from.length)] || null;
    g.wantT = 0;
    if (g.want) sfx('tick');
  }

  // Start: three balloons whose strings are not simply straight down.
  for (let i = 0; i < 3; i++) addBalloon(false);
  for (const b of g.balloons) b.grow = 1;
  {
    const byPeg = [...g.balloons].sort((a, b) => a.pegK - b.pegK);
    const bySky = [...g.balloons].sort((a, b) => a.skyK - b.skyK);
    if (byPeg.every((b, i) => bySky[i] === b)) {
      const t = byPeg[0].skyK;
      byPeg[0].skyK = byPeg[2].skyK;
      byPeg[2].skyK = t;
    }
    for (const b of g.balloons) b.placed = false;
    layout(0);
  }
  ask();

  // The string of a tied balloon: a curve from its knot up to the balloon.
  g.top = (b) => ({ x: b.bx, y: (b.byNow ?? b.by) + Math.sin(g.elapsed * 1.3 + b.ph) * 8 });
  function stringPts(b, t = g.elapsed) {
    const top = g.top(b);
    const ty = top.y + ATTACH(b.kite);
    const sway = Math.sin(t * 0.9 + b.ph) * 14;
    return [
      [b.px, PEG_Y],
      [b.px + b.w1 + sway * 0.5, PEG_Y - 170],
      [top.x + b.w2 - sway, ty + 150],
      [top.x, ty],
    ];
  }
  g.stringPts = stringPts;
  const bez = (p, u) => {
    const v = 1 - u;
    return [
      v * v * v * p[0][0] + 3 * v * v * u * p[1][0] + 3 * v * u * u * p[2][0] + u * u * u * p[3][0],
      v * v * v * p[0][1] + 3 * v * v * u * p[1][1] + 3 * v * u * u * p[2][1] + u * u * u * p[3][1],
    ];
  };

  // Where the blades aim, toward the tip, for a hinge at x facing f.
  g.tip = TIP;
  g.cutX = (x = g.x, f = g.face) => x + f * TIP;
  // The tied balloon whose knot is between the blades, if any: the nearest to
  // the tip.
  g.under = (x = g.x, f = g.face) => {
    const at = g.cutX(x, f);
    let best = null;
    for (const b of g.balloons) {
      const out = (b.px - at) * f; // how far beyond the tip, outward
      if (b.grow <= 0.5 || out > PAST_TIP || out < -TO_HINGE) continue;
      if (!best || Math.abs(b.px - at) < Math.abs(best.px - at)) best = b;
    }
    return best;
  };

  function snip(x) {
    g.snipT = 0.25;
    sfx('shutter');
    const b = g.under(x);
    if (!b) return;
    g.balloons = g.balloons.filter((o) => o !== b);
    const top = g.top(b);
    g.loose.push({ ...b, x: top.x, y: top.y, vx: (rng() - 0.5) * 60, vy: -60, life: 4 });
    g.stubs.push({ x: b.px, y: PEG_Y - 4, life: 0.8 });
    g.pending++;
    g.pendT = Math.max(g.pendT, 0.6);
    if (b === g.want) {
      g.right++;
      g.happyT = 0.7;
      let pts = RIGHT;
      if (g.wantT < QUICK_T) {
        pts += QUICK;
        g.quick++;
        pop('Quick! +' + pts, top.x, top.y - 90, PAL.magenta, 50);
      } else pop('+' + pts, top.x, top.y - 90, PAL.magenta, 50);
      g.score += pts;
      sfx('right');
      env.vibrate?.(25);
      g.want = null;
      ask();
    } else {
      g.wrong++;
      g.score = Math.max(0, g.score - WRONG);
      g.jam = JAM;
      pop('Wrong string!', b.px, PEG_Y - 190, PAL.brick, 44); // above the "Jammed!" at the blades
      sfx('wrong');
      env.vibrate?.(80);
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
    g.jam = Math.max(0, g.jam - dt);
    g.snipT = Math.max(0, g.snipT - dt);
    g.happyT = Math.max(0, g.happyT - dt);
    g.wantT += dt;

    // Walk along the fence: follow the pointer, or run with the stick.
    const was = g.x;
    // (With the pointer it's the blades' tip that follows the finger: the
    // Snippit turns to face a finger behind its eye.)
    const p = input.pointer;
    if (p.active) {
      if ((p.x - g.x) * g.face < 0) g.face = -g.face;
      g.x = approach(g.x, p.x - g.face * TIP, 12, dt);
    } else {
      // A gentle push walks it either way without turning (backing up to a
      // knot behind it); a push all the way (or the D-pad or a key) turns
      // it to face that way, at once.
      if (Math.abs(input.x) >= FULL_TILT) g.face = input.x > 0 ? 1 : -1;
      g.vx = approach(g.vx, input.x * 1000, 14, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, 240, W - 240);
    g.moving = Math.abs(g.x - was) > 40 * dt;
    // the drawn flip catches up quickly (at once with reduced motion)
    g.turn = env.reduceMotion ? g.face : g.turn + clamp(g.face - g.turn, (-2 * dt) / TURN, (2 * dt) / TURN);

    if (input.actionPressed && g.jam <= 0) {
      if (p.active) g.x = clamp(p.x - g.face * TIP, 240, W - 240);
      snip(g.x);
    }

    // The bunch grows; snipped balloons are replaced.
    const want = g.bunchSize();
    if (g.balloons.length + g.pending < want) g.pending++;
    if (g.pending > 0) {
      g.pendT -= dt;
      if (g.pendT <= 0) {
        g.pending--;
        g.pendT = 0.35;
        addBalloon(true);
        sfx('plop');
        if (!g.want) ask();
      }
    }
    for (const b of g.balloons) {
      b.grow = Math.min(1, b.grow + dt * 2.5);
      if (b.byNow !== undefined) {
        b.byNow = approach(b.byNow, b.by0, 4, dt);
        if (Math.abs(b.byNow - b.by0) < 1) delete b.byNow;
      }
      // the curls grow with the game
      const c = curl();
      b.w1 = clamp(b.w1, -c, c);
      b.w2 = clamp(b.w2, -c, c);
    }
    // Later the wind jostles the bunch: two neighbours drift past each other.
    if (g.swapGap() < Infinity && g.balloons.length > 2) {
      g.swapT -= dt;
      if (g.swapT <= 0) {
        g.swapT = g.swapGap();
        g.swaps++;
        const sky = [...g.balloons].sort((a, b) => a.skyK - b.skyK);
        const i = Math.floor(rng() * (sky.length - 1));
        const t = sky[i].skyK;
        sky[i].skyK = sky[i + 1].skyK;
        sky[i + 1].skyK = t;
        sfx('shuffle');
      }
    }
    layout(dt);

    for (const l of g.loose) {
      l.vy = Math.max(-320, l.vy - 300 * dt);
      l.vx += Math.sin(l.life * 3 + l.ph) * 30 * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.life -= dt;
    }
    g.loose = g.loose.filter((l) => l.life > 0 && l.y > -300);
    for (const s of g.stubs) s.life -= dt;
    g.stubs = g.stubs.filter((s) => s.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Points ${g.score}`;
  g.summary = () => {
    const lines = [`${g.right} balloon${g.right === 1 ? '' : 's'} let go${g.quick ? `, ${g.quick} of them quick` : ''}.`];
    lines.push(g.wrong ? `${g.wrong} wrong string${g.wrong === 1 ? '' : 's'} snipped.` : 'Not one wrong string!');
    return lines;
  };

  // ---------- drawing ----------

  function drawBalloon(c, b, x, y, s = 1, alpha = 1) {
    const col = COLORS[b.color];
    c.save();
    c.globalAlpha *= alpha;
    const i = (b.kite ? 6 : 0) + b.color;
    const sp = spriteCell('sprites.balloons', i);
    if (sp) {
      // the painted one, its knot (or the kite's point) where the string ties
      const m = BALLOON_CELLS[i];
      const k = m.k * s;
      const cl = sp.cell;
      c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, x - m.ax * k, y + ATTACH(b.kite) * s - m.ay * k, cl.w * k, cl.h * k);
      c.restore();
      return;
    }
    c.translate(x, y);
    c.scale(s, s);
    if (b.kite) {
      poly(c, [[0, -66], [46, -6], [0, 62], [-46, -6]], b.color + 3, 1.5);
      wash(c, col.c);
      ink(c, 2.2);
      c.beginPath();
      c.moveTo(0, -66);
      c.lineTo(0, 62);
      c.moveTo(-46, -6);
      c.lineTo(46, -6);
      ink(c, 1.4, col.d);
      // a ribboned tail
      c.beginPath();
      c.moveTo(0, 62);
      c.bezierCurveTo(-18, 90, 22, 110, 4, 140);
      ink(c, 1.4);
      for (const [bx, by] of [[-6, 88], [8, 112]]) {
        poly(c, [[bx - 9, by - 6], [bx + 9, by + 6], [bx + 9, by - 6], [bx - 9, by + 6]], bx, 0.5);
        wash(c, col.c);
        ink(c, 1.2);
      }
    } else {
      blob(c, 0, -4, 50, 60, b.color + 7, 0.03, 20);
      wash(c, col.c);
      ink(c, 2.2);
      blob(c, -16, -26, 12, 18, 2, 0.1);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fill();
      poly(c, [[-7, 64], [7, 64], [0, 54]], 1, 0.5);
      wash(c, col.d);
      ink(c, 1.4);
    }
    c.restore();
  }

  function drawString(c, pts, width = 2, color = INK, u0 = 0, u1 = 1) {
    c.beginPath();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const [x, y] = bez(pts, u0 + ((u1 - u0) * i) / n);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    ink(c, width, color);
  }

  // The drawn mirror: 1 as painted (facing left), -1 facing right, passing
  // quickly through a narrow edge-on Snippit as it turns about its eye.
  g.flip = () => {
    const f = -g.turn;
    return (f < 0 ? -1 : 1) * Math.max(0.15, Math.abs(f));
  };

  function drawSnippit(c, t) {
    c.save();
    // mirrored about the eye (the hinge), which stays on the snip point
    c.translate(g.x, HINGE_Y);
    c.scale(g.flip(), 1);
    c.translate(-g.x, -HINGE_Y);
    drawSnippitLeft(c, t);
    c.restore();
  }

  // The Snippit facing left, as painted.
  function drawSnippitLeft(c, t) {
    const s = g.snipT > 0 ? g.snipT / 0.25 : 0;
    const jam = g.jam > 0 && !env.reduceMotion ? Math.sin(g.jam * 50) * 0.05 : 0;
    const walk = g.moving ? Math.sin(t * 14) * 0.04 : 0;
    const hg = hinge();
    const size = ((GROUND - HINGE_Y) / hg.up) * 400;
    const k = size / 400;
    const fx = g.x - hg.dx * k;
    // The painted poses: snipping, jammed (shaking), watching a balloon go,
    // striding; otherwise standing with its blades open. Each turns about its
    // eye, which stays on the snip point.
    const pose = s > 0.2 ? ['sprites.snippitSnip', 1] : g.jam > 0 ? ['sprites.snippitPoses', 1] : g.happyT > 0 ? ['sprites.snippitPoses', 2] : g.moving && Math.floor(t * 7) % 2 ? ['sprites.snippitPoses', 0] : ['sprites.snippitSnip', 0];
    const drawPose = (key, i) => {
      const sp = spriteCell(key, i);
      if (!sp) return false;
      const m = POSE_CELLS[key][i];
      const kk = SHOWN / m.painted;
      const cl = sp.cell;
      c.save();
      // claws on the ground, eye over the snip point; it turns about its eye
      const eyeY = GROUND - (m.feet - m.ey) * kk;
      c.translate(g.x, eyeY);
      c.rotate(jam + (g.moving ? walk * 0.5 : 0));
      c.drawImage(sp.img, cl.x, cl.y, cl.w, cl.h, -m.ex * kk, -m.ey * kk, cl.w * kk, cl.h * kk);
      c.restore();
      return true;
    };
    if (drawPose(pose[0], pose[1]) || drawPose('sprites.snippitSnip', 0)) return;
    c.save();
    c.translate(g.x, HINGE_Y);
    c.rotate(jam + walk - s * 0.12 + g.happyT * 0.12);
    c.scale(1 + s * 0.06, 1 - s * 0.08);
    c.translate(-g.x, -HINGE_Y);
    drawBird(c, 'snippit', { x: fx, y: GROUND, size, t });
    c.restore();
    // shut blades: two ink strokes closing over the hinge
    if (s > 0) {
      c.save();
      c.globalAlpha = s;
      c.beginPath();
      for (const a of [-0.5, 0, 0.5]) {
        // over the blades, just ahead of the hinge
        const bx = g.x - 60 * k;
        const by = HINGE_Y - 12 * k;
        c.moveTo(bx + Math.cos(a) * 10, by + Math.sin(a) * 10);
        c.lineTo(bx + Math.cos(a + Math.PI) * 28, by + Math.sin(a + Math.PI) * 28);
      }
      ink(c, 3, PAL.magenta);
      c.restore();
    }
  }

  function drawTag(c, t) {
    const b = g.want;
    const x = 800;
    const y = 154; // just clear of the clock above it
    c.save();
    c.translate(x, y + Math.sin(t * 2) * 2);
    poly(c, [[-170, -46], [150, -46], [182, 0], [150, 46], [-170, 46]], 5, 1.2);
    c.fillStyle = 'rgba(250,244,228,0.95)';
    c.fill();
    ink(c, 2.4);
    c.beginPath();
    c.arc(160, 0, 8, 0, Math.PI * 2);
    ink(c, 2);
    label(c, 'Let go of', -70, 0, { size: 34, weight: 700 });
    if (b) drawBalloon(c, b, 70, b.kite ? -10 : -2, b.kite ? 0.42 : 0.55);
    else label(c, '…', 70, 0, { size: 40 });
    c.restore();
  }

  g.draw = (c, t) => {
    scene(c, 'snippit', W, H, (c) => {
      band(c, 0, 0, W, 520, PAL.sky, 0.55, 1);
      band(c, 0, 380, W, 160, '#e8dcb8', 0.4, 2);
      // far hills and the striped tent of the fair
      blob(c, 300, 560, 420, 110, 3, 0.05);
      wash(c, PAL.sage, 0.45);
      blob(c, 1300, 570, 480, 120, 4, 0.05);
      wash(c, '#b8c49a', 0.45);
      for (const [cx, cy] of [[260, 140], [1350, 110], [900, 70]]) {
        blob(c, cx, cy, 110, 34, cx, 0.12);
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fill();
      }
      poly(c, [[1380, 600], [1470, 470], [1560, 600]], 6, 2);
      wash(c, '#f3e2c0');
      ink(c, 2);
      for (let i = 0; i < 4; i++) {
        poly(c, [[1395 + i * 42, 600], [1470, 470], [1412 + i * 42, 600]], i, 0.5);
        wash(c, PAL.strawberry, 0.7);
      }
      // the grass
      band(c, 0, 600, W, H - 600, PAL.sage, 0.55, 5);
      band(c, 0, 760, W, H - 760, PAL.green, 0.35, 6);
      // the fence: a rail and posts
      poly(c, [[60, RAIL_Y], [W - 60, RAIL_Y + 4], [W - 60, RAIL_Y + 26], [60, RAIL_Y + 22]], 7, 1);
      wash(c, '#c9925a');
      ink(c, 2.2);
      poly(c, [[60, RAIL_Y + 70], [W - 60, RAIL_Y + 72], [W - 60, RAIL_Y + 90], [60, RAIL_Y + 88]], 8, 1);
      wash(c, '#b98250');
      ink(c, 2);
      for (let x = 90; x < W; x += 236) {
        poly(c, [[x, RAIL_Y - 30], [x + 22, RAIL_Y - 32], [x + 24, GROUND + 8], [x + 2, GROUND + 6]], x, 1);
        wash(c, '#a87444');
        ink(c, 2);
        poly(c, [[x, RAIL_Y - 30], [x + 22, RAIL_Y - 32], [x + 24, GROUND + 8], [x + 2, GROUND + 6]], x, 1);
        hatch(c, x - 4, RAIL_Y - 34, x + 28, GROUND + 10, 8, 0.25, 1);
      }
    });

    // The knots on the rail.
    for (const b of g.balloons) {
      c.beginPath();
      c.arc(b.px, PEG_Y + 2, 7, 0, Math.PI * 2);
      c.fillStyle = '#7a5a3a';
      c.fill();
      ink(c, 1.6);
    }

    // The tangle: every tied string, all alike, so you have to follow it.
    const under = g.jam > 0 ? null : g.under();
    for (const b of g.balloons) {
      c.save();
      c.globalAlpha = b.grow;
      drawString(c, stringPts(b, t), 2.4);
      c.restore();
    }
    // The string under the blades glints for its first stretch.
    if (under) {
      c.save();
      c.globalAlpha = 0.85;
      drawString(c, stringPts(under, t), 5, PAL.magenta, 0, 0.22);
      c.restore();
    }
    // the cut ends left at the knots
    for (const s of g.stubs) {
      c.save();
      c.globalAlpha = s.life / 0.8;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.quadraticCurveTo(s.x + 10, s.y + 10, s.x + 4, s.y + 22 + (0.8 - s.life) * 60);
      ink(c, 2);
      c.restore();
    }

    // The bunch.
    for (const b of g.balloons) {
      const top = g.top(b);
      const isWant = b === g.want;
      const wob = isWant && !env.reduceMotion ? Math.sin(t * 9) * 0.06 : 0;
      c.save();
      c.translate(top.x, top.y);
      c.rotate(wob + Math.sin(t * 1.1 + b.ph) * 0.04);
      if (isWant) {
        c.beginPath();
        c.ellipse(0, 0, 76, 86, 0, 0, Math.PI * 2);
        c.save();
        c.setLineDash([10, 9]);
        ink(c, 3, PAL.magenta);
        c.restore();
      }
      drawBalloon(c, b, 0, 0, 0.3 + 0.7 * b.grow);
      c.restore();
    }
    // Floating away, trailing their cut strings.
    for (const l of g.loose) {
      c.beginPath();
      c.moveTo(l.x, l.y + 66);
      c.bezierCurveTo(l.x - 20, l.y + 120, l.x + 20, l.y + 170, l.x + Math.sin(l.life * 4) * 14, l.y + 230);
      ink(c, 2);
      drawBalloon(c, l, l.x, l.y, 1, Math.min(1, l.life));
    }

    drawTag(c, t);
    // A dotted mark from the blades' tip to the rail: where a snip will land.
    const cx = g.cutX();
    c.save();
    c.setLineDash([4, 8]);
    c.beginPath();
    c.moveTo(cx, PEG_Y - 34);
    c.lineTo(cx, PEG_Y + 30);
    ink(c, 2, under ? PAL.magenta : 'rgba(59,43,32,0.4)');
    c.restore();
    drawSnippit(c, t);
    // the snip point: a little pink notch on the rail, under the blades' tip
    poly(c, [[cx - 11, PEG_Y + 30], [cx + 11, PEG_Y + 30], [cx, PEG_Y + 12]], 1, 0.4);
    wash(c, under ? PAL.magenta : PAL.strawberry, 0.95);
    ink(c, 1.6);
    if (g.jam > 0) label(c, 'Jammed!', g.x, HINGE_Y - 110, { size: 32, color: PAL.brick, weight: 800 });

    for (const p of g.pops) {
      const k = Math.min(1, (1.3 - p.life) * 8);
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
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
      hint(c, 'Follow its string down · snip at the knot', W / 2, 560, { focus: g.focus(), span: g.span, size: 34, weight: 600 });
      c.restore();
    }
  };

  // The whole tangle has to stay in view on a narrow screen.
  g.focus = () => W / 2;
  g.span = 1000;

  return g;
}
