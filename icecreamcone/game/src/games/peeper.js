// Newspaper Peeper: Hot off the Press.
//
// A word is printed at the top of the page, with the next letter it needs
// underlined. Loose letters flutter down like feathers, swaying as they
// fall; move the Peeper under the right one to catch it and stamp it into the
// headline. A wrong letter smudges the page and costs a point. A finished
// word scores a bonus as long as the word, and the next word is longer. The
// letters fall faster and sway wider as time goes on, with more wrong ones
// among them. Score: one a letter, plus each finished word's length.

import { drawBird, drawSprite, scene, band, blob, poly, wash, ink, label, PAL, INK } from '../draw.js';
import { clamp, lerp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

const DURATION = 45;
const GROUND = 860;
const BIRD_SIZE = 250;
const K = BIRD_SIZE / 400;
const CATCH_Y = GROUND - 150; // the middle of the sheet, where letters are caught
const CATCH_W = 78; // half-width of the catching sheet
const CATCH_H = 70;
const SPAWN_Y = 336; // letters come loose from the bottom of the page

// Kid-friendly words from the book and the birds, shortest first.
const WORDS = [
  ['TEA', 'CUP', 'EGG', 'INK', 'HAT', 'OWL'],
  ['COOT', 'CONE', 'BIRD', 'NEST', 'WING', 'CROW', 'NEWS', 'BOOT'],
  ['SCOOP', 'PLUME', 'BOOTS', 'PAPER', 'ROBIN', 'TWEET'],
  ['CAMERA', 'PEEPER', 'BUTTON', 'TEAPOT', 'PIGEON'],
  ['FEATHER', 'PICTURE', 'SPARROW', 'PENGUIN'],
  ['HEADLINE', 'NEWSPAPER', 'BLUEBIRD'],
];
const TIER_OF = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5];
const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    x: W / 2,
    vx: 0,
    flip: false,
    word: '',
    idx: 0, // the next letter needed
    words: 0,
    longest: '',
    letters: [], // falling: { ch, bx, y, vy, amp, w, ph, age, rot }
    spawn: 0.8,
    elapsed: 0,
    smudges: [], // on the headline: { x, y, r, life }
    smudged: 0,
    caught: 0,
    pops: [],
    bits: [],
    shake: 0,
    stamp: 0, // the newest stamped letter's thump
    extra: 0, // the EXTRA! banner
    extraText: '',
    lastWord: '',
    used: new Set(),
  };

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js). It sets how
  // fast letters fall, how wide they sway, how often one comes loose and how
  // many are the one you need. The words lengthen as you finish them. Each
  // knob: easy, medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(clamp(g.elapsed / DURATION, 0, 1));
  g.fall = () => knob(g.d(), 120, 205, 310); // px/s a letter falls, plus up to 30
  g.sway = () => knob(g.d(), 25, 64, 110); // px a letter sways, times 0.6 to 1
  g.gap = () => knob(g.d(), 0.62, 0.5, 0.34); // seconds between letters, plus up to 0.12
  g.needShare = () => knob(g.d(), 0.48, 0.37, 0.22); // chance a letter is the one you need
  const need = () => g.word[g.idx];

  function nextWord() {
    const tier = WORDS[TIER_OF[Math.min(g.words, TIER_OF.length - 1)]];
    let pick = tier.filter((w) => !g.used.has(w));
    if (!pick.length) pick = tier;
    g.word = pick[Math.floor(rng() * pick.length)];
    g.used.add(g.word);
    g.idx = 0;
  }
  nextWord();

  // Where a letter will be, `ahead` seconds from now.
  g.letterX = (l, ahead = 0) => l.bx + l.amp * Math.sin(l.w * (l.age + ahead) + l.ph);

  function spawnLetter() {
    const n = need();
    // the needed letter, whenever none is on its way down
    const coming = g.letters.some((l) => l.ch === n && l.y < CATCH_Y - 160);
    const roll = rng();
    const pNeed = g.needShare();
    let ch;
    if (!coming || roll < pNeed) ch = n;
    else if (roll < pNeed + 0.3) {
      // a letter coming up later in the word: wrong now, wanted soon
      const later = g.word.slice(g.idx + 1, g.idx + 3);
      ch = later.length ? later[Math.floor(rng() * later.length)] : g.word[Math.floor(rng() * g.word.length)];
      if (ch === n) ch = ABC[Math.floor(rng() * ABC.length)];
    } else {
      do ch = ABC[Math.floor(rng() * ABC.length)];
      while (ch === n);
    }
    const amp = g.sway() * (0.6 + rng() * 0.4);
    const lo = 140 + amp;
    const span = W - 280 - amp * 2;
    let bx = lo + rng() * span;
    // the letter you need never drops straight onto you: run for it
    if (ch === n && Math.abs(bx - g.x) < 260) bx = g.x + (bx < g.x ? -1 : 1) * (260 + rng() * 200);
    if (bx < lo || bx > lo + span) bx = clamp(g.x + (bx < lo ? 1 : -1) * (260 + rng() * 200), lo, lo + span);
    g.letters.push({
      ch,
      bx,
      y: SPAWN_Y,
      vy: g.fall() + rng() * 30,
      amp,
      w: 1.3 + rng() * 1.2,
      ph: rng() * Math.PI * 2,
      age: 0,
      rot: (rng() - 0.5) * 0.5,
      seed: Math.floor(rng() * 1000),
    });
  }

  function burst(x, y, n, colors) {
    for (let i = 0; i < n; i++) g.bits.push({ x, y, vx: (rng() - 0.5) * 600, vy: -200 - rng() * 400, a: rng() * 6, va: (rng() - 0.5) * 12, life: 1, c: colors[i % colors.length] });
  }

  function catchLetter(l) {
    const lx = g.letterX(l);
    if (l.ch === need()) {
      g.score += 1;
      g.caught++;
      g.idx++;
      g.stamp = 1;
      sfx('catch', { pitch: g.idx * 2 });
      g.pops.push({ x: lx, y: CATCH_Y - 120, text: '+1', color: INK, life: 0.9 });
      burst(lx, CATCH_Y - 40, 6, ['#f2eee0', '#d8d0b8']);
      if (g.idx >= g.word.length) {
        const bonus = g.word.length;
        g.score += bonus;
        g.words++;
        if (g.word.length >= g.longest.length) g.longest = g.word;
        g.extra = 1.6;
        g.extraText = `EXTRA! +${bonus}`;
        sfx('ding', { pitch: Math.min(12, g.word.length) });
        env.vibrate?.(50);
        // the presses roll: every loose letter flies off as confetti
        for (const o of g.letters) burst(g.letterX(o), o.y, 3, ['#f2eee0', PAL.lemon]);
        g.letters = [];
        g.spawn = 0.7;
        g.lastWord = g.word;
        nextWord();
      }
    } else {
      g.score = Math.max(0, g.score - 1);
      g.smudged++;
      g.smudges.push({ x: 340 + rng() * 920, y: 234 + (rng() - 0.5) * 50, r: 22 + rng() * 14, life: 2.5, seed: Math.floor(rng() * 100) });
      g.pops.push({ x: lx, y: CATCH_Y - 120, text: '−1', color: '#b0402a', life: 0.9 });
      g.shake = 0.3;
      sfx('squawk');
      env.vibrate?.(60);
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

    // Move: follow the pointer, or run with the stick.
    const prev = g.x;
    if (input.pointer.active) g.x = approach(g.x, input.pointer.x, 12, dt);
    else {
      g.vx = approach(g.vx, input.x * 900, 14, dt);
      g.x += g.vx * dt;
    }
    g.x = clamp(g.x, 110, W - 110);
    const moved = g.x - prev;
    if (Math.abs(moved) > 0.6) g.flip = moved > 0;

    g.spawn -= dt;
    if (g.spawn <= 0) {
      spawnLetter();
      g.spawn = g.gap() + rng() * 0.12;
    }

    for (const l of g.letters) {
      l.age += dt;
      l.y += l.vy * dt;
      if (l.dead) continue;
      const lx = g.letterX(l);
      if (Math.abs(l.y - CATCH_Y) < CATCH_H && Math.abs(lx - g.x) < CATCH_W) {
        l.dead = true;
        catchLetter(l);
      } else if (l.y > GROUND - 10) {
        l.dead = true;
        l.landed = 0.8;
      }
    }
    for (const l of g.letters) if (l.landed !== undefined) l.landed -= dt;
    g.letters = g.letters.filter((l) => !l.dead || (l.landed !== undefined && l.landed > 0));

    for (const s of g.smudges) s.life -= dt;
    g.smudges = g.smudges.filter((s) => s.life > 0);
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
    g.stamp = Math.max(0, g.stamp - dt * 4);
    g.extra = Math.max(0, g.extra - dt);
  };

  g.hud = () => `Words ${g.words} · ${g.score}`;
  g.summary = () => {
    const lines = [g.words ? `You printed ${g.words} word${g.words > 1 ? 's' : ''}; the longest was ${g.longest}.` : 'Not a word printed yet!'];
    lines.push(g.smudged ? `Smudges: ${g.smudged}.` : 'Not a single smudge!');
    return lines;
  };

  // ---------- drawing ----------

  // A torn scrap of newsprint with a big letter on it.
  function scrap(c, ch, x, y, rot, seed, alpha = 1) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.globalAlpha = alpha;
    // the painted scrap, with the letter printed in its blank patch
    if (drawSprite(c, 'sprites.scraps', seed % 8, 0, 0, { w: 132, anchor: 'center' })) {
      label(c, ch, 0, 3, { size: 54, weight: 800, color: INK, font: 'Georgia, "Times New Roman", serif' });
      c.restore();
      return;
    }
    const pts = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      const rr = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const tear = 1 + ((Math.sin(seed * 7.1 + i * 3.3) * 0.5 + 0.5) * 0.12 - 0.06);
      pts.push([Math.cos(a) * rr * 40 * tear, Math.sin(a) * rr * 44 * tear]);
    }
    poly(c, pts, seed, 1.5);
    wash(c, '#fbf6e4', 1);
    ink(c, 2);
    // faint lines of print behind the letter
    c.save();
    c.globalAlpha = alpha * 0.25;
    c.fillStyle = INK;
    for (let r = 0; r < 7; r++) c.fillRect(-32, -34 + r * 11, 64 - ((seed + r * 13) % 20), 2);
    c.restore();
    label(c, ch, 0, 4, { size: 64, weight: 800, font: 'Georgia, "Times New Roman", serif' });
    c.restore();
  }

  function headline(c, t) {
    const n = g.word.length;
    const cell = Math.min(96, 900 / n);
    const x0 = 800 - (cell * n) / 2 + cell / 2;
    // the page
    poly(c, [[300, 120], [1300, 124], [1296, 306], [304, 302]], 1, 2);
    wash(c, '#f3edd8', 1);
    ink(c, 2.4);
    label(c, 'The Daily Peeper', 800, 146, { size: 26, weight: 700, font: 'Georgia, serif' });
    c.beginPath();
    c.moveTo(320, 166); c.lineTo(1280, 168);
    c.moveTo(320, 172); c.lineTo(1280, 174);
    ink(c, 1.5);
    label(c, 'EXTRA EDITION', 330, 150, { size: 14, weight: 600, align: 'left', color: 'rgba(59,43,32,0.6)', font: 'Georgia, serif' });
    label(c, 'ONE PENNY', 1270, 150, { size: 14, weight: 600, align: 'right', color: 'rgba(59,43,32,0.6)', font: 'Georgia, serif' });
    // smudges soak into the page under the print
    for (const s of g.smudges) {
      c.save();
      c.globalAlpha = Math.min(0.55, s.life * 0.4);
      blob(c, s.x, s.y, s.r, s.r * 0.7, s.seed, 0.25, 12);
      c.fillStyle = '#3b2b20';
      c.fill();
      c.restore();
    }
    for (let i = 0; i < n; i++) {
      const x = x0 + i * cell;
      const y = 234;
      const ch = g.word[i];
      if (i < g.idx) {
        const thump = i === g.idx - 1 ? 1 + g.stamp * 0.35 : 1;
        c.save();
        c.translate(x, y);
        c.scale(thump, thump);
        label(c, ch, 0, 0, { size: 88, weight: 800, font: 'Georgia, "Times New Roman", serif' });
        c.restore();
      } else {
        c.save();
        c.font = `800 88px Georgia, "Times New Roman", serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 2;
        c.strokeStyle = i === g.idx ? '#b0402a' : 'rgba(59,43,32,0.3)';
        c.strokeText(ch, x, y);
        if (i === g.idx) {
          c.globalAlpha = 0.18;
          c.fillStyle = '#b0402a';
          c.fillText(ch, x, y);
        }
        c.restore();
        if (i === g.idx) {
          const bob = env.reduceMotion ? 0 : Math.sin(t * 6) * 3;
          c.beginPath();
          c.moveTo(x - cell * 0.36, 282 + bob);
          c.lineTo(x + cell * 0.36, 282 + bob);
          ink(c, 6, '#b0402a');
        }
      }
    }
  }

  g.draw = (c, t) => {
    scene(c, 'peeper', W, H, (c) => {
      band(c, 0, 0, W, 780, '#dcc898', 0.42, 1);
      // a printing press in the back room, quiet and grey
      c.save();
      c.globalAlpha = 0.35;
      for (const [x, r] of [[180, 120], [1420, 140]]) {
        c.beginPath(); c.arc(x, 560, r, 0, Math.PI * 2); ink(c, 3);
        c.beginPath(); c.arc(x, 560, r * 0.25, 0, Math.PI * 2); ink(c, 3);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.25, 560 + Math.sin(a) * r * 0.25); c.lineTo(x + Math.cos(a) * r, 560 + Math.sin(a) * r); ink(c, 2);
        }
      }
      // strings of drying pages
      for (const y of [330, 420]) {
        c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(800, y + 40, W, y); ink(c, 1.5);
        for (let i = 0; i < 9; i++) {
          const x = 120 + i * 170 + (y === 420 ? 80 : 0);
          const yy = y + 40 * (1 - Math.pow((x - 800) / 800, 2)) - 2;
          poly(c, [[x - 34, yy], [x + 34, yy], [x + 36, yy + 70], [x - 32, yy + 72]], i + y, 1.5);
          wash(c, '#f3edd8', 1);
          ink(c, 1.4);
          for (let r = 0; r < 5; r++) c.fillRect(x - 26, yy + 14 + r * 11, 50, 2);
        }
      }
      c.restore();
      // the floorboards
      poly(c, [[0, 770], [W, 764], [W, H], [0, H]], 3, 2);
      wash(c, '#b89a6a', 0.75);
      ink(c, 2);
      c.save();
      c.globalAlpha = 0.35;
      for (let i = 1; i < 4; i++) {
        c.beginPath(); c.moveTo(0, 770 + i * 34); c.lineTo(W, 766 + i * 34); ink(c, 1.4);
      }
      for (let i = 0; i < 14; i++) {
        const x = (i * 263) % W;
        const r = i % 4;
        c.beginPath(); c.moveTo(x, 770 + r * 34); c.lineTo(x, 804 + r * 34); ink(c, 1.4);
      }
      c.restore();
    });

    headline(c, t);

    // the letters, with soft shadows where they will land
    for (const l of g.letters) {
      const lx = g.letterX(l);
      if (l.landed !== undefined) {
        scrap(c, l.ch, lx, GROUND - 16, l.rot + 1.3, l.seed, clamp(l.landed / 0.8, 0, 1) * 0.6);
        continue;
      }
      c.save();
      c.globalAlpha = 0.08 + 0.18 * clamp(l.y / GROUND, 0, 1);
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(lx, GROUND - 2, 28, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      const wob = env.reduceMotion ? 0 : Math.sin(l.age * l.w * 2 + l.ph) * 0.25;
      const born = clamp(l.age / 0.25, 0, 1);
      c.save();
      c.translate(lx, l.y);
      c.scale(0.4 + 0.6 * born, 0.4 + 0.6 * born);
      scrap(c, l.ch, 0, 0, l.rot + wob, l.seed, born);
      c.restore();
    }

    // the Peeper
    const sh = g.shake > 0 && !env.reduceMotion ? Math.sin(g.shake * 70) * g.shake * 30 : 0;
    drawBird(c, 'peeper', { x: g.x + sh, y: GROUND, size: BIRD_SIZE, t, flip: g.flip });
    // ink spatters on the Peeper after a wrong catch
    if (g.shake > 0) {
      for (let i = 0; i < 3; i++) {
        blob(c, g.x + sh + (i - 1) * 30, CATCH_Y - 30 + i * 18, 12, 8, i + 9, 0.3, 10);
        c.fillStyle = 'rgba(59,43,32,0.7)';
        c.fill();
      }
    }

    for (const b of g.bits) {
      c.save();
      c.globalAlpha = Math.min(1, b.life * 2);
      c.translate(b.x, b.y);
      c.rotate(b.a);
      poly(c, [[-10, -7], [10, -6], [9, 7], [-9, 6]], 0, 1);
      wash(c, b.c, 1);
      ink(c, 1);
      c.restore();
    }
    for (const p of g.pops) {
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      label(c, p.text, p.x, p.y - (0.9 - p.life) * 60, { size: 56, weight: 800, color: p.color });
      c.restore();
    }
    if (g.extra > 0) {
      const k = g.extra;
      const pop = 1 + Math.max(0, k - 1.4) * 2.5;
      c.save();
      c.globalAlpha = Math.min(1, k * 2);
      c.translate(800, 420);
      c.rotate(-0.05);
      c.scale(pop, pop);
      poly(c, [[-300, -70], [300, -64], [296, 70], [-304, 64]], 3, 3);
      wash(c, PAL.lemon, 0.95);
      ink(c, 3);
      label(c, g.extraText, 0, -8, { size: 76, weight: 800, font: 'Georgia, serif' });
      label(c, `${g.lastWord} is in print!`, 0, 44, { size: 28, weight: 600 });
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => g.x;
  g.span = 760;

  return g;
}
