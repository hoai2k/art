// Trees: a mid-October Stratford street. Each tree gets a species from the
// data's kind and its setting (street boulevard, back yard, park, riverside),
// deterministically by position: silver, sugar and Norway maples, red oak,
// linden, honey locust and ash on the streets, spruce and pine in yards,
// willows only by the water. Species share a few crown forms (instanced: one
// draw per form and level of detail), each a cluster of leaf clumps with gaps
// at the ends of real limbs; colours come per tree from a seasonal spread for
// its species (green, yellow-green, gold, orange, red, russet; some
// half-turned, darker inside and lighter at the top and the outside).
// Trunks and big limbs go into the chunk colliders (bark / branch).
import * as THREE from 'three';
import { SURFACE } from '../surface.js';
import { painted } from './materials.js';
import { rng, hash2, Builder, walk } from './util.js';

// ---------------------------------------------------------------- species
// kind: the coarse kind other code reads (nuts: acorns under oaks; ground leaves)
// form: the crown geometry; leaf: the leaf texture; bark: trunk tint;
// colours: [weight, inner/lower colour, outer/top colour] (mid-October)
export const SPECIES = {
  silver: { kind: 'maple', form: 'vaseMaple', bark: 0xb9b4aa, colours: [
    [3, 0x6f7f3a, 0x8f9640], [3, 0x86883a, 0xb8a440], [2, 0x9c9a3e, 0xcdb44a], [1, 0x6a7c36, 0xc9a13c], [1, 0x5d7334, 0x6c8038]] },
  sugar: { kind: 'maple', form: 'roundMaple', bark: 0x8d8379, colours: [
    [2, 0x6e7c34, 0xc8782c], [3, 0xc0702a, 0xd6952f], [2, 0xc2922e, 0xd8b13e], [2, 0x9c3c26, 0xbd5428], [1, 0xc0782c, 0xa83c26], [1, 0x667a34, 0x8a8a36]] },
  norway: { kind: 'maple', form: 'roundMaple', bark: 0x7f7a72, colours: [
    [5, 0x48622c, 0x566e30], [3, 0x5e7230, 0x93943a], [2, 0x9d963a, 0xc4ae42], [1, 0x56692e, 0xb8a43c]] },
  redoak: { kind: 'oak', form: 'broadOak', bark: 0x6f6a64, colours: [
    [3, 0x744428, 0x92522c], [2, 0x5a6630, 0x8a4f2c], [2, 0x7a3624, 0x934028], [2, 0x4e612e, 0x5e6c34], [1, 0x8a5a2e, 0xa0702e]] },
  linden: { kind: 'linden', form: 'roundLinden', bark: 0x7a7066, colours: [
    [3, 0x748634, 0xa9a03a], [3, 0xa0963a, 0xc8b242], [2, 0x58702e, 0x6c8234], [1, 0xb6a440, 0xd2bc4c]] },
  locust: { kind: 'other', form: 'vaseFine', bark: 0x5e5650, colours: [
    [3, 0xb59e3a, 0xd4ba48], [2, 0x8f9a3e, 0xc6b244], [2, 0x6f863a, 0x86963e], [1, 0xc9ac40, 0xe0c652]] },
  ash: { kind: 'other', form: 'vaseFine', bark: 0x8a8278, colours: [
    [3, 0x56702f, 0x637a34], [2, 0x5e4436, 0x7a4a38], [2, 0xa69c3c, 0xc2ae46], [1, 0x6a5a34, 0x9a9440]] },
  spruce: { kind: 'spruce', form: 'cone', bark: 0x6a5e54, colours: [[3, 0x1e3426, 0x2a4430], [2, 0x23392b, 0x31503a], [1, 0x2c4436, 0x3a5848]] },
  pine: { kind: 'spruce', form: 'pine', bark: 0x8a6a52, colours: [[3, 0x2a4230, 0x3a5636], [1, 0x34482e, 0x4a6238]] },
  willow: { kind: 'willow', form: 'weep', bark: 0x7a7266, colours: [[3, 0x7f9038, 0x9fa640], [2, 0x8e9a40, 0xbab246], [1, 0x6e8636, 0x84963c]] },
};
export const SPECIES_IDS = Object.keys(SPECIES);

// ---------------------------------------------------------------- crown forms
// Reference trees in metres: h tall, crown radius R, trunk radius r0; instances are scaled
// to each tree's height and LiDAR crown. leaf: the leaf texture of the cards.
const FORMS = {
  roundMaple: { h: 12, R: 4.6, r0: 0.25, fork: 2.6, limbs: 6, clumpR: 2.4, cards: 15, leaf: 'maple', shape: 'round', variants: 2 },
  roundLinden: { h: 13, R: 4.2, r0: 0.25, fork: 2.8, limbs: 6, clumpR: 2.3, cards: 15, leaf: 'linden', shape: 'oval', variants: 1 },
  vaseMaple: { h: 14, R: 5.4, r0: 0.32, fork: 2.4, limbs: 5, clumpR: 2.5, cards: 14, leaf: 'maple', shape: 'vase', variants: 2 },
  vaseFine: { h: 12, R: 4.6, r0: 0.22, fork: 2.4, limbs: 5, clumpR: 2.2, cards: 14, leaf: 'fine', shape: 'vase', variants: 1 },
  broadOak: { h: 13, R: 5.6, r0: 0.32, fork: 3.0, limbs: 6, clumpR: 2.5, cards: 14, leaf: 'oak', shape: 'broad', variants: 1 },
  cone: { h: 14, R: 3.0, r0: 0.22, cards: 90, leaf: 'needles', shape: 'cone', variants: 1 },
  pine: { h: 15, R: 3.6, r0: 0.24, fork: 8.5, limbs: 5, clumpR: 1.6, cards: 16, leaf: 'needles', shape: 'pine', variants: 1 },
  weep: { h: 12, R: 6.0, r0: 0.38, fork: 2.4, limbs: 5, cards: 110, leaf: 'willow', shape: 'weep', variants: 1 },
};

