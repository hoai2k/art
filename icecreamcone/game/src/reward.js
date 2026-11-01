// What happens after a round, and the timing and layout of the sticker
// celebration. Pure: no DOM, no canvas, so the tests can run it (the drawing
// is in celebrate.js, the flow in main.js).
//
// Every bird can be played from the start; a bird is spotted once its score
// is reached. The first time it is, the round ends in a celebration (the
// bird's sticker, the sticker book, then the bird's own card in the guide
// turning over from its silhouette to its painting); every other round shows
// its result card briefly and goes back to the guide, the bird chosen. With
// ?debug every round that reaches the score celebrates.

// 'celebrate' or 'brief'.
export function roundOutcome({ wasPassed, isPassed, reached, debug = false }) {
  if (debug) return reached ? 'celebrate' : 'brief';
  return !wasPassed && isPassed ? 'celebrate' : 'brief';
}

// Whether the guide turns the bird's own card over as it comes back: after a
// celebration that played to its end, and after Exit to Field Guide when the
// round so far spots the bird for the first time (no celebration then). A
// celebration skipped with B or a long press goes straight back, the card
// already turned.
export function turnsOver({ outcome = 'brief', skipped = false, quit = false, wasPassed = false, isPassed = false }) {
  if (quit) return !wasPassed && isPassed;
  return outcome === 'celebrate' && !skipped;
}

// The line under the sticker once it is stuck: how many of the guide's
// birds are spotted now, or all of them.
export const spottedLine = (count, total) => (count >= total ? `Every one of the ${total} rare birds, spotted!` : `${count} of ${total} birds spotted!`);

// The celebration's steps, in seconds. Any press jumps to the next step;
// B or a long press skips to the end. After 'done' the guide shows the
// bird's own card turning over (UNLOCK).
export const STEPS = [
  { name: 'sticker', at: 0 }, // the sticker pops in, with the bird's name
  { name: 'book', at: 1.6 }, // the sticker book opens under it
  { name: 'fly', at: 2.6 }, // the sticker flies to its place and sticks
  { name: 'stuck', at: 3.5 }, // there it stays, among the others
  { name: 'done', at: 4.5 },
];
export const FLY_TIME = 0.9; // the flight, from 'fly' to landing
export const END = STEPS.at(-1).at;
export const HOLD_TO_SKIP = 0.6; // seconds a press is held to skip it all

// The bird's card in the guide: still a silhouette for a moment, then it
// turns over (the painting shows from halfway), then it shines; it is chosen.
export const UNLOCK = { wait: 0.4, flip: 0.8, shine: 0.6 };
export const UNLOCK_TIME = UNLOCK.wait + UNLOCK.flip + UNLOCK.shine;
export const RESULT_TIME = 3; // how long the result card stays after other rounds
export const RESULT_GUARD = 0.5; // presses this soon after the card are ignored

// How the result card looks after a brief round (never the first pass, which
// celebrates): 'record' for a new best that reaches the bird's score (a
// World Record: confetti, a rosette, the fanfare), 'passed' for reaching it
// again without a new best (a tick stamp and a few sparkles), 'best' for a
// new best that still falls short (a Personal Best, as before) and 'plain'
// for the rest ('Time!').
export function resultKind({ record, reached }) {
  if (reached) return record ? 'record' : 'passed';
  return record ? 'best' : 'plain';
}

export const RESULT_TITLES = { record: 'New World Record!', passed: 'Time!', best: 'Personal Best!', plain: 'Time!' };

// How long each card stays, and how soon a press can take it away. A World
// Record stays long enough for its fanfare and confetti, and holds a little
// longer before a press counts, so the stamp lands first.
export const RESULT_TIMES = {
  record: { time: 5, guard: 0.7 },
  passed: { time: 3.5, guard: RESULT_GUARD },
  best: { time: RESULT_TIME, guard: RESULT_GUARD },
  plain: { time: RESULT_TIME, guard: RESULT_GUARD },
};
export const resultTiming = (kind) => RESULT_TIMES[kind] || RESULT_TIMES.plain;

