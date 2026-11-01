import { T, txt } from '../text_config.js';
import { PALETTE as P } from '../palette.js';
import { COMMANDS, parsePattern } from '../rhythm.js';
import { ROMAN, W, H, TOUCH, spanOf, leaf, star } from './common.js';

// The close-up sticks over the HUD drum (BD-U20, BD-U21): each swings in to
// its landing point on the stroke and lifts away. ang: the stick's direction
// at contact, wrist to head (flatter on touch screens, where the big drum sits
// low and a steep stick would leave its hand below the screen); at: the head's
// landing point in drum radii from the centre; art: where the wrist and head
// sit in the delivered image.
const STICKS = {
  // tip: how far it turns up when raised (radians); back: how far the arm
  // draws back along its line, and side: how far it swings out sideways
  // (drum radii); grow: how much larger it looks when raised. Nhị's stick
  // comes up steeply from the bottom right and meets the drum's far right
  // edge almost along the rim, so its stroke is a swing in from the side.
  L: { id: 'hud-stick-trac', ang: -0.7, angTouch: -0.2, tip: 0.32, back: 0.05, side: 0, grow: 0.2, at: [0, 0], art: { wrist: [0.22, 0.78], head: [0.8, 0.2] } },
  R: { id: 'hud-stick-nhi', ang: -1.95, angTouch: Math.PI + 0.3, tip: 0.2, back: 0.1, side: 0.45, grow: 0.12, at: [0.97, -0.04], atTouch: [0.95, -0.2], art: { wrist: [0.78, 0.78], head: [0.2, 0.2] } },
};
const STICK_LEN = 1.8; // wrist to head, in drum radii
// The close-up sticks wait at the ready this long after their last stroke,
// then drop away below the screen, gone at STICK_GONE (seconds).
const STICK_IDLE = 0.8;
const STICK_GONE = 1.15;
// The pairs of sticks the player can choose in Settings (Drumsticks): the
// first is BD-U20/21, the others BD-U22 to BD-U25, all drawn to one layout.
const STICK_SETS = [
  { L: 'hud-stick-trac', R: 'hud-stick-nhi' },
  { L: 'hud-stick-trac-pestle', R: 'hud-stick-nhi-bamboo' },
  { L: 'hud-stick-trac-lacquer', R: 'hud-stick-nhi-horn' },
];