// The skeleton of a crown: limbs from the fork to clumps of leaves, with gaps between them.
function skeleton(name, variant) {
  const F = FORMS[name], r = rng(0.173 + name.length * 0.031 + variant * 0.29);
  const clumps = [], limbs = [];
  if (F.shape === 'cone' || F.shape === 'weep') return { clumps, limbs };
  const n = F.limbs + (variant ? 1 : 0);
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.9;
    let out, y, cr;
    if (F.shape === 'vase') { out = F.R * (0.5 + 0.3 * r()); y = F.h * (0.58 + 0.22 * r()); cr = F.clumpR * (0.85 + 0.35 * r()); }
    else if (F.shape === 'broad') { out = F.R * (0.5 + 0.35 * r()); y = F.h * (0.48 + 0.22 * r()); cr = F.clumpR * (0.85 + 0.4 * r()); }
    else if (F.shape === 'pine') { out = F.R * (0.3 + 0.5 * r()); y = F.h * (0.7 + 0.22 * r()); cr = F.clumpR * (0.8 + 0.5 * r()); }
    else { out = F.R * (0.4 + 0.3 * r()); y = F.h * (0.42 + 0.32 * r()) + (F.shape === 'oval' ? 0.6 : 0); cr = F.clumpR * (0.8 + 0.4 * r()); }
    const c = [Math.cos(a) * out, y, Math.sin(a) * out];
    clumps.push({ c, r: cr, sq: F.shape === 'broad' ? 0.62 : F.shape === 'pine' ? 0.5 : 0.78 });
    const fy = F.fork + (r() - 0.3) * 0.8;
    const from = [0, fy, 0];
    const bend = F.shape === 'broad' ? 0.62 : F.shape === 'vase' ? 0.35 : 0.45;
    const mid = [c[0] * bend, fy + (y - fy) * (F.shape === 'broad' ? 0.3 : 0.55), c[2] * bend];
    limbs.push({ from, mid, to: [c[0] * 0.92, y - cr * 0.25, c[2] * 0.92], r: F.r0 * (0.55 - 0.04 * i / n) });
    // a second, smaller clump part-way along some limbs
    if (F.shape !== 'pine' && r() < 0.55) clumps.push({ c: [mid[0] * 1.25 + (r() - 0.5), mid[1] + 1.2 + r() * 1.2, mid[2] * 1.25 + (r() - 0.5)], r: cr * 0.6, sq: 0.75 });
  }
  // the leader's crown at the top
  if (F.shape === 'round' || F.shape === 'oval') clumps.push({ c: [(r() - 0.5) * 0.8, F.h - F.clumpR * 0.9, (r() - 0.5) * 0.8], r: F.clumpR * 1.05, sq: 0.8 });
  if (F.shape === 'vase') clumps.push({ c: [(r() - 0.5) * 1.5, F.h - F.clumpR * 1.1, (r() - 0.5) * 1.5], r: F.clumpR * 0.75, sq: 0.7 });
  if (F.shape === 'pine') clumps.push({ c: [0, F.h - 1.0, 0], r: 1.3, sq: 0.7 });
  return { clumps, limbs };
}
const SKEL = {};
const skel = (name, v) => (SKEL[name + v] ||= skeleton(name, v));

