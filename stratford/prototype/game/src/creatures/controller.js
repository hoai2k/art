// Generic small-creature movement on the World contract: run, turn, jump, step up, climb, swim.
// Every number comes from a tuning table (`T`, see squirrel/tuning.js) expressed for the
// creature's scale, so another creature (an insect) reuses this with its own table.
//
// Frame: `pos` is the contact point (feet on the surface); `up` the surface normal the body
// stands on (world up on the ground, the wall's normal when climbing); `fwd` the heading (unit,
// tangent to the surface). State: 'idle' | 'move' | 'air' | 'climb' | 'sit' | 'dig' | 'swim'.
import * as THREE from 'three';
import { raycast, resolveCapsule, pathClear } from './collide.js';
import { climbable as defaultClimbable } from '../surface.js';

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const ca = new THREE.Vector3(), cb = new THREE.Vector3();

// Every move that relocates the body (attaching to a wall, turning a corner, topping out, hopping a
// step, snapping to the ground) must have a clear straight path from where the body is to where it
// goes (`reach`), so it can never pass through a surface; the town's colliders are thin shells.
export function createController(T, { climbable = defaultClimbable, hangable = () => false } = {}) {
  const c = {
    T,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, -1),
    state: 'idle', grounded: true, surface: 0,
    speed: 0,                 // signed speed along fwd on surfaces
    airTime: 0, groundTime: 0, coyote: 0, jumpBuffer: 0, jumpHeld: false, jumpCut: false, jumping: false,
    hop: 0,                   // > 0 while an automatic step-up hop is in flight
    climbRight: 1,            // sign that maps stick x to the wall's right (from the camera)
    actionTime: 0,            // time in sit / dig
    turnRate: 0,              // rad/s (for the animation's lean)
    accel: new THREE.Vector3(),
    wish: new THREE.Vector3(), wishMag: 0, sprint: 0,
    events: [],               // [name, data] emitted this step (index.js forwards them)
    lastLand: 0,
    debug: {},
  };
  c.climbable = climbable;
  // can it hold on here? climbable, not a floor, and not an underside (cornice soffits, eaves)
  // unless the surface is one it can hang under (branches, bark)
  c.canCling = (hit) => climbable(hit.surface) && hit.normal.y < T.walkableY && (hit.normal.y > -0.35 || hangable(hit.surface));

  c.reset = (spawn) => {
    c.pos.set(spawn.x, spawn.y ?? 0, spawn.z);
    c.vel.set(0, 0, 0); c.up.copy(UP);
    const yaw = spawn.yaw || 0;
    c.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));   // yaw 0 faces north (-z)
    c.state = 'idle'; c.grounded = true; c.speed = 0; c.hop = 0; c.airTime = 0;
    c._snapAfterReset = true;
  };

  // ---------------------------------------------------------------- helpers
  const ray = (world, o, d, far) => raycast(world, o, d, far);

  function wishFromStick(controls, camera, plane) {
    const mx = controls.move?.[0] || 0, my = controls.move?.[1] || 0;
    let mag = Math.min(1, Math.hypot(mx, my));
    const dead = 0.12;
    mag = mag < dead ? 0 : (mag - dead) / (1 - dead);
    c.wishMag = mag; c.sprint = controls.sprint || 0;
    if (!mag) { c.wish.set(0, 0, 0); return; }
    if (plane === 'wall') {
      // on a wall: stick up = up the surface, stick x = along it (to the camera's right)
      const n = c.up;
      const upS = v1.copy(UP).addScaledVector(n, -n.dot(UP));
      if (upS.lengthSq() < 0.02) upS.copy(c.fwd); // underside / top: keep heading as "up"
      upS.normalize();
      const right = v2.crossVectors(upS, n).normalize();
      if (camera) {
        const camR = v3.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const d = camR.dot(right);
        if (Math.abs(d) > 0.35) c.climbRight = Math.sign(d);
      }
      c.wish.copy(upS).multiplyScalar(my).addScaledVector(right, mx * c.climbRight);
    } else {
      // on the ground: camera-relative, flattened
      const f = v1.set(0, 0, -1), r = v2.set(1, 0, 0);
      if (camera) { f.applyQuaternion(camera.quaternion); r.applyQuaternion(camera.quaternion); }
      f.y = 0; r.y = 0;
      if (f.lengthSq() < 1e-4) f.copy(c.fwd);
      f.normalize(); r.normalize();
      c.wish.copy(f).multiplyScalar(my).addScaledVector(r, mx);
      // onto the surface plane
      c.wish.addScaledVector(c.up, -c.wish.dot(c.up));
    }
    if (c.wish.lengthSq() > 1e-8) c.wish.normalize(); else c.wishMag = 0;
  }

  const targetSpeed = () => c.wishMag * (T.runSpeed + c.sprint * (T.sprintSpeed - T.runSpeed));

  function emit(name, data) { c.events.push([name, data]); }

  function isWalkable(n) { return n.y >= T.walkableY; }

  // body centre for a contact point and its surface normal
  const centreOf = (p, n, out = new THREE.Vector3()) => out.copy(p).addScaledVector(n, T.radius * 0.9);
  // can the body get from its centre to (point, normal) [via points] in straight lines?
  function reach(world, point, normal, via = []) {
    let a = centreOf(c.pos, c.up);
    for (const v of via) { if (!pathClear(world, a, v)) return false; a = v; }
    return pathClear(world, a, centreOf(point, normal));
  }

  // ---------------------------------------------------------------- ground
  function stepGround(dt, controls, world, camera) {
    wishFromStick(controls, camera, 'ground');
    const vmax = targetSpeed();
    // turning: rate limited, radius grows with speed (r = r0 + k v^2)
    let turn = 0;
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).dot(c.up);
      const dot = THREE.MathUtils.clamp(c.fwd.dot(c.wish), -1, 1);
      const ang = Math.atan2(cross, dot);
      const sp = Math.abs(c.speed);
      // nearly reversing at speed: brake first, then pivot
      if (Math.abs(ang) > 2.2 && sp > T.runSpeed * 0.35) {
        c.speed = Math.max(0, c.speed - T.brake * dt);
      } else {
        const r = T.turnR0 + T.turnK * sp * sp;
        const wmax = Math.min(T.turnMax, sp > 1e-3 ? sp / r : T.turnMax) + (sp < T.runSpeed * 0.2 ? T.turnMax : 0);
        turn = THREE.MathUtils.clamp(ang, -wmax * dt, wmax * dt);
        c.fwd.applyAxisAngle(c.up, turn);
      }
    }
    c.turnRate = THREE.MathUtils.lerp(c.turnRate, turn / dt, 1 - Math.exp(-dt * 12));
    if (!Number.isFinite(c.turnRate)) c.turnRate = 0;
    // speed along the heading (scaled by how well heading matches the wish)
    const align = c.wishMag > 0 ? Math.max(0, c.fwd.dot(c.wish)) : 0;
    const want = vmax * (0.3 + 0.7 * align * align);
    const a = want > c.speed ? T.accel * (c.speed < T.runSpeed * 0.3 ? 1.3 : 1) : T.decel;
    c.speed += THREE.MathUtils.clamp(want - c.speed, -a * dt, a * dt);
    // keep heading tangent
    c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up)).normalize();
    c.vel.copy(c.fwd).multiplyScalar(c.speed);

    // step-up / climb probe ahead
    if (c.speed > 0.05 || c.wishMag > 0.3) {
      const look = T.radius + 0.04 * T.scale / 0.25 + Math.max(c.speed, 0.3) * T.stepLook;
      const o = v1.copy(c.pos).addScaledVector(c.up, T.radius * 0.6);
      const dir = c.wishMag > 0.3 && c.speed < 0.3 ? v4.copy(c.wish) : v4.copy(c.fwd);
      const hit = ray(world, o, dir, look);
      if (hit && !isWalkable(hit.normal)) {
        const top = findTop(world, hit, dir);
        if (top !== null && top - c.pos.y <= T.stepUp && top - c.pos.y > T.radius * 0.2 && hopClear(world, top, dir)) {
          // hop the step: a small real jump that keeps the forward speed
          const h = top - c.pos.y + T.radius * 0.6;
          c.vel.copy(c.fwd).multiplyScalar(Math.max(c.speed, T.runSpeed * 0.3));
          c.vel.y = Math.sqrt(2 * T.gravity * h);
          c.hop = 1; enterAir('hop');
          return;
        }
        if (c.canCling(hit) && dir.dot(hit.normal) < -0.5 && reach(world, hit.point, hit.normal) && (c.speed > 0.2 || c.wishMag > 0.5) && hit.distance < T.radius + 0.06 * T.scale / 0.25 + c.speed * dt * 2) {
          attachClimb(hit, dir);
          return;
        }
      }
    }

    // move
    const prevPos = v4.copy(c.pos).clone();
    c.pos.addScaledVector(c.vel, dt);
    collide(world, (n, surf) => {
      if (!isWalkable(n)) {
        const into = c.vel.dot(n);
        if (into < 0) { c.vel.addScaledVector(n, -into); c.speed = c.vel.dot(c.fwd); }
      }
    }, prevPos);
    // ground snap
    const snap = T.snap + Math.abs(c.speed) * dt * 1.5;
    const o = v1.copy(c.pos).addScaledVector(c.up, T.radius * 2);
    let g = ray(world, o, v2.copy(c.up).negate(), T.radius * 2 + snap);
    if (!g || !isWalkable(g.normal)) g = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius * 2), v2.set(0, -1, 0), T.radius * 2 + snap);
    // never snap up onto something above the body's centre (the underside of a ledge we're under)
    if (g && v1.subVectors(g.point, c.pos).dot(c.up) > T.radius * 0.75) g = null;
    if (g && isWalkable(g.normal)) {
      c.pos.copy(g.point); c.surface = g.surface;
      c.up.lerp(g.normal, 1 - Math.exp(-dt * 20)).normalize();
      c.coyote = T.coyote; c.grounded = true;
    } else {
      c.coyote -= dt;
      if (c.coyote <= 0 || !g) { c.vel.copy(c.fwd).multiplyScalar(c.speed); enterAir('fall'); return; }
    }
    // water
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    if (wl != null && c.pos.y < wl - T.swimDepth) { enterSwim(world, wl); return; }
    // jump
    if (c.jumpBuffer > 0) { doJump(world); return; }
    // actions
    if (controls.sitPressed && Math.abs(c.speed) < T.runSpeed * 0.5) { c.state = 'sit'; c.actionTime = 0; c.speed = 0; return; }
    if (controls.digPressed && Math.abs(c.speed) < T.runSpeed * 0.5) { c.state = 'dig'; c.actionTime = 0; c.speed = 0; emit('dig', { position: c.pos.clone() }); return; }
    c.state = Math.abs(c.speed) > 0.05 || c.wishMag > 0 ? 'move' : 'idle';
  }

  // the hop's path: straight up from the body to above the step, then across onto it
  function hopClear(world, top, dir) {
    const a = centreOf(c.pos, UP);
    const b = a.clone(); b.y = top + T.radius * 1.2;
    const t = a.clone().addScaledVector(dir, T.radius * 2); t.y = top + T.radius * 1.2;
    return pathClear(world, a, b) && pathClear(world, b, t);
  }

  function findTop(world, hit, dir) {
    // the height of the top of the obstacle just past the hit point (null if too high / none)
    const o = v3.copy(hit.point).addScaledVector(dir, T.radius * 0.9);
    o.y = c.pos.y + T.stepUp + T.radius * 2;
    const down = ray(world, o, v2.set(0, -1, 0), T.stepUp + T.radius * 2);
    if (!down || !isWalkable(down.normal) || down.distance < 0.01) return null;
    // room above it
    const above = ray(world, v3.copy(down.point).addScaledVector(UP, 0.005), UP, T.radius * 2.2);
    if (above) return null;
    return down.point.y;
  }

  // push the body capsule out of the world; prevPos = where the feet were before this step, so a
  // surface the capsule crossed pushes it back to the side it came from
  const _prevMid = new THREE.Vector3(), _before = new THREE.Vector3();
  function collide(world, onContact, prevPos) {
    const r = T.radius;
    const center = v3.copy(c.pos).addScaledVector(c.up, r);
    ca.copy(center).addScaledVector(c.fwd, -T.capsuleBack);
    cb.copy(center).addScaledVector(c.fwd, T.capsuleFront);
    _before.copy(ca);
    const prev = prevPos ? _prevMid.copy(prevPos).addScaledVector(c.up, r).addScaledVector(c.fwd, (T.capsuleFront - T.capsuleBack) / 2) : null;
    resolveCapsule(world, ca, cb, r * 0.98, onContact, 4, prev);
    c.pos.add(_before.subVectors(ca, _before));
  }

  // ---------------------------------------------------------------- air
  function enterAir(why) {
    c.state = 'air'; c.grounded = false; c.airTime = 0;
    if (why !== 'hop') c.hop = 0;
    if (why === 'jump') c.jumping = true;
  }

  function doJump(world, fromWall) {
    c.jumpBuffer = 0; c.coyote = 0;
    const h = T.jumpHeight;
    const vy = Math.sqrt(2 * T.gravity * h);
    if (fromWall) {
      const n = c.up;
      const kick = v1.copy(n).multiplyScalar(T.wallKick);
      v2.copy(c.wish).multiplyScalar(c.wishMag * T.runSpeed * 0.5);
      c.vel.copy(kick).add(v2); c.vel.y += vy * 0.75;
      const hz = v3.set(n.x, 0, n.z);
      if (hz.lengthSq() > 1e-4) c.fwd.copy(hz.normalize());
      c.up.copy(UP);
    } else {
      c.vel.copy(c.fwd).multiplyScalar(Math.max(0, c.speed));
      if (c.wishMag > 0) c.vel.addScaledVector(c.wish, 0.0);
      c.vel.y = Math.max(c.vel.y, 0) + vy;
    }
    c.jumpCut = false;
    c.hop = 0;
    enterAir('jump');
    emit('jump', { position: c.pos.clone() });
  }

  function stepAir(dt, controls, world, camera) {
    c.airTime += dt;
    wishFromStick(controls, camera, 'air');
    // variable height: releasing A while rising cuts the rise
    if (c.jumping && !c.jumpHeld && !c.jumpCut && c.vel.y > 0) { c.vel.y *= T.jumpCut; c.jumpCut = true; }
    // air control (horizontal)
    const hv = v1.set(c.vel.x, 0, c.vel.z);
    const want = v2.copy(c.wish).setY(0).multiplyScalar(targetSpeed());
    if (c.wishMag > 0) {
      const dv = v3.subVectors(want, hv);
      const lim = T.airAccel * dt;
      // never brake below the current speed along the wish (keeps momentum), only steer / add
      if (dv.length() > lim) dv.setLength(lim);
      c.vel.x += dv.x; c.vel.z += dv.z;
    }
    c.vel.y -= T.gravity * dt * (c.vel.y < 0 ? T.fallGravityMul : 1);
    if (c.vel.y < -T.maxFall) c.vel.y = -T.maxFall;
    // heading follows horizontal velocity
    const hs = Math.hypot(c.vel.x, c.vel.z);
    if (hs > 0.3) { v3.set(c.vel.x / hs, 0, c.vel.z / hs); c.fwd.lerp(v3, 1 - Math.exp(-dt * 8)).normalize(); }
    c.up.lerp(UP, 1 - Math.exp(-dt * 10)).normalize();
    c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up)).normalize();
    // continuous: ray along the motion (feet) so we never tunnel through thin ground
    const step = v3.copy(c.vel).multiplyScalar(dt);
    const len = step.length();
    if (len > 1e-6) {
      const o = v4.copy(c.pos).addScaledVector(UP, T.radius);
      const hit = ray(world, o, step.clone().normalize(), len + T.radius);
      if (hit && isWalkable(hit.normal) && c.vel.y <= 0) {
        c.pos.copy(hit.point); land(hit, world); return;
      }
    }
    const prevPos = c.pos.clone();
    c.pos.add(step);
    // don't fly into a pocket with a roof just overhead and no floor under it (the slot between a
    // wall top and an overhanging roof): it's open in the collider but it's a wall to a squirrel
    if (pocket(world, c.pos) && !pocket(world, prevPos)) { c.pos.x = prevPos.x; c.pos.z = prevPos.z; c.vel.x = 0; c.vel.z = 0; }
    let landed = null, wall = null;
    collide(world, (n, surf) => {
      const into = c.vel.dot(n);
      if (isWalkable(n)) { if (c.vel.y <= 0.5) landed = { normal: n, surface: surf }; }
      else {
        if (c.climbable(surf) && !c.hop) wall = { n, surf };
        if (into < 0) c.vel.addScaledVector(n, -into);
      }
    }, prevPos);
    // grab a climbable wall we fly into
    if (wall && c.airTime > 0.06) {
      const hit = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius).addScaledVector(wall.n, T.radius), v2.copy(wall.n).negate(), T.radius * 3);
      if (hit && c.canCling(hit) && reach(world, hit.point, hit.normal)) { attachClimb(hit, v2); return; }
    }
    // ground below
    if (c.vel.y <= 0) {
      const g = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius), v2.set(0, -1, 0), T.radius + 0.004);
      if (g && isWalkable(g.normal)) { c.pos.copy(g.point); land(g, world); return; }
      if (landed) {
        const g2 = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius * 2), v2.set(0, -1, 0), T.radius * 3);
        if (g2 && isWalkable(g2.normal) && g2.point.y - c.pos.y <= T.radius * 0.75) { c.pos.copy(g2.point); land(g2, world); return; }
      }
    }
    // water
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    if (wl != null && c.pos.y < wl - T.swimDepth && c.vel.y < 0) { emit('splash', { position: c.pos.clone(), speed: -c.vel.y }); enterSwim(world, wl); return; }
    // keep the jump buffer alive for coyote jumps
    if (c.jumpBuffer > 0 && c.coyote > 0 && !c.jumping) { doJump(world); }
    c.coyote -= dt;
  }

  function pocket(world, p) {
    const o = v1.copy(p).addScaledVector(UP, T.radius);
    const up = ray(world, o, UP, T.pocketRoof);
    if (!up) return false;
    return !ray(world, o, DOWN, T.pocketFloor);
  }

  function land(hit, world) {
    const impact = -c.vel.y;
    c.state = 'move'; c.grounded = true; c.jumping = false; c.hop = 0;
    c.up.copy(hit.normal);
    c.surface = hit.surface;
    const hs = v1.set(c.vel.x, 0, c.vel.z);
    c.speed = Math.max(0, hs.dot(c.fwd));
    c.vel.y = 0;
    c.coyote = T.coyote; c.groundTime = 0;
    if (c.airTime > 0.12 || impact > 2) emit('land', { position: c.pos.clone(), impact });
    c.lastLand = impact;
  }

  // ---------------------------------------------------------------- climbing
  function attachClimb(hit, dir) {
    c.state = 'climb'; c.grounded = false; c.jumping = false; c.hop = 0;
    c.pos.copy(hit.point); c.up.copy(hit.normal); c.surface = hit.surface;
    // heading: up the wall
    const upS = v1.copy(UP).addScaledVector(hit.normal, -hit.normal.dot(UP));
    if (upS.lengthSq() < 0.02) upS.copy(dir).addScaledVector(hit.normal, -dir.dot(hit.normal));
    c.fwd.copy(upS.normalize());
    c.speed = Math.max(0.6, Math.min(c.vel.length(), T.climbSpeed)) * 0.7;
    c.vel.copy(c.fwd).multiplyScalar(c.speed);
    emit('climb', { position: c.pos.clone(), surface: hit.surface });
  }

  function stepClimb(dt, controls, world, camera) {
    wishFromStick(controls, camera, 'wall');
    const n = c.up.clone();
    const vmax = c.wishMag * (T.climbSpeed + c.sprint * (T.climbSprint - T.climbSpeed));
    // heading turns toward the wish quickly (squirrels turn on a trunk in a blink)
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).dot(n);
      const ang = Math.atan2(cross, THREE.MathUtils.clamp(c.fwd.dot(c.wish), -1, 1));
      const turn = THREE.MathUtils.clamp(ang, -T.climbTurn * dt, T.climbTurn * dt);
      c.fwd.applyAxisAngle(n, turn);
      c.turnRate = THREE.MathUtils.lerp(c.turnRate, turn / dt, 1 - Math.exp(-dt * 12));
    }
    c.fwd.addScaledVector(n, -c.fwd.dot(n)).normalize();
    const align = c.wishMag > 0 ? Math.max(0, c.fwd.dot(c.wish)) : 0;
    const want = vmax * align;
    const a = want > c.speed ? T.climbAccel : T.climbAccel * 1.5;
    c.speed += THREE.MathUtils.clamp(want - c.speed, -a * dt, a * dt);
    c.vel.copy(c.fwd).multiplyScalar(c.speed);

    // jump off: kick away from the surface
    if (c.jumpBuffer > 0) { doJump(world, true); return; }

    const move = v4.copy(c.vel).multiplyScalar(dt);
    const goingUp = c.fwd.dot(UP) > 0.3 && c.speed > 0.05;
    // reached the ground on the way down (head first): walk off, away from the wall
    if (c.fwd.y < -0.2 && c.speed > 0.02) {
      const g = ray(world, v1.copy(c.pos).addScaledVector(n, T.radius), v2.set(0, -1, 0), T.radius * 1.3 + move.length());
      if (g && isWalkable(g.normal)) {
        c.pos.copy(g.point); c.up.copy(g.normal);
        c.fwd.set(n.x, 0, n.z); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 0, -1); c.fwd.normalize();
        c.state = 'move'; c.grounded = true; c.speed = Math.min(c.speed, T.runSpeed * 0.5); emit('land', { position: c.pos.clone(), impact: 0 });
        return;
      }
    }
    // inner corner / obstacle ahead along the surface
    if (c.speed > 0.02) {
      const o = v1.copy(c.pos).addScaledVector(n, T.radius * 0.7);
      const ahead = ray(world, o, c.fwd, T.radius + move.length() + 0.01);
      if (ahead) {
        if (isWalkable(ahead.normal) && c.fwd.dot(UP) < -0.3) { // reached the ground head-first
          c.pos.copy(ahead.point); c.up.copy(ahead.normal);
          c.fwd.set(n.x, 0, n.z);                  // walk on, away from the wall
          if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 0, -1);
          c.fwd.normalize();
          c.state = 'move'; c.grounded = true; c.speed = Math.min(c.speed, T.runSpeed * 0.5); emit('land', { position: c.pos.clone(), impact: 0 });
          return;
        }
        if (c.climbable(ahead.surface) && !isWalkable(ahead.normal)) {     // turn the inner corner
          c.pos.copy(ahead.point); c.up.copy(ahead.normal);
          c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up));
          if (c.fwd.lengthSq() < 1e-4) c.fwd.copy(n);
          c.fwd.normalize();
          return;
        }
        if (isWalkable(ahead.normal) && goingUp) { // an overhang that's a floor? (rare) stop
          c.speed = 0; return;
        }
        c.speed = 0; return;                       // blocked by something we can't climb
      }
    }
    const p1 = v1.copy(c.pos).add(move);
    // re-find the surface under us
    const o = v2.copy(p1).addScaledVector(n, T.radius * 1.5);
    let hit = ray(world, o, v3.copy(n).negate(), T.radius * 3.5);
    if (hit && (c.climbable(hit.surface) || isWalkable(hit.normal))) {
      if (isWalkable(hit.normal)) {
        // walked onto a floor (top of a branch, bottom of a wall)
        c.pos.copy(hit.point); c.up.copy(hit.normal); c.state = 'move'; c.grounded = true;
        c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up)); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(-n.x, 0, -n.z); c.fwd.normalize();
        return;
      }
      c.pos.copy(hit.point);
      c.up.lerp(hit.normal, 1 - Math.exp(-dt * 25)).normalize();
      c.surface = hit.surface;
      return;
    }
    if (hit && !c.climbable(hit.surface)) { c.speed = 0; return; }       // smooth wall: stop at the edge
    // lost the surface: top out onto a ledge?
    if (goingUp || c.fwd.dot(UP) > 0) {
      const ledgeO = v2.copy(c.pos).addScaledVector(UP, T.radius * 2.5 + T.ledgeReach).addScaledVector(n, -T.radius * 2.2);
      const top = ray(world, ledgeO, v3.set(0, -1, 0), T.radius * 2.5 + T.ledgeReach * 2);
      if (top && isWalkable(top.normal)) {
        c.pos.copy(top.point); c.up.copy(top.normal);
        c.fwd.set(-n.x, 0, -n.z); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 0, -1); c.fwd.normalize();
        c.state = 'move'; c.grounded = true; c.speed = Math.max(c.speed, T.runSpeed * 0.3); c.topOut = 0.25;
        emit('land', { position: c.pos.clone(), impact: 0, topOut: true });
        return;
      }
    }
    // outer corner: wrap round it
    {
      const past = v2.copy(c.pos).add(move).addScaledVector(c.fwd, T.radius * 0.8).addScaledVector(n, -T.radius * 0.5);
      const back = ray(world, past, v3.copy(c.fwd).negate(), T.radius * 2);
      if (back && c.climbable(back.surface) && !isWalkable(back.normal)) {
        c.pos.copy(back.point); c.up.copy(back.normal);
        c.fwd.copy(n).negate().addScaledVector(back.normal, n.dot(back.normal)); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 1, 0); c.fwd.normalize();
        return;
      }
      if (back && isWalkable(back.normal)) {
        c.pos.copy(back.point); c.up.copy(back.normal); c.state = 'move'; c.grounded = true; c.fwd.set(-n.x, 0, -n.z).normalize();
        return;
      }
    }
    // nothing: fall off
    c.vel.copy(move).divideScalar(dt).addScaledVector(n, 0.5);
    c.up.copy(UP);
    enterAir('fall');
  }

  // ---------------------------------------------------------------- swimming
  function enterSwim(world, wl) {
    c.state = 'swim'; c.grounded = false; c.jumping = false;
    c.pos.y = wl - T.swimDepth; c.vel.y = 0; c.up.copy(UP);
    c.speed = Math.min(c.speed, T.swimSpeed);
  }

  function stepSwim(dt, controls, world, camera) {
    wishFromStick(controls, camera, 'ground');
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    const vmax = c.wishMag * T.swimSpeed * (1 + 0.3 * c.sprint);
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).y;
      const ang = Math.atan2(cross, c.fwd.dot(c.wish));
      c.fwd.applyAxisAngle(UP, THREE.MathUtils.clamp(ang, -4 * dt, 4 * dt));
    }
    c.fwd.y = 0; c.fwd.normalize();
    c.speed += THREE.MathUtils.clamp(vmax * Math.max(0, c.fwd.dot(c.wish)) - c.speed, -4 * dt, 3 * dt);
    c.vel.copy(c.fwd).multiplyScalar(c.speed);
    c.pos.addScaledVector(c.vel, dt);
    collide(world, (n) => { const into = c.vel.dot(n); if (into < 0 && !isWalkable(n)) c.vel.addScaledVector(n, -into); });
    // shallow: walk out
    const g = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius * 3), v2.set(0, -1, 0), T.radius * 3 + T.swimDepth + 0.02);
    if (wl == null || (g && g.point.y > (wl ?? -1e9) - T.swimDepth)) {
      if (g) { c.pos.copy(g.point); c.state = 'move'; c.grounded = true; c.up.copy(g.normal); return; }
      enterAir('fall'); return;
    }
    c.pos.y = THREE.MathUtils.lerp(c.pos.y, wl - T.swimDepth, 1 - Math.exp(-dt * 10));
    if (c.jumpBuffer > 0) { c.jumpBuffer = 0; c.vel.y = Math.sqrt(2 * T.gravity * T.jumpHeight * 0.35); c.vel.addScaledVector(c.fwd, 0.5); enterAir('jump'); c.jumping = true; emit('splash', { position: c.pos.clone(), speed: 1 }); }
  }

  // ---------------------------------------------------------------- actions
  function stepAction(dt, controls, world, camera) {
    c.actionTime += dt;
    c.speed = 0; c.vel.set(0, 0, 0);
    const moving = Math.hypot(controls.move?.[0] || 0, controls.move?.[1] || 0) > 0.3;
    if (c.state === 'sit') {
      if ((controls.sitPressed && c.actionTime > 0.2) || moving || c.jumpBuffer > 0) { c.state = 'idle'; return stepGround(dt, controls, world, camera); }
    } else if (c.state === 'dig') {
      if (c.actionTime > T.digTime || (moving && c.actionTime > 0.4)) { c.state = 'idle'; return stepGround(dt, controls, world, camera); }
    }
  }

  // ---------------------------------------------------------------- step
  c.step = (dt, controls, world, camera) => {
    if (controls.jumpPressed) c.jumpBuffer = T.jumpBuffer;
    else c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
    c.jumpHeld = !!controls.jump;
    if (c._snapAfterReset) {
      c._snapAfterReset = false;
      const g = ray(world, v1.copy(c.pos).add(v2.set(0, 2 * T.scale + 1, 0)), v3.set(0, -1, 0), 2 * T.scale + 6);
      if (g) c.pos.copy(g.point);
    }
    if (c.topOut > 0) c.topOut -= dt;
    switch (c.state) {
      case 'idle': case 'move': c.groundTime += dt; stepGround(dt, controls, world, camera); break;
      case 'air': stepAir(dt, controls, world, camera); break;
      case 'climb': stepClimb(dt, controls, world, camera); break;
      case 'swim': stepSwim(dt, controls, world, camera); break;
      case 'sit': case 'dig': stepAction(dt, controls, world, camera); break;
    }
    // never NaN, never below the world
    if (!Number.isFinite(c.pos.x + c.pos.y + c.pos.z + c.vel.x + c.vel.y + c.vel.z)) {
      c.vel.set(0, 0, 0); c.pos.copy(c._lastGood || c.pos.set(0, 0, 0)); c.state = 'air';
    } else (c._lastGood ||= new THREE.Vector3()).copy(c.pos);
    if (world.groundAt && c.state !== 'climb') {
      const gy = world.groundAt(c.pos.x, c.pos.z);
      if (Number.isFinite(gy) && c.pos.y < gy - 0.5) { c.pos.y = gy + 0.05; c.vel.y = Math.max(0, c.vel.y); }
    }
  };

  // consume one-frame presses so substeps don't repeat them
  c.update = (dt, controls, world, camera) => {
    c.events.length = 0;
    if (!(dt > 0)) return;
    const n = Math.max(1, Math.ceil(dt / T.maxStep));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      c.step(h, i === 0 ? controls : { ...controls, jumpPressed: false, sitPressed: false, digPressed: false }, world, camera);
    }
  };
  return c;
}
