// Drum Practice: free play with no right or wrong. Pure logic (times in
// seconds), so it runs under node --test; main.js wires it to the sound and
// the screen.
//
//  free  The player drums a rhythm `beats` beats long (2 to 12, set with LB
//        and RB; 4 by default, like a command). Each beat may hold one, two or
//        three strokes, or none. It is read at the player's own tempo
//        (transcribe), shown, and repeated by the drum crew until the player
//        drums a new one: the old loop quiets while the new rhythm is played
//        and the new one takes over when it is complete. A rhythm is complete
//        when its last beat ends, at the tempo its strokes have set.
//  call  A partner drummer plays a rhythm of the same number of beats; the
//        player answers with any rhythm of that length, and the partner comes
//        straight back on the next beat with a new call.

import { TEMPO } from './rhythm.js';
import { T } from './text_config.js';

// The length of a rhythm, in beats (a beat holds one, two or three strokes, or none).
export const BEATS = { min: 2, max: 12 };

// The kits a practice drum can be swapped for: a low voice (L, Trắc's side)
// and a high one (R). Sample ids are in assets/audio.json; `synth` says how
// the stand-in sounds when a sample is missing (audio.js).
export const KITS = [
  { id: 'bronze', name: T.practice.kits.bronze.name, vn: T.practice.kits.bronze.vn, L: 'drum-tung', R: 'drum-cac' },
  { id: 'temple', name: T.practice.kits.temple.name, vn: T.practice.kits.temple.vn, L: 'drum-chau', R: 'drum-mo' },
  { id: 'rice', name: T.practice.kits.rice.name, vn: T.practice.kits.rice.vn, L: 'kit-com-low', R: 'kit-com-high' },
  { id: 'gongs', name: T.practice.kits.gongs.name, vn: T.practice.kits.gongs.vn, L: 'kit-gong-low', R: 'kit-gong-high' },
  { id: 'bamboo', name: T.practice.kits.bamboo.name, vn: T.practice.kits.bamboo.vn, L: 'kit-bamboo-low', R: 'kit-bamboo-high' },
  { id: 'lion', name: T.practice.kits.lion.name, vn: T.practice.kits.lion.vn, L: 'kit-lan-drum', R: 'kit-lan-cymbal' },
];

// The secondary drum (Y): one voice at a time, struck alongside the bronze
// drum and part of the rhythm (drum 'S'); LB and RB choose it. face: the kit
// face drawn for it (Renderer.kitFace).
export const SECONDS = [
  { id: 'chau', name: T.practice.secondDrums.chau.name, vn: T.practice.secondDrums.chau.vn, sample: 'drum-chau', face: 'temple' },
  { id: 'mo', name: T.practice.secondDrums.mo.name, vn: T.practice.secondDrums.mo.vn, sample: 'drum-mo', face: 'temple' },
  { id: 'com', name: T.practice.secondDrums.com.name, vn: T.practice.secondDrums.com.vn, sample: 'kit-com-low', face: 'rice' },
  { id: 'gong', name: T.practice.secondDrums.gong.name, vn: T.practice.secondDrums.gong.vn, sample: 'kit-gong-low', face: 'gongs' },
  { id: 'chieng', name: T.practice.secondDrums.chieng.name, vn: T.practice.secondDrums.chieng.vn, sample: 'kit-gong-high', face: 'gongs' },
  { id: 'bamboo', name: T.practice.secondDrums.bamboo.name, vn: T.practice.secondDrums.bamboo.vn, sample: 'kit-bamboo-low', face: 'bamboo' },
  { id: 'lan', name: T.practice.secondDrums.lan.name, vn: T.practice.secondDrums.lan.vn, sample: 'kit-lan-drum', face: 'lion' },
  { id: 'choe', name: T.practice.secondDrums.choe.name, vn: T.practice.secondDrums.choe.vn, sample: 'kit-lan-cymbal', face: 'lion' },
];

