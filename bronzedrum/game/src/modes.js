// Chapter modes besides battle. Pure logic (times in seconds), so it runs
// under node --test; main.js wires it to the reader, the sound and the screen.
//
//  echo     A caller drums a rhythm and the player answers it. Each answer
//           must be even; if matchTempo is set it must also be near the
//           caller's speed. Used by The Oath, The Villages Answer, The
//           Coronation and The Drums Are Melted.
//  casting  The player drums one rhythm continuously at the furnace's pace
//           (a guide plays it); the bronze rises along one line with drums as
//           checkpoints on it. Casting the Drums (CastingSession).
//  battle   (battle.js) — with `survive`, hold out while waves arrive.

import { parsePattern } from './rhythm.js';

/** A pattern object the reader understands, from "L RR L R" text. */
export function callPattern(text, command = 'call') {
  const strokes = parsePattern(text);
  return { command, tier: 1, text, strokes, drums: strokes.map((s) => s.drum).join('') };
}

export class EchoSession {
  /**
   * calls: [{ text, bpm, label? }]. matchTempo: answers must be within
   * `tolerance` of the call's beat length. The next call comes a beat and a
   * half (of the call just answered) plus `pause` seconds after the answer:
   * long enough to see the answer land, short enough to keep the exchange
   * going.
   */
  constructor({ calls, matchTempo = false, tolerance = 0.3, pause = 0.4 }) {
    this.calls = calls;
    this.matchTempo = matchTempo;
    this.tolerance = tolerance;
    this.pause = pause;
    this.index = 0;
    this.phase = 'waiting'; // 'calling' | 'answer' | 'waiting' | 'done'
    this.nextCallAt = 0;
    this.call = null; // { text, u, start, end, pattern, strokes: [{ drum, t }] }
    this.answered = []; // { accuracy, u }
    this.misses = 0;
  }

  get done() {
    return this.phase === 'done';
  }

  /** The rhythm the player must answer now, for the reader. */
  get pattern() {
    return this.call ? this.call.pattern : null;
  }

  /** Advance the clock: start calls, open the answer, repeat an unanswered call. */
  update(t) {
    const events = [];
    if (this.phase === 'waiting' && t >= this.nextCallAt && this.index < this.calls.length) {
      const c = this.calls[this.index];
      const u = 60 / c.bpm;
      const pattern = callPattern(c.text);
      const strokes = pattern.strokes.map((s) => ({ drum: s.drum, t: t + s.pos * u }));
      this.call = { ...c, u, start: t, end: t + c.text.split(' ').length * u, pattern, strokes };
      this.phase = 'calling';
      events.push({ type: 'call', call: this.call, index: this.index });
    }
    if (this.phase === 'calling' && t >= this.call.end) {
      this.phase = 'answer';
      this.answerBy = t + Math.max(6, 10 * this.call.u);
      events.push({ type: 'yourTurn', call: this.call });
    }
    if (this.phase === 'answer' && t > this.answerBy) {
      // No answer: the caller plays it again.
      this.phase = 'waiting';
      this.nextCallAt = t + 0.3;
      events.push({ type: 'repeat', call: this.call });
    }
    return events;
  }

  /**
   * The reader accepted the player's rhythm (it can only be this call's
   * pattern). The player may answer as soon as they know the rhythm, during
   * the call as well as after it; an early answer cuts the call short
   * (`early` on the event).
   */
  answer(ev, t) {
    if (this.phase !== 'answer' && this.phase !== 'calling') return [];
    const early = this.phase === 'calling';
    const ratio = ev.u / this.call.u;
    if (this.matchTempo && Math.abs(Math.log(ratio)) > Math.log(1 + this.tolerance)) {
      this.misses += 1;
      return [{ type: 'offTempo', faster: ratio < 1, call: this.call }];
    }
    this.answered.push({ accuracy: ev.accuracy, u: ev.u });
    this.index += 1;
    const events = [{ type: 'answered', index: this.index - 1, accuracy: ev.accuracy, call: this.call, early }];
    if (this.index >= this.calls.length) {
      this.phase = 'done';
      events.push({ type: 'complete', evenness: this.evenness() });
    } else {
      this.phase = 'waiting';
      this.nextCallAt = t + 1.5 * this.call.u + this.pause;
    }
    return events;
  }

