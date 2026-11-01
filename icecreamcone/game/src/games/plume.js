// Flowerpot Plume: Bloom.
//
// Five Flowerpot Plumes stand on the potting bench, each in its own panel
// like the book's strip of pictures, and a watering-can rose hangs from the
// pipe above. Move it left and right and hold the action to water the Plume
// beneath it. A watered Plume grows from sprout to bud to full bloom; each
// bloom scores one and the Plume starts again as a sprout. Between waterings
// the pots dry out (faster as time goes on), and a dry Plume wilts and loses
// the growth it had. Water one too long and its pot goes soggy: it stops
// growing for a moment, so keep moving along the bench. Growth comes from
// the drops that land in the pot, so rain spilt between pots is wasted.
// Score: blooms.

import { drawBird, scene, blob, poly, wash, ink, hatch, label, PAL, INK } from '../draw.js';
import { clamp, approach } from './index.js';
import { curve, knob } from './difficulty.js';

const DURATION = 45;
const BENCH = 628; // where the Plumes' feet stand: on top of the painted potting bench
const SIZE = 290;
const K = SIZE / 400;
const POT_TOP = BENCH - 240 * K; // where the rain reaches the soil
const POT_HALF = 80 * K + 14; // how wide a pot catches the rain
const ROSE_Y = 160; // the rose's face
const PIPE_Y = 60;
const SLOTS = [224, 512, 800, 1088, 1376];
const PANELS = ['#efd96a', '#f3e2a0', '#ea8fb0', '#a9b88a', '#d9a4a0'];

const GROW = 0.3; // growth per second while watered (a bloom takes about 3 s)
const SOAK = 0.22; // soak per second of watering; soggy at 1
const SOGGY = 2;
const DROPS = 100; // drops per second; each one is 1 / DROPS seconds' worth of water
const DRINK = 2.5; // how fast watering takes the dryness away

