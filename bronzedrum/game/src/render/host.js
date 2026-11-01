// The Han in numbers. The battle rules count the Han in units (battle.js):
// a spear unit, a crossbow unit. On screen each unit is a squad, and behind
// the line stands the rest of the host, so the women are plainly outnumbered:
//
//  - A spear squad is six soldiers in two ranks, a crossbow squad five in a
//    staggered line. As a unit is worn down its soldiers fall one by one and
//    the rest close up, so the front line thins.
//  - The host: rank on rank of smaller, hazier soldiers further back, beyond
//    the last unit, scrolling slowly as far things do (always partly on
//    screen). It thins as the Han are beaten (or, holding the ford, as the
//    waves run out).
//
// Soldiers behind the front rank use cached copies of the sprite, toned into
// the haze and drawn without the glow, so the crowd stays cheap to draw.

import { W, GROUND, U } from './common.js';

// Soldiers per squad, and where each stands from the unit's front (field
// pixels: + is further back, since the Han face left), front rank first.
const SQUADS = {
  spear: {
    n: 6,
    slots: [
      { dx: 0, rank: 0 }, { dx: 30, rank: 0 }, { dx: 60, rank: 0 },
      { dx: 15, rank: 1 }, { dx: 45, rank: 1 }, { dx: 75, rank: 1 },
    ],
  },
  crossbow: {
    n: 5,
    slots: [
      { dx: 0, rank: 0 }, { dx: 44, rank: 0 }, { dx: 88, rank: 0 },
      { dx: 22, rank: 1 }, { dx: 66, rank: 1 },
    ],
  },
};
// The back rank: further up the ground, a little smaller, toned into the haze.
const BACK = { dy: -8, scale: 0.93, tone: 0.28 };
// The host: rows of far soldiers.
const HOST = { rows: 3, perRow: 10, gap: 32, rowGap: 10, height: 66, tone: 0.4, y: GROUND - 28 };