  /** Average evenness of the answers, 0..1. */
  evenness() {
    if (!this.answered.length) return 0;
    return this.answered.reduce((s, a) => s + a.accuracy, 0) / this.answered.length;
  }
}

/**
 * Casting the Drums: a continuous pour. The player drums the hammer rhythm
 * round after round with the bellows (a guide plays it at the pace to hold,
 * u seconds per beat). Every stroke that keeps the phrase going at that pace
 * pours a little bronze, and each whole phrase in time a little more; the
 * level climbs one line towards 1. The drums are thresholds on the line (at
 * 1/3, 2/3 and 1 for three): passing one casts that drum and makes it a
 * checkpoint. Each drum takes the pattern played about two and a half
 * times. Stopping lets the bronze sink slowly back towards the last
 * checkpoint; a broken phrase, or one that rushes or drags, sets it back a
 * little (`setback`), never below the checkpoint. Times in seconds.
 */
export class CastingSession {
  constructor({ drums = 3, u = 0.79, tolerance = 0.14, perStroke = 0.018, perPhrase = 0.025, setback = 0.06, sink = 0.05, idleBeats = 1.6 } = {}) {
    this.setback = setback;
    this.drums = drums;
    this.u = u;
    this.tolerance = tolerance;
    this.perStroke = perStroke;
    this.perPhrase = perPhrase;
    this.sink = sink;
    this.idleBeats = idleBeats;
    this.level = 0; // 0..1 along the line
    this.checkpoint = 0;
    this.cast = 0; // drums finished
    this.cracks = 0;
    this.lastStroke = null;
    this.phrases = 0;
    this.accuracy = 0; // summed accuracy of the phrases in time
  }

  get done() {
    return this.cast >= this.drums;
  }

  /** The next threshold on the line. */
  get next() {
    return (this.cast + 1) / this.drums;
  }

  /** Too far from the pace? Returns 'fast', 'slow' or null. */
  drift(u) {
    if (!u) return null;
    if (Math.abs(Math.log(u / this.u)) <= Math.log(1 + this.tolerance)) return null;
    return u < this.u ? 'fast' : 'slow';
  }

  /** A stroke that continues the phrase; u is the phrase's tempo so far (null at first). */
  stroke(t, u) {
    if (this.done) return [];
    const off = this.drift(u);
    if (off) return this.crack(off);
    this.lastStroke = t;
    return this.add(this.perStroke);
  }

  /** A whole phrase accepted at tempo u with this accuracy. */
  phrase(ev) {
    if (this.done) return [];
    const off = this.drift(ev.u);
    if (off) return this.crack(off);
    this.phrases += 1;
    this.accuracy += ev.accuracy;
    return this.add(this.perPhrase);
  }

  /** The phrase broke (a wrong or uneven stroke): a small setback. */
  miss() {
    if (this.done) return [];
    return this.crack(null);
  }

  /** A slip: the bronze falls back a little, never below the last drum cast. */
  crack(off) {
    const before = this.level;
    this.level = Math.max(this.checkpoint, this.level - this.setback);
    const lost = before - this.level;
    if (lost <= 0.001) return [];
    this.cracks += 1;
    return [{ type: 'crack', lost, faster: off === 'fast', slower: off === 'slow' }];
  }

  add(amount) {
    const events = [];
    this.level = Math.min(1, this.level + amount);
    while (!this.done && this.level >= this.next - 1e-9) {
      this.cast += 1;
      this.checkpoint = this.cast / this.drums;
      events.push({ type: 'cast', drum: this.cast - 1 });
      if (this.done) events.push({ type: 'complete', evenness: this.phrases ? this.accuracy / this.phrases : 1 });
    }
    return events;
  }

  /** Advance the clock: with no stroke for a while, the bronze sinks to the checkpoint. */
  update(t, dt) {
    if (this.done || this.lastStroke === null) return;
    if (t - this.lastStroke > this.idleBeats * this.u) this.level = Math.max(this.checkpoint, this.level - this.sink * dt);
  }
}

/** Waves for a hold-the-line chapter: those due by time t that have not come yet. */
export function dueWaves(waves, t, spawned) {
  const out = [];
  waves.forEach((w, i) => {
    if (!spawned.has(i) && t >= w.at) {
      spawned.add(i);
      out.push(w);
    }
  });
  return out;
}