// Reading free strokes as a rhythm (transcribe). The strokes are laid on a
// grid of beats at a steady tempo, the first stroke on the first beat. Each
// beat is split into one, two or three slots, and slots may stay empty, so a
// rhythm can hold rests: a silent beat ("-"), or a silent slot inside a beat
// (".R", an off-beat stroke; "R.R"). Every choice has a small cost and the
// cheapest reading wins:
//  - timing: how far each stroke sits from its slot, in beats, squared;
//  - halves cost a little, thirds a lot: strokes are read as plain beats and
//    pairs unless only triplets fit them;
//  - a silent beat or slot costs a little, so a rhythm is not read as a
//    slower one full of rests;
//  - a deep stroke (L) off the start of its beat costs a little: deep strokes
//    open beats.
// Tempo: every tempo on a fine grid, then refined. A tempo already in the air
// (a loop playing, the partner's call) can be preferred (prior), or required
// to within a range (uMin, uMax): an answer is drummed at about its call's
// speed.
const COST = { half: 0.006, third: 0.04, emptySlot: 0.012, restBeat: 0.02, deepOff: 0.012, prior: 0.2 };
// Rests are read only when the rhythm being copied has them (rests: true);
// otherwise they cost this much more, so uneven strokes read as the plain
// beats and pairs they almost certainly were.
const NO_RESTS = 10;
const U_MIN = TEMPO.min * 0.9;
const U_MAX = TEMPO.max * 1.05;

/** The best reading of the strokes at tempo u: each beat's division and slots, and the cost. */
function readAt(strokes, u, open, rests = true, target = 0) {
  const k = rests ? 1 : NO_RESTS;
  const t0 = strokes[0].t;
  const beats = new Map(); // beat -> [{ x, i }]
  strokes.forEach((s, i) => {
    const x = (s.t - t0) / u;
    // A stroke a little early for a beat (up to a sixth) belongs to that beat.
    const b = Math.floor(x + 1 / 6);
    if (!beats.has(b)) beats.set(b, []);
    beats.get(b).push({ x: x - b, i });
  });
  const last = Math.max(...beats.keys());
  let cost = 0;
  const cells = new Map(); // beat -> { d, slots: [k per stroke], idx: [stroke index] }
  for (const [b, list] of beats) {
    const lastBeat = b === last;
    let best = null;
    for (const d of [1, 2, 3]) {
      if (list.length > d) continue;
      const slots = list.map((q) => Math.min(d - 1, Math.max(0, Math.round(q.x * d))));
      if (new Set(slots).size !== slots.length) continue;
      let c = d === 2 ? COST.half : d === 3 ? COST.third : 0;
      list.forEach((q, n) => {
        const e = q.x - slots[n] / d;
        c += e * e;
        if (slots[n] > 0 && strokes[q.i].drum === 'L') c += COST.deepOff;
      });
      // Empty slots: none charged after the last stroke of a rhythm still being drummed.
      const top = open && lastBeat ? Math.max(...slots) + 1 : d;
      c += (top - list.length) * COST.emptySlot * k;
      if (!best || c < best.c) best = { c, d, slots, idx: list.map((q) => q.i) };
    }
    if (!best) return null;
    cost += best.c;
    cells.set(b, best);
  }
  cost += (last + 1 - beats.size) * COST.restBeat * k;
  // A finished rhythm shorter than the beats set ends in silent beats: rests too.
  if (target && !open) cost += Math.max(0, target - last - 1) * COST.restBeat * k;
  return { cost, cells, last };
}

/**
 * Read free strokes ([{ drum, t }], in order) as a rhythm at a steady tempo
 * (see above). Options: open (still being drummed), prior (a tempo to prefer),
 * uMin and uMax (the tempos allowed). Returns { u, beats, strokes: [{ drum,
 * pos, div }], text, cost }, pos in beats from the first stroke; text is
 * "L RR .R -": beats apart, "." a silent slot, "-" a silent beat.
 */