/** A cheap hash in 0..1 of a few numbers, for steady per-soldier variety. */
function jitter(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export const host = {
  /**
   * A Han soldier's sprite, scaled to h px and toned toward the haze by
   * `tone` (0 none, 1 all haze), cached per image, size, sky and tone.
   */
  farSprite(type, h, tone) {
    const img = this.art.get(type === 'crossbow' ? 'han-crossbow' : 'han-spear');
    if (!img) return null;
    const px = this.pixel;
    const key = `${img.src}@${h}@${tone}@${this.stage.sky}@${px}`;
    this.farSprites = this.farSprites || new Map();
    let c = this.farSprites.get(key);
    if (!c) {
      const H = Math.max(1, Math.round(h * px));
      const W = Math.max(1, Math.round((img.width / img.height) * H));
      c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, W, H);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = tone;
      g.fillStyle = this.sky.mid2;
      g.fillRect(0, 0, W, H);
      c.footMargin = img.footMargin || 0;
      this.farSprites.set(key, c);
    }
    return c;
  },

  /** Draw a cached far sprite standing at (x, y), h px tall. */
  drawFar(c, x, y, h, bob = 0) {
    const w = (c.width / c.height) * h;
    this.ctx.drawImage(c, x - w / 2, y + c.footMargin * h - h - bob, w, h);
  },

  /**
   * A Han unit as its squad: as many soldiers as its strength allows, the
   * back rank first (drawn behind), the front rank as the unit itself
   * (lunging with it). m is the unit's motion (render/field.js enemyMotion).
   */
  hanSquad(e, x, t, beatPhase, m) {
    const sq = SQUADS[e.type];
    if (!sq) return this.hanSoldier(e, x, GROUND, t, beatPhase);
    const frac = e.alive ? Math.max(0, e.hp) / e.maxHp : 0;
    const standing = e.alive ? Math.max(1, Math.ceil(sq.n * frac)) : 0;
    // A soldier who has just fallen topples and fades where he stood.
    m.standing = m.standing ?? sq.n;
    if (standing < m.standing) {
      m.fallen = m.fallen || [];
      for (let i = standing; i < m.standing; i++) m.fallen.push({ i, t });
      m.standing = standing;
    }
    const slots = sq.slots;
    const g = this.ctx;
    const draw = (i, extra = {}) => {
      const s = slots[i];
      const sx = x + s.dx + (jitter(e.id, i) - 0.5) * 6;
      const sy = GROUND + (s.rank ? BACK.dy : 0);
      const bob = (e.pose.bob || 0) + Math.sin(t * 2.2 + e.id * 1.7 + i) * 0.8;
      if (s.rank) {
        const h = 96 * BACK.scale;
        const c = this.farSprite(e.type, h, BACK.tone);
        if (c) {
          g.save();
          g.shadowColor = 'transparent'; // no glow behind the front rank: cheaper, and it sits back
          if (extra.alpha !== undefined) g.globalAlpha *= extra.alpha;
          if (extra.tilt) {
            g.translate(sx, sy);
            g.rotate(extra.tilt);
            this.drawFar(c, 0, 0, h, bob);
          } else this.drawFar(c, sx, sy, h, bob);
          g.restore();
          return;
        }
      }
      const pose = { ...e.pose, bob, ...extra };
      if (i > 0) {
        pose.lean = (pose.lean || 0) * 0.6; // the lunge leads from the front
        // Only the squad's lead soldier carries the backlit glow (it is costly per figure).
        g.save();
        g.shadowColor = 'transparent';
        this.hanSoldier({ ...e, pose }, sx, sy, t, beatPhase);
        g.restore();
        return;
      }
      this.hanSoldier({ ...e, pose }, sx, sy, t, beatPhase);
    };
    // Back rank, then front rank, each from the rear forward.
    const order = [...Array(standing).keys()].sort((a, b) => slots[b].rank - slots[a].rank || slots[b].dx - slots[a].dx);
    for (const i of order) {
      if (!slots[i].rank) this.footShadow(x + slots[i].dx, 16);
      draw(i);
    }
    // The fallen of the last half second.
    if (m.fallen) {
      m.fallen = m.fallen.filter((f) => t - f.t < 0.5);
      for (const f of m.fallen) {
        const k = (t - f.t) / 0.5;
        draw(f.i, { alpha: 1 - k, tilt: 0.9 * k });
      }
    }
  },

  /**
   * The rest of the host, further back beyond the last unit: rows of far
   * soldiers that thin as the Han are beaten. Drawn before the units.
   */
  hanHost(view, t) {
    const b = view.battle;
    const han = b.enemies.filter((e) => e.type === 'spear' || e.type === 'crossbow');
    if (!han.length && !b.survive) return;
    // How much of the host is left: the units' remaining strength, or the time left to hold.
    let left;
    if (b.survive) left = Math.max(0, 1 - b.time / b.survive);
    else {
      const total = han.reduce((s, e) => s + e.maxHp, 0);
      left = han.reduce((s, e) => s + (e.alive ? Math.max(0, e.hp) : 0), 0) / total;
    }
    const count = Math.round(HOST.rows * HOST.perRow * left);
    if (count <= 0) return;
    // Where it stands: behind the furthest living unit (or ahead of the army at the ford),
    // short of the fort, which stands at the back of everything.
    const alive = han.filter((e) => e.alive);
    const fort = b.enemies.find((e) => e.type === 'fort' && e.alive);
    let from = alive.length ? Math.max(...alive.map((e) => e.x)) * U + 120 : b.army.x * U + 700;
    if (b.survive) from = Math.max(from, b.army.x * U + 760);
    if (fort) from = Math.min(from, fort.x * U - HOST.perRow * HOST.gap - 40);
    // Far back, it scrolls slowly (parallax): where it stands on screen moves
    // a third as fast as the field, and part of it always shows on the right.
    const onScreen = Math.min(W - 330, W * 0.42 + (from - this.cam - W * 0.42) * 0.35);
    from = this.cam + onScreen;
    const g = this.ctx;
    g.save();
    for (let k = 0; k < count; k++) {
      const row = HOST.rows - 1 - Math.floor(k / HOST.perRow); // the far rows fill first
      const col = k % HOST.perRow;
      const type = (col + row) % 4 === 3 ? 'crossbow' : 'spear';
      const h = HOST.height * (1 - row * 0.08);
      const c = this.farSprite(type, Math.round(h), Math.min(0.8, HOST.tone + row * 0.1));
      if (!c) continue;
      const x = from + col * HOST.gap + row * 14 + (jitter(col, row) - 0.5) * 10;
      const y = HOST.y - row * HOST.rowGap;
      const bob = Math.abs(Math.sin(t * 1.6 + col * 0.9 + row)) * 1.2;
      this.drawFar(c, x, y, h, bob);
    }
    g.restore();
  },
};
