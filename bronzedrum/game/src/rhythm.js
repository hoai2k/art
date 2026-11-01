// Drum reading: turns timed strokes on the two drums into commands.
//
// Trưng Trắc plays the deep centre of the drum ("tùng", L); Trưng Nhị plays
// the rim ("cắc", R). A command is a four-beat pattern. There is no fixed
// metronome: the player sets the tempo, and what is judged is how *even* the
// strokes are — every gap has to match the pattern's rhythm at the player's
// own speed. A beat can hold one stroke, a pair (two strokes) or a triplet
// (three); each command has three tiers, and the more intricate tiers are
// stronger.
//
// When a command is accepted the army answers for four beats at the player's
// tempo (the action cycle). Strokes during the answer are ignored: they do
// not start a phrase. When the answer ends the drum is ready again, and starting the next phrase within two
// beats keeps the chain; four in a row wakes the drum.
//
// Everything here is pure (times in seconds), so it runs under node --test.

import { T } from './text_config.js';

export const TUNG = 'L';
export const CAC = 'R';

/** Evenness windows, as |log2(actual gap / expected gap)|. */
export const WINDOWS = {
  perfect: 0.2, // about ±15%
  good: 0.45, // about ±37%
};
/** Seconds per beat the player may drum at: about 200 down to 45 BPM. */
export const TEMPO = { min: 0.3, max: 1.33 };
export const SPIRIT_COMBO = 4;
// Each tier is 1.4× the one below, and precision (see PRECISION) spans just
// under that ratio: the sloppiest playing of a tier still edges out a perfect
// playing of the tier below, and everything between is down to evenness.
export const TIER_POWER = [1, 1.4, 1.96];
export const PRECISION = { min: 0.72, max: 1 };
const EARLY_GRACE = 0.25; // beats before "ready" that already start a phrase
const CHAIN_WINDOW = 2; // beats after "ready" to keep the chain

// Beats are separated by spaces; strokes in one beat share it evenly. The deep
// centre stroke (L) needs room to ring, so two of them are always at least a
// beat apart: quick pairs and triplets are played on the rim (R), at most
// opening with a single deep stroke. The first stroke says what kind of order
// it is: movement starts on the deep centre (L), attacks on the rim (R).
// Every command opens with a single stroke on its first beat: the first two
// beats set the tempo, and only then can the reader tell a pair or a triplet
// from plain beats, and so tell the commands apart. Where only one rhythm is
// expected (a call to answer, the casting rhythm) it may open with a pair or
// a triplet: the reader knows what is coming.
// There are two families: march and strike. With the war elephant (chapter
// 3), a strike played while the drum is awake becomes the elephant charge.
//
// Difficulty (Settings) sets the rhythms. Easy never reaches triplets: plain
// beats, then pairs for the stronger tiers. Medium is the game as designed.
// Hard adds rests: a silent beat, and silences inside pairs and triplets.
// In pattern text "." is a silent slot: "R.R" is a triplet whose middle
// stroke is silent, ".R" an off-beat stroke, "." alone a silent beat.
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TIERS = {
  march: {
    easy: ['L L L R', 'L L LR R', 'L RR L RR'],
    medium: ['L L L R', 'L L LR R', 'L RRR L R'],
    hard: ['L L . R', 'L L .R R', 'L R.R L R'],
  },
  strike: {
    easy: ['R R L R', 'R RR L R', 'R RR RR L'],
    medium: ['R R L R', 'R RR L R', 'R RRR L R'],
    hard: ['R . L R', 'R .R L R', 'R R.R L R'],
  },
};
let difficulty = 'medium';

/** A command's three tiers as designed (Medium, four beats), for Training's catalogue. */
export function designedTiers(id) {
  return TIERS[id] ? TIERS[id].medium.slice() : [];
}
// Number of beats (Settings): how long commands and calls are. Four by
// default; fitBeats stretches or shrinks every rhythm to it.
export const BEAT_RANGE = { min: 3, max: 8 }; // two beats cannot hold three distinct tiers on Easy
let beatCount = 4;

/** Set how many beats commands and calls last. */
export function setBeatCount(n) {
  beatCount = Math.max(BEAT_RANGE.min, Math.min(BEAT_RANGE.max, Math.round(n) || 4));
}

export function getBeatCount() {
  return beatCount;
}

/**
 * A rhythm fitted to n beats. The first and last beats stay. Shorter: the
 * middle keeps its most intricate beats (pairs and triplets, then the later
 * ones), which are what tell the tiers apart; with two beats, the first and
 * the most intricate one. Longer: the middle beats repeat in order.
 */