export function transcribe(strokes, { open = false, prior = null, uMin = U_MIN, uMax = U_MAX, rests = false, beats = 0 } = {}) {
  const n = strokes.length;
  if (!n) return null;
  if (n === 1) return finish(strokes, { cells: new Map([[0, { d: 1, slots: [0], idx: [0] }]]), last: 0 }, 0.6, 0);
  const score = (u) => {
    const r = readAt(strokes, u, open, rests, beats);
    if (!r) return null;
    r.cost += prior ? COST.prior * Math.log2(u / prior) ** 2 : 0;
    r.u = u;
    return r;
  };
  let best = null;
  const lo = Math.max(U_MIN, uMin);
  const hi = Math.min(U_MAX, uMax);
  for (let u = lo; u <= hi; u *= 1.015) {
    const r = score(u);
    if (r && (!best || r.cost < best.cost)) best = r;
  }
  if (!best) return null;
  // Refine the tempo around the best.
  for (let u = best.u * 0.985; u <= best.u * 1.015; u *= 1.002) {
    const r = u >= lo && u <= hi ? score(u) : null;
    if (r && r.cost < best.cost) best = r;
  }
  return finish(strokes, best, best.u, best.cost);
}

function finish(strokes, reading, u, cost) {
  const out = [];
  const text = [];
  for (let b = 0; b <= reading.last; b++) {
    const cell = reading.cells.get(b);
    if (!cell) {
      text.push('-');
      continue;
    }
    const slots = Array(cell.d).fill('.');
    cell.idx.forEach((i, n) => {
      slots[cell.slots[n]] = strokes[i].drum;
      out.push({ drum: strokes[i].drum, pos: b + cell.slots[n] / cell.d, div: cell.d });
    });
    text.push(slots.join(''));
  }
  return { u, beats: reading.last + 1, strokes: out, text: text.join(' '), cost };
}

/** Pattern text to strokes: "-" a silent beat, "." a silent slot inside a beat. */
export function practicePattern(text) {
  const strokes = [];
  text.split(' ').forEach((beat, b) => {
    if (beat === '-') return;
    [...beat].forEach((drum, i) => {
      if (drum !== '.') strokes.push({ drum, pos: b + i / beat.length, div: beat.length });
    });
  });
  return { text, strokes, beats: text.split(' ').length };
}

/**
 * A partner's call of n strokes: beats of one, two or three, never two deep
 * strokes inside one beat. rnd() returns 0..1.
 */
export function makeCall(beats, rnd = Math.random) {
  // The partner's call is the one rhythm expected, so it may open with a pair or a triplet.
  const out = [];
  for (let b = 0; b < beats; b++) {
    const r = rnd();
    const size = r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
    let s = '';
    for (let m = 0; m < size; m++) {
      // Deep strokes open beats; the quick ones are on the rim.
      const deep = m === 0 && (b === 0 ? rnd() < 0.7 : rnd() < 0.45);
      s += deep ? 'L' : 'R';
    }
    out.push(s);
  }
  return practicePattern(out.join(' '));
}

/**
 * The practice session. Feed it strokes and the clock; it returns events for
 * main.js to sound and show:
 *  phraseStart  the player began a rhythm (quiet the loop / cut the call)
 *  loop         { loop }: a new rhythm to repeat from loop.start, every loop.period
 *  abandon      the player stopped part way; the old loop comes back up
 *  call         { call }: the partner plays call.strokes (absolute times)
 *  answered     { answer }: the player's answer, transcribed
 *  beats        the number of beats changed
 */
export class PracticeSession {
  constructor({ mode = 'free', beats = 4, rnd = Math.random } = {}) {
    this.mode = mode;
    this.beats = clampBeats(beats);
    this.rnd = rnd;
    this.phrase = []; // the player's strokes so far: { drum, t }
    this.loop = null; // free: { strokes, text, beats, u, start, period }
    this.lastU = null; // free: the tempo of the last loop, after A cleared it
    this.call = null; // call: { strokes: [{ drum, pos, t }], text, beats, u, start, end }
    this.answer = null; // call: the last answer, transcribed
    this.u = 0.6; // the partner's tempo: follows the player's
    this.nextCallAt = mode === 'call' ? 2 : Infinity;
    this.waitUntil = Infinity; // call: when an unanswered call is played again
    this.loops = 0; // rhythms completed (free) or answers given (call)
  }

  /** The rhythm drummed so far, read afresh (it may still regroup), or null. */
  get partial() {
    return this.phrase.length ? transcribe(this.phrase, { open: true, ...this.readOptions() }) : null;
  }

