import { bakedGlow } from './glow.js';
import { PALETTE as P } from '../palette.js';
import { drawRig } from '../rig.js';
import { GROUND, rng, canvas, leaf, star } from './common.js';

// The sisters' strikes (pose angles at the moment of contact). Away from the
// palanquin they strike a drum in front of them; on it (BD-C14 drawn 190 px
// tall, the sisters 96 px) they stand either side of the drum, and the angles
// are solved by forward kinematics so the beater lands on the sun-star (the
// top's centre, 20% of the palanquin's height above the deck) and Nhị's stick
// on the near rim (9.6% of its width right of centre).
const TRAC_STRIKE = { capR: 0, armR: -2.3, stick: 4.38 };
const NHI_STRIKE = { armR: -0.7, foreR: -2.0 };
const PALANQUIN = {
  trac: -52,
  nhi: 64,
  tracStrike: { capR: 0.002, armR: -1.706, stick: 3.99 },
  nhiStrike: { armR: -0.793, foreR: -2.372 },
};

/**
 * A sister's stroke, 0 (raised, ready) to 1 (on the drum), `since` seconds
 * after it sounded. It is drawn after the sound, so the stick is on the drum
 * from the first frame rather than swinging down late; it rests there for
 * 50 ms and lifts back over 0.35 s.
 */
function strikeEnvelope(since) {
  if (!(since >= 0)) return 0;
  if (since < 0.05) return 1;
  if (since < 0.4) return (1 - (since - 0.05) / 0.35) ** 2;
  return 0;
}