// ---------------------------------------------------------------- leaf textures
// Grey leaf sprites (the painted sprites with their colour taken out, or drawn here):
// the tree's colours come per instance. Mean leaf brightness is normalised to 0.75.
function greySprite(src) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); g.drawImage(src, 0, 0, S, S);
  const id = g.getImageData(0, 0, S, S), d = id.data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2]; n++; }
  const k = n ? (0.75 * 255) / (sum / n) : 1;
  for (let i = 0; i < d.length; i += 4) {
    // twigs (dark, unsaturated) stay darker than leaves
    const l = (0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2]) * k;
    const v = Math.max(0, Math.min(255, 0.25 * 255 * 0.75 + (l - 0.25 * 255 * 0.75) * 0.8));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(id, 0, 0);
  return cv;
}
function drawnLeaves(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const r = rng(kind.length * 0.137 + 0.3);
  const leaf = (x, y, s, a, shade) => {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    const l = Math.round(150 + shade * 105);
    g.fillStyle = `rgb(${l},${l},${l})`;
    g.beginPath();
    if (kind === 'needles') g.rect(-0.6, -9, 1.2, 18);
    else if (kind === 'willow') g.ellipse(0, 0, 1.6, 9, 0, 0, Math.PI * 2);
    else if (kind === 'fine') g.ellipse(0, 0, 1.5, 3.2, 0, 0, Math.PI * 2);
    else if (kind === 'oak') { for (let k = 0; k < 7; k++) g.ellipse(0, -6 + k * 2, 3.2 - Math.abs(k - 3) * 0.5, 1.6, 0, 0, Math.PI * 2); }
    else if (kind === 'linden') { g.moveTo(0, -6); g.bezierCurveTo(6, -5, 6, 3, 0, 6); g.bezierCurveTo(-6, 3, -6, -5, 0, -6); }
    else { for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2; const rr = k % 2 ? 2.6 : 6.5; const px = Math.cos(t) * rr, py = Math.sin(t) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); } }
    g.fill();
    g.restore();
  };
  if (kind === 'willow') {
    for (let s = 0; s < 14; s++) {
      const x = 10 + r() * (S - 20);
      g.strokeStyle = 'rgb(120,120,120)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 20, S); g.stroke();
      for (let y = 0; y < S; y += 7) leaf(x + (r() - 0.5) * 8 + (y / S) * 6, y + r() * 4, 1.0, (r() - 0.5) * 0.8, r());
    }
  } else if (kind === 'needles') {
    for (let b = 0; b < 9; b++) {
      const y = 20 + r() * (S - 40), x0 = 10 + r() * 40, x1 = S - 10 - r() * 40;
      g.strokeStyle = 'rgb(110,100,90)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + (r() - 0.5) * 20); g.stroke();
      for (let x = x0; x < x1; x += 3) { leaf(x, y + (r() - 0.5) * 6, 1, 0.7 + (r() - 0.5) * 0.4, r()); leaf(x, y + (r() - 0.5) * 6, 1, -0.7 + (r() - 0.5) * 0.4, r()); }
    }
  } else if (kind === 'fine') {
    // pinnate leaves (honey locust, ash): many small leaflets along thin stalks, airy
    for (let s = 0; s < 16; s++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.3, x0 = S / 2 + Math.cos(a) * d, y0 = S / 2 + Math.sin(a) * d;
      const b = r() * Math.PI * 2, L = 40 + r() * 40;
      g.strokeStyle = 'rgb(120,115,100)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(b) * L, y0 + Math.sin(b) * L); g.stroke();
      for (let t = 0.1; t < 1; t += 0.11) for (const sd of [-1, 1]) leaf(x0 + Math.cos(b) * L * t + Math.cos(b + sd * 1.3) * 4, y0 + Math.sin(b) * L * t + Math.sin(b + sd * 1.3) * 4, 1.2 + r() * 0.4, b + sd * 1.3 + Math.PI / 2, r());
    }
  } else {
    g.strokeStyle = 'rgb(100,95,90)'; g.lineWidth = 2;
    for (let t = 0; t < 6; t++) { g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + (r() - 0.5) * S * 0.8, S / 2 + (r() - 0.5) * S * 0.8); g.stroke(); }
    for (let i = 0; i < 110; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.43;
      leaf(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 1.3 + r() * 1.1, r() * 6.28, r());
    }
  }
  return cv;
}
const SPRITE_OF = { maple: 'maple', oak: 'oak', needles: 'spruce', willow: 'willow', linden: 'linden', fine: 'fine' };
function leafTexture(kind, assets) {
  const sp = assets && assets.sprites && assets.sprites[SPRITE_OF[kind]];
  const cv = sp && sp.image ? greySprite(sp.image) : drawnLeaves(kind);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- geometry
// One leaf card: centre p, facing roughly `nrm`, size w x h; attributes: shade, gradient position, phase.
function card(b, r, p, nrm, w, h, shade, grad, roll = null) {
  let fx = nrm[0] + (r() - 0.5) * 0.8, fy = nrm[1] * 0.6 + (r() - 0.5) * 0.6, fz = nrm[2] + (r() - 0.5) * 0.8;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let tx = -fz, tz = fx; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const bx = fy * tz, by = fz * tx - fx * tz, bz = -fy * tx;
  const rl = roll ?? r() * Math.PI * 2, cr = Math.cos(rl), sr = Math.sin(rl);
  const ax = [tx * cr + bx * sr, by * sr, tz * cr + bz * sr];
  const ay = [-tx * sr + bx * cr, by * cr, -tz * sr + bz * cr];
  b.set('color', [shade, shade, shade]).set('aCard', [r()]).set('aGrad', [grad]);
  const ids = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([sx, sy, u, v]) => b.v(
    p[0] + ax[0] * sx * w / 2 + ay[0] * sy * h / 2, p[1] + ax[1] * sx * w / 2 + ay[1] * sy * h / 2, p[2] + ax[2] * sx * w / 2 + ay[2] * sy * h / 2, nrm[0], nrm[1], nrm[2], u, v));
  b.quad(ids[0], ids[1], ids[2], ids[3]);
}