  /**
   * What the dots show while the rhythm is drummed: only the beats that are
   * settled, so nothing shown changes. A beat settles once strokes have
   * landed two beats past it and two readings in a row (stroke after stroke)
   * agree on it, on everything before it and on the tempo; until three strokes
   * have set a tempo nothing is shown. The rest appears when the rhythm is
   * complete. Kept on the phrase, so it starts afresh with it.
   * { beats, strokes, text } like a reading, or null.
   */
  get shown() {
    const ph = this.phrase;
    if (!ph.length) return null;
    if (!ph.settled) ph.settled = { beats: [], prev: null, n: 0 };
    const st = ph.settled;
    if (st.n !== ph.length) {
      st.n = ph.length;
      // Read with the beats set in mind: strokes so far cannot already run past them.
      const span = ph[ph.length - 1].t - ph[0].t;
      const opts = this.readOptions();
      const floor = this.beats > 1 && span > 0 ? { uMin: Math.max(opts.uMin ?? 0, span / (this.beats - 0.15)) } : {};
      const r = ph.length >= 3 ? transcribe(ph, { open: true, ...opts, ...floor }) || transcribe(ph, { open: true, ...opts }) : null;
      if (r) {
        const texts = r.text.split(' ');
        const lastBeat = Math.floor(r.strokes[r.strokes.length - 1].pos);
        const prev = st.prev;
        // Agreeing with the last reading on the tempo too (within 8%).
        const steady = prev && Math.abs(Math.log(r.u / prev.u)) < 0.08;
        // A beat settles only with strokes two beats past it: a few quick strokes
        // read as well as a pair at one tempo as a triplet at another, until more come.
        for (let b = st.beats.length; steady && b < lastBeat - 1 && b < this.beats; b++) {
          if (texts[b] !== prev.texts[b] || texts.slice(0, b).join(' ') !== st.beats.join(' ')) break;
          st.beats.push(texts[b]);
        }
        st.prev = { u: r.u, texts };
      }
    }
    return st.beats.length ? practicePattern(st.beats.join(' ')) : null;
  }

  /** The beats shown so far (shown), to keep the final reading in line with them. */
  get settledBeats() {
    return (this.phrase.settled && this.phrase.settled.beats) || [];
  }

  /**
   * The tempos the beats set allow: the first stroke opens the first beat and
   * the last falls in the last beat, so a rhythm of n beats spans a little
   * under n - 1 to n beats. This pins the tempo to the one the player drummed
   * (pairs cannot be read as beats, nor beats as pairs). Within any range the
   * options already set.
   */
  pinned(strokes, opts = {}) {
    const span = strokes[strokes.length - 1].t - strokes[0].t;
    if (span <= 0 || this.beats < 2) return opts;
    const uMin = Math.max(opts.uMin ?? 0, span / (this.beats - 0.15));
    const uMax = Math.min(opts.uMax ?? Infinity, span / Math.max(0.5, this.beats - 1.25));
    return uMin < uMax ? { ...opts, uMin, uMax } : opts;
  }

  /** The tempo already in the air: the loop's, or the partner's. */
  get prior() {
    if (this.mode === 'free') return this.loop ? this.loop.u : this.lastU;
    return this.call ? this.call.u : null;
  }

  /**
   * When the rhythm being drummed is complete: just before the beat after its
   * last, at the tempo its strokes have set (a closing pair or triplet still
   * fits in). Unknown until two strokes have set a tempo. With no rests to
   * copy, a last beat still unstruck waits a little longer (a late stroke
   * is the last beat dragged, not a rest and the start of the next rhythm).
   */
  phraseEnd() {
    if (this.phrase.length < 2) return Infinity;
    const opts = this.readOptions();
    const r = transcribe(this.phrase, { open: true, ...opts });
    if (!r) return Infinity;
    const end = this.phrase[0].t + (this.beats - 0.12) * r.u;
    if (opts.rests || r.beats >= this.beats) return end;
    // Every beat already struck (read as a finished rhythm without rests, at
    // the tempo it was drummed): complete on time. Otherwise the last beat is
    // still to come, a little late perhaps: wait almost half a beat more.
    const done = transcribe(this.phrase, { ...this.pinned(this.phrase, opts), beats: this.beats });
    if (done && done.beats === this.beats && done.cost < 0.06) return this.phrase[0].t + (this.beats - 0.12) * Math.max(r.u, done.u);
    return end + 0.45 * r.u;
  }

