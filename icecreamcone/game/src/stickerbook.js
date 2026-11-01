// The sticker book's state, and the pure rules it keeps: where a sticker
// may go, which pictures can be put behind the stickers, and what is saved.
// No DOM, no canvas, so the tests can run it (the drawing is in
// celebrate.js, the screen and its input in main.js, the saving in store.js).
//
// A sticker the player has moved is kept as { page, u, v, z }: which page of
// its spread (0 or 1), where its centre is as a share of that page's width
// and height (so it stays put on the page whether the book lies open side by
// side on a wide screen or one page above the other on an upright one), and
// z, its place in the pile (higher is on top). A sticker never moved sits
// in its own place, the slot the celebration sticks it in.
//
// The book's first picture, "All the birds together" (GATHERING), is one
// painting of all 28 birds across a single spread, each bird's spot greyed
// until its sticker is snapped into it. It keeps its own places: `snap`, the
// birds snapped into the painting, and `gpos`, stickers left lying loose on
// it ({ page, u, v, z } on its one spread, which is the painting's own
// coordinates: page 0 is its left half). A sticker in neither waits on the
// sticker sheet beside the book.
//
// Saved shape (v 2): { v, pos, bg, spread, gpos, snap }. A save from before
// (no v) loads with gpos and snap empty, and its picture, if it was the
// plain page (then the only default), becomes the gathering.

export const PLAIN = 'plain';
export const GATHERING = 'gathering';
export const VERSION = 2;

// The empty book.
export const emptyBook = () => ({ v: VERSION, pos: {}, bg: GATHERING, spread: 0, gpos: {}, snap: [] });

// What was saved, checked: anything malformed is dropped, so a bad save
// never breaks the book. `ids` are the guide's birds; `spreads` how many
// spreads the book has.
export function normalizeBook(raw, ids, spreads = 1) {
  const book = emptyBook();
  if (!raw || typeof raw !== 'object') return book;
  const known = new Set(ids);
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const places = (from, to) => {
    if (!from || typeof from !== 'object') return;
    for (const [id, p] of Object.entries(from)) {
      if (!known.has(id) || !p || (p.page !== 0 && p.page !== 1) || !num(p.u) || !num(p.v)) continue;
      to[id] = { page: p.page, u: clamp01(p.u), v: clamp01(p.v), z: num(p.z) ? p.z : 0 };
    }
  };
  places(raw.pos, book.pos);
  const old = !Number.isInteger(raw.v) || raw.v < 2;
  if (typeof raw.bg === 'string' && (raw.bg === PLAIN || raw.bg === GATHERING || known.has(raw.bg))) book.bg = raw.bg;
  // the plain page was every old book's default: the gathering is now
  if (old && book.bg === PLAIN) book.bg = GATHERING;
  if (Number.isInteger(raw.spread) && raw.spread >= 0 && raw.spread < spreads) book.spread = raw.spread;
  if (!old) {
    places(raw.gpos, book.gpos);
    if (Array.isArray(raw.snap)) book.snap = ids.filter((id) => raw.snap.includes(id));
    for (const id of book.snap) delete book.gpos[id];
  }
  return book;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// The pictures that can go behind the stickers: all the birds together
// (when its painting is there), the plain page, then the scene of each bird
// passed, in the guide's order.
export function backgrounds(ids, isPassed, { gathering = true } = {}) {
  return [...(gathering ? [GATHERING] : []), PLAIN, ...ids.filter((id, i) => isPassed(i))];
}

// The next (d = 1) or previous (d = -1) picture, round and round. One no
// longer in the list (its bird forgotten) counts as the first picture.
export function cycle(list, current, d) {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + d + list.length * 4) % list.length];
}

// The picture to show: the chosen one while it is still available (its bird spotted), else the first.
export const shownBackground = (list, bg) => (list.includes(bg) ? bg : list[0]);

