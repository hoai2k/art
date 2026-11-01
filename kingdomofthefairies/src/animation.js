// Shared sprite-sheet timing. Beat cycles use their musical period rather
// than assuming a stored frame count implies the capture frame rate.
export function validAnimation(meta, image = null) {
  if (!meta || !['loop', 'pingpong', 'once'].includes(meta.loop || 'loop')) return false;
  for (const key of ['frameW', 'frameH', 'frames', 'cols']) {
    if (!Number.isInteger(meta[key]) || meta[key] <= 0) return false;
  }
  if (!Number.isFinite(meta.fps) || meta.fps <= 0) return false;
  if (meta.beats != null && (!Number.isFinite(meta.beats) || meta.beats <= 0 || !Number.isFinite(meta.bpm ?? 76.5) || (meta.bpm ?? 76.5) <= 0)) return false;
  if (meta.duration != null && (!Number.isFinite(meta.duration) || meta.duration <= 0)) return false;
  if (image) {
    const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
    if (w < meta.cols * meta.frameW || h < Math.ceil(meta.frames / meta.cols) * meta.frameH) return false;
  }
  return true;
}

export function animationDuration(meta) {
  if (meta.beats != null) return meta.beats * 60 / (meta.bpm ?? 76.5);
  if (meta.duration != null) return meta.duration;
  const count = meta.loop === 'pingpong' && meta.frames > 1 ? 2 * meta.frames - 2 : meta.frames;
  return count / meta.fps;
}

export function animationFrame(meta, seconds) {
  if (!validAnimation(meta) || !Number.isFinite(seconds)) return null;
  const time = Math.max(0, seconds), duration = animationDuration(meta);
  let frame;
  if (meta.loop === 'once') frame = Math.min(meta.frames - 1, Math.floor(time / duration * meta.frames));
  else {
    const cycle = meta.loop === 'pingpong' && meta.frames > 1 ? 2 * meta.frames - 2 : meta.frames;
    let fraction = time / duration - Math.floor(time / duration);
    if (fraction > 1 - 1e-10) fraction = 0;
    let step = Math.min(cycle - 1, Math.floor(fraction * cycle + 1e-9));
    if (meta.loop === 'pingpong' && step >= meta.frames) step = cycle - step;
    frame = step;
  }
  return { index: frame, sx: frame % meta.cols * meta.frameW, sy: Math.floor(frame / meta.cols) * meta.frameH, sw: meta.frameW, sh: meta.frameH };
}

// Old-film idle for the people: the delivered still is frame A and its two
// generated variants (<id>-idle-b, <id>-idle-c) are flicked A, B, A, C, one
// frame per `step` seconds (half a beat by default), like a figure in a
// hand-cranked film. `has(id)` says whether a frame is delivered; with
// neither variant the still stands alone.
export const IDLE_STEP = 30 / 76.5;
export function idleFrameId(id, time, has, step = IDLE_STEP) {
  const b = has(id + '-idle-b') ? id + '-idle-b' : null, c = has(id + '-idle-c') ? id + '-idle-c' : null;
  if ((!b && !c) || !Number.isFinite(time) || !(step > 0)) return id;
  const seq = [id, b || c, id, c || b];
  return seq[((Math.floor(time / step) % 4) + 4) % 4];
}

// Film tricks that make a few frames (even the still alone) read as a figure
// in a hand-cranked film, layered on the idle frames above:
// - uneven cranking: each frame is held a little longer or shorter, so the
//   flick from A to B never falls on a metronome;
// - boil: a tiny shift and tilt every twelfth of a second, as each frame of a
//   hand-registered print sits slightly differently in the gate;
// - sway: the cut-out rocks slowly on its feet, like a toy-theatre puppet on
//   its slide;
// - breath: a slow, slight stretch upward from the feet.
// Deterministic in (id, time), so the workbench scrub repeats exactly. `amp`
// scales everything (1 full film look, 0.5 gentle, 0 still).
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const noise = (seed, n) => { const x = Math.sin((seed % 10007) * 12.9898 + n * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
export const FILM_IDLE = { boilHz: 12, boilPx: 0.006, boilRot: 0.007, crank: 0.3, sway: 0.014, swayPeriod: 4 * 60 / 76.5, breath: 0.008, breathPeriod: 2.6 };
export function idlePose(id, time, { step = IDLE_STEP, amp = 1, w = 1, h = 1 } = {}) {
  if (!Number.isFinite(time) || !(amp > 0)) return { time, dx: 0, dy: 0, rot: 0, sy: 1 };
  const F = FILM_IDLE, seed = hash(id), wide = Math.min(1, h / w); // wide groups barely rock
  const k = Math.floor(time / step);
  const frameTime = time + F.crank * amp * step * noise(seed, k); // uneven cranking
  const b = Math.floor(time * F.boilHz), phase = (seed % 997) / 997 * Math.PI * 2;
  return {
    time: frameTime,
    dx: noise(seed + 1, b) * F.boilPx * h * amp,
    dy: noise(seed + 2, b) * F.boilPx * h * 0.5 * amp,
    rot: (noise(seed + 3, b) * F.boilRot + Math.sin(time * Math.PI * 2 / F.swayPeriod + phase) * F.sway) * wide * amp,
    sy: 1 + Math.sin(time * Math.PI * 2 / F.breathPeriod + phase) * F.breath * amp,
  };
}