  stroke(drum, t) {
    // Free drumming: once a rhythm loops it stays until A clears it, and
    // strokes over it are the player drumming along, not a new rhythm.
    if (this.mode === 'free' && this.loop) return [{ type: 'playAlong', drum, t }];
    const events = [];
    // A stroke past the end of the rhythm completes it. In call mode it starts
    // the next; in free drumming the rhythm now loops and it plays along.
    if (this.phrase.length && t >= this.phraseEnd()) events.push(...this.complete(t));
    if (this.mode === 'free' && this.loop) return [...events, { type: 'playAlong', drum, t }];
    if (!this.phrase.length) {
      events.push({ type: 'phraseStart', t });
      // Answering during the call cuts it short.
      if (this.mode === 'call' && this.call && t < this.call.end) {
        events.push({ type: 'cutCall', t });
        this.call.end = t;
      }
      this.nextCallAt = Infinity;
      this.waitUntil = Infinity;
    }
    // A lone stroke long before this one was a stray: start the rhythm here.
    if (this.phrase.length === 1 && t - this.phrase[0].t > 1.6) this.phrase = [];
    this.phrase.push({ drum, t });
    return events;
  }

  /**
   * How to read the player's strokes: the tempo already in the air (the loop
   * just cleared, or the partner's) is preferred, though only among readings
   * the strokes themselves allow; with the tempo pinned by the beats set
   * (pinned) it breaks ties, as when a rhythm opens with a pair, and never
   * moves the playback off the speed drummed.
   */
  readOptions() {
    return { prior: this.prior };
  }

  /**
   * Lock the rhythm in: read what was drummed and fit it to the beats set.
   * A stroke or two before the rhythm (a stray hit, then the rhythm proper)
   * may be left out if the rest reads much better without them; strokes past
   * the last beat are left out (they start the next rhythm); beats left
   * silent at the end are rests. Too little to be a rhythm (fewer than half
   * the beats struck: a few extra hits after the last one, in enthusiasm) is
   * no rhythm: null.
   */
  lockIn() {
    const opts = this.readOptions();
    let best = null;
    const shown = this.settledBeats;
    for (let k = 0; k <= 2 && this.phrase.length - k >= 2; k++) {
      const strokes = this.phrase.slice(k);
      // At the tempo the beats set (pinned), or any tempo if that reads nothing.
      const r = transcribe(strokes, { ...this.pinned(strokes, opts), beats: this.beats }) || transcribe(strokes, { ...opts, beats: this.beats });
      if (!r) continue;
      // What the dots already show stands unless the strokes plainly say otherwise.
      const texts = r.text.split(' ');
      const differs = shown.some((b, i) => texts[i] !== b) ? 0.3 : 0;
      const score = r.cost + 0.4 * k + 0.08 * Math.max(0, r.beats - this.beats) + differs;
      if (!best || score < best.score) best = { r, k, score };
    }
    if (!best) return null;
    const { r, k } = best;
    const strokes = r.strokes.filter((s) => s.pos < this.beats);
    const filled = new Set(strokes.map((s) => Math.floor(s.pos))).size;
    if (filled < Math.max(2, Math.ceil(this.beats / 2))) return null;
    const beatsText = r.text.split(' ').slice(0, this.beats);
    while (beatsText.length < this.beats) beatsText.push('-'); // the beats left silent
    return { strokes, text: beatsText.join(' '), beats: this.beats, u: r.u, first: this.phrase[k].t };
  }

