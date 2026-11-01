// Tableaux: the film edition's cutscenes show a painted scene concept
// (assets/tableaux/, from design/source/cut_planning.py) across the whole
// stage, with a slow push-in like a camera creeping toward the footlights,
// and a silent-film caption card. Drawing only; headless-safe.
import { clamp, easeInOut } from './shared.js';

// Draws tableau `id` (slot `tableau-<id>`) at `pt` seconds of a `dur`-second
// shot: fading up from black, pushing in by `zoom`, toward `focus` (stage px).
export function tableau(k, id, pt, dur, { zoom = 0.07, focus = [640, 360], fadeIn = 0.5, fadeOut = 0.5 } = {}) {
  const c = k.c, f = clamp(pt / dur, 0, 1), s = 1 + zoom * easeInOut(f);
  c.save();
  c.fillStyle = k.col('#140a12'); c.fillRect(0, 0, 1280, 720);
  c.translate(focus[0], focus[1]); c.scale(s, s); c.translate(-focus[0], -focus[1]);
  if (!k.asset('tableau-' + id, 640, 720, 1280, 720)) {
    const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, k.col('#3a2240')); g.addColorStop(1, k.col('#120810'));
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  }
  c.restore();
  const a = Math.min(clamp(pt / fadeIn, 0, 1), clamp((dur - pt) / fadeOut, 0, 1));
  if (a < 1) { c.save(); c.globalAlpha = 1 - a; c.fillStyle = '#000'; c.fillRect(0, 0, 1280, 720); c.restore(); }
}

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
  if (sub) { c.font = '700 13px "Josefin Sans", sans-serif'; c.fillText(sub.toUpperCase(), cx, y + 67); }
  c.restore();
}

// How far into a shot its caption should be showing (fades in after `delay`).
export const cardAlpha = (pt, dur, delay = 0.6) => Math.min(clamp((pt - delay) / 0.5, 0, 1), clamp((dur - pt) / 0.4, 0, 1));
