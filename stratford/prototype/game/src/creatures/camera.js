// Generic low follow camera for a small creature: right-stick orbit, auto-follow behind the
// heading when moving, recenter, world collision (never inside walls), speed pull-back and FOV,
// steady while climbing (world-up, swings out from the wall). Distances come from the creature's
// tuning (T.camDistance, T.camHeight, T.camNear, ...), so it works at any scale.
//
// Never inside geometry: the look-at point is kept where the creature can see it from (a straight
// clear line from the body, so the lagging, smoothed point can't cut through a roof corner or
// wall), and the camera is a sphere (T.camProbe, bigger than the near plane's half-diagonal)
// swept from the look-at point out to where it wants to be, stopping at the first touch. It
// pulls in at once when blocked and eases back out. It applies `look` as given (pitch -= look[1]);
// any invert-Y setting belongs to the input layer.
import * as THREE from 'three';
import { pathClear, raycast, sweepSphere, sphereHits } from './collide.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createFollowCamera({ camera, creature, world, tuning: T }) {
  let yaw = 0, pitch = T.camPitch;                // yaw: direction the camera looks (0 = north, -z)
  let idleLook = 1;                               // s since the player last orbited
  let dist = T.camDistance, free = T.camDistance;   // wanted distance, collision-limited distance
  const probe = T.camProbe || T.camNear * 3;
  const body = new THREE.Vector3(), back = new THREE.Vector3();
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
    const upv = climbing ? c.up : UP;
    body.copy(c.pos).addScaledVector(upv, T.radius * 0.9);           // the body's centre: always in the open
    target.copy(c.pos).addScaledVector(upv, T.camHeight);
    // the look-at point itself must be reachable from the body (not inside a ledge overhead)
    tmp.subVectors(target, body); { const l = tmp.length(); const h = l > 1e-6 && raycast(world, body, tmp.divideScalar(l), l + probe); if (h) target.copy(body).addScaledVector(tmp, Math.max(0, h.distance - probe)); }
    if (first) smoothed.copy(target);
    // track tightly (never floaty): fast exponential follow, faster vertically when landing
    const k = 1 - Math.exp(-dt * 14);
    smoothed.x += (target.x - smoothed.x) * k; smoothed.z += (target.z - smoothed.z) * k;
    smoothed.y += (target.y - smoothed.y) * (1 - Math.exp(-dt * (c.state === 'air' ? 6 : 12)));
    if (smoothed.distanceTo(target) > T.camDistance * 2) smoothed.copy(target);
    // the lagging point must still be in the open, seen straight from the body
    if (!pathClear(world, body, smoothed, 0) || sphereHits(world, smoothed, probe * 0.5)) smoothed.copy(target);

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
    // collision: sweep the camera sphere out from the look-at point; pull in at once, ease out
    const L = dist;
    const t = sweepSphere(world, smoothed, desired, probe);
    const allowed = t * L;
    free = allowed < free ? allowed : free + (allowed - free) * (1 - Math.exp(-dt * 4));
    back.copy(smoothed).addScaledVector(dir, -Math.min(free, allowed));
    // keep above the bare terrain too (where the town has no collider yet), if that's clear
    const gy = world.groundAt ? world.groundAt(back.x, back.z) : -Infinity;
    if (Number.isFinite(gy) && back.y < gy + probe) { tmp.copy(back); tmp.y = gy + probe; if (!sphereHits(world, tmp, probe) && pathClear(world, back, tmp, 0)) back.copy(tmp); }
    camera.position.copy(back);
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
