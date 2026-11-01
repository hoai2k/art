// The player squirrel (ARCHITECTURE.md, "The squirrel contract" and "Many creatures, many
// scales"): model + procedural animation over the generic creature controller and camera.
//
//   const sq = await createSquirrel({ THREE, coat: 'black' });   // 'black' (default) | 'grey'
//   scene.add(sq.object); sq.reset(world.spawn); sq.update(dt, controls, world, camera);
//   const cam = createSquirrelCamera({ THREE, camera, squirrel: sq, world }); cam.update(dt, controls);
//
// createCreature / createCamera are the registry names (src/creatures/index.js).
// Pass { model: false } for a headless squirrel (tests): movement only, no meshes.
import * as THREE from 'three';
import { createController } from '../creatures/controller.js';
import { createFollowCamera } from '../creatures/camera.js';
import { SURFACE, climbable } from '../surface.js';
import { squirrelTuning } from './tuning.js';
import { loadSquirrelModel, buildSquirrelModel } from './model.js';
import { createAnimator } from './animator.js';

export const KIND = 'squirrel';
export const SCALE = 0.25;
const CLIMBS = new Set([SURFACE.wall_brick, SURFACE.wall_stone, SURFACE.wall_wood, SURFACE.bark, SURFACE.branch, SURFACE.fence]);

let _modelData = null;

export async function createSquirrel({ coat = 'black', model = true, assetUrl } = {}) {
  const T = squirrelTuning(SCALE);
  const ctrl = createController(T, { climbable: (id) => CLIMBS.has(id) });
  const object = new THREE.Group();
  object.name = 'squirrel';
  let mdl = null, anim = null;
  if (model) {
    _modelData ||= await loadSquirrelModel(assetUrl);
    mdl = buildSquirrelModel(_modelData, coat);
    object.add(mdl.group);
    anim = createAnimator(mdl, T);
  }
  const listeners = {};
  let currentCoat = coat;
  const sq = {
    kind: KIND, scale: SCALE, eyeHeight: 0.095, climbs: CLIMBS, canFly: false, tuning: T,
    object, controller: ctrl, model: mdl, animator: anim,
    position: ctrl.pos, velocity: ctrl.vel,
    get state() { return ctrl.state; },
    get coat() { return currentCoat; },
    get gait() {
      if (!anim) return '';
      const g = anim.state.gaitW; return ctrl.state !== 'move' ? ctrl.state : (g.bound > 0.5 ? 'bound' : g.half > 0.5 ? 'half-bound' : 'walk');
    },
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); }; },
    reset(spawn) { ctrl.reset(spawn); if (anim) anim.state.first = true; },
    setCoat(name) { currentCoat = name; mdl?.setCoat(name); },
    update(dt, controls, world, camera) {
      dt = Math.min(Math.max(dt, 0), 0.1);
      ctrl.update(dt, controls, world, camera);
      for (const [ev, data] of ctrl.events) for (const fn of listeners[ev] || []) fn(data);
      if (anim) { anim.update(dt, ctrl, mdl.group); }
    },
    dispose() {
      if (!mdl) return;
      object.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    },
  };
  return sq;
}

export const createCreature = (opts = {}) => createSquirrel(opts);

export function createSquirrelCamera({ camera, squirrel, creature, world }) {
  const c = squirrel || creature;
  return createFollowCamera({ camera, creature: c, world, tuning: c.tuning });
}

export const createCamera = (opts) => createSquirrelCamera(opts);
export { climbable };
