// Training (Drum Practice): every rhythm the chapters ask the player to drum,
// numbered and sorted into levels of difficulty, to practise one at a time and
// to tune which chapters use which rhythms. Pure, so it runs under node --test.
//
// The catalogue is the rhythms as designed (Medium, four beats): the battle
// commands' tiers up to each chapter's highest, the answering chapters' calls
// and the casting rhythm. A rhythm used in several places is one entry, listed
// with every use. Entries are numbered in the order the game first asks for
// them, chapter by chapter, so a number names the same rhythm whatever the
// Difficulty and Number of beats settings (which reshape the rhythms in play).

import { STAGES } from './stages.js';
import { T, txt } from './text_config.js';
import { COMMANDS, designedTiers } from './rhythm.js';

// Nine levels. A "group" is a pair or a triplet (a beat split in two or
// three); a group is mixed when it switches drums inside (LR, LRR: the deep
// stroke can only open one). A switch beside a group is a change of drum
// between the group and the stroke just before it or just after it.
export const LEVELS = T.training.levels;

/**
 * Levels set by hand, rhythm number -> level (1 to 9), over the one worked out
 * from the rhythm's shape (levelOf). Tuning notes go here.
 */
export const LEVEL_OVERRIDES = {};

/**
 * Rhythms for Training alone (no chapter uses them), so every level has
 * something to practise; numbered after the chapters' rhythms. Each keeps the
 * deep-stroke rule (rhythm.js): deep strokes a beat apart, groups on the rim
 * with at most a deep stroke opening them.
 */
export const TRAINING_ONLY = ['R RR R R', 'R R R RR', 'R RRR R L', 'L LR R L', 'L LRR L R', 'R LRR R L', 'L LR RRR L', 'L RR LRR R'];

/** The tempo a rhythm is played at in Training when no call gives one (beats per minute). */
export const TRAINING_BPM = 84;

/** The level a rhythm's shape puts it at, 1 to 9 (see LEVELS). */
export function levelOf(text) {
  const beats = text.split(' ').filter((b) => b !== '-');
  const groups = [];
  beats.forEach((b, i) => {
    if (b.length < 2) return;
    const before = i > 0 ? beats[i - 1].slice(-1) : null;
    const after = i < beats.length - 1 ? beats[i + 1][0] : null;
    groups.push({
      i,
      size: b.length,
      mixed: new Set(b).size > 1,
      // A switch of drum just before or just after the group.
      beside: (before !== null && before !== b[0]) || (after !== null && after !== b.slice(-1)),
    });
  });
  const pairs = groups.filter((g) => g.size === 2);
  const triplets = groups.filter((g) => g.size === 3);
  if (!groups.length) return 1;
  if (pairs.length && triplets.length) return groups.some((g) => g.mixed) ? 9 : 8;
  if (triplets.length) {
    if (triplets.some((g) => g.mixed)) return 7;
    if (triplets.length >= 2) return 6;
    return triplets[0].beside ? 5 : 4;
  }
  if (pairs.some((g, k) => k > 0 && g.i === pairs[k - 1].i + 1)) return 6; // back to back
  if (pairs.length >= 2) return 5;
  const p = pairs[0];
  if (p.mixed) return p.beside ? 5 : 4;
  return new Set(beats.join('')).size === 1 ? 2 : 3;
}

const ROMAN = ['', 'I', 'II', 'III'];

/**
 * Every rhythm in the game: [{ n, text, level, bpm, uses: [{ ch, what }] }],
 * numbered from 1 in the order the chapters first use them.
 */
export function catalogue() {
  const out = [];
  const byText = new Map();
  const add = (text, use, bpm) => {
    let e = byText.get(text);
    if (!e) {
      e = { n: out.length + 1, text, uses: [], bpm: null };
      byText.set(text, e);
      out.push(e);
    }
    e.uses.push(use);
    if (!e.bpm && bpm) e.bpm = bpm;
  };
  STAGES.forEach((st, i) => {
    const ch = i + 1;
    if ((st.mode || 'battle') === 'battle') {
      for (const id of st.unlocked || []) {
        const c = COMMANDS.find((k) => k.id === id);
        designedTiers(id)
          .slice(0, st.maxTier || 3)
          .forEach((text, k) => add(text, { ch, what: `${c.gloss} ${ROMAN[k + 1]}` }));
      }
    }
    for (const call of st.calls || []) add(call.text, { ch, what: call.label ? `${call.label}’s call` : 'Call' }, call.bpm);
    if (st.rhythm) add(st.rhythm, { ch, what: 'Casting' }, st.bpm);
  });
  for (const text of TRAINING_ONLY) add(text, { ch: null, what: T.training.trainingOnly });
  for (const e of out) {
    e.level = LEVEL_OVERRIDES[e.n] || levelOf(e.text);
    e.bpm = e.bpm || TRAINING_BPM;
  }
  return out;
}

/** The rhythms of one level (1 to 9), in number order. */
export function levelRhythms(level, all = catalogue()) {
  return all.filter((e) => e.level === level);
}

/**
 * Where a rhythm is used, for its row: each use with its chapters, e.g.
 * "March II · ch 1, 5, 6, 8 — Call · ch 2".
 */
export function usesText(e) {
  const by = new Map();
  for (const u of e.uses) {
    if (u.ch === null) {
      by.set(u.what, by.get(u.what) || []);
      continue;
    }
    const chs = by.get(u.what) || [];
    if (!chs.includes(u.ch)) chs.push(u.ch);
    by.set(u.what, chs);
  }
  return [...by].map(([what, chs]) => (chs.length ? txt('training.usedIn', { what, chapters: chs.join(', ') }) : what)).join(' — ');
}

/** The earliest chapter that asks for a rhythm (Infinity for Training's own). */
export function firstChapter(e) {
  return Math.min(...e.uses.map((u) => (u.ch === null ? Infinity : u.ch)));
}
