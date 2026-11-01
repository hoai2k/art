// Life in the pictures: wind with passing gusts, trees bending from the
// trunk, loose leaves blown across, faces and figures breathing and tilting,
// clouds drifting, suns and moons glowing, stars twinkling, hearts beating,
// fish swimming, ribbons and water rippling, eyes and birds now and then.
//
// It only changes how a piece is drawn (an offset, a sway, a wave, a swap),
// never where it is, so the controls and their setups are untouched. Pure:
// no DOM, so it runs in the tests.

import { W, H } from './collage.js';

// How windy each scene is, and what else moves in it.
export const SCENE_LIFE = {
  viriditas: { wind: 1, drift: true },
  'golden-lady': { wind: 0.7, drift: true },
  'black-tree': { wind: 0.6, drift: true },
  'man-and-woman': { wind: 0.75, drift: true },
  'two-moons': { wind: 0.3 },
  'night-quilt': { wind: 0.15 },
  dancers: { wind: 0.25, dance: true },
  'blue-lady': { wind: 0.5, water: 0.22 },
  crowd: { wind: 0.12 },
  'silk-bird': { wind: 0.5 },
};

const sceneLife = (game) => SCENE_LIFE[game.scene.key] || { wind: 0.2 };

// Wind blowing left to right: a breeze that wanders, and gusts that sweep
// across the picture as a travelling front.
export function windAt(game, x, y) {
  const s = sceneLife(game);
  const t = game.time;
  let w = s.wind * (0.22 + 0.12 * Math.sin(t * 0.61 + x * 0.35) + 0.08 * Math.sin(t * 1.73 + y * 0.5 + x * 0.1));
  for (const g of game.wind?.gusts || []) {
    const d = (x - g.front) / g.width;
    w += g.strength * Math.exp(-d * d) * Math.min(1, g.age * 1.5);
  }
  return w;
}

