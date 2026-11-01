// Shared constants and drawing helpers for the Renderer modules (see ../render.js).


export const ROMAN = ['', 'I', 'II', 'III'];

export const W = 1280;
export const H = 720;
export const U = 48; // pixels per field unit
export const GROUND = 500;
export const FIELD_TOP = 290; // touch: taps between here and the ground land on the battle
// Small screens (a phone held sideways): below this many CSS pixels per
// logical pixel the HUD text grows to stay legible and the camera moves in
// on the action once it starts.
export const COMPACT = 0.7;
export const ZOOM_BATTLE = 1.45;
export const ZOOM_STORY = 1.2;
export const ZOOM_EYE = 400; // the screen height the zoom's focus is drawn at
export const ARMY_SCREEN_X = 620; // the front rank's place on screen, leaving room behind for the whole drum palanquin
export const STRIP_W = 2560;
// How strongly delivered layers are washed toward each chapter's light.
export const LAYER_TINT = { dawn: 0.35, day: 0.25, night: 0.55, dusk: 0.45, foundry: 0.6, ash: 0.5 };
// The touch layout (phones and tablets): a big drum low in the middle, its
// centre the deep stroke and its rim ring the rim stroke, with the shield and
// reset buttons at the bottom right and pause at the top. Centre at the
// bottom edge so it reads as a drum in front of the player.
export const TOUCH = {
  drum: { x: 640, y: 668, r: 100, centre: 0.66, band: 1.3, reach: 1.42 },
  shield: { x: 1170, y: 628, r: 70 },
  pause: { x: 640, y: 32, r: 24 },
  // Drum Practice: the kit (where the shield drum sits), fewer and more strokes beside the dots.
  kit: { x: 1170, y: 628, r: 62 },
  // ‹ › beside it choose the secondary drum (kept clear of the screen's edge).
  secondPrev: { x: 1094, y: 650, r: 22 },
  secondNext: { x: 1246, y: 650, r: 22 },
  fewer: { x: 236, y: 518, r: 34 },
  more: { x: 1044, y: 518, r: 34 },
};

/** How many beats a pattern spans (its text, or its last stroke's beat). */
export function spanOf(pattern) {
  if (pattern.text) return pattern.text.split(' ').length;
  if (pattern.beats) return pattern.beats;
  const s = pattern.strokes;
  return s.length ? Math.floor(s[s.length - 1].pos) + 1 : 4;
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

let fiberCache = null;
export function fiber() {
  if (!fiberCache) fiberCache = fiberTexture();
  return fiberCache;
}

/**
 * One backlit paper panel. From back to front: the shadow it casts on the
 * panel behind, a halo where light spills round its edge, the sheet itself
 * with paper grain, and light glowing through every knife cut.
 */
export function cutLayer(w, h, color, shape, holes, opts = {}) {
  const shadow = { dx: 7, dy: 9, blur: 7, alpha: 0.35, ...(opts.shadow || {}) };
  const glow = opts.glow || '#F6D9A0';
  const sil = canvas(w, h);
  const s = sil.getContext('2d');
  s.fillStyle = color;
  shape(s);
  // Paper grain, only where there is paper.
  s.save();
  s.globalCompositeOperation = 'source-atop';
  s.globalAlpha = opts.grain ?? 0.1;
  s.fillStyle = s.createPattern(fiber(), 'repeat');
  s.fillRect(0, 0, w, h);
  s.restore();
  let light = null;
  if (holes) {
    s.globalCompositeOperation = 'destination-out';
    holes(s);
    s.globalCompositeOperation = 'source-over';
    light = canvas(w, h);
    const l = light.getContext('2d');
    l.fillStyle = glow;
    holes(l);
  }
  const out = canvas(w, h);
  const o = out.getContext('2d');
  o.save();
  o.globalAlpha = shadow.alpha;
  o.filter = `blur(${shadow.blur}px) brightness(0)`;
  o.drawImage(sil, shadow.dx, shadow.dy);
  o.drawImage(sil, shadow.dx - w, shadow.dy);
  o.restore();
  if (opts.halo !== 0) {
    // Rim light: a soft bright copy just behind the sheet.
    o.save();
    o.globalAlpha = opts.halo ?? 0.35;
    o.filter = 'blur(5px)';
    const tint = canvas(w, h);
    const t = tint.getContext('2d');
    t.drawImage(sil, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = glow;
    t.fillRect(0, 0, w, h);
    o.drawImage(tint, 0, -2);
    o.restore();
  }
  o.drawImage(sil, 0, 0);
  if (light) {
    // The cuts glow, and the glow bleeds a little onto the paper around them.
    o.save();
    o.globalAlpha = opts.cutGlow ?? 0.55;
    o.filter = 'blur(3px)';
    o.drawImage(light, 0, 0);
    o.filter = 'none';
    o.globalAlpha = (opts.cutGlow ?? 0.55) * 0.9;
    o.drawImage(light, 0, 0);
    o.restore();
  }
  return out;
}

/** Light haze between two panels: the lamp's glow, strongest near the horizon. */
export function haze(g, color, top, bottom, alpha) {
  const grad = g.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, color);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(0, top, W, bottom - top);
  g.restore();
}

export function crescent(c, x, y, r, ang) {
  c.beginPath();
  c.arc(x, y, r, ang, ang + Math.PI);
  c.arc(x + Math.cos(ang + Math.PI / 2) * r * 0.35, y + Math.sin(ang + Math.PI / 2) * r * 0.35, r * 0.8, ang + Math.PI, ang, true);
  c.fill();
}

export function leaf(c, x, y, len, ang, wid = 0.28) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.5, -len * wid, len, 0);
  c.quadraticCurveTo(len * 0.5, len * wid, 0, 0);
  c.fill();
  c.restore();
}

export function star(c, x, y, rOut, rIn, n) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
}

export function fiberTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  const r = rng(7);
  const img = g.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + r() * 55;
    img.data[i] = v;
    img.data[i + 1] = v * 0.97;
    img.data[i + 2] = v * 0.9;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(120,100,70,0.18)';
  g.lineWidth = 0.7;
  for (let i = 0; i < 260; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const a = r() * Math.PI * 2;
    const l = 8 + r() * 30;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}
