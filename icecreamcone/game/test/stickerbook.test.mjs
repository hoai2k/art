import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAIN, GATHERING, emptyBook, normalizeBook, backgrounds, cycle, shownBackground, placeOnSpread, pagePoint, moveSticker, drawOrder, regionsFromAtlas, toPicture, fromPicture, dropOnPicture, regionAt, snapSticker, placeFree, toSheet, gatherState, clampCam, bookToStage, stageToBook, edgePush } from '../src/stickerbook.js';
import { bookLayout, gatherLayout, sheetCells } from '../src/reward.js';
import { BIRDS } from '../src/birds.js';

const ATLAS_JSON = JSON.parse(readFileSync(new URL('../assets/book/gathering.atlas.json', import.meta.url)));
const ATLAS = regionsFromAtlas(ATLAS_JSON);

const IDS = ['coot', 'cupadee', 'shuttercluck', 'gullfinch'];

test('sticker book: the pictures are all the birds together, the plain page, then each passed bird in order', () => {
  const list = backgrounds(IDS, (i) => i === 0 || i === 2);
  assert.deepEqual(list, [GATHERING, PLAIN, 'coot', 'shuttercluck']);
  assert.deepEqual(backgrounds(IDS, () => false), [GATHERING, PLAIN]);
  assert.deepEqual(backgrounds(IDS, () => false, { gathering: false }), [PLAIN], 'without its painting');
  assert.equal(cycle(list, GATHERING, 1), PLAIN);
  assert.equal(cycle(list, PLAIN, 1), 'coot');
  assert.equal(cycle(list, 'shuttercluck', 1), GATHERING, 'round again');
  assert.equal(cycle(list, GATHERING, -1), 'shuttercluck', 'and backwards');
  assert.equal(cycle(list, 'gullfinch', 1), PLAIN, 'one no longer unlocked counts as the first picture');
  assert.equal(cycle([PLAIN], PLAIN, 1), PLAIN);
  assert.equal(shownBackground(list, 'gullfinch'), GATHERING);
  assert.equal(shownBackground([PLAIN, 'coot'], 'gullfinch'), PLAIN);
  assert.equal(shownBackground(list, 'coot'), 'coot');
  assert.equal(emptyBook().bg, GATHERING, 'a new book opens at all the birds together');
});

test('sticker book: a dropped sticker stays on the page it is over, inside its edges', () => {
  const pages = [{ x: 0, y: 0, w: 500, h: 400 }, { x: 520, y: 0, w: 500, h: 400 }];
  const a = placeOnSpread(pages, 100, 100, 100);
  assert.deepEqual(a, { page: 0, u: 0.2, v: 0.25 });
  // off the top-left corner: pulled back in by 0.4 of its size
  const b = placeOnSpread(pages, -300, -300, 100);
  assert.deepEqual(b, { page: 0, u: 40 / 500, v: 40 / 400 });
  // past the right edge of the second page
  const c = placeOnSpread(pages, 5000, 200, 100);
  assert.equal(c.page, 1);
  assert.equal(c.u, 1 - 40 / 500);
  // over the spine: the nearer page
  assert.equal(placeOnSpread(pages, 515, 200, 100).page, 1);
  assert.equal(placeOnSpread(pages, 505, 200, 100).page, 0);
  // and back to stage units
  assert.deepEqual(pagePoint(pages, a), { x: 100, y: 100 });
});

test('sticker book: a place on the page survives turning a wide book upright', () => {
  const wide = bookLayout(28, { x: 120, y: 150, w: 1360, h: 640 }, true, 0);
  const tall = bookLayout(28, { x: 60, y: 250, w: 780, h: 1150 }, false, 0);
  const at = placeOnSpread(wide.pages, 1100, 500, wide.slots[0].s);
  assert.equal(at.page, 1);
  const p = pagePoint(tall.pages, at);
  const q = tall.pages[1];
  assert.ok(p.x > q.x && p.x < q.x + q.w && p.y > q.y && p.y < q.y + q.h, 'on the same page');
});

test('sticker book: the one put down goes on top of the pile', () => {
  const book = emptyBook();
  moveSticker(book, 'coot', { page: 0, u: 0.5, v: 0.5 });
  moveSticker(book, 'cupadee', { page: 0, u: 0.5, v: 0.5 });
  moveSticker(book, 'coot', { page: 1, u: 0.2, v: 0.3 });
  assert.deepEqual(drawOrder(IDS, book.pos), ['shuttercluck', 'gullfinch', 'cupadee', 'coot']);
  assert.equal(book.pos.coot.page, 1);
});