// Canopy: leaf cards in clumps; lod 0 near, 1 far (a few big cards per clump).
function canopyGeometry(name, variant, lod) {
  const F = FORMS[name], r = rng(0.71 + name.length * 0.013 + variant * 0.17 + lod * 0.3);
  const b = new Builder({ color: 3, aCard: 1, aGrad: 1 });
  const top = F.h;
  if (F.shape === 'cone') {
    const n = lod ? 34 : F.cards, size = lod ? 2.6 : 1.5;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(r(), 0.8), y = 1.0 + t * (F.h - 1.4), rad = (1 - t) * F.R * (0.55 + 0.45 * Math.sqrt(r())), a = r() * Math.PI * 2;
      const p = [Math.cos(a) * rad, y, Math.sin(a) * rad], o = Math.hypot(p[0], p[2]) || 1;
      card(b, r, p, [p[0] / o, 0.15, p[2] / o], size * (1.2 - t * 0.6), size * (1.2 - t * 0.6) * 0.8, 0.8 + 0.3 * r(), Math.min(1, t * 0.6 + rad / F.R * 0.4));
    }
    return b.geometry();
  }
  if (F.shape === 'weep') {
    const n = lod ? 30 : F.cards;
    for (let i = 0; i < n; i++) {
      const rad = Math.sqrt(r()) * F.R, ang = r() * Math.PI * 2;
      const px = Math.cos(ang) * rad, pz = Math.sin(ang) * rad;
      let py = F.h - 0.6 - (rad / F.R) ** 2 * 3.0;
      const strand = i % 5 !== 0;
      let w = lod ? 3.4 : 2.0, h = w;
      if (strand) { h = (lod ? 6 : 4.2) * (0.7 + 0.6 * r()); w = lod ? 2.6 : 1.5; py -= h * 0.45; }
      const o = Math.hypot(px, pz) || 1;
      card(b, r, [px, py, pz], [px / o, 0.2, pz / o], w, h, 0.8 + 0.3 * r(), Math.min(1, rad / F.R), strand ? 0 : null);
    }
    return b.geometry();
  }
  const S = skel(name, variant);
  for (const C of S.clumps) {
    const n = lod ? Math.max(3, Math.round(C.r * 1.6)) : Math.round(F.cards * (C.r / F.clumpR) ** 1.5);
    const size = lod ? C.r * 1.25 : Math.min(2.1, 0.75 + C.r * 0.5);
    for (let i = 0; i < n; i++) {
      // points in the clump, biased to its surface, a little denser on top
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = lod ? 0.45 + 0.25 * r() : 0.35 + 0.65 * Math.cbrt(r());
      const p = [C.c[0] + Math.cos(a) * s * rr * C.r, C.c[1] + (u * 0.9 + 0.1) * rr * C.r * C.sq, C.c[2] + Math.sin(a) * s * rr * C.r];
      // the card faces out from the clump and the crown
      const ox = p[0] - C.c[0] + p[0] * 0.25, oy = p[1] - C.c[1] + 0.4, oz = p[2] - C.c[2] + p[2] * 0.25;
      const ol = Math.hypot(ox, oy, oz) || 1;
      const out = Math.min(1, Math.hypot(p[0], p[2]) / F.R), up = Math.max(0, Math.min(1, (p[1] - F.fork) / (top - F.fork)));
      // the gradient position: top and outside turn first
      const grad = Math.max(0, Math.min(1, 0.55 * up + 0.45 * out + (rr - 0.6) * 0.5 + (r() - 0.5) * 0.25));
      // darker deep in the clump, lit at its surface (but never black: light comes through the gaps)
      const shade = (0.74 + 0.3 * rr) * (0.9 + 0.2 * r());
      card(b, r, p, [ox / ol, oy / ol, oz / ol], size * (0.8 + 0.4 * r()), size * (0.8 + 0.4 * r()), shade, grad);
    }
  }
  return b.geometry();
}