export function fitBeats(text, n = beatCount) {
  const beats = text.split(' ');
  if (beats.length === n) return text;
  const first = beats[0];
  const last = beats[beats.length - 1];
  const middle = beats.slice(1, -1);
  const weight = (b) => (b === '.' ? 0 : b.length);
  if (n === 1) return first;
  if (n === 2) {
    const all = beats.slice(1).map((b, i) => [b, i]);
    all.sort((a, b) => weight(b[0]) - weight(a[0]) || b[1] - a[1]);
    return `${first} ${all[0][0]}`;
  }
  let mid;
  if (n - 2 <= middle.length) {
    const keep = middle.map((b, i) => [b, i]).sort((a, b) => weight(b[0]) - weight(a[0]) || b[1] - a[1]).slice(0, n - 2).map((x) => x[1]);
    mid = middle.filter((_, i) => keep.includes(i));
  } else {
    mid = Array.from({ length: n - 2 }, (_, i) => middle[i % middle.length]);
  }
  return [first, ...mid, last].join(' ');
}

/** How many beats a rhythm text spans. */
export function beatsOf(text) {
  return text.split(' ').length;
}

/** Choose the rhythms for a difficulty ('easy', 'medium' or 'hard'). */
export function setDifficulty(d) {
  difficulty = DIFFICULTIES.includes(d) ? d : 'medium';
}

export function getDifficulty() {
  return difficulty;
}

export const COMMANDS = [
  { id: 'march', name: T.commands.march.name, gloss: T.commands.march.meaning, kind: 'move', get tiers() { return TIERS.march[difficulty].map((t) => fitBeats(t)); } },
  { id: 'strike', name: T.commands.strike.name, gloss: T.commands.strike.meaning, kind: 'attack', get tiers() { return TIERS.strike[difficulty].map((t) => fitBeats(t)); } },
];

/**
 * A call or a casting rhythm at a difficulty. Easy plays triplets as pairs.
 * Hard silences the middle of each triplet after the first beat, turns every
 * other pair after it into an off-beat stroke, and if nothing else changed,
 * silences the third beat of a long enough rhythm. The first beat and the
 * last stroke are never touched, so the rhythm still starts and ends clearly.
 */
export function rhythmFor(text, d = difficulty) {
  const beats = text.split(' ');
  if (d === 'easy') return beats.map((b) => (b.length === 3 ? b.slice(0, 2) : b)).join(' ');
  if (d !== 'hard') return text;
  let changed = false;
  let pairs = 0;
  const out = beats.map((b, i) => {
    if (i === 0) return b;
    if (b.length === 3) {
      changed = true;
      return `${b[0]}.${b[2]}`;
    }
    if (b.length === 2 && i < beats.length - 1) {
      pairs += 1;
      if (pairs % 2 === 1) {
        changed = true;
        return `.${b[1]}`;
      }
    }
    return b;
  });
  if (!changed && out.length >= 4) out[2] = '.';
  return out.join(' ');
}

/**
 * Expand "L RR R.R . L" into strokes with positions in beats. Strokes in one
 * beat share it evenly, silent slots (".") included; `div` is how many slots
 * the beat has, so a picture of the rhythm can leave the silent ones empty.
 */
export function parsePattern(text) {
  const strokes = [];
  text.split(' ').forEach((beat, b) => {
    [...beat].forEach((drum, i) => {
      if (drum !== '.') strokes.push({ drum, pos: b + i / beat.length, div: beat.length });
    });
  });
  return strokes;
}

/** Every playable pattern: one per command and tier. */
export function allPatterns(unlocked = COMMANDS.map((c) => c.id), maxTier = 3) {
  const out = [];
  for (const c of COMMANDS) {
    if (!unlocked.includes(c.id)) continue;
    c.tiers.slice(0, maxTier).forEach((text, i) => {
      const strokes = parsePattern(text);
      out.push({ command: c.id, tier: i + 1, text, strokes, drums: strokes.map((s) => s.drum).join('') });
    });
  }
  return out;
}

export function commandById(id) {
  return COMMANDS.find((c) => c.id === id);
}

/** Error of one gap: |log2(actual / expected)|. */
function gapError(actual, expected) {
  return Math.abs(Math.log2(Math.max(1e-6, actual) / expected));
}

/** How much a pair's or triplet's own spacing counts towards precision. */
const SUB_WEIGHT = 0.3;

/**
 * How well the strokes so far fit the start of a pattern, at whatever tempo
 * they imply. Returns null when they cannot be this pattern.
 *
 * What must be even is the beat: the first stroke of each beat (its onset).
 * The tempo comes from the onsets, and every gap between onsets is judged
 * against it. The quick strokes of a pair or triplet only have to fall inside
 * their own beat, in order: people play them as a flurry and land the next
 * beat on time, so their spacing nudges precision but never breaks a phrase.
 */