export const figures = {
  /** A Lạc Việt warrior woman, facing right. */
  warrior(x, y, s, pose, t, archer) {
    const g = this.ctx;
    // Covering her face (the garden's block): her own figure for it when
    // delivered (BD-C16, BD-C17), else her usual one ducking behind a drawn forearm.
    const coverArt = pose.cover && this.art.get(archer ? 'unit-archer-cover' : 'unit-spear-cover');
    const art = coverArt || this.art.get(archer ? 'unit-archer' : 'unit-spear');
    const img = art && pose.dim ? this.shaded(art) : art;
    if (img) {
      const p = pose.cover && !coverArt ? { ...pose, bob: (pose.bob || 0) - 3, tilt: (pose.tilt || 0) - 0.06 } : pose;
      this.sprite(img, x, y, 92 * s, p);
      if (pose.shield) this.roundShield(x + 14 * s + (pose.lean || 0), y - 40 * s - (pose.bob || 0), 11 * s, pose.alpha);
      if (pose.cover && !coverArt) this.coverArm(x + (pose.lean || 0), y - (p.bob || 0), s, pose.alpha);
      return;
    }
    g.save();
    if (pose.alpha !== undefined) g.globalAlpha *= pose.alpha;
    g.translate(x + (pose.lean || 0), y);
    g.rotate(pose.tilt || 0);
    g.scale(s, s);
    const bob = pose.bob;
    g.translate(0, -bob);
    g.fillStyle = P.ink;
    // Skirt and body.
    g.beginPath();
    g.moveTo(-11, 0);
    g.lineTo(11, 0);
    g.lineTo(6, -30);
    g.lineTo(-6, -30);
    g.fill();
    g.fillRect(-5, -52, 10, 24);
    // Head, bun, feathered crown fanning back.
    g.beginPath();
    g.arc(1, -60, 7, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 5; i++) leaf(g, -2, -64, 26 - i * 2, -Math.PI * 0.62 - i * 0.16, 0.14);
    // Lacquer sash.
    g.fillStyle = P.lacquer;
    g.fillRect(-6, -36, 12, 4);
    // Cut detail: a band of dots round the skirt, an eye, a bead collar.
    this.cutLight(g);
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.arc(k * 3.6, -12, 1.1, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(-7 + 1, -21, 12, 1);
    g.beginPath();
    g.arc(4, -61, 1, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-3, -50, 7, 1);
    this.endCut(g);
    g.fillStyle = P.ink;
    if (archer) {
      g.save();
      g.translate(9, -46);
      g.rotate(pose.raise ? -0.7 : -0.2);
      g.lineWidth = 2.4;
      g.strokeStyle = P.ink;
      g.beginPath();
      g.arc(0, 0, 18, -1.2, 1.2);
      g.stroke();
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(Math.cos(-1.2) * 18, Math.sin(-1.2) * 18);
      g.lineTo(pose.raise ? -4 : 2, 0);
      g.lineTo(Math.cos(1.2) * 18, Math.sin(1.2) * 18);
      g.stroke();
      g.restore();
    } else {
      // Spear: levelled on a thrust, upright otherwise.
      g.save();
      g.translate(6, -44);
      g.rotate(0.2 + 1.25 * Math.min(1, pose.thrust || 0));
      g.translate(pose.thrust * 10, 0);
      g.fillRect(-1.3, -44, 2.6, 70);
      g.beginPath();
      g.moveTo(0, -56);
      g.lineTo(4, -44);
      g.lineTo(-4, -44);
      g.fill();
      g.restore();
    }
    if (pose.shield) {
      g.beginPath();
      g.ellipse(13, -38, 7, 18, 0, 0, Math.PI * 2);
      g.fill();
      this.cutLight(g);
      star(g, 13, -38, 5, 2, 8);
      this.endCut(g);
    }
    g.restore();
  },

  /**
   * A darker copy of a cut-out, made once: the back rank stands a little in
   * shadow. (A canvas filter per figure per frame is far too slow, and Safari
   * has none.)
   */
  shaded(img, grey = false) {
    this.shades = this.shades || new Map();
    const key = grey ? 'grey' : 'dim';
    let byImg = this.shades.get(img);
    if (!byImg) this.shades.set(img, (byImg = {}));
    let c = byImg[key];
    if (!c) {
      c = canvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      if (grey) {
        // Drain the colour (a grey fill in 'saturation' mode), then keep only
        // the figure's own shape again.
        g.globalCompositeOperation = 'saturation';
        g.fillStyle = '#808080';
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(img, 0, 0);
      }
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = grey ? 'rgba(16,14,22,0.45)' : 'rgba(16,14,22,0.22)';
      g.fillRect(0, 0, c.width, c.height);
      c.footMargin = img.footMargin;
      byImg[key] = c;
    }
    return c;
  },

  /** A forearm raised across a figure's face (feet at x, y; s its scale). */
  coverArm(x, y, s, alpha = 1) {
    const g = this.ctx;
    g.save();
    if (alpha !== undefined) g.globalAlpha *= alpha;
    g.strokeStyle = P.ink;
    g.lineCap = 'round';
    g.lineWidth = 6.5 * s;
    g.beginPath();
    g.moveTo(x + 16 * s, y - 56 * s); // the elbow, out in front
    g.lineTo(x + 9 * s, y - 80 * s); // the hand, over the brow
    g.stroke();
    g.fillStyle = P.lacquer; // a red cuff at the wrist
    g.beginPath();
    g.arc(x + 11 * s, y - 73 * s, 3 * s, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },

  /**
   * One of the village children (BD-C15 sheet, or a drawn silhouette): running
   * in, winding up on the beat before a throw, throwing, and running off
   * (flipped). Faces left, towards the army, until fleeing.
   */
  child(e, x, y, t, m) {
    const g = this.ctx;
    const moving = Math.abs(m.v || 0) > 6;
    const threwAgo = m.threw !== undefined ? t - m.threw : 9;
    let pose = 0; // 0, 1 running strides; 2 winding up; 3 the throw
    if (threwAgo >= 0 && threwAgo < 0.3) pose = 3;
    else if (!e.fleeing && !moving && e.cooldown === 1) pose = 2;
    else if (moving) pose = Math.floor(t * 8 + e.id) % 2;
    else pose = 0;
    const H = 74;
    const bob = moving ? Math.abs(Math.sin(t * 16 + e.id)) * 3 : 0;
    const sheet = this.art.get('children-sheet');
    g.save();
    g.translate(x, y - bob);
    if (e.fleeing) g.scale(-1, 1); // running off the way they came
    if (sheet) {
      const cw = sheet.width / 4;
      const ch = sheet.height / 2;
      const w = (cw / ch) * H;
      g.drawImage(sheet, pose * cw, (e.child || 0) * ch, cw, ch, -w / 2, -H, w, H);
      g.restore();
      return;
    }
    // Drawn stand-in, facing left: a small ink silhouette.
    g.scale(1.3, 1.3);
    g.fillStyle = P.ink;
    g.strokeStyle = P.ink;
    g.lineCap = 'round';
    const stride = pose === 0 ? 1 : pose === 1 ? -1 : 0;
    g.lineWidth = 4;
    g.beginPath(); // legs
    g.moveTo(0, -20);
    g.lineTo(-7 * stride - 2, 0);
    g.moveTo(0, -20);
    g.lineTo(7 * stride + 2, 0);
    g.stroke();
    g.beginPath(); // body
    g.moveTo(-6, -20);
    g.lineTo(6, -20);
    g.lineTo(4, -38);
    g.lineTo(-4, -38);
    g.fill();
    g.beginPath(); // head
    g.arc(-1, -45, 6.5, 0, Math.PI * 2);
    g.fill();
    if (e.child) {
      // The girl's two tufts and her red sash.
      g.beginPath();
      g.arc(3, -51, 2.6, 0, Math.PI * 2);
      g.arc(-5, -51, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.lacquer;
      g.fillRect(-6, -24, 12, 3);
    } else {
      g.beginPath(); // the boy's topknot
      g.arc(0, -53, 2.8, 0, Math.PI * 2);
      g.fill();
    }
    // The throwing arm: back with a stone, then flung forward.
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(0, -34);
    if (pose === 2) g.lineTo(12, -44);
    else if (pose === 3) g.lineTo(-14, -40);
    else g.lineTo(-6 * stride, -24);
    g.stroke();
    if (pose === 2) {
      g.fillStyle = '#6E6A63';
      g.beginPath();
      g.arc(13, -46, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  },

  /** A round hide shield with a cut star, raised in front of a warrior. */
  roundShield(x, y, r, alpha = 1) {
    const g = this.ctx;
    g.save();
    g.globalAlpha *= alpha;
    g.fillStyle = P.bronze;
    g.beginPath();
    g.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.bronzeLight;
    star(g, x, y, r * 0.6, r * 0.25, 8);
    g.restore();
  },

  /** A Han soldier, facing left: iron grey, conical cap, lamellar coat. */
  hanSoldier(e, x, y, t, beatPhase) {
    const g = this.ctx;
    const crossbow = e.type === 'crossbow';
    const img = this.art.get(crossbow ? 'han-crossbow' : 'han-spear');
    if (img) return this.sprite(img, x, y, 96, e.pose || { bob: 0 });
    g.save();
    g.translate(x, y - (crossbow ? 0 : Math.abs(Math.sin(beatPhase * Math.PI)) * 2));
    g.fillStyle = P.ironDark;
    if (crossbow) {
      // Kneeling crossbowman.
      g.fillRect(-10, -16, 20, 16);
      g.fillRect(-6, -40, 12, 26);
      g.beginPath();
      g.arc(-1, -47, 7, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-26, -38, 24, 3);
      g.fillRect(-24, -44, 3, 14);
    } else {
      g.beginPath();
      g.moveTo(-10, 0);
      g.lineTo(10, 0);
      g.lineTo(7, -32);
      g.lineTo(-7, -32);
      g.fill();
      g.fillRect(-6, -54, 12, 24);
      g.beginPath();
      g.arc(-1, -61, 7, 0, Math.PI * 2);
      g.fill();
      // Halberd (ji).
      g.fillRect(-14, -96, 2.6, 92);
      g.fillRect(-22, -86, 10, 2.5);
    }
    // Conical cap.
    g.beginPath();
    const hy = crossbow ? -50 : -64;
    g.moveTo(-9, hy);
    g.lineTo(-1, hy - 13);
    g.lineTo(7, hy);
    g.fill();
    // Lamellar: rows of small cut slots that let the light through.
    this.cutLight(g);
    const top = crossbow ? -38 : -52;
    for (let row = 0; row < 3; row++) for (let k = 0; k < 3; k++) g.fillRect(-5 + k * 4, top + 4 + row * 6, 2, 3);
    this.endCut(g);
    g.fillStyle = P.iron;
    g.fillRect(-6, top + 20, 12, 3);
    g.restore();
    this.hpBar(x, y - 108, e);
  },

  fort(e, x, y) {
    const g = this.ctx;
    const img = this.art.get('fort-palisade');
    if (img) {
      this.sprite(img, x + 60, y, 300, { bob: 0 }, e);
      return this.hpBar(x + 60, y - 290, e, 140);
    }
    g.save();
    g.translate(x, y);
    g.fillStyle = P.ironDark;
    for (let i = 0; i < 16; i++) {
      const px = -20 + i * 13;
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, -110);
      g.lineTo(px + 6, -122);
      g.lineTo(px + 12, -110);
      g.lineTo(px + 12, 0);
      g.fill();
    }
    // Watchtower with a tiled roof.
    g.fillRect(70, -230, 8, 230);
    g.fillRect(130, -230, 8, 230);
    g.fillRect(60, -250, 90, 44);
    g.beginPath();
    g.moveTo(40, -250);
    g.quadraticCurveTo(105, -262, 170, -250);
    g.lineTo(150, -290);
    g.lineTo(60, -290);
    g.closePath();
    g.fill();
    g.fillRect(104, -340, 3, 52);
    g.fillStyle = P.iron;
    g.beginPath();
    g.moveTo(107, -340);
    g.lineTo(150, -330);
    g.lineTo(107, -316);
    g.fill();
    this.cutLight(g);
    for (let k = 0; k < 4; k++) g.fillRect(70 + k * 20, -238, 10, 18);
    this.endCut(g);
    // Damage: the paper tears away from the top.
    const lost = 1 - e.hp / e.maxHp;
    if (lost > 0) {
      this.cutLight(g);
      const r = rng(e.id + 1);
      for (let i = 0; i < Math.floor(lost * 24); i++) {
        g.beginPath();
        const cx = -20 + r() * 210;
        const cy = -100 - r() * 160;
        g.moveTo(cx, cy);
        g.lineTo(cx + 14 + r() * 20, cy + r() * 18);
        g.lineTo(cx + r() * 10, cy + 20 + r() * 20);
        g.fill();
      }
      this.endCut(g);
    }
    g.restore();
    this.hpBar(x + 90, y - 360, e, 140);
  },

  target(e, x, y, t) {
    const g = this.ctx;
    const img = this.art.get('straw-target');
    if (img) return this.sprite(img, x, y, 110, { bob: 0 }, e);
    g.save();
    g.translate(x, y);
    const hitShake = Math.max(0, (e.shake || 0) - t);
    g.rotate(Math.sin(t * 40) * hitShake * 0.4);
    g.fillStyle = P.ink;
    g.fillRect(-3, -90, 6, 90);
    g.fillRect(-26, -76, 52, 5);
    g.fillStyle = P.straw;
    g.beginPath();
    g.ellipse(0, -66, 16, 28, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0, -104, 11, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.ink;
    g.lineWidth = 2;
    for (const yy of [-82, -66, -50]) {
      g.beginPath();
      g.moveTo(-14, yy);
      g.lineTo(14, yy);
      g.stroke();
    }
    g.restore();
    this.hpBar(x, y - 126, e, 50);
  },

  /** Draw a cut-out standing at (x, y): bob lifts it, tilt rocks it about its feet, lean shifts it. */
  sprite(img, x, y, h, pose = { bob: 0 }) {
    const w = (img.width / img.height) * h;
    const g = this.ctx;
    // Stand on the figure's feet, not on the bottom of its image (art.js measures the empty margin).
    y += (img.footMargin || 0) * h;
    // Under the backlit glow, a copy with the glow baked in (render/glow.js).
    const glow = bakedGlow(g, img, w, h);
    let src = img;
    let ox = -w / 2;
    let oy = -h;
    let dw = w;
    let dh = h;
    if (glow) {
      src = glow.c;
      ox -= glow.pad;
      oy -= glow.pad;
      dw = glow.c.width / glow.scale;
      dh = glow.c.height / glow.scale;
    }
    if (!pose.tilt && !pose.lean && pose.alpha === undefined) {
      if (glow) {
        const blur = g.shadowBlur;
        g.shadowBlur = 0;
        g.drawImage(src, x + ox, y + oy - (pose.bob || 0), dw, dh);
        g.shadowBlur = blur;
      } else g.drawImage(img, x - w / 2, y - h - (pose.bob || 0), w, h);
      return;
    }
    g.save();
    if (glow) g.shadowBlur = 0;
    if (pose.alpha !== undefined) g.globalAlpha *= pose.alpha;
    g.translate(x + (pose.lean || 0), y - (pose.bob || 0));
    g.rotate(pose.tilt || 0);
    g.drawImage(src, ox, oy, dw, dh);
    g.restore();
  },


  /** A prop: delivered art when there is some, else the stand-in callback. */
  prop(id, x, y, h, standIn, pose) {
    const img = this.art.get(id);
    if (img) {
      this.sprite(img, x, y, h, pose || { bob: 0 });
      return true;
    }
    standIn();
    return false;
  },

  /** The shadow a backlit figure throws forward onto the ground. */
  footShadow(x, w, y = GROUND) {
    // Water puppets cast none on the pond: rings of ripples instead (Renderer.pond).
    if (this.style === 'water') return this.ripple(x, w);
    const g = this.ctx;
    g.save();
    g.shadowColor = 'transparent'; // no glow behind a shadow
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    // Just under the feet, so the figure stands on it rather than above it.
    g.ellipse(x, y + 3, w, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },

  hpBar(x, y, e, w = 44) {
    if (e.hp >= e.maxHp) return;
    const g = this.ctx;
    g.fillStyle = 'rgba(22,21,26,0.6)';
    g.fillRect(x - w / 2, y, w, 5);
    g.fillStyle = P.paper;
    g.fillRect(x - w / 2, y, (w * e.hp) / e.maxHp, 5);
  },

  /** Knife cuts in a figure: light from the lamp shows through them. */
  cutLight(g) {
    g.save();
    g.shadowColor = this.sky.glow;
    g.shadowBlur = 4;
    g.fillStyle = this.sky.glow;
    g.strokeStyle = this.sky.glow;
  },

  endCut(g) {
    g.restore();
  },

  /** Light from behind spills round a figure's edge. */
  backlit() {
    const g = this.ctx;
    if (this.style === 'water') {
      // Lit from the front by lanterns: a soft shadow behind, no glow.
      g.shadowColor = 'rgba(0,0,0,0.35)';
      g.shadowBlur = 6;
      g.shadowOffsetX = 3;
      g.shadowOffsetY = 2;
      return;
    }
    g.shadowColor = this.sky.glow;
    g.shadowBlur = 9;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = -1;
  },

  /** The bronze drum with both sisters: on a carrying frame, or the elephant. */
  drumCrew(x, y, view) {
    const g = this.ctx;
    const t = view.songTime;
    const armL = Math.max(0, 1 - (t - this.crewFlash.L) * 6);
    const armR = Math.max(0, 1 - (t - this.crewFlash.R) * 6);
    if (view.battle.elephant) {
      const charging = view.battle.order && view.battle.order.command === 'charge';
      // The elephant's gait comes from how fast it is actually moving.
      const step = charging && view.cycle ? this.strokePulse(view.cycle, t).pulse * 7 : view.crewBob || 0;
      const img = this.art.get('war-elephant');
      if (img) {
        // Painted art: the sisters stand inside the howdah, so draw them
        // first and let its rail cover their legs.
        this.sisters(x - 8, y - 165 - Math.abs(step), armL, armR, view, 30);
        this.sprite(img, x, y, 230, { bob: step });
        return;
      }
      this.elephant(x, y - Math.abs(step), view);
      this.sisters(x - 8, y - 160 - Math.abs(step), armL, armR, view);
    } else {
      const deck = this.art.get('drum-palanquin');
      if (deck) {
        // BD-C14: the sisters ride on the deck and beat the drum between them.
        // The request fixes the deck's top at 42% of the height up from the
        // bottom, and their standing places at 22% and 78% of the width.
        const H_ = 190;
        const sh = this.shiver(Math.max(this.crewFlash.L, this.crewFlash.R), t, 1.6);
        const bob = (view.crewBob || 0) - sh.dy;
        this.sprite(deck, x + sh.dx, y, H_, { bob });
        const deckY = y + (deck.footMargin || 0) * H_ - 0.42 * H_ - bob;
        this.sisters(x + sh.dx, deckY, armL, armR, view, 30, PALANQUIN);
        return;
      }
      const img = this.art.get('drum-bearers');
      if (img) {
        // The bearers carry the drum; the sisters walk on the ground beside
        // the palanquin, a step nearer than the bearers, and strike up at it.
        // (Standing on the deck they read as floating over the bearers' heads.)
        // The palanquin jolts a little with each stroke on the drum.
        const sh = this.shiver(Math.max(this.crewFlash.L, this.crewFlash.R), t, 1.6);
        const bob = (view.crewBob || 0) - sh.dy;
        this.sprite(img, x + sh.dx, y, 150, { bob });
        this.footShadow(x - 46, 22, y + 10);
        this.footShadow(x + 46, 22, y + 10);
        this.sisters(x, y + 10 - (view.crewBob || 0) * 0.5, armL, armR, view, 46);
        return;
      }
      {
        g.fillStyle = P.ink;
        g.fillRect(x - 60, y - 52, 120, 5); // carrying pole
        for (const px of [-64, 58]) this.warrior(x + px, y, 0.9, { bob: 0, thrust: 0 }, t, false);
        this.bronzeDrum(x, y - 18, 34, view);
      }
      this.sisters(x, y - 52, armL, armR, view);
    }
  },

  /**
   * The companion drummers who walk with the drum crew: one with a trống chầu
   * slung at her hip, struck when the shields go up; one with a mõ, knocked
   * when the rhythm is reset. Delivered art (BD-C11, BD-C12) or paper-cut
   * stand-ins; either shivers when its drum is struck.
   */
  companions(x, y, view) {
    const t = view.songTime;
    const bob = view.crewBob || 0;
    const kc = this.shiver(this.kicks.chau, t, 2.4);
    const km = this.shiver(this.kicks.mo, t, 2.4);
    const imgC = this.art.get('drummer-chau');
    const imgM = this.art.get('drummer-mo');
    if (imgM) this.sprite(imgM, x - 26 + km.dx, y, 84, { bob: bob - km.dy, tilt: km.k * 0.05 });
    else this.companionDrummer(x - 26 + km.dx, y - bob + km.dy, 'mo', km.k);
    if (imgC) this.sprite(imgC, x + 14 + kc.dx, y, 88, { bob: bob * 0.8 - kc.dy, tilt: kc.k * 0.05 });
    else this.companionDrummer(x + 14 + kc.dx, y - bob * 0.8 + kc.dy, 'chau', kc.k);
  },

  /** A stand-in companion drummer facing right, with her drum (hit: 0..1 just struck). */
  companionDrummer(x, y, kind, hit) {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.scale(1.05, 1.05);
    // Body: wrapped skirt, torso, head, a short fan of feathers.
    g.fillStyle = P.ink;
    g.beginPath();
    g.moveTo(-11, 0);
    g.lineTo(11, 0);
    g.lineTo(6, -34);
    g.lineTo(-6, -34);
    g.fill();
    g.fillRect(-5, -58, 10, 26);
    g.beginPath();
    g.arc(0, -65, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.paperShade;
    for (let i = 0; i < 5; i++) leaf(g, -1, -69, 22, -Math.PI / 2 - 0.5 + (i - 2) * 0.22, 0.12);
    g.fillStyle = P.lacquer;
    g.fillRect(-6, -36, 12, 4); // sash
    if (kind === 'chau') {
      // The barrel drum at her hip, its hide head facing the enemy.
      g.fillStyle = P.lacquer;
      g.beginPath();
      g.ellipse(15, -30, 13, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = P.bronzeLight;
      g.fillRect(4, -31, 22, 2);
      g.fillStyle = hit ? '#FFF4DA' : '#E6D3AE';
      g.beginPath();
      g.ellipse(27, -30, 4, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = P.ink;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-3, -56);
      g.lineTo(15, -45); // strap
      g.stroke();
      // Beater arm: raised, then down on the head when struck.
      const a = -1.1 + hit * 1.5;
      g.save();
      g.translate(4, -52);
      g.rotate(a);
      g.fillStyle = P.ink;
      g.fillRect(0, -2, 16, 4);
      g.fillStyle = '#5A3A22';
      g.fillRect(14, -1.5, 18, 3);
      g.fillStyle = P.lacquer;
      g.fillRect(29, -2.5, 5, 5);
      g.restore();
    } else {
      // The mõ held out in her left hand, the mallet in her right.
      g.fillStyle = P.ink;
      g.fillRect(2, -50, 14, 4); // forearm
      const grad = g.createRadialGradient(19, -50, 1, 21, -46, 11);
      grad.addColorStop(0, hit ? '#D09050' : '#A86E3A');
      grad.addColorStop(1, '#4E2E16');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(21, -46, 10, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1A0F08';
      g.fillRect(13, -43, 16, 2);
      const a = -1.4 + hit * 1.1;
      g.save();
      g.translate(3, -56);
      g.rotate(a);
      g.fillStyle = P.ink;
      g.fillRect(0, -2, 13, 4);
      g.fillStyle = '#5A3A22';
      g.fillRect(11, -1.2, 13, 2.4);
      g.fillStyle = '#7A4A26';
      g.beginPath();
      g.arc(25, 0, 3.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.restore();
  },

  /**
   * Trưng Trắc's pose at this moment. Between strokes she holds the stick
   * raised; on each tùng her beater is on the drum at once (strikeEnvelope)
   * and lifts back over a third of a second, with the body leaning into it. The cape and sash ribbons
   * hang on springs, so they trail the body and settle.
   */
  tracPose(view, strike = TRAC_STRIKE) {
    const t = view.songTime;
    const st = this.tracState || (this.tracState = { t, lean: 0, cape: { x: 0, v: 0 }, sashA: { x: 0, v: 0 }, sashB: { x: 0, v: 0 } });
    const dt = Math.min(0.05, Math.max(0, t - st.t));
    st.t = t;
    const since = t - this.crewFlash.L;
    const s = strikeEnvelope(since); // 0 raised and ready, 1 struck
    const calm = this.reduceMotion ? 0.3 : 1;
    const lerp = (a, b) => a + (b - a) * s;
    const breathe = Math.sin(t * 1.7) * 0.015 * calm;
    const torso = lerp(0, 0.05) + breathe;
    // Cloth follows on springs: it swings back as the body leans and bobs.
    const bob = view.crewBob || 0;
    const drive = { cape: -torso * 2.2 - bob * 0.02, sashA: -torso * 1.5 + bob * 0.03, sashB: -torso * 1.8 + bob * 0.025 };
    for (const [k, target] of Object.entries(drive)) {
      const m = st[k];
      const a = 60 * (target - m.x) - 7 * m.v;
      m.v += a * dt;
      m.x += m.v * dt;
    }
    return {
      torso,
      head: lerp(0, 0.07) - breathe * 0.5,
      capR: lerp(-0.2, strike.capR),
      armR: lerp(-2.6, strike.armR),
      // Clockwise over the top: 2.3 (raised behind) to the strike, the beater
      // on the drum's face in front of her.
      stick: lerp(2.3, strike.stick),
      capL: lerp(-0.35, -0.2),
      foreL: lerp(-0.7, -0.4),
      cape: st.cape.x,
      sashA: 0.25 + st.sashA.x,
      sashB: 0.2 + st.sashB.x,
    };
  },

  /**
   * Trưng Nhị's pose at this moment. Both sticks are held up between
   * strokes (her part sheet's own pose); on each cắc her near arm whips
   * down onto the rim and lifts back, on the same timing as Trắc, while the
   * far stick flicks up as a counterweight.
   */
  nhiPose(view, strike = NHI_STRIKE) {
    const t = view.songTime;
    const since = t - this.crewFlash.R;
    const s = strikeEnvelope(since);
    const calm = this.reduceMotion ? 0.3 : 1;
    const sway = Math.sin(t * 1.9 + 1) * 0.02 * calm;
    return {
      torso: sway + 0.03 * s,
      head: -sway * 0.6 + 0.05 * s,
      armR: strike.armR * s,
      foreR: strike.foreR * s,
      armL: 0.2 * s,
      foreL: -0.35 * s,
    };
  },

  bronzeDrum(x, y, r, view) {
    const g = this.ctx;
    const pulse = view.spirit ? 0.5 + 0.5 * Math.sin(view.songTime * 8) : 0;
    g.save();
    g.fillStyle = P.bronze;
    g.shadowColor = view.spirit ? P.bronzeLight : 'transparent';
    g.shadowBlur = 20 * pulse;
    g.beginPath();
    g.moveTo(x - r, y - r * 0.9);
    g.lineTo(x + r, y - r * 0.9);
    g.quadraticCurveTo(x + r * 0.7, y, x + r * 0.85, y + r * 0.5);
    g.lineTo(x - r * 0.85, y + r * 0.5);
    g.quadraticCurveTo(x - r * 0.7, y, x - r, y - r * 0.9);
    g.fill();
    g.restore();
    g.fillStyle = P.bronzeLight;
    g.beginPath();
    g.ellipse(x, y - r * 0.9, r, r * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.ink;
    for (let k = 0; k < 3; k++) g.fillRect(x - r * 0.8, y - r * 0.55 + k * 9, r * 1.6, 1.5);
  },

  /**
   * The two sisters at (x, y), their feet: Trắc left, Nhị right, `spread`
   * either side. On the palanquin (layout PALANQUIN) they stand by the drum
   * and strike it: Trắc the sun-star, Nhị, turned to face it, the near rim.
   */
  sisters(x, y, armL, armR, view, spread = 30, layout = null) {
    const g = this.ctx;
    const imgT = this.art.get('sister-trac');
    const imgN = this.art.get('sister-nhi');
    if (imgT && imgN) {
      const tx = layout ? x + layout.trac : x - spread;
      const nx = layout ? x + layout.nhi : x + spread;
      // Each as a jointed puppet when her rig is built (BD-R01, BD-R02), else her sprite.
      const rigT = this.art.rig('sister-trac');
      if (rigT) drawRig(g, rigT, tx, y, 96, this.tracPose(view, layout ? layout.tracStrike : TRAC_STRIKE));
      else this.sprite(imgT, tx, y, 96, { bob: armL * 3 });
      const rigN = this.art.rig('sister-nhi');
      if (rigN) {
        g.save();
        if (layout) {
          // Mirrored about her feet, so she faces the drum.
          g.translate(nx, 0);
          g.scale(-1, 1);
          g.translate(-nx, 0);
        }
        drawRig(g, rigN, nx, y, 96, this.nhiPose(view, layout ? layout.nhiStrike : NHI_STRIKE));
        g.restore();
      } else this.sprite(imgN, nx, y, 96, { bob: armR * 3 });
      return;
    }
    const one = (sx, arm, side, gold) => {
      g.save();
      g.translate(sx, y);
      g.fillStyle = P.ink;
      g.beginPath();
      g.moveTo(-12, 0);
      g.lineTo(12, 0);
      g.lineTo(7, -36);
      g.lineTo(-7, -36);
      g.fill();
      g.fillRect(-6, -60, 12, 26);
      g.beginPath();
      g.arc(0, -68, 8, 0, Math.PI * 2);
      g.fill();
      // Tall gold crown of feathers.
      g.fillStyle = gold;
      for (let i = 0; i < 7; i++) leaf(g, 0, -72, 34, -Math.PI / 2 + (i - 3) * 0.2, 0.12);
      g.fillRect(-7, -48, 14, 5);
      g.fillStyle = P.ink;
      this.cutLight(g);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(0, -24 + k * 7, 1.6, 0, Math.PI * 2);
        g.fill();
      }
      star(g, 0, -56, 3.5, 1.3, 6);
      this.endCut(g);
      // Drumstick arm swings down on a hit.
      g.fillStyle = P.ink;
      g.save();
      g.translate(side * 4, -54);
      g.rotate(side * (-1.9 + arm * 1.3));
      g.fillRect(-2, 0, 4, 26);
      g.fillRect(-1.5, 24, 3, 14);
      g.restore();
      g.restore();
    };
    one(x - 24, armL, 1, P.bronzeLight); // Trắc, the centre
    one(x + 24, armR, -1, P.lacquer); // Nhị, the rim
    if (!view.battle.elephant) return;
    this.bronzeDrum(x, y + 6, 26, view);
  },

  elephant(x, y, view) {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.fillStyle = P.ink;
    const legPhase = view.songTime * (view.battle.order && view.battle.order.command === 'charge' ? 14 : 4);
    for (const [lx, ph] of [[-60, 0], [-34, 1.5], [36, 0.7], [62, 2.2]]) {
      g.fillRect(lx - 9, -60 + Math.sin(legPhase + ph) * 3, 18, 60);
    }
    g.beginPath();
    g.ellipse(0, -100, 92, 58, 0, 0, Math.PI * 2);
    g.fill();
    // Head, ear, trunk curling forward.
    g.beginPath();
    g.ellipse(86, -118, 40, 42, 0.2, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.strokeStyle = P.ink;
    g.beginPath();
    g.moveTo(112, -104);
    g.quadraticCurveTo(140, -60, 128, -22);
    g.quadraticCurveTo(124, -10, 136, -12);
    g.stroke();
    g.fillStyle = P.paper;
    g.beginPath();
    g.moveTo(112, -96);
    g.quadraticCurveTo(138, -92, 150, -112);
    g.lineTo(146, -104);
    g.quadraticCurveTo(136, -88, 112, -90);
    g.fill();
    // Cut ornament on the caparison: rings and a star, like the drum.
    this.cutLight(g);
    g.beginPath();
    g.arc(70, -128, 4, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(-4, -96, 64, 30, 0, 0, Math.PI * 2);
    g.stroke();
    star(g, -4, -96, 20, 8, 10);
    // Tangential circles round the caparison, leg bands, ear and eye.
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.arc(-4 + Math.cos(a) * 48, -96 + Math.sin(a) * 22, 3.2, 0, Math.PI * 2);
      g.stroke();
    }
    for (const lx of [-60, -34, 36, 62]) g.fillRect(lx - 8, -22, 16, 2);
    g.beginPath();
    g.ellipse(76, -112, 18, 24, 0.25, -1.2, 1.9);
    g.stroke();
    for (let k = 0; k < 4; k++) g.fillRect(118 + k * 2, -84 + k * 16, 9, 1.5);
    this.endCut(g);
    // Howdah.
    g.fillStyle = P.lacquer;
    g.fillRect(-50, -170, 92, 14);
    g.fillStyle = P.ink;
    g.fillRect(-46, -160, 4, 12);
    g.fillRect(34, -160, 4, 12);
    g.restore();
  },
};
