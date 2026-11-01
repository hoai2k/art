import { PALETTE as P } from '../palette.js';
import { GROUND, canvas, haze } from './common.js';

export const story = {
  // Props for the story chapters, at fixed places in the world (the army does
  // not move in them). Each prop draws its delivered art when there is some
  // (ids in assets/manifest.json) and a paper-cut stand-in otherwise.

  scene(view) {
    if (view.mode === 'practice') return this.practiceScene(view);
    const t = view.songTime;
    const sess = view.session;
    const call = sess && sess.call;
    const callPulse = call && sess.phase === 'calling' ? this.strokePulse({ start: call.start, u: call.u, strokes: call.pattern.strokes }, t).pulse : 0;
    const caller = view.stage.caller;
    if (caller === 'mourning') {
      this.altar(150, GROUND, sess.index, sess.calls.length, t, view.wind);
      this.callerDrum(560, GROUND, callPulse, 'mourning');
    } else if (caller === 'village') {
      sess.calls.forEach((c, i) => {
        const x = 40 + i * 125;
        const lit = i < sess.index;
        const calling = i === sess.index && sess.phase === 'calling';
        this.villageHouse(x, GROUND - 4, lit, calling ? callPulse : 0, t, i);
        this.villageWake(x, GROUND - 4, t - ((this.wokenAt || {})[i] ?? -99));
      });
    } else if (caller === 'training') {
      // Training: the partner's drum, on the right of the field.
      this.callerDrum(470, GROUND, callPulse, 'festival');
    } else if (caller === 'festival') {
      this.lanternString(-480, 820, 150, sess.index, sess.calls.length, t);
      this.callerDrum(600, GROUND, callPulse, 'festival');
    } else if (caller === 'elegy') {
      sess.calls.forEach((c, i) => {
        const x = 60 + i * 135;
        const silent = i < sess.index;
        const calling = i === sess.index && sess.phase === 'calling';
        this.meltDrum(x, GROUND, silent, calling ? callPulse : 0, i === sess.index);
      });
    } else if (view.mode === 'casting') {
      this.foundry(view, t);
    }
  },

  /**
   * Mã Viện on horseback, watching from the rear of his columns: always near
   * the right edge of the screen, a little behind the field.
   */
  general(view) {
    const g = this.ctx;
    const x = this.cam + 1150;
    const y = GROUND - 30;
    g.save();
    g.globalAlpha = 0.92;
    this.prop('han-general', x, y, 180, () => {
      g.fillStyle = P.ironDark;
      // Horse, facing left.
      g.beginPath();
      g.ellipse(x, y - 70, 50, 24, 0, 0, Math.PI * 2);
      g.fill();
      for (const lx of [-36, -20, 22, 38]) g.fillRect(x + lx - 3, y - 52, 6, 52);
      g.beginPath();
      g.moveTo(x - 40, y - 80);
      g.lineTo(x - 70, y - 120);
      g.lineTo(x - 82, y - 112);
      g.lineTo(x - 56, y - 72);
      g.fill();
      // Rider with a crested helmet and a banner.
      g.fillRect(x - 8, y - 130, 16, 46);
      g.beginPath();
      g.arc(x, y - 138, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.lacquer;
      g.fillRect(x - 2, y - 160, 4, 12);
      g.fillStyle = P.ironDark;
      g.fillRect(x + 14, y - 200, 3, 120);
      g.fillStyle = P.lacquer;
      g.beginPath();
      g.moveTo(x + 17, y - 200);
      g.lineTo(x + 60, y - 190);
      g.lineTo(x + 17, y - 172);
      g.fill();
    });
    g.restore();
  },

  /** A village has answered: remember when, for its burst of light. */
  villageWakes(i, t) {
    this.wokenAt = { ...(this.wokenAt || {}), [i]: t };
  },

  /**
   * A village coming to life, `age` seconds after it answered: a flare of
   * lamplight over the house, sparks, the drum's rings over the water and a
   * few paper lanterns floating up, settling after about three seconds.
   */
  villageWake(x, y, age) {
    if (age < 0 || age > 4) return;
    const g = this.ctx;
    const k = age / 4;
    if (age < 1.4) this.wakeBurst(x, y - 60, 260, age / 1.4);
    g.save();
    g.globalCompositeOperation = 'lighter';
    // The flare, strongest at once and fading.
    const f = Math.max(0, 1 - age / 1.8);
    if (f > 0) {
      const gr = g.createRadialGradient(x, y - 60, 4, x, y - 60, 120);
      gr.addColorStop(0, `rgba(255,200,120,${0.7 * f})`);
      gr.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gr;
      g.fillRect(x - 120, y - 180, 240, 240);
    }
    // Sparks thrown up and falling.
    for (let n = 0; n < 16; n++) {
      const a = -Math.PI / 2 + ((n / 16) - 0.5) * 2.2;
      const v = 70 + (n % 5) * 22;
      const sx = x + Math.cos(a) * v * age;
      const sy = y - 70 + Math.sin(a) * v * age + 60 * age * age;
      const alpha = Math.max(0, 1 - age / 1.3);
      if (alpha <= 0) break;
      g.fillStyle = `rgba(255,${180 + (n % 3) * 25},90,${alpha})`;
      g.fillRect(sx, sy, 3, 3);
    }
    g.restore();
    // Paper lanterns rising from the house and drifting.
    for (let n = 0; n < 3; n++) {
      const la = age - n * 0.35;
      if (la < 0) continue;
      const lx = x + (n - 1) * 26 + Math.sin(la * 1.6 + n) * 8;
      const ly = y - 80 - la * 46;
      const alpha = Math.max(0, Math.min(1, la * 3) * (1 - k));
      g.save();
      g.globalAlpha = alpha;
      g.globalCompositeOperation = 'lighter';
      const gl = g.createRadialGradient(lx, ly, 1, lx, ly, 24);
      gl.addColorStop(0, 'rgba(255,190,110,0.6)');
      gl.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gl;
      g.fillRect(lx - 24, ly - 24, 48, 48);
      g.restore();
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = '#FFB65C';
      g.beginPath();
      g.ellipse(lx, ly, 6, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(22,21,26,0.6)';
      g.fillRect(lx - 4, ly + 7, 8, 1.5);
      g.restore();
    }
  },

  altar(x, y, lit, total, t, windIn) {
    const g = this.ctx;
    this.prop('prop-altar', x, y, 170, () => {
      g.save();
      g.fillStyle = P.ink;
      g.fillRect(x - 70, y - 70, 140, 12); // table top
      g.fillRect(x - 62, y - 58, 8, 58);
      g.fillRect(x + 54, y - 58, 8, 58);
      // The memorial tablet, its inscription cut out.
      g.fillRect(x - 16, y - 140, 32, 70);
      g.beginPath();
      g.moveTo(x - 22, y - 140);
      g.quadraticCurveTo(x, y - 160, x + 22, y - 140);
      g.fill();
      this.cutLight(g);
      for (let k = 0; k < 5; k++) g.fillRect(x - 2, y - 132 + k * 11, 4, 6);
      this.endCut(g);
      g.restore();
    });
    const painted = !!this.art.get('prop-altar');
    this.incense(x, painted ? y - 78 : y - 70, lit, total, t, windIn);
  },

  /**
   * The incense in the altar's bowl, one stick per answered call. Lit sticks
   * glow at the tip and send up smoke that curls through a slow swirling flow
   * and climbs high into the sky, spreading into a haze, so every new stick
   * visibly thickens the column. Lighting one flares: sparks, a dense first
   * puff and a warm glow over the altar that stays brighter with each stick.
   * windIn ({ a, y } held) blows the smoke one way or the other just above
   * the shrine, in gusts, while the button is held.
   */
  incense(x, bowlY, lit, total, t, windIn) {
    const g = this.ctx;
    const dt = Math.min(0.05, this.frameDt || 0.016);
    const st = this.incenseState && this.incenseState.total === total ? this.incenseState
      : (this.incenseState = { total, lit: 0, trails: [], sparks: [], flares: [], acc: [], burst: [], wind: { x: 0, y: 0 }, gust: 0 });
    const n = (i) => (i - (total - 1) / 2);
    const sticks = [];
    for (let i = 0; i < total; i++) {
      const a = n(i) * 0.1;
      const bx = x + n(i) * 5;
      const len = 30 + (i % 2) * 4;
      sticks.push({ bx, by: bowlY, a, len, tx: bx + Math.sin(a) * len, ty: bowlY - Math.cos(a) * len, on: i < lit });
    }
    // A new stick lit: flare, sparks and a first thick puff.
    while (st.lit < lit) {
      const s0 = sticks[st.lit];
      st.flares.push({ t, x: s0.tx, y: s0.ty });
      for (let k = 0; k < 14; k++) {
        st.sparks.push({ x: s0.tx, y: s0.ty, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 70, life: 0.5 + Math.random() * 0.5 });
      }
      // A thicker stream for the first second and a half as it catches.
      st.burst[st.lit] = t + 1.5;
      st.lit += 1;
    }
    if (lit < st.lit) st.lit = lit; // a restarted chapter
    // Wind: A blows to the right, Y to the left; gusts wander while held.
    const want = (windIn && windIn.a ? 1 : 0) - (windIn && windIn.y ? 1 : 0);
    st.gust += (Math.random() - 0.5) * dt * 6;
    st.gust *= 1 - dt * 1.5;
    const strength = want ? 55 * (0.65 + 0.35 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1) + st.gust) : 0;
    const lift = want ? Math.sin(t * 2.3) * 10 : 0;
    st.wind.x += (want * strength - st.wind.x) * Math.min(1, dt * 4);
    st.wind.y += (lift - st.wind.y) * Math.min(1, dt * 4);
    const windAmt = Math.min(1, Math.abs(st.wind.x) / 55);
    // Emit from each lit tip.
    sticks.forEach((s0, i) => {
      if (!s0.on) return;
      const catching = t < (st.burst[i] || 0);
      const trail = st.trails[i] || (st.trails[i] = []);
      st.acc[i] = (st.acc[i] || 0) + dt * (this.reduceMotion ? 10 : catching ? 30 : 18);
      while (st.acc[i] >= 1) {
        st.acc[i] -= 1;
        trail.push(this.puff(s0.tx, s0.ty, catching ? 1.8 : 1));
      }
      if (trail.length > 260) trail.splice(0, trail.length - 260);
    });
    // The glow over the altar grows with every stick, and flares on lighting.
    const aura = lit / Math.max(1, total);
    let flare = 0;
    st.flares = st.flares.filter((f) => t - f.t < 1.2);
    for (const f of st.flares) flare = Math.max(flare, 1 - (t - f.t) / 1.2);
    if (aura > 0 || flare > 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const r = 70 + 40 * aura + 110 * flare;
      const grad = g.createRadialGradient(x, bowlY - 20, 4, x, bowlY - 20, r);
      grad.addColorStop(0, `rgba(255,170,90,${0.2 * aura + 0.6 * flare})`);
      grad.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, bowlY - 20 - r, r * 2, r * 2);
      g.restore();
    }
    // Smoke, behind the sticks. Each stick's puffs, in the order they left
    // the tip, are joined into a ribbon that curls through a slow swirling
    // flow; as it ages the ribbon thins out into a soft haze that climbs high
    // and spreads.
    const sprite = this.smokeSprite();
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const trail of st.trails) {
      if (!trail) continue;
      for (const p of trail) {
        p.age += dt;
        const height = bowlY - p.y;
        p.vy = -(18 + 26 * Math.min(1, height / 240)) * p.lift;
        const swirl = Math.sin(p.y * 0.024 + t * 0.55 + p.seed * 0.15) * (2 + height * 0.07) + Math.sin(p.y * 0.0085 - t * 0.3) * (2 + height * 0.05);
        // The breeze acts in a band just above the shrine.
        const band = Math.exp(-(((height - 60) / 65) ** 2));
        p.x += (swirl + st.wind.x * band + p.jx) * dt;
        p.y += (p.vy + st.wind.y * band) * dt;
        p.jx *= 1 - dt * 2;
      }
      // Ribbon: segments between consecutive puffs, widening with age.
      for (let j = 1; j < trail.length; j++) {
        const p = trail[j];
        const q = trail[j - 1];
        const k = Math.min(1, p.age / p.max);
        const ribbon = Math.max(0, 1 - p.age / 6) * Math.min(1, p.age * 5) * Math.max(0, Math.min(1, (p.y - 30) / 150));
        if (ribbon <= 0.01) continue;
        g.strokeStyle = `rgba(232,228,220,${0.4 * ribbon * (1 - k) * p.dense})`;
        g.lineWidth = 1.2 + p.age * 1.8;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(p.x, p.y);
        g.stroke();
      }
      // Haze: the older smoke as soft puffs, spreading as it climbs.
      for (let j = 0; j < trail.length; j += 2) {
        const p = trail[j];
        const k = Math.min(1, p.age / p.max);
        // Thins out as it climbs: gone well before the top of the sky.
        const climb = Math.max(0, Math.min(1, (p.y - 30) / 160));
        const haze = Math.min(1, Math.max(0, (p.age - 1.5) / 2.5)) * (1 - k) ** 1.3 * climb;
        if (haze <= 0.01) continue;
        const rad = (6 + p.age * 3.6) * p.size;
        g.globalAlpha = Math.min(1, 0.1 * haze * p.dense);
        g.drawImage(sprite, p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
      // Drop smoke that has faded or left the top of the sky (lifetimes
      // differ, so not only from the front of the trail).
      for (let j = trail.length - 1; j >= 0; j--) if (trail[j].age > trail[j].max || trail[j].y < -60) trail.splice(j, 1);
    }
    g.restore();
    // The sticks: red-stained bamboo with the brown incense coating on top.
    for (const s0 of sticks) {
      g.save();
      g.translate(s0.bx, s0.by);
      g.rotate(s0.a);
      g.fillStyle = '#9A2E22';
      g.fillRect(-0.9, -s0.len * 0.4, 1.8, s0.len * 0.4);
      g.fillStyle = s0.on ? '#4A3426' : '#6B4A32';
      g.fillRect(-1.3, -s0.len, 2.6, s0.len * 0.62);
      if (s0.on) {
        // Grey ash at the tip, the ember just below it.
        g.fillStyle = '#B9B2A6';
        g.fillRect(-1.3, -s0.len - 2.5, 2.6, 2.5);
      }
      g.restore();
      if (s0.on) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 5 + s0.bx) + 0.5 * windAmt;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const er = 5 + 4 * pulse;
        const eg = g.createRadialGradient(s0.tx, s0.ty, 0, s0.tx, s0.ty, er);
        eg.addColorStop(0, `rgba(255,220,150,${0.9 * Math.min(1, pulse)})`);
        eg.addColorStop(0.35, `rgba(255,120,40,${0.6 * Math.min(1, pulse)})`);
        eg.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = eg;
        g.fillRect(s0.tx - er, s0.ty - er, er * 2, er * 2);
        g.restore();
      }
    }
    // Sparks from a stick being lit.
    g.save();
    g.globalCompositeOperation = 'lighter';
    st.sparks = st.sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of st.sparks) {
      p.vy += 60 * dt;
      p.x += (p.vx + st.wind.x * 0.5) * dt;
      p.y += p.vy * dt;
      g.fillStyle = `rgba(255,${150 + Math.round(90 * p.life)},70,${Math.min(1, p.life * 2)})`;
      g.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    // The ring of light as a stick catches.
    for (const f of st.flares) {
      const q = (t - f.t) / 1.2;
      g.strokeStyle = `rgba(255,190,110,${0.8 * (1 - q)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(f.x, f.y, 6 + 70 * q, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  },

  /** One puff of incense smoke leaving a tip. dense > 1 for the first thick puff. */
  puff(x, y, dense) {
    return {
      x: x + (Math.random() - 0.5) * 1.5, y, vy: 0, age: 0, jx: (Math.random() - 0.5) * 6 * dense,
      max: 7 + Math.random() * 4, seed: Math.random() * 6.28, size: 0.8 + Math.random() * 0.5,
      lift: 0.85 + Math.random() * 0.3, dense,
    };
  },

  /** A soft round puff of pale smoke, drawn once. */
  smokeSprite() {
    if (this.smokeImg) return this.smokeImg;
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(236,232,224,1)');
    grad.addColorStop(0.5, 'rgba(226,222,214,0.45)');
    grad.addColorStop(1, 'rgba(220,216,208,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.smokeImg = c;
    return c;
  },

  /** The caller: a drummer at a standing drum, striking on the call's strokes. */
  callerDrum(x, y, pulse, kind) {
    const g = this.ctx;
    const id = kind === 'mourning' ? 'prop-mourning-drummer' : 'prop-festival-drummers';
    this.prop(id, x, y, kind === 'festival' ? 170 : 160, () => {
      g.save();
      g.fillStyle = P.ink;
      // Drum on a stand.
      g.fillRect(x - 6, y - 60, 4, 60);
      g.fillRect(x + 34, y - 60, 4, 60);
      g.fillStyle = kind === 'festival' ? P.lacquer : P.bronze;
      g.beginPath();
      g.ellipse(x + 16, y - 80, 30, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.ink;
      // Drummer, arm raised and brought down on the strokes.
      const px = x - 40;
      g.fillRect(px - 7, y - 58, 14, 58);
      g.beginPath();
      g.arc(px, y - 68, 9, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(px + 5, y - 54);
      g.rotate(-1.6 + pulse * 1.3);
      g.fillRect(-2, 0, 4, 34);
      g.restore();
      g.restore();
    }, { bob: pulse * 4 });
    if (pulse > 0.05) {
      // The ripple sits on the drum: where the painted art has it, or the stand-in's.
      const painted = this.art.get(id);
      const [rx, ry] = painted ? (kind === 'festival' ? [x - 4, y - 100] : [x + 70, y - 95]) : [x + 16, y - 80];
      g.save();
      g.globalAlpha = pulse * 0.6;
      g.strokeStyle = this.sky.glow;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(rx, ry, 36 + (1 - pulse) * 30, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  },

  /** A stilt house on the river; its lanterns light when the village answers. */
  villageHouse(x, y, lit, pulse, t, i) {
    const g = this.ctx;
    this.prop('prop-village-house', x, y, 130, () => {
      g.save();
      g.fillStyle = this.sky.mid2;
      for (const px of [-30, -10, 10, 30]) g.fillRect(x + px - 2, y - 50, 4, 50);
      g.fillRect(x - 36, y - 76, 72, 28);
      g.beginPath();
      g.moveTo(x - 62, y - 108);
      g.quadraticCurveTo(x, y - 66, x + 62, y - 108);
      g.lineTo(x + 46, y - 74);
      g.lineTo(x - 46, y - 74);
      g.closePath();
      g.fill();
      g.restore();
    });
    // Lanterns: dark until the village answers, then warm and swaying.
    for (const lx of [-40, 40]) {
      const sway = Math.sin(t * 1.5 + i + lx) * 3;
      g.save();
      g.strokeStyle = P.ink;
      g.beginPath();
      g.moveTo(x + lx, y - 84);
      g.lineTo(x + lx + sway, y - 64);
      g.stroke();
      const img = this.art.get('prop-lantern');
      if (img && lit) this.sprite(img, x + lx + sway, y - 40, 26);
      else {
        g.fillStyle = lit ? '#F2A65A' : 'rgba(22,21,26,0.8)';
        if (lit) {
          g.shadowColor = '#FFC26A';
          g.shadowBlur = 22;
        }
        g.beginPath();
        g.ellipse(x + lx + sway, y - 56, 8, 11, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    if (pulse > 0.05) {
      g.save();
      g.globalAlpha = pulse * 0.7;
      g.strokeStyle = this.sky.glow;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y - 90, 30 + (1 - pulse) * 40, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  },

  /** A string of festival lanterns across the sky: one more lit per answer. */
  lanternString(x0, x1, y, lit, total, t) {
    const g = this.ctx;
    g.save();
    g.strokeStyle = P.ink;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = x0; x <= x1; x += 20) g.lineTo(x, y + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 30);
    g.stroke();
    const n = total * 3;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0);
      const yy = y + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 30 + 14 + Math.sin(t * 1.3 + i) * 2;
      const on = i < lit * 3;
      g.fillStyle = on ? (i % 2 ? P.lacquer : '#F2A65A') : 'rgba(22,21,26,0.7)';
      if (on) {
        g.shadowColor = '#FFC26A';
        g.shadowBlur = 16;
      } else g.shadowBlur = 0;
      g.beginPath();
      g.ellipse(x, yy, 9, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },

  /** One of the drums gathered to be melted: lit while it can still sound, grey once silent. */
  meltDrum(x, y, silent, pulse, next) {
    const g = this.ctx;
    const art = this.art.get('prop-bronze-drum');
    // A silent drum is a grey copy, made once (no per-frame filter).
    const img = art && silent ? this.shaded(art, true) : art;
    g.save();
    if (next && !silent) {
      g.shadowColor = P.bronzeLight;
      g.shadowBlur = 12 + pulse * 20;
    }
    if (img) this.sprite(img, x, y, 90, { bob: pulse * 3 });
    else {
      g.fillStyle = silent ? '#5a5650' : P.bronze;
      g.beginPath();
      g.moveTo(x - 40, y - 80);
      g.lineTo(x + 40, y - 80);
      g.quadraticCurveTo(x + 28, y - 40, x + 34, y);
      g.lineTo(x - 34, y);
      g.quadraticCurveTo(x - 28, y - 40, x - 40, y - 80);
      g.fill();
      g.fillStyle = silent ? '#77726a' : P.bronzeLight;
      g.beginPath();
      g.ellipse(x, y - 80, 40, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.ink;
      for (let k = 0; k < 3; k++) g.fillRect(x - 32, y - 62 + k * 14, 64, 1.5);
    }
    g.restore();
  },

  /** The foundry: a furnace and crucible, three moulds filling as the bronze is poured. */
  foundry(view, t) {
    const g = this.ctx;
    const sess = view.session;
    const fx = -60;
    this.prop('prop-furnace', fx, GROUND, 190, () => {
      g.save();
      g.fillStyle = P.ink;
      g.beginPath();
      g.moveTo(fx - 60, GROUND);
      g.lineTo(fx - 40, GROUND - 150);
      g.lineTo(fx + 40, GROUND - 150);
      g.lineTo(fx + 60, GROUND);
      g.fill();
      g.fillStyle = '#FF8A3C';
      g.shadowColor = '#FF8A3C';
      g.shadowBlur = 30 + Math.sin(t * 6) * 8;
      g.beginPath();
      g.arc(fx, GROUND - 40, 20, Math.PI, 0);
      g.fill();
      g.restore();
    });
    // The bellows beside the furnace, pumped on every beat of the guide, so
    // the pace to hold can be seen as well as heard.
    if (view.guide) {
      const d = view.guide;
      const beat = (t - d.start) / d.u;
      const ph = beat < 0 ? 0 : beat - Math.floor(beat);
      const push = beat < 0 ? 0 : Math.max(0, 1 - ph * 3) ** 2; // squeezed on the beat
      // A leather bag between two boards, its nozzle in the fire, squeezed
      // shut on each beat and opening again between.
      const bx = fx + 92;
      const by = GROUND - 30;
      const open = 34 - 22 * push;
      g.save();
      g.fillStyle = P.ink;
      g.fillRect(bx - 20, by - 3, 24, 6); // nozzle into the furnace
      g.fillStyle = '#6B4A32';
      g.beginPath(); // the leather bag, pleated
      g.moveTo(bx, by);
      for (let i = 0; i <= 6; i++) g.lineTo(bx + 8 + i * 9, by - open / 2 - (i % 2 ? 4 : 0) * (1 - push));
      g.lineTo(bx + 68, by);
      for (let i = 6; i >= 0; i--) g.lineTo(bx + 8 + i * 9, by + open / 2 + (i % 2 ? 4 : 0) * (1 - push));
      g.closePath();
      g.fill();
      g.fillStyle = '#A06A3C';
      g.save(); // upper and lower boards, hinged at the nozzle end
      g.translate(bx + 4, by);
      g.rotate(-Math.atan2(open / 2, 64));
      g.fillRect(0, -6, 74, 6);
      g.fillRect(70, -14, 6, 12); // handle
      g.restore();
      g.save();
      g.translate(bx + 4, by);
      g.rotate(Math.atan2(open / 2, 64));
      g.fillRect(0, 0, 74, 6);
      g.restore();
      if (push > 0.05) {
        // A breath of air into the fire: the furnace flares on the beat.
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(fx, GROUND - 40, 4, fx, GROUND - 40, 70);
        gr.addColorStop(0, `rgba(255,170,80,${0.35 * push})`);
        gr.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = gr;
        g.fillRect(fx - 70, GROUND - 110, 140, 140);
      }
      g.restore();
    }
    // The moulds: the current one fills pour by pour; cast ones glow bronze.
    for (let i = 0; i < sess.drums; i++) {
      const x = 170 + i * 150;
      const fill = Math.max(0, Math.min(1, sess.level * sess.drums - i));
      const cracked = i === sess.cast && t - view.crackAt < 0.8;
      this.mould(x, GROUND, fill, cracked, i < sess.cast, t);
      // A drum just cast: its rings burst from the mould, sparks fly up.
      const since = t - (view.castAt?.[i] ?? -9);
      if (since >= 0 && since < 1.4) {
        this.wakeBurst(x, GROUND - 50, 300, since / 1.4);
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2 + i;
          const d = 20 + since * (60 + (k % 4) * 25);
          g.fillStyle = `rgba(255,${190 + (k % 3) * 20},90,${Math.max(0, 1 - since / 1.1)})`;
          g.fillRect(x + Math.cos(a) * d, GROUND - 50 + Math.sin(a) * d * 0.7 - since * 40, 3, 3);
        }
        g.restore();
      }
    }
    // The pour: a glowing stream from the crucible into the current mould.
    if (view.pouring && !sess.done) {
      const x = 170 + sess.cast * 150;
      g.save();
      g.strokeStyle = '#FFB65C';
      g.shadowColor = '#FF8A3C';
      g.shadowBlur = 18;
      g.lineWidth = 5 + Math.sin(t * 30);
      g.beginPath();
      g.moveTo(fx + 30, GROUND - 120);
      g.quadraticCurveTo(x - 40, GROUND - 170, x, GROUND - 70);
      g.stroke();
      g.restore();
    }
  },

  /**
   * Molten bronze rising inside a painted mould: the mould itself glows hot
   * from the bottom up to the fill level (and flashes pale when it cracks).
   */
  glowFill(img, x, y, h, fill, cracked) {
    const w = Math.round((img.width / img.height) * h);
    const c = this.glowCanvas || (this.glowCanvas = canvas(1, 1));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(img, 0, 0, w, h);
    g.globalCompositeOperation = 'source-atop';
    const level = h - h * 0.92 * fill;
    const grad = g.createLinearGradient(0, h, 0, level - 10);
    grad.addColorStop(0, cracked ? 'rgba(242,232,213,0.85)' : 'rgba(255,170,80,0.85)');
    grad.addColorStop(0.85, cracked ? 'rgba(242,232,213,0.6)' : 'rgba(255,120,40,0.65)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, cracked ? 0 : level - 10, w, h);
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#FF8A3C';
    ctx.shadowBlur = cracked ? 0 : 16 * fill;
    ctx.drawImage(c, x - w / 2, y - h);
    ctx.restore();
  },

  mould(x, y, fill, cracked, cast, t) {
    const g = this.ctx;
    const done = this.art.get('prop-drum-cast');
    if (cast && done) {
      this.sprite(done, x, y, 100);
      return;
    }
    const img = this.art.get('prop-mould');
    if (img) {
      this.sprite(img, x, y, 100);
      if (fill > 0 || cracked) this.glowFill(img, x, y, 100, fill, cracked);
      return;
    }
    {
      g.save();
      g.fillStyle = '#5b4436';
      g.beginPath();
      g.moveTo(x - 50, y - 90);
      g.lineTo(x + 50, y - 90);
      g.lineTo(x + 44, y);
      g.lineTo(x - 44, y);
      g.closePath();
      g.fill();
      g.restore();
    }
    if (fill > 0) {
      // Molten bronze rising inside: bright, then darkening as it sets.
      g.save();
      g.fillStyle = cast ? P.bronze : '#FFA24C';
      g.shadowColor = '#FF8A3C';
      g.shadowBlur = cast ? 6 : 20;
      const hgt = 70 * fill;
      g.fillRect(x - 34, y - 12 - hgt, 68, hgt);
      g.restore();
    }
    if (cracked) {
      g.save();
      g.strokeStyle = P.paper;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 10, y - 90);
      g.lineTo(x + 4, y - 60);
      g.lineTo(x - 6, y - 40);
      g.lineTo(x + 8, y - 10);
      g.stroke();
      g.restore();
    }
  },
};
