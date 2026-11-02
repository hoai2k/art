// Generic follow camera for a small creature (any scale: every length comes from the creature's
// tuning, T.cam*, written in multiples of its `scale`).
//
// Feel: the look-at point follows the creature on critically damped springs (smooth, no
// overshoot, exact for any frame time, so 30 and 144 fps give the same path); in the air it only
// follows part of the jump height, so leaps don't bob the view. Yaw is the player's: the right
// stick turns it directly, and the gentle auto-follow behind the heading only fades in a second
// after the stick is let go, never while it's held, and never swings round when running toward
// the camera. Pitch is the player's too: the stick sets it and it is kept while following; only
// climbing (look up the wall) and terrain (stay above the ground) bend it, temporarily, and it
// returns to the player's pitch afterwards. Recenter (R3 / C) turns the camera behind the
// creature and keeps the player's pitch.
//
// Zoom: `controls.zoom` (per frame, in zoom units: +1 = the whole range further) moves the
// zoom level 0 (close, the standard follow) .. 1 (far: T.camZoomFar times further), smoothed;
// `zoom` get/set for the saved setting.
//
// Never inside geometry, never popping: a camera-sized sphere (T.camProbe, larger than the near
// plane's half-diagonal) is swept out from the look-at point; when something comes between, the
// camera pulls in quickly (springs, a few frames) but never past what's free, and eases back out
// slowly. Thin things a camera shouldn't snag on (props: lamp posts, benches, parked cars; branches,
// fences) are ignored. It applies `look` as given (pitch -= look[1]: positive tilts the view up);
// invert-Y belongs to the input layer.
import * as THREE from 'three';
import { pathClear, raycastSolid, sphereHits, sweepSphere } from './collide.js';
import { SURFACE } from '../surface.js';

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const IGNORE = new Set([SURFACE.prop, SURFACE.branch, SURFACE.fence]);
const FF = { x: 0.85, y: 0.85, z: 0.85 };         // look-at velocity feed-forward (see springV; leaps are damped separately)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// exact critically damped spring step toward a fixed target: returns [x, v]
function spring(x, v, target, w, dt) {
  if (w <= 0) return [x, v * Math.exp(-4 * dt)];
  const d = x - target, e = Math.exp(-w * dt), t = (v + w * d) * dt;
  return [target + (d + t) * e, (v - w * t) * e];
}
// the same on Vector3s, in place, for a target moving linearly from `from` to `to` during the
// frame (exact, so the lag behind a running creature is the same at any frame rate). `ff` (per
// axis, 0..1) feeds that much of the target's velocity forward: the steady lag behind a target
// moving at u is 2 (1 - ff) u / w instead of 2 u / w (1.4 m at a sprint without it).
function springV(x, v, from, to, w, dt, ff) {
  const e = Math.exp(-w * dt);
  for (const k of ['x', 'y', 'z']) {
    const u = (to[k] - from[k]) / dt;             // target velocity
    const off = -2 * (1 - ff[k]) * u / w;         // steady lag behind a moving target
    const y = x[k] - from[k] - off, vy = v[k] - u;
    const t = (vy + w * y) * dt;
    const y1 = (y + t) * e, vy1 = (vy - w * t) * e;
    x[k] = to[k] + y1 + off; v[k] = vy1 + u;
  }
}

