// The squirrel's numbers for the generic creature controller and camera (src/creatures/).
// Lengths are written as multiples of `scale` (body length, 0.25 m) where they follow size, so a
// different creature copies this table and changes `scale` and the few true constants (gravity,
// speeds a real animal has). Real eastern grey squirrel: body 25 cm, tail 22 cm, 0.5 kg, top speed
// ~7 m/s, leaps ~1 m up and 2.5-3 m across.
export function squirrelTuning(scale = 0.25) {
  const s = scale / 0.25;   // 1 for the squirrel
  return {
    scale,
    radius: 0.16 * scale,            // body capsule radius (4 cm)
    capsuleBack: 0.26 * scale,       // capsule segment behind / ahead of the middle
    capsuleFront: 0.3 * scale,
    // ground
    runSpeed: 4.6 * s,               // full stick
    sprintSpeed: 7.6 * s,            // full stick + RT
    accel: 26 * s,                   // m/s^2 (0 -> run in ~0.18 s)
    decel: 30 * s,
    brake: 40 * s,
    turnR0: 0.4 * scale,             // turning radius = r0 + k v^2 (m)
    turnK: 0.11 / s,
    turnMax: 13,                     // rad/s pivot when slow
    walkableY: 0.62,                 // surface normal y above which it's floor
    snap: 0.24 * scale,              // ground snap distance
    stepUp: 1.45 * scale,            // hops up to 36 cm without jumping (curbs, steps)
    stepLook: 0.07,                  // s of travel to look ahead for steps
    coyote: 0.1,
    jumpBuffer: 0.13,
    // air
    gravity: 20,                     // m/s^2 (snappier than 9.8; ~0.63 s for a full leap)
    fallGravityMul: 1.15,
    jumpHeight: 4.0 * scale,         // 1 m with A held
    jumpCut: 0.45,                   // vertical speed kept when A is released early
    airAccel: 9 * s,
    maxFall: 14,
    wallKick: 2.6 * s,
    // climbing
    climbSpeed: 2.4 * s,
    climbSprint: 3.6 * s,
    climbAccel: 16 * s,
    climbTurn: 14,
    ledgeReach: 0.3 * scale,
    eaveReach: 2.4 * scale,          // how far out round an overhanging eave it reaches (60 cm)
    pocketRoof: 1.6 * scale,         // a roof this close overhead ...
    pocketFloor: 6 * scale,          // ... with no floor this close below is a slot, not open air
    // water
    swimSpeed: 0.9 * s,
    swimDepth: 0.2 * scale,          // body sits this deep under the surface
    // actions
    digTime: 1.8,
    // simulation
    maxStep: 1 / 120,
    // camera
    camDistance: 3.0 * scale,        // 0.75 m behind
    camHeight: 0.5 * scale,          // look-at point above the feet
    camPitch: 0.2,                   // rad, default elevation
    camNear: 0.08 * scale,
    camFov: 55, camFovSprint: 63,
    camPullBack: 0.35,               // extra distance at top speed (fraction)
    camProbe: 0.22 * scale,          // camera collision sphere (5.5 cm; well over the near plane's half-diagonal)
  };
}
