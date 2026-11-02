// Generic small-creature movement on the World contract: run, turn, jump, step up, climb, swim.
// Every number comes from a tuning table (`T`, see squirrel/tuning.js) expressed for the
// creature's scale, so another creature (an insect) reuses this with its own table.
//
// Frame: `pos` is the contact point (feet on the surface); `up` the surface normal the body
// stands on (world up on the ground, the wall's normal when climbing); `fwd` the heading (unit,
// tangent to the surface). State: 'idle' | 'move' | 'air' | 'climb' | 'sit' | 'dig' | 'swim' |
// 'dive' | 'fly'.
//
// Modes a creature switches on in its tuning (defaults in brackets):
//   canSwim [true]   surface swimming (swimSpeed, swimDepth); swimTire [none]: after that many
//                    seconds a poor swimmer heads for the nearest bank and climbs out
//   canDive [false]  A in the water dives (diveSpeed, diveDepth, breath) and A surfaces again
//   wadeDepth [0]    a non-swimmer walks on the bed of water this shallow; deeper stops it
//   canFly [false]   flight: take off with A (takeoffSpeed > 0: a running start on land or water
//                    while A is held; 0: straight up with a few wingbeats), stick steers
//                    (flyTurn), A held flaps and climbs (flyClimb), RT flies faster (flySpeed,
//                    flySprint), let go to glide (glideSink); lands on ground, roofs, branches or
//                    (if it swims) water. Any creature can reuse these.
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
    takeoff: 0, flapping: false, landing: 0, wading: 0, swimTime: 0, diveTime: 0, flyTime: 0,
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

  // debug superspeed (controls.boost, LT / Q): up to T.boostMax (10) x the speeds and accelerations
  const targetSpeed = () => c.wishMag * (T.runSpeed + c.sprint * (T.sprintSpeed - T.runSpeed)) * c.boostMul;

  function emit(name, data) { c.events.push([name, data]); }

  function isWalkable(n) { return n.y >= T.walkableY; }

  // body centre for a contact point and its surface normal
  const centreOf = (p, n, out = new THREE.Vector3()) => out.copy(p).addScaledVector(n, T.radius * 0.9);
  // can the body get from its centre to (point, normal) [via points] in straight lines?
  function reach(world, point, normal, via = []) {
    let a = centreOf(c.pos, c.up);
    for (const v of via) { if (!pathClear(world, a, v)) return false; a = v; }
    const ok = pathClear(world, a, centreOf(point, normal));
    if (ok && via.length) c._relocated = true;     // a checked path that isn't a straight line
    return ok;
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
      const sp = Math.abs(c.speed) / c.boostMul;      // (turning as at the unboosted speed)
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
    const a = (want > c.speed ? T.accel * (c.speed < T.runSpeed * 0.3 ? 1.3 : 1) : T.decel) * c.boostMul;
    c.speed += THREE.MathUtils.clamp(want - c.speed, -a * dt, a * dt);
    // keep heading tangent
    c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up)).normalize();
    c.vel.copy(c.fwd).multiplyScalar(c.speed);

    // step-up / climb probe ahead
    if (c.speed > 0.05 || c.wishMag > 0.3) {
      const look = T.capsuleFront + T.radius * 1.5 + Math.max(c.speed, 0.3) * T.stepLook;
      const o = v1.copy(c.pos).addScaledVector(c.up, T.radius * 0.6);
      const dir = c.wishMag > 0.3 && c.speed < 0.3 ? v4.copy(c.wish) : v4.copy(c.fwd);
      const hit = ray(world, o, dir, look);
      if (hit && !isWalkable(hit.normal)) {
        const step = findTop(world, hit, dir);
        const top = step ? step.y : null;
        if (top !== null && top - c.pos.y <= T.stepUp && top - c.pos.y > T.radius * 0.2 && hopClear(world, step)) {
          // hop the step: a small real jump that keeps the forward speed
          // rise fast enough to be over the edge by the time the capsule's nose gets there
          const h = top - c.pos.y + T.radius * 0.6;
          const vh = Math.max(c.speed, T.runSpeed * 0.3);
          const gap = Math.max(0.01, hit.distance - (T.capsuleFront + T.radius) * 0.8);
          const t = gap / vh;
          c.vel.copy(c.fwd).multiplyScalar(vh);
          c.vel.y = Math.min(Math.sqrt(2 * T.gravity * T.stepUp * 2), Math.max(Math.sqrt(2 * T.gravity * h), h / t + T.gravity * t / 2));
          c.hop = 1; enterAir('hop');
          return;
        }
        if (c.canCling(hit) && dir.dot(hit.normal) < -0.5 && reach(world, hit.point, hit.normal) && (c.speed > 0.2 || c.wishMag > 0.5) && hit.distance < T.capsuleFront + T.radius + 0.12 * T.radius + c.speed * dt * 2) {
          attachClimb(hit, dir);
          return;
        }
      }
    }

    // flight take-off: a running start (A held, up to takeoffSpeed) or straight up
    if (T.canFly) {
      if (T.takeoffSpeed > 0 && c.jumpHeld) {
        c.takeoff = Math.min(1, c.speed / T.takeoffSpeed);
        if (c.wishMag < 0.3) c.wish.copy(c.fwd);
        c.speed = Math.min(T.takeoffSpeed * 1.05 * c.boostMul, c.speed + T.accel * 0.6 * dt * c.boostMul);
        c.vel.copy(c.fwd).multiplyScalar(c.speed);
        if (c.speed >= T.takeoffSpeed) { takeOff(); return; }
      } else c.takeoff = 0;
    }
    // move
    const prevPos = v4.copy(c.pos).clone();
    c.pos.addScaledVector(c.vel, dt);
    // a non-swimmer wades only where the water is shallow enough
    if (T.canSwim === false) {
      const wl0 = world.waterAt?.(c.pos.x, c.pos.z);
      if (wl0 != null && wl0 - c.pos.y > (T.wadeDepth || 0) && wl0 - c.pos.y > wl0 - prevPos.y) {
        c.pos.copy(prevPos); c.speed = 0; c.vel.set(0, 0, 0);
      }
    }
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
    c.wading = wl != null && wl > c.pos.y ? wl - c.pos.y : 0;
    if (T.canSwim !== false && wl != null && c.pos.y < wl - T.swimDepth) { enterSwim(world, wl); return; }
    // jump (a flyer with no running start takes off instead; one with a running start holds A)
    if (c.jumpBuffer > 0) {
      if (T.canFly && !(T.takeoffSpeed > 0)) { c.jumpBuffer = 0; takeOff(true); return; }
      if (!T.canFly) { doJump(world); return; }
      c.jumpBuffer = 0;
    }
    // actions
    if (controls.sitPressed && Math.abs(c.speed) < T.runSpeed * 0.5) { c.state = 'sit'; c.actionTime = 0; c.speed = 0; return; }
    if (controls.digPressed && Math.abs(c.speed) < T.runSpeed * 0.5) { c.state = 'dig'; c.actionTime = 0; c.speed = 0; emit('dig', { position: c.pos.clone() }); return; }
    c.state = Math.abs(c.speed) > 0.05 || c.wishMag > 0 ? 'move' : 'idle';
  }

  // the hop's path: straight up from the body to above the step, then across to the very spot
  // found on top of it (so a floor seen behind a wall, inside a building, is never a step)
  function hopClear(world, step) {
    const a = centreOf(c.pos, UP);
    const b = a.clone(); b.y = step.y + T.radius * 1.2;
    const t = step.point.clone(); t.y = step.y + T.radius * 1.2;
    return pathClear(world, a, b) && pathClear(world, b, t) && pathClear(world, t, centreOf(step.point, UP));
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
    return { y: down.point.y, point: down.point };
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
      leaveWall(world);
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
    if (T.canSwim !== false && wl != null && c.pos.y < wl - T.swimDepth && c.vel.y < 0) { emit('splash', { position: c.pos.clone(), speed: -c.vel.y }); enterSwim(world, wl); return; }
    // a flyer falling (off a roof, after a hop) opens its wings with A
    if (T.canFly && c.jumpBuffer > 0 && !c.hop) { c.jumpBuffer = 0; takeOff(true); return; }
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
    const vmax = c.wishMag * (T.climbSpeed + c.sprint * (T.climbSprint - T.climbSpeed)) * c.boostMul;
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
      const g = ray(world, v1.copy(c.pos).addScaledVector(n, T.radius), v2.set(0, -1, 0), T.capsuleFront + T.radius * 1.3 + move.length());
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
      const ahead = ray(world, o, c.fwd, T.capsuleFront + T.radius + move.length() + 0.01);   // as far as the body's nose
      if (ahead) {
        if (isWalkable(ahead.normal) && c.fwd.dot(UP) < -0.3 && reach(world, ahead.point, ahead.normal)) { // reached the ground head-first
          c.pos.copy(ahead.point); c.up.copy(ahead.normal);
          c.fwd.set(n.x, 0, n.z);                  // walk on, away from the wall
          if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 0, -1);
          c.fwd.normalize();
          c.state = 'move'; c.grounded = true; c.speed = Math.min(c.speed, T.runSpeed * 0.5); emit('land', { position: c.pos.clone(), impact: 0 });
          return;
        }
        if (c.canCling(ahead) && reach(world, ahead.point, ahead.normal)) {     // turn the inner corner
          c.pos.copy(ahead.point); c.up.copy(ahead.normal);
          c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up));
          if (c.fwd.lengthSq() < 1e-4) c.fwd.copy(n);
          c.fwd.normalize();
          return;
        }
        // something we can't hold on to (a ceiling, the underside of an eave or cornice, glass):
        // going up, try to get round it onto the top; otherwise stop
        if (goingUp) { const top = findTopOut(world, n); if (top) { topOut(top, n); return; } }
        c.speed = 0; return;
      }
    }
    const p1 = v1.copy(c.pos).add(move);
    // re-find the surface under us: it must continue where the current one is (a hit much
    // deeper is another surface seen through a gap, e.g. the inside of a parapet)
    const o = v2.copy(p1).addScaledVector(n, T.radius * 1.5);
    const hit = ray(world, o, v3.copy(n).negate(), T.radius * 3.5);
    const continues = hit && hit.distance < T.radius * 1.5 + T.radius * 0.8 + move.length();
    if (continues && (c.canCling(hit) || isWalkable(hit.normal))) {
      if (!reach(world, hit.point, hit.normal)) { c.speed = 0; return; }
      if (isWalkable(hit.normal)) {
        // walked onto a floor (top of a branch, bottom of a wall)
        c.pos.copy(hit.point); c.up.copy(hit.normal); c.state = 'move'; c.grounded = true;
        c.fwd.addScaledVector(c.up, -c.fwd.dot(c.up)); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(-n.x, 0, -n.z); c.fwd.normalize();
        return;
      }
      const prevPos = c.pos.clone();
      c.pos.copy(hit.point);
      c.up.lerp(hit.normal, 1 - Math.exp(-dt * 25)).normalize();
      c.surface = hit.surface;
      // the body itself must not run into things beside or ahead of it on the wall
      collide(world, (cn) => {
        if (cn.dot(c.up) > 0.8) return;          // the wall we're on
        const into = c.vel.dot(cn);
        if (into < 0) { c.vel.addScaledVector(cn, -into); c.speed = Math.max(0, c.vel.dot(c.fwd)); }
      }, prevPos);
      return;
    }
    if (continues && hit && !c.canCling(hit)) { c.speed = 0; return; }   // smooth wall: stop at the edge
    // lost the surface going up: top out onto the roof / ledge (round an eave if need be)
    if (goingUp || c.fwd.dot(UP) > 0) {
      const top = findTopOut(world, n);
      if (top) { topOut(top, n); return; }
    }
    // outer corner: wrap round it
    {
      const past = v2.copy(c.pos).add(move).addScaledVector(c.fwd, T.radius * 0.8).addScaledVector(n, -T.radius * 0.5);
      const back = ray(world, past, v3.copy(c.fwd).negate(), T.radius * 2);
      const via = [c.pos.clone().add(move).addScaledVector(c.fwd, T.radius * 1.2).addScaledVector(n, T.radius * 0.9)];
      if (back && c.canCling(back) && reach(world, back.point, back.normal, via)) {
        c.pos.copy(back.point); c.up.copy(back.normal);
        c.fwd.copy(n).negate().addScaledVector(back.normal, n.dot(back.normal)); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 1, 0); c.fwd.normalize();
        return;
      }
      if (back && isWalkable(back.normal) && reach(world, back.point, back.normal, via)) {
        c.pos.copy(back.point); c.up.copy(back.normal); c.state = 'move'; c.grounded = true; c.fwd.set(-n.x, 0, -n.z).normalize();
        return;
      }
    }
    // going up with nowhere to go (a gap under a roof, an eave too deep): hold at the top
    if (goingUp || c.fwd.dot(UP) > 0.3) { c.speed = 0; return; }
    // nothing: let go, away from the wall
    c.vel.copy(move).divideScalar(dt).addScaledVector(n, 0.5);
    leaveWall(world);
    c.up.copy(UP);
    enterAir('fall');
  }

  // A place to stand at the top of the wall we're on (outward normal n), reachable without going
  // through anything: straight over the top (flush wall top, parapet, ledge, fence rail), or out
  // and round an overhanging eave onto the roof. Returns the floor hit or null.
  function findTopOut(world, n) {
    const R = T.radius;
    const nh = v3.set(n.x, 0, n.z);
    if (nh.lengthSq() < 0.05) return null;
    nh.normalize();
    const out = nh.clone();
    const cen = centreOf(c.pos, n);
    for (const d of [R * 0.6, R * 1.2, R * 2.2, R * 4]) {
      const o = c.pos.clone().addScaledVector(UP, R * 2.5 + T.ledgeReach).addScaledVector(out, -d);
      const top = ray(world, o, DOWN, R * 2.5 + T.ledgeReach * 2);
      if (!top || !standable(top) || top.distance < 0.005) continue;
      const via = cen.clone(); via.y = Math.max(cen.y, top.point.y + R * 1.2);
      if (pathClear(world, cen, via) && pathClear(world, via, centreOf(top.point, top.normal))) return top;
    }
    // round an eave: scan outward for the roof edge from above, then go out past it, up and over
    const H = T.eaveReach;
    let last = null;
    for (let d = R; d <= T.eaveReach + 1e-6; d += R * 0.75) {
      const o = c.pos.clone().addScaledVector(out, d); o.y += H;
      const h = ray(world, o, DOWN, H + R * 3);
      if (h && h.distance > 0.005 && h.point.y > c.pos.y - R * 3) { last = { h, d }; continue; }
      if (!last) continue;
      const h0 = last.h;
      if (!standable(h0)) return null;
      const away = c.pos.clone().addScaledVector(out, d + R * 0.5); away.y = cen.y;
      const over = away.clone(); over.y = Math.max(cen.y, h0.point.y + R * 1.5);
      const tgt = centreOf(h0.point, h0.normal);
      if (pathClear(world, cen, away) && pathClear(world, away, over) && pathClear(world, over, tgt)) return h0;
      return null;
    }
    return null;
  }

  // Letting go of a wall: on the wall the feet (pos) are on its surface and the body is out along
  // its normal; in the air the body is above the feet. Step the feet out one body radius first, or
  // the body would straddle the wall (and rays starting on it can't see it).
  function leaveWall(world) {
    const n = c.up;
    if (n.y > 0.6) return;
    const out = c.pos.clone().addScaledVector(n, T.radius * 1.05);
    if (pathClear(world, centreOf(c.pos, n), centreOf(out, n))) c.pos.copy(out);
    c._relocated = true;
  }

  // a floor, or an upward-facing slope it can hold on to (a steep roof)
  const standable = (h) => isWalkable(h.normal) || (h.normal.y > 0.05 && c.canCling(h));

  function topOut(top, n) {
    c._relocated = true;                            // checked by findTopOut (possibly round an eave)
    c.pos.copy(top.point); c.up.copy(top.normal);
    c.fwd.set(-n.x, 0, -n.z); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(0, 0, -1); c.fwd.normalize();
    c.topOut = 0.25;
    if (isWalkable(top.normal)) {
      c.state = 'move'; c.grounded = true; c.speed = Math.max(c.speed, T.runSpeed * 0.3);
      emit('land', { position: c.pos.clone(), impact: 0, topOut: true });
    } else {
      // onto a steep roof: keep climbing, up the slope
      c.state = 'climb'; c.surface = top.surface;
      c.fwd.copy(UP).addScaledVector(c.up, -c.up.y); if (c.fwd.lengthSq() < 1e-4) c.fwd.set(-n.x, 0, -n.z); c.fwd.normalize();
    }
  }

  // ---------------------------------------------------------------- swimming
  function enterSwim(world, wl) {
    c.state = 'swim'; c.grounded = false; c.jumping = false; c.swimTime = 0;
    c.pos.y = wl - T.swimDepth; c.vel.y = 0; c.up.copy(UP);
    c.speed = Math.min(c.speed, T.swimSpeed);
  }

  function stepSwim(dt, controls, world, camera) {
    wishFromStick(controls, camera, 'ground');
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    const vmax = c.wishMag * T.swimSpeed * (1 + 0.3 * c.sprint) * c.boostMul;
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).y;
      const ang = Math.atan2(cross, c.fwd.dot(c.wish));
      c.fwd.applyAxisAngle(UP, THREE.MathUtils.clamp(ang, -4 * dt, 4 * dt));
    }
    c.fwd.y = 0; c.fwd.normalize();
    c.speed += THREE.MathUtils.clamp(vmax * Math.max(0, c.fwd.dot(c.wish)) - c.speed, -4 * dt * c.boostMul, 3 * dt * c.boostMul);
    // a poor swimmer tires and heads for the nearest bank
    c.swimTime += dt;
    if (T.swimTire && c.swimTime > T.swimTire) {
      const bank = nearestBank(world);
      if (bank) { c.fwd.lerp(bank, 1 - Math.exp(-dt * 6)).setY(0).normalize(); c.speed = Math.max(c.speed, T.swimSpeed * 0.8); }
    }
    // a flyer that can take off from water runs across it with A held
    if (T.canFly && T.takeoffSpeed > 0 && c.jumpHeld) {
      c.takeoff = Math.min(1, c.speed / T.takeoffSpeed);
      c.speed = Math.min(T.takeoffSpeed * 1.05 * c.boostMul, c.speed + T.accel * 0.45 * dt * c.boostMul);
      if (c.speed >= T.takeoffSpeed) { c.vel.copy(c.fwd).multiplyScalar(c.speed); takeOff(); emit('splash', { position: c.pos.clone(), speed: 1 }); return; }
    } else c.takeoff = 0;
    c.vel.copy(c.fwd).multiplyScalar(c.speed);
    const prevSwim = c.pos.clone();
    c.pos.addScaledVector(c.vel, dt);
    collide(world, (n) => { const into = c.vel.dot(n); if (into < 0 && !isWalkable(n)) c.vel.addScaledVector(n, -into); }, prevSwim);
    // shallow: walk out
    const g = ray(world, v1.copy(c.pos).addScaledVector(UP, T.radius * 3), v2.set(0, -1, 0), T.radius * 3 + T.swimDepth + 0.02);
    if (wl == null || (g && g.point.y > (wl ?? -1e9) - T.swimDepth)) {
      if (g) { c.pos.copy(g.point); c.state = 'move'; c.grounded = true; c.up.copy(g.normal); return; }
      enterAir('fall'); return;
    }
    c.pos.y = THREE.MathUtils.lerp(c.pos.y, wl - T.swimDepth, 1 - Math.exp(-dt * 10));
    if (c.jumpBuffer > 0) {
      c.jumpBuffer = 0;
      if (T.canDive) { c.state = 'dive'; c.diveTime = 0; emit('splash', { position: c.pos.clone(), speed: 0.5 }); return; }
      if (T.canFly) return;                         // (holding A runs across the water instead)
      c.vel.y = Math.sqrt(2 * T.gravity * T.jumpHeight * 0.35); c.vel.addScaledVector(c.fwd, 0.5); enterAir('jump'); c.jumping = true; emit('splash', { position: c.pos.clone(), speed: 1 });
    }
  }

  // the direction to the nearest dry ground, looking out a few metres round about
  function nearestBank(world) {
    for (const r of [0.5, 1, 2, 3.5, 5].map((x) => x * T.scale / 0.25)) {
      let best = null;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, x = c.pos.x + Math.sin(a) * r, z = c.pos.z + Math.cos(a) * r;
        if (world.waterAt?.(x, z) == null) { const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); if (!best || d.dot(c.fwd) > best.dot(c.fwd)) best = d; }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------------------------------------------------------------- diving
  function stepDive(dt, controls, world, camera) {
    wishFromStick(controls, camera, 'ground');
    c.diveTime += dt;
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    if (wl == null) { c.state = 'swim'; return stepSwim(dt, controls, world, camera); }
    // the bed under us, and how deep we go (diveDepth, never into the bed)
    const bed = ray(world, v1.set(c.pos.x, wl + 0.05, c.pos.z), DOWN, 30);
    const bedY = bed ? bed.point.y : wl - 30;
    const target = Math.max(bedY + T.radius * 1.2, wl - (T.diveDepth || 1));
    const surface = c.jumpBuffer > 0 || c.diveTime > (T.breath || 20) || target > wl - T.swimDepth - 0.02;
    if (c.jumpBuffer > 0) c.jumpBuffer = 0;
    if (surface && c.diveTime > 0.25) { c.state = 'swim'; c.swimTime = 0; emit('splash', { position: c.pos.clone(), speed: 0.4 }); return; }
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).y;
      c.fwd.applyAxisAngle(UP, THREE.MathUtils.clamp(Math.atan2(cross, c.fwd.dot(c.wish)), -3.5 * dt, 3.5 * dt));
    }
    c.fwd.y = 0; c.fwd.normalize();
    const vmax = c.wishMag * (T.diveSpeed || T.swimSpeed) * (1 + 0.3 * c.sprint) * c.boostMul;
    c.speed += THREE.MathUtils.clamp(vmax * Math.max(0, c.fwd.dot(c.wish)) - c.speed, -4 * dt * c.boostMul, 3 * dt * c.boostMul);
    const vy = THREE.MathUtils.clamp((target - c.pos.y) * 3, -1.5, 1.5);
    c.vel.copy(c.fwd).multiplyScalar(c.speed); c.vel.y = vy;
    const prev = c.pos.clone();
    c.pos.addScaledVector(c.vel, dt);
    collide(world, (n) => { const into = c.vel.dot(n); if (into < 0) c.vel.addScaledVector(n, -into); }, prev);
    if (c.pos.y < bedY + T.radius) c.pos.y = bedY + T.radius;
  }

  // ---------------------------------------------------------------- flight
  function takeOff(standing) {
    c.state = 'fly'; c.grounded = false; c.jumping = false; c.hop = 0; c.takeoff = 0; c.flyTime = 0;
    c.up.copy(UP); c.fwd.y = 0; c.fwd.normalize();
    c.speed = Math.max(c.speed, T.flyMin * (standing ? 0.6 : 1));
    c.vel.copy(c.fwd).multiplyScalar(c.speed);
    c.vel.y = standing ? T.flyClimb * 1.6 : T.flyClimb;
    emit('jump', { position: c.pos.clone(), takeoff: true });
  }

  function stepFly(dt, controls, world, camera) {
    c.flyTime += dt;
    wishFromStick(controls, camera, 'air');
    // steer: turn the heading toward the stick (banked turns)
    let turn = 0;
    if (c.wishMag > 0) {
      const cross = v1.crossVectors(c.fwd, c.wish).y;
      const ang = Math.atan2(cross, THREE.MathUtils.clamp(c.fwd.dot(c.wish), -1, 1));
      turn = THREE.MathUtils.clamp(ang, -T.flyTurn * dt, T.flyTurn * dt);
      c.fwd.applyAxisAngle(UP, turn);
    }
    c.turnRate = THREE.MathUtils.lerp(c.turnRate, turn / dt, 1 - Math.exp(-dt * 6));
    // speed: cruise, faster with RT, a little slower with the stick pulled back
    const back = c.wishMag > 0 ? Math.max(0, -c.fwd.dot(c.wish)) * c.wishMag : 0;
    const want = (T.flySpeed + c.sprint * (T.flySprint - T.flySpeed)) * (1 - 0.35 * back) * c.boostMul;
    c.speed += THREE.MathUtils.clamp(want - c.speed, -T.flyAccel * dt * c.boostMul, T.flyAccel * dt * c.boostMul);
    // A held: flap and climb; otherwise glide down slowly
    c.flapping = c.jumpHeld || c.flyTime < 0.5;
    const vyWant = c.flapping ? T.flyClimb : -T.glideSink * (c.speed < T.flyMin ? 2.5 : 1);
    c.vel.y += THREE.MathUtils.clamp(vyWant - c.vel.y, -6 * dt, 6 * dt);
    c.vel.x = c.fwd.x * c.speed; c.vel.z = c.fwd.z * c.speed;
    if (c.pos.y > (T.flyCeiling ?? 150) && c.vel.y > 0) c.vel.y = 0;
    const prev = c.pos.clone();
    // landing: ground (or a roof, or a branch) close under the feet while descending
    const step = v3.copy(c.vel).multiplyScalar(dt);
    if (c.vel.y <= 0 && c.flyTime > 0.6) {
      const g = ray(world, v4.copy(c.pos).addScaledVector(UP, T.radius), DOWN, T.radius + Math.max(0.02, -step.y) + 0.02);
      if (g && isWalkable(g.normal)) { c.pos.copy(g.point); landFromFlight(g); return; }
    }
    c.pos.add(step);
    collide(world, (n) => {
      const into = c.vel.dot(n);
      if (into < 0) c.vel.addScaledVector(n, -into);
      if (isWalkable(n) && c.vel.y < 0) c.vel.y = 0;
    }, prev);
    // water: a swimmer lands on it (skiing in on its feet), a wader on a shallow bed, else stay up
    const wl = world.waterAt?.(c.pos.x, c.pos.z);
    if (wl != null && c.pos.y < wl + 0.02) {
      if (T.canSwim !== false && c.flyTime > 0.6) { c.state = 'swim'; c.swimTime = 0; c.pos.y = wl - T.swimDepth; c.vel.y = 0; c.speed = Math.min(c.speed, T.swimSpeed * 2); c.landing = 0.6; emit('splash', { position: c.pos.clone(), speed: c.speed }); emit('land', { position: c.pos.clone(), impact: 1, water: true }); return; }
      if (T.canSwim === false) { c.pos.y = Math.max(c.pos.y, wl + 0.02); c.vel.y = Math.max(0, c.vel.y); }
    }
  }

  function landFromFlight(g) {
    c.state = 'move'; c.grounded = true; c.up.copy(g.normal); c.surface = g.surface;
    c.speed = Math.min(c.speed, T.runSpeed); c.vel.set(0, 0, 0); c.landing = 0.6; c.flapping = false;
    emit('land', { position: c.pos.clone(), impact: 1, fromFlight: true });
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
  c.boostMul = 1;
  c.step = (dt, controls, world, camera) => {
    c.boostMul = 1 + ((T.boostMax ?? 10) - 1) * Math.min(1, Math.max(0, controls.boost || 0));
    if (controls.jumpPressed) c.jumpBuffer = T.jumpBuffer;
    else c.jumpBuffer = Math.max(0, c.jumpBuffer - dt);
    c.jumpHeld = !!controls.jump;
    if (c._snapAfterReset) {
      c._snapAfterReset = false;
      const g = ray(world, v1.copy(c.pos).add(v2.set(0, 2 * T.scale + 1, 0)), v3.set(0, -1, 0), 2 * T.scale + 6);
      if (g) c.pos.copy(g.point);
    }
    if (c.topOut > 0) c.topOut -= dt;
    if (c.landing > 0) c.landing -= dt;
    const c0 = centreOf(c.pos, c.up), p0 = c.pos.clone(), u0 = c.up.clone();
    c._relocated = false;
    switch (c.state) {
      case 'idle': case 'move': c.groundTime += dt; stepGround(dt, controls, world, camera); break;
      case 'air': stepAir(dt, controls, world, camera); break;
      case 'climb': stepClimb(dt, controls, world, camera); break;
      case 'swim': stepSwim(dt, controls, world, camera); break;
      case 'dive': stepDive(dt, controls, world, camera); break;
      case 'fly': stepFly(dt, controls, world, camera); break;
      case 'sit': case 'dig': stepAction(dt, controls, world, camera); break;
    }
    // last line of defence: an ordinary step may never carry the body's centre through a surface
    // (relocations along a checked path, like topping out round an eave, are exempt)
    if (!c._relocated && Number.isFinite(c.pos.x + c.pos.y + c.pos.z)) {
      const c1 = centreOf(c.pos, c.up);
      if (c1.distanceToSquared(c0) > 1e-10 && !pathClear(world, c0, c1, 0)) {
        const d = c1.sub(c0).normalize();
        c.pos.copy(p0); c.up.copy(u0);
        const into = c.vel.dot(d); if (into > 0) c.vel.addScaledVector(d, -into);
        c.speed = Math.min(c.speed, Math.max(0, c.vel.dot(c.fwd)));
        c.debug.blocked = (c.debug.blocked || 0) + 1;
      }
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
    // short enough steps that the body never moves more than ~half its radius at once (so it
    // can't cross a zero-thickness wall between two collision checks)
    const mul = 1 + ((T.boostMax ?? 10) - 1) * Math.min(1, Math.max(0, controls.boost || 0));
    const sp = Math.max(c.vel.length(), mul > 1 ? T.sprintSpeed * mul : 0) + 1;
    // (with superspeed that can be a couple of hundred substeps: it's a debugging aid)
    const n = Math.min(400, Math.max(1, Math.ceil(dt / T.maxStep), Math.ceil(sp * dt / (T.radius * 0.45))));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      c.step(h, i === 0 ? controls : { ...controls, jumpPressed: false, sitPressed: false, digPressed: false }, world, camera);
    }
  };
  return c;
}
