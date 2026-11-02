// The mute swan (Cygnus olor): an awkward rolling walk on land; a graceful swim (the default on
// water); flight: hold A to run across the water (or along the ground) and take off, the stick
// steers, A flaps and climbs, RT flies faster, let go to glide; lands on water (skiing in on its
// feet) or on the ground. Model: tools/squirrel/build.py --creature swan (measured on the
// delivered turnaround, reference/sheets/swan_turnaround.png).
import { creatureTuning, makeCreature, makeCamera } from '../creatures/creature.js';
import { createBirdAnimator } from '../creatures/animators.js';

export const KIND = 'swan';
export const SCALE = 1.4;

export const swanTuning = (scale = SCALE) => creatureTuning(scale, {
  radius: 0.13 * scale, capsuleBack: 0.22 * scale, capsuleFront: 0.22 * scale,
  runSpeed: 0.9, sprintSpeed: 2.6, accel: 4, decel: 6, brake: 8,
  turnR0: 0.2 * scale, turnK: 0.05, turnMax: 3.2,
  stepUp: 0.14 * scale, jumpHeight: 0.15 * scale, gravity: 16,
  swimSpeed: 1.3, swimDepth: 0.36, maxFall: 18,
  canFly: true, flySpeed: 15, flySprint: 21, flyMin: 9, flyAccel: 5, flyClimb: 2.6, glideSink: 1.8, flyTurn: 1.0,
  takeoffSpeed: 6.5,
  camDistance: 2.6 * scale, camHeight: 0.55 * scale, camProbe: 0.1 * scale, camFlyMul: 1.9, camPitch: 0.3,
});

export const createCreature = (opts = {}) => makeCreature({
  kind: KIND, tuning: swanTuning(), eyeHeight: 1.0, canFly: true, coat: opts.coat, model: opts.model !== false,
  animator: (m, T) => createBirdAnimator(m, T, { waddle: true, flapRate: 2.2, action: 'preen' }), shells: 3, strands: 400,
});
export const createCamera = (opts) => makeCamera(opts);