export function stepAt(t) {
  let i = 0;
  while (i + 1 < STEPS.length && t >= STEPS[i + 1].at) i++;
  return STEPS[i].name;
}

// Where a press during the celebration jumps to: the start of the next step.
export function skipFrom(t) {
  for (const s of STEPS) if (s.at > t + 1e-6) return s.at;
  return END;
}

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export { ease };

// An overshooting pop, 0 → 1 over x in [0, 1], with a bounce past 1.
export function pop(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const c = 1.9;
  const y = x - 1;
  return 1 + (c + 1) * y * y * y + c * y * y;
}

// The sticker book holds every bird of the guide, at most PER_SPREAD to an
// open spread (two facing pages): the 28 birds take two spreads of 14, and
// the book opens at the spread with the new sticker's place.
export const PER_SPREAD = 14;
export const spreadCount = (n) => Math.max(1, Math.ceil(n / PER_SPREAD));
// Spreads share the birds evenly, in order.
const perSpread = (n) => Math.ceil(n / spreadCount(n));
export const spreadOf = (i, n) => Math.floor(i / perSpread(n));

// One spread of the book: two facing pages inside `rect` ({ x, y, w, h }),
// side by side on a wide screen or one above the other on an upright one,
// and a slot for each of the spread's stickers, in order, the first half on
// the first page. Each slot is { i, x, y, s, page } (the bird's index in the
// guide, its centre and size); `from` and `to` are the spread's first bird
// and the one after its last.
export function bookLayout(n, rect, wide = true, spread = 0) {
  const from = Math.min(n, spread * perSpread(n));
  const to = Math.min(n, from + perSpread(n));
  const gap = wide ? rect.w * 0.035 : rect.h * 0.035; // the spine
  const pages = wide
    ? [
        { x: rect.x, y: rect.y, w: (rect.w - gap) / 2, h: rect.h },
        { x: rect.x + (rect.w + gap) / 2, y: rect.y, w: (rect.w - gap) / 2, h: rect.h },
      ]
    : [
        { x: rect.x, y: rect.y, w: rect.w, h: (rect.h - gap) / 2 },
        { x: rect.x, y: rect.y + (rect.h + gap) / 2, w: rect.w, h: (rect.h - gap) / 2 },
      ];
  const first = Math.ceil((to - from) / 2);
  const slots = [];
  pages.forEach((p, k) => {
    const count = k === 0 ? first : to - from - first;
    if (!count) return;
    // inside the page's margins, under its heading
    const m = Math.min(p.w, p.h) * 0.07;
    const head = p.h * 0.12;
    const ix = p.x + m;
    const iy = p.y + head;
    const iw = p.w - m * 2;
    const ih = p.h - head - m * 0.7;
    let best = null;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const s = Math.min(iw / cols, ih / rows);
      if (!best || s > best.s + 0.5) best = { cols, rows, s };
    }
    const { rows, s } = best;
    // the stickers shared evenly between the rows, the fuller ones in the
    // middle (7 go 2, 3, 2), so no row is left with one or two strays
    const per = Array(rows).fill(Math.floor(count / rows));
    const mid = (rows - 1) / 2;
    [...per.keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b).slice(0, count % rows).forEach((r) => per[r]++);
    let j = 0;
    per.forEach((inRow, r) => {
      for (let c = 0; c < inRow; c++, j++) {
        slots.push({
          i: from + (k === 0 ? 0 : first) + j,
          x: ix + iw / 2 + (c - (inRow - 1) / 2) * s,
          y: iy + ih / 2 + (r - (rows - 1) / 2) * s,
          s: s * 0.9,
          page: k,
        });
      }
    });
  });
  return { from, to, pages, slots, spine: wide ? { x: rect.x + rect.w / 2, y: rect.y, w: gap, h: rect.h } : { x: rect.x, y: rect.y + rect.h / 2, w: rect.w, h: gap } };
}

