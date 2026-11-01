import { PERSON, PERSON_REF } from './person-size.js';

// A pose sprite drawn with its feet at (x, by), at the scale of a character
// `standH` stage px tall whose standing figure is `std` art px tall in that
// sprite family (the prince's movement and pose frames 360, the crew and the
// courtiers 420). The audit's character-size correction (POSE_FIT) is applied
// by the loader. `face` -1 mirrors; `rot` turns it about a point `pivot` px
// above the feet. False when the sprite has not been delivered.
export function drawPose(k, id, x, by, standH, { std = 360, face = 1, rot = 0, pivot = 0, alpha = null } = {}) {
  const im = k.img(id);
  if (!im) return false;
  const s = standH / std, w = (im.naturalWidth || im.width) * s, h = (im.naturalHeight || im.height) * s;
  const c = k.c;
  c.save();
  c.translate(x, by - pivot);
  if (rot) c.rotate(rot);
  if (face < 0) c.scale(-1, 1);
  if (alpha != null) c.globalAlpha *= alpha;
  const drawn = k.asset(id, 0, pivot, w, h);
  c.restore();
  return drawn;
}

// The film cast's id for a classic crew id (the crew's own pose sprites are
// named after it), or null outside the film's crew.
export const CREW_OF = { 'reveller-yellow': 'crew-squire', 'reveller-shaggy': 'crew-bosun', 'reveller-jester': 'crew-helmsman', 'reveller-lady': 'crew-manatarms' };

// Any sprite of a character drawn at one person size: feet at (x, by), the
// character `height` stage px tall standing, whatever the sprite (standing,
// swooning, lying, flying, at a window), from each sprite's measured standing
// height (src/person-size.js, design/person-sizes.md). Each look (original or
// tinted art) has its own measure. With `t`, the sprite's idle frames play
// (kit.idle). `face` -1 mirrors; `rot` turns it about the feet. False when the
// sprite has not been delivered.
// The character's standing height as painted in this sprite, art px (its
// natural height for a sprite not measured), in the look being drawn.
export function personPx(k, id) {
  const im = k.img(id);
  if (!im) return 0;
  const tinted = /-tinted(?:-redo)?\./.test(im.src || '');
  return PERSON[id + (tinted ? '-tinted' : '')]?.px ?? PERSON[id]?.px ?? (im.naturalHeight || im.height);
}
export function personScale(k, id, height) {
  const px = personPx(k, id);
  return px ? height / px : 0;
}
// The reference sprite of the character `id` belongs to (null if unmeasured).
export const personRef = (id) => PERSON_REF[PERSON[id]?.who] || null;
export function drawPerson(k, id, x, by, height, { face = 1, rot = 0, alpha = null, t = null, over = null, onlyOver = false } = {}) {
  const im = k.img(id), s = personScale(k, id, height);
  if (!im || !s) return false;
  const w = (im.naturalWidth || im.width) * s, h = (im.naturalHeight || im.height) * s;
  const c = k.c;
  c.save();
  c.translate(x, by);
  if (rot) c.rotate(rot);
  if (face < 0) c.scale(-1, 1);
  if (alpha != null) c.globalAlpha *= alpha;
  const drawn = t == null && !over ? k.asset(id, 0, 0, w, h) : k.idle(id, t ?? 0, 0, 0, w, h, undefined, over, onlyOver);
  c.restore();
  return drawn;
}
