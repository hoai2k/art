// Native-art helmet crest and lowest boot tip, measured independently of
// the reaching hands, plume and cape. Each stroke shares one body length
// and the same two stage anchors. No artwork is stretched or cropped.
export const WRECK_SWIM = {
  bodyLength: 180, angle: -Math.PI / 6,
  original: [
    { head: [266, 45], foot: [8, 198], mouth: [278, 93], ring: [160, 129] },
    { head: [344, 36], foot: [19, 220], mouth: [351, 89], ring: [242, 132] },
  ],
  tinted: [
    { head: [263, 49], foot: [6, 195], mouth: [280, 91], ring: [160, 129] },
    { head: [337, 28], foot: [11, 224], mouth: [354, 90], ring: [242, 132] },
  ],
};
const FRAMES = ['prince-swim-a', 'prince-swim-b'];
export function wreckSwimGeometry(k, stroke, bodyLength = WRECK_SWIM.bodyLength) {
  const frame = stroke ? 1 : 0, id = FRAMES[frame], im = k.img(id);
  if (!im) return null;
  const tinted = /-tinted(?:-redo)?\./.test(im.src || '');
  const landmarks = WRECK_SWIM[tinted ? 'tinted' : 'original'][frame];
  const { head, foot } = landmarks, dx = head[0] - foot[0], dy = head[1] - foot[1];
  const scale = bodyLength / Math.hypot(dx, dy), angle = WRECK_SWIM.angle - Math.atan2(dy, dx);
  const centre = [(head[0] + foot[0]) / 2, (head[1] + foot[1]) / 2];
  const point = ([x, y]) => ({
    x: scale * ((x - centre[0]) * Math.cos(angle) - (y - centre[1]) * Math.sin(angle)),
    y: scale * ((x - centre[0]) * Math.sin(angle) + (y - centre[1]) * Math.cos(angle)),
  });
  return { id, im, scale, angle, centre, point, landmarks };
}
export function drawWreckSwimmer(k, stroke, bodyLength = WRECK_SWIM.bodyLength) {
  const g = wreckSwimGeometry(k, stroke, bodyLength);
  if (!g) { k.require?.(FRAMES[stroke ? 1 : 0]); return false; }
  const { im, id, scale, angle, centre } = g, c = k.c;
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  c.save(); c.rotate(angle);
  // Draw native pixels at the anatomical scale, bypassing the old generic
  // canvas-box/helmet correction that made the reaching stroke shrink.
  k.assetCrop(id, 0, 0, w, h, -centre[0] * scale, -centre[1] * scale, w * scale, h * scale);
  c.restore(); return true;
}