// Trunk and limbs (near) or a plain trunk with stubs (far); collider parts collected from the near trunk.
function trunkGeometry(name, variant, lod, collect = null) {
  const F = FORMS[name], r = rng(0.37 + name.length * 0.013 + variant * 0.07);
  const b = new Builder({ color: 3 });
  const seg = lod ? 4 : 7;
  const tube = (p0, p1, r0, r1, n = seg, coll = false) => {
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const L = Math.hypot(...d); if (L < 1e-3) return;
    const up = Math.abs(d[1] / L) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const sl = Math.hypot(...s); s = s.map((v) => v / sl);
    let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map((v) => v / tl);
    const ring = (c, rad, v) => { const ids = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const nx = s[0] * Math.cos(a) + t[0] * Math.sin(a), ny = s[1] * Math.cos(a) + t[1] * Math.sin(a), nz = s[2] * Math.cos(a) + t[2] * Math.sin(a); ids.push(b.v(c[0] + nx * rad, c[1] + ny * rad, c[2] + nz * rad, nx, ny, nz, (i / n) * rad * 6.28, v)); } return ids; };
    b.set('color', [1, 1, 1]);
    const A = ring(p0, r0, p0[1]), B = ring(p1, r1, p1[1]);
    for (let i = 0; i < n; i++) b.quad(A[i], A[i + 1], B[i + 1], B[i]);
    if (coll && collect) collect.push({ p0, p1, r0, r1 });
  };
  if (F.shape === 'cone') {
    tube([0, -0.3, 0], [0, F.h * 0.92, 0], F.r0, 0.04, seg, true);
    if (!lod) for (let k = 0; k < 10; k++) { const y = 1.2 + k * (F.h * 0.7 / 10), a = r() * 6.28, L = (1 - y / F.h) * F.R * 0.8; tube([0, y, 0], [Math.cos(a) * L, y - 0.3, Math.sin(a) * L], 0.05, 0.015, 4, k < 4); }
    return b.geometry();
  }
  if (F.shape === 'weep') {
    tube([0, -0.4, 0], [0, F.fork, 0], F.r0, F.r0 * 0.75, seg, true);
    if (!lod) tube([0, -0.1, 0], [0, 0.5, 0], F.r0 * 1.45, F.r0, seg);
    if (lod) { tube([0, F.fork, 0], [0, F.h * 0.75, 0], F.r0 * 0.72, 0.06, seg); return b.geometry(); }
    for (let i = 0; i < F.limbs; i++) {
      const a = (i / F.limbs) * Math.PI * 2 + r() * 0.8, out = F.R * (0.4 + 0.3 * r());
      const mid = [Math.cos(a) * out * 0.45, F.fork + (F.h - 2.5 - F.fork) * 0.5, Math.sin(a) * out * 0.45], end = [Math.cos(a) * out, F.h - 1.5, Math.sin(a) * out];
      tube([0, F.fork, 0], mid, F.r0 * 0.55, F.r0 * 0.4, 6, true); tube(mid, end, F.r0 * 0.4, 0.05, 5, i < 3);
    }
    return b.geometry();
  }
  const S = skel(name, variant);
  const forkTop = F.shape === 'pine' ? F.h * 0.82 : F.fork;
  tube([0, -0.4, 0], [0, forkTop, 0], F.r0, F.r0 * (F.shape === 'pine' ? 0.5 : 0.75), seg, true);
  if (!lod) tube([0, -0.1, 0], [0, 0.5, 0], F.r0 * 1.45, F.r0, seg);     // root flare
  if (lod) return b.geometry();          // far: the trunk alone
  S.limbs.forEach((L, i) => {
    tube(L.from, L.mid, L.r, L.r * 0.72, 6, true);
    tube(L.mid, L.to, L.r * 0.72, L.r * 0.3, 5, i < 4);
    // branches into the clump and out of it: they show through the gaps
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2, e = 1.2 + r() * 1.4;
      tube(L.to, [L.to[0] + Math.cos(a) * e, L.to[1] + 0.4 + r() * 1.2, L.to[2] + Math.sin(a) * e], L.r * 0.22, 0.02, 4);
    }
    const s0 = [(L.mid[0] + L.to[0]) / 2, (L.mid[1] + L.to[1]) / 2, (L.mid[2] + L.to[2]) / 2], a2 = r() * Math.PI * 2;
    tube(s0, [s0[0] + Math.cos(a2) * 1.6, s0[1] + 1.0 + r(), s0[2] + Math.sin(a2) * 1.6], L.r * 0.3, 0.025, 4);
  });
  // a leader into the top clump
  if (F.shape !== 'broad') tube([0, forkTop, 0], [0, F.h * 0.86, 0], F.r0 * 0.45, 0.04, 6);
  return b.geometry();
}

export function barkMaterial(shared, assets) {
  const has = assets && assets.tex.bark;
  const defines = {}, uniforms = {};
  for (const k of ['bark', 'bark_cu', 'moss']) if (assets && assets.tex[k]) { defines['TEX_' + k.toUpperCase()] = ''; uniforms['t_' + k] = { value: assets.tex[k].texture }; uniforms['s_' + k] = { value: 1 / assets.tex[k].size }; }
  void has;
  return painted({ color: 0xffffff, vertexColors: true }, {
    shared, key: 'town-bark', defines, uniforms,
    vertHead: 'varying vec2 vBarkUv;', vertMain: 'vBarkUv = uv;',
    vertBegin: SWAY_TRUNK,
    fragHead: `#ifdef TEX_BARK
uniform sampler2D t_bark; uniform float s_bark;
#endif
#ifdef TEX_BARK_CU
uniform sampler2D t_bark_cu; uniform float s_bark_cu;
#endif
#ifdef TEX_MOSS
uniform sampler2D t_moss; uniform float s_moss;
#endif
uniform float uScale;
varying vec2 vBarkUv;`,
    color: `
      #ifdef TEX_BARK
      { vec3 c = texture2D(t_bark, vBarkUv * vec2(1.0, 0.5) * s_bark).rgb;
        float px = max(length(fwidth(vBarkUv)), 1e-4);
        #ifdef TEX_BARK_CU
        // close-up bark when the creature is small enough to read it
        float w = (1.0 - smoothstep(0.8, 2.5, px * 1024.0 / 0.3)) * clamp((0.07 - uScale) / 0.05, 0.15, 1.0);
        if (w > 0.002) c = mix(c, texture2D(t_bark_cu, vBarkUv * vec2(1.0, 0.5) * s_bark_cu).rgb, w * 0.9);
        #endif
        #ifdef TEX_MOSS
        // moss low on the shady (north, -z) side of the trunk
        float m = smoothstep(1.2, 0.2, vBarkUv.y) * smoothstep(0.1, 0.7, -vWN.z) * smoothstep(0.35, 0.6, tnoise(vBarkUv * vec2(3.0, 2.0)));
        if (m > 0.0) c = mix(c, texture2D(t_moss, vBarkUv * s_moss).rgb, m * 0.85);
        #endif
        diffuseColor.rgb *= c; }
      #else
      { vec2 q = vBarkUv * vec2(2.2, 0.55);
        float f = tnoise(vec2(q.x * 2.0, q.y * 0.6)) * 0.6 + tnoise(q * vec2(5.0, 1.2)) * 0.4;
        float px = max(length(fwidth(vBarkUv)), 1e-4);
        vec3 c = mix(vec3(0.24, 0.21, 0.19), vec3(0.47, 0.44, 0.40), smoothstep(0.3, 0.7, f));
        c = mix(vec3(0.38, 0.35, 0.31), c, aafade(2.0, px));
        // a little green moss low on the trunk
        c = mix(c, vec3(0.32, 0.38, 0.20), smoothstep(1.2, 0.0, vWP.y - vBarkUv.y + vBarkUv.y * 0.0) * 0.0);
        diffuseColor.rgb *= c; }
      #endif`,
  });
}
const SWAY_TRUNK = /* glsl */`
#ifdef USE_INSTANCING
{ vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.37 + ip.z * 0.23;
  float k = max(0.0, transformed.y - 3.0) / 12.0; k *= k;
  transformed.x += sin(uTime * 0.9 + ph) * 0.12 * k * uWind; transformed.z += cos(uTime * 0.7 + ph) * 0.08 * k * uWind; }
#endif
`;
export function leafMaterial(shared, tex) {
  return painted({ color: 0xffffff, vertexColors: true, map: tex, alphaTest: 0.45, side: THREE.DoubleSide }, {
    shared, key: 'town-leaf2',
    vertHead: 'attribute float aCard; attribute float aGrad; attribute vec3 aCol2;',
    vertBegin: SWAY_TRUNK + /* glsl */`
      { float ph = aCard * 6.28 + position.x * 0.3;
        transformed += vec3(sin(uTime * 2.3 + ph), sin(uTime * 1.9 + ph * 1.3) * 0.6, cos(uTime * 2.1 + ph)) * 0.06 * uWind; }`,
    // the tree's two colours: inside and low (aGrad 0) to the top and outside (aGrad 1)
    vertMain: `
      #if defined(USE_COLOR) && defined(USE_INSTANCING_COLOR)
      vColor.rgb = mix(vColor.rgb, color.rgb * aCol2, smoothstep(0.2, 0.8, aGrad));
      #endif`,
    // the grey leaves carry brightness 0.75 on average; soft painted light over the crown
    color: 'diffuseColor.rgb *= 1.33 * (0.92 + 0.16 * tnoise(vWP.xz * 0.4 + vWP.y));',
  });
}

