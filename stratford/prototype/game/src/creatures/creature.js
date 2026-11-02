// A creature on the generic controller and camera: the contract object of ARCHITECTURE.md
// ("The squirrel contract" + "Many creatures, many scales") for any creature built by
// tools/squirrel/build.py, given its tuning, animator and abilities. The squirrel has its own
// module (src/squirrel/index.js); the beaver, rabbit, swan and heron use this.
import * as THREE from 'three';
import { createController } from './controller.js';
import { createFollowCamera } from './camera.js';
import { loadCreatureModel, buildCreatureModel } from './model.js';

const cache = new Map();

// Lengths written as multiples of `scale` (body length, m) where they follow size; speeds and
// abilities are given per creature (a swan isn't a big squirrel).
export function creatureTuning(scale, o = {}) {
  const T = {
    scale,
    radius: 0.16 * scale, capsuleBack: 0.26 * scale, capsuleFront: 0.3 * scale,
    runSpeed: 2, sprintSpeed: 4, accel: 10, decel: 14, brake: 20,
    turnR0: 0.4 * scale, turnK: 0.05, turnMax: 6,
    walkableY: 0.62, snap: 0.24 * scale, stepUp: 0.6 * scale, stepLook: 0.07,
    coyote: 0.1, jumpBuffer: 0.13,
    gravity: 20, fallGravityMul: 1.15, jumpHeight: 1.2 * scale, jumpCut: 0.45, airAccel: 4, maxFall: 20, wallKick: 2,
    climbSpeed: 1, climbSprint: 1.5, climbAccel: 8, climbTurn: 8, ledgeReach: 0.3 * scale, eaveReach: 2.4 * scale,
    pocketRoof: 1.6 * scale, pocketFloor: 6 * scale,
    swimSpeed: 0.8, swimDepth: 0.2 * scale, digTime: 1.8, maxStep: 1 / 120, boostMax: 10,
    camDistance: 3.4 * scale, camZoomFar: 5, camHeight: 0.6 * scale, camPitch: 0.32, camPitchMin: -0.3, camPitchMax: 1.25,
    camFollow: 11, camNear: 0.08 * scale, camFov: 55, camFovSprint: 62, camPullBack: 0.3, camProbe: 0.22 * scale,
    camFlyMul: 1.8,
  };
  return Object.assign(T, o);
}

export async function makeCreature({ kind, tuning: T, climbs = new Set(), hangable = () => false, eyeHeight, canFly = false, coat,
  model = true, animator, shells = 4, strands = 700 }) {
  const ctrl = createController(T, { climbable: (id) => climbs.has(id), hangable });
  const object = new THREE.Group();
  object.name = kind;
  let mdl = null, anim = null;
  if (model) {
    if (!cache.has(kind)) cache.set(kind, loadCreatureModel(kind));
    mdl = buildCreatureModel(await cache.get(kind), { coat, shells, furStrands: strands });
    object.add(mdl.group);
    anim = animator(mdl, T);
  }
  const listeners = {};
  let currentCoat = mdl ? mdl.coats[0] : coat;
  return {
    kind, scale: T.scale, eyeHeight, climbs, canFly, tuning: T,
    object, controller: ctrl, model: mdl, animator: anim,
    position: ctrl.pos, velocity: ctrl.vel,
    get state() { return ctrl.state; },
    get coat() { return currentCoat; },
    get gait() { return ctrl.state; },
    get surface() { return ctrl.surface; },   // SURFACE id under the feet (sound picks footsteps by it)
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); }; },
    reset(spawn) { ctrl.reset(spawn); if (anim) anim.state.first = true; },
    setCoat(name) { if (mdl?.coats.includes(name)) { currentCoat = name; mdl.setCoat(name); } },
    update(dt, controls, world, camera) {
      dt = Math.min(Math.max(dt, 0), 0.1);
      if (!(dt > 0)) return;
      ctrl.update(dt, controls, world, camera);
      for (const [ev, data] of ctrl.events) for (const fn of listeners[ev] || []) fn(data);
      if (anim) anim.update(dt, ctrl, mdl.group);
    },
    dispose() { object.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); },
  };
}

export function makeCamera({ camera, creature, squirrel, world, zoom = 0 }) {
  const c = creature || squirrel;
  return createFollowCamera({ camera, creature: c, world, tuning: c.tuning, zoom });
}
