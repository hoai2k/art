// Procedural animation of the squirrel skeleton from the controller's state (prototype level:
// forward kinematics, no foot IK yet). Gaits by speed: a lateral-sequence walk when slow, a
// half-bound, then a full bound with big spine flex and extension; stride frequency from speed.
// The tail is a damped spring chain (curls over the back at rest, streams when running, swings
// against turns and leaps). Idle: breathing, blinks, ear twitches, glances, tail flicks. Actions:
// sit up (forepaws to chest), dig (forepaws scrabbling), climb (body flat, alternating limbs),
// swim (low, paddling, tail trailing), leap (spread, then forepaws reach to land).
//
// Bone axes: rest rotations are identity, so local axes are the model's (+z forward, +y up,
// +x left). Rotation about +x by a positive angle swings a downward limb BACK, raises a
// backward-pointing tail, and tips a forward-pointing part DOWN.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const TAU = Math.PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function createAnimator(model, T) {
  const B = model.bones;
  const tailN = model.meta.tail.n;
  const tail = Array.from({ length: tailN }, (_, i) => B['tail' + i]);
  const st = {
    phase: 0, gaitW: { walk: 1, half: 0, bound: 0 }, speed: 0,
    sit: 0, dig: 0, climb: 0, air: 0, swim: 0, land: 0,
    tailA: new Float32Array(tailN), tailV: new Float32Array(tailN), tailY: new Float32Array(tailN), tailYV: new Float32Array(tailN),
    blink: 0, nextBlink: 2, ear: 0, nextEar: 3, glance: 0, glanceT: 0, nextGlance: 2, flick: 0, nextFlick: 4,
    t: 0, pitch: 0, roll: 0, vyPrev: 0, look: new THREE.Vector2(), bodyQ: new THREE.Quaternion(), bodyP: new THREE.Vector3(), first: true,
  };
  const rot = (bone, x, y = 0, z = 0) => { bone.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ')); };

  function update(dt, c, root) {
    st.t += dt;
    const state = c.state;
    const speed = c.state === 'climb' || c.state === 'swim' ? Math.abs(c.speed) : Math.hypot(c.vel.x, c.vel.z) * (c.state === 'air' ? 0 : 1);
    st.speed = damp(st.speed, speed, 10, dt);
    const v = st.speed;
    // ---- weights of the layers
    st.sit = damp(st.sit, state === 'sit' ? 1 : 0, 7, dt);
    st.dig = damp(st.dig, state === 'dig' ? 1 : 0, 9, dt);
    st.climb = damp(st.climb, state === 'climb' ? 1 : 0, 12, dt);
    st.air = damp(st.air, state === 'air' && !c.hop ? 1 : 0, 10, dt);
    st.swim = damp(st.swim, state === 'swim' ? 1 : 0, 6, dt);
    st.land = Math.max(0, st.land - dt * 3.5);
    // gait by speed (m/s): walk < 0.9 < half-bound < 2.6 < bound
    const wWalk = 1 - smooth(clamp01((v - 0.6) / 0.6));
    const wBound = smooth(clamp01((v - 2.2) / 1.2));
    const wHalf = Math.max(0, 1 - wWalk - wBound);
    st.gaitW.walk = wWalk; st.gaitW.half = wHalf; st.gaitW.bound = wBound;
    // stride: length grows with speed, frequency too (squirrels: ~3.5 Hz walking .. ~7 Hz flat out)
    const stride = 0.07 + 0.075 * v;
    const freq = v > 0.02 ? Math.min(8, v / stride) : 0;
    st.phase = (st.phase + freq * dt) % 1;
    const ph = st.phase;
    const move = clamp01(v / 0.25) * (1 - st.air) * (1 - st.sit) * (1 - st.dig);

    // ---- body placement: follow the controller frame, smoothed (pitch follows the ground)
    _y.copy(c.up); _z.copy(c.fwd).addScaledVector(_y, -c.fwd.dot(_y)).normalize(); _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m);
    if (st.first) { st.bodyQ.copy(_q); st.bodyP.copy(c.pos); st.first = false; }
    st.bodyQ.slerp(_q, 1 - Math.exp(-dt * (state === 'climb' ? 14 : 18)));
    st.bodyP.copy(c.pos);
    // lean into turns, pitch in the air (nose follows the arc)
    const lean = THREE.MathUtils.clamp(-c.turnRate * v * 0.035, -0.45, 0.45);
    st.roll = damp(st.roll, lean, 8, dt);
    const airPitch = state === 'air' ? THREE.MathUtils.clamp(-c.vel.y * 0.09, -0.5, 0.45) : 0;
    st.pitch = damp(st.pitch, airPitch, 8, dt);
    root.position.copy(st.bodyP);
    root.quaternion.copy(st.bodyQ).multiply(_q.setFromEuler(_e.set(st.pitch, 0, st.roll)));
    if (c.hop) { /* step hop: body just follows the arc */ }
    if (c.vel.y < -0.5 && state === 'air') st.vyPrev = c.vel.y;
    if (state !== 'air' && st.vyPrev < -0.5) { st.land = Math.min(1, -st.vyPrev / 5); st.vyPrev = 0; }

    // ---- gait cycles (angles in radians). Phase 0 = hind feet touch down.
    const s = (p) => Math.sin(TAU * p), co = (p) => Math.cos(TAU * p);
    const ampH = 0.35 + 0.5 * clamp01(v / 5), ampF = 0.35 + 0.45 * clamp01(v / 5);
    // per-leg phase offsets: walk LH 0, LF .25, RH .5, RF .75 ; half-bound: hinds 0/.02, fores .5/.62 ; bound: hinds 0/.04, fores .45/.53
    const off = {
      hL: 0, hR: wWalk * 0.5 + wHalf * 0.02 + wBound * 0.04,
      fL: wWalk * 0.25 + wHalf * 0.5 + wBound * 0.45, fR: wWalk * 0.75 + wHalf * 0.62 + wBound * 0.53,
    };
    // spine: flex (arched, gathered) when the hinds land ahead, extend at push-off
    const bound = wHalf * 0.55 + wBound;
    const flex = bound * (0.32 * co(ph) + 0.06) * move;
    const bob = (wWalk * 0.004 * Math.abs(s(ph * 2)) + bound * 0.018 * Math.max(0, s(ph - 0.1))) * move;
    const breath = Math.sin(st.t * 5.2) * 0.012 * (1 - move);

    // ---- sit / dig / climb / air / swim poses blended over locomotion
    const sit = st.sit, dig = st.dig, air = st.air, climb = st.climb, swim = st.swim;
    const crouch = st.land * 0.6 + (c.jumpBuffer > 0 ? 0.3 : 0);
    // pelvis: sit pivots the body up on the haunches
    rot(B.pelvis, -flex * 0.6 - 1.05 * sit - 0.15 * dig + 0.1 * crouch, 0, 0);
    B.pelvis.position.set(model.rest.pelvis.x, model.rest.pelvis.y + bob - 0.012 * crouch - 0.012 * swim - 0.02 * sit, model.rest.pelvis.z + 0.012 * sit);
    rot(B.spine1, flex * 0.9 + breath - 0.15 * sit - 0.05 * dig, -c.turnRate * 0.03 * (1 - sit), 0);
    rot(B.spine2, flex * 0.6 - breath - 0.2 * sit + 0.25 * dig, -c.turnRate * 0.03 * (1 - sit), 0);
    // head and neck: keep level-ish, look where steering / glance around in idle
    if (st.t > st.nextGlance) { st.glanceT = (Math.random() - 0.5) * 1.6; st.nextGlance = st.t + 1.5 + Math.random() * 3; }
    st.glance = damp(st.glance, (1 - move) * (1 - dig) * st.glanceT, 5, dt);
    const steer = THREE.MathUtils.clamp(c.turnRate * 0.12, -0.6, 0.6);
    const lookYaw = st.glance + steer * move;
    rot(B.neck, -flex * 0.5 + 0.55 * sit + 0.35 * dig - 0.2 * swim + 0.15 * air + 0.25 * climb * clamp01(c.fwd.y) , lookYaw * 0.4, 0);
    rot(B.head, -flex * 0.5 + 0.25 * sit + 0.45 * dig - 0.25 * swim + 0.25 * crouch, lookYaw * 0.6, -lookYaw * 0.15);
    rot(B.jaw, (sit > 0.5 ? 0.12 * Math.max(0, Math.sin(st.t * 18)) : 0) * sit, 0, 0);

    // ---- legs
    const legs = (side, hind, offP) => {
      const S = side === 'L' ? 1 : -1;
      const p = ph - offP;
      if (hind) {
        // stance (first ~45-60% of the cycle): leg sweeps back; swing: knee folds, foot comes forward
        const duty = 0.62 * wWalk + 0.42 * (1 - wWalk);
        const pc = ((p % 1) + 1) % 1;
        const inStance = pc < duty;
        const u = inStance ? pc / duty : (pc - duty) / (1 - duty);
        const swingA = inStance ? THREE.MathUtils.lerp(-1, 1, u) : THREE.MathUtils.lerp(1, -1, smooth(u));
        const lift = inStance ? 0 : Math.sin(Math.PI * u);
        const a = swingA * ampH * move;
        const thigh = a * 0.8 - 0.25 * lift * move;
        const shin = -0.55 * lift * move + Math.max(0, -a) * 0.3;
        const foot = 0.7 * lift * move + Math.max(0, a) * 0.6;   // heel lifts at push-off
        // sit: thighs forward, feet flat; air: legs stretched back then reach; climb: splayed
        const airA = air * (c.vel.y > 0 ? 0.9 : -0.4);
        rot(B['thigh_' + side], thigh + 1.0 * sit + airA - 0.4 * crouch + 0.2 * swim * s(st.t * 2.2 + (S > 0 ? 0 : 0.5)), 0, -S * 0.35 * climb);
        rot(B['shin_' + side], shin - 0.9 * sit - 0.5 * crouch + air * (c.vel.y > 0 ? 0.3 : -0.4), 0, 0);
        rot(B['foot_' + side], foot - 0.15 * sit + 0.4 * crouch + air * (c.vel.y > 0 ? 0.7 : 0.1) + climb * (c.fwd.y < -0.3 ? -2.2 : 0), climb * (c.fwd.y < -0.3 ? S * 0.6 : 0), 0);
        rot(B['toes_' + side], -foot * 0.6 * move, 0, 0);
      } else {
        const duty = 0.62 * wWalk + 0.4 * (1 - wWalk);
        const pc = ((p % 1) + 1) % 1;
        const inStance = pc < duty;
        const u = inStance ? pc / duty : (pc - duty) / (1 - duty);
        const swingA = inStance ? THREE.MathUtils.lerp(-1, 1, u) : THREE.MathUtils.lerp(1, -1, smooth(u));
        const lift = inStance ? 0 : Math.sin(Math.PI * u);
        const a = swingA * ampF * move;
        // scapula slides with the stride (big in a running squirrel)
        rot(B['scap_' + side], a * 0.55 - 0.2 * sit + 0.15 * dig, 0, 0);
        const digA = dig * Math.sin(st.t * 22 + (S > 0 ? 0 : Math.PI)) * 0.6;
        const airUA = air * (c.vel.y > 0 ? 0.6 : -0.9);
        rot(B['uarm_' + side], a * 0.5 + 0.3 * lift * move - 1.2 * sit - 0.6 * dig + digA + airUA + 0.3 * swim * s(st.t * 2.2 + (S > 0 ? 0.25 : 0.75)), 0, -S * 0.3 * climb);
        rot(B['farm_' + side], -0.9 * lift * move + 1.6 * sit + 0.5 * dig - digA * 0.8 + air * (c.vel.y > 0 ? -0.6 : -0.2), 0, S * 0.25 * sit);
        rot(B['hand_' + side], 0.9 * lift * move - 0.6 * sit + Math.max(0, a) * 0.4 + 0.4 * dig, 0, 0);
        rot(B['fing_' + side], -0.3 * lift * move + 0.4 * sit, 0, 0);
      }
    };
    legs('L', true, off.hL); legs('R', true, off.hR); legs('L', false, off.fL); legs('R', false, off.fR);

    // ---- ears and blinks
    if (st.t > st.nextBlink) { st.blink = 1; st.nextBlink = st.t + 2 + Math.random() * 4; }
    st.blink = Math.max(0, st.blink - dt * 7);
    const lid = st.blink > 0 ? Math.max(0.08, Math.abs(st.blink * 2 - 1)) : 1;
    for (const e of model.eyes) e.scale.set(1, lid, 1);
    if (st.t > st.nextEar) { st.ear = 1; st.nextEar = st.t + 2 + Math.random() * 5; }
    st.ear = Math.max(0, st.ear - dt * 5);
    const twitch = Math.sin(st.ear * 12) * 0.25 * st.ear;
    rot(B.ear_L, -0.15 * v * 0.1 + twitch, 0, 0); rot(B.ear_R, -0.15 * v * 0.1 + twitch * 0.4, 0, 0);

    // ---- tail: target curve per state, then a damped spring per joint (lagging the body)
    if (st.t > st.nextFlick) { st.flick = 1; st.nextFlick = st.t + 3 + Math.random() * 5; }
    st.flick = Math.max(0, st.flick - dt * 2.2);
    const run = clamp01(v / 3) * (1 - air) * (1 - climb);
    const accY = c.state === 'air' ? -c.vel.y : 0;
    for (let i = 0; i < tailN; i++) {
      const t = i / (tailN - 1);
      // rest: S-curve up over the back; running: streaming low behind, a ripple; air: straight
      // back and up for balance; climbing: flat to the surface; swimming: trailing on the water
      const idleCurve = (i === 0 ? 1.05 : i < 4 ? 0.28 : i < 8 ? -0.12 : -0.32) + 0.25 * st.flick * Math.sin(st.t * 30 - i * 0.8) * (i > 5 ? 1 : 0);
      const runCurve = (i === 0 ? 0.15 : 0.02) + 0.12 * Math.sin(TAU * ph - i * 0.55) * (0.3 + t);
      const airCurve = i === 0 ? 0.25 : 0.03;
      const climbCurve = i === 0 ? -0.15 : (i < 6 ? 0.02 : 0.05);
      const sitCurve = i === 0 ? 1.4 : i < 5 ? 0.3 : -0.18;
      const swimCurve = i === 0 ? -0.35 : 0.02;
      let target = idleCurve * (1 - run) + runCurve * run;
      target = target * (1 - air) + airCurve * air;
      target = target * (1 - climb) + climbCurve * climb;
      target = target * (1 - sit) + sitCurve * sit;
      target = target * (1 - swim) + swimCurve * swim;
      target += -0.03 * accY * (1 - t);            // lifts as it falls, presses down on rising
      const k = 90 - 50 * t, d = 11 - 5 * t;          // stiffer at the base
      st.tailV[i] += ((target - st.tailA[i]) * k - st.tailV[i] * d) * dt;
      st.tailA[i] += st.tailV[i] * dt;
      // sideways: swings against the turn (counterbalance), lags behind
      const yT = c.turnRate * 0.05 * (0.4 + t) * (1 - sit);
      st.tailYV[i] += ((yT - st.tailY[i]) * (60 - 30 * t) - st.tailYV[i] * (8 - 3 * t)) * dt;
      st.tailY[i] += st.tailYV[i] * dt;
      rot(tail[i], st.tailA[i], st.tailY[i], 0);
    }
    // the fur shells lean back with speed and down with gravity (in model space)
    model.uniforms.uFurPush.value.set(0, -0.25 * (1 - climb), -0.6 * clamp01(v / 6));
    model.uniforms.uTime.value = st.t;
  }

  return { update, state: st };
}