// ---------------------------------------------------------------- settings and species
// Where a tree stands: 'river' (open water within ~20 m), 'street' (on or by a boulevard),
// 'park', or 'yard'.
export function treeSetting(ctx, t) {
  const hf = ctx.hf;
  if (hf.waterAt) for (const d of [8, 18]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (hf.waterAt(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d) !== null) return 'river'; }
  if (t.grate) return 'street';
  const q = ctx.streets && ctx.streets.grid.nearest(t.x, t.z, 30);
  if (q && q.seg.data && q.d - q.seg.data.hw < (q.seg.data.band || 4) + 1.5) return 'street';
  if (ctx.inPark && ctx.inPark(t.x, t.z)) return 'park';
  return 'yard';
}
const pick = (table, u) => { let s = 0; for (const [, w] of table) s += w; let x = u * s; for (const [k, w] of table) { x -= w; if (x <= 0) return k; } return table[table.length - 1][0]; };
const BY = {
  maple: { street: [['silver', 3], ['norway', 4], ['sugar', 3]], yard: [['sugar', 4], ['silver', 3], ['norway', 3]], park: [['sugar', 5], ['silver', 3], ['norway', 2]], river: [['silver', 7], ['sugar', 2], ['norway', 1]] },
  other: { street: [['locust', 4], ['ash', 2], ['norway', 2], ['linden', 2]], yard: [['norway', 2], ['ash', 2], ['locust', 1], ['sugar', 2], ['silver', 2], ['spruce', 2], ['pine', 1]],
    park: [['ash', 2], ['locust', 2], ['sugar', 2], ['silver', 2], ['redoak', 1], ['pine', 1]], river: [['willow', 4], ['silver', 4], ['ash', 2]] },
  oak: { street: [['redoak', 1]], yard: [['redoak', 1]], park: [['redoak', 1]], river: [['redoak', 1]] },
  linden: { street: [['linden', 1]], yard: [['linden', 1]], park: [['linden', 1]], river: [['linden', 1]] },
  spruce: { street: [['spruce', 1]], yard: [['spruce', 7], ['pine', 3]], park: [['spruce', 6], ['pine', 4]], river: [['spruce', 6], ['pine', 4]] },
  willow: { street: [['silver', 1]], yard: [['silver', 3], ['norway', 1]], park: [['silver', 1]], river: [['willow', 1]] },
};
// Species, setting and colours for every tree (deterministic by position). The data's
// kind is kept as the coarse kind, except where the species says otherwise (a pine is
// a conifer, a willow away from water becomes a silver maple).
export function assignSpecies(ctx) {
  for (const t of ctx.trees) {
    const setting = treeSetting(ctx, t);
    const table = (BY[t.kind] || BY.other)[setting];
    // small trees on the boulevards are the young replacements (locust, linden, Norway maple)
    let sp = pick(table, hash2(t.x * 1.7 + 3.1, t.z * 0.9 - 7.3));
    if (setting === 'street' && t.height < 8 && (t.kind === 'maple' || t.kind === 'other') && hash2(t.z, t.x * 2.3) < 0.6) sp = ['locust', 'linden', 'norway'][Math.floor(hash2(t.x, t.z * 3.1) * 3)];
    const S = SPECIES[sp];
    t.setting = setting; t.species = sp; t.kind = S.kind;
    const u = hash2(t.z * 1.3 - 11.7, t.x * 0.7 + 5.9);
    let s = 0; for (const c of S.colours) s += c[0];
    let x = u * s, col = S.colours[0];
    for (const c of S.colours) { x -= c[0]; if (x <= 0) { col = c; break; } }
    // per-tree variation in brightness and warmth
    const v = 0.9 + 0.2 * hash2(t.x * 3.7, t.z * 2.9), w = (hash2(t.x * 0.37, t.z * 5.1) - 0.5) * 0.08;
    const vary = (hex) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * (v + w)); c.g = Math.min(1, c.g * v); c.b = Math.min(1, c.b * (v - w)); return c.getHex(); };
    t.colIn = vary(col[1]); t.colOut = vary(col[2]);
  }
}

