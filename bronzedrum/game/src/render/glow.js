// The backlit glow (Renderer.backlit) is a canvas shadow: a blur the browser
// works out afresh for every figure it is drawn behind, every frame, the
// costliest thing in a battle frame. Instead each image is drawn once with
// its glow into a copy at the size it is shown, and the copy is drawn from
// then on with the shadow off. Shadow blur and offsets are in device pixels
// whatever the transform, so the copy is made at device resolution and looks
// the same. Copies are kept per image, size and glow, the oldest dropped past
// a limit (zooming makes new sizes).

const byImg = new WeakMap();
const order = [];
const LIMIT = 320;

/**
 * If a shadow is set on g, the image (drawn w x h in the current transform)
 * with that shadow baked in: { c, pad, scale } (pad in drawing units, c drawn
 * at c.width / scale); else null.
 */
export function bakedGlow(g, img, w, h) {
  if (!(g.shadowBlur > 0) || g.shadowColor === 'rgba(0, 0, 0, 0)') return null;
  const m = g.getTransform();
  const scale = Math.max(0.2, Math.round(Math.hypot(m.a, m.b) * 10) / 10);
  const blur = g.shadowBlur;
  const key = `${Math.round(w)}x${Math.round(h)}|${scale}|${g.shadowColor}|${blur}|${g.shadowOffsetX}|${g.shadowOffsetY}`;
  let forImg = byImg.get(img);
  if (!forImg) byImg.set(img, (forImg = new Map()));
  let entry = forImg.get(key);
  if (!entry) {
    const P = Math.ceil(blur * 1.6 + Math.abs(g.shadowOffsetX) + Math.abs(g.shadowOffsetY)) + 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale) + 2 * P;
    c.height = Math.ceil(h * scale) + 2 * P;
    const k = c.getContext('2d');
    k.shadowColor = g.shadowColor;
    k.shadowBlur = blur;
    k.shadowOffsetX = g.shadowOffsetX;
    k.shadowOffsetY = g.shadowOffsetY;
    k.drawImage(img, P, P, w * scale, h * scale);
    entry = { c, pad: P / scale, scale };
    forImg.set(key, entry);
    order.push([forImg, key]);
    if (order.length > LIMIT) {
      const [map, old] = order.shift();
      map.delete(old);
    }
  }
  return entry;
}

/** Draw img at (x, y, w, h) in the current transform, its glow baked in if a shadow is set. */
export function drawGlowing(g, img, x, y, w, h) {
  const glow = bakedGlow(g, img, w, h);
  if (!glow) return g.drawImage(img, x, y, w, h);
  const blur = g.shadowBlur;
  g.shadowBlur = 0;
  g.drawImage(glow.c, x - glow.pad, y - glow.pad, glow.c.width / glow.scale, glow.c.height / glow.scale);
  g.shadowBlur = blur;
}