export const hud = {
  /**
   * Trắc's beater for each deep stroke, from the bottom left onto the
   * sun-star; Nhị's stick for each rim stroke, from the right onto the rim.
   * A tap on the touch drum is struck where it landed instead (a rim tap on
   * the left half brings Nhị's stick in from the left).
   *
   * The sticks are seen from behind the drum, so height above its face reads
   * as depth: a raised stick is drawn larger, pivoted up about the wrist, with
   * its shadow fallen further below it on the drum. A stroke therefore comes
   * down onto the face: Trắc's beater descends onto the centre, Nhị's stick
   * comes in from the side and a little from above onto the rim.
   *
   * The stroke is already sounding when it is drawn, so the stick is on the
   * drum from the first frame (a swing in would only show late), rests there
   * for 50 ms and springs back up to the ready. While strokes keep coming it
   * waits there; 0.8 s after its last stroke it drops away below the screen.
   */
  closeSticks(cx, cy, R, t, touch = false) {
    const g = this.ctx;
    for (const drum of ['L', 'R']) {
      const since = t - this.flash[drum];
      if (!(since >= 0 && since < STICK_GONE)) continue;
      const st = STICKS[drum];
      // lift: 0 on the drum, 1 raised at the ready (an ease-out, quick off the drum).
      let lift;
      if (since < 0.05) lift = 0;
      else if (this.reduceMotion) lift = since < 0.12 ? 0 : 1;
      else lift = 1 - (1 - Math.min(1, (since - 0.05) / 0.18)) ** 3;
      // drop: 0 in play, 1 gone below the screen (an ease-in, slow to leave).
      const drop = since < STICK_IDLE ? 0 : ((since - STICK_IDLE) / (STICK_GONE - STICK_IDLE)) ** 2;
      const L = STICK_LEN * R;
      let ang = touch ? st.angTouch : st.ang;
      let at = (touch && st.atTouch) || st.at;
      // The art shows Trắc's right hand and Nhị's left; mirrored across the
      // stick's line, the hand on the left of the drum is a left hand and the
      // one on the right a right hand.
      let mirror = true;
      const tap = touch && this.tapOnDrum(drum, this.flash[drum], cx, cy, R);
      if (tap) {
        at = tap;
        // A rim tap on the left: Nhị's arm comes in mirrored, from the left
        // (a left hand again).
        if (drum === 'R' && tap[0] < 0) {
          ang = Math.PI - ang;
          mirror = false;
        }
      }
      const head = [cx + at[0] * R, cy + at[1] * R];
      // Raised: the stick turns up about the wrist (head higher on the
      // screen), the arm draws back along its line (for Nhị's sideways
      // stroke), and it grows as it nears the eye.
      const fromLeft = Math.cos(ang) > 0;
      const dir = ang + (fromLeft ? -st.tip : st.tip) * lift;
      const back = st.back * R * lift;
      const grow = 1 + st.grow * lift;
      let wx = head[0] - Math.cos(ang) * (L + back) + (fromLeft ? -1 : 1) * st.side * R * lift;
      let wy = head[1] - Math.sin(ang) * (L + back);
      if (drop > 0) {
        // Down and out of the frame: far enough that the head (its highest
        // point) clears the bottom edge.
        const topY = Math.min(wy, wy + Math.sin(dir) * L * grow) - 0.4 * R * grow;
        wy += drop * Math.max(0, H - topY + 8);
      }
      g.save();
      g.translate(wx, wy);
      g.rotate(dir);
      g.scale(grow, mirror ? -grow : grow);
      // The shadow on the drum falls further below the stick the higher it is.
      // (Shadow offsets are in canvas pixels, not drawing units.)
      g.shadowColor = `rgba(0,0,0,${0.5 - 0.15 * lift})`;
      g.shadowBlur = (6 + 12 * lift) * this.pixel;
      g.shadowOffsetX = (fromLeft ? -4 : 4) * lift * this.pixel;
      g.shadowOffsetY = (5 + 0.3 * R * lift) * this.pixel;
      const set = STICK_SETS[this.stickSet] || STICK_SETS[0];
      const img = this.art.get(set[drum]) || this.art.get(st.id);
      if (img) {
        // The delivered close-up, turned so its wrist-to-head line is ours.
        const a = st.art;
        const iw = img.width;
        const ih = img.height;
        const dx = (a.head[0] - a.wrist[0]) * iw;
        const dy = (a.head[1] - a.wrist[1]) * ih;
        const k = L / Math.hypot(dx, dy);
        g.rotate(-Math.atan2(dy, dx));
        g.drawImage(img, -a.wrist[0] * iw * k, -a.wrist[1] * ih * k, iw * k, ih * k);
      } else this.standinStick(L, R, drum);
      g.restore();
      // The landing point flashes on contact.
      if (since < 0.11 && !this.reduceMotion) {
        g.save();
        g.globalAlpha = 0.7 * (1 - since / 0.11);
        g.fillStyle = drum === 'L' ? P.paper : P.lacquer;
        star(g, head[0], head[1], R * 0.32, R * 0.08, 8);
        g.restore();
      }
    }
  },

  /**
   * Where on the drum the tap behind this stroke landed, in drum radii from
   * the centre, or null when it was not a tap on the drum (a key, a button,
   * or a thumb at the screen's edge). A centre tap lands where it was; a rim
   * tap lands on the rim at its angle.
   */
  tapOnDrum(drum, at, cx, cy, R) {
    const tap = (this.taps || []).findLast((p) => p.target === drum && Math.abs(p.t - at) < 0.05);
    if (!tap) return null;
    const dx = (tap.x - cx) / R;
    const dy = (tap.y - cy) / R;
    const d = Math.hypot(dx, dy);
    if (d >= TOUCH.drum.reach) return null;
    if (drum === 'L') return [dx, dy];
    const a = Math.atan2(dy, dx);
    return [Math.cos(a) * 0.92, Math.sin(a) * 0.92];
  },

  /**
   * The first chapter's lessons: the list at the top left under the army's
   * bar (done ticked, the current one marked), and the praise for a lesson
   * just done, large in the middle of the field for a moment.
   */
  lessons(view, k = 1) {
    const g = this.ctx;
    const t = view.songTime;
    const L = view.lessons;
    const by = Math.min(k, 1.3);
    g.save();
    g.translate(24, 58);
    g.scale(by, by);
    const rowH = 21;
    g.fillStyle = 'rgba(22,21,26,0.5)';
    g.beginPath();
    g.roundRect(-8, -4, 232, L.list.length * rowH + 30, 8);
    g.fill();
    g.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = P.paperShade;
    g.fillText(T.lessons.panelTitle, 0, 12);
    L.list.forEach((l, i) => {
      const y = 32 + i * rowH;
      g.font = `${l.current ? 700 : 500} 14px "Be Vietnam Pro", system-ui, sans-serif`;
      g.fillStyle = l.done ? P.bronzeLight : l.current ? P.paper : 'rgba(242,232,213,0.5)';
      g.fillText(l.done ? '✓' : l.current ? '▸' : '·', 2, y);
      g.fillText(l.name, 22, y);
    });
    g.restore();
    // Praise for the lesson just done.
    const pr = L.praise;
    if (pr) {
      const q = (t - pr.t) / 2.2;
      const a = q < 0.1 ? q / 0.1 : q > 0.75 ? Math.max(0, 1 - (q - 0.75) / 0.25) : 1;
      const rise = this.reduceMotion ? 0 : (1 - Math.min(1, q * 4)) * 14;
      g.save();
      g.globalAlpha = a;
      g.textAlign = 'center';
      g.font = `700 ${Math.round(30 * Math.min(k, 1.2))}px "Cormorant Garamond", Georgia, serif`;
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 8;
      g.fillStyle = P.bronzeLight;
      g.fillText(`✓  ${pr.text}`, W / 2, 190 + rise);
      g.restore();
    }
  },

  /** A paper-cut forearm and stick along +x, the wrist at the origin (until BD-U20/21 arrive). */
  standinStick(L, R, drum) {
    const g = this.ctx;
    const trac = drum === 'L';
    // Forearm, running back out of frame, with the sleeve's edge.
    g.fillStyle = trac ? '#1A1714' : P.lacquer;
    g.beginPath();
    g.roundRect(-1.9 * R, -0.21 * R, 1.0 * R, 0.42 * R, 0.08 * R);
    g.fill();
    g.fillStyle = '#E9D6B4';
    g.beginPath();
    g.roundRect(-1.05 * R, -0.15 * R, 1.15 * R, 0.3 * R, 0.14 * R);
    g.fill();
    // The cuff at the wrist: bronze bands, a row of cut diamonds.
    g.fillStyle = trac ? P.bronze : '#6B3F1E';
    g.fillRect(-0.36 * R, -0.16 * R, 0.24 * R, 0.32 * R);
    g.fillStyle = trac ? P.bronzeLight : P.paper;
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate(-0.24 * R, (-0.09 + i * 0.09) * R);
      g.rotate(Math.PI / 4);
      g.fillRect(-0.025 * R, -0.025 * R, 0.05 * R, 0.05 * R);
      g.restore();
    }
    // The stick, through the fist.
    const th = (trac ? 0.1 : 0.065) * R;
    g.fillStyle = '#4A2C17';
    g.beginPath();
    g.roundRect(-0.05 * R, -th / 2, L, th, th / 2);
    g.fill();
    g.fillStyle = '#E9D6B4';
    g.beginPath();
    g.ellipse(0.06 * R, 0, 0.15 * R, 0.13 * R, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(74,44,23,0.6)';
    g.lineWidth = Math.max(1, 0.02 * R);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo((0.0 + i * 0.07) * R, -0.12 * R);
      g.lineTo((0.0 + i * 0.07) * R, 0.0);
      g.stroke();
    }
    // The head: Trắc's flat padded beater, Nhị's round knob.
    g.fillStyle = trac ? '#8A5A2E' : '#5E3A1E';
    g.beginPath();
    if (trac) g.ellipse(L, 0, 0.11 * R, 0.21 * R, 0, 0, Math.PI * 2);
    else g.arc(L, 0, 0.12 * R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = trac ? P.bronzeLight : 'rgba(242,232,213,0.35)';
    g.beginPath();
    if (trac) g.ellipse(L - 0.02 * R, 0, 0.05 * R, 0.13 * R, 0, 0, Math.PI * 2);
    else g.arc(L - 0.03 * R, -0.04 * R, 0.04 * R, 0, Math.PI * 2);
    g.fill();
  },


  hud(view) {
    // The success moment owns the screen: no play HUD under it.
    if (view.success) return;
    const g = this.ctx;
    const t = view.songTime;
    // Touch play uses a bigger drum and larger text; desktop keeps the small HUD.
    const touch = !!view.touch;
    const cx = W / 2;
    const cy = touch ? TOUCH.drum.y : H - 92;
    const R = touch ? TOUCH.drum.r : 58;
    const s = R / 58;
    // Text size: larger on touch screens, and on small screens large enough
    // to read at arm's length (about 14 CSS pixels for body text).
    const k = Math.max(touch ? 1.3 : 1, this.compact ? Math.min(2, 0.95 / this.cssScale) : 1);
    const compact = this.compact;
    const grow = Math.min(1.3, k / (touch ? 1.3 : 1)); // the dots grow with the text, a little
    const font = (w, px, fam = '"Be Vietnam Pro", system-ui, sans-serif') => `${w} ${Math.round(px * k)}px ${fam}`;
    const serif = '"Cormorant Garamond", Georgia, serif';
    const scaled = (ax, ay, f, by = k) => {
      g.save();
      g.translate(ax, ay);
      g.scale(by, by);
      g.translate(-ax, -ay);
      f();
      g.restore();
    };
    // The drum shivers on every stroke.
    const sh = this.shiver(Math.max(this.flash.L, this.flash.R), t, touch ? 3.5 : 2);
    g.save();
    g.translate(sh.dx, sh.dy);
    if (touch) this.touchDrumBand(cx, cy, R, t);
    const beatInMeasure = view.heron; // lit heron: the army's beat, or the phrase's
    const beatPhase = view.beatFloat - Math.floor(view.beatFloat);
    const responding = view.inResponse;

    // The drum face (tympanum): rings, herons, the star. Drum Practice may
    // have swapped in another kit, drawn by kitFace.
    const kitId = view.practice ? view.practice.kit.id : 'bronze';
    const img = kitId === 'bronze' ? this.art.get('hud-drum') : null;
    g.save();
    g.shadowColor = view.ready ? P.bronzeLight : 'rgba(0,0,0,0.5)';
    g.shadowBlur = view.ready ? 18 + 8 * Math.sin(t * 4) : 14;
    g.shadowOffsetY = view.ready ? 0 : 6;
    if (img) g.drawImage(img, cx - R, cy - R, R * 2, R * 2);
    else if (kitId !== 'bronze') this.kitFace(cx, cy, R, kitId);
    else {
      g.fillStyle = P.bronze;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (!img && kitId === 'bronze') {
      g.strokeStyle = P.ink;
      g.globalAlpha = 0.55;
      for (const rr of [R - 6, R - 20, R - 24, R - 38]) {
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(cx, cy, rr, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // Four herons around the ring: one per beat of the pattern or the answer.
    for (let i = 0; i < (kitId === 'bronze' ? 4 : 0); i++) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
      const hx = cx + Math.cos(a) * (R - 13 * s);
      const hy = cy + Math.sin(a) * (R - 13 * s);
      const lit = i === beatInMeasure;
      g.fillStyle = lit ? (responding ? P.verdigris : P.paper) : 'rgba(22,21,26,0.6)';
      g.save();
      g.translate(hx, hy);
      g.rotate(a + Math.PI / 2);
      leaf(g, 0, 0, (lit ? 13 : 10) * s, -0.4, 0.3);
      leaf(g, 0, 0, (lit ? 13 : 10) * s, Math.PI + 0.4, 0.3);
      g.restore();
    }
    // Star pulses with the army's beat; flashes on strokes.
    const pulse = responding ? Math.max(0, 1 - beatPhase * 3) : 0;
    const fl = Math.max(0, 1 - (t - this.flash.L) * 5);
    const fr = Math.max(0, 1 - (t - this.flash.R) * 5);
    g.fillStyle = view.spirit ? P.bronzeLight : P.paper;
    if (kitId === 'bronze') {
      g.globalAlpha = 0.5 + 0.5 * Math.max(pulse * 0.6, fl);
      star(g, cx, cy, 16 * s + fl * 6, 12 * s, 12);
    } else if (fl > 0) {
      // Another kit: its face lights where it is struck.
      g.globalAlpha = fl * 0.35;
      g.beginPath();
      g.arc(cx, cy, R * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (fr > 0 && !touch) {
      g.strokeStyle = P.lacquer;
      g.globalAlpha = fr;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, R - 2, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    if (touch) this.touchDrumLabels(cx, cy, R, k / 1.3);
    for (const w of this.wakes || []) {
      const q = (t - w.t) / 1.2;
      if (q >= 0 && q <= 1) this.wakeBurst(cx, cy, R * 4.2, q);
    }
    g.restore();
    // The sisters' sticks, close up, land where each stroke is struck.
    // (In the battle chapters and in Drum Practice and Training; not in the other chapters.)
    if (kitId === 'bronze' && (view.practice || view.training || view.mode === 'battle')) this.closeSticks(cx, cy, R, t, touch);

    // The phrase: the accepted pattern stays filled until the drum is ready
    // again; while drumming, the likeliest pattern is shown with the strokes
    // still to come drawn faintly.
    const slotY = touch ? cy - R * TOUCH.drum.band - 20 * grow : cy - R - 26 * grow;
    const cell = (touch ? 44 : 36) * grow;
    const dotR = (touch ? 14 : 11) * grow;
    const labelY = slotY - 26 * k;
    const ph = view.phraseView;
    // The line above the dots: whose turn it is, or the command being played.
    let label = null;
    let labelColor = P.paper;
    if (view.miss) {
      // The X over the dots says it; no words needed.
    } else if (ph && ph.caller) label = T.hud.listen;
    else if (ph && !ph.done && view.mode === 'echo' && !ph.filled) label = T.hud.yourTurnAnswer;
    else if (ph && ph.done && view.mode !== 'battle') label = view.mode === 'casting' ? T.hud.pouring : T.hud.answered;
    else if (ph && ph.done) {
      const c = COMMANDS.find((k) => k.id === ph.pattern.command);
      const charging = view.cycle && view.cycle.command === 'charge';
      label = charging ? T.hud.elephantCharges : txt('hud.commandPlayed', { command: c.name, tier: ROMAN[ph.pattern.tier], meaning: c.gloss });
    } else if (!ph && view.sustaining) {
      label = touch ? T.hud.armyKeepsRhythmTouch : T.hud.armyKeepsRhythm;
      labelColor = P.paperShade;
    }
    g.font = font(600, label === null || labelColor === P.paper ? 15 : 14);
    if (view.practice) this.practiceDots(view, { cx, slotY, cell, dotR, k, grow, touch, font });
    else if (touch) {
      // A dark band behind the dots and the label keeps them readable over the field.
      const bw = Math.max(4 * cell + 32, label ? g.measureText(label).width + 28 : 0);
      g.fillStyle = 'rgba(22,21,26,0.45)';
      g.fillRect(cx - bw / 2, labelY - 22 * k, bw, slotY + dotR + 8 - (labelY - 22 * k));
    }
    if (view.practice) {
      // Drawn by practiceDots.
    } else if (view.miss) {
      // A broken phrase: what was played, the wrong stroke crossed out.
      const m = view.miss;
      const x0 = cx - (spanOf(m) / 2) * cell;
      this.pattern(x0, slotY, { strokes: m.strokes }, dotR, cell, m.filled);
      const q = Math.min(1, (t - m.t) / 0.12);
      g.save();
      g.strokeStyle = '#FFF4E0';
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 4;
      g.lineWidth = 3;
      g.lineCap = 'round';
      let hx;
      let hw;
      if (m.timing) {
        // Too soon or too late: the whole beat it fell in is crossed out.
        hx = x0 + m.beat * cell + cell / 2;
        hw = cell * 0.46;
      } else {
        hx = this.patternX(x0, m.strokes, m.wrong, cell);
        hw = dotR * 1.15;
      }
      const hh = hw * 0.9 * q;
      g.beginPath();
      g.moveTo(hx - hw * q, slotY - hh);
      g.lineTo(hx + hw * q, slotY + hh);
      g.moveTo(hx + hw * q, slotY - hh);
      g.lineTo(hx - hw * q, slotY + hh);
      g.stroke();
      g.restore();
    } else if (ph) {
      this.pattern(cx - (spanOf(ph.pattern) / 2) * cell, slotY, ph.pattern, dotR, cell, ph.filled, ph.done, false, 1, ph.pop);
    } else {
      // Empty slots, one per beat (Number of beats; four by default).
      const n = view.beats || 4;
      for (let i = 0; i < n; i++) {
        g.strokeStyle = P.paper;
        g.globalAlpha = view.ready ? 0.45 + 0.25 * Math.sin(t * 4) : 0.35;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(cx - ((n - 1) / 2) * cell + i * cell, slotY, dotR, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (label) {
      g.font = font(600, labelColor === P.paper ? 15 : 14);
      g.textAlign = 'center';
      g.fillStyle = labelColor;
      g.fillText(label, cx, labelY);
    }

    // Dots tumbling away after a reset.
    if (this.clearing && t >= this.clearing.t && t - this.clearing.t < 0.5) {
      const q = (t - this.clearing.t) / 0.5;
      g.save();
      g.globalAlpha = 1 - q;
      g.translate(0, q * q * 40);
      this.pattern(cx - (spanOf(this.clearing.pattern) / 2) * (cell + 30 * q), slotY, this.clearing.pattern, dotR * (1 - 0.4 * q), cell + 30 * q, this.clearing.filled);
      g.restore();
    }

    // Confirmations for the reset and guard buttons: under the drum, or
    // beside it on touch screens, where the drum fills the bottom edge.
    if (view.confirm && t - view.confirm.t < 0.9) {
      const q = (t - view.confirm.t) / 0.9;
      g.save();
      g.globalAlpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
      g.font = font(700, 18);
      g.textAlign = touch ? 'left' : 'center';
      g.fillStyle = view.confirm.color;
      g.shadowColor = 'rgba(0,0,0,0.8)';
      g.shadowBlur = 6;
      if (touch) g.fillText(view.confirm.text, cx + R * TOUCH.drum.band + 20, cy - 30 - q * 4);
      else g.fillText(view.confirm.text, cx, H - 10 - q * 4);
      g.restore();
    }

    // Judgement text.
    if (view.feedback && t - view.feedback.t < 0.6) {
      const q = (t - view.feedback.t) / 0.6;
      g.globalAlpha = 1 - q;
      g.font = font(700, 26, serif);
      g.textAlign = 'center';
      g.fillStyle = view.feedback.color;
      g.fillText(view.feedback.text, cx, labelY - 24 * k - q * 16);
      g.globalAlpha = 1;
    }

    // Combo and the waking drum: beside the drum, or under the army's bar on touch screens.
    if (view.combo > 1 && view.mode === 'battle') {
      g.font = font(700, 22, serif);
      g.textAlign = 'left';
      g.fillStyle = view.spirit ? P.bronzeLight : P.paper;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.8)';
      g.shadowBlur = touch ? 6 : 0;
      g.fillText(txt(view.spirit ? 'hud.drumAwake' : 'hud.chain', { count: view.combo }), touch ? 24 : cx + R + 22, touch ? 22 + 60 * k : cy + 8);
      g.restore();
    }

    // Command list: every unlocked command and tier, kept low and clear of
    // the field. The tier being played is lit.
    g.textAlign = 'left';
    const list = view.mode === 'battle' ? COMMANDS.filter((c) => view.unlocked.includes(c.id)) : [];
    if (compact && list.length) {
      // Small screens: each command on two lines (its name, then its tiers),
      // narrow enough to grow large and still stay clear of the drum.
      const px = 22;
      // Each tier's column fits its rhythm (Number of beats; four by default).
      const tierW = Math.max(70, 30 + (view.beats || 4) * 12);
      const blockW = Math.max(120, 18 + view.maxTier * tierW);
      const by = (touch ? 500 : 570) / (px + blockW);
      g.save();
      g.translate(0, H);
      g.scale(Math.min(k, by), Math.min(k, by));
      g.translate(0, -H);
      let py = H - 14 - (list.length - 1) * 38 - 18;
      g.fillStyle = 'rgba(22,21,26,0.6)';
      g.fillRect(px - 10, py - 18, blockW + 12, list.length * 38 + 6);
      for (const c of list) {
        const active = ph && ph.done && ph.pattern.command === c.id;
        g.font = '600 14px "Be Vietnam Pro", system-ui, sans-serif';
        g.fillStyle = active ? P.bronzeLight : P.paper;
        g.fillText(txt('hud.commandRow', { command: c.name, meaning: c.short || c.gloss }), px, py);
        c.tiers.slice(0, view.maxTier).forEach((text, i) => {
          const x0 = px + i * tierW;
          const lit = active && ph.pattern.tier === i + 1;
          g.font = '600 11px "Be Vietnam Pro", system-ui, sans-serif';
          g.fillStyle = lit ? P.bronzeLight : 'rgba(242,232,213,0.6)';
          g.fillText(ROMAN[i + 1], x0, py + 18);
          this.pattern(x0 + 16, py + 13, { strokes: parsePattern(text) }, 4.4, 12, Infinity, lit, true);
        });
        py += 38;
      }
      g.restore();
    } else {
      if (touch) {
        g.save();
        g.translate(0, H);
        g.scale(1.2, 1.2);
        g.translate(0, -H);
      }
      const px = 22;
      const rowH = 22;
      const cellS = 12;
      const colW = Math.max(84, 36 + (view.beats || 4) * cellS);
      let py = H - 14 - (list.length - 1) * rowH;
      g.fillStyle = 'rgba(22,21,26,0.6)';
      if (list.length) g.fillRect(px - 10, py - 19, 120 + view.maxTier * colW, list.length * rowH + 8);
      for (const c of list) {
        const active = ph && ph.done && ph.pattern.command === c.id;
        g.font = '600 14px "Be Vietnam Pro", system-ui, sans-serif';
        g.fillStyle = active ? P.bronzeLight : P.paper;
        g.fillText(txt('hud.commandRow', { command: c.name, meaning: c.short || c.gloss }), px, py);
        c.tiers.slice(0, view.maxTier).forEach((text, i) => {
          const x0 = px + 116 + i * colW;
          const lit = active && ph.pattern.tier === i + 1;
          g.font = '600 11px "Be Vietnam Pro", system-ui, sans-serif';
          g.fillStyle = lit ? P.bronzeLight : 'rgba(242,232,213,0.6)';
          g.fillText(ROMAN[i + 1], x0, py);
          this.pattern(x0 + 18, py - 5, { strokes: parsePattern(text) }, 4.4, cellS, Infinity, lit, true);
        });
        py += rowH;
      }
      if (touch) g.restore();
    }

    // Troops and goal.
    const b = view.battle;
    const sess = view.session;
    if (view.mode === 'practice') {
      if (!touch) this.practiceControls(view, k);
    } else if (view.training) {
      this.trainingPanel(view);
    } else if (view.mode === 'echo') {
      const words = T.hud.progress;
      scaled(W - 24, 22, () => this.bar(W - 304, 22, 280, sess.index / sess.calls.length, txt('hud.progressCount', { what: words[view.stage.caller] || words.other, done: sess.index, total: sess.calls.length }), P.bronzeLight));
    } else if (view.mode === 'casting') {
      scaled(W - 24, 22, () => this.pourLine(W - 304, 22, 280, sess, t));
      if (sess.u !== null) {
        g.font = font(600, 15);
        g.textAlign = 'left';
        g.fillStyle = P.paper;
        g.fillText(T.hud.keepBellowsPace, 24, H - 18);
      }
    } else {
      scaled(24, 22, () => this.bar(24, 22, 280, b.army.troops / b.army.maxTroops, T.hud.armyBar, P.lacquer));
      if (b.survive) {
        scaled(W - 24, 22, () => this.bar(W - 304, 22, 280, Math.min(1, b.time / b.survive), txt('hud.holdTheFord', { seconds: Math.max(0, Math.ceil(b.survive - b.time)) }), P.verdigris));
      } else {
        const goals = b.enemies.filter((e) => e.goal);
        const goalHp = goals.reduce((s2, e) => s2 + Math.max(0, e.hp), 0) / goals.reduce((s2, e) => s2 + e.maxHp, 0);
        scaled(W - 24, 22, () => this.bar(W - 304, 22, 280, goalHp, goals[0].type === 'fort' ? T.hud.hanFort : T.hud.strawTargets, P.iron));
      }
    }

    if (view.lessons) this.lessons(view, k);

    if (view.hint) {
      // Larger on touch and small screens, never wider than the screen: a
      // long line breaks in two rather than shrinking.
      g.font = '500 18px "Be Vietnam Pro", system-ui, sans-serif';
      let lines = [view.hint];
      const fit = (ls) => Math.max(...ls.map((l) => this.richWidth(l))) + 36;
      if (k > 1 && fit(lines) * k > W - 40) {
        const words = view.hint.split(' ');
        let best = null;
        for (let i = 1; i < words.length; i++) {
          const two = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
          if (!best || fit(two) < fit(best)) best = two;
        }
        if (best) lines = best;
      }
      const hintScale = Math.min(k, (W - 40) / fit(lines));
      // Just under the bars, which grow with the text.
      const top = Math.max(70, 22 + 32 * k + 8);
      scaled(cx, top, () => {
        g.font = '500 18px "Be Vietnam Pro", system-ui, sans-serif';
        g.textAlign = 'center';
        const w = fit(lines);
        g.fillStyle = 'rgba(22,21,26,0.7)';
        g.fillRect(cx - w / 2, top, w, 12 + 24 * lines.length + (view.demo && view.hint === view.demo.text ? 18 : 0));
        g.fillStyle = P.paper;
        // On the heard clock, so each light and tap meets its sound.
        const demo = view.demo && view.hint === view.demo.text ? this.demoState(view.demo, view.heard ?? t) : null;
        // Tokens are counted across lines; the rhythm's are the last n.
        const all = lines.reduce((m, l) => m + this.richCount(l), 0);
        const first = demo ? all - demo.n : 0;
        const glow = demo ? (i) => (i >= first ? demo.glow(i - first) : 0) : null;
        let count = 0;
        const centres = [];
        lines.forEach((l, i) => {
          centres.push(...this.richText(l, cx, top + 24 + 24 * i, glow, count));
          count += this.richCount(l);
        });
        if (demo && centres.length >= demo.n) {
          // A paper pointer under the rhythm, tapping up at each stroke.
          const row = centres.slice(first);
          const a = row[Math.floor(demo.pointer)];
          const b = row[Math.min(row.length - 1, Math.ceil(demo.pointer))];
          const f = demo.pointer - Math.floor(demo.pointer);
          const px = a.x + (b.x - a.x) * f;
          const py = Math.max(a.y, b.y) + 14 + 6 * (1 - demo.tap) + (lines.length - 1) * 0;
          g.save();
          g.fillStyle = P.bronzeLight;
          g.shadowColor = 'rgba(0,0,0,0.6)';
          g.shadowBlur = 4;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px - 7, py + 11);
          g.lineTo(px - 2.5, py + 11);
          g.lineTo(px - 2.5, py + 19);
          g.lineTo(px + 2.5, py + 19);
          g.lineTo(px + 2.5, py + 11);
          g.lineTo(px + 7, py + 11);
          g.closePath();
          g.fill();
          g.restore();
        }
      }, hintScale);
    }

    if (touch) this.touchButtons(view);
  },

  /**
   * A struck drum's shiver: a quick decaying shake for a quarter of a second
   * after time t0. Returns the offset to draw it at.
   */
  shiver(t0, t, amp) {
    const dt = t - t0;
    if (this.reduceMotion || dt < 0 || dt > 0.25) return { dx: 0, dy: 0, k: 0 };
    const k = 1 - dt / 0.25;
    return { dx: Math.sin(dt * 95) * amp * k, dy: Math.cos(dt * 70) * amp * 0.6 * k, k };
  },

  /** A companion drum was struck: the barrel drum for the shield, the mõ for a reset. */
  kick(drum, t) {
    this.kicks[drum] = t;
  },

  // Hint text may name controller buttons as ⟨A⟩ ⟨B⟩ ⟨X⟩ ⟨Y⟩: they are drawn as
  // the Xbox face buttons in their standard colours, easier to read than letters.

  /**
   * Split rich text into plain strings and token groups. Tokens: ⟨A⟩ ⟨B⟩ ⟨X⟩
   * ⟨Y⟩ controller buttons, ⟨k:F⟩ a keyboard key, ⟨d:L⟩ / ⟨d:R⟩ the drum's
   * centre and rim. Tokens written with nothing between them (⟨B⟩⟨B⟩) share
   * one beat, a pair or triplet: they are drawn smaller and touching, joined
   * by a beam like the rhythm dots, so they read apart from single beats.
   */
  richParts(text) {
    const TOKEN = /⟨(?:[ABXY]|k:[^⟩]+|d:[LR]|r)⟩/g;
    const out = [];
    for (const piece of text.split(/((?:⟨(?:[ABXY]|k:[^⟩]+|d:[LR]|r)⟩)+)/).filter(Boolean)) {
      const toks = piece.match(TOKEN);
      if (toks && toks.join('') === piece) out.push({ keys: toks.map((k) => k.slice(1, -1)) });
      else out.push(piece);
    }
    return out;
  },

  /** Token sizes for a group of n tokens, at font size `size`. */
  richGroup(n, size) {
    const r = n > 1 ? size * 0.4 : size * 0.55;
    const step = n > 1 ? r * 2 + size * 0.04 : 0;
    // Each group gets a little air on both sides, so beats stand apart.
    const pad = size * 0.12;
    return { r, step, width: pad * 2 + r * 2 + step * (n - 1), pad };
  },

  /** Width of rich text in the current font. */
  richWidth(text) {
    const g = this.ctx;
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(g.font)?.[1] || 18);
    return this.richParts(text).reduce((w, p) => w + (typeof p === 'string' ? g.measureText(p).width : this.richGroup(p.keys.length, size).width), 0);
  },

  /** How many tokens a piece of rich text holds. */
  richCount(text) {
    // Rests (⟨r⟩) are not strokes: the demonstration's pointer skips them.
    return this.richParts(text).reduce((n, p) => n + (typeof p === 'string' ? 0 : p.keys.filter((k) => k !== 'r').length), 0);
  },

  /**
   * Rich text centred on cx, baseline y, in the current font and fill.
   * glow(i) (0..1) lights token i (counted from `first`), swelling it.
   * Returns each token's centre, for the demonstration's pointer.
   */
  richText(text, cx, y, glow = null, first = 0) {
    const g = this.ctx;
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(g.font)?.[1] || 18);
    const colors = { A: '#107C10', B: '#E81123', X: '#0078D4', Y: '#FFB900' };
    const fill = g.fillStyle;
    const align = g.textAlign;
    const font = g.font;
    const centres = [];
    let index = first;
    g.textAlign = 'left';
    let x = cx - this.richWidth(text) / 2;
    for (const p of this.richParts(text)) {
      if (typeof p === 'string') {
        g.fillStyle = fill;
        g.fillText(p, x, y);
        x += g.measureText(p).width;
        continue;
      }
      const { r, step, width, pad } = this.richGroup(p.keys.length, size);
      const by = y - size * 0.36;
      const x0 = x + pad + r;
      if (p.keys.length > 1) {
        // The beam under a pair or triplet.
        g.strokeStyle = fill;
        g.lineWidth = Math.max(1.5, size * 0.09);
        g.beginPath();
        g.moveTo(x0 - r * 0.5, by + r + size * 0.14);
        g.lineTo(x0 + step * (p.keys.length - 1) + r * 0.5, by + r + size * 0.14);
        g.stroke();
      }
      p.keys.forEach((k, i) => {
        const bx = x0 + step * i;
        if (k === 'r') {
          // A rest: a short dash in its place in the beat; it has no stroke to light.
          g.save();
          g.strokeStyle = fill;
          g.globalAlpha = 0.6;
          g.lineWidth = Math.max(2, size * 0.12);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(bx - r * 0.6, by);
          g.lineTo(bx + r * 0.6, by);
          g.stroke();
          g.restore();
          return;
        }
        const lit = glow ? glow(index) : 0;
        const rr = r * (1 + 0.35 * lit);
        centres.push({ x: bx, y: by, r: rr });
        index += 1;
        g.save();
        if (lit > 0) {
          g.shadowColor = '#FFE2A8';
          g.shadowBlur = 16 * lit;
        }
        if (k.startsWith('d:')) {
          // The drum's centre (a bronze disc) or rim (a lacquer ring).
          this.glyph(bx, by, k[2], rr * 0.9);
        } else if (k.startsWith('k:')) {
          // A keyboard key: a paper keycap with its letter.
          const w = rr * 1.9;
          g.fillStyle = P.paper;
          g.beginPath();
          g.roundRect(bx - w / 2, by - w / 2, w, w, rr * 0.35);
          g.fill();
          g.shadowBlur = 0;
          g.font = `700 ${Math.round(rr * 1.15)}px "Be Vietnam Pro", system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillStyle = P.ink;
          g.fillText(k.slice(2), bx, by + rr * 0.4);
        } else {
          // Controller buttons as the game's own drum marks, the letter on
          // top: X the gold tùng disc, B the black-and-red cắc target, A the
          // cream hide of the barrel drum (Y, unused in play, stays plain).
          const face = { X: [P.bronzeLight, null, P.ink], B: [P.ink, P.lacquer, P.paper], A: ['#EADBC0', P.bronze, P.ink] }[k] || [colors[k], null, P.ink];
          g.fillStyle = face[0];
          g.beginPath();
          g.arc(bx, by, rr, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
          if (face[1]) {
            g.strokeStyle = face[1];
            g.lineWidth = rr * (k === 'B' ? 0.3 : 0.16);
            g.beginPath();
            g.arc(bx, by, rr * (k === 'B' ? 0.78 : 0.88), 0, Math.PI * 2);
            g.stroke();
          }
          g.font = `700 ${Math.round(rr * 1.2)}px "Be Vietnam Pro", system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillStyle = face[2];
          g.fillText(k, bx, by + rr * 0.43);
        }
        g.restore();
        g.font = font;
        g.textAlign = 'left';
      });
      x += width;
    }
    g.fillStyle = fill;
    g.textAlign = align;
    return centres;
  },

  /**
   * The demonstration's lights: how lit token i is at time t (a flash as its
   * stroke sounds), and where the pointer is (gliding to the next token just
   * before its stroke). Tokens are the rhythm's strokes in order.
   */
  demoState(demo, t) {
    const n = demo.strokes.length;
    const hits = [];
    const round = (demo.beats || 4) + 1; // each time through, then a beat's rest
    for (let rep = 0; rep < demo.reps; rep++) demo.strokes.forEach((s, i) => hits.push({ i, at: demo.start + (rep * round + s.pos) * demo.u }));
    const glow = (i) => {
      let v = 0;
      for (const h of hits) if (h.i === i && t >= h.at) v = Math.max(v, 1 - (t - h.at) / 0.35);
      return Math.max(0, v);
    };
    // The pointer rests on the last token struck and slides to the next one
    // over the moment before it sounds.
    let k = hits.findIndex((h) => h.at > t);
    if (k === -1) k = hits.length;
    const prev = hits[k - 1];
    const next = hits[k];
    let pos = prev ? prev.i : next ? next.i : 0;
    let tap = prev ? Math.max(0, 1 - (t - prev.at) / 0.18) : 0;
    if (prev && next) {
      // A short, quick hop that lands exactly on the stroke.
      const lead = Math.min(0.12, (next.at - prev.at) * 0.4);
      const q = Math.max(0, Math.min(1, (t - (next.at - lead)) / lead));
      pos = prev.i + (next.i - prev.i) * (q * q * (3 - 2 * q));
    } else if (!prev && next) pos = next.i;
    return { glow: (i) => glow(i % n), pointer: pos, tap, n };
  },

  /**
   * A pattern as beat cells: one stroke fills its cell, a pair or a triplet
   * shares it (smaller, joined by a beam). The first `filled` strokes are
   * solid; the rest are faint, still to come.
   */
  /** Where pattern() draws stroke i (same layout as pattern()). */
  patternX(x, strokes, i, cell, small = false) {
    const s = strokes[i];
    const beat = Math.floor(s.pos);
    // A beat's division: its slots, silent ones included (parsePattern's div).
    const n = s.div || strokes.filter((q) => Math.floor(q.pos) === beat).length;
    const inner = s.pos - beat;
    return x + beat * cell + cell / 2 + (n === 1 ? 0 : (inner - (n - 1) / (2 * n)) * cell * (small ? 1.05 : 0.95));
  },

  pattern(x, y, pattern, r, cell, filled = Infinity, glow = false, small = false, alpha = 1, pop = null) {
    const g = this.ctx;
    const strokes = pattern.strokes;
    // Each beat's division: its slots, silent ones included.
    const perBeat = {};
    const played = {};
    for (const s of strokes) {
      const b = Math.floor(s.pos);
      played[b] = (played[b] || 0) + 1;
      perBeat[b] = Math.max(perBeat[b] || 0, s.div || 0);
    }
    for (const b of Object.keys(played)) perBeat[b] = Math.max(perBeat[b], played[b]);
    // Rests: a short dash for a silent slot inside a beat, a longer one for a silent beat.
    const lastBeat = strokes.length ? Math.floor(strokes[strokes.length - 1].pos) : 0;
    g.save();
    g.globalAlpha = 0.5 * alpha;
    g.strokeStyle = P.paper;
    g.lineCap = 'round';
    for (let b = 0; b <= lastBeat; b++) {
      const n = perBeat[b];
      const bx = x + b * cell + cell / 2;
      if (!n) {
        g.lineWidth = small ? 1.5 : 3;
        g.beginPath();
        g.moveTo(bx - r * 0.6, y);
        g.lineTo(bx + r * 0.6, y);
        g.stroke();
        continue;
      }
      if (n === played[b]) continue;
      const filledSlots = new Set(strokes.filter((s) => Math.floor(s.pos) === b).map((s) => Math.round((s.pos - b) * n)));
      const rr = n === 2 ? r * 0.72 : r * 0.62;
      g.lineWidth = small ? 1 : 2.4;
      for (let k = 0; k < n; k++) {
        if (filledSlots.has(k)) continue;
        const sx = bx + (k / n - (n - 1) / (2 * n)) * cell * (small ? 1.05 : 0.95);
        g.beginPath();
        g.moveTo(sx - rr * 0.55, y);
        g.lineTo(sx + rr * 0.55, y);
        g.stroke();
      }
    }
    g.restore();
    strokes.forEach((s, i) => {
      const beat = Math.floor(s.pos);
      const n = perBeat[beat];
      const inner = s.pos - beat;
      // pop: the stroke being played back right now swells and fades back.
      const swell = pop && pop.i === i ? 1 + 0.35 * pop.k : 1;
      const rr = (n === 1 ? r : n === 2 ? r * 0.72 : r * 0.62) * swell;
      const sx = x + beat * cell + cell / 2 + (n === 1 ? 0 : (inner - (n - 1) / (2 * n)) * cell * (small ? 1.05 : 0.95));
      g.globalAlpha = (i < filled ? 1 : 0.28) * alpha;
      if (glow && i < filled && !small) {
        g.save();
        g.shadowColor = P.bronzeLight;
        g.shadowBlur = 10;
        this.glyph(sx, y, s.drum, rr);
        g.restore();
      } else this.glyph(sx, y, s.drum, rr);
    });
    // Beams under pairs and triplets.
    g.globalAlpha = 0.8 * alpha;
    g.strokeStyle = P.paper;
    g.lineWidth = small ? 1 : 1.5;
    for (const [beat, n] of Object.entries(perBeat)) {
      if (n < 2) continue;
      const bx = x + Number(beat) * cell + cell / 2;
      const half = ((n - 1) / (2 * n)) * cell * (small ? 1.05 : 0.95);
      g.beginPath();
      g.moveTo(bx - half, y + r + 3);
      g.lineTo(bx + half, y + r + 3);
      g.stroke();
      if (n === 3 && !small) {
        g.font = '600 10px "Be Vietnam Pro", system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = P.paper;
        g.fillText('3', bx, y + r + 14);
      }
    }
    g.globalAlpha = 1;
  },

  /** Start the reset animation for the phrase that was showing. */
  clearDots(phraseView, t) {
    this.clearing = { pattern: phraseView.pattern, filled: phraseView.filled, t };
  },

  glyph(x, y, d, r) {
    const g = this.ctx;
    if (d === 'S') {
      // Drum Practice's secondary drum: a verdigris diamond.
      g.fillStyle = P.verdigris;
      g.beginPath();
      g.moveTo(x, y - r);
      g.lineTo(x + r, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r, y);
      g.closePath();
      g.fill();
      return;
    }
    if (d === 'L') {
      g.fillStyle = P.bronzeLight;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = P.lacquer;
      g.fillStyle = P.lacquer;
      g.lineWidth = r * 0.35;
      g.beginPath();
      g.arc(x, y, r * 0.82, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(x, y, r * 0.25, 0, Math.PI * 2);
      g.fill();
    }
  },

  /**
   * The casting line: the bronze rising towards the last drum, with each
   * drum a mark along it. Marks passed glow; the checkpoint the level can
   * sink back to is the last one passed.
   */
  pourLine(x, y, w, sess, t) {
    const g = this.ctx;
    g.font = '600 14px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = P.paper;
    g.fillText(txt('hud.drumsCast', { done: sess.cast, total: sess.drums }), x, y + 12);
    const by = y + 20;
    g.fillStyle = 'rgba(22,21,26,0.6)';
    g.fillRect(x, by, w, 12);
    // The banked part (to the checkpoint) solid, the part still at risk lighter.
    g.fillStyle = P.bronze;
    g.fillRect(x, by, w * sess.checkpoint, 12);
    const grad = g.createLinearGradient(x + w * sess.checkpoint, 0, x + w * sess.level, 0);
    grad.addColorStop(0, '#E8A04A');
    grad.addColorStop(1, '#FFD08A');
    g.fillStyle = grad;
    g.fillRect(x + w * sess.checkpoint, by, w * Math.max(0, sess.level - sess.checkpoint), 12);
    // The drums: marks on the line.
    for (let i = 1; i <= sess.drums; i++) {
      const mx = x + (w * i) / sess.drums;
      const passed = i <= sess.cast;
      g.fillStyle = passed ? P.bronzeLight : P.paperShade;
      g.save();
      if (passed) {
        g.shadowColor = '#FFD08A';
        g.shadowBlur = 8;
      }
      g.beginPath();
      g.arc(mx - (i === sess.drums ? 6 : 0), by + 6, 7, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = P.ink;
      g.font = '700 9px "Be Vietnam Pro", system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(i), mx - (i === sess.drums ? 6 : 0), by + 9);
    }
    g.textAlign = 'left';
  },

  bar(x, y, w, frac, label, color) {
    const g = this.ctx;
    g.fillStyle = 'rgba(22,21,26,0.6)';
    g.fillRect(x, y + 20, w, 10);
    g.fillStyle = color;
    g.fillRect(x, y + 20, w * Math.max(0, frac), 10);
    g.font = '600 14px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = P.paper;
    g.fillText(label, x, y + 12);
  },
};