// Where a sticker of size `s` (in stage units) dropped at (x, y) goes on a
// spread's `pages` ([{ x, y, w, h }, ...]): onto the page it is over (or the
// nearer one), its centre kept far enough inside that it stays on the page.
export function placeOnSpread(pages, x, y, s) {
  let best = 0;
  let bestD = Infinity;
  pages.forEach((p, k) => {
    const dx = Math.max(p.x - x, 0, x - (p.x + p.w));
    const dy = Math.max(p.y - y, 0, y - (p.y + p.h));
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  });
  const p = pages[best];
  const mu = Math.min(0.5, (s * 0.4) / p.w);
  const mv = Math.min(0.5, (s * 0.4) / p.h);
  return {
    page: best,
    u: Math.max(mu, Math.min(1 - mu, (x - p.x) / p.w)),
    v: Math.max(mv, Math.min(1 - mv, (y - p.y) / p.h)),
  };
}

// A saved place back in stage units on this layout's pages.
export function pagePoint(pages, pos) {
  const p = pages[pos.page] || pages[0];
  return { x: p.x + pos.u * p.w, y: p.y + pos.v * p.h };
}

// Moves sticker `id` to `place`, on top of the pile.
export function moveSticker(book, id, place) {
  const top = Math.max(0, ...Object.values(book.pos).map((p) => p.z));
  book.pos[id] = { page: place.page, u: place.u, v: place.v, z: top + 1 };
  return book;
}

// The order to draw a spread's stickers in: those in their own places first,
// then the moved ones from the bottom of the pile to the top.
export function drawOrder(ids, pos) {
  return [...ids].sort((a, b) => (pos[a]?.z ?? -1) - (pos[b]?.z ?? -1));
}

// ---------- all the birds together ----------

// The painting's atlas (assets/book/gathering.atlas.json) as the regions
// used here: for each bird its box { x, y, w, h } and centre { cx, cy } as
// shares of the whole painting's width and height, its page (0 left, 1
// right), and the fold, the strip down the middle with no bird on it.
export function regionsFromAtlas(atlas) {
  const [iw, ih] = atlas.image_size;
  const regions = atlas.regions.map((r) => {
    const [x, y, w, h] = r.bbox;
    return { id: r.id, x: x / iw, y: y / ih, w: w / iw, h: h / ih, cx: (x + w / 2) / iw, cy: (y + h / 2) / ih, page: r.page === 'right' ? 1 : 0 };
  });
  const fold = atlas.fold_zone?.x_normalized || [0.47, 0.53];
  return { regions, fold: { x0: fold[0], x1: fold[1] }, aspect: iw / ih };
}

// A place on the spread ({ page, u, v }) as a point of the painting, and back.
export const toPicture = (place) => ({ x: (place.page + place.u) / 2, y: place.v });
export function fromPicture(pt) {
  const page = pt.x < 0.5 ? 0 : 1;
  return { page, u: clamp01(pt.x * 2 - page), v: clamp01(pt.y) };
}

// Is the point (painting shares) inside region r, its box grown by `grow`
// (a share of the box's smaller side, measured in the painting's pixels so
// it grows as much across as down)?
function inside(r, pt, grow = 0, aspect = 2) {
  const gy = Math.min(r.w * aspect, r.h) * grow;
  const gx = gy / aspect;
  return pt.x >= r.x - gx && pt.x <= r.x + r.w + gx && pt.y >= r.y - gy && pt.y <= r.y + r.h + gy;
}
const near = (r, pt, aspect = 2) => Math.hypot((pt.x - r.cx) * aspect, pt.y - r.cy);

// Where a sticker of bird `id` dropped with its centre at `pt` (painting
// shares) goes: { kind: 'snap' } into its own spot when its centre is inside
// or near that bird's region (on the same half of the picture); { kind:
// 'wrong', id } on another bird's spot (its own wins where the two overlap);
// else { kind: 'free' }, loose on the page. Nothing snaps on the fold.
export const SNAP_REACH = 0.3;
export function dropOnPicture(atlas, id, pt, { reach = SNAP_REACH } = {}) {
  const { regions, fold, aspect } = atlas;
  if (pt.x >= fold.x0 && pt.x <= fold.x1) return { kind: 'free' };
  const page = pt.x < 0.5 ? 0 : 1;
  const own = regions.find((r) => r.id === id);
  if (own && own.page === page && inside(own, pt, reach, aspect)) return { kind: 'snap', id };
  const other = regionAt(atlas, pt, (r) => r.id !== id);
  return other ? { kind: 'wrong', id: other.id } : { kind: 'free' };
}

