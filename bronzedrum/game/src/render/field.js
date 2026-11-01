import { PALETTE as P } from '../palette.js';
import { W, H, U, GROUND, canvas } from './common.js';

export const field = {
  army(view, dt) {
    const g = this.ctx;
    const { battle, songTime: t } = view;
    const order = battle.order;
    const cmd = order ? order.command : null;
    const shielded = view.shieldsUp;
    const n = battle.army.troops <= 0 ? 0 : Math.max(1, Math.ceil((battle.army.troops / battle.army.maxTroops) * 12));
    const mm = this.motion;
    const frontTarget = battle.army.x * U;
    // The formation's front glides after the simulation's position.
    const fm = mm.frontM;
    const moving = view.cycle && (view.cycle.command === 'march' || view.cycle.command === 'charge');
    // On a march the formation surges forward on each drummed stroke.
    const surge = moving ? this.strokePulse(view.cycle, t).pulse : 0;
    this.spring(fm, frontTarget, 2 + 7 * surge, dt);
    mm.front = fm.x;
    const calm = this.reduceMotion ? 0 : 1;

    // Each soldier follows her own slot on her own spring: the front rank
    // a little quicker, small drifts in spacing, her own stride.
    if (mm.units.length === 0) {
      for (let i = 0; i < 12; i++) {
        const col = Math.floor(i / 2);
        mm.units.push({
          x: frontTarget - 20 - col * 34 - (i % 2) * 14,
          v: 0,
          k: 3.6 - col * 0.18 + Math.random() * 0.5,
          phase: Math.random(),
          drift: Math.random() * Math.PI * 2,
          delay: col * 0.07 + Math.random() * 0.05,
          alpha: 1,
        });
      }
    }
    // The drum crew walks behind the ranks, with the two companion drummers
    // (the barrel drum and the mõ) between them and the archers.
    // The wider palanquin (BD-C14) needs more room in front of it.
    const wide = !battle.elephant && !!this.art.get('drum-palanquin');
    const crewOffset = battle.elephant ? 460 : wide ? 430 : 445;
    const compX = battle.elephant ? 200 : wide ? 165 : 170;
    const cm = mm.crew;
    this.spring(cm, frontTarget - crewOffset, 2.6, dt);

    g.save();
    for (let i = 0; i < 12; i++) if (mm.units[i].alpha > 0.05) this.footShadow(mm.units[i].x, 16 * mm.units[i].alpha, GROUND - (i % 2) * 7);
    this.footShadow(cm.x, battle.elephant ? 110 : 80);
    this.footShadow(cm.x + compX, 34);
    this.backlit();
    // The drum crew walks with the army.
    const crewSpeed = Math.abs(cm.v);
    cm.phase = (cm.phase || 0) + (crewSpeed * dt) / 60;
    const crewView = { ...view, crewBob: Math.abs(Math.sin(cm.phase * Math.PI)) * Math.min(1, crewSpeed / 40) * 3 * calm };
    this.drumCrew(cm.x, GROUND, crewView);
    this.companions(cm.x + compX, GROUND, crewView);

    // Two ranks: the back rank (odd slots) stands a little further up the
    // ground, smaller and dimmer, and is drawn first so the front rank's
    // figures overlap it rather than the other way round.
    const ranks = [...Array(12).keys()].reverse();
    ranks.sort((a, b) => (b % 2) - (a % 2));
    for (const i of ranks) {
      const u = mm.units[i];
      const archer = i >= 8;
      const row = i % 2;
      const col = Math.floor(i / 2);
      const alive = i < n;
      const slot = frontTarget - 20 - col * 34 - row * 14 + Math.sin(t * 0.5 + u.drift) * 3 * calm;
      if (alive) {
        this.spring(u, slot, u.k, dt);
        u.alpha = Math.min(1, u.alpha + dt * 4);
        u.fall = 0;
      } else {
        // Fallen: topple and fade where she stood.
        u.alpha = Math.max(0, u.alpha - dt * 2.2);
        u.fall = Math.min(1, (u.fall || 0) + dt * 2.2);
        u.v *= 0.9;
      }
      if (u.alpha <= 0.02) continue;
      const speed = Math.abs(u.v);
      const gait = Math.min(1, speed / 35) * calm;
      // Her own moment in the drummed rhythm: a ripple from front to back.
      const cyc = alive ? view.cycle : null;
      const tt = t - u.delay;
      let thrust = 0;
      let bob = Math.sin(t * 2.2 + u.drift) * 0.8 * calm;
      let tilt = (u.fall || 0) * -1.2;
      if (cyc && cyc.command === 'march') {
        // One step on every stroke: the foot lands on the drum.
        const { pulse, count } = this.strokePulse(cyc, tt);
        bob += pulse * 6 * calm;
        tilt += (count % 2 ? 1 : -1) * 0.07 * pulse * calm;
      } else if (cyc && cyc.command === 'strike') {
        // Spears thrust on Trắc's strokes, bows loose on Nhị's.
        thrust = this.strokePulse(cyc, tt, archer ? 'R' : 'L').pulse * calm;
        tilt += thrust * 0.12;
        bob += thrust * 2;
      } else {
        // Between orders: a walking gait if still catching up, else breathing.
        u.phase += (speed * dt) / 40;
        bob += Math.abs(Math.sin(u.phase * Math.PI)) * 5 * gait;
        tilt += Math.sin(u.phase * Math.PI * 2) * 0.06 * gait;
      }
      bob *= u.alpha;
      const y = GROUND - row * 7;
      // A stone that got through: the women flinch, forearms over their faces.
      const covering = !shielded && alive && view.songTime < (view.coverUntil || 0);
      this.warrior(u.x, y, 1 - row * 0.06, { bob, thrust, tilt, lean: thrust * 7, shield: shielded && alive, cover: covering, raise: thrust > 0.3, alpha: u.alpha, dim: row === 1 }, t, archer);
    }
    g.restore();
  },

  /** Smoothed position and gait of one Han (or a target, or the fort). */
  enemyMotion(e, t, dt) {
    const mm = this.motion;
    let m = mm.enemies.get(e.id);
    if (!m) {
      m = { x: e.x * U, v: 0, phase: Math.random(), k: 2.6 + Math.random() * 0.8, alpha: 1, fell: null };
      mm.enemies.set(e.id, m);
    }
    if (!e.alive) {
      // Fall and fade rather than vanish.
      if (m.fell === null) m.fell = t;
      const k = (t - m.fell) / 0.5;
      if (k >= 1 || this.reduceMotion) return null;
      m.alpha = 1 - k;
      m.tilt = (e.type === 'fort' ? 0 : 0.9) * k;
      m.bob = -6 * k;
      return m;
    }
    if (e.type !== 'fort' && e.type !== 'target') this.spring(m, e.x * U, m.k, dt);
    else m.x = e.x * U;
    const speed = Math.abs(m.v);
    m.phase += (speed * dt) / 44;
    const gait = this.reduceMotion ? 0 : Math.min(1, speed / 40);
    m.bob = Math.abs(Math.sin(m.phase * Math.PI)) * 4 * gait + Math.sin(t * 2 + e.id) * 0.6;
    m.tilt = Math.sin(m.phase * Math.PI * 2) * 0.05 * gait;
    m.lean = 0;
    if (m.lunge && t <= m.lunge.t1 + 0.2) {
      // A spear lunge: drawn back, then driven forward as the blow lands.
      const k = Math.max(0, Math.min(1, (t - m.lunge.t0) / (m.lunge.t1 - m.lunge.t0)));
      // Drawn well back for most of the flight (the cue), then driven home.
      const drive = k < 0.75 ? -(k / 0.75) * 0.3 : ((k - 0.75) / 0.25) * 0.35;
      m.tilt += -drive;
      m.lean = -drive * 40;
    }
    m.alpha = 1;
    return m;
  },

  /**
   * The army moves on the rhythm that was drummed: how strongly a figure is
   * caught in a stroke at time tt (1 on the stroke, falling away after), and
   * how many strokes she has made this cycle. drum limits it to tùng or cắc.
   */
  strokePulse(cycle, tt, drum = null) {
    if (!cycle || tt < cycle.start) return { pulse: 0, count: 0 };
    const local = tt - cycle.start;
    let last = null;
    let count = 0;
    for (const s of cycle.strokes) {
      if (drum && s.drum !== drum) continue;
      const st = s.pos * cycle.u;
      if (st <= local) {
        last = st;
        count += 1;
      }
    }
    if (last === null || local > 4 * cycle.u) return { pulse: 0, count };
    return { pulse: Math.exp(-(local - last) / Math.min(0.14, cycle.u * 0.35)), count };
  },

  /** A cut-paper "!" over every Han winding up to strike. */
  threatMarks(view) {
    const g = this.ctx;
    const pulse = 0.85 + 0.15 * Math.sin(view.songTime * 14);
    for (const e of view.threats || []) {
      const x = (this.motion.enemies.get(e.id)?.x ?? e.x * U) + (e.type === 'fort' ? 90 : 0);
      const y = GROUND - (e.type === 'fort' ? 380 : e.type === 'crossbow' ? 112 : 130);
      g.save();
      g.translate(x, y);
      g.scale(pulse, pulse);
      g.fillStyle = P.lacquer;
      g.shadowColor = this.sky.glow;
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(0, -20);
      g.lineTo(15, 6);
      g.lineTo(-15, 6);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = P.paper;
      g.fillRect(-1.6, -11, 3.2, 9);
      g.fillRect(-1.6, 0, 3.2, 3);
      g.restore();
    }
  },

  /**
   * The shield wall: a translucent paper dome over the whole army, its rim
   * a row of big overlapping bronze shields, glowing while the guard is up.
   * Snaps up, fades down.
   */
  shieldWall(view) {
    const g = this.ctx;
    const t = view.songTime;
    const up = Math.min(1, (t - view.guardAt) / 0.12);
    const down = Math.min(1, (view.guardUntil - t) / 0.15);
    const a = Math.max(0, Math.min(up, down));
    if (a <= 0) return;
    const right = this.motion.front + 50;
    const left = this.motion.crew.x - 110;
    const lift = (1 - up) * 50;
    const base = GROUND + 4;
    const top = GROUND - 150 + lift;
    const yAt = (x) => {
      const k = (x - left) / (right - left);
      return base - (base - top) * Math.sin(Math.PI * k) ** 0.6;
    };
    g.save();
    // The dome: a glowing translucent sheet over everyone.
    g.globalAlpha = a * 0.22;
    g.fillStyle = P.bronzeLight;
    g.beginPath();
    g.moveTo(left, base);
    for (let x = left; x <= right; x += 10) g.lineTo(x, yAt(x));
    g.lineTo(right, base);
    g.closePath();
    g.fill();
    g.globalAlpha = a * 0.8;
    g.strokeStyle = P.bronzeLight;
    g.lineWidth = 3;
    g.shadowColor = P.bronzeLight;
    g.shadowBlur = 18;
    g.beginPath();
    for (let x = left; x <= right; x += 10) (x === left ? g.moveTo : g.lineTo).call(g, x, yAt(x));
    g.stroke();
    g.restore();
    // Big shields along the rim.
    g.save();
    g.globalAlpha = a;
    const n = Math.max(6, Math.round((right - left) / 34));
    for (let i = 0; i <= n; i++) {
      const x = left + ((right - left) * i) / n;
      this.roundShield(x, yAt(x) + 4, 24);
    }
    g.restore();
  },

  spawn(events, view) {
    const t = view.songTime;
    for (const ev of events) {
      if (ev.type === 'damage') {
        const sx = ev.x * U;
        const e = view.battle.enemies.find((n) => n.id === ev.target);
        if (e) e.shake = t + 0.25;
        this.scraps(sx, GROUND - 60, ev.source === 'elephant' ? 18 : 6, [P.paper, P.lacquer, P.straw]);
        this.floaters.push({ x: sx, y: GROUND - 140, text: `${Math.round(ev.amount)}`, t, color: P.paper });
      } else if (ev.type === 'defeated') {
        this.scraps(ev.x * U, GROUND - 60, 26, [P.ironDark, P.iron, P.paper, P.straw]);
      } else if (ev.type === 'volley') {
        // The archers loose together: a flight of arrows from along the ranks.
        for (let i = 0; i < 12; i++) this.projectile(ev.from * U - i * 9 - Math.random() * 6, ev.to * U + Math.random() * 60, t + i * 0.025, P.ink, 1, 0.45, 100 + Math.random() * 40);
      } else if (ev.type === 'launch') {
        // The blow is visible all the way: bolts arc over, a spear lunges.
        const dur = ev.arrive - ev.launch;
        const to = this.motion.front - 10;
        if (ev.kind === 'spear') {
          const m = this.motion.enemies.get(ev.from);
          if (m) m.lunge = { t0: ev.launch, t1: ev.arrive };
        } else if (ev.kind === 'children') {
          // A stone, lobbed high and slow.
          const m = this.motion.enemies.get(ev.from);
          if (m) m.threw = ev.launch;
          this.particles.push({ kind: 'stone', fromX: ev.x * U - 14, toX: to + 10, t0: ev.launch, dur, spin: (Math.random() - 0.5) * 18, r: 3 + Math.random() * 1.5 });
        } else {
          // A volley: every crossbowman of the squad (render/host.js) shoots, or the fort's walls.
          const n = ev.kind === 'fort' ? 10 : 8;
          for (let i = 0; i < n; i++) {
            const fromX = ev.x * U + (ev.kind === 'fort' ? 60 + Math.random() * 120 : -20 + (i % 5) * 22);
            this.projectile(fromX, to - Math.random() * 90, ev.launch + i * 0.025, P.ironDark, -1, dur, (ev.kind === 'fort' ? 150 : 110) + Math.random() * 30);
          }
        }
      } else if (ev.type === 'deflect' && ev.kind === 'children') {
        // A stone bounces off a raised forearm: a little grit.
        this.scraps(this.motion.front - 10, GROUND - 80, 4, [P.paperShade, P.ink]);
      } else if (ev.type === 'deflect') {
        // Bolts and blades glance off the shields.
        this.scraps(this.motion.front - 20, GROUND - 100, 10, [P.bronzeLight, P.paper, P.ironDark]);
      } else if (ev.type === 'wound' && ev.amount === 0) {
        // A harmless stone: it only stings.
        this.scraps(this.motion.front - 10, GROUND - 70, 3, [P.paperShade, P.ink]);
      } else if (ev.type === 'wound') {
        this.scraps(this.motion.front - 30, GROUND - 50, 8, [P.lacquer, P.ink]);
      } else if (ev.type === 'trample') {
        this.scraps(ev.x * U + 80, GROUND - 10, 40, [P.paper, P.paperShade, P.ink]);
        this.shake = t + 0.35;
      }
    }
  },

  scraps(x, y, n, colors) {
    if (this.reduceMotion) n = Math.ceil(n / 3);
    const sheet = this.scrapSheet();
    for (let i = 0; i < n; i++) {
      const c = colors[i % colors.length];
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.3) * 260,
        vy: -120 - Math.random() * 260,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        s: 4 + Math.random() * 7,
        c,
        // With the delivered sheet (BD-F01): a cut scrap of the nearest colour.
        cell: sheet ? this.scrapCell(sheet, c) : undefined,
        life: 1.2 + Math.random() * 0.6,
      });
    }
  },

  /**
   * The paper-scrap sheet (BD-F01): sixteen scraps in a row of 128 px cells,
   * each in the band 192-320 px of the 512 px sheet. On first use each
   * cell's average colour is measured, so a burst can ask for "lacquer and
   * ink" and get red and grey scraps.
   */
  scrapSheet() {
    const img = this.art.get('fx-scraps');
    if (!img) return null;
    if (!this.scrapInfo) {
      const c = canvas(64, 4);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, img.height * 0.375, img.width, img.height * 0.25, 0, 0, 64, 4);
      const data = g.getImageData(0, 0, 64, 4).data;
      const cells = [];
      for (let i = 0; i < 16; i++) {
        let r = 0, gg = 0, b = 0, a = 0;
        for (let y = 0; y < 4; y++) {
          for (let x = i * 4; x < i * 4 + 4; x++) {
            const k = (y * 64 + x) * 4;
            const w = data[k + 3] / 255;
            r += data[k] * w; gg += data[k + 1] * w; b += data[k + 2] * w; a += w;
          }
        }
        cells.push(a ? [r / a, gg / a, b / a] : [128, 128, 128]);
      }
      this.scrapInfo = { cells, by: new Map() };
    }
    return img;
  },

  /** A random scrap cell among the three nearest in colour to a hex colour. */
  scrapCell(sheet, hex) {
    const info = this.scrapInfo;
    if (!info.by.has(hex)) {
      const n = parseInt(hex.slice(1), 16);
      const want = [n >> 16, (n >> 8) & 255, n & 255];
      const ranked = info.cells.map((c, i) => [Math.hypot(c[0] - want[0], c[1] - want[1], c[2] - want[2]), i]).sort((a, b) => a[0] - b[0]);
      info.by.set(hex, ranked.slice(0, 3).map((r) => r[1]));
    }
    const near = info.by.get(hex);
    return near[Math.floor(Math.random() * near.length)];
  },

  /**
   * A chapter won: the drum's rings burst from the middle of the screen and
   * the scene celebrates in its own way: paper confetti over a battle or the
   * coronation, lanterns floating up when the villages answer, embers rising
   * from the incense, the foundry and the elegy.
   */
  celebrate(stage, t) {
    const kind = { villages: 'lantern', oath: 'ember', casting: 'ember', elegy: 'ember' }[stage.id] || 'confetti';
    const colors = {
      confetti: [P.lacquer, P.bronzeLight, P.paper, P.verdigris],
      ember: ['#FFB65C', '#FFD48A', '#FF8A3C'],
      lantern: ['#FFB65C', '#FF8A3C', '#F2C48C'],
    }[kind];
    this.celebration = { t, kind, colors, parts: [] };
  },

  /** Draw the celebration (screen space, over the scene, under the HUD). */
  drawCelebration(t, dt) {
    const c = this.celebration;
    if (!c) return;
    const g = this.ctx;
    const age = t - c.t;
    // The burst of the drum's rings, once.
    if (age < 1.6) this.wakeBurst(W / 2, H * 0.36, 760, Math.max(0, age) / 1.6);
    // Keep the air full of the scene's particles.
    const rate = this.reduceMotion ? 6 : c.kind === 'confetti' ? 40 : c.kind === 'lantern' ? 3 : 24;
    c.acc = (c.acc || 0) + dt * rate * (age < 2 ? 2.2 : 1);
    while (c.acc >= 1 && c.parts.length < 260) {
      c.acc -= 1;
      const col = c.colors[Math.floor(Math.random() * c.colors.length)];
      if (c.kind === 'confetti') {
        c.parts.push({ x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, r: Math.random() * 6, vr: (Math.random() - 0.5) * 6, s: 5 + Math.random() * 6, col, life: 9 });
      } else if (c.kind === 'lantern') {
        c.parts.push({ x: 80 + Math.random() * (W - 160), y: H + 30, vx: (Math.random() - 0.5) * 10, vy: -(25 + Math.random() * 25), r: 0, vr: 0, s: 9 + Math.random() * 7, col, life: 30, seed: Math.random() * 6 });
      } else {
        c.parts.push({ x: W * (0.2 + Math.random() * 0.6), y: H * 0.72 + Math.random() * 40, vx: (Math.random() - 0.5) * 30, vy: -(40 + Math.random() * 60), r: 0, vr: 0, s: 1.5 + Math.random() * 2.5, col, life: 3 + Math.random() * 3, seed: Math.random() * 6 });
      }
    }
    g.save();
    for (const p of c.parts) {
      p.life -= dt;
      p.x += (p.vx + (p.seed !== undefined ? Math.sin(t * 1.3 + p.seed) * 12 : 0)) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      if (c.kind === 'confetti') {
        const sheet = this.scrapSheet();
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.scale(1, Math.cos(t * 3 + p.s));
        if (sheet) {
          if (p.cell === undefined) p.cell = this.scrapCell(sheet, p.col);
          const cw = sheet.width / 16;
          g.drawImage(sheet, p.cell * cw, sheet.height * 0.375, cw, sheet.height * 0.25, -p.s, -p.s, p.s * 2, p.s * 2);
        } else {
          g.fillStyle = p.col;
          g.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2);
        }
        g.restore();
      } else if (c.kind === 'lantern') {
        // A paper sky lantern: a glowing body with a darker frame.
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.s * 3);
        gr.addColorStop(0, 'rgba(255,190,110,0.55)');
        gr.addColorStop(1, 'rgba(255,140,60,0)');
        g.fillStyle = gr;
        g.fillRect(p.x - p.s * 3, p.y - p.s * 3, p.s * 6, p.s * 6);
        g.restore();
        g.fillStyle = p.col;
        g.beginPath();
        g.ellipse(p.x, p.y, p.s * 0.7, p.s, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(22,21,26,0.6)';
        g.fillRect(p.x - p.s * 0.5, p.y + p.s * 0.85, p.s, 2);
      } else {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.max(0, Math.min(1, p.life));
        g.fillStyle = p.col;
        g.beginPath();
        g.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    g.restore();
    c.parts = c.parts.filter((p) => p.life > 0 && p.y < H + 40 && p.y > -60);
  },

  /** The drum wakes (or a drum is cast): its rings spread outward (BD-F03). */
  wake(t, where = 'crew') {
    this.wakes = (this.wakes || []).filter((w) => t - w.t < 1.6);
    this.wakes.push({ t, where });
  },

  /** One spreading burst of the drum's rings, centred on (x, y), up to `size` across. */
  wakeBurst(x, y, size, k) {
    const g = this.ctx;
    const img = this.art.get('fx-drum-wake');
    const d = size * (0.35 + 0.65 * (1 - (1 - k) ** 3));
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.85 * (1 - k) ** 1.5;
    if (img) {
      g.translate(x, y);
      g.rotate(k * 0.35);
      g.drawImage(img, -d / 2, -d / 2, d, d);
    } else {
      g.strokeStyle = P.bronzeLight;
      for (const f of [1, 0.8, 0.6]) {
        g.lineWidth = 4 * f;
        g.beginPath();
        g.arc(x, y, (d / 2) * f, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
  },

  projectile(fromX, toX, t0, color, dir, dur = 0.45, height = 120) {
    this.particles.push({ kind: 'arrow', fromX, toX, t0, dur, color, dir, height });
  },

  drawParticles(t, dt) {
    const g = this.ctx;
    this.particles = this.particles.filter((p) => {
      if (p.kind === 'stone') {
        // The children's stones: a high, slow lob, tumbling.
        const k = (t - p.t0) / p.dur;
        if (k < 0) return true;
        if (k > 1) return false;
        const x = p.fromX + (p.toX - p.fromX) * k;
        const y = GROUND - 50 - Math.sin(k * Math.PI) * 130 + k * -30;
        g.save();
        g.translate(x, y);
        g.rotate(p.spin * (t - p.t0));
        g.fillStyle = '#6E6A63';
        g.beginPath();
        g.ellipse(0, 0, p.r * 1.25, p.r, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(242,232,213,0.55)';
        g.beginPath();
        g.ellipse(-p.r * 0.35, -p.r * 0.3, p.r * 0.45, p.r * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        return true;
      }
      if (p.kind === 'arrow') {
        const k = (t - p.t0) / p.dur;
        if (k < 0) return true;
        if (k > 1) return false;
        const hgt = p.height || 120;
        const x = p.fromX + (p.toX - p.fromX) * k;
        const y = GROUND - 90 - Math.sin(k * Math.PI) * hgt;
        const ang = Math.atan2(-Math.cos(k * Math.PI) * hgt * Math.PI, p.toX - p.fromX);
        g.save();
        g.translate(x, y);
        g.rotate(ang);
        const fx = this.art.get('fx-projectiles');
        if (fx) {
          // The delivered arrows and bolts (BD-F02), the in-flight cuts with
          // motion lines: cell 1 a Lạc Việt arrow, cell 3 a Han bolt.
          const cw = fx.width / 4;
          const len = p.dir < 0 ? 44 : 50;
          g.drawImage(fx, (p.dir < 0 ? 3 : 1) * cw, 0, cw, fx.height, -len / 2, -len / 2, len, len);
          g.restore();
          return true;
        }
        if (p.dir < 0) {
          // Han bolts: a faint light trail so they read against any sky.
          g.fillStyle = this.sky.glow;
          g.globalAlpha = 0.35;
          g.fillRect(-34, -1.5, 22, 3);
          g.globalAlpha = 1;
        }
        g.fillStyle = p.color;
        g.fillRect(-14, -1, 28, 2);
        g.beginPath();
        g.moveTo(16, 0);
        g.lineTo(10, -3);
        g.lineTo(10, 3);
        g.fill();
        g.restore();
        return true;
      }
      p.life -= dt;
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y = Math.min(GROUND + 14, p.y + p.vy * dt);
      if (p.y >= GROUND + 14) p.vx *= 0.8;
      p.r += p.vr * dt;
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      g.translate(p.x, p.y);
      g.rotate(p.r);
      const sheet = p.cell !== undefined && this.art.get('fx-scraps');
      if (sheet) {
        const cw = sheet.width / 16;
        const sz = p.s * 2.6;
        g.drawImage(sheet, p.cell * cw, sheet.height * 0.375, cw, sheet.height * 0.25, -sz / 2, -sz / 2, sz, sz);
        g.restore();
        return p.life > 0;
      }
      if (this.style === 'water') {
        this.splashBit(p);
        g.restore();
        return p.life > 0;
      }
      g.fillStyle = p.c;
      g.beginPath();
      g.moveTo(-p.s, -p.s * 0.4);
      g.lineTo(p.s, -p.s * 0.6);
      g.lineTo(p.s * 0.3, p.s * 0.6);
      g.fill();
      g.restore();
      return p.life > 0;
    });
    this.floaters = this.floaters.filter((f) => {
      const k = t - f.t;
      if (k > 1) return false;
      g.save();
      g.globalAlpha = 1 - k;
      g.font = '600 20px "Cormorant Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y - k * 40);
      g.restore();
      return true;
    });
  },
};
