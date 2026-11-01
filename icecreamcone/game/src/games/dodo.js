// Dollarbill Dodo: Spot the Dodo.
//
// A shell game on a shop counter. The Dodo hides under one of the hats, the
// hats shuffle (each hat swapping places with another along an arc, one in
// front and one behind), and when they stop you pick the hat it is under.
// Eight rounds: three hats, then four, then five, with more and faster
// swaps; later rounds add feints (two hats start to swap and think better of
// it), two swaps at once and three hats going round in a ring. Score: each
// find is worth 50 plus 10 a round (60 in the first, 130 in the last), plus
// up to 40 for answering quickly.

import { drawBird, drawSprite, scene, band, blob, poly, wash, ink, hatch, label, PAL, INK } from '../draw.js';
import { clamp, lerp } from './index.js';
import { curve, knob } from './difficulty.js';

const COUNTER = 650; // where the hats sit
const HS = 1.3; // the hats' size
const HAT_W = 190 * HS;
const LIFT = 170;

// How many hats each round. The Difficulty doesn't change it, so guessing is
// never luckier. Everything else about a round (moves, seconds per move, how
// long the Dodo is shown, how long you have to answer, and the chance of a
// feint, a double swap or a ring of three) follows the shared difficulty
// curve over the eight rounds: `g.plan()` below.
const HATS = [3, 3, 4, 4, 4, 5, 5, 5];
const ROUNDS = HATS.length;
// One painted hat design for all the hats of a round (the sprites in hats.png).
const HAT_CELL = [0, 2, 1, 0, 1, 2, 0, 1];
const STYLES = ['bowler', 'bowler', 'bowler', 'top', 'top', 'bowler', 'top', 'top'];

