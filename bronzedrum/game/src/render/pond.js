// The water-puppet style (Settings, Style): the stage is a village pond.
// Everyone wades in it, so the pond is drawn over the figures' feet and
// shins along the ground line, with rings of ripples where each one stands
// and gold lantern light broken on the water; red lanterns hang on a string
// across the top, as over a water-puppet pavilion. The delivered pond strip
// (BD-W02, wp-water) replaces the drawn water.

import { W, H, GROUND } from './common.js';

/** The water line: a little above the feet, so they wade. */
export const WATERLINE = GROUND - 12;

export const pond = {
  /** Remember where a figure stands (world x, half-width) for its ripples. */
  ripple(x, w) {
    (this.ripples || (this.ripples = [])).push({ x, w });
  },

  /** The pond, in world space, over everything standing in it. */
  pond(t) {
    const g = this.ctx;
    const x0 = this.cam - 40;
    const x1 = this.cam + W + 40;
    const img = this.art.own('wp-water');
    g.save();
    if (img) {
      const h = H - WATERLINE;
      const w = (img.width / img.height) * h * 1.6;
      const off = ((x0 % w) + w) % w;
      for (let x = x0 - off; x < x1; x += w) g.drawImage(img, x, WATERLINE, w, h * 1.6);
    } else {
      const deep = g.createLinearGradient(0, WATERLINE, 0, H);
      deep.addColorStop(0, 'rgba(52,72,58,0.9)');
      deep.addColorStop(0.3, 'rgba(26,38,32,0.96)');
      deep.addColorStop(1, 'rgba(12,16,15,1)');
      g.fillStyle = deep;
      g.fillRect(x0, WATERLINE, x1 - x0, H - WATERLINE);
      // Lantern light broken into ripples, under each lantern on the string.
      const step = 260;
      for (let lx = Math.floor(x0 / step) * step; lx < x1; lx += step) {
        for (let k = 0; k < 7; k++) {
          const y = WATERLINE + 8 + k * 9;
          const wob = Math.sin(t * 2.2 + k * 1.7 + lx) * 6;
          g.fillStyle = k % 2 ? 'rgba(217,165,91,0.22)' : 'rgba(200,70,50,0.18)';
          g.fillRect(lx + 60 + wob - (14 - k), y, 2 * (14 - k), 2);
        }
      }
      // Ripple lines drifting along the surface.
      g.fillStyle = 'rgba(242,232,213,0.13)';
      for (let i = 0; i < 40; i++) {
        const y = WATERLINE + 5 + ((i * 37) % 70);
        const span = 1200;
        const x = Math.floor(x0 / span) * span + ((i * 211 + t * (8 + (i % 5) * 3)) % span);
        for (let rep = x; rep < x1 + span; rep += span) if (rep > x0 - 60) g.fillRect(rep, y, 18 + (i % 4) * 9, 1.5);
      }
    }
    // The bright edge of the water line.
    g.fillStyle = 'rgba(246,240,220,0.35)';
    g.fillRect(x0, WATERLINE - 1, x1 - x0, 1.5);
    // Rings round every wading figure, swelling out and fading.
    g.strokeStyle = 'rgba(246,240,220,0.5)';
    g.lineWidth = 1.2;
    for (const r of this.ripples || []) {
      for (let k = 0; k < 2; k++) {
        const p = (((t * 0.8 + k * 0.5 + r.x * 0.013) % 1) + 1) % 1;
        g.globalAlpha = 0.6 * (1 - p);
        g.beginPath();
        g.ellipse(r.x, WATERLINE + 1, r.w * (0.8 + p * 0.9), 3 + p * 4, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
    this.ripples = [];
  },

  /**
   * The scene above the water line mirrored in it, faint and fading with
   * depth (screen space, after the world is drawn: it copies the canvas).
   */
  reflection() {
    const g = this.ctx;
    const px = this.pixel;
    const ys = this.toScreen(0, WATERLINE).y;
    const depth = Math.min(120, H - ys);
    if (depth <= 0) return;
    // Copied once into a quarter-size canvas (cheap, and softly blurred like
    // a reflection), faded with depth there, then drawn back flipped.
    const sw = Math.max(1, Math.round((W * px) / 4));
    const sh = Math.max(1, Math.round((depth * px) / 4));
    let c = this.reflectCanvas;
    if (!c || c.width !== sw || c.height !== sh) {
      c = this.reflectCanvas = document.createElement('canvas');
      c.width = sw;
      c.height = sh;
    }
    const r = c.getContext('2d');
    r.globalCompositeOperation = 'copy';
    r.drawImage(this.canvas, 0, (ys - depth) * px, this.canvas.width, depth * px, 0, 0, sw, sh);
    r.globalCompositeOperation = 'destination-in';
    const fade = r.createLinearGradient(0, 0, 0, sh);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.3)');
    r.fillStyle = fade;
    r.fillRect(0, 0, sw, sh);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(0, 2 * ys * px);
    g.scale(1, -1);
    g.drawImage(c, 0, (ys - depth) * px, this.canvas.width, depth * px);
    g.restore();
  },

  /** Red lanterns on a string across the top of the scene, scrolling a little behind the action. */
  lanternString(t) {
    const g = this.ctx;
    const span = 260;
    const off = (((this.cam * 0.8) % span) + span) % span;
    const img = this.art.own('wp-prop-lantern');
    g.save();
    g.strokeStyle = 'rgba(22,21,26,0.8)';
    g.lineWidth = 1.5;
    for (let x = -off - span; x < W + span; x += span) {
      g.beginPath();
      g.moveTo(x, 18);
      g.quadraticCurveTo(x + span / 2, 58, x + span, 18);
      g.stroke();
      const lx = x + span / 2;
      const ly = 46 + Math.sin(t * 1.3 + x * 0.01) * 1.5;
      g.fillStyle = 'rgba(246,200,120,0.18)';
      g.beginPath();
      g.arc(lx, ly + 12, 24, 0, Math.PI * 2);
      g.fill();
      if (img) {
        // The delivered lantern (BD-WP05), hung from the lowest point of the string.
        // (The picture keeps a wide glow round the lantern, so it is drawn large.)
        const h = 72;
        const w = (img.width / img.height) * h;
        g.drawImage(img, lx - w / 2, 34 + (ly - 46), w, h);
        continue;
      }
      g.fillStyle = '#B8322A';
      g.beginPath();
      g.ellipse(lx, ly + 12, 10, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#D9A55B';
      g.fillRect(lx - 6, ly - 2, 12, 3);
      g.fillRect(lx - 6, ly + 24, 12, 3);
      g.fillRect(lx - 0.75, ly + 27, 1.5, 8);
    }
    g.restore();
  },

  /** A splash droplet or a chip of lacquered wood (the water style's hit scraps). */
  splashBit(p) {
    const g = this.ctx;
    if (p.cell !== undefined ? p.cell % 3 : Math.abs(Math.round(p.s * 7)) % 3) {
      g.fillStyle = 'rgba(214,236,226,0.85)';
      g.beginPath();
      g.ellipse(0, 0, p.s * 0.45, p.s * 0.75, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(-p.s * 0.15, -p.s * 0.4, p.s * 0.2, p.s * 0.25);
    } else {
      g.fillStyle = p.c;
      g.fillRect(-p.s * 0.7, -p.s * 0.3, p.s * 1.4, p.s * 0.6);
      g.fillStyle = 'rgba(255,240,210,0.45)';
      g.fillRect(-p.s * 0.6, -p.s * 0.28, p.s * 1.1, p.s * 0.15);
    }
  },
};
