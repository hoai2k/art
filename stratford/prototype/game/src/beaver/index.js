// The beaver (Castor canadensis): a heavy waddling walk and a slow gallop on land, an excellent
// swimmer (fast at the surface; A dives, A again or running out of breath surfaces; the tail and
// webbed hind feet drive it), a little hop with A on land, no climbing; Y gnaws (an animation for
// now). Model: tools/squirrel/build.py --creature beaver. See ../../squirrel.md.
import { creatureTuning, makeCreature, makeCamera } from '../creatures/creature.js';
import { createQuadAnimator } from '../creatures/animators.js';

export const KIND = 'beaver';
export const SCALE = 0.8;

export const beaverTuning = (scale = SCALE) => creatureTuning(scale, {
  radius: 0.15 * scale, capsuleBack: 0.25 * scale, capsuleFront: 0.28 * scale,
  runSpeed: 1.3, sprintSpeed: 3.2, accel: 6, decel: 9, brake: 12,
  turnR0: 0.25 * scale, turnK: 0.06, turnMax: 4.5,
  stepUp: 0.22 * scale, jumpHeight: 0.25 * scale, gravity: 16, airAccel: 2,
  swimSpeed: 1.7, swimDepth: 0.3 * scale,
  canDive: true, diveSpeed: 2.0, diveDepth: 1.4, breath: 60,
  digTime: 2.4,
  camDistance: 2.7 * scale, camHeight: 0.45 * scale, camProbe: 0.12 * scale,
});

export const createCreature = (opts = {}) => makeCreature({
  kind: KIND, tuning: beaverTuning(), eyeHeight: 0.24, canFly: false, coat: opts.coat, model: opts.model !== false,
  animator: (m, T) => createQuadAnimator(m, T, { style: 'waddle' }), shells: 3, strands: 1100,
});
export const createCamera = (opts) => makeCamera(opts);