export function fit(pattern, strokes, windows = WINDOWS) {
  const k = strokes.length;
  if (k > pattern.strokes.length) return null;
  for (let i = 0; i < k; i++) if (strokes[i].drum !== pattern.strokes[i].drum) return null;
  const p = pattern.strokes;
  const onsets = [];
  for (let i = 0; i < k; i++) if (Number.isInteger(p[i].pos)) onsets.push(i);
  const first = onsets[0];
  const last = onsets[onsets.length - 1];
  let u = null;
  if (onsets.length >= 2) {
    u = (strokes[last].t - strokes[first].t) / (p[last].pos - p[first].pos);
    if (u < TEMPO.min * 0.85 || u > TEMPO.max * 1.15) return null;
  }
  let maxErr = 0;
  let sum = 0;
  let n = 0;
  for (let j = 1; j < onsets.length; j++) {
    const a = onsets[j - 1];
    const b = onsets[j];
    const e = gapError(strokes[b].t - strokes[a].t, u * (p[b].pos - p[a].pos));
    maxErr = Math.max(maxErr, e);
    sum += e;
    n += 1;
  }
  if (maxErr > windows.good) return null;
  // The quick strokes inside a beat, measured from the last stroke on a beat
  // before them (usually their own beat's; with rests, maybe an earlier one).
  for (let i = 0; i < k; i++) {
    if (Number.isInteger(p[i].pos)) continue;
    let on = -1;
    for (const o of onsets) if (o < i) on = o;
    if (on < 0) return null; // a rhythm always opens on a beat
    const next = onsets.find((o) => o > i);
    const since = strokes[i].t - strokes[on].t;
    const beatEnd = Math.floor(p[i].pos) + 1; // the beat after this stroke's own
    if (next !== undefined) {
      const span = strokes[next].t - strokes[on].t;
      const f = since / span;
      if (f <= 0 || f >= 1) return null;
      sum += Math.min(windows.good, SUB_WEIGHT * gapError(f, (p[i].pos - p[on].pos) / (p[next].pos - p[on].pos)));
    } else if (u !== null) {
      // Before the next beat has come, a stroke this late is that beat, not a
      // quick one; a stroke after a rest must also come after the rest.
      const f = since / u;
      const lo = Math.floor(p[i].pos) - p[on].pos;
      if (f <= lo * 0.85 || f > (beatEnd - p[on].pos) - 0.15) return null;
      sum += Math.min(windows.good, SUB_WEIGHT * gapError(f, p[i].pos - p[on].pos));
    } else {
      // No tempo yet (still inside the first beat): just keep it plausible.
      if (since <= 0 || since > TEMPO.max * 1.15 * (beatEnd - p[on].pos)) return null;
      continue;
    }
    n += 1;
  }
  return { u, maxErr, meanErr: n ? sum / n : 0, complete: k === p.length };
}

/** Accuracy from 1 (every gap even) down to 0 (every gap at the edge of the window). */
export function accuracyOf(meanErr, windows = WINDOWS) {
  if (meanErr <= windows.perfect) return 1;
  return Math.max(0, 1 - (meanErr - windows.perfect) / (windows.good - windows.perfect));
}

/** The power multiplier precision gives: ×0.72 at the edge, ×1 when even. */
export function precisionFactor(accuracy) {
  return PRECISION.min + (PRECISION.max - PRECISION.min) * accuracy;
}

export class DrumReader {
  constructor({ unlocked = COMMANDS.map((c) => c.id), maxTier = 3, windows = WINDOWS } = {}) {
    this.windows = windows;
    this.patterns = allPatterns(unlocked, maxTier);
    this.phrase = []; // { drum, t }
    this.pending = null; // a complete match waiting to see whether a longer pattern follows
    this.action = null; // { command, tier, pattern, u, start, ready }
    this.shown = null; // the accepted pattern, kept on screen until ready
    this.combo = 0;
    this.chainUntil = null; // the next phrase must start before this to chain
    this.chainArmed = false;
  }

  get spirit() {
    return this.combo >= SPIRIT_COMBO;
  }

  /** The drum is busy with the army's answer at time t. */
  busy(t) {
    return !!this.action && t < this.action.ready - EARLY_GRACE * this.action.u;
  }

  /** Candidate patterns that the current phrase still fits. */
  candidates() {
    const out = [];
    for (const p of this.patterns) {
      const f = fit(p, this.phrase, this.windows);
      if (f) out.push({ pattern: p, ...f });
    }
    return out;
  }