  /** The rhythm is complete: lock it in, then loop it or answer with it. */
  complete(t) {
    const rhythm = this.lockIn();
    this.phrase = [];
    if (!rhythm) return [{ type: 'abandon', t }];
    const r = rhythm;
    const first = rhythm.first;
    this.loops += 1;
    // The beat after the rhythm: where the loop or the partner comes in.
    let start = first + this.beats * r.u;
    while (start < t + 0.03) start += this.beats * r.u;
    if (this.mode === 'free') {
      this.loop = { ...rhythm, start, period: this.beats * r.u };
      return [{ type: 'loop', loop: this.loop }];
    }
    this.answer = { ...rhythm, at: t };
    this.u = Math.min(0.85, Math.max(0.42, r.u));
    return [{ type: 'answered', answer: this.answer }, ...this.startCall(start)];
  }

  /** Begin a new call at time start (call mode). */
  startCall(start, again = false) {
    const p = again && this.call ? practicePattern(this.call.text) : makeCall(this.beats, this.rnd);
    const u = this.u;
    const strokes = p.strokes.map((s) => ({ ...s, t: start + s.pos * u }));
    this.call = { strokes, text: p.text, beats: p.beats, u, start, end: start + p.beats * u };
    this.nextCallAt = Infinity;
    this.waitUntil = this.call.end + Math.max(5, 8 * u);
    return [{ type: 'call', call: this.call, again }];
  }

  update(t) {
    const events = [];
    if (this.phrase.length >= 2 && t >= this.phraseEnd()) {
      events.push(...this.complete(t));
    } else if (this.phrase.length === 1 && t - this.phrase[0].t > 2.5) {
      // One stroke and nothing more: no tempo, no rhythm. Let it go.
      this.phrase = [];
      events.push({ type: 'abandon', t });
      if (this.mode === 'call') this.nextCallAt = t + 0.6;
    }
    if (this.mode === 'call' && !this.phrase.length) {
      if (t >= this.nextCallAt) events.push(...this.startCall(t + 0.1));
      else if (t >= this.waitUntil) events.push(...this.startCall(t + 0.1, true));
    }
    return events;
  }

  /** LB and RB: fewer or more beats. The rhythm being drummed starts over. */
  setBeats(n, t) {
    const b = clampBeats(n);
    if (b === this.beats) return [];
    this.beats = b;
    this.phrase = [];
    const events = [{ type: 'beats', beats: b }];
    if (this.mode === 'call') {
      // The partner starts again with the new length.
      if (this.call && this.call.end > t) this.call.end = t;
      events.push({ type: 'cutCall', t });
      this.nextCallAt = t + 0.7;
      this.waitUntil = Infinity;
    }
    return events;
  }

  /**
   * A: clear the dots, and in free play stop the loop (the only way to: until
   * then strokes play along with it). Its tempo is kept to read the next
   * rhythm by.
   */
  clear(t) {
    this.phrase = [];
    const had = !!this.loop;
    if (this.mode === 'free') {
      if (this.loop) this.lastU = this.loop.u;
      this.loop = null;
    }
    return [{ type: 'clear', t, stopped: had }];
  }
}

function clampBeats(n) {
  return Math.max(BEATS.min, Math.min(BEATS.max, Math.round(n)));
}

/** Where a loop is at time t: its round and the strokes heard so far in that round. */
export function loopPosition(loop, t) {
  if (!loop || t < loop.start) return null;
  const local = t - loop.start;
  const round = Math.floor(local / loop.period);
  const pos = (local - round * loop.period) / loop.u;
  const played = loop.strokes.filter((s) => s.pos <= pos + 1e-6).length;
  return { round, pos, played };
}

/**
 * The partner's answer to the player's call: the same number of beats, riffing
 * on it. The first beat stays; one or two later beats change how they are
 * divided (a stroke becomes a pair, a pair a triplet or a stroke, a triplet a
 * pair), and deep strokes stay at the start of a beat.
 */
export function riffOn(text, rnd = Math.random) {
  const beats = text.split(' ');
  const idx = beats.map((_, i) => i).filter((i) => i > 0);
  const changes = Math.min(idx.length, 1 + (rnd() < 0.5 ? 1 : 0));
  for (let c = 0; c < changes; c++) {
    const i = idx.splice(Math.floor(rnd() * idx.length), 1)[0];
    const b = beats[i];
    const head = b === '-' ? (rnd() < 0.5 ? 'L' : 'R') : b[0];
    const n = b === '-' ? 1 : b.length;
    const to = n === 1 ? 2 : n === 3 ? 2 : rnd() < 0.5 ? 3 : 1;
    beats[i] = head + 'R'.repeat(to - 1);
  }
  return practicePattern(beats.join(' '));
}