export function createFollowCamera({ camera, creature, world, tuning: T, zoom: zoom0 = 0 }) {
  const probe = T.camProbe || T.camNear * 3;
  const zoomFar = T.camZoomFar || 5;
  let yaw = 0, yawV = 0;
  let pitchUser = T.camPitch;                     // what the player chose
  let pitchEff = T.camPitch, pitchV = 0;          // what's shown (player's + temporary bends)
  let zoomT = Math.min(1, Math.max(0, zoom0)), zoomS = zoomT, zoomV = 0;
  let dist = T.camDistance, distV = 0;            // wanted distance (zoom, speed)
  let free = T.camDistance, freeV = 0;            // what's shown (collision-limited)
  let fov = T.camFov, fovV = 0;
  const camPos = new THREE.Vector3();
  let cuts = 0, blind = 0;
  let flyW = 0, flyWV = 0, roll = 0, rollV = 0;   // flight camera weight, bank
  let bend = 0, bendV = 0;                        // temporary pitch bend to see over an obstacle
  let sinceLook = 10, recenter = 0, climbW = 0, climbWV = 0, airY = null;
  const focus = new THREE.Vector3(), focusV = new THREE.Vector3(), prevTarget = new THREE.Vector3();
  const target = new THREE.Vector3(), body = new THREE.Vector3(), tmp = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3();
  let first = true;
  const headingYaw = (f) => Math.atan2(-f.x, -f.z);
  const euler = new THREE.Euler();
  const debug = { focus, yaw: 0, pitch: 0, dist: 0, free: 0, zoom: 0 };

  camera.near = T.camNear; camera.fov = T.camFov; camera.updateProjectionMatrix();

  // a camera move is clean if it crosses no surface and doesn't end touching one (starting in
  // contact is fine: it can always move away)
  const moveOk = (a, b) => (a.distanceToSquared(b) < 1e-12 || pathClear(world, a, b, 0)) && !sphereHits(world, b, probe * 0.5, IGNORE);

  function update(dt, controls = {}) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    const c = creature.controller;
    const look = controls.look || [0, 0];
    const looking = Math.abs(look[0]) + Math.abs(look[1]) > 1e-6;
    sinceLook = looking ? 0 : sinceLook + dt;

    // ---- player input: yaw and pitch directly; zoom level
    yaw = wrap(yaw - look[0]);
    const pu = THREE.MathUtils.clamp(pitchUser - look[1], T.camPitchMin ?? -0.3, T.camPitchMax ?? 1.25);
    pitchEff += pu - pitchUser;                     // the stick moves the view at once (no lag)
    pitchUser = pu;
    if (looking) yawV = 0;
    if (controls.zoom) zoomT = Math.min(1, Math.max(0, zoomT + controls.zoom));
    if (controls.recenter) recenter = 0.7;

    // ---- the look-at point: above the creature (out from the wall when climbing)
    const climbing = c.state === 'climb';
    const upv = climbing ? c.up : UP;
    body.copy(c.pos).addScaledVector(upv, T.radius * 0.9);
    target.copy(c.pos).addScaledVector(upv, T.camHeight);
    // in the air, follow only part of the rise and fall (no bobbing on every leap)
    if (c.state === 'air') { if (airY === null) airY = c.pos.y; target.y = airY + T.camHeight + (c.pos.y - airY) * 0.35 + Math.min(0, c.pos.y - airY) * 0.65; }
    else airY = null;
    // it must be in the open, seen straight from the body (not up inside a ledge)
    tmp.subVectors(target, body);
    { const l = tmp.length(); const h = l > 1e-6 && raycastSolid(world, body, tmp.divideScalar(l), l + probe, IGNORE); if (h) target.copy(body).addScaledVector(tmp, Math.max(0, h.distance - probe)); }
    if (first) { focus.copy(target); focusV.set(0, 0, 0); prevTarget.copy(target); }
    // (a jump of the target, e.g. letting go of a wall, isn't a velocity: follow it as a step)
    if (prevTarget.distanceTo(target) > (T.sprintSpeed || 8) * 2 * (c.boostMul || 1) * dt) prevTarget.copy(target);
    // (superspeed: feed forward more, so the lag stays the same ~0.2 m at any speed)
    const bm = c.boostMul || 1, ffk = 1 - (1 - FF.x) / bm;
    springV(focus, focusV, prevTarget, target, T.camFollow ?? 11, dt, bm > 1 ? { x: ffk, y: 1 - (1 - FF.y) / bm, z: ffk } : FF);
    prevTarget.copy(target);
    // the lagging point must stay in open air (it may go round a roof edge as the creature does);
    // if it ever ends up touching something, ease it onto the target
    if (sphereHits(world, focus, probe * 0.3, IGNORE)) { focus.lerp(target, 1 - Math.exp(-dt * 20)); }

    // ---- yaw: recenter, climbing (face the wall), or gentle auto-follow when the stick is free
    const speed = Math.hypot(c.vel.x, c.vel.z);
    let yawTarget = null, yawW = 0;
    if (recenter > 0) {
      recenter -= dt; yawTarget = headingYaw(c.fwd); yawW = 12;
    } else if (!looking) {
      const ease = smoothstep(0.6, 1.8, sinceLook);       // fades in after the stick is let go
      if (climbing) {
        const n = c.up;
        if (Math.hypot(n.x, n.z) > 0.3) { yawTarget = Math.atan2(n.x, n.z); yawW = 2.2 * ease; }
      } else if (speed > Math.min(0.6 * (T.scale / 0.25), 0.5 * T.runSpeed) && c.state !== 'sit') {
        const h = headingYaw(c.fwd);
        // running toward the camera: don't swing round (the classic follow-cam rule)
        if (Math.abs(wrap(h - yaw)) < 2.3) { yawTarget = h; yawW = Math.min(2.4, 0.5 + 0.3 * speed / (T.scale / 0.25)) * ease; }
      }
    }
    if (yawTarget !== null && yawW > 0) {
      const goal = yaw + wrap(yawTarget - yaw);
      [yaw, yawV] = spring(yaw, yawV, goal, yawW, dt);
      yaw = wrap(yaw);
    } else if (!looking) { [yaw, yawV] = spring(yaw, yawV, yaw, 0, dt); yaw = wrap(yaw + yawV * dt); }

    // ---- pitch: the player's, bent temporarily for climbing and terrain
    [climbW, climbWV] = spring(climbW, climbWV, climbing ? 1 : 0, 4, dt);
    // flight: further back, a little higher, banking with the turns (all on springs)
    [flyW, flyWV] = spring(flyW, flyWV, c.state === 'fly' ? 1 : 0, 3, dt);
    [roll, rollV] = spring(roll, rollV, flyW * THREE.MathUtils.clamp(c.turnRate * 0.22, -0.3, 0.3), 4, dt);
    let pitchGoal = pitchUser + 0.12 * flyW;   // (climbing keeps it too: from above, a top-out stays in view)

    // ---- distance: zoom, a little pull-back with speed, a bit more on walls
    [zoomS, zoomV] = spring(zoomS, zoomV, zoomT, 9, dt);
    const sp = THREE.MathUtils.clamp(speed / ((c.state === 'fly' ? T.flySprint : T.sprintSpeed) || 7) / (c.boostMul || 1), 0, 1);
    const wantDist = T.camDistance * Math.pow(zoomFar, zoomS) * (1 + T.camPullBack * sp) * (1 + 0.25 * climbW) * (1 + ((T.camFlyMul || 1.8) - 1) * flyW);
    [dist, distV] = spring(dist, distV, wantDist, 5, dt);
    [fov, fovV] = spring(fov, fovV, THREE.MathUtils.lerp(T.camFov, T.camFovSprint, sp * sp), 3, dt);
    camera.fov = fov;

    // terrain: keep the camera clear of the ground under it, curbs and paving included (a ray down
    // through the colliders from the look-at height; the bare terrain where nothing's built yet):
    // bend the pitch up smoothly before the ground would block the view
    for (const reach of [Math.max(free, probe * 2), dist]) {      // where it is and where it's going
      const cp = Math.cos(pitchGoal);
      const gx = focus.x + Math.sin(yaw) * cp * reach, gz = focus.z + Math.cos(yaw) * cp * reach;
      let gy = world.groundAt ? world.groundAt(gx, gz) : -Infinity;
      tmp.set(gx, focus.y + T.camHeight, gz);
      const h = raycastSolid(world, tmp, DOWN, T.camHeight + reach * 2 + 1, IGNORE);
      if (h) gy = Math.max(Number.isFinite(gy) ? gy : -Infinity, h.point.y);
      if (Number.isFinite(gy)) {
        const need = Math.asin(THREE.MathUtils.clamp((gy + probe * 2 - focus.y) / Math.max(reach, 1e-3), -1, 1));
        if (need > pitchGoal) pitchGoal = Math.min(need, T.camPitchMax ?? 1.25);
      }
    }
    [pitchEff, pitchV] = spring(pitchEff, pitchV, pitchGoal, pitchGoal > pitchEff ? 14 : 6, dt);
    if (first) { pitchEff = pitchGoal; pitchV = 0; }

    // ---- collision: sweep the camera sphere out from the look-at point. When it's blocked
    // close in (a wall at its back, a roof edge after topping out), look over the top first: the
    // lowest extra pitch that gives a clear view at most of the distance, held on a spring.
    const sweepAt = (p) => {
      dir.set(-Math.sin(yaw) * Math.cos(p), -Math.sin(p), -Math.cos(yaw) * Math.cos(p));
      want.copy(focus).addScaledVector(dir, -dist);
      return sweepSphere(world, focus, want, probe, IGNORE, probe * 0.3, T.camHeight * 1.7) * dist;
    };
    const pMax = T.camPitchMax ?? 1.25;
    let allowed = sweepAt(pitchEff + bend);
    let bendGoal = 0;
    if (sweepAt(pitchEff) < dist * 0.85) {
      bendGoal = bend;
      for (const b of [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1.0]) {
        if (pitchEff + b > pMax) break;
        if (sweepAt(pitchEff + b) >= dist * 0.85) { bendGoal = b; break; }
      }
    }
    [bend, bendV] = spring(bend, bendV, bendGoal, bendGoal > bend ? 16 : 2, dt);
    const pitchShown = Math.min(pMax, pitchEff + bend);
    allowed = sweepAt(pitchShown);                  // how far back it can see the creature from
    // occlusion: pull in on a fast spring (a few frames, no snap), ease back out slowly
    if (first) { free = allowed; freeV = 0; }
    else [free, freeV] = spring(free, freeV, allowed, allowed < free ? 16 : 3.5, dt);
    free = Math.max(0, Math.min(free, dist));
    want.copy(focus).addScaledVector(dir, -free);
    // penetration: the camera itself moves from where it was to there without passing through
    // anything; if it gets stuck somewhere it can't see the creature from, cut to a clear spot
    // an end point grazing something (a curb, a sill) lifts clear of it rather than stopping
    for (let k = 0; k < 4 && sphereHits(world, want, probe * 0.5, IGNORE); k++) want.y += probe * 0.5;
    if (first) camPos.copy(focus).addScaledVector(dir, -allowed);
    else if (!moveOk(camPos, want) && !(pathClear(world, focus, want, 0) && !sphereHits(world, want, probe * 0.5, IGNORE))) {
      // (a move may pass through a thin surface between two frames, e.g. over a roof edge after a
      // fall, if where it ends is free and sees the creature: nothing is rendered from inside)
      // go as far toward it as is clean (binary search on the segment)
      let lo = 0, hi = 1;
      for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; tmp.lerpVectors(camPos, want, m); if (moveOk(camPos, tmp)) lo = m; else hi = m; }
      tmp.lerpVectors(camPos, want, lo);
      camPos.copy(tmp);
    } else camPos.copy(want);
    // briefly hidden behind something (topping out, a corner) is fine while the springs bring it
    // round; hidden for longer, cut to a clear spot
    blind = pathClear(world, focus, camPos, 0) ? 0 : blind + dt;
    if (blind > 0.35) { camPos.copy(focus).addScaledVector(dir, -allowed); free = allowed; freeV = 0; blind = 0; cuts++; }
    camera.position.copy(camPos);
    // orientation straight from yaw / pitch (stable even when collision brings it right in)
    camera.quaternion.setFromEuler(euler.set(-pitchShown, yaw, roll, 'YXZ'));
    camera.up.copy(UP);
    // pulled right in (a wall at its back): don't look out through the creature's own fur
    if (creature.object) creature.object.visible = camPos.distanceTo(focus) > T.radius * 3.5;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    first = false;
    debug.yaw = yaw; debug.pitch = pitchShown; debug.bend = bend; debug.pitchUser = pitchUser; debug.dist = dist; debug.free = free; debug.cuts = cuts; debug.zoom = zoomS;
  }

  // behind the creature, everything settled (respawn, teleport); keeps the player's pitch and zoom
  function snapBehind() {
    yaw = headingYaw(creature.controller.fwd); yawV = 0; first = true;
    zoomS = zoomT; zoomV = 0; dist = T.camDistance * Math.pow(zoomFar, zoomS); distV = 0; free = dist; freeV = 0;
    fov = T.camFov; fovV = 0; bend = 0; bendV = 0; pitchEff = pitchUser; pitchV = 0; climbW = 0; climbWV = 0; blind = 0; sinceLook = 10; recenter = 0;
  }
  snapBehind();
  return {
    update, snapBehind, debug,
    get yaw() { return yaw; }, get pitch() { return pitchUser; },
    set pitch(p) { pitchUser = p; },
    get zoom() { return zoomT; },
    set zoom(z) { if (Number.isFinite(z)) zoomT = Math.min(1, Math.max(0, z)); },
  };
}