export function createTrees(ctx, shared, assets) {
  const group = new THREE.Group(); group.name = 'trees';
  const trees = ctx.trees;
  if (trees.length && !trees[0].species) assignSpecies(ctx);
  const bark = barkMaterial(shared, assets);
  const farTrunk = new THREE.InstancedMesh(trunkGeometry('roundMaple', 0, 1), bark, trees.length);
  farTrunk.name = 'far trunks';
  farTrunk.count = 0; farTrunk.castShadow = false; farTrunk.frustumCulled = false; farTrunk.visible = false; group.add(farTrunk);
  farTrunk.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(trees.length * 3), 3);
  // per tree: its form, variant and scale
  for (const t of trees) {
    const S = SPECIES[t.species] || SPECIES.norway, F = FORMS[S.form];
    t._form = S.form; t._var = F.variants > 1 ? Math.floor(hash2(t.x * 2.1, t.z * 1.9) * F.variants) : 0;
    const sy = t.height / F.h;
    const crownR = t.crown / 2;            // the data's crown is a diameter (LiDAR crown area)
    const R = F.shape === 'cone' ? Math.min(0.3, Math.max(0.17, crownR / t.height)) * t.height
      : Math.min(0.62 * t.height, Math.max(0.25 * t.height, crownR));
    t._sy = sy; t._sxz = Math.min(1.5 * sy, Math.max(0.6 * sy, R / F.R)); t._yaw = hash2(t.x, t.z) * Math.PI * 2;
    t._bark = new THREE.Color(S.bark).lerp(new THREE.Color(0xffffff), 0.35).getHex();
  }
  const leafTex = {}, leafMats = {};
  const leafMat = (kind) => {
    if (!leafMats[kind]) { leafTex[kind] = leafTexture(kind, assets); leafTex[kind].colorSpace = THREE.NoColorSpace; leafMats[kind] = leafMaterial(shared, leafTex[kind]); }
    return leafMats[kind];
  };
  const kinds = {}, collParts = {};
  for (const name in FORMS) for (let v = 0; v < FORMS[name].variants; v++) {
    const n = trees.filter((t) => t._form === name && t._var === v).length;
    if (!n) continue;
    const key = name + v, leaf = leafMat(FORMS[name].leaf);
    collParts[key] = []; trunkGeometry(name, v, 0, collParts[key]);
    const near = new THREE.InstancedMesh(canopyGeometry(name, v, 0), leaf, n);
    const far = new THREE.InstancedMesh(canopyGeometry(name, v, 1), leaf, n);
    const trunk = new THREE.InstancedMesh(trunkGeometry(name, v, 0), bark, n);
    for (const m of [near, far, trunk]) { m.count = 0; m.frustumCulled = false; m.visible = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); group.add(m); }
    for (const m of [near, far]) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); m.geometry.setAttribute('aCol2', a); m.userData.col2 = a; }
    near.castShadow = true; trunk.castShadow = true; trunk.receiveShadow = true; near.receiveShadow = true; far.castShadow = false;
    near.name = far.name = `leaves ${key}`; trunk.name = `trunks ${key}`;
    kinds[key] = { near, far, trunk, leaf, n };
  }
  let lastFocus = null, lastR = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _Y = new THREE.Vector3(0, 1, 0);
  const put = (m, i, hexIn, hexOut) => {
    m.setMatrixAt(i, _m);
    m.setColorAt(i, _c.setHex(hexIn));
    if (hexOut != null && m.userData.col2) { _c.setHex(hexOut); m.userData.col2.setXYZ(i, _c.r, _c.g, _c.b); }
  };
  const update = (focus, nearR, farR) => {
    if (lastFocus && lastFocus.distanceToSquared(focus) < 36 && nearR === lastR) return;
    lastFocus = (lastFocus || new THREE.Vector3()).copy(focus); lastR = nearR;
    const counts = {};
    for (const k in kinds) counts[k] = { near: 0, far: 0, trunk: 0 };
    let farT = 0;
    const n2 = nearR * nearR, f2 = farR * farR;
    for (const t of trees) {
      const dx = t.x - focus.x, dz = t.z - focus.z, d2 = dx * dx + dz * dz;
      if (d2 > f2) continue;
      const key = t._form + t._var, K = kinds[key]; if (!K) continue;
      _q.setFromAxisAngle(_Y, t._yaw);
      _s.set(t._sxz, t._sy, t._sxz);
      _m.compose(_p.set(t.x, t.y, t.z), _q, _s);
      const c = counts[key];
      if (d2 < n2) {
        put(K.near, c.near++, t.colIn, t.colOut);
        put(K.trunk, c.trunk++, t._bark);
      } else {
        put(K.far, c.far++, t.colIn, t.colOut);
        if (d2 < f2 * 0.12) put(farTrunk, farT++, t._bark);
      }
    }
    for (const k in kinds) {
      const K = kinds[k], c = counts[k];
      K.near.count = c.near; K.far.count = c.far; K.trunk.count = c.trunk;
      for (const m of [K.near, K.far, K.trunk]) {
        m.visible = m.count > 0;
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; if (m.userData.col2) m.userData.col2.needsUpdate = true;
      }
    }
    farTrunk.count = farT; farTrunk.visible = farT > 0; farTrunk.instanceMatrix.needsUpdate = true; farTrunk.instanceColor.needsUpdate = true;
  };
  // collider: trunk + main limbs of each tree (called per chunk)
  const addColliders = (list, cb, ox, oz) => {
    for (const t of list) {
      const parts = collParts[t._form + t._var]; if (!parts) continue;
      const c = Math.cos(t._yaw), s = Math.sin(t._yaw), k = (t._sxz + t._sy) / 2;
      const W = (p) => [t.x - ox + (p[0] * c + p[2] * s) * t._sxz, t.y + p[1] * t._sy, t.z - oz + (-p[0] * s + p[2] * c) * t._sxz];
      parts.forEach((p, i) => {
        const a = W(p.p0), b = W(p.p1);
        prismBetween(cb, a, b, Math.max(0.05, p.r0 * k), Math.max(0.04, p.r1 * k), i === 0 ? 7 : 5, i === 0 ? SURFACE.bark : SURFACE.branch);
      });
    }
  };
  const dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    bark.dispose(); for (const k in leafMats) { leafTex[k].dispose(); leafMats[k].dispose(); }
  };
  return { group, update, addColliders, dispose, kinds };
}

