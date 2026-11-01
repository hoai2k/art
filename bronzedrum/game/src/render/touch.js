import { T as TEXT } from '../text_config.js';
import { PALETTE as P } from '../palette.js';
import { W, GROUND, FIELD_TOP, TOUCH, star } from './common.js';

export const touch = {
  /**
   * The rim ring around the touch drum: Nhị's half of the drum. A lacquer
   * band that flashes on rim strokes, with the zones named faintly.
   */
  touchDrumBand(cx, cy, R, t) {
    const g = this.ctx;
    const outer = R * TOUCH.drum.band;
    const fr = Math.max(0, 1 - (t - this.flash.R) * 5);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 4;
    g.fillStyle = fr > 0 ? `rgba(168,50,45,${0.55 + 0.4 * fr})` : 'rgba(110,32,30,0.6)';
    g.beginPath();
    g.arc(cx, cy, outer, 0, Math.PI * 2);
    g.arc(cx, cy, R - 2, 0, Math.PI * 2, true);
    g.fill();
    g.restore();
    // Tangential circles cut round the band, as on the drum's own rings.
    g.fillStyle = 'rgba(242,232,213,0.22)';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * (R + outer) / 2, cy + Math.sin(a) * (R + outer) / 2, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = P.bronzeLight;
    g.globalAlpha = 0.7 + 0.3 * fr;
    g.lineWidth = 2 + 3 * fr;
    g.beginPath();
    g.arc(cx, cy, outer, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  },

  /** Names on the touch drum's two zones, drawn over the drum face. */
  touchDrumLabels(cx, cy, R, grow = 1) {
    const g = this.ctx;
    const mid = (R + R * TOUCH.drum.band) / 2;
    g.save();
    g.font = `700 ${Math.round(15 * Math.min(grow, 1.25))}px "Be Vietnam Pro", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 4;
    g.fillStyle = 'rgba(242,232,213,0.9)';
    g.fillText(TEXT.touch.rim, cx - mid, cy - 18);
    g.fillText(TEXT.touch.rim, cx + mid, cy - 18);
    g.fillText(TEXT.touch.centre, cx, cy - R * 0.32);
    // The edge of the centre zone.
    g.setLineDash([4, 6]);
    g.strokeStyle = 'rgba(242,232,213,0.45)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, R * TOUCH.drum.centre, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  },

  /** The strip of rhythm dots above the touch drum, which a swipe clears. */
  onDots(x, y) {
    const slotY = TOUCH.drum.y - TOUCH.drum.r * TOUCH.drum.band - 20;
    return Math.abs(x - TOUCH.drum.x) < 130 && y > slotY - 60 && y < slotY + 18;
  },

  /**
   * What a touch at logical (x, y) presses: 'L', 'R', 'guard', 'reset',
   * 'pause', or 'none' (the dots, kept free so a swipe across them is clean).
   */
  touchTarget(x, y, mode) {
    const T = TOUCH;
    const near = (b, pad) => Math.hypot(x - b.x, y - b.y) < b.r + pad;
    if (near(T.pause, 16)) return 'pause';
    if (mode === 'battle' && near(T.shield, 18)) return 'guard';
    if (mode === 'practice') {
      // The arrows first: they sit close to the drum.
      if (near(T.secondPrev, 8)) return 'secondPrev';
      if (near(T.secondNext, 8)) return 'secondNext';
      if (near(T.kit, 16)) return 'S'; // the secondary drum
      if (near(T.fewer, 14)) return 'fewer';
      if (near(T.more, 14)) return 'more';
    }
    const d = Math.hypot(x - T.drum.x, y - T.drum.y);
    if (d < T.drum.r * T.drum.centre) return 'L';
    if (this.onDots(x, y) && d > T.drum.r * T.drum.band) return 'none';
    if (d < T.drum.r * T.drum.reach) return 'R';
    // The battle itself (the army, the enemy, the ground between): shield.
    if (mode === 'battle' && y > this.toScreen(0, FIELD_TOP).y && y < this.toScreen(0, GROUND + 34).y) return 'guard';
    // Anywhere else: the screen's halves, for thumbs at the edges of a phone.
    return x < W / 2 ? 'L' : 'R';
  },

  /** Does a swipe starting at (x, y) reset the rhythm? From the drum or the dots. */
  swipeResets(x, y) {
    const d = Math.hypot(x - TOUCH.drum.x, y - TOUCH.drum.y);
    return d < TOUCH.drum.r * TOUCH.drum.reach || this.onDots(x, y);
  },

  /** A swipe: draw its streak. */
  swiped(x0, y0, x, y, t) {
    this.swipes = (this.swipes || []).filter((s) => t - s.t < 0.4);
    this.swipes.push({ x0, y0, x, y, t });
  },

  /** A touch landed: ring it, and press the button it hit. */
  touched(x, y, target, t) {
    this.taps.push({ x, y, t, target });
    if (this.taps.length > 8) this.taps.shift();
    if (['guard', 'reset', 'pause', 'S', 'secondPrev', 'secondNext', 'fewer', 'more'].includes(target)) this.pressed[target] = t;
  },

  /**
   * The shield button's stand-in: a trống chầu, the big hide-headed barrel
   * drum that stands beside a bronze drum in a temple or a village hall. Seen
   * from the front and a little above: the buffalo-hide head with its red
   * centre, the lacquered barrel and its tacks, a beater resting across it.
   * The head lights when struck (hit, 0..1).
   */
  chauDrum(x, y, r, hit = 0) {
    const g = this.ctx;
    const hx = x;
    const hy = y - r * 0.2;
    const rx = r * 0.9;
    const ry = r * 0.6;
    // Barrel: lacquer red, bulging a little, below and behind the head.
    g.fillStyle = '#7A231F';
    g.beginPath();
    g.ellipse(hx, y + r * 0.42, rx * 0.96, ry * 0.62, 0, 0, Math.PI);
    g.lineTo(hx - rx, hy);
    g.ellipse(hx, hy, rx, ry, 0, Math.PI, 0, true);
    g.closePath();
    g.fill();
    g.save();
    g.shadowColor = 'transparent';
    g.fillStyle = P.lacquer;
    g.beginPath();
    g.ellipse(hx, y + r * 0.42, rx * 0.84, ry * 0.5, 0, 0, Math.PI);
    g.lineTo(hx - rx * 0.86, hy + ry * 0.3);
    g.ellipse(hx, hy + ry * 0.3, rx * 0.86, ry * 0.8, 0, Math.PI, 0, true);
    g.closePath();
    g.fill();
    // Staves and a bronze band round the belly.
    g.strokeStyle = 'rgba(22,21,26,0.35)';
    g.lineWidth = 1.5;
    for (const f of [-0.6, -0.3, 0, 0.3, 0.6]) {
      g.beginPath();
      g.moveTo(hx + f * rx, hy + ry * Math.sqrt(1 - f * f));
      g.lineTo(hx + f * rx * 0.96, y + r * 0.42 + ry * 0.62 * Math.sqrt(1 - f * f));
      g.stroke();
    }
    g.strokeStyle = P.bronzeLight;
    g.lineWidth = Math.max(2, r * 0.05);
    g.beginPath();
    g.ellipse(hx, y + r * 0.2, rx * 0.99, ry * 0.75, 0, 0.12, Math.PI - 0.12);
    g.stroke();
    // The hide head, its rim of tacks, and the red disc painted at its centre.
    g.fillStyle = hit ? `rgb(${240 + 15 * hit},${226 + 20 * hit},${196 + 30 * hit})` : '#E6D3AE';
    g.beginPath();
    g.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#5A3A22';
    g.lineWidth = Math.max(2, r * 0.06);
    g.stroke();
    g.fillStyle = P.bronzeLight;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      g.beginPath();
      g.arc(hx + Math.cos(a) * rx * 0.9, hy + Math.sin(a) * ry * 0.88, Math.max(1.5, r * 0.035), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = P.lacquer;
    g.beginPath();
    g.ellipse(hx, hy, rx * 0.36, ry * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#E6D3AE';
    g.save();
    g.translate(hx, hy);
    g.scale(1, ry / rx);
    star(g, 0, 0, rx * 0.24, rx * 0.1, 8);
    g.restore();
    if (hit) {
      // The head shivers outward from the stroke.
      g.strokeStyle = `rgba(242,232,213,${0.8 * hit})`;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(hx, hy, rx * (0.45 + 0.5 * (1 - hit)), ry * (0.45 + 0.5 * (1 - hit)), 0, 0, Math.PI * 2);
      g.stroke();
    }
    // A beater resting across the head, its tip lifting on a stroke.
    g.save();
    g.translate(hx + rx * 0.62, hy - ry * 0.55 - hit * r * 0.12);
    g.rotate(-0.85 - hit * 0.25);
    g.fillStyle = '#5A3A22';
    g.fillRect(-r * 0.04, -r * 0.05, r * 0.82, r * 0.09);
    g.fillStyle = P.lacquer;
    g.fillRect(r * 0.62, -r * 0.06, r * 0.22, r * 0.11);
    g.restore();
    g.restore();
  },

  /**
   * The reset button's stand-in: a mõ, the round wooden slit drum knocked to
   * keep time in pagodas and village halls, on a red cushion with its mallet.
   */
  moDrum(x, y, r, hit = 0) {
    const g = this.ctx;
    // Cushion.
    g.fillStyle = P.lacquer;
    g.beginPath();
    g.ellipse(x, y + r * 0.68, r * 0.95, r * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.shadowColor = 'transparent';
    g.fillStyle = P.bronzeLight;
    g.fillRect(x - r * 0.95, y + r * 0.66, r * 1.9, Math.max(1.5, r * 0.05));
    // The body: a squat round block of dark polished wood, a touch wider than tall.
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.95);
    grad.addColorStop(0, hit ? '#C98A4E' : '#A86E3A');
    grad.addColorStop(1, '#4E2E16');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y + r * 0.05, r * 0.86, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    // Carved rings on the crown.
    g.strokeStyle = 'rgba(22,21,26,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(x, y - r * 0.12, r * 0.6, r * 0.42, 0, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    // The slit: a long curved mouth cut through the front.
    g.fillStyle = '#1A0F08';
    g.beginPath();
    g.moveTo(x - r * 0.7, y + r * 0.3);
    g.quadraticCurveTo(x, y + r * 0.42, x + r * 0.7, y + r * 0.3);
    g.lineTo(x + r * 0.7, y + r * 0.36);
    g.quadraticCurveTo(x, y + r * 0.5, x - r * 0.7, y + r * 0.36);
    g.closePath();
    g.fill();
    // Highlight.
    g.strokeStyle = 'rgba(242,232,213,0.45)';
    g.lineWidth = Math.max(1.5, r * 0.06);
    g.beginPath();
    g.ellipse(x, y + r * 0.05, r * 0.72, r * 0.56, 0, Math.PI * 1.15, Math.PI * 1.5);
    g.stroke();
    // The mallet, leaning on the cushion against the body; it taps in on a press.
    const tip = { x: x + r * (0.8 - 0.12 * hit), y: y - r * 0.12 };
    const foot = { x: x + r * 1.08, y: y + r * 0.68 };
    g.strokeStyle = '#5A3A22';
    g.lineWidth = Math.max(2, r * 0.09);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(foot.x, foot.y);
    g.lineTo(tip.x, tip.y);
    g.stroke();
    g.fillStyle = '#7A4A26';
    g.beginPath();
    g.ellipse(tip.x, tip.y, r * 0.15, r * 0.13, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },

  /** The shield, reset and pause buttons, and the rings left by touches. */
  touchButtons(view) {
    const g = this.ctx;
    const t = view.songTime;
    const sheet = this.art.get('touch-buttons');
    const b = view.battle;
    // The shield drum is the one action button (shield and clear); pause at the top.
    const buttons = [['pause', TOUCH.pause, 2]];
    if (view.mode === 'battle') buttons.unshift(['guard', TOUCH.shield, 0]);
    if (view.practice) this.practiceButtons(view);
    for (const [id, pos, cellIx] of buttons) {
      const since = t - (this.pressed[id] ?? -9);
      const press = since < 0.18 ? 1 - 0.1 * Math.sin((since / 0.18) * Math.PI) : 1;
      let glow = 0;
      let alpha = id === 'pause' ? 0.75 : 0.92;
      if (id === 'guard') {
        // Call for the shield while an attack is coming; dim while it recovers.
        if ((view.threats.length || view.incoming) && !view.shieldsUp) glow = 0.6 + 0.4 * Math.sin(t * 12);
        if (b.time < b.guardReadyAt && !view.shieldsUp) alpha = 0.6;
      }
      const r = pos.r * press;
      const struck = id === 'guard' ? this.kicks.chau : id === 'reset' ? this.kicks.mo : -9;
      const bs = this.shiver(Math.max(struck, this.pressed[id] ?? -9), t, id === 'pause' ? 0 : 4);
      g.save();
      g.translate(bs.dx, bs.dy);
      g.globalAlpha = alpha;
      g.shadowColor = glow ? P.bronzeLight : 'rgba(0,0,0,0.55)';
      g.shadowBlur = glow ? 20 + 14 * glow : 10;
      g.shadowOffsetY = glow ? 0 : 4;
      const hit = Math.max(since < 0.25 ? 1 - since / 0.25 : 0, bs.k);
      if (sheet) {
        const cw = sheet.width / 3;
        g.drawImage(sheet, cellIx * cw, 0, cw, sheet.height, pos.x - r / 0.9, pos.y - r / 0.9, (2 * r) / 0.9, (2 * r) / 0.9);
      } else if (id === 'guard') this.chauDrum(pos.x, pos.y, r, hit);
      else if (id === 'reset') this.moDrum(pos.x, pos.y, r, hit);
      else {
        g.fillStyle = P.indigo;
        g.beginPath();
        g.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        g.fill();
        g.shadowColor = 'transparent';
        g.strokeStyle = P.bronze;
        g.lineWidth = Math.max(2, r * 0.08);
        g.beginPath();
        g.arc(pos.x, pos.y, r - g.lineWidth / 2, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = P.paper;
        g.fillRect(pos.x - r * 0.32, pos.y - r * 0.4, r * 0.22, r * 0.8);
        g.fillRect(pos.x + r * 0.1, pos.y - r * 0.4, r * 0.22, r * 0.8);
      }
      g.restore();
      if (view.shieldsUp && id === 'guard') {
        // The shield wall is up: a verdigris ring round the barrel drum.
        g.save();
        g.strokeStyle = P.verdigris;
        g.lineWidth = 5;
        g.beginPath();
        g.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      if (id === 'guard' || id === 'reset') {
        g.save();
        g.font = `700 ${Math.round(16 * (this.compact ? Math.min(1.5, 0.95 / this.cssScale / 1.3) : 1))}px "Be Vietnam Pro", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillStyle = P.paper;
        g.globalAlpha = alpha;
        g.shadowColor = 'rgba(0,0,0,0.9)';
        g.shadowBlur = 4;
        g.fillText(id === 'guard' ? TEXT.touch.shield : TEXT.touch.reset, pos.x, pos.y - pos.r - 10);
        g.restore();
      }
    }
    // A swipe's streak, fading.
    for (const sw of (this.swipes || []).filter((q) => t - q.t < 0.4)) {
      const q = (t - sw.t) / 0.4;
      g.save();
      g.globalAlpha = 0.8 * (1 - q);
      g.strokeStyle = P.paper;
      g.lineWidth = 10 * (1 - q) + 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sw.x0, sw.y0);
      g.lineTo(sw.x, sw.y);
      g.stroke();
      g.restore();
    }
    // Rings where fingers landed.
    this.taps = this.taps.filter((p) => t - p.t < 0.35);
    for (const p of this.taps) {
      const q = (t - p.t) / 0.35;
      g.strokeStyle = p.target === 'L' ? P.bronzeLight : p.target === 'R' ? P.lacquer : P.paper;
      g.globalAlpha = 1 - q;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, 14 + 30 * q, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  },
};
