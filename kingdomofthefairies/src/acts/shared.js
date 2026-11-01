// Helpers shared by the act modules. Headless (no DOM).
export { rng } from '../board.js';

// A press counts as "on the beat" within this many beats of one (about
// ±0.13 s at 76.5 BPM).
export const BEAT_WINDOW = 0.17;

// The index of the beat a press at `beat` lands on, or null if it misses.
export function beatHit(beat, window = BEAT_WINDOW) {
  if (beat == null) return null;
  const k = Math.round(beat);
  return Math.abs(beat - k) <= window ? k : null;
}

// Phase within the beat, 0..1 (0 = on the beat).
export const beatPhase = (beat) => ((beat % 1) + 1) % 1;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
// The look of anything used up or taken (a spent clam, a sounded conch):
// drained of colour and dimmed, so it plainly can't be used again.
export const SPENT = 'grayscale(0.85) brightness(0.55)';
export const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
export const easeInOut = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