export function gustNow(game) {
  return (game.wind?.gusts || []).reduce((s, g) => Math.max(s, g.strength * Math.min(1, g.age * 1.5)), 0);
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Advance the wind and the loose leaves; nudge the light pieces on a gust.
export function updateLife(game, dt, motion = 1) {
  dt = Math.min(dt, 1 / 20);
  const s = sceneLife(game);
  if (!game.wind || game.wind.scene !== game.index) game.wind = { scene: game.index, gusts: [], next: 2 + game.random() * 4 };
  if (!game.drift || game.drift.scene !== game.index) game.drift = Object.assign([], { scene: game.index });
  const wind = game.wind;
  wind.next -= dt;
  if (wind.next <= 0 && s.wind > 0.2) {
    wind.gusts.push({ front: -5, speed: 4 + game.random() * 4, width: 2.5 + game.random() * 2, strength: s.wind * (0.6 + game.random() * 0.6), age: 0 });
    wind.next = 6 + game.random() * 9;
  }
  for (const g of wind.gusts) {
    g.front += g.speed * dt;
    g.age += dt;
  }
  wind.gusts = wind.gusts.filter((g) => g.front < W + 8);

  // A gust carries the light pieces a little way; their springs bring them home.
  for (const p of game.pieces) {
    const light = p.kind === 'leaf' ? 0.5 : p.kind === 'cloud' ? 0.25 : p.kind === 'ribbon' || p.kind === 'triangle' ? 0.35 : 0;
    if (!light) continue;
    const w = windAt(game, p.x, p.y) - s.wind * 0.22;
    if (w > 0.05) {
      p.vx += w * light * 1.6 * dt * motion;
      p.vrot += w * light * 0.6 * dt * motion * (p.i % 2 ? 1 : -1);
    }
  }

  // Loose leaves lifted by the gusts, from the trees or blown in from the left.
  const drift = game.drift;
  const gust = gustNow(game);
  if (s.drift && motion > 0.5 && drift.length < 14 && game.random() < (gust * 2.4 + 0.04) * dt) {
    const trees = game.pieces.filter((p) => p.kind === 'tree' || p.kind === 'leaf');
    const from = trees.length && game.random() < 0.6 ? trees[Math.floor(game.random() * trees.length)] : null;
    drift.push({
      x: from ? from.x + (game.random() - 0.5) * from.w * 0.6 : -0.6,
      y: from ? from.y - from.h * (0.1 + game.random() * 0.35) : 0.6 + game.random() * (H * 0.7),
      vx: 1 + game.random(), vy: -0.4 + game.random() * 0.4,
      rot: game.random() * 6.28, vrot: (game.random() - 0.5) * 4, flip: 1,
      size: 0.32 + game.random() * 0.3, tex: Math.floor(game.random() * 1000), seed: game.random() * 100, age: 0,
    });
  }
  for (const d of drift) {
    d.age += dt;
    const w = windAt(game, d.x, d.y);
    d.vx += (w * 5.5 + 0.3 - d.vx) * dt * 0.9;
    d.vy += (0.35 + Math.sin(d.age * 2.1 + d.seed) * 0.9 - d.vy) * dt * 1.2;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vrot * dt * (0.5 + w);
    d.flip = Math.cos(d.age * (1.6 + (d.seed % 1)) + d.seed); // tumbling: seen edge-on now and then
  }
  for (let i = drift.length - 1; i >= 0; i--) {
    const d = drift[i];
    if (d.x > W + 1 || d.y > H + 1 || d.age > 14) drift.splice(i, 1);
  }
}

// How one piece is drawn this frame, on top of where it is:
// { dx, dy, drot, sx, sy, sway (world units at the top), wave: [amp, cycles, speed], swap }
export function life(game, p, motion = 1) {
  const t = game.time;
  const seed = hash(p.i + 1 + game.index * 17) * 40;
  const s = SCENE_LIFE[game.scene?.key] || { wind: 0.2 };
  const out = { dx: 0, dy: 0, drot: 0, sx: 1, sy: 1, sway: 0, wave: [0, 1, 1], swap: -1 };
  const w = windAt(game, p.x, p.y - p.h * 0.3);
  const sin = Math.sin;
  switch (p.kind) {
    case 'tree':
      out.sway = w * 0.09 * p.h + 0.015 * p.h * sin(t * 0.7 + seed);
      break;
    case 'reeds':
    case 'bud':
    case 'berries':
    case 'flower':
      out.sway = w * 0.15 * p.h + 0.02 * p.h * sin(t * 1.1 + seed);
      out.drot = 0.025 * sin(t * 0.9 + seed);
      break;
    case 'leaf':
      out.drot = (0.04 + 0.1 * Math.abs(w)) * sin(t * 3 + seed);
      out.dy = 0.04 * sin(t * 2.3 + seed);
      out.sway = w * 0.06 * p.h;
      break;
    case 'hair':
      out.dx = w * 0.05;
      out.wave = [0.012 * p.h * (0.5 + Math.abs(w)), 1, 1.4];
      out.dy = 0.006 * p.h * sin(t * 0.95 + seed);
      break;
    case 'cloud':
      out.dx = 0.3 * sin(t * 0.05 + seed) + w * 0.15;
      out.sx = 1 + 0.02 * sin(t * 0.31 + seed);
      out.sy = 1 + 0.015 * sin(t * 0.27 + seed + 1);
      break;
    case 'sun':
    case 'moon': {
      const b = 1 + 0.02 * sin(t * 0.55 + seed);
      out.sx = b;
      out.sy = b;
      out.drot = 0.035 * sin(t * 0.13 + seed);
      break;
    }
    case 'star': {
      const tw = 1 + 0.08 * Math.max(0, sin(t * 1.9 + seed)) ** 3;
      out.sx = tw;
      out.sy = tw;
      out.drot = 0.12 * sin(t * 0.2 + seed);
      break;
    }
    case 'heart': {
      // Two soft beats, then a rest.
      const ph = (t * 0.9 + seed) % 2.6;
      const beat = 0.045 * Math.exp(-(((ph - 0.1) / 0.07) ** 2)) + 0.03 * Math.exp(-(((ph - 0.38) / 0.07) ** 2));
      out.sx = 1 + beat;
      out.sy = 1 + beat;
      break;
    }
    case 'face':
      out.drot = 0.022 * sin(t * 0.37 + seed) + 0.008 * sin(t * 0.91 + seed * 2);
      out.dy = 0.01 * p.h * sin(t * 0.95 + seed);
      out.dx = 0.006 * p.w * sin(t * 0.29 + seed);
      break;
    case 'body':
      out.sy = 1 + 0.008 * sin(t * 0.95 + seed);
      out.dy = -0.004 * p.h * sin(t * 0.95 + seed);
      break;
    case 'figure':
      if (s.dance) {
        out.sway = 0.05 * p.h * sin(t * 0.8 + seed);
        out.drot = 0.03 * sin(t * 0.8 + seed + 1);
        out.dy = -0.015 * p.h * Math.abs(sin(t * 0.8 + seed));
      } else {
        out.sy = 1 + 0.01 * sin(t * 0.9 + seed);
        out.dy = -0.005 * p.h * sin(t * 0.9 + seed);
        out.sway = 0.012 * p.h * sin(t * 0.43 + seed);
      }
      break;
    case 'eye': {
      // A blink every few seconds: squash shut and open again.
      const period = 4.2 + (seed % 3);
      const ph = (t + seed) % period;
      if (ph < 0.18) out.sy = 0.1 + 0.9 * Math.abs(Math.cos((ph / 0.18) * Math.PI));
      out.drot = 0.02 * sin(t * 0.4 + seed);
      break;
    }
    case 'bird': {
      const ph = (t + seed) % 5.5;
      out.dy = -0.03 * Math.abs(sin(t * 2.4 + seed));
      if (ph < 0.4) out.dy -= sin((ph / 0.4) * Math.PI) * 0.22;
      out.drot = 0.07 * sin(t * 1.3 + seed);
      // With its delivered poses: a quick flap (half open, raised, half open),
      // and later a ruffle with a look back over its shoulder.
      if (p.poses?.length >= 2 && ph > 2 && ph < 2.45) out.swap = [0, 1, 0][Math.floor((ph - 2) / 0.15)];
      if (p.poses?.length >= 3 && ph > 4 && ph < 4.8) out.swap = 2;
      break;
    }
    case 'fish':
      out.wave = [0.05 * p.h, 1.2, 3.2];
      out.dx = 0.25 * sin(t * 0.25 + seed);
      out.drot = 0.025 * sin(t * 0.5 + seed);
      break;
    case 'ribbon':
    case 'band':
      out.wave = [(0.05 + 0.04 * Math.abs(w) + (s.water || 0) * 0.1) * p.h, 1.4, 1.1];
      break;
    case 'triangle':
    case 'diamond':
      out.drot = 0.015 * sin(t * 0.5 + seed);
      out.sway = w * 0.04 * p.h;
      break;
    case 'hand':
      out.drot = 0.035 * sin(t * 0.6 + seed);
      out.dx = 0.03 * sin(t * 0.6 + seed);
      break;
    default:
      break;
  }
  // A face with a delivered blink closes its eyes now and then.
  if (p.blink && (p.kind === 'face' || p.kind === 'body')) {
    const period = 3.6 + (seed % 3.5);
    if ((t + seed) % period < 0.16) out.swap = 0;
  }
  if (motion !== 1) {
    out.dx *= motion;
    out.dy *= motion;
    out.drot *= motion;
    out.sway *= motion;
    out.wave[0] *= motion;
    out.sx = 1 + (out.sx - 1) * motion;
    out.sy = 1 + (out.sy - 1) * motion;
  }
  return out;
}

// The ground: water ripples, and a cloth billow as a gust goes by.
export function groundRipple(game, motion = 1) {
  const s = sceneLife(game);
  return ((s.water || 0) + gustNow(game) * 0.06) * motion;
}
