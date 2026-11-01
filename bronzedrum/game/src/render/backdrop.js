import { PALETTE as P, SKIES } from '../palette.js';
import { W, H, GROUND, STRIP_W, LAYER_TINT, rng, canvas, cutLayer, crescent, leaf, star, haze } from './common.js';

export const backdrop = {
  buildSky(kind) {
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const s = SKIES[kind];
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, s.top);
    grad.addColorStop(0.5, s.mid);
    grad.addColorStop(0.8, s.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const night = kind === 'night' || kind === 'foundry';
    const cx = night ? 930 : kind === 'dusk' ? 980 : 860;
    const cy = night ? 150 : kind === 'dusk' ? 330 : kind === 'ash' ? 180 : 210;
    const R = night ? 70 : kind === 'dusk' ? 110 : 84;
    // The drum's rings, cut faintly into the sky around the sun or moon.
    g.save();
    g.strokeStyle = s.glow;
    for (let i = 1; i <= 6; i++) {
      g.globalAlpha = 0.16 - i * 0.018;
      g.lineWidth = i % 2 ? 2 : 1;
      g.beginPath();
      g.arc(cx, cy, R + 26 * i, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.12;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * (R + 39), cy + Math.sin(a) * (R + 39), 7, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    // Sun or moon: a lit paper disc.
    g.save();
    g.shadowColor = s.glow;
    g.shadowBlur = 70;
    g.fillStyle = s.glow;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.fillStyle = night ? 'rgba(58,76,110,0.35)' : 'rgba(176,122,58,0.4)';
    if (night) {
      const r = rng(3);
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(cx - 40 + r() * 80, cy - 40 + r() * 80, 3 + r() * 9, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // The sun is the drum's twelve-point star, cut from a bronze disc.
      star(g, cx, cy, R - 12, R * 0.38, 12);
      g.fillStyle = s.glow;
      g.beginPath();
      g.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (kind === 'dawn') {
      // The setting moon, a pale crescent: the moon changes every chapter.
      g.save();
      g.fillStyle = 'rgba(246,240,220,0.75)';
      crescent(g, 250, 120, 26, -0.6);
      g.restore();
    }
    if (kind === 'foundry') {
      // Embers drifting up from the furnaces instead of stars.
      const r = rng(17);
      for (let i = 0; i < 80; i++) {
        g.globalAlpha = 0.3 + r() * 0.6;
        g.fillStyle = r() < 0.5 ? '#FFB65C' : '#FF7A3A';
        g.fillRect(r() * W, H * 0.25 + r() * H * 0.5, 2, 2);
      }
      g.globalAlpha = 1;
    } else if (night) {
      const r = rng(11);
      g.fillStyle = P.moon;
      for (let i = 0; i < 90; i++) {
        g.globalAlpha = 0.25 + r() * 0.6;
        const x = r() * W;
        const y = r() * H * 0.55;
        if (r() < 0.12) star(g, x, y, 4, 1.2, 4);
        else g.fillRect(x, y, 2, 2);
      }
      g.globalAlpha = 1;
    }
    // Paper clouds: scalloped strips with a row of cut holes, casting a shadow.
    const r = rng(kind.length * 13);
    const cloudColor = night ? '#2E3E62' : kind === 'dawn' ? '#C98E86' : '#EFE6CF';
    for (let i = 0; i < 6; i++) {
      const y = 70 + r() * 230;
      const x = r() * W;
      const len = 140 + r() * 300;
      const cloud = (cc) => {
        cc.beginPath();
        for (let k = 0; k <= len; k += 24) cc.arc(x + k, y, 13 + ((k / 24) % 3) * 5, Math.PI, 0);
        cc.lineTo(x + len, y + 9);
        cc.lineTo(x, y + 9);
        cc.fill();
      };
      g.save();
      g.globalAlpha = 0.3;
      g.fillStyle = '#000';
      g.filter = 'blur(4px)'; // built once, offscreen
      g.translate(5, 7);
      cloud(g);
      g.restore();
      g.fillStyle = cloudColor;
      cloud(g);
      g.save();
      g.fillStyle = s.glow;
      g.globalAlpha = 0.7;
      for (let k = 12; k < len - 10; k += 24) {
        g.beginPath();
        g.arc(x + k, y + 1, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    return c;
  },

  buildKarst(far) {
    const r = rng(far ? 31 : 21);
    const base = far ? 380 : 430;
    const peaks = [];
    for (let x = 0; x < STRIP_W; x += (far ? 90 : 120) + r() * 160) {
      peaks.push({ x, w: 140 + r() * 180, h: (far ? 110 : 90) + r() * (far ? 130 : 170) });
    }
    const peakPath = (g, p, x, k = 1) => {
      const h = p.h * k;
      const w = p.w * k;
      g.moveTo(x - w / 2, base);
      g.bezierCurveTo(x - w * 0.55, base - h * 0.8, x - w * 0.25, base - h, x, base - h);
      g.bezierCurveTo(x + w * 0.3, base - h, x + w * 0.5, base - h * 0.7, x + w / 2, base);
      g.closePath();
    };
    const shape = (g) => {
      g.beginPath();
      for (const shift of [-STRIP_W, 0, STRIP_W]) for (const p of peaks) peakPath(g, p, p.x + shift);
      g.fill();
      g.fillRect(0, base - 20, STRIP_W, H);
    };
    const holes = (g) => {
      const rr = rng(far ? 6 : 5);
      for (const shift of [-STRIP_W, 0, STRIP_W]) {
        for (const p of peaks) {
          const x = p.x + shift;
          // A dotted contour inside each peak, like a stitched seam of light.
          for (let t = 0.08; t < 0.92; t += 0.045) {
            const a = Math.PI * (1 - t);
            const px = x + Math.cos(a) * p.w * 0.3;
            const py = base - 16 - Math.sin(a) * p.h * 0.72;
            g.beginPath();
            g.arc(px, py, far ? 1.4 : 1.8, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // Mist bands and herons.
      for (let i = 0; i < 30; i++) {
        const x = rr() * STRIP_W;
        const y = base - 140 + rr() * 120;
        g.fillRect(x, y, 40 + rr() * 160, far ? 2 : 3);
      }
      if (!far) {
        for (let i = 0; i < 10; i++) {
          const x = rr() * STRIP_W;
          const y = 120 + rr() * 140;
          leaf(g, x, y, 22, -0.3, 0.18);
          leaf(g, x, y, 22, Math.PI + 0.3, 0.18);
          leaf(g, x + 4, y + 1, 12, 0.2, 0.25);
        }
      }
    };
    const color = far ? this.sky.far0 : this.sky.far;
    return cutLayer(STRIP_W, H, color, shape, holes, {
      shadow: { dx: 6, dy: 8, blur: 10, alpha: far ? 0.15 : 0.25 },
      glow: this.sky.glow,
      halo: far ? 0.2 : 0.3,
      cutGlow: far ? 0.35 : 0.5,
    });
  },

  buildGrove(garden) {
    const r = rng(garden ? 44 : 45);
    const items = [];
    for (let x = 0; x < STRIP_W; x += 70 + r() * 150) {
      const roll = r();
      const kind = roll < 0.2 ? 'house' : roll < 0.5 ? 'palm' : roll < 0.75 ? 'bamboo' : garden ? 'shrub' : 'palm';
      items.push({ x, kind, h: 140 + r() * 120, s: r() });
    }
    const top = (it) => GROUND - 40 - it.h;
    const fronds = (it) => Array.from({ length: 9 }, (_, i) => -Math.PI + (i / 8) * Math.PI + 0.15 * Math.sin(i + it.s * 7));
    const draw = (g, it, x) => {
      if (it.kind === 'palm') {
        g.beginPath();
        g.moveTo(x - 4, GROUND);
        g.quadraticCurveTo(x - 2 + it.s * 14, GROUND - it.h * 0.6, x, top(it));
        g.lineTo(x + 3, top(it));
        g.quadraticCurveTo(x + 2 + it.s * 14, GROUND - it.h * 0.6, x + 4, GROUND);
        g.fill();
        for (const a of fronds(it)) leaf(g, x, top(it), 74, a, 0.2);
      } else if (it.kind === 'bamboo') {
        for (let k = -1; k <= 1; k++) {
          const bx = x + k * 9;
          const t = GROUND - 40 - it.h * (0.8 + 0.2 * Math.abs(k));
          g.fillRect(bx - 2, t, 4, GROUND - t);
          for (let j = 0; j < 6; j++) leaf(g, bx, t + j * 24, 30, j % 2 ? -0.4 : Math.PI + 0.4, 0.2);
        }
      } else if (it.kind === 'shrub') {
        for (let k = 0; k < 7; k++) {
          g.beginPath();
          g.arc(x + (k - 3) * 16, GROUND - 30 - Math.sin((k / 6) * Math.PI) * 34, 22, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        // Stilt house with a saddle roof, as on the drum.
        const by = GROUND - 70;
        for (const px of [-40, -14, 14, 40]) g.fillRect(x + px - 2, by, 4, 60);
        g.fillRect(x - 46, by - 34, 92, 34);
        g.beginPath();
        g.moveTo(x - 84, by - 76);
        g.quadraticCurveTo(x, by - 22, x + 84, by - 76);
        g.lineTo(x + 60, by - 30);
        g.lineTo(x - 60, by - 30);
        g.closePath();
        g.fill();
        // Bird finials on the roof ends.
        leaf(g, x - 84, by - 76, 16, -2.4, 0.3);
        leaf(g, x + 84, by - 76, 16, -0.7, 0.3);
      }
    };
    const shape = (g) => {
      for (const shift of [-STRIP_W, 0, STRIP_W]) for (const it of items) draw(g, it, it.x + shift);
      g.fillRect(0, GROUND - 46, STRIP_W, 60);
    };
    const holes = (g) => {
      for (const shift of [-STRIP_W, 0, STRIP_W]) {
        for (const it of items) {
          const x = it.x + shift;
          if (it.kind === 'palm') {
            // Vein slits down every frond.
            for (const a of fronds(it)) leaf(g, x + Math.cos(a) * 14, top(it) + Math.sin(a) * 14, 46, a, 0.025);
          } else if (it.kind === 'bamboo') {
            for (let k = -1; k <= 1; k++) {
              const t = GROUND - 40 - it.h * (0.8 + 0.2 * Math.abs(k));
              for (let y = t + 20; y < GROUND - 50; y += 26) g.fillRect(x + k * 9 - 2, y, 4, 1.5);
            }
          } else if (it.kind === 'shrub') {
            for (let k = 0; k < 7; k++) {
              const fx = x + (k - 3) * 16;
              const fy = GROUND - 30 - Math.sin((k / 6) * Math.PI) * 34;
              star(g, fx, fy, 7, 2.5, 5);
            }
          } else {
            const by = GROUND - 70;
            for (let k = -3; k <= 3; k++) g.fillRect(x + k * 12 - 3, by - 28, 6, 18);
            for (let k = -5; k <= 5; k++) {
              g.beginPath();
              g.arc(x + k * 12, by - 50 + Math.abs(k) * -2.5, 2.2, 0, Math.PI * 2);
              g.fill();
            }
          }
        }
      }
    };
    return cutLayer(STRIP_W, H, this.sky.mid2, shape, holes, { glow: this.sky.glow, halo: 0.3, cutGlow: 0.4 });
  },

  buildPaddy() {
    const shape = (g) => {
      g.beginPath();
      g.moveTo(0, GROUND);
      for (let x = 0; x <= STRIP_W; x += 32) g.quadraticCurveTo(x + 16, GROUND - 7, x + 32, GROUND);
      g.lineTo(STRIP_W, H);
      g.lineTo(0, H);
      g.fill();
      // Rice sprouts along the bank.
      for (let x = 6; x < STRIP_W; x += 22) {
        leaf(g, x, GROUND + 2, 14, -1.9, 0.18);
        leaf(g, x, GROUND + 2, 12, -1.2, 0.18);
      }
    };
    const holes = (g) => {
      // Water between rice rows catching the light, kept faint under the HUD.
      for (let row = 0; row < 6; row++) {
        const y = GROUND + 30 + row * 30;
        for (let x = (row % 2) * 40; x < STRIP_W; x += 80) g.fillRect(x, y, 46 - row * 3, 1.5 + row * 0.3);
      }
    };
    return cutLayer(STRIP_W, H, this.sky.ground, shape, holes, {
      shadow: { dx: 0, dy: -6, blur: 8, alpha: 0.3 },
      glow: this.sky.glow,
      halo: 0.25,
      cutGlow: 0.14,
    });
  },

  buildReeds() {
    const r = rng(77);
    const lotus = [];
    const shape = (g) => {
      for (const shift of [-STRIP_W, 0, STRIP_W]) {
        for (let x = 0; x < STRIP_W; x += 18 + r() * 40) {
          const px = x + shift;
          const h = 40 + r() * 90;
          g.beginPath();
          g.moveTo(px - 3, H);
          g.quadraticCurveTo(px + 6, H - h * 0.6, px + 14 * (r() - 0.3), H - h);
          g.quadraticCurveTo(px + 4, H - h * 0.5, px + 3, H);
          g.fill();
          if (r() < 0.16) {
            // Lotus pad and, sometimes, a flower on a long stem.
            g.beginPath();
            g.ellipse(px + 20, H - 14, 34, 10, 0, 0.2, Math.PI * 2 - 0.2);
            g.lineTo(px + 20, H - 14);
            g.fill();
            if (shift === 0) lotus.push(px + 20);
            if (r() < 0.5) {
              const fy = H - 70 - r() * 30;
              g.fillRect(px + 38, fy, 2, H - fy);
              for (let k = -2; k <= 2; k++) leaf(g, px + 39, fy, 22 - Math.abs(k) * 3, -Math.PI / 2 + k * 0.38, 0.32);
            }
          }
        }
      }
    };
    const holes = (g) => {
      for (const shift of [-STRIP_W, 0, STRIP_W]) {
        for (const lx of lotus) {
          for (let k = 0; k < 6; k++) leaf(g, lx + shift, H - 14, 26, Math.PI + 0.25 + k * 0.5, 0.05);
        }
      }
    };
    return cutLayer(STRIP_W, H, P.ink, shape, holes, {
      shadow: { dx: 0, dy: -10, blur: 12, alpha: 0.4 },
      glow: this.sky.glow,
      halo: 0.4,
      cutGlow: 0.5,
    });
  },

  strip(img, factor, y = 0) {
    const g = this.ctx;
    const off = (((this.cam * factor) % STRIP_W) + STRIP_W) % STRIP_W;
    g.drawImage(img, -off, y);
    if (STRIP_W - off < W) g.drawImage(img, STRIP_W - off, y);
  },

  /**
   * A delivered layer re-lit for this chapter. The painted layers are one
   * colour for every chapter, so each is washed toward the colour its
   * stand-in uses under this chapter's light (paper texture kept), once per
   * chapter.
   */
  litLayer(id, img) {
    // Cached per chapter and per screen size: drawn at exactly the size it
    // appears, so the frame loop never rescales a large image.
    const key = `${id}@${this.stage.sky}@${this.pixel}`;
    if (this.lit.has(key)) return this.lit.get(key);
    const tint = { 'layer-karst-far': 'far0', 'layer-karst': 'far', 'layer-grove': 'mid2', 'layer-paddy': 'ground' }[id];
    const h = Math.round(H * this.pixel);
    const c = canvas(Math.round((img.width / img.height) * h), h);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    if (tint) {
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = LAYER_TINT[this.stage.sky];
      g.fillStyle = this.sky[tint];
      g.fillRect(0, 0, c.width, c.height);
    }
    // The empty band above the strip's silhouette (most of a strip is sky):
    // measured once, and left out when the strip is drawn, every frame.
    c.top = 0;
    c.bottom = c.height;
    try {
      const sw = 256;
      const sh = Math.max(1, Math.round((sw / img.width) * img.height));
      const probe = canvas(sw, sh);
      const pg = probe.getContext('2d', { willReadFrequently: true });
      pg.drawImage(img, 0, 0, sw, sh);
      const d = pg.getImageData(0, 0, sw, sh).data;
      const rowHas = (y) => {
        for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3] > 4) return true;
        return false;
      };
      let top = 0;
      while (top < sh && !rowHas(top)) top++;
      let bottom = sh;
      while (bottom > top && !rowHas(bottom - 1)) bottom--;
      // A row or two of margin either way, for the scaled image's soft edge.
      c.top = Math.max(0, Math.floor(((top - 2) / sh) * c.height));
      c.bottom = Math.min(c.height, Math.ceil(((bottom + 2) / sh) * c.height));
    } catch {
      /* unreadable: draw it whole */
    }
    this.lit.set(key, c);
    return c;
  },

  /**
   * The far scenery (the sky, the far karst and the karst with the haze over
   * each) composited into one screen-sized canvas. They scroll at 7% and 15%
   * of the camera, so the composite is redrawn only when one of them has
   * moved by a device pixel (or the chapter, the size or the art changes) and
   * most frames draw it once instead of painting five screens of layers.
   */
  farBackdrop(skyImg) {
    const px = this.pixel;
    const key = [this.stage.sky, px, this.canvas.width, this.canvas.height, skyImg ? 1 : 0,
      this.art.get('layer-karst-far') ? 1 : 0, this.art.get('layer-karst') ? 1 : 0,
      Math.round(this.cam * 0.07 * px), Math.round(this.cam * 0.15 * px)].join();
    if (this.farKey !== key) {
      this.farKey = key;
      if (!this.far || this.far.width !== Math.round(W * px) || this.far.height !== Math.round(H * px)) {
        this.far = canvas(Math.round(W * px), Math.round(H * px));
      }
      const g = this.far.getContext('2d');
      const main = this.ctx;
      this.ctx = g; // layer() and strip() draw on this.ctx
      try {
        g.setTransform(px, 0, 0, px, 0, 0);
        g.clearRect(0, 0, W, H);
        g.drawImage(skyImg || this.layers.sky, 0, 0, W, H);
        this.layer('layer-karst-far', this.layers.karstFar, 0.07);
        haze(g, this.sky.low, 220, 400, 0.3);
        this.layer('layer-karst', this.layers.karst, 0.15);
        haze(g, this.sky.low, 260, GROUND - 30, 0.3);
      } finally {
        this.ctx = main;
      }
    }
    return this.far;
  },

  /**
   * The paper fibre and the vignette over the whole scene, baked once (per
   * size and fibre image) into one image drawn with 'multiply': one screen
   * painted instead of two. The fibre multiplies at 22%; the vignette darkens
   * toward the edges, which multiply reproduces (its colour is near black).
   */
  overlay() {
    const px = this.pixel;
    const fiberImg = this.art.get('paper-fiber');
    const water = this.style === 'water';
    const key = `${px}@${this.canvas.width}x${this.canvas.height}@${fiberImg ? fiberImg.src : 'drawn'}@${this.style}`;
    if (this.overlayKey !== key) {
      this.overlayKey = key;
      const c = canvas(Math.round(W * px), Math.round(H * px));
      const g = c.getContext('2d');
      g.setTransform(px, 0, 0, px, 0, 0);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      // Fibre at 22%: white where the paper is plain, darker in the fibres.
      // (Water puppets: no paper; the lacquer texture when it is delivered.)
      if (fiberImg || !water) {
        g.globalAlpha = water ? 0.12 : 0.22;
        g.fillStyle = g.createPattern(fiberImg || this.fiber, 'repeat');
        g.globalCompositeOperation = 'multiply';
        g.fillRect(0, 0, W, H);
      }
      // The vignette: light falling off at the edge of a lightbox.
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(10,8,12,0.55)');
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
      this.overlayImg = c;
    }
    return this.overlayImg;
  },

  layer(id, fallback, factor) {
    let img = this.art.get(id);
    if (img) {
      img = this.litLayer(id, img);
      const w = img.width / this.pixel;
      const g = this.ctx;
      const off = (((this.cam * factor) % w) + w) % w;
      // Only the band with something in it (litLayer measured it).
      const sy = img.top || 0;
      const sh = (img.bottom || img.height) - sy;
      if (sh <= 0) return;
      const y = sy / this.pixel;
      const h = sh / this.pixel;
      for (let x = -off; x < W; x += w) g.drawImage(img, 0, sy, img.width, sh, x, y, w, h);
    } else this.strip(fallback, factor);
  },
};