// The region under the point (the one whose centre is nearest, where they
// overlap), among those `which` allows; null if none.
export function regionAt(atlas, pt, which = () => true) {
  let best = null;
  for (const r of atlas.regions) {
    if (!which(r) || !inside(r, pt, 0, atlas.aspect)) continue;
    if (!best || near(r, pt, atlas.aspect) < near(best, pt, atlas.aspect)) best = r;
  }
  return best;
}

// Snaps bird `id` into its spot (no longer loose on the page).
export function snapSticker(book, id) {
  delete book.gpos[id];
  if (!book.snap.includes(id)) book.snap.push(id);
  return book;
}
// Takes it out of its spot again (it is then in hand, then put somewhere).
export function unsnapSticker(book, id) {
  book.snap = book.snap.filter((x) => x !== id);
  return book;
}
// Leaves it loose on the gathering's page at `place`, on top of the pile.
export function placeFree(book, id, place) {
  unsnapSticker(book, id);
  const top = Math.max(0, ...Object.values(book.gpos).map((p) => p.z));
  book.gpos[id] = { page: place.page, u: place.u, v: place.v, z: top + 1 };
  return book;
}
// Puts it back on the sticker sheet beside the book.
export function toSheet(book, id) {
  unsnapSticker(book, id);
  delete book.gpos[id];
  return book;
}
// Where each earned sticker is on the gathering: 'snap', 'free' or 'sheet'.
export function gatherState(book, id) {
  return book.snap.includes(id) ? 'snap' : book.gpos[id] ? 'free' : 'sheet';
}

// ---------- the view of the gathering on a small screen ----------

// On a phone the gathering's pages are drawn larger than they are laid out
// (zoom z > 1) and the view pans over them. The book is laid out in stage
// units as if unzoomed, its pages' outline `box`; `win` is the window it is
// seen through (often the box itself); a camera { z, x, y } looks at the
// point (x, y) of the book, shown at the window's centre. Positions are kept
// in the painting's own coordinates, so they stay right at any zoom and scroll.

// The camera held inside the book: the window never shows past its edges
// (or, where the book is smaller than the window, shows it centred).
export function clampCam(box, cam, win = box) {
  const hw = win.w / (2 * cam.z);
  const hh = win.h / (2 * cam.z);
  const fit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  return { ...cam, x: fit(cam.x, box.x + hw, box.x + box.w - hw), y: fit(cam.y, box.y + hh, box.y + box.h - hh) };
}
// A point of the book on the stage, and a point of the stage in the book.
export function bookToStage(win, cam, p) {
  return { x: win.x + win.w / 2 + (p.x - cam.x) * cam.z, y: win.y + win.h / 2 + (p.y - cam.y) * cam.z };
}
export function stageToBook(win, cam, p) {
  return { x: cam.x + (p.x - win.x - win.w / 2) / cam.z, y: cam.y + (p.y - win.y - win.h / 2) / cam.z };
}
// How fast the view scrolls (-1..1 across, down) for a point near the
// window's edge: nothing in the middle, faster the nearer the edge, within
// `band` stage units of it; nothing outside the window.
export function edgePush(win, p, band) {
  if (p.x < win.x || p.x > win.x + win.w || p.y < win.y || p.y > win.y + win.h) return { x: 0, y: 0 };
  const push = (v, lo, hi) => (v < lo + band ? -(lo + band - v) / band : v > hi - band ? (v - (hi - band)) / band : 0);
  return { x: push(p.x, win.x, win.x + win.w), y: push(p.y, win.y, win.y + win.h) };
}
