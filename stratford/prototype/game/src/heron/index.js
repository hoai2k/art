// The great blue heron (Ardea herodias): a slow, stately walk, wading on the bed of shallow water
// (it doesn't swim: deeper water stops it), flight with the neck folded back and the legs
// trailing: A takes off on the spot with a few big wingbeats, the stick steers, A flaps and
// climbs, RT is faster, let go to glide; it lands on the ground, in shallow water, and perches on
// roofs and branches by landing on them. Model: tools/squirrel/build.py --creature heron.
import { creatureTuning, makeCreature, makeCamera } from '../creatures/creature.js';
import { createBirdAnimator } from '../creatures/animators.js';

export const KIND = 'heron';
export const SCALE = 1.0;

export const heronTuning = (scale = SCALE) => creatureTuning(scale, {
  radius: 0.1 * scale, capsuleBack: 0.15 * scale, capsuleFront: 0.15 * scale,
  runSpeed: 0.7, sprintSpeed: 1.7, accel: 3, decel: 5, brake: 6,
  turnR0: 0.15 * scale, turnK: 0.05, turnMax: 3,
  stepUp: 0.3 * scale, jumpHeight: 0.2 * scale, gravity: 16,
  canSwim: false, wadeDepth: 0.42,
  canFly: true, flySpeed: 9, flySprint: 13, flyMin: 5, flyAccel: 4, flyClimb: 2.2, glideSink: 1.5, flyTurn: 1.3,
  takeoffSpeed: 0,
  camDistance: 2.8 * scale, camHeight: 0.8 * scale, camProbe: 0.1 * scale, camFlyMul: 1.8, camPitch: 0.28,
});

export const createCreature = (opts = {}) => makeCreature({
  kind: KIND, tuning: heronTuning(), eyeHeight: 1.05, canFly: true, coat: opts.coat, model: opts.model !== false,
  animator: (m, T) => createBirdAnimator(m, T, { foldNeck: true, trailLegs: true, headBob: true, flapRate: 1.8 }), shells: 3, strands: 500,
});
export const createCamera = (opts) => makeCamera(opts);
