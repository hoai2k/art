// One difficulty curve for every minigame (see design/difficulty.md).
//
// A game asks for `d`, how hard it is right now, from 0 (the easiest version)
// through 0.5 (medium: what the pass mark is built around) to 1 (hard: what
// world records are made of, never needed to pass). `d` follows the round's
// progress `p` (0 at the start, 1 at the end) along a curve set by the
// Difficulty setting:
//
//   Normal  0 at the start, rising gently to medium by 65% of the round,
//           resting there a moment, then easing on to 0.85 at the end.
//   Easier  the same shape but lower: 0.25 by 65%, 0.35 at the end.
//   Harder  starts near medium (0.45), 0.75 by 65%, full hard at the end.
//
// Each knob is then written as three values, easy / medium / hard:
//   g.gap = () => knob(g.d(), 2.9, 1.9, 1.15);

export const LEVELS = ['easier', 'normal', 'harder'];
export const LEVEL_NAMES = { easier: 'Easier', normal: 'Normal', harder: 'Harder' };

// Where each setting's curve starts, where it is at MID, and where it ends.
export const CURVES = {
  easier: { start: 0, mid: 0.25, end: 0.35 },
  normal: { start: 0, mid: 0.5, end: 0.85 },
  harder: { start: 0.45, mid: 0.75, end: 1 },
};
export const MID = 0.65;

// Any value that isn't a known setting (missing, old, mistyped) is Normal.
export const levelOf = (setting) => (LEVELS.includes(setting) ? setting : 'normal');

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// d for progress p (0..1) at a setting. Up to MID a smoothstep from start to
// mid (flat at both ends: a gentle opening, and a pause at medium); after it
// a quadratic ease-in from mid to end, so the hard part comes only at the end.
export function difficulty(p, setting = 'normal') {
  const c = CURVES[levelOf(setting)];
  const k = clamp01(p);
  if (k <= MID) {
    const x = k / MID;
    return c.start + (c.mid - c.start) * x * x * (3 - 2 * x);
  }
  const x = (k - MID) / (1 - MID);
  return c.mid + (c.end - c.mid) * x * x;
}

// A knob's value at difficulty d: easy at 0, medium at 0.5, hard at 1, in a
// straight line between them.
export function knob(d, easy, medium, hard) {
  const k = clamp01(d);
  return k <= 0.5 ? easy + (medium - easy) * (k / 0.5) : medium + (hard - medium) * ((k - 0.5) / 0.5);
}

// The usual way in: `const dAt = curve(env)`, then `g.d = () => dAt(progress())`.
export const curve = (env) => {
  const level = levelOf(env?.difficulty);
  return (p) => difficulty(p, level);
};
