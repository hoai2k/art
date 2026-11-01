import { T, txt } from '../text_config.js';
import { PALETTE as P } from '../palette.js';
import { H, GROUND, TOUCH, leaf } from './common.js';

export const practice = {
  /**
   * Drum Practice's scene: an evening on the village green before the
   * communal house (đình), lanterns strung overhead and a fire in the
   * middle. Dancers come in as the drumming gets going and dance to every
   * stroke heard; in call and answer a partner drums from a small stage on
   * the right.
   */
  practiceScene(view) {
    const g = this.ctx;
    const t = view.songTime;
    const p = view.practice;
    const sx = (x) => x + this.cam; // screen x to world x
    // The communal house, dim, at the back.
    this.prop('prop-dinh', sx(880), GROUND - 6, 230, () => this.dinh(sx(880), GROUND - 6), { bob: 0 });
    this.lanternString(sx(40), sx(1260), 130, 6, 6, t);
    const fireX = sx(this.fireScreenX(p));
    // Dancers behind the fire, the fire, then dancers in front.
    const ds = this.updateDancers(view);
    for (const d of ds) if (d.back) this.dancer(d, view);
    this.bonfire(fireX, GROUND + 4, t, p.groove, this.lastPulse(p.pulses, t));
    for (const d of ds) if (!d.back) this.dancer(d, view);
    if (p.kind === 'call') {
      const last = this.lastPulse(p.pulses, t, null, 'partner');
      const pulse = last === null ? 0 : Math.exp(-(t - last) / 0.12);
      this.callerDrum(sx(1130), GROUND, pulse, 'festival');
    }
  },

  /** Where the fire burns on screen: right of the dots, left of the partner's stage in call and answer. */
  fireScreenX(p) {
    return p.kind === 'call' ? 790 : 880;
  },

  /** The latest stroke heard at or before t (optionally of one drum, or by one player), or null. */
  lastPulse(pulses, t, drum = null, who = null) {
    let last = null;
    for (const q of pulses) {
      if (q.t > t || (drum && q.drum !== drum) || (who && q.who !== who)) continue;
      if (last === null || q.t > last) last = q.t;
    }
    return last;
  },

  /** How many strokes were heard at or before t (for alternating steps). */
  pulseCount(pulses, t) {
    let n = 0;
    for (const q of pulses) if (q.t <= t) n += 1;
    return n;
  },

  /**
   * Keep the dancers in step with how many the drumming has drawn in: new
   * ones walk in from the right to a place round the fire, and when the
   * drumming stops they leave the way they came.
   */
  updateDancers(view) {
    const dt = this.frameDt || 0.016;
    const p = view.practice;
    const call = p.kind === 'call';
    // Round the fire, which stands right of centre, clear of the dots.
    const f = this.fireScreenX(p);
    const slots = [-170, 170, -260, 250, -85, 85].map((dx) => f + dx);
    const ds = (this.dancers = this.dancers || []);
    const staying = ds.filter((d) => !d.leaving);
    if (staying.length < p.dancers) {
      const used = new Set(staying.map((d) => d.slot));
      const slot = slots.findIndex((_, i) => !used.has(i));
      if (slot >= 0) {
        ds.push({ slot, x: this.cam + 1380 + Math.random() * 60, v: 0, k: 1.6 + Math.random() * 0.4, phase: Math.random(), kind: ds.length % 4, delay: Math.random() * 0.05, back: slot % 2 === 1, leaving: false });
      }
    } else if (staying.length > p.dancers) {
      staying[staying.length - 1].leaving = true;
    }
    for (const d of ds) {
      const target = d.leaving ? this.cam + 1450 : this.cam + slots[d.slot];
      this.spring(d, target, d.k, dt);
    }
    this.dancers = ds.filter((d) => !(d.leaving && d.x > this.cam + 1420));
    return this.dancers;
  },

  /**
   * One dancer, feather-crowned like the figures on a Đông Sơn drum. A deep
   * stroke (L) is a stamp with both arms thrown up; a rim stroke (R) a hop
   * and a turn of the wrists, to alternate sides. Delivered art
   * (dancer-sheet: four dancers, three poses) replaces the stand-in.
   */
  dancer(d, view) {
    const g = this.ctx;
    const t = view.songTime;
    const p = view.practice;
    const tt = t - d.delay;
    const calm = this.reduceMotion ? 0.3 : 1;
    const lastL = this.lastPulse(p.pulses, tt, 'L');
    const lastR = this.lastPulse(p.pulses, tt, 'R');
    const pl = lastL === null ? 0 : Math.exp(-(tt - lastL) / 0.16);
    const pr = lastR === null ? 0 : Math.exp(-(tt - lastR) / 0.13);
    const side = this.pulseCount(p.pulses, tt) % 2 ? 1 : -1;
    const speed = Math.abs(d.v);
    const walking = speed > 25;
    d.phase += (speed * (this.frameDt || 0.016)) / 40;
    const gait = walking ? Math.abs(Math.sin(d.phase * Math.PI)) * 5 : 0;
    const sway = Math.sin(t * 2.4 + d.phase * 6) * p.groove * 0.05;
    const pose = {
      bob: (walking ? gait : 5 * pr - 4 * pl) * calm,
      tilt: (walking ? 0 : side * 0.1 * pr + sway) * calm,
      arms: walking ? 0.1 : Math.min(1, pl * 1.2),
      flick: walking ? 0 : pr * side,
    };
    // Face the fire, or the way they are walking.
    const fireX = this.cam + this.fireScreenX(p);
    const face = walking ? (d.v > 0 ? 1 : -1) : d.x < fireX ? 1 : -1;
    const s = d.back ? 0.86 : 1;
    const y = d.back ? GROUND - 10 : GROUND + 6;
    this.footShadow(d.x, 18 * s, d.back ? GROUND - 10 : GROUND + 6);
    g.save();
    this.backlit();
    this.dancerFigure(d, view, pose, face, s, y);
    g.restore();
  },

  dancerFigure(d, view, pose, face, s, y) {
    const g = this.ctx;
    const sheet = this.art.get('dancer-sheet');
    if (sheet) {
      const cw = sheet.width / 3;
      const ch = sheet.height / 4;
      const cellIx = pose.arms > 0.35 ? 1 : Math.abs(pose.flick) > 0.35 ? 2 : 0;
      const h = 96 * s;
      const w = (cw / ch) * h;
      g.save();
      g.translate(d.x, y - pose.bob);
      g.rotate(pose.tilt);
      g.scale(face, 1);
      g.drawImage(sheet, cellIx * cw, d.kind * ch, cw, ch, -w / 2, -h, w, h);
      g.restore();
      return;
    }
    g.save();
    g.translate(d.x, y);
    g.scale(face * s, s);
    g.rotate(pose.tilt);
    g.translate(0, -pose.bob);
    g.fillStyle = d.back ? '#22202A' : P.ink;
    const woman = d.kind % 2 === 0;
    // Legs and a wrapped skirt (the women) or a short loincloth (the men).
    if (woman) {
      g.beginPath();
      g.moveTo(-12, 0);
      g.lineTo(12, 0);
      g.lineTo(6, -30);
      g.lineTo(-6, -30);
      g.fill();
    } else {
      const step = pose.flick * 4;
      g.fillRect(-7 + step, -26, 5, 26);
      g.fillRect(2 - step, -26, 5, 26);
      g.beginPath();
      g.moveTo(-9, -18);
      g.lineTo(9, -18);
      g.lineTo(6, -32);
      g.lineTo(-6, -32);
      g.fill();
    }
    g.fillRect(-5, -54, 10, 26);
    g.beginPath();
    g.arc(1, -62, 7, 0, Math.PI * 2);
    g.fill();
    // The tall feather crown, fanning back and shivering on the beat.
    const shake = (pose.arms + Math.abs(pose.flick)) * 0.12;
    for (let i = 0; i < 6; i++) leaf(g, -1, -66, 30 - i * 2.5, -Math.PI * 0.5 - i * 0.17 - shake, 0.13);
    // Arms: thrown up on Trắc's stroke, a wrist flicked out on Nhị's.
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    const arm = (dir, up, out) => {
      const a = -Math.PI / 2 + dir * (0.5 + 1.0 * (1 - up)) + out;
      const ex = 2 + Math.cos(a) * 15;
      const ey = -50 + Math.sin(a) * 15;
      const b = a + dir * (0.6 - 0.5 * up) - out * 0.5;
      const hx = ex + Math.cos(b) * 13;
      const hy = ey + Math.sin(b) * 13;
      g.beginPath();
      g.moveTo(2, -50);
      g.lineTo(ex, ey);
      g.lineTo(hx, hy);
      g.stroke();
      // A feather held in each hand.
      leaf(g, hx, hy, 10, b - 0.3, 0.3);
    };
    arm(1, pose.arms, pose.flick > 0 ? pose.flick * 0.8 : 0);
    arm(-1, pose.arms, pose.flick < 0 ? pose.flick * 0.8 : 0);
    // A lacquer-red sash, and cut light in the crown and skirt.
    g.fillStyle = P.lacquer;
    g.fillRect(-6, -38, 12, 4);
    this.cutLight(g);
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.arc(k * 3.6, -12, 1.1, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(4, -63, 1, 0, Math.PI * 2);
    g.fill();
    this.endCut(g);
    g.restore();
  },

  /** The fire in the middle of the green: it burns higher as the drumming builds, and leaps on each stroke. */
  bonfire(x, y, t, groove, last) {
    const g = this.ctx;
    const kick = last === null ? 0 : Math.exp(-(t - last) / 0.2);
    const heat = 0.45 + 0.4 * groove + 0.25 * kick;
    g.save();
    const glow = g.createRadialGradient(x, y - 40, 10, x, y - 40, 220);
    glow.addColorStop(0, `rgba(255,190,110,${0.35 * heat})`);
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = glow;
    g.fillRect(x - 230, y - 260, 460, 300);
    // Flames: layered tongues of cut paper, flickering.
    const tongues = [['#A8322D', 1], ['#E07A35', 0.78], ['#F6C46A', 0.5]];
    for (const [color, size] of tongues) {
      g.fillStyle = color;
      for (let i = -2; i <= 2; i++) {
        const h = (60 + 30 * Math.sin(t * 7 + i * 1.7) + 50 * kick) * heat * size * (1 - Math.abs(i) * 0.18);
        const w = 16 * size;
        const fx = x + i * 13 * size + Math.sin(t * 5 + i) * 3;
        g.beginPath();
        g.moveTo(fx - w, y - 8);
        g.quadraticCurveTo(fx - w * 0.6, y - 8 - h * 0.6, fx + Math.sin(t * 9 + i) * 5, y - 8 - h);
        g.quadraticCurveTo(fx + w * 0.6, y - 8 - h * 0.6, fx + w, y - 8);
        g.fill();
      }
    }
    // Logs, crossed.
    g.fillStyle = P.ink;
    g.save();
    g.translate(x, y - 6);
    for (const a of [-0.22, 0.22]) {
      g.save();
      g.rotate(a);
      g.fillRect(-48, -6, 96, 11);
      g.restore();
    }
    g.restore();
    g.restore();
  },

  /** The communal house's stand-in: a long low hall under a deep saddle roof, its lattice lit. */
  dinh(x, y) {
    const g = this.ctx;
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = '#1C1A26';
    // Stilts and floor.
    for (let i = -4; i <= 4; i++) g.fillRect(x + i * 42 - 3, y - 40, 6, 40);
    g.fillRect(x - 200, y - 46, 400, 8);
    // Walls.
    g.fillRect(x - 170, y - 120, 340, 76);
    // The saddle roof, its ends sweeping up like a boat's prow.
    g.beginPath();
    g.moveTo(x - 250, y - 210);
    g.quadraticCurveTo(x - 200, y - 130, x - 190, y - 112);
    g.lineTo(x + 190, y - 112);
    g.quadraticCurveTo(x + 200, y - 130, x + 250, y - 210);
    g.quadraticCurveTo(x, y - 150, x - 250, y - 210);
    g.fill();
    // Lit lattice windows.
    this.cutLight(g);
    g.globalAlpha = 0.55;
    for (let i = -3; i <= 3; i++) {
      for (let r = 0; r < 3; r++) g.fillRect(x + i * 44 - 12, y - 108 + r * 18, 24, 10);
    }
    this.endCut(g);
    g.restore();
  },

  /**
   * The face of a practice kit, seen from above, in the HUD (the bronze
   * drum uses its own art). Delivered art (kit-faces: six faces in a row,
   * the bronze drum first) replaces these stand-ins.
   */
  kitFace(cx, cy, R, id) {
    const g = this.ctx;
    const order = ['bronze', 'temple', 'rice', 'gongs', 'bamboo', 'lion'];
    const sheet = this.art.get('kit-faces');
    if (sheet) {
      const cw = sheet.width / 6;
      g.drawImage(sheet, order.indexOf(id) * cw, 0, cw, sheet.height, cx - R, cy - R, R * 2, R * 2);
      return;
    }
    const disc = (r, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    };
    const ring = (r, color, w) => {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    };
    if (id === 'temple') {
      disc(R, P.lacquer);
      disc(R * 0.88, '#EADBC0');
      disc(R * 0.34, P.lacquer);
      g.fillStyle = P.bronzeLight;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94, R * 0.025, 0, Math.PI * 2);
        g.fill();
      }
    } else if (id === 'rice') {
      disc(R, '#6E4326');
      disc(R * 0.86, '#E6D3AE');
      // The rice paste that tunes the head.
      disc(R * 0.3, '#8E7756');
      ring(R * 0.86, P.ink, 2);
    } else if (id === 'gongs') {
      disc(R, P.bronze);
      for (const k of [0.92, 0.72, 0.55]) ring(R * k, 'rgba(22,21,26,0.35)', 2);
      const boss = g.createRadialGradient(cx - R * 0.08, cy - R * 0.08, 2, cx, cy, R * 0.32);
      boss.addColorStop(0, '#F2D49A');
      boss.addColorStop(1, P.bronze);
      g.fillStyle = boss;
      g.beginPath();
      g.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
      g.fill();
    } else if (id === 'bamboo') {
      disc(R, '#24382E');
      g.fillStyle = '#B7B46A';
      g.strokeStyle = '#4E5A2A';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const w = R * 0.24;
        const h = R * (1.3 - i * 0.14);
        const x = cx - R * 0.68 + i * R * 0.33;
        g.beginPath();
        g.roundRect(x, cy - h / 2, w, h, w / 2);
        g.fill();
        g.stroke();
      }
    } else if (id === 'lion') {
      disc(R, P.lacquer);
      disc(R * 0.84, '#F1E4C6');
      ring(R * 0.7, P.bronzeLight, R * 0.05);
      ring(R * 0.84, P.ink, 2);
    }
  },

  /** The rows of dots in Drum Practice: what is being drummed, the loop, the partner's call. */
  practiceDots(view, o) {
    const g = this.ctx;
    const t = view.songTime;
    const p = view.practice;
    const { cx, cell, dotR, k } = o;
    const rowX = (beats, c = cell) => cx - (beats * c) / 2;
    const rings = (x0, y, from, n, r, c, alpha) => {
      g.save();
      g.strokeStyle = P.paper;
      g.lineWidth = 1.5;
      for (let i = 0; i < n; i++) {
        g.globalAlpha = alpha;
        g.beginPath();
        g.arc(x0 + (from + i) * c + c / 2, y, r * 0.8, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    };
    // What the player is drumming: the beats settled so far (PracticeSession
    // shown: they never regroup), as ghosts, then rings for the rest. The
    // last beats appear when the rhythm is complete.
    const entering = (y, r = dotR, c = cell) => {
      const part = p.partial;
      // Rings for the beats still to come (a beat may hold up to three strokes).
      const sofar = part ? part.beats : 0;
      const left = Math.max(0, p.beats - sofar);
      const x0 = rowX(sofar + left, c);
      if (part) this.pattern(x0, y, part, r, c, Infinity, false, false, 0.45);
      rings(x0, y, sofar, left, r, c, part ? 0.4 : 0.45 + 0.25 * Math.sin(t * 4));
    };
    const label = (text, x, y, color = P.paper, align = 'center') => {
      g.save();
      g.font = o.font(600, 14);
      g.textAlign = align;
      g.fillStyle = color;
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 4;
      g.fillText(text, x, y);
      g.restore();
    };
    const rowY = o.slotY;
    const upperY = rowY - (dotR * 2 + 34 * k);
    // A rhythm just completed: it lights up as the finished sequence.
    const flash = (x0, y, pat) => {
      const q = p.doneAt === null ? 1 : (t - p.doneAt) / 0.7;
      if (q < 0 || q >= 1) return;
      g.save();
      g.globalAlpha = (1 - q) * 0.9;
      g.strokeStyle = '#FFE2A8';
      g.shadowColor = '#FFE2A8';
      g.shadowBlur = 18;
      g.lineWidth = 3;
      const w = pat.beats * cell;
      const pad = 10 + 16 * q;
      g.beginPath();
      g.roundRect(x0 - pad, y - dotR - pad, w + 2 * pad, 2 * dotR + 2 * pad, dotR + pad);
      g.stroke();
      g.restore();
    };
    {
      // A dark band behind the rows keeps them readable over the scene.
      const top = (p.kind === 'call' || (p.loop && p.entered) ? upperY : rowY) - dotR - 34 * k;
      g.fillStyle = 'rgba(22,21,26,0.45)';
      const w = Math.max(5, p.beats + 1) * cell + 40;
      g.fillRect(cx - w / 2, top, w, rowY + dotR + 10 - top);
    }
    if (p.kind === 'free') {
      if (p.entered) {
        if (p.loop) {
          // The old rhythm, quieter, while the new one is drummed.
          const c = cell * 0.62;
          this.pattern(rowX(p.loop.beats, c), upperY, p.loop, dotR * 0.62, c, p.loopPos ? p.loopPos.played : 0, false, false, 0.45);
        }
        entering(rowY);
        label(T.practice.listening, cx, (p.loop ? upperY : rowY) - dotR - 14 * k, P.paperShade);
      } else if (p.loop) {
        // The rhythm repeating: each stroke lights as it sounds.
        const x0 = rowX(p.loop.beats);
        const fresh = p.doneAt !== null && t - p.doneAt < 0.7;
        this.pattern(x0, rowY, p.loop, dotR, cell, Infinity, fresh);
        flash(x0, rowY, p.loop);
        if (p.loopPos && p.loopPos.played) {
          const i = p.loopPos.played - 1;
          const st = p.loop.strokes[i];
          const since = (p.loopPos.pos - st.pos) * p.loop.u;
          const q = Math.max(0, 1 - since / 0.35);
          if (q > 0) {
            g.save();
            g.globalAlpha = q;
            g.strokeStyle = '#FFE2A8';
            g.shadowColor = '#FFE2A8';
            g.shadowBlur = 14;
            g.lineWidth = 3;
            g.beginPath();
            g.arc(this.patternX(x0, p.loop.strokes, i, cell), rowY, dotR * (1.1 + 0.3 * (1 - q)), 0, Math.PI * 2);
            g.stroke();
            g.restore();
          }
        }
        label(T.practice.yourRhythmLoops, cx, rowY - dotR - 14 * k, P.bronzeLight);
      } else {
        rings(rowX(p.beats), rowY, 0, p.beats, dotR, cell, 0.45 + 0.25 * Math.sin(t * 4));
        label(txt('practice.drumAny', { beats: p.beats }), cx, rowY - dotR - 14 * k);
      }
      return;
    }
    // Call and answer: the partner's row above, the player's below (main.js
    // practiceView says what each row holds: a rhythm with a playhead, or the
    // rhythm being drummed).
    const row = (r, y, fallbackAlpha) => {
      if (r && r.entering) {
        entering(y);
        return Math.max(p.beats, p.partial ? p.partial.beats : 0);
      }
      if (r && r.pattern) {
        const x0 = rowX(r.pattern.beats);
        this.pattern(x0, y, r.pattern, dotR, cell, r.played ?? Infinity, !!r.glow, false, r.dim ? 0.55 : 1);
        if (r.flash) flash(x0, y, r.pattern);
        return r.pattern.beats;
      }
      rings(rowX(p.beats), y, 0, p.beats, dotR, cell, fallbackAlpha);
      return p.beats;
    };
    const top = p.rows.top;
    const bottom = p.rows.bottom;
    const topBeats = row(top, upperY, 0.3);
    label(top && top.label ? top.label : T.practice.partner, rowX(topBeats) - 12, upperY + 5, P.paperShade, 'right');
    const youBeats = row(bottom, rowY, 0.45 + 0.25 * Math.sin(t * 4));
    label(bottom && bottom.label ? bottom.label : T.practice.you, rowX(youBeats) - 12, rowY + 5, P.paper, 'right');
    label(p.rows.heading, cx, upperY - dotR - 14 * k, p.rows.headingColor || P.paper);
  },

  /** Drum Practice's controls, bottom left (keyboard, mouse and controller). */
  practiceControls(view, k) {
    const g = this.ctx;
    const p = view.practice;
    const lines = [
      txt('practice.controls.beats', { fewerKey: p.keys.fewer, beats: p.beats, moreKey: p.keys.more }),
      txt('practice.controls.secondDrum', { strikeKey: p.keys.second, drum: p.second.vn, chooseKey: p.keys.choose }),
      txt(p.kind === 'free' ? 'practice.controls.clearFree' : 'practice.controls.clear', { key: p.keys.clear }),
    ];
    this.secondDrum(view, 768, H - 92, 30);
    const by = Math.min(k, 1.4);
    g.save();
    g.translate(0, H);
    g.scale(by, by);
    g.translate(0, -H);
    g.font = '600 15px "Be Vietnam Pro", system-ui, sans-serif';
    const w = Math.max(...lines.map((l) => this.richWidth(l))) + 24;
    const rowH = 26;
    const top = H - 14 - lines.length * rowH;
    g.fillStyle = 'rgba(22,21,26,0.6)';
    g.fillRect(12, top - 4, w, lines.length * rowH + 8);
    g.fillStyle = P.paper;
    lines.forEach((l, i) => {
      const lw = this.richWidth(l);
      this.richText(l, 24 + lw / 2, top + 18 + i * rowH);
    });
    g.restore();
  },

  /**
   * Drum Practice's secondary drum, beside the bronze drum: its face (shivering
   * when struck) and its name. On touch it is a button; elsewhere the keys
   * are in the controls box.
   */
  secondDrum(view, x, y, r, touch = false) {
    const g = this.ctx;
    const t = view.songTime;
    const second = view.practice.second;
    const sh = this.shiver(this.kicks.second ?? -9, t, 4);
    const hit = Math.max(0, 1 - (t - (this.kicks.second ?? -9)) / 0.25);
    g.save();
    g.translate(sh.dx, sh.dy);
    g.shadowColor = hit > 0 ? P.verdigris : 'rgba(0,0,0,0.55)';
    g.shadowBlur = 10 + 14 * hit;
    this.kitFace(x, y, r, second.face);
    g.restore();
    g.save();
    g.font = `700 ${touch ? 15 : 13}px "Be Vietnam Pro", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillStyle = P.paper;
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 4;
    g.fillText(second.vn, x, y - r - (touch ? 12 : 8));
    g.restore();
  },

  /** Drum Practice on touch screens: the secondary drum, and − and + beside the dots. */
  practiceButtons(view) {
    const g = this.ctx;
    const t = view.songTime;
    const p = view.practice;
    const T = TOUCH;
    const press = (id) => {
      const since = t - (this.pressed[id] ?? -9);
      return since < 0.18 ? 1 - 0.1 * Math.sin((since / 0.18) * Math.PI) : 1;
    };
    const text = (str, x, y, size = 16) => {
      g.save();
      g.font = `700 ${Math.round(size)}px "Be Vietnam Pro", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = P.paper;
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 4;
      g.fillText(str, x, y);
      g.restore();
    };
    // The secondary drum: tap it to strike it, ‹ › to choose another.
    this.secondDrum(view, T.kit.x, T.kit.y, T.kit.r * press('S'), true);
    for (const [id, sign] of [['secondPrev', '‹'], ['secondNext', '›']]) {
      const { x, y, r } = T[id];
      const rr = r * press(id);
      g.save();
      g.globalAlpha = 0.9;
      g.fillStyle = P.indigo;
      g.beginPath();
      g.arc(x, y, rr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = P.bronze;
      g.lineWidth = 2;
      g.stroke();
      g.restore();
      text(sign, x, y + 9, 26);
    }
    // Fewer and more strokes.
    for (const [id, sign] of [['fewer', '−'], ['more', '+']]) {
      const pos = T[id];
      const rr = pos.r * press(id);
      const off = (id === 'fewer' && p.beats <= 2) || (id === 'more' && p.beats >= 12);
      g.save();
      g.globalAlpha = off ? 0.35 : 0.9;
      g.fillStyle = P.indigo;
      g.beginPath();
      g.arc(pos.x, pos.y, rr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = P.bronze;
      g.lineWidth = 3;
      g.stroke();
      g.restore();
      text(sign, pos.x, pos.y + 11, 32);
    }
    text(`${p.beats} beats`, T.more.x, T.more.y + T.more.r + 22, 14);
  },
};
