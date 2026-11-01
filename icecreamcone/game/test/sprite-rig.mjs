// A rig for testing how big the games draw their painted poses, without a
// browser: the delivered sheets are registered as stand-in images of their
// true size (read from the files' headers), and a game draws into a mock
// canvas that records every image it draws, the cell it came from and the
// scale it was drawn at (screen units per source pixel, along the vertical
// axis, so mirroring or a sideways squash doesn't count).
//
// The scale each cell was PAINTED at (against the bird's standing portrait)
// is measured on the pictures by design/source/measure_pose_scales.py and
// kept in design/source/pose-scales.json. A pose drawn at screen scale k from
// a cell painted at scale p shows the bird at k x p; every pose of a bird
// should show it the same size.
import { readFileSync, appendFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { setArt, SHEETS } from '../src/draw.js';
import { ASSETS } from '../src/asset-list.js';

const ROOT = new URL('..', import.meta.url);
export const POSE_SCALES = JSON.parse(readFileSync(new URL('../../design/source/pose-scales.json', import.meta.url), 'utf8'));

// A PNG or WebP's width and height, from its header.
function size(file) {
  const b = readFileSync(fileURLToPath(new URL(file, ROOT)));
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
    }
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  throw new Error('unknown image ' + file);
}

// A PNG's alpha channel (8-bit RGBA or grey+alpha, not interlaced), so the
// painted part of each cell can be found as a browser would.
function pngAlpha(file) {
  const b = readFileSync(fileURLToPath(new URL(file, ROOT)));
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const depth = b[24];
  const type = b[25];
  if (depth !== 8 || (type !== 6 && type !== 4) || b[28] !== 0) return null;
  const bpp = type === 6 ? 4 : 2;
  const idat = [];
  for (let o = 8; o < b.length; ) {
    const len = b.readUInt32BE(o);
    const kind = b.toString('ascii', o + 4, o + 8);
    if (kind === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) alpha[y * w + x] = cur[x * bpp + bpp - 1];
    cur.copy(prev);
  }
  return { w, h, alpha };
}

// A stand-in for document.createElement('canvas') that is just enough for
// draw.js's spriteCell to measure a cell's painted part: it remembers the
// image region drawn on it and reads that image's alpha back, sampled.
function canvasStub() {
  return {
    width: 1,
    height: 1,
    getContext() {
      const cv = this;
      let src = null;
      return {
        drawImage(img, sx, sy, sw, sh) {
          src = { img, sx, sy, sw, sh };
        },
        getImageData(x0, y0, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          const a = src && src.img.alpha;
          if (a) {
            for (let y = 0; y < h; y++) {
              const sy = Math.min(a.h - 1, Math.floor(src.sy + ((y + 0.5) * src.sh) / cv.height));
              for (let x = 0; x < w; x++) {
                const sx = Math.min(a.w - 1, Math.floor(src.sx + ((x + 0.5) * src.sw) / cv.width));
                data[(y * w + x) * 4 + 3] = a.alpha[sy * a.w + sx];
              }
            }
          }
          return { data };
        },
      };
    },
  };
}

// Register stand-in images for the delivered art the given keys name (or all
// of it), with their alpha where it can be read. Returns a function that
// undoes it.
export function withArt(keys = Object.keys(ASSETS)) {
  const map = new Map();
  for (const key of keys) {
    const a = ASSETS[key];
    if (!a || !a.delivered) continue;
    const [width, height] = size(a.file);
    const img = { key, width, height, src: a.file };
    if (key.startsWith('sprites.')) {
      Object.defineProperty(img, 'alpha', { get: () => (img._alpha === undefined ? (img._alpha = pngAlpha(a.file)) : img._alpha) });
    }
    map.set(key, img);
  }
  const had = globalThis.document;
  if (!had) globalThis.document = { createElement: () => canvasStub() };
  setArt(map);
  return () => {
    setArt(new Map());
    if (!had) delete globalThis.document;
  };
}

// With POSE_STRIPS=<file> set, what was measured is appended there (one JSON
// line per game), for drawing pose strips to look at.
function strip(id, sizes) {
  const file = process.env.POSE_STRIPS;
  if (!file) return;
  const poses = Object.entries(sizes).map(([state, ds]) => ({ state, id: ds[0].id, k: ds[0].k, file: ASSETS[ds[0].id.split('#')[0]]?.file }));
  appendFileSync(file, JSON.stringify({ game: id, poses }) + '\n');
}