// The book open at "All the birds together": one spread of two square pages
// (each half of the 2:1 painting shown whole, so no bird is cut off), side
// by side on a wide screen or one above the other on an upright one, and
// (with `sheet`) room for the sticker sheet where earned stickers wait: a
// column either side of the book when wide (the first page's birds to the
// left), a strip under it when upright. `box` is the two pages' outline;
// `win`, the window they are seen through (the box itself when wide; when
// upright, the whole width above the strip, the pages then shown larger
// than they are laid out and scrolled: see stickerbook.js); `zones`, the
// sheet's rectangles (sheetCells puts the waiting stickers in them).
export function gatherLayout(n, area, wide = true, { sheet = true } = {}) {
  let win;
  let zones = [];
  let P;
  if (wide) {
    const sheetW = sheet ? area.w * 0.1 : 0;
    const gapS = sheet ? area.w * 0.015 : 0;
    P = Math.min(area.h, (area.w - 2 * (sheetW + gapS)) / 2.07);
    const bw = P * 2.07;
    win = { x: area.x + (area.w - bw) / 2, y: area.y + (area.h - P) / 2, w: bw, h: P };
    if (sheet) {
      const pad = P * 0.035; // the cover round the pages
      const zw = win.x - pad - gapS * 0.5 - area.x;
      zones = [
        { x: area.x, y: win.y, w: zw, h: P },
        { x: win.x + bw + pad + gapS * 0.5, y: win.y, w: zw, h: P },
      ];
    }
  } else {
    const stripH = sheet ? Math.min(area.h * 0.17, 220) : 0;
    const gapS = sheet ? area.h * 0.02 : 0;
    win = { x: area.x, y: area.y, w: area.w, h: area.h - stripH - gapS };
    P = Math.min(win.w, win.h / 2.07);
    if (sheet) zones = [{ x: area.x, y: area.y + area.h - stripH, w: area.w, h: stripH }];
  }
  const gap = P * (wide ? 0.07 : 0.045);
  const bw = wide ? P * 2 + gap : P;
  const bh = wide ? P : P * 2 + gap;
  const x0 = win.x + (win.w - bw) / 2;
  const y0 = win.y + (win.h - bh) / 2;
  const pages = wide
    ? [{ x: x0, y: y0, w: P, h: P }, { x: x0 + P + gap, y: y0, w: P, h: P }]
    : [{ x: x0, y: y0, w: P, h: P }, { x: x0, y: y0 + P + gap, w: P, h: P }];
  const spine = wide ? { x: x0 + bw / 2, y: y0, w: gap, h: P } : { x: x0, y: y0 + bh / 2, w: P, h: gap };
  return { gather: true, wide, from: 0, to: n, pages, spine, slots: [], zones, box: { x: x0, y: y0, w: bw, h: bh }, win };
}

// The waiting stickers (`list`, birds' indices in the guide's order) laid
// out on the sheet's zones as large as they fit (up to `max`): shared
// between the two columns when wide (the earlier birds on the left), in
// rows along the strip when upright. Each cell is { i, x, y, s, zone }.
export function sheetCells(L, list, max = 150) {
  const cells = [];
  const parts = L.zones.length === 2 ? [list.slice(0, Math.ceil(list.length / 2)), list.slice(Math.ceil(list.length / 2))] : [list];
  parts.forEach((part, z) => {
    const r = L.zones[z];
    if (!r || !part.length) return;
    let best = null;
    for (let cols = 1; cols <= part.length; cols++) {
      const rows = Math.ceil(part.length / cols);
      const s = Math.min(r.w / cols, r.h / rows, max);
      if (!best || s > best.s + 0.5) best = { cols, rows, s };
    }
    const { cols, rows, s } = best;
    part.forEach((i, j) => {
      const c = j % cols;
      const row = Math.floor(j / cols);
      // centred in its zone, the last row centred too
      const inRow = row === rows - 1 ? part.length - row * cols : cols;
      cells.push({ i, x: r.x + r.w / 2 + (c - (inRow - 1) / 2) * s, y: r.y + r.h / 2 + (row - (rows - 1) / 2) * s, s: s * 0.96, zone: z });
    });
  });
  return cells;
}
