// Generic low follow camera for a small creature: right-stick orbit, auto-follow behind the
// heading when moving, recenter, world collision (never inside walls), speed pull-back and FOV,
// steady while climbing (world-up, swings out from the wall). Distances come from the creature's
// tuning (T.camDistance, T.camHeight, T.camNear, ...), so it works at any scale.
import * as THREE from 'three';
import { raycast } from './collide.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createFollowCamera({ camera, creature, world, tuning: T }) {
  let yaw = 0, pitch = T.camPitch;                // yaw: direction the camera looks (0 = north, -z)
  let idleLook = 1;                               // s since the player last orbited
  let dist = T.camDistance;
  const target = new THREE.Vector3(), smoothed = new THREE.Vector3(), desired = new THREE.Vector3();
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
  let first = true, recentering = 0;
  const headingYaw = (f) => Math.atan2(-f.x, -f.z);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  camera.near = T.camNear; camera.fov = T.camFov; camera.updateProjectionMatrix();

  function update(dt, controls = {}) {
    dt = Math.min(dt, 0.1);
    const c = creature.controller;
    const look = controls.look || [0, 0];
    if (Math.abs(look[0]) + Math.abs(look[1]) > 1e-4) { idleLook = 0; recentering = 0; }
    else idleLook += dt;
    yaw -= look[0]; pitch = THREE.MathUtils.clamp(pitch - look[1], -0.35, 1.2);
    if (controls.recenter) recentering = 0.4;

    // look-at point: above the feet along the body's up (out from a wall when climbing)
    const climbing = c.state === 'climb';
    target.copy(c.pos).addScaledVector(climbing ? c.up : UP, T.camHeight);
    if (first) smoothed.copy(target);
    // track tightly (never floaty): fast exponential follow, faster vertically when landing
    const k = 1 - Math.exp(-dt * 14);
    smoothed.x += (target.x - smoothed.x) * k; smoothed.z += (target.z - smoothed.z) * k;
    smoothed.y += (target.y - smoothed.y) * (1 - Math.exp(-dt * (c.state === 'air' ? 6 : 12)));
    if (smoothed.distanceTo(target) > T.camDistance * 2) smoothed.copy(target);

    // auto-follow: swing behind the heading when moving and not orbiting
    const speed = c.vel.length();
    let want = null, rate = 0;
    if (climbing) {
      // face the wall from outside it
      const n = c.up;
      want = Math.hypot(n.x, n.z) > 0.3 ? Math.atan2(n.x, n.z) : null;   // the camera looks along -n
      rate = 3;
    } else if (speed > 0.5 && idleLook > 0.8) {
      want = headingYaw(c.fwd); rate = Math.min(2.5, speed * 0.5);
    }
    if (recentering > 0) { want = headingYaw(c.fwd); rate = 10; recentering -= dt; }
    if ((want !== null && idleLook > 0.8) || recentering > 0) {
      if (want !== null) yaw += wrap(want - yaw) * (1 - Math.exp(-dt * rate));
      const pw = climbing ? 0.35 : T.camPitch;
      pitch += (pw - pitch) * (1 - Math.exp(-dt * (recentering > 0 ? 8 : 1.2)));
    }
    yaw = wrap(yaw);

    // distance: pull back with speed
    const sp = THREE.MathUtils.clamp(speed / (T.sprintSpeed || 7), 0, 1);
    const wantDist = T.camDistance * (1 + T.camPullBack * sp) * (climbing ? 1.25 : 1);
    dist += (wantDist - dist) * (1 - Math.exp(-dt * 3));
    camera.fov += (THREE.MathUtils.lerp(T.camFov, T.camFovSprint, sp * sp) - camera.fov) * (1 - Math.exp(-dt * 3));

    // camera direction: looks along (yaw, -pitch)
    dir.set(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    desired.copy(smoothed).addScaledVector(dir, -dist);
    // collision: pull in along the ray from the target
    tmp.copy(desired).sub(smoothed); const L = tmp.length(); tmp.divideScalar(L || 1);
    const hit = raycast(world, smoothed, tmp, L + T.camNear * 2);
    let d = L;
    if (hit) d = Math.max(T.camNear * 2, hit.distance - T.camNear * 2.5);
    desired.copy(smoothed).addScaledVector(tmp, d);
    // keep above the ground
    const gy = world.groundAt ? world.groundAt(desired.x, desired.z) : -Infinity;
    if (Number.isFinite(gy) && desired.y < gy + T.camNear * 3) desired.y = gy + T.camNear * 3;
    camera.position.copy(desired);
    camera.up.copy(UP);
    camera.lookAt(smoothed);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    first = false;
  }

  function snapBehind() { yaw = headingYaw(creature.controller.fwd); pitch = T.camPitch; first = true; }
  snapBehind();
  return { update, snapBehind, get yaw() { return yaw; }, get pitch() { return pitch; } };
}