/**
 * Call and answer, both ways. The partner calls and the player answers; the
 * exchange is then played back (the call, then the answer). If the answer came
 * in on time (on the beat after the call) everything keeps the same beat and
 * it is the player's turn to lead: the player drums a call, the partner
 * answers with a riff on it, and the player may lead again at once. If the
 * answer came late, or the player waits instead of leading, the partner takes
 * the initiative with a new call. Events, besides PracticeSession's:
 *  answered   { answer, inTime }
 *  replay     { replay: { start, u, end, parts: [{ who, strokes: [{ drum, pos, t }] }] } }
 *  yourTurn   { at }: the player may lead
 *  led        { lead }: the player's call, read
 *  riff       { riff }: the partner's answer to it (strokes with times)
 *  takeover   the partner takes the initiative (a call follows)
 */
/**
 * Call and answer. One side calls a rhythm of the set number of beats and the
 * other answers it; the two are then played as one exchange, call and answer,
 * round after round, until A clears it. The turn to call alternates: it begins
 * with the partner, and each clear hands it to the other side.
 *   - The partner calls (repeating the call until it is answered); the player
 *     answers with any rhythm of the same length, read at the call's speed.
 *   - The player calls; the partner answers with a riff on it (riffOn) from
 *     the next beat.
 * While an exchange plays, strokes are the player drumming along: heard, but
 * not read as a rhythm. The exchange is kept as a loop (this.loop: strokes
 * across both halves, each marked with who plays it), drummed by the same
 * code as free drumming's.
 */
export class CallSession extends PracticeSession {
  constructor(opts = {}) {
    super({ ...opts, mode: 'call' });
    this.starter = 'partner'; // who calls next: 'partner' | 'you'
    this.phase = 'wait'; // 'wait' (for the partner's call) | 'call' | 'answer' | 'lead' | 'loop'
    this.exchange = null; // { first, call, answer }: the rhythms of the loop, each { who, text, strokes }
  }

  /** The tempo in the air: the call's while answering, else the last exchange's. */
  get prior() {
    if (this.phase === 'answer' && this.call) return this.call.u;
    return this.loop ? this.loop.u : this.lastU;
  }

  startCall(start, again = false) {
    const ev = super.startCall(start, again);
    this.phase = 'call';
    return ev;
  }

  stroke(drum, t) {
    // Over the exchange, or before the partner's first call: drumming along.
    if (this.phase === 'loop' || this.phase === 'wait') return [{ type: 'playAlong', drum, t }];
    const events = [];
    if (this.phase === 'call') {
      // Answering during the call cuts it short.
      if (t < this.call.end - 0.45 * this.call.u) {
        events.push({ type: 'cutCall', t });
        this.call.end = t;
      }
      this.phase = 'answer';
    }
    if (this.phrase.length && t >= this.phraseEnd()) events.push(...this.complete(t));
    if (this.phase === 'loop') return [...events, { type: 'playAlong', drum, t }];
    if (!this.phrase.length) {
      events.push({ type: 'phraseStart', t });
      this.waitUntil = Infinity;
    }
    // A lone stroke long before this one was a stray: start the rhythm here.
    if (this.phrase.length === 1 && t - this.phrase[0].t > 1.6) this.phrase = [];
    this.phrase.push({ drum, t });
    return events;
  }

  /**
   * An answer is drummed at about its call's speed: read it within 35% of
   * it, with rests only if the call has them.
   */
  readOptions() {
    if (this.phase === 'answer' && this.call) return { prior: this.call.u, uMin: this.call.u / 1.35, uMax: this.call.u * 1.35, rests: /[-.]/.test(this.call.text) };
    return { prior: this.prior };
  }