test('sticker book: what is saved comes back, and anything malformed is dropped', () => {
  const book = emptyBook();
  moveSticker(book, 'coot', { page: 1, u: 0.3, v: 0.6 });
  book.bg = 'cupadee';
  book.spread = 1;
  const back = normalizeBook(JSON.parse(JSON.stringify(book)), IDS, 2);
  assert.deepEqual(back, book);
  assert.deepEqual(normalizeBook(null, IDS, 2), emptyBook());
  assert.deepEqual(normalizeBook('nonsense', IDS, 2), emptyBook());
  const bad = normalizeBook({ v: 2, pos: { coot: { page: 3, u: 0.1, v: 0.1 }, dodo: { page: 0, u: 0.1, v: 0.1 }, cupadee: { page: 0, u: 2, v: -1 } }, bg: 'nobody', spread: 7, gpos: { coot: 'x', gullfinch: { page: 1, u: 0.5, v: 0.5 } }, snap: ['dodo', 'coot', 'coot', 7] }, IDS, 2);
  assert.deepEqual(bad, { v: 2, pos: { cupadee: { page: 0, u: 1, v: 0, z: 0 } }, bg: GATHERING, spread: 0, gpos: { gullfinch: { page: 1, u: 0.5, v: 0.5, z: 0 } }, snap: ['coot'] });
});

test('sticker book: an old save (before the gathering) still loads', () => {
  // the shape saved before v 2: places, picture and spread only
  const old = { pos: { coot: { page: 1, u: 0.3, v: 0.6, z: 2 } }, bg: PLAIN, spread: 1 };
  const book = normalizeBook(old, IDS, 2);
  assert.deepEqual(book.pos, old.pos, 'its places kept');
  assert.equal(book.spread, 1);
  assert.equal(book.bg, GATHERING, 'the plain page was only the old default: the gathering is the new one');
  assert.deepEqual(book.snap, []);
  assert.deepEqual(book.gpos, {});
  assert.equal(normalizeBook({ ...old, bg: 'cupadee' }, IDS, 2).bg, 'cupadee', 'a bird picture chosen stays chosen');
  // and a new save keeps the plain page when chosen
  assert.equal(normalizeBook({ ...emptyBook(), bg: PLAIN }, IDS, 2).bg, PLAIN);
});

test('gathering: the atlas has every bird once, 14 to a half, none on the fold', () => {
  const ids = BIRDS.map((b) => b.id);
  assert.deepEqual(ATLAS.regions.map((r) => r.id).sort(), [...ids].sort());
  assert.deepEqual(ATLAS.regions.filter((r) => r.page === 0).map((r) => r.id).sort(), ids.slice(0, 14).sort(), 'the first spread’s 14 on the left');
  for (const r of ATLAS.regions) {
    assert.ok(r.page ? r.x >= ATLAS.fold.x1 : r.x + r.w <= ATLAS.fold.x0, `${r.id} clear of the fold`);
  }
  assert.equal(ATLAS.aspect, 2);
});

test('gathering: a drop snaps on or near its own bird, shakes on another, else stays loose', () => {
  const R = Object.fromEntries(ATLAS.regions.map((r) => [r.id, r]));
  const centre = (r) => ({ x: r.cx, y: r.cy });
  assert.deepEqual(dropOnPicture(ATLAS, 'coot', centre(R.coot)), { kind: 'snap', id: 'coot' });
  // just outside its box, but near: still snaps
  const c = R.coot;
  assert.equal(dropOnPicture(ATLAS, 'coot', { x: c.x + c.w + 0.004, y: c.cy }).kind, 'snap');
  // far from it: loose
  assert.equal(dropOnPicture(ATLAS, 'coot', { x: c.x + c.w + 0.05, y: c.y + c.h + 0.3 }).kind !== 'snap', true);
  // on another bird
  assert.deepEqual(dropOnPicture(ATLAS, 'coot', centre(R.radiobird)), { kind: 'wrong', id: 'radiobird' });
  // on the fold, nothing snaps, even near the Peeper at the left page's edge
  assert.deepEqual(dropOnPicture(ATLAS, 'peeper', { x: (ATLAS.fold.x0 + ATLAS.fold.x1) / 2, y: R.peeper.cy }), { kind: 'free' });
  // its own region never reaches over to the other half of the picture
  assert.equal(dropOnPicture(ATLAS, 'peeper', { x: 0.535, y: R.peeper.cy }).kind, 'free');
  // the Milkbottle Midge and the Waterglass Goose overlap: each snaps where they do
  const m = R.milkmidge;
  const w = R.waterglassgoose;
  const both = { x: (Math.max(m.x, w.x) + Math.min(m.x + m.w, w.x + w.w)) / 2, y: (Math.max(m.y, w.y) + Math.min(m.y + m.h, w.y + w.h)) / 2 };
  assert.equal(dropOnPicture(ATLAS, 'milkmidge', both).kind, 'snap');
  assert.equal(dropOnPicture(ATLAS, 'waterglassgoose', both).kind, 'snap');
  assert.equal(dropOnPicture(ATLAS, 'coot', both).kind, 'wrong', 'and anyone else is on a wrong spot');
  // picking up where they overlap takes the one whose centre is nearer
  const nearM = { x: both.x + (m.cx - both.x) * 0.3, y: both.y + (m.cy - both.y) * 0.3 };
  assert.equal(regionAt(ATLAS, nearM).id, 'milkmidge');
  assert.equal(regionAt(ATLAS, nearM, (r) => r.id !== 'milkmidge').id, 'waterglassgoose', 'only among those allowed');
  assert.equal(regionAt(ATLAS, { x: 0.5, y: 0.5 }), null, 'nothing on the fold');
});

