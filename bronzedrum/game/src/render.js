// Canvas renderer. Everything is a procedural paper-cut stand-in: flat
// silhouettes with knife-cut holes, lit from behind, each layer casting a soft
// shadow on the one behind it. When art.get(id) has a delivered image it is
// drawn instead (ids match assets/manifest.json).

import { SKIES } from './palette.js';
import { W, H, U, GROUND, COMPACT, ZOOM_BATTLE, ZOOM_STORY, ZOOM_EYE, ARMY_SCREEN_X, haze, fiberTexture } from './render/common.js';
import { backdrop } from './render/backdrop.js';
import { figures } from './render/figures.js';
import { story } from './render/story.js';
import { field } from './render/field.js';
import { hud } from './render/hud.js';
import { training } from './render/training.js';
import { touch } from './render/touch.js';
import { practice } from './render/practice.js';
import { pond } from './render/pond.js';
import { host } from './render/host.js';

export { W, H, U, TOUCH } from './render/common.js';

export class Renderer {
  constructor(canvasEl, art) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.art = art;
    this.cam = 0;
    this.particles = [];
    this.floaters = [];
    this.flash = { L: -9, R: -9 }; // the player's strokes: the drum and the close-up sticks
    this.crewFlash = { L: -9, R: -9 }; // the sisters' strokes in the scene
    this.crewQueue = []; // { drum, t } strokes the sisters play later (crewStroke)
    this.crewFollowsReplay = false; // in battle the sisters play the replay, not the player's strokes
    this.fiber = fiberTexture(); // the drawn paper fibre, until the delivered one arrives
    this.layers = null;
    this.reduceMotion = false;
    this.autoResolution = true; // main.js lowers dprCap when frames run slow
    this.dprCap = 2;
    // Count save()/restore() per frame (checked at the end of draw()).
    this.depth = 0;
    this.depthLow = 0;
    const ctx = this.ctx;
    const save = ctx.save.bind(ctx);
    const restore = ctx.restore.bind(ctx);
    ctx.save = () => {
      this.depth += 1;
      save();
    };
    ctx.restore = () => {
      this.depth -= 1;
      this.depthLow = Math.min(this.depthLow, this.depth);
      restore();
    };
    this.pressed = {}; // touch button id -> time pressed
    this.kicks = { chau: -9, mo: -9, second: -9 }; // when the companion drums (and practice's secondary drum) were last struck
    this.taps = []; // touch points, drawn as brief rings
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // Phones and tablets: a lower pixel ratio keeps the frame rate up.
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2, this.dprCap);
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H) || 1;
    // A canvas wider than 16:9 (a phone, src/fit.js): the 1280 x 720 layout
    // sits in the middle and the scene fills the margins `ex` either side.
    this.ex = Math.max(0, (rect.width / scale - W) / 2);
    this.canvas.width = Math.round((W + 2 * this.ex) * scale * dpr);
    this.canvas.height = Math.round(H * scale * dpr);
    this.pixel = scale * dpr;
    this.cssScale = scale;
    this.compact = scale < COMPACT;
  }

  setStage(stage) {
    this.stage = stage;
    this.sky = SKIES[stage.sky];
    this.cam = 0;
    this.particles = [];
    this.wakes = [];
    this.incenseState = null;
    this.celebration = null;
    this.clearing = null; // the last chapter's cleared dots (its clock was not this one's)
    this.wokenAt = {};
    this.floaters = [];
    this.lit = new Map(); // layers lit and scaled for this chapter only
    this.motion = { front: 0, frontM: { x: 0, v: 0 }, crew: { x: -330, v: 0 }, units: [], enemies: new Map() };
    // Each chapter opens on the wide shot; small screens move in once it starts.
    this.zoom = { z: 1, x: W / 2, y: ZOOM_EYE, started: false };
    this.flash = { L: -9, R: -9 };
    this.crewFlash = { L: -9, R: -9 };
    this.crewQueue = [];
    this.buildLayers();
  }

  /** The looks of the panels for this chapter (drawn ones where no art is delivered). */
  buildLayers() {
    const stage = this.stage;
    this.layers = {
      sky: this.buildSky(stage.sky),
      karstFar: this.buildKarst(true),
      karst: this.buildKarst(false),
      grove: this.buildGrove(stage.id === 'garden'),
      paddy: this.buildPaddy(),
      reeds: this.buildReeds(),
    };
  }

  /** 'shadow' or 'water' (Settings, Style; the art follows it). */
  get style() {
    return this.art.style;
  }

  /** The style changed: everything baked from the art is baked again. */
  restyle() {
    this.lit = new Map();
    this.farKey = null;
    this.overlayKey = null;
    if (this.stage) this.buildLayers();
  }

  draw(view, dt) {
    const g = this.ctx;
    this.depth = 0;
    this.depthLow = 0;
    this.frameDt = dt;
    // The sisters' strokes that are due.
    while (this.crewQueue.length && this.crewQueue[0].t <= view.songTime) {
      const s = this.crewQueue.shift();
      this.crewFlash[s.drum] = s.t;
    }
    const { battle, songTime: t } = view;
    const targetCam = (this.motion ? this.motion.front : battle.army.x * U) - ARMY_SCREEN_X;
    this.cam += (targetCam - this.cam) * Math.min(1, dt * 4);
    let sx = 0;
    if (this.shake && t < this.shake && !this.reduceMotion) sx = (Math.random() - 0.5) * 10;

    const ex = this.ex || 0;
    g.setTransform(this.pixel, 0, 0, this.pixel, ex * this.pixel, 0);
    g.clearRect(-ex, 0, W + 2 * ex, H);
    // The camera: wide, or moved in on the action on a small screen.
    const zm = this.updateZoom(view, dt);
    if (zm.z > 1.001) {
      g.translate(W / 2, ZOOM_EYE);
      g.scale(zm.z, zm.z);
      g.translate(-zm.x, -zm.y);
    }
    const skyArt = this.art.get(`sky-${this.stage.sky}`);
    const skyImg = skyArt ? this.litLayer(`sky-${this.stage.sky}`, skyArt) : null;
    // Panels from back to front, with the lamp's haze between them: the far
    // ones (which a hit's shake leaves still) cached as one image.
    g.drawImage(this.farBackdrop(skyImg), 0, 0, W, H);
    g.translate(sx, 0);
    this.layer('layer-grove', this.layers.grove, 0.45);
    haze(g, this.sky.glow, GROUND - 60, GROUND + 10, 0.12);
    this.layer('layer-paddy', this.layers.paddy, 1);
    const water = this.style === 'water';
    if (water) this.lanternString(t);

    // World space.
    g.save();
    g.translate(-this.cam, 0);
    if (view.mode !== 'battle') this.scene(view);
    if (view.stage && view.stage.id === 'mavien') this.general(view);
    const beatPhase = view.beatFloat % 1;
    // The rest of the Han host, further back (render/host.js).
    if (view.mode === 'battle') this.hanHost(view, t);
    for (const e of battle.enemies) {
      const m = this.enemyMotion(e, t, dt);
      if (!m) continue;
      const x = m.x;
      if (x - this.cam < -300 || x - this.cam > W + 300) continue;
      g.save();
      g.globalAlpha = m.alpha;
      const squad = e.type === 'spear' || e.type === 'crossbow';
      if (!squad) this.footShadow(x + (e.type === 'fort' ? 90 : 0), e.type === 'fort' ? 130 : 22);
      this.backlit();
      const shown = { ...e, pose: { bob: m.bob, tilt: m.tilt, lean: m.lean || 0 } };
      if (e.type === 'fort') this.fort(e, x, GROUND);
      else if (e.type === 'target') this.target(e, x, GROUND, t);
      else if (e.type === 'children') this.child(e, x, GROUND, t, m);
      else if (squad) this.hanSquad(shown, x, t, beatPhase, m);
      else this.hanSoldier(shown, x, GROUND, t, beatPhase);
      g.restore();
    }
    this.army(view, dt);
    if (view.shieldsUp || view.songTime <= view.guardUntil + 0.2) this.shieldWall(view);
    this.threatMarks(view);
    this.drawParticles(t, dt);
    // The drum waking: its rings spread from the drum the sisters play.
    for (const w of this.wakes || []) {
      const k = (t - w.t) / 1.4;
      if (w.where !== 'crew' || k < 0 || k > 1) continue;
      const cx = this.motion.crew.x;
      this.wakeBurst(cx, battle.elephant ? GROUND - 200 : GROUND - 80, 420, k);
    }
    // The water puppets wade: the pond over their feet (render/pond.js).
    if (water) this.pond(t);
    g.restore();
    if (water) this.reflection();

    this.layer('layer-reeds', this.layers.reeds, 1.25);
    g.setTransform(this.pixel, 0, 0, this.pixel, ex * this.pixel, 0);
    // Paper fibre over everything, as if the whole scene were one sheet, and
    // the vignette: baked into one image (Renderer.overlay).
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.drawImage(this.overlay(), -ex, 0, W + 2 * ex, H);
    g.restore();
    this.drawCelebration(t, dt);
    this.hud(view);
    // Every save() must have its restore(): a stray restore() pops the
    // camera and draws the rest of the scene in the wrong place.
    if (this.depth !== 0 || this.depthLow < 0) {
      if (!this.leakWarned) console.error(`Renderer: save()/restore() unbalanced in a frame (depth ${this.depth}, lowest ${this.depthLow})`);
      this.leakWarned = true;
    }
  }

  /**
   * The small-screen camera. It opens wide to set the scene, then once the
   * action starts (the first stroke, or five seconds in) eases in: on the
   * gap between the army's front and the nearest enemy in a battle, on the
   * middle of the stage otherwise. Never shows past the painted edges: on a
   * screen wider than 16:9 it is always moved in at least far enough for the
   * scene to fill the width (Renderer.ex).
   */
  updateZoom(view, dt) {
    const zm = this.zoom || (this.zoom = { z: 1, x: W / 2, y: ZOOM_EYE, started: false });
    const t = view.songTime;
    if (!zm.started && (Math.max(this.flash.L, this.flash.R) >= 0 || t > 5)) zm.started = true;
    let z = 1;
    let x = W / 2;
    let y = ZOOM_EYE;
    if (this.compact && zm.started) {
      const battle = view.mode === 'battle';
      z = battle ? ZOOM_BATTLE : ZOOM_STORY;
      y = GROUND; // the ground well above the drum, the figures in the middle
      if (battle) {
        const front = this.motion.front - this.cam;
        let near = Infinity;
        for (const e of view.battle.enemies) if (e.alive) near = Math.min(near, e.x * U - this.cam);
        x = near - front < 760 ? (front + near) / 2 - 40 : front + 120;
      }
    }
    const half = W / 2 + (this.ex || 0); // half the width on screen
    const least = half / (W / 2);
    // Moved in only to fill the width: the ground stays where it is, above the dots.
    if (z < least) y = GROUND - (GROUND - ZOOM_EYE) / least;
    z = Math.max(z, least);
    // Keep the view inside the painted scene.
    const clampX = (v, zz) => Math.min(W - half / zz, Math.max(half / zz, v));
    x = clampX(x, z);
    y = Math.min(H - (H - ZOOM_EYE) / z, Math.max(ZOOM_EYE / z, y));
    const k = 1 - Math.exp(-dt * (this.reduceMotion ? 6 : 1.8));
    zm.z = Math.max(least, zm.z + (z - zm.z) * k);
    zm.x = clampX(zm.x + (x - zm.x) * k, zm.z);
    zm.y += (y - zm.y) * k;
    return zm;
  }

  /** A point in the scene (before zoom) to the point on screen. */
  toScreen(x, y) {
    const zm = this.zoom || { z: 1, x: W / 2, y: ZOOM_EYE };
    return { x: W / 2 + (x - zm.x) * zm.z, y: ZOOM_EYE + (y - zm.y) * zm.z };
  }

  /**
   * A soft spring toward a target: the figure accelerates and settles
   * instead of jumping. k sets how quickly it follows.
   */
  spring(m, target, k, dt) {
    const a = k * k * (target - m.x) - 2 * k * m.v;
    m.v += a * dt;
    m.x += m.v * dt;
  }

  hit(drum, t) {
    this.flash[drum] = t;
    if (!this.crewFollowsReplay) this.crewFlash[drum] = t;
  }

  /** The sisters strike `drum` at song time `t` (the battle replay); in time order. */
  crewStroke(drum, t) {
    this.crewQueue.push({ drum, t });
    this.crewQueue.sort((a, b) => a.t - b.t);
  }

  /** Drop the sisters' strokes still to come (a new phrase cut the replay short). */
  cancelCrew(after) {
    this.crewQueue = this.crewQueue.filter((s) => s.t <= after);
  }
}

// The methods live in ./render/*.js, grouped by what they draw.
Object.assign(Renderer.prototype, backdrop, figures, story, field, hud, touch, practice, training, pond, host);
