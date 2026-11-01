// Jointed cut-paper puppets (the BD-R part sheets, cut by
// design/source/build_rigs.py). Each piece turns about its pin on its
// parent's pin, like a shadow puppet; a pose is a map of piece -> angle in
// radians (clockwise), and a missing piece angle is 0, the rest pose.

import { drawGlowing } from './render/glow.js';

export async function loadRig(base, name) {
  try {
    const meta = await (await fetch(`${base}rigs/${name}.json`)).json();
    const entries = Object.entries(meta.pieces);
    const images = await Promise.all(
      entries.map(([, p]) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `${base}${p.file}`;
      })),
    );
    const pieces = entries.map(([id, p], i) => ({ id, ...p, img: images[i] }));
    // Parents before children, so each piece's frame is ready for its children.
    const order = [];
    const seen = new Set();
    const visit = (p) => {
      if (seen.has(p.id)) return;
      if (p.parent) visit(pieces.find((q) => q.id === p.parent));
      seen.add(p.id);
      order.push(p);
    };
    pieces.forEach(visit);
    return { meta, order, byZ: [...pieces].sort((a, b) => a.z - b.z) };
  } catch {
    return null; // no rig: the figure's whole sprite is drawn instead
  }
}

/**
 * Draw a rig standing at (x, y) (its feet), `height` px from crown to feet.
 * pose: { piece: angle } plus optional lean (whole-figure tilt about the feet).
 */
export function drawRig(g, rig, x, y, height, pose = {}) {
  const { meta } = rig;
  const s = height / (meta.ground - meta.top);
  const base = g.getTransform();
  const frames = new Map();
  for (const p of rig.order) {
    let m;
    if (!p.parent) {
      m = new DOMMatrix().translate(x, y).rotate(((pose.lean || 0) * 180) / Math.PI).scale(s).translate(0, -meta.ground);
    } else {
      const parent = rig.order.find((q) => q.id === p.parent);
      m = frames.get(p.parent).translate(p.anchor[0] - parent.pivot[0], p.anchor[1] - parent.pivot[1]);
    }
    m = m.rotate(((pose[p.id] || 0) * 180) / Math.PI);
    frames.set(p.id, m);
  }
  for (const p of rig.byZ) {
    g.setTransform(base.multiply(frames.get(p.id)));
    drawGlowing(g, p.img, -p.pivot[0], -p.pivot[1], p.w, p.h); // the backlit glow baked in (render/glow.js)
  }
  g.setTransform(base);
}