  /** Latest time the next stroke may come for any open candidate. */
  deadline(cands = this.candidates()) {
    let latest = -Infinity;
    for (const c of cands) {
      if (c.complete) continue;
      // Measured from the latest beat onset, not from a quick stroke inside
      // a beat: a triplet played as a flurry leaves time to land the next beat.
      const p = c.pattern.strokes;
      const k = this.phrase.length;
      let on = k - 1;
      while (on > 0 && !Number.isInteger(p[on].pos)) on -= 1;
      const u = c.u ?? TEMPO.max;
      latest = Math.max(latest, this.phrase[on].t + u * (p[k].pos - p[on].pos) * 2 ** this.windows.good);
    }
    return latest;
  }

  hit(drum, t) {
    const events = [];
    if (this.busy(t)) {
      // The army is answering: the stroke is ignored.
      events.push({ type: 'early', drum, t });
      return events;
    }

    if (!this.phrase.length) {
      // A new phrase. Starting soon after "ready" keeps the chain.
      this.chainArmed = this.chainUntil !== null && t <= this.chainUntil;
      this.shown = null;
      events.push({ type: 'phraseStart', t, chained: this.chainArmed });
    }
    this.phrase.push({ drum, t });
    events.push({ type: 'stroke', drum, t, index: this.phrase.length - 1 });

    let cands = this.candidates();
    if (!cands.length) {
      // This stroke does not continue the phrase; maybe it starts a new one.
      const dropped = this.phrase.length - 1;
      this.phrase = [{ drum, t }];
      this.pending = null;
      cands = this.candidates();
      if (dropped > 0) events.push({ type: 'reset', strokes: dropped, reason: 'uneven' });
      if (!cands.length) {
        this.phrase = [];
        events.push({ type: 'reset', strokes: 1, reason: 'no-pattern' });
        return events;
      }
    }
    const complete = cands.filter((c) => c.complete).sort((a, b) => a.meanErr - b.meanErr);
    const open = cands.filter((c) => !c.complete);
    if (complete.length && !open.length) events.push(...this.accept(complete[0], t));
    else this.pending = complete[0] || null;
    return events;
  }

  /** Advance the clock: accept a pending match, fade an abandoned phrase, end answers. */
  update(t) {
    const events = [];
    if (this.phrase.length && t > this.deadline()) {
      if (this.pending) events.push(...this.accept(this.pending, t));
      else {
        events.push({ type: 'reset', strokes: this.phrase.length, reason: 'timeout' });
        this.phrase = [];
      }
    }
    if (this.action && t >= this.action.ready) {
      events.push({ type: 'ready', t: this.action.ready, command: this.action.command });
      this.chainUntil = this.action.ready + CHAIN_WINDOW * this.action.u;
      this.shown = null;
      this.action = null;
    }
    if (this.combo > 0 && !this.action && !this.phrase.length && this.chainUntil !== null && t > this.chainUntil) {
      events.push({ type: 'comboLost', combo: this.combo });
      this.combo = 0;
      this.chainUntil = null;
    }
    return events;
  }

  accept(c, now) {
    const p = c.pattern;
    const t0 = this.phrase[0].t;
    const u = c.u;
    const accuracy = accuracyOf(c.meanErr, this.windows);
    this.combo = this.chainArmed ? this.combo + 1 : 1;
    this.chainUntil = null;
    // The answer starts on the beat after the pattern's last (its fourth,
    // unless Number of beats says otherwise); the army answers for four beats.
    const start = Math.max(t0 + beatsOf(p.text || '. . . .') * u, now + 0.05);
    this.action = { command: p.command, tier: p.tier, pattern: p, u, start, ready: start + 4 * u };
    this.shown = { pattern: p, strokes: this.phrase.slice(), accuracy };
    this.phrase = [];
    this.pending = null;
    return [
      {
        type: 'command',
        command: p.command,
        tier: p.tier,
        pattern: p,
        u,
        accuracy,
        even: c.maxErr <= this.windows.perfect,
        start,
        ready: start + 4 * u,
        combo: this.combo,
        spirit: this.spirit,
      },
    ];
  }

  /** Drop the phrase being played (the player's reset button). */
  reset() {
    if (!this.phrase.length) return [];
    const strokes = this.phrase.length;
    this.phrase = [];
    this.pending = null;
    return [{ type: 'reset', strokes, reason: 'manual' }];
  }

  /** Strokes so far placed on the most likely pattern (for the HUD). */
  progress() {
    if (!this.phrase.length) return null;
    const cands = this.candidates().sort((a, b) => a.meanErr - b.meanErr || a.pattern.strokes.length - b.pattern.strokes.length);
    return cands[0] || null;
  }
}