export default function create(env) {
  const { W, H, rng, sfx } = env;
  const g = {
    time: DURATION,
    score: 0,
    done: false,
    elapsed: 0,
    x: W / 2, // the rose
    raining: false,
    plants: SLOTS.map((x) => ({
      x,
      growth: 0.08 + rng() * 0.3,
      dry: 0.1 + rng() * 0.3,
      soak: 0,
      wet: 0,
      soggy: 0,
      bloomT: 0,
      thirst: 0.85 + rng() * 0.3, // how fast this one dries, relative to the others
      stage: 0,
      wilting: false,
      wilt: 0,
      shake: 0,
    })),
    drops: [], // falling water
    bits: [], // splashes and petals
    pops: [],
    soggies: 0,
    wilts: 0,
    dropT: 0,
    soundT: 0,
  };

  // How hard it is now, 0 (easy) .. 0.5 (medium) .. 1 (hard), along the
  // shared curve for the chosen Difficulty (see difficulty.js). The pots dry
  // slowly at first (so a newcomer can tend one Plume at a time) and fast by
  // the end, and late on a Plume soaks up to soggy sooner. Each knob: easy,
  // medium, hard.
  const dAt = curve(env);
  g.d = () => dAt(Math.min(1, g.elapsed / DURATION));
  const dryRate = () => knob(g.d(), 0.06, 0.15, 0.27); // dryness a second, times the pot's thirst
  g.dryRate = dryRate;
  g.soakRate = () => SOAK * knob(g.d(), 0.85, 0.98, 1.15); // how fast watering soaks the pot
  // The Plume under the rose, if any.
  g.under = () => g.plants.find((p) => Math.abs(p.x - g.x) < POT_HALF) || null;

  function pop(text, x, y, color = INK, size = 46) {
    g.pops.push({ text, x, y, color, size, life: 1.3 });
  }

  function bloom(p) {
    g.score++;
    p.bloomT = 0.9;
    p.growth = 1;
    p.dry = 0;
    p.soak *= 0.5;
    const top = BENCH - (235 + 30 + 230) * K;
    const cols = [PAL.strawberry, PAL.slate, PAL.ochre, PAL.mauve, PAL.dusty, PAL.lemon];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rng() * 0.3;
      const v = 220 + rng() * 260;
      g.bits.push({ kind: 'petal', x: p.x, y: top, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, life: 1.1 + rng() * 0.4, color: cols[i % cols.length], spin: rng() * 6 });
    }
    pop('Bloom!', p.x, top - 70, PAL.magenta, 58);
    pop('+1', p.x, top - 130, PAL.magenta, 40);
    sfx('bloom');
    env.vibrate?.(30);
  }

  // A drop of water reaches a Plume's pot: it drinks, grows, and soaks.
  function drink(p, amount) {
    if (p.bloomT > 0 || p.soggy > 0) return;
    p.dry = Math.max(0, p.dry - DRINK * amount);
    p.soak += g.soakRate() * amount;
    p.growth += GROW * amount;
    if (p.soak >= 1) {
      p.soggy = SOGGY;
      p.soak = 0.55;
      g.soggies++;
      pop('Soggy!', p.x, POT_TOP - 60, PAL.slate, 48);
      sfx('splash');
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

    // Move the rose: follow the pointer, or glide with the stick.
    if (input.pointer.active) g.x = approach(g.x, input.pointer.x, 12, dt);
    else g.x += input.x * 900 * dt;
    g.x = clamp(g.x, 110, W - 110);

    // Rain while the action is held.
    g.raining = !!input.action;
    if (g.raining) {
      g.dropT -= dt;
      while (g.dropT <= 0) {
        g.dropT += 1 / DROPS;
        g.drops.push({ x: g.x + (rng() - 0.5) * 84, y: ROSE_Y + rng() * 10, vx: (rng() - 0.5) * 40, vy: 880 + rng() * 80 });
      }
      g.soundT -= dt;
      if (g.soundT <= 0) {
        sfx('pour');
        g.soundT = 0.14;
      }
    }
    for (const d of g.drops) {
      const py = d.y;
      d.vy += 1500 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (py < POT_TOP && d.y >= POT_TOP) {
        const p = g.plants.find((p) => Math.abs(p.x - d.x) < POT_HALF);
        if (p) {
          d.dead = true;
          p.wet = 0.15;
          drink(p, 1 / DROPS);
          if (rng() < 0.15) g.bits.push({ kind: 'splash', x: d.x, y: POT_TOP, vx: (rng() - 0.5) * 160, vy: -100 - rng() * 120, life: 0.35 });
        }
      }
      if (d.y >= BENCH) {
        d.dead = true;
        if (rng() < 0.3) g.bits.push({ kind: 'splash', x: d.x, y: BENCH, vx: (rng() - 0.5) * 160, vy: -80 - rng() * 100, life: 0.3 });
      }
    }
    g.drops = g.drops.filter((d) => !d.dead);

    // The Plumes.
    for (const p of g.plants) {
      p.wet = Math.max(0, p.wet - dt);
      p.shake = Math.max(0, p.shake - dt);
      const watered = p.wet > 0;
      if (p.bloomT > 0) {
        p.bloomT -= dt;
        if (p.bloomT <= 0) {
          p.growth = 0.06;
          p.stage = 0;
        }
      } else if (p.soggy > 0) {
        p.soggy -= dt;
        p.dry = 0;
        if (watered && p.shake <= 0) p.shake = 0.3;
      } else if (!watered) {
        p.soak = Math.max(0, p.soak - 0.35 * dt);
        p.dry = Math.min(1, p.dry + dryRate() * p.thirst * dt);
        if (p.dry >= 1) p.growth -= 0.2 * dt;
        else if (p.dry > 0.75) p.growth -= 0.06 * dt;
        p.growth = Math.max(0.06, p.growth);
      }
      // Wilting, once it gets too dry.
      const was = p.wilting;
      p.wilting = p.dry > 0.75;
      if (p.wilting && !was && p.bloomT <= 0) {
        g.wilts++;
        sfx('wilt');
        pop('Thirsty!', p.x, POT_TOP - 50, PAL.brick, 40);
      }
      p.wilt = approach(p.wilt, clamp((p.dry - 0.5) / 0.5, 0, 1), 4, dt);
      // Stages: a little chime as it gets to a new one.
      if (p.bloomT <= 0) {
        const stage = p.growth >= 0.8 ? 3 : p.growth >= 0.55 ? 2 : p.growth >= 0.3 ? 1 : 0;
        if (stage > p.stage) sfx('grow', { pitch: stage * 3 });
        p.stage = stage;
        if (p.growth >= 1) bloom(p);
      }
    }

    for (const b of g.bits) {
      b.vy += (b.kind === 'petal' ? 500 : 1200) * dt;
      b.vx *= b.kind === 'petal' ? 1 - 1.5 * dt : 1;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.spin !== undefined) b.spin += dt * 4;
    }
    g.bits = g.bits.filter((b) => b.life > 0);
    for (const p of g.pops) {
      p.life -= dt;
      p.y -= 40 * dt;
    }
    g.pops = g.pops.filter((p) => p.life > 0);
  };

  g.hud = () => `Blooms ${g.score}`;
  g.summary = () => {
    const lines = [`${g.score} full bloom${g.score === 1 ? '' : 's'}.`];
    const woes = [];
    if (g.soggies) woes.push(`${g.soggies} soggy pot${g.soggies === 1 ? '' : 's'}`);
    if (g.wilts) woes.push(`${g.wilts} wilt${g.wilts === 1 ? '' : 's'}`);
    lines.push(woes.length ? `Along the way: ${woes.join(', ')}.` : 'Not a single soggy or wilted Plume!');
    return lines;
  };

  // ---------- drawing ----------

  function drawRose(c, t) {
    // the pipe along the top, and the rose that slides on it
    c.beginPath();
    c.moveTo(40, PIPE_Y);
    c.lineTo(W - 40, PIPE_Y + 2);
    c.lineWidth = 16;
    c.strokeStyle = '#9aa4ac';
    c.stroke();
    c.beginPath();
    c.moveTo(40, PIPE_Y - 8);
    c.lineTo(W - 40, PIPE_Y - 6);
    c.moveTo(40, PIPE_Y + 8);
    c.lineTo(W - 40, PIPE_Y + 10);
    ink(c, 1.8);
    for (const bx of [60, W - 60]) {
      poly(c, [[bx - 12, PIPE_Y - 40], [bx + 12, PIPE_Y - 40], [bx + 12, PIPE_Y + 14], [bx - 12, PIPE_Y + 14]], bx, 1);
      wash(c, '#7a848c');
      ink(c, 1.8);
    }
    const x = g.x;
    const swing = g.raining ? Math.sin(t * 30) * 1.2 : 0;
    // the collar and neck
    poly(c, [[x - 18, PIPE_Y - 14], [x + 18, PIPE_Y - 14], [x + 18, PIPE_Y + 16], [x - 18, PIPE_Y + 16]], 3, 0.8);
    wash(c, '#7a848c');
    ink(c, 2);
    poly(c, [[x - 9, PIPE_Y + 14], [x + 9, PIPE_Y + 14], [x + 9 + swing, ROSE_Y - 70], [x - 9 + swing, ROSE_Y - 70]], 4, 0.8);
    wash(c, '#9aa4ac');
    ink(c, 2);
    // the rose: a flared bell with a pierced face
    c.save();
    c.translate(x + swing, ROSE_Y);
    poly(c, [[-14, -72], [14, -72], [56, -8], [-56, -8]], 5, 1);
    wash(c, '#8f9ca8');
    ink(c, 2.4);
    poly(c, [[-14, -72], [14, -72], [56, -8], [-56, -8]], 5, 1);
    hatch(c, -60, -76, 60, -6, 7, 0.3, 1);
    c.beginPath();
    c.ellipse(0, -6, 58, 14, 0, 0, Math.PI * 2);
    c.fillStyle = '#c8d4dc';
    c.fill();
    ink(c, 2.2);
    c.fillStyle = '#3a4a5a';
    for (let i = -4; i <= 4; i++) {
      for (let j = -1; j <= 1; j++) {
        const hx = i * 11 + (j % 2 ? 5 : 0);
        const hy = -6 + j * 6;
        if ((hx * hx) / (52 * 52) + ((hy + 6) * (hy + 6)) / (11 * 11) < 1) {
          c.beginPath();
          c.arc(hx, hy, 1.8, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.restore();
    // a soft shadow where the rain will fall
    const p = g.under();
    if (p) {
      c.save();
      c.globalAlpha = 0.18 + (g.raining ? 0.1 : 0);
      c.fillStyle = '#3a7a8a';
      c.beginPath();
      c.ellipse(p.x, POT_TOP + 4, 66, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  function teardrop(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r * 2.4);
    c.quadraticCurveTo(x + r * 1.1, y - r * 0.4, x, y + r);
    c.quadraticCurveTo(x - r * 1.1, y - r * 0.4, x, y - r * 2.4);
  }

  // A little droplet gauge on the bench front: how damp the pot is.
  function drawGauge(c, p, t) {
    const gx = p.x;
    const gy = BENCH + 48;
    const damp = 1 - p.dry;
    const urgent = p.dry > 0.75;
    const blinkOff = urgent && Math.sin(t * 10) < -0.2;
    teardrop(c, gx - 64, gy + 6, 8);
    c.fillStyle = urgent ? PAL.brick : '#3a7a8a';
    c.fill();
    ink(c, 1.4);
    poly(c, [[gx - 48, gy - 9], [gx + 62, gy - 9], [gx + 62, gy + 9], [gx - 48, gy + 9]], p.x, 0.6);
    c.fillStyle = 'rgba(250,244,228,0.9)';
    c.fill();
    if (!blinkOff) {
      c.save();
      c.clip();
      c.fillStyle = urgent ? PAL.brick : damp > 0.5 ? '#4a8aa0' : PAL.ochre;
      c.fillRect(gx - 48, gy - 9, 110 * damp, 18);
      // soak: a blue wash creeping in from the right, a warning of sogginess
      if (p.soak > 0.05) {
        c.fillStyle = `rgba(40,70,140,${0.25 + p.soak * 0.4})`;
        c.fillRect(gx + 62 - 110 * Math.min(1, p.soak), gy - 9, 110 * Math.min(1, p.soak), 4);
      }
      c.restore();
    }
    poly(c, [[gx - 48, gy - 9], [gx + 62, gy - 9], [gx + 62, gy + 9], [gx - 48, gy + 9]], p.x, 0.6);
    ink(c, 1.6);
  }

  g.draw = (c, t) => {
    scene(c, 'plume', W, H, (c) => {
      // the strip of panels, as in the book
      SLOTS.forEach((x, i) => {
        const x0 = x - 132;
        const x1 = x + 132;
        poly(c, [[x0, 130], [x1, 130], [x1, BENCH], [x0, BENCH]], i + 1, 1.5);
        wash(c, PANELS[i], 0.32);
        c.save();
        poly(c, [[x0, 130], [x1, 130], [x1, BENCH], [x0, BENCH]], i + 1, 1.5);
        c.clip();
        c.globalAlpha = 0.12;
        for (let k = 0; k < 6; k++) {
          blob(c, x0 + 40 + ((k * 73) % 200), 200 + k * 95, 60, 40, i * 10 + k, 0.2);
          c.fillStyle = PANELS[i];
          c.fill();
        }
        c.restore();
        poly(c, [[x0, 130], [x1, 130], [x1, BENCH], [x0, BENCH]], i + 1, 1.5);
        ink(c, 1.6);
      });
      // the bench
      poly(c, [[30, BENCH - 6], [W - 30, BENCH - 4], [W - 30, BENCH + 22], [30, BENCH + 20]], 9, 1);
      wash(c, PAL.wafer);
      ink(c, 2.4);
      poly(c, [[44, BENCH + 20], [W - 44, BENCH + 22], [W - 44, BENCH + 76], [44, BENCH + 74]], 10, 1);
      wash(c, '#c9925a');
      ink(c, 2);
      poly(c, [[44, BENCH + 20], [W - 44, BENCH + 22], [W - 44, BENCH + 76], [44, BENCH + 74]], 10, 1);
      hatch(c, 40, BENCH + 18, W - 40, BENCH + 80, 14, 0.18, 1);
      for (const lx of [80, W - 110]) {
        poly(c, [[lx, BENCH + 74], [lx + 30, BENCH + 74], [lx + 30, H], [lx, H]], lx, 1);
        wash(c, '#b07a48');
        ink(c, 2);
      }
    });

    drawRose(c, t);

    // rain behind the plants' faces, in front of the panels
    c.fillStyle = '#2f6f7a';
    for (const d of g.drops) {
      teardrop(c, d.x, d.y, 5.5);
      c.fill();
    }

    for (const p of g.plants) {
      const sh = p.shake > 0 && !env.reduceMotion ? Math.sin(p.shake * 60) * 3 : 0;
      const showGrowth = p.bloomT > 0 ? 1 : clamp(p.growth, 0, 1);
      drawBird(c, 'plume', { x: p.x + sh, y: BENCH, size: SIZE, t: t + p.x * 0.01, pose: { growth: showGrowth, wilt: p.bloomT > 0 ? 0 : p.wilt, soggy: p.soggy > 0 } });
      // a glow and sparkle while in full bloom
      if (p.bloomT > 0) {
        const top = BENCH - (235 + 260) * K;
        c.save();
        c.globalAlpha = Math.min(1, p.bloomT * 2) * 0.5;
        const grd = c.createRadialGradient(p.x, top - 20, 10, p.x, top - 20, 130);
        grd.addColorStop(0, 'rgba(255,240,170,0.9)');
        grd.addColorStop(1, 'rgba(255,240,170,0)');
        c.fillStyle = grd;
        c.fillRect(p.x - 140, top - 160, 280, 280);
        c.restore();
      }
      if (p.soggy > 0) {
        c.save();
        c.globalAlpha = 0.8;
        label(c, '~', p.x + 50, POT_TOP + 30 + Math.sin(t * 5) * 3, { size: 40, color: PAL.slate, weight: 800 });
        c.restore();
      }
      if (p.soak > 0.75 && p.soggy <= 0) {
        // beads of sweat: about to go soggy
        c.fillStyle = '#4a7ab0';
        teardrop(c, p.x + 70, POT_TOP + 20 + ((t * 40) % 20), 5);
        c.fill();
        ink(c, 1);
      }
      drawGauge(c, p, t);
    }

    for (const b of g.bits) {
      c.save();
      c.globalAlpha = clamp(b.life * 2, 0, 1);
      if (b.kind === 'petal') {
        c.translate(b.x, b.y);
        c.rotate(b.spin);
        blob(c, 0, 0, 12, 7, 3, 0.1, 10);
        wash(c, b.color);
        ink(c, 1);
      } else {
        c.beginPath();
        c.arc(b.x, b.y, 3, 0, Math.PI * 2);
        c.fillStyle = '#2f6f7a';
        c.fill();
      }
      c.restore();
    }

    for (const p of g.pops) {
      const k = Math.min(1, (1.3 - p.life) * 8);
      const s = 0.6 + 0.4 * k + (k < 1 ? 0.15 : 0);
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.scale(s, s);
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(250,244,228,0.9)';
      c.font = `800 ${p.size}px Fraunces, Georgia, serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeText(p.text, 0, 0);
      label(c, p.text, 0, 0, { size: p.size, color: p.color, weight: 800 });
      c.restore();
    }

    if (g.elapsed < 3.5) {
      c.save();
      c.globalAlpha = Math.min(1, 3.5 - g.elapsed);
      label(c, 'Move the can · hold to water', W / 2, 520, { size: 36, weight: 600 });
      c.restore();
    }
  };

  // For a narrow (portrait) screen: what the view follows, and how much of
  // the width it must keep in view.
  g.focus = () => g.x;
  g.span = 760;

  return g;
}