test('gathering: snapping in, taking out, leaving loose and back on the sheet', () => {
  const book = emptyBook();
  assert.equal(gatherState(book, 'coot'), 'sheet', 'an earned sticker starts on the sheet');
  placeFree(book, 'coot', { page: 0, u: 0.4, v: 0.5 });
  assert.equal(gatherState(book, 'coot'), 'free');
  snapSticker(book, 'coot');
  snapSticker(book, 'coot');
  assert.equal(gatherState(book, 'coot'), 'snap');
  assert.deepEqual(book.snap, ['coot'], 'once');
  assert.equal(book.gpos.coot, undefined, 'no longer loose');
  placeFree(book, 'coot', { page: 1, u: 0.2, v: 0.2 });
  assert.equal(gatherState(book, 'coot'), 'free', 'taken out and put down elsewhere: loose');
  assert.deepEqual(book.snap, []);
  placeFree(book, 'cupadee', { page: 1, u: 0.2, v: 0.2 });
  assert.ok(book.gpos.cupadee.z > book.gpos.coot.z, 'on top of the pile');
  toSheet(book, 'coot');
  assert.equal(gatherState(book, 'coot'), 'sheet');
  // and it all saves and comes back
  snapSticker(book, 'shuttercluck');
  const back = normalizeBook(JSON.parse(JSON.stringify(book)), IDS, 2);
  assert.deepEqual(back, book);
  // places on the painting go both ways
  assert.deepEqual(toPicture({ page: 1, u: 0.5, v: 0.25 }), { x: 0.75, y: 0.25 });
  assert.deepEqual(fromPicture({ x: 0.75, y: 0.25 }), { page: 1, u: 0.5, v: 0.25 });
});

test('gathering: its book shows each half of the painting whole, the waiting stickers on the sheet beside it', () => {
  const inside = (r, x, y) => x >= r.x - 1e-6 && x <= r.x + r.w + 1e-6 && y >= r.y - 1e-6 && y <= r.y + r.h + 1e-6;
  const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const [wide, area] of [[true, { x: 24, y: 140, w: 1552, h: 660 }], [false, { x: 16, y: 240, w: 868, h: 1290 }]]) {
    const L = gatherLayout(28, area, wide);
    for (const p of L.pages) assert.ok(Math.abs(p.w - p.h) < 1e-6, 'square pages: the halves are not cut');
    assert.equal(L.zones.length, wide ? 2 : 1, 'a column either side, or a strip under');
    for (const z of L.zones) assert.ok(!over(z, L.box) && !over(z, L.win), 'the sheet is clear of the pages and their window');
    // every sticker waiting: all fit, in order, none overlapping
    const all = sheetCells(L, [...Array(28).keys()]);
    assert.deepEqual(all.map((c) => c.i), [...Array(28).keys()]);
    for (const c of all) assert.ok(inside(L.zones[c.zone], c.x - c.s / 2, c.y - c.s / 2) && inside(L.zones[c.zone], c.x + c.s / 2, c.y + c.s / 2), 'inside its zone');
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) assert.ok(Math.hypot(all[a].x - all[b].x, all[a].y - all[b].y) >= all[a].s * 0.99, 'apart');
    if (wide) assert.ok(all.filter((c) => c.zone === 0).every((c) => c.i < 14), 'when wide, the first page’s birds on the left');
    // a few waiting are drawn larger
    const few = sheetCells(L, [2, 9, 20]);
    assert.ok(few[0].s > all[0].s * 1.3, 'fewer, bigger');
    assert.ok(few.every((c) => c.s <= 150), 'but not too big');
    assert.deepEqual(sheetCells(L, []), []);
  }
});

test('gathering: the zoomed view stays inside the book, and maps there and back', () => {
  const box = { x: 100, y: 50, w: 1000, h: 500 };
  const cam = clampCam(box, { z: 2, x: 0, y: 9999 });
  assert.deepEqual([cam.x, cam.y], [100 + 250, 50 + 500 - 125], 'clamped to the corner');
  assert.deepEqual(clampCam(box, { z: 1, x: 3, y: 4 }), { z: 1, x: 600, y: 300 }, 'unzoomed: centred');
  const p = { x: 420, y: 333 };
  const q = stageToBook(box, cam, bookToStage(box, cam, p));
  assert.ok(Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y - p.y) < 1e-9);
  // the corner of the book seen shows at the window's corner
  const corner = bookToStage(box, cam, { x: 100, y: 550 });
  assert.deepEqual([corner.x, corner.y], [100, 550]);
  assert.deepEqual(edgePush(box, { x: 600, y: 300 }, 100), { x: 0, y: 0 }, 'nothing in the middle');
  assert.deepEqual(edgePush(box, { x: 110, y: 300 }, 100), { x: -0.9, y: 0 }, 'near the left edge: left');
  assert.equal(edgePush(box, { x: 1090, y: 540 }, 100).y > 0, true, 'and down near the foot');
  assert.deepEqual(edgePush(box, { x: 20, y: 300 }, 100), { x: 0, y: 0 }, 'outside the window (on the sheet): none');
});