// prism between two points (collider)
export function prismBetween(cb, a, b, r0, r1, n, surf) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d); if (L < 1e-3) return;
  const up = Math.abs(d[1] / L) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const sl = Math.hypot(...s); s = s.map((v) => v / sl);
  let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map((v) => v / tl);
  const P = (c, r, i) => { const ang = (i / n) * Math.PI * 2; return [c[0] + (s[0] * Math.cos(ang) + t[0] * Math.sin(ang)) * r, c[1] + (s[1] * Math.cos(ang) + t[1] * Math.sin(ang)) * r, c[2] + (s[2] * Math.cos(ang) + t[2] * Math.sin(ang)) * r]; };
  for (let i = 0; i < n; i++) cb.quad(P(a, r0, i), P(a, r0, i + 1), P(b, r1, i + 1), P(b, r1, i), surf);
}

// Fill-in: when the data's trees are uniform placeholders (all one height),
// vary heights so the canopy reads natural.
const DATA_KINDS = new Set(['maple', 'oak', 'linden', 'other', 'spruce', 'willow']);
export function prepareTrees(data, hf) {
  const trees = data.trees.map((t) => ({ ...t }));
  const hs = new Set(trees.slice(0, 200).map((t) => t.height));
  const uniform = trees.length > 20 && hs.size <= 2;
  for (const t of trees) {
    if (!DATA_KINDS.has(t.kind)) t.kind = 'other';
    if (uniform) {
      const h = hash2(t.x, t.z);
      t.height *= 0.75 + h * 0.6; t.crown *= 0.8 + hash2(t.z, t.x) * 0.45;
    }
    t.y = hf.at(t.x, t.z);
  }
  return trees;
}

// Downtown street trees (the street photos show small trees in grates along the
// shopfronts; the map has few): one between each pair of lamps (props.js puts the
// lamps every 21 m, 0.65 m in from the curb), in the paved strip by the curb.
export function addStreetTrees(ctx) {
  const { streets, hf } = ctx, out = [];
  const near = (x, z, r) => ctx.trees.some((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r && Math.hypot(t.x - x, t.z - z) < r) || out.some((t) => Math.hypot(t.x - x, t.z - z) < r);
  for (const s of streets.roads) {
    if (!s.downtown || s.road.bridge) continue;
    const hw = s.hw;
    for (const side of [-1, 1]) {
      walk(s.road.points, 21, (x, z, dx, dz) => {
        const nx = -dz * side, nz = dx * side, px = x + nx * (hw + 0.85), pz = z + nz * (hw + 0.85);
        if (hash2(px, pz) < 0.3) return;
        if (streets.jgrid.any(x, z, 40, (J) => Math.hypot(J.p[0] - x, J.p[1] - z) < J.r + 6)) return;
        if (ctx.markingGrid.any(px, pz, 4)) return;
        // clear of every carriageway (at a bend the offset from one segment can land in the next)
        const q = streets.grid.nearest(px, pz, 30); if (q && q.d < q.seg.data.hw + 0.55) return;
        for (const o of [[0, 0], [nx * 1.6, nz * 1.6], [nx * 3, nz * 3]]) if (ctx.buildingAt(px + o[0], pz + o[1])) return;
        if (near(px, pz, 6)) return;
        const h = hash2(pz, px);
        out.push({ x: px, z: pz, kind: h < 0.6 ? 'linden' : 'other', height: 6.5 + h * 3, crown: 4.4 + h * 2, y: hf.at(px, pz), grate: true });
      }, side > 0 ? 16.5 : 26.5);
    }
  }
  ctx.trees.push(...out);
  return out.length;
}