// A 2D context that keeps its transform and records drawImage calls.
export function recorder() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const draws = [];
  const mul = ([a, b, c, d, e, f]) => {
    const [A, B, C, D, E, F] = m;
    m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  };
  const ctx = {
    save: () => stack.push([...m]),
    restore: () => { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
    translate: (x, y) => mul([1, 0, 0, 1, x, y]),
    scale: (x, y = x) => mul([x, 0, 0, y, 0, 0]),
    rotate: (r) => mul([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
    transform: (a, b, c, d, e, f) => mul([a, b, c, d, e, f]),
    setTransform: (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) => { m = [a, b, c, d, e, f]; },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    measureText: (t) => ({ width: String(t).length * 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    drawImage(img, ...a) {
      if (!img || !img.key) return;
      let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
      if (a.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a;
      else [dx, dy, dw, dh] = a;
      const grid = SHEETS[img.key] || [1, 1];
      const cw = img.width / grid[0];
      const ch = img.height / grid[1];
      const cell = Math.floor((sx + 1) / cw) + grid[0] * Math.floor((sy + 1) / ch);
      // the source rectangle's bottom middle, where it lands on the screen
      const px = dx + dw / 2;
      const py = dy + dh;
      draws.push({
        key: img.key,
        cell,
        k: (dh / sh) * Math.hypot(m[2], m[3]),
        foot: [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]],
      });
    },
  };
  const proxy = new Proxy(ctx, {
    get: (t, p) => (p in t ? t[p] : typeof p === 'string' && /^[a-z]/.test(p) ? () => {} : undefined),
    set: () => true,
  });
  return { ctx: proxy, draws, clear: () => (draws.length = 0) };
}

// What a bird looks like at each of its poses: for each drawn cell of the
// given sheets (and the portrait), the scale it was drawn at times the scale
// it was painted at. `states` are functions that put the game into a pose;
// the game is drawn once per state.
export function shownSizes(game, gameId, states, keys) {
  const table = POSE_SCALES[gameId].cells;
  const rec = recorder();
  const out = {};
  for (const [name, set] of Object.entries(states)) {
    set(game);
    rec.clear();
    game.draw(rec.ctx, 1);
    for (const d of rec.draws) {
      const id = d.key + '#' + d.cell;
      if (!keys.some((k) => d.key === k)) continue;
      const painted = table[id];
      if (painted === undefined) throw new Error(`${gameId}: no painted scale measured for ${id}`);
      (out[name] = out[name] || []).push({ id, k: d.k, shown: d.k * painted, foot: d.foot });
    }
  }
  strip(gameId, out);
  return out;
}

// Every pose of the character shown within `tol` of the reference pose's
// size: returns the failures (empty when all is well) and a table to log.
// `sizes` is from shownSizes(); `ref` names the state whose size counts as 1
// (a state whose only drawing is the portrait or the default pose).
export function sizeCheck(sizes, ref, tol = 0.05) {
  const base = sizes[ref]?.[0]?.shown;
  if (!base) return { fails: [`no drawing in the reference state ${ref}`], table: {} };
  const fails = [];
  const table = {};
  for (const [state, ds] of Object.entries(sizes)) {
    for (const d of ds) {
      const r = d.shown / base;
      table[`${state}: ${d.id}`] = +r.toFixed(3);
      if (Math.abs(r - 1) > tol) fails.push(`${state} (${d.id}) is drawn at ${r.toFixed(3)} of ${ref}`);
    }
  }
  return { fails, table };
}

// The same for drawBird(): how big the bird is shown in each pose, and where
// its feet land (the drawn picture's bottom, less the empty strip below the
// feet in the picture).
export async function birdSizes(id, poses, feetOf) {
  const { drawBird } = await import('../src/draw.js');
  const table = POSE_SCALES[id].cells;
  const out = {};
  for (const [name, pose] of Object.entries(poses)) {
    const rec = recorder();
    drawBird(rec.ctx, id, { x: 0, y: 0, size: 400, t: 0, pose });
    const d = rec.draws.find((e) => table[e.key + '#' + e.cell] !== undefined);
    if (!d) throw new Error(`${id} ${name}: nothing drawn`);
    const idd = d.key + '#' + d.cell;
    out[name] = [{ id: idd, k: d.k, shown: d.k * table[idd], feetY: d.foot[1] - (1 - feetOf[idd]) * d.k * 1024 }];
  }
  strip(id, out);
  return out;
}
