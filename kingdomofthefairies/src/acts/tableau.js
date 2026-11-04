// The film edition's silent-film caption cards. Drawing only; headless-safe.
import { richText } from '../art.js';
import { clamp } from './shared.js';

// A silent-film caption: plum card, double pink rule, a line of script and a
// smaller line of capitals, fading with `a`. It sits low, over the
// footlights and the foot of the picture (drawn over the frame through
// k.over), so it hides little of the tableau.
export function card(k, title, sub = '', a = 1, opts = {}) {
  if (a <= 0) return;
  if (k.over && !opts.now) return k.over(() => card(k, title, sub, a, { ...opts, now: true }));
  const { cx = 640, y = 604, w = 720 } = opts;
  const c = k.c, h = sub ? 84 : 64, x = cx - w / 2;
  c.save(); c.globalAlpha = a * 0.94;
  c.fillStyle = k.col('#2a1424'); c.fillRect(x, y, w, h);
  c.strokeStyle = k.col('#c79ab7'); c.lineWidth = 1.5;
  c.strokeRect(x + 5, y + 5, w - 10, h - 10); c.strokeRect(x + 10, y + 10, w - 20, h - 20);
  c.globalAlpha = a; c.textAlign = 'center'; c.fillStyle = k.col('#f3c6dc');
  c.font = '34px Yesteryear, cursive'; c.fillText(title, cx, y + (sub ? 42 : 43));
  if (sub) { c.font = '700 13px "Josefin Sans", sans-serif'; richText(c, sub.toUpperCase(), cx, y + 67, { px: 13, mode: k.inputMode || 'key', col: k.col }); }
  c.restore();
}

// How far into a shot its caption should be showing (fades in after `delay`).
export const cardAlpha = (pt, dur, delay = 0.6) => Math.min(clamp((pt - delay) / 0.5, 0, 1), clamp((dur - pt) / 0.4, 0, 1));