  /** The player's rhythm is complete: it answers the partner's call, or is the call the partner answers. */
  complete(t) {
    const rhythm = this.lockIn();
    this.phrase = [];
    if (!rhythm) {
      if (this.phase === 'answer' && this.call) this.waitUntil = t + 0.6 + 4 * this.call.u;
      return [{ type: 'abandon', t }];
    }
    this.loops += 1;
    const n = this.beats;
    const mark = (strokes, who, offset) => strokes.map((s) => ({ drum: s.drum, pos: s.pos + offset, who }));
    let first;
    let second;
    let origin;
    let u;
    const events = [];
    if (this.phase === 'lead') {
      // The player called: the partner riffs on it from the next beat, at the player's tempo.
      u = rhythm.u;
      origin = rhythm.first;
      const riff = riffOn(rhythm.text, this.rnd);
      first = { who: 'you', text: rhythm.text, strokes: mark(rhythm.strokes, 'you', 0) };
      second = { who: 'partner', text: riff.text, strokes: mark(riff.strokes, 'partner', n) };
      events.push({ type: 'led', lead: rhythm }, { type: 'riff', riff: { text: riff.text, start: origin + n * u, u } });
    } else {
      // The player answered the partner's call. The answer sets the beat: the
      // call is heard again a round before it, so the exchange runs on.
      u = this.call.u;
      origin = rhythm.first - n * u;
      first = { who: 'partner', text: this.call.text, strokes: mark(this.call.strokes, 'partner', 0) };
      second = { who: 'you', text: rhythm.text, strokes: mark(rhythm.strokes, 'you', n) };
      this.answer = { ...rhythm, at: t };
      events.push({ type: 'answered', answer: this.answer });
    }
    this.exchange = { first, second };
    this.loop = { strokes: [...first.strokes, ...second.strokes], text: `${first.text} | ${second.text}`, beats: 2 * n, u, start: origin, period: 2 * n * u };
    this.u = Math.min(0.85, Math.max(0.42, u));
    this.phase = 'loop';
    this.nextCallAt = Infinity;
    this.waitUntil = Infinity;
    events.push({ type: 'exchange', loop: this.loop, exchange: this.exchange });
    return events;
  }

  update(t) {
    const events = [];
    if (this.phrase.length >= 2 && t >= this.phraseEnd()) events.push(...this.complete(t));
    else if (this.phrase.length === 1 && t - this.phrase[0].t > 2.5) {
      this.phrase = [];
      events.push({ type: 'abandon', t });
      if (this.phase === 'answer' && this.call) this.waitUntil = t + 0.6;
    }
    if (this.phrase.length) return events;
    if (this.phase === 'wait' && t >= this.nextCallAt) events.push(...this.startCall(t + 0.1));
    if (this.phase === 'call' && t >= this.call.end) {
      this.phase = 'answer';
      this.waitUntil = this.call.end + Math.max(5, 8 * this.call.u);
    }
    // An unanswered call is played again, until it is answered or cleared.
    if (this.phase === 'answer' && t >= this.waitUntil) events.push(...this.startCall(t + 0.1, true));
    return events;
  }

  /** Back to the start of the turn: the partner about to call, or waiting for the player's call. */
  restartTurn(t) {
    this.phrase = [];
    if (this.loop) this.lastU = this.loop.u;
    this.loop = null;
    this.exchange = null;
    this.answer = null;
    this.waitUntil = Infinity;
    const events = [];
    if (this.call && this.call.end > t) {
      this.call.end = t;
      events.push({ type: 'cutCall', t });
    }
    if (this.starter === 'partner') {
      this.phase = 'wait';
      this.nextCallAt = t + 0.8;
    } else {
      this.phase = 'lead';
      this.nextCallAt = Infinity;
    }
    return events;
  }

  setBeats(n, t) {
    const b = clampBeats(n);
    if (b === this.beats) return [];
    this.beats = b;
    return [{ type: 'beats', beats: b }, ...this.restartTurn(t)];
  }

  /** A: stop the exchange (or the turn under way) and hand the call to the other side. */
  clear(t) {
    const stopped = !!this.loop;
    this.starter = this.starter === 'partner' ? 'you' : 'partner';
    return [{ type: 'clear', t, stopped }, ...this.restartTurn(t), { type: 'turn', starter: this.starter }];
  }
}