const slotX = (i, n) => 800 + (i - (n - 1) / 2) * (n > 4 ? 280 : n > 3 ? 320 : 360);
const ease = (p) => p * p * (3 - 2 * p);

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    score: 0,
    done: false,
    round: 0,
    phase: 'setup', // setup, show, shuffle, pick, reveal
    pt: 0, // seconds into the phase
    hats: [], // { slot, x, y, z, s, dodo, lift }
    moves: [],
    move: null,
    gap: 0,
    sel: 1,
    answerLeft: 0,
    picked: -1,
    right: false,
    found: 0,
    quickest: Infinity,
    pops: [],
    bits: [],
    shake: 0,
    stickWas: 0,
    repeat: 0,
    results: [], // which rounds were won, for the counter
  };

  // How hard a round is, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js): the first
  // rounds are few, slow swaps to learn on, the last ones long and quick.
  // Each knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = (round = g.round) => dAt(Math.min(1, round / (ROUNDS - 1)));
  g.plan = (round = g.round) => {
    const d = g.d(round);
    return {
      n: HATS[Math.min(round, ROUNDS - 1)],
      moves: Math.round(knob(d, 2, 9, 16)), // swaps in the shuffle
      dur: knob(d, 0.95, 0.44, 0.26), // seconds a swap takes
      show: knob(d, 1.8, 1.15, 0.85), // seconds the Dodo is shown
      answer: knob(d, 6, 4.5, 4), // seconds to answer
      fake: knob(d, 0, 0.2, 0.25), // chance a move is a feint
      double: knob(d, 0, 0.1, 0.35), // chance of two swaps at once (four hats or more)
      ring: knob(d, 0, 0, 0.3), // chance of three hats going round in a ring
    };
  };
  let plan = g.plan(0);
  const R = () => plan;
  g.dodoSlot = () => g.hats.find((h) => h.dodo).slot;
  const hatAt = (slot) => g.hats.find((h) => h.slot === slot);

  function startRound() {
    plan = g.plan();
    const r = R();
    // add hats as the rounds need them; they drop onto the counter
    while (g.hats.length < r.n) g.hats.push({ slot: g.hats.length, x: 800, y: -200, z: 0, s: 1, dodo: false, lift: 0 });
    g.hats.forEach((h, i) => {
      h.slot = i;
      h.dodo = false;
      h.from = { x: h.x, y: h.y };
    });
    g.hats[Math.floor(rng() * r.n)].dodo = true;
    g.moves = planMoves(r);
    g.phase = 'setup';
    g.pt = 0;
    g.picked = -1;
    g.sel = Math.floor(r.n / 2);
  }

  // The shuffle, planned up front: each move lists the hats that travel.
  function planMoves(r) {
    const list = [];
    const pair = () => {
      const a = Math.floor(rng() * r.n);
      let b = Math.floor(rng() * (r.n - 1));
      if (b >= a) b++;
      return [a, b];
    };
    for (let k = 0; k < r.moves; k++) {
      const roll = rng();
      const late = k > 0;
      if (late && r.ring && roll < r.ring && r.n >= 3) {
        const a = Math.floor(rng() * (r.n - 2));
        const dir = rng() < 0.5;
        const ring = dir ? [[a, a + 1], [a + 1, a + 2], [a + 2, a]] : [[a, a + 2], [a + 2, a + 1], [a + 1, a]];
        list.push({ dur: r.dur * 1.25, legs: ring.map(([f, t], i) => ({ from: f, to: t, arc: i === 2 ? -1 : 1 })) });
      } else if (late && r.double && roll < (r.ring || 0) + r.double && r.n >= 4) {
        const [a, b] = pair();
        const rest = [...Array(r.n).keys()].filter((i) => i !== a && i !== b);
        const c = rest[Math.floor(rng() * rest.length)];
        let d = rest[Math.floor(rng() * (rest.length - 1))];
        if (d === c) d = rest[rest.length - 1];
        list.push({ dur: r.dur * 1.1, legs: [{ from: a, to: b, arc: 1 }, { from: b, to: a, arc: -1 }, { from: c, to: d, arc: -1 }, { from: d, to: c, arc: 1 }] });
      } else if (late && r.fake && roll > 1 - r.fake) {
        const [a, b] = pair();
        list.push({ dur: r.dur * 0.9, fake: true, legs: [{ from: a, to: b, arc: 1 }, { from: b, to: a, arc: -1 }] });
      } else {
        const [a, b] = pair();
        list.push({ dur: r.dur, legs: [{ from: a, to: b, arc: 1 }, { from: b, to: a, arc: -1 }] });
      }
    }
    return list;
  }

  function placeHats() {
    const n = R().n;
    for (const h of g.hats) {
      h.x = slotX(h.slot, n);
      h.y = COUNTER;
      h.z = 0;
      h.s = 1;
    }
  }

  function choose(slot) {
    const r = R();
    g.picked = slot;
    g.phase = 'reveal';
    g.pt = 0;
    const took = r.answer - g.answerLeft;
    const h = hatAt(slot);
    g.right = !!(h && h.dodo);
    g.results[g.round] = g.right;
    if (g.right) {
      const bonus = Math.round((40 * clamp(g.answerLeft / r.answer, 0, 1)) / 5) * 5;
      const pts = 50 + 10 * (g.round + 1) + bonus;
      g.score += pts;
      g.found++;
      g.quickest = Math.min(g.quickest, took);
      g.pops.push({ x: slotX(slot, r.n), y: COUNTER - 330, text: `+${pts}`, sub: bonus >= 30 ? 'Quick eye!' : 'Found it!', color: '#3a6a2a', life: 1.4 });
      sfx('right');
      for (let i = 0; i < 16; i++) g.bits.push({ x: slotX(slot, r.n), y: COUNTER - 60, vx: (rng() - 0.5) * 700, vy: -300 - rng() * 400, a: rng() * 6, va: (rng() - 0.5) * 10, life: 1.4 });
    } else {
      g.pops.push({ x: slotX(Math.max(0, slot), r.n), y: COUNTER - 330, text: slot < 0 ? 'Too slow!' : 'Not there!', sub: '', color: '#b0402a', life: 1.4 });
      sfx('wrong');
      g.shake = 0.35;
      env.vibrate?.(80);
    }
  }

  g.update = (dt, input) => {
    if (g.done) return;
    g.pt += dt;
    const r = R();

    if (g.phase === 'setup') {
      // hats slide to their places for this round (and new ones drop in)
      const k = ease(clamp(g.pt / 0.6, 0, 1));
      for (const h of g.hats) {
        h.x = lerp(h.from.x, slotX(h.slot, r.n), k);
        h.y = lerp(h.from.y, COUNTER, k);
        h.lift = 0;
      }
      if (g.pt >= 0.7) {
        placeHats();
        g.phase = 'show';
        g.pt = 0;
      }
    } else if (g.phase === 'show') {
      // the Dodo's hat lifts, holds, and comes down
      const h = g.hats.find((h) => h.dodo);
      const up = clamp(g.pt / 0.3, 0, 1);
      const down = clamp((g.pt - (r.show - 0.3)) / 0.3, 0, 1);
      h.lift = ease(up) * (1 - ease(down));
      if (g.pt > 0.3 && g.pt - dt <= 0.3) sfx('catch', { pitch: 7 });
      if (g.pt >= r.show) {
        h.lift = 0;
        g.phase = 'shuffle';
        g.pt = 0;
        g.move = null;
        g.gap = 0.25;
      }
    } else if (g.phase === 'shuffle') {
      if (!g.move) {
        g.gap -= dt;
        if (g.gap <= 0) {
          if (!g.moves.length) {
            g.phase = 'pick';
            g.pt = 0;
            g.answerLeft = r.answer;
            g.stickWas = Math.abs(input.x) > 0.5 ? Math.sign(input.x) : 0;
          } else {
            g.move = g.moves.shift();
            g.move.t = 0;
            g.move.hats = g.move.legs.map((l) => hatAt(l.from));
            sfx('shuffle');
          }
        }
      } else {
        const m = g.move;
        m.t += dt;
        const p = clamp(m.t / m.dur, 0, 1);
        m.legs.forEach((l, i) => {
          const h = m.hats[i];
          const k = m.fake ? 0.42 * Math.sin(Math.PI * p) : ease(p);
          const lift = Math.sin(Math.PI * (m.fake ? k / 0.84 : k));
          h.x = lerp(slotX(l.from, r.n), slotX(l.to, r.n), k);
          // one hat passes in front (lower and bigger), the other behind
          h.y = COUNTER + l.arc * lift * 46;
          h.s = 1 + l.arc * lift * 0.1;
          h.z = l.arc * lift;
        });
        if (p >= 1) {
          if (!m.fake) m.legs.forEach((l, i) => (m.hats[i].slot = l.to));
          placeHats();
          g.move = null;
          g.gap = 0.05;
        }
      }
    } else if (g.phase === 'pick') {
      g.answerLeft -= dt;
      // move the marker: the pointer hovers over a hat, or step with the stick
      if (input.pointer.active) {
        let best = 0;
        for (let i = 1; i < r.n; i++) if (Math.abs(slotX(i, r.n) - input.pointer.x) < Math.abs(slotX(best, r.n) - input.pointer.x)) best = i;
        if (best !== g.sel) sfx('tick');
        g.sel = best;
      }
      const dir = input.x > 0.5 ? 1 : input.x < -0.5 ? -1 : 0;
      g.repeat -= dt;
      if (dir && (dir !== g.stickWas || g.repeat <= 0)) {
        const next = clamp(g.sel + dir, 0, r.n - 1);
        if (next !== g.sel) sfx('tick');
        g.sel = next;
        g.repeat = dir !== g.stickWas ? 0.35 : 0.18;
      }
      g.stickWas = dir;
      if (input.actionPressed && g.pt > 0.1) choose(g.sel);
      else if (g.answerLeft <= 0) choose(-1);
    } else if (g.phase === 'reveal') {
      const chosen = g.picked >= 0 ? hatAt(g.picked) : null;
      if (chosen) chosen.lift = ease(clamp(g.pt / 0.25, 0, 1));
      if (!g.right) {
        const d = g.hats.find((h) => h.dodo);
        d.lift = ease(clamp((g.pt - 0.45) / 0.25, 0, 1));
      }
      if (g.pt >= 1.8) {
        for (const h of g.hats) h.lift = 0;
        g.round++;
        if (g.round >= ROUNDS) g.done = true;
        else startRound();
      }
    }

    for (const p of g.pops) p.life -= dt;
    g.pops = g.pops.filter((p) => p.life > 0);
    for (const b of g.bits) {
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
      b.life -= dt;
    }
    g.bits = g.bits.filter((b) => b.life > 0);
    g.shake = Math.max(0, g.shake - dt);
  };

  g.hud = () => `Round ${Math.min(g.round + 1, ROUNDS)}/${ROUNDS} · ${g.score}`;
  g.summary = () => {
    const lines = [`You spotted the Dodo in ${g.found} of ${ROUNDS} rounds.`];
    if (g.found) lines.push(`Quickest find: ${g.quickest.toFixed(1)} seconds.`);
    return lines;
  };

  startRound();

  // ---------- drawing ----------

  function drawHat(c, h, style, t) {
    const lift = h.lift * LIFT;
    c.save();
    c.translate(h.x, h.y - lift);
    c.scale(h.s * HS, h.s * HS);
    c.rotate(h.lift * -0.12);
    const cell = HAT_CELL[g.round % HAT_CELL.length];
    if (drawSprite(c, 'sprites.hats', cell, 0, 4, { w: cell === 1 ? 176 : 192 })) {
      c.restore();
      return;
    }
    const body = '#4a3e3a';
    const band = PAL.mauve;
    if (style === 'top') {
      poly(c, [[-62, 0], [-56, -150], [56, -150], [62, 0]], 3, 1.2);
      wash(c, body);
      ink(c);
      poly(c, [[-62, 0], [-56, -150], [56, -150], [62, 0]], 3, 1.2);
      hatch(c, -70, -160, 70, 0, 9, 0.25);
      c.beginPath();
      c.ellipse(0, -150, 56, 12, 0, 0, Math.PI * 2);
      wash(c, '#5a4e48');
      ink(c, 2);
      poly(c, [[-61, -32], [61, -32], [62, -8], [-62, -8]], 4, 1);
      wash(c, band);
      ink(c, 1.6);
    } else {
      c.beginPath();
      c.moveTo(-70, -8);
      c.bezierCurveTo(-74, -120, 74, -120, 70, -8);
      c.closePath();
      wash(c, body);
      ink(c);
      c.beginPath();
      c.moveTo(-70, -8);
      c.bezierCurveTo(-74, -120, 74, -120, 70, -8);
      c.closePath();
      hatch(c, -80, -110, 80, 0, 9, 0.25);
      poly(c, [[-71, -34], [71, -34], [70, -10], [-70, -10]], 4, 1);
      wash(c, band);
      ink(c, 1.6);
      // a highlight on the crown
      c.beginPath();
      c.ellipse(-26, -70, 10, 22, 0.4, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fill();
    }
    // the brim
    c.beginPath();
    c.ellipse(0, -4, 95, 16, 0, 0, Math.PI * 2);
    wash(c, '#3e3430');
    ink(c);
    c.restore();
  }

  function drawDodo(c, h, t) {
    const hop = h.lift > 0.5 && !env.reduceMotion ? Math.abs(Math.sin(t * 9)) * 14 : 0;
    drawBird(c, 'dodo', { x: h.x, y: COUNTER - hop, size: 190, t });
  }

  function shop(c) {
    // wallpaper
    band(c, 0, 0, W, 520, '#e8dcbc', 0.6, 1);
    c.save();
    c.globalAlpha = 0.18;
    for (let x = 30; x < W; x += 60) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 520);
      ink(c, 6, PAL.sage);
    }
    c.restore();
    // a shelf of jars and boxes
    poly(c, [[60, 300], [1540, 296], [1540, 318], [60, 322]], 1, 1);
    wash(c, '#a0703a');
    ink(c);
    const cols = [PAL.strawberry, PAL.lemon, PAL.sage, PAL.slate, PAL.ochre, PAL.mauve];
    for (let i = 0; i < 16; i++) {
      const x = 100 + i * 90 + Math.sin(i * 3) * 10;
      if (i % 3 === 1) {
        const kind = Math.floor(i / 3) % 3;
        if (kind === 0) {
          // a teacup on its saucer
          c.beginPath(); c.ellipse(x, 296, 40, 6, 0, 0, Math.PI * 2); wash(c, '#f2eee0'); ink(c, 1.4);
          poly(c, [[x - 30, 250], [x + 30, 250], [x + 22, 290], [x - 22, 290]], i + 10, 1);
          wash(c, PAL.lemon, 0.85); ink(c, 1.6);
          c.beginPath(); c.ellipse(x + 34, 266, 10, 12, 0, -Math.PI / 2, Math.PI / 2); ink(c, 3, INK);
        } else if (kind === 1) {
          // a flowerpot with a sprout
          c.beginPath(); c.moveTo(x, 236); c.quadraticCurveTo(x + 8, 210, x - 4, 192); ink(c, 3, PAL.green);
          blob(c, x + 10, 206, 10, 5, i, 0.1, 8); wash(c, PAL.sage); ink(c, 1.2);
          poly(c, [[x - 30, 236], [x + 30, 236], [x + 22, 296], [x - 22, 296]], i + 10, 1);
          wash(c, PAL.dusty, 0.9); ink(c, 1.6);
        } else {
          // a buttoned boot
          poly(c, [[x - 10, 210], [x + 18, 210], [x + 20, 284], [x + 30, 296], [x - 34, 296], [x - 32, 282], [x - 12, 276]], i + 10, 1);
          wash(c, PAL.mauve, 0.85); ink(c, 1.6);
          for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + 12, 222 + k * 14, 3, 0, Math.PI * 2); c.fillStyle = '#efe6d0'; c.fill(); }
        }
      } else {
        blob(c, x, 260, 26, 38, i + 20, 0.03, 14);
        c.save(); c.globalAlpha = 0.5; c.fillStyle = '#f2eee0'; c.fill(); c.restore();
        ink(c, 1.6);
        blob(c, x, 272, 20, 24, i + 30, 0.06, 12);
        wash(c, cols[(i * 2) % cols.length], 0.6);
        poly(c, [[x - 18, 222], [x + 18, 222], [x + 18, 212], [x - 18, 212]], i + 40, 0.8);
        wash(c, '#9a8a7a');
        ink(c, 1.4);
      }
    }
    // the counter: its top, then its front
    poly(c, [[0, 540], [W, 540], [W, 700], [0, 700]], 2, 1);
    wash(c, '#d0a868');
    ink(c);
    c.save();
    c.globalAlpha = 0.25;
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.moveTo(0, 560 + i * 18);
      c.bezierCurveTo(400, 556 + i * 18 + Math.sin(i) * 6, 1200, 566 + i * 18, W, 558 + i * 18);
      ink(c, 1.2);
    }
    c.restore();
    poly(c, [[0, 700], [W, 700], [W, 900], [0, 900]], 3, 1);
    wash(c, '#9a6a3a');
    ink(c);
    poly(c, [[0, 700], [W, 700], [W, 900], [0, 900]], 3, 1);
    hatch(c, 0, 700, W, 900, 14, 0.2);
    for (let x = 60; x < W; x += 300) {
      poly(c, [[x, 730], [x + 240, 730], [x + 240, 870], [x, 870]], x, 1.2);
      ink(c, 1.8);
    }
    band(c, 0, 696, W, 10, INK, 0.5, 5);
  }

  g.draw = (c, t) => {
    const r = R();
    const sh = g.shake > 0 && !env.reduceMotion ? Math.sin(g.shake * 60) * g.shake * 24 : 0;
    scene(c, 'dodo', W, H, shop);
    c.save();
    c.translate(sh, 0);

    // soft shadows under the hats
    for (const h of g.hats) {
      c.save();
      c.globalAlpha = 0.18 * (1 - h.lift * 0.5);
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(h.x, COUNTER + 4 + (h.y - COUNTER) * 0.5, HAT_W * 0.5 * h.s, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // the selection marker, under the hats' brims
    if (g.phase === 'pick') {
      const x = slotX(g.sel, r.n);
      c.save();
      c.beginPath();
      c.ellipse(x, COUNTER, HAT_W * 0.62, 30, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(239,217,106,0.55)';
      c.fill();
      c.restore();
    }

    // the Dodo first (a lifted hat shows it), then the hats back to front
    const dh = g.hats.find((h) => h.dodo);
    if (dh && dh.lift > 0.05) drawDodo(c, dh, t);
    const order = [...g.hats].sort((a, b) => a.z - b.z);
    for (const h of order) drawHat(c, h, STYLES[g.round] || 'bowler', t);

    // the pointing marker and the answer clock
    if (g.phase === 'pick') {
      const x = slotX(g.sel, r.n);
      const bob = env.reduceMotion ? 0 : Math.sin(t * 8) * 8;
      const y = COUNTER - 250 + bob;
      poly(c, [[x - 30, y - 50], [x + 30, y - 50], [x + 30, y], [x + 54, y], [x, y + 50], [x - 54, y], [x - 30, y]], 5, 1.2);
      wash(c, PAL.strawberry);
      ink(c, 2.6);
      const k = clamp(g.answerLeft / r.answer, 0, 1);
      label(c, 'Which hat?', W / 2, 118, { size: 54, weight: 800 });
      c.save();
      c.beginPath();
      c.rect(W / 2 - 200, 156, 400, 18);
      c.fillStyle = 'rgba(59,43,32,0.12)';
      c.fill();
      c.beginPath();
      c.rect(W / 2 - 200, 156, 400 * k, 18);
      c.fillStyle = k < 0.3 ? '#c0503a' : PAL.olive;
      c.fill();
      c.beginPath();
      c.rect(W / 2 - 200, 156, 400, 18);
      ink(c, 2);
      c.restore();
    } else if (g.phase === 'show') {
      label(c, 'Watch the Dodo!', W / 2, 118, { size: 54, weight: 800 });
    } else if (g.phase === 'setup') {
      label(c, `Round ${g.round + 1}`, W / 2, 112, { size: 60, weight: 800 });
      label(c, `${r.n} hats`, W / 2, 162, { size: 34, weight: 600, color: '#6a5a4a' });
    } else if (g.phase === 'shuffle') {
      label(c, 'Keep your eye on it…', W / 2, 118, { size: 44, weight: 700, color: '#6a5a4a' });
    }

    // banknote confetti after a find
    for (const b of g.bits) {
      c.save();
      c.globalAlpha = Math.min(1, b.life * 2);
      c.translate(b.x, b.y);
      c.rotate(b.a);
      poly(c, [[-16, -8], [16, -8], [16, 8], [-16, 8]], 0, 0.5);
      wash(c, '#c9d48a');
      ink(c, 1.2, '#556030');
      c.restore();
    }
    for (const p of g.pops) {
      const a = Math.min(1, p.life * 2);
      const pop = 1 + Math.max(0, p.life - 1.2) * 3;
      c.save();
      c.globalAlpha = a;
      c.translate(p.x, p.y - (1.4 - p.life) * 30);
      c.scale(pop, pop);
      label(c, p.text, 0, 0, { size: 64, weight: 800, color: p.color });
      if (p.sub) label(c, p.sub, 0, 54, { size: 36, weight: 700, color: p.color });
      c.restore();
    }
    c.restore();

    // the round counter: eight little notes along the bottom
    for (let i = 0; i < ROUNDS; i++) {
      const x = W / 2 + (i - 3.5) * 80;
      const y = 840 - (i === g.round && !env.reduceMotion ? Math.abs(Math.sin(t * 4)) * 6 : 0);
      poly(c, [[x - 32, y - 20], [x + 32, y - 20], [x + 32, y + 20], [x - 32, y + 20]], i + 60, 1);
      const won = g.results[i];
      wash(c, i < g.round ? (won ? '#c9d48a' : '#d8c8b8') : '#f2eee0', 0.95);
      ink(c, i === g.round ? 3.5 : 1.6);
      label(c, i < g.round ? (won ? '1' : '×') : String(i + 1), x, y + 1, { size: 26, weight: 800, color: i < g.round ? (won ? '#556030' : '#a04030') : 'rgba(59,43,32,0.45)' });
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => W / 2;
  g.span = 1350;

  return g;
}
