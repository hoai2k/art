// Procedural animation for the creatures built by tools/squirrel/build.py (forward kinematics on
// their skeletons, driven by the generic controller's state; the squirrel has its own animator).
//
//   createQuadAnimator(model, T, cfg)   four-legged: cfg.style 'waddle' (beaver: a rolling walk,
//       a slow gallop, a paddling swim, a kicking dive, sit-up gnawing) or 'hop' (rabbit: slow hops
//       with the hind feet landing ahead of the fores, a stretched full-speed bound, sit up tall,
//       a frantic paddle)
//   createBirdAnimator(model, T, cfg)   birds: walk (cfg.waddle for the swan's rolling gait, a
//       stately stride for the heron), swim, wade, take-off run with flapping, flapping flight and
//       gliding with the neck straight (swan) or folded back (heron) and the legs tucked or
//       trailing, landing with the wings spread back and the feet forward
//
// Bone axes: rest rotations are identity, so local axes are the model's (+z forward, +y up,
// +x left). Rotation about +x by a positive angle swings a downward limb back, raises a
// backward-pointing tail and tips a forward-pointing part down.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

// shared: place the model on the controller's frame (smoothed), lean into turns, pitch in the air
function placeBody(st, c, root, dt, { pitchAir = 0.09, lean = 0.035, extraPitch = 0, extraRoll = 0, rate = 16 } = {}) {
  _y.copy(c.up); _z.copy(c.fwd).addScaledVector(_y, -c.fwd.dot(_y)).normalize(); _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m);
  if (st.first) { st.bodyQ.copy(_q); st.first = false; }
  st.bodyQ.slerp(_q, 1 - Math.exp(-dt * rate));
  const v = Math.hypot(c.vel.x, c.vel.z);
  st.roll = damp(st.roll, THREE.MathUtils.clamp(-c.turnRate * v * lean, -0.5, 0.5) + extraRoll, 8, dt);
  st.pitch = damp(st.pitch, (c.state === 'air' ? THREE.MathUtils.clamp(-c.vel.y * pitchAir, -0.5, 0.45) : 0) + extraPitch, 8, dt);
  root.position.copy(c.pos);
  root.quaternion.copy(st.bodyQ).multiply(_q.setFromEuler(_e.set(st.pitch, 0, st.roll)));
}

const rot = (bone, x, y = 0, z = 0) => { if (bone) bone.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ')); };

function baseState() {
  return { t: 0, phase: 0, speed: 0, roll: 0, pitch: 0, bodyQ: new THREE.Quaternion(), first: true, w: {}, blink: 0, nextBlink: 2, glance: 0, glanceT: 0, nextGlance: 2 };
}
// smoothed 0..1 weights for the states
function weigh(st, key, on, rate, dt) { st.w[key] = damp(st.w[key] || 0, on ? 1 : 0, rate, dt); return st.w[key]; }

function blinkAndGlance(st, model, dt, still) {
  if (st.t > st.nextBlink) { st.blink = 1; st.nextBlink = st.t + 2 + Math.random() * 4; }
  st.blink = Math.max(0, st.blink - dt * 7);
  const lid = st.blink > 0 ? Math.max(0.08, Math.abs(st.blink * 2 - 1)) : 1;
  for (const e of model.eyes) e.scale.set(1, lid, 1);
  if (st.t > st.nextGlance) { st.glanceT = (Math.random() - 0.5) * 1.4; st.nextGlance = st.t + 1.5 + Math.random() * 3; }
  st.glance = damp(st.glance, still * st.glanceT, 4, dt);
  return st.glance;
}

// =============================================================================================
export function createQuadAnimator(model, T, cfg = {}) {
  const B = model.bones, st = baseState();
  const tail = Object.keys(B).filter((n) => /^tail\d+$/.test(n)).sort().map((n) => B[n]);
  const hop = cfg.style === 'hop';
  const tA = new Float32Array(tail.length), tV = new Float32Array(tail.length);

  function update(dt, c, root) {
    st.t += dt;
    const v = c.state === 'swim' || c.state === 'dive' ? Math.abs(c.speed) : Math.hypot(c.vel.x, c.vel.z) * (c.state === 'air' ? 0 : 1);
    st.speed = damp(st.speed, v / (c.boostMul || 1), 10, dt);
    const sp = st.speed, rs = T.runSpeed;
    const swim = weigh(st, 'swim', c.state === 'swim', 6, dt), dive = weigh(st, 'dive', c.state === 'dive', 4, dt);
    const sit = weigh(st, 'sit', c.state === 'sit', 6, dt), dig = weigh(st, 'dig', c.state === 'dig', 8, dt);
    const air = weigh(st, 'air', c.state === 'air' && !c.hop, 10, dt);
    // gait: walk / waddle .. gallop (beaver); slow hop .. bound (rabbit)
    const gal = smooth(clamp01((sp - rs * 0.8) / (rs * 0.6)));
    const stride = hop ? 0.12 + 0.07 * sp : 0.22 + 0.16 * sp;
    const freq = sp > 0.02 ? Math.min(hop ? 6 : 4.5, sp / (stride * (T.scale / (hop ? 0.4 : 0.8)))) : 0;
    st.phase = (st.phase + (swim + dive > 0.5 ? (0.8 + sp) * 1.3 : freq) * dt) % 1;
    const ph = st.phase, s = (p) => Math.sin(TAU * p), co = (p) => Math.cos(TAU * p);
    const move = clamp01(sp / (rs * 0.15)) * (1 - air) * (1 - sit) * (1 - dig) * (1 - swim) * (1 - dive);
    // body: waddle roll (beaver), the bound's pitch, swimming low and level, diving nose down
    const roll = hop ? 0 : (1 - gal) * 0.09 * s(ph) * move;
    const divePitch = dive * (c.vel.y < -0.05 ? 0.35 : c.vel.y > 0.05 ? -0.3 : 0.05);
    placeBody(st, c, root, dt, { extraRoll: roll, extraPitch: divePitch, lean: hop ? 0.05 : 0.02 });
    // spine flex for the gallop / bound
    const bound = hop ? 1 : gal;
    const flex = bound * (hop ? 0.35 : 0.2) * co(ph) * move;
    const bob = (hop ? 0.05 * T.scale * Math.max(0, s(ph - 0.15)) : 0.01 * T.scale * Math.abs(s(ph * 2))) * move;
    const breath = Math.sin(st.t * (hop ? 6 : 3)) * 0.012 * (1 - move);
    rot(B.pelvis, -flex * 0.6 - (hop ? 0.9 : 1.05) * sit + 0.1 * dig, 0, 0);
    if (B.pelvis) B.pelvis.position.set(model.rest.pelvis.x, model.rest.pelvis.y + bob - 0.02 * T.scale * sit, model.rest.pelvis.z);
    rot(B.spine1, flex * 0.9 + breath - 0.2 * sit, -c.turnRate * 0.04, 0);
    rot(B.spine2, flex * 0.6 - breath - 0.25 * sit + 0.25 * dig, -c.turnRate * 0.04, 0);
    const look = blinkAndGlance(st, model, dt, (1 - move) * (1 - dig));
    const swimHead = -0.25 * swim;
    rot(B.neck, -flex * 0.5 + 0.55 * sit + 0.3 * dig + swimHead - 0.15 * dive, look * 0.4, 0);
    rot(B.head, -flex * 0.4 + 0.25 * sit + (hop ? 0.4 : 0.35) * dig + swimHead * 0.5, look * 0.6, 0);
    // gnawing (beaver) / chewing: the jaw chatters
    rot(B.jaw, (dig * (hop ? 0.05 : 0.18) + sit * 0.05) * Math.max(0, Math.sin(st.t * (hop ? 16 : 22))), 0, 0);
    // ears: back when bounding (rabbit), twitch
    const earBack = hop ? 0.9 * smooth(clamp01((sp - rs) / rs)) + 0.6 * air : 0;
    rot(B.ear_L, earBack + 0.15 * Math.sin(st.t * 3.1) * (1 - move), 0, 0); rot(B.ear_R, earBack + 0.15 * Math.sin(st.t * 2.7 + 1) * (1 - move), 0, 0);

    // legs
    const leg = (side, hind, off) => {
      const S = side === 'L' ? 1 : -1, pc = (((ph - off) % 1) + 1) % 1;
      const duty = hop ? (hind ? 0.35 : 0.3) : 0.6 - 0.2 * gal;
      const inSt = pc < duty, u = inSt ? pc / duty : (pc - duty) / (1 - duty);
      const sw = inSt ? THREE.MathUtils.lerp(-1, 1, u) : THREE.MathUtils.lerp(1, -1, smooth(u));
      const lift = inSt ? 0 : Math.sin(Math.PI * u);
      const amp = (hind ? 0.45 : 0.4) + 0.3 * bound;
      const a = sw * amp * move;
      const pad = Math.sin(st.t * (hop ? 9 : 5) + (hind ? 0 : Math.PI / 2) + (S > 0 ? 0 : Math.PI)) * (swim + dive);
      if (hind) {
        const kick = hop ? 0 : pad * 0.9;   // the beaver propels with its hind feet
        rot(B['thigh_' + side], a * 0.8 - 0.3 * lift * move + 0.9 * sit + air * (c.vel.y > 0 ? 0.9 : -0.5) + kick * 0.5 + 0.4 * (swim + dive), 0, 0);
        rot(B['shin_' + side], -0.6 * lift * move - 0.8 * sit + kick * 0.4 - 0.2 * (swim + dive), 0, 0);
        rot(B['foot_' + side], 0.7 * lift * move + Math.max(0, a) * 0.5 - 0.1 * sit + air * (c.vel.y > 0 ? 0.6 : 0) + kick * 0.6 + 0.6 * (swim + dive), 0, 0);
        rot(B['toes_' + side], -0.4 * lift * move, 0, 0);
      } else {
        rot(B['scap_' + side], a * 0.4 - 0.2 * sit, 0, 0);
        const dg = dig * Math.sin(st.t * (hop ? 18 : 6) + (S > 0 ? 0 : Math.PI)) * (hop ? 0.5 : 0.15);
        const paddle = hop ? pad * 0.7 : -0.9 * (swim + dive);   // the beaver tucks its hands; the rabbit paddles with all four
        rot(B['uarm_' + side], a * 0.5 + 0.3 * lift * move - 1.1 * sit - 0.5 * dig + dg + air * (c.vel.y > 0 ? 0.5 : -1.0) + paddle, 0, 0);
        rot(B['farm_' + side], -0.8 * lift * move + 1.5 * sit + 0.6 * dig - dg + air * -0.4 + (hop ? 0 : 1.2 * (swim + dive)), 0, S * 0.25 * sit);
        rot(B['hand_' + side], 0.8 * lift * move - 0.5 * sit + 0.3 * dig, 0, 0);
        rot(B['fing_' + side], -0.3 * lift * move + 0.3 * sit, 0, 0);
      }
    };
    // hop: hinds together, fores a beat apart; waddle: lateral walk, then a gallop
    const off = hop ? { hL: 0, hR: 0.03, fL: 0.5, fR: 0.56 } : { hL: 0, hR: 0.5 - 0.42 * gal, fL: 0.25 + 0.25 * gal, fR: 0.75 - 0.17 * gal };
    leg('L', true, off.hL); leg('R', true, off.hR); leg('L', false, off.fL); leg('R', false, off.fR);

    // tail: beaver paddle trails flat, undulates when diving, props him up when sitting; rabbit's puff flicks up
    for (let i = 0; i < tail.length; i++) {
      const t = i / Math.max(1, tail.length - 1);
      let tgt = hop ? 0.3 + 0.5 * move * Math.max(0, s(ph)) + 0.4 * air : 0.05 * move * s(ph * 2 - t);
      if (!hop) tgt += dive * 0.25 * Math.sin(st.t * 4 - i * 0.9) + swim * 0.1 + sit * (i === 0 ? -0.5 : 0.15);
      tV[i] += ((tgt - tA[i]) * 80 - tV[i] * 10) * dt; tA[i] += tV[i] * dt;
      rot(tail[i], tA[i], -c.turnRate * 0.05 * (0.4 + t), 0);
    }
    model.uniforms.uFurPush.value.set(0, -0.2 * (1 - swim), -0.5 * clamp01(sp / (T.sprintSpeed || 5)));
    model.uniforms.uTime.value = st.t;
  }
  return { update, state: st };
}

// =============================================================================================
// birds: wings built spread (rest), folded here with a Z-fold; the neck is aimed per pose
export function createBirdAnimator(model, T, cfg = {}) {
  const B = model.bones, st = baseState(), R = model.rest;
  const neck = ['neck1', 'neck2', 'neck3', 'neck4', 'head'].filter((n) => B[n]);
  const neckRestDir = neck.map((n, i) => {
    const a = R[n], b = i + 1 < neck.length ? R[neck[i + 1]] : R.bill || a.clone().add(new THREE.Vector3(0, 0, 0.05));
    return b.clone().sub(a).normalize();
  });
  const tail = Object.keys(B).filter((n) => /^tail\d+$/.test(n)).sort().map((n) => B[n]);
  const qW = neck.map(() => new THREE.Quaternion()), qParent = new THREE.Quaternion(), qTmp = new THREE.Quaternion();
  const dir = new THREE.Vector3(), restLocal = new THREE.Quaternion();
  let flapPh = 0, legPh = 0;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const wingW = (q, yaw, roll, flap) => q.setFromEuler(_e.set(roll, yaw, flap, 'YXZ'));

  // aim the neck chain so each bone points along dirs[i] (model space), blended by w
  function aimNeck(dirs, w) {
    qParent.identity();   // the spine's rotation is small: treat the neck's parent as unrotated
    for (let i = 0; i < neck.length; i++) {
      qTmp.setFromUnitVectors(neckRestDir[i], dir.copy(dirs[i]).normalize());
      qW[i].copy(qTmp);
      const local = qParent.clone().invert().multiply(qW[i]);
      B[neck[i]].quaternion.slerpQuaternions(restLocal, local, w);
      qParent.copy(qW[i]);
    }
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const NECK = {
    // relaxed S (the built pose) is the identity; these are model-space directions per bone
    flyStraight: [V(0, 0.15, 1), V(0, 0.08, 1), V(0, 0.04, 1), V(0, 0, 1), V(0, -0.15, 1)],
    flyFolded: [V(0, 1, 0.15), V(0, 0.45, -0.9), V(0, 0.2, 1), V(0, -0.1, 1), V(0, -0.2, 1)],
    forward: [V(0, 0.7, 0.7), V(0, 0.55, 0.85), V(0, 0.3, 1), V(0, 0.1, 1), V(0, -0.25, 1)],
  };

  function update(dt, c, root) {
    st.t += dt;
    const flying = c.state === 'fly';
    const v = Math.hypot(c.vel.x, c.vel.z) / (c.boostMul || 1);
    st.speed = damp(st.speed, flying ? 0 : (c.state === 'swim' ? Math.abs(c.speed) : v), 10, dt);
    const fly = weigh(st, 'fly', flying, 6, dt), swim = weigh(st, 'swim', c.state === 'swim', 5, dt);
    const take = weigh(st, 'take', c.takeoff > 0.05, 8, dt), land = weigh(st, 'land', c.landing > 0, 10, dt);
    const flap = weigh(st, 'flap', flying && c.flapping, 6, dt);
    const sit = weigh(st, 'sit', c.state === 'sit' || c.state === 'dig', 5, dt);
    const sp = st.speed;
    const move = clamp01(sp / (T.runSpeed * 0.15)) * (1 - fly) * (1 - swim);
    // body: level in flight, banking into turns; a rolling waddle on land (swan)
    legPh = (legPh + (sp > 0.02 ? Math.min(3.2, sp / (0.35 * T.scale)) : 0) * dt) % 1;
    const waddle = cfg.waddle ? 0.08 * Math.sin(TAU * legPh) * move : 0.02 * Math.sin(TAU * legPh) * move;
    const bank = fly * THREE.MathUtils.clamp(-c.turnRate * 0.35, -0.6, 0.6);
    const flyPitch = fly * THREE.MathUtils.clamp(-c.vel.y * 0.06, -0.35, 0.35);
    placeBody(st, c, root, dt, { extraRoll: waddle + bank, extraPitch: flyPitch - land * 0.25 + take * 0.12, lean: flying ? 0 : 0.01, rate: flying ? 6 : 14 });

    // neck: relaxed S standing; forward when running for take-off; straight (swan) or folded back
    // (heron) in flight; a gentle bob when walking (the heron's head stays still, then catches up)
    const glance = blinkAndGlance(st, model, dt, (1 - move) * (1 - fly));
    const nf = Math.max(take * 0.8, fly);
    if (nf > 0.01) aimNeck(cfg.foldNeck && fly > take ? NECK.flyFolded : (fly > 0.5 ? NECK.flyStraight : NECK.forward), nf);
    else for (const n of neck) B[n].quaternion.identity();
    const bob = (cfg.headBob ? 0.12 : 0.05) * Math.sin(TAU * legPh * 2) * move;
    if (B.neck1) B.neck1.quaternion.multiply(_q.setFromEuler(_e.set(bob * 0.5 + 0.12 * sit, glance * 0.3, 0)));
    if (B.head) B.head.quaternion.multiply(_q.setFromEuler(_e.set(-bob, glance * 0.6, 0)));

    // wings: folded on land and water (a little open in the take-off run and landing); spread,
    // flapping or gliding in the air
    const open = Math.max(fly, take * 0.8, land * 0.9);
    flapPh = (flapPh + dt * (flap * (cfg.flapRate || 2.4) + take * (cfg.flapRate || 2.4) * 1.3 + land * 2.0)) % 1;
    const beat = Math.sin(TAU * flapPh);
    const flapAmp = (flap * 0.55 + take * 0.6 + land * 0.3) * open;
    const glide = fly * (1 - flap) * 0.08;                 // a slight dihedral when gliding
    for (const S of [1, -1]) {
      const X = S > 0 ? '_L' : '_R';
      const fold = 1 - open;
      // fold: humerus back along the body, forearm forward, hand back (a Z-fold in the horizontal
      // plane), each bone rolled about its length so the feathers drop along the flank; built as
      // world rotations and turned into local ones, so the fold axes stay vertical
      const yH = S * 1.5 * fold, yU = yH - S * 2.85 * fold, yM = yU + S * 2.75 * fold;
      const r = -S * 1.45 * fold * S;
      const zH = S * (beat * flapAmp + glide) - S * 0.1 * fold + S * 0.12 * flapAmp;
      const zU = zH + S * Math.sin(TAU * flapPh - 0.6) * flapAmp * 0.35;
      const zM = zU + S * Math.sin(TAU * flapPh - 1.0) * flapAmp * 0.45 - S * land * 0.2;
      wingW(qa, yH, r, zH); wingW(qb, yU, r, zU); wingW(qc, yM - S * land * 0.4, r, zM);
      if (B['humerus' + X]) {
        B['humerus' + X].quaternion.copy(qa);
        // folded, the wing tucks away into the body's folded-wing shape (the feather cards can't
        // lie flat along the flank): it sweeps back and shrinks into the shoulder as it folds
        B['humerus' + X].scale.setScalar(0.02 + 0.98 * smooth(clamp01(open * 1.6)));
      }
      if (B['ulna' + X]) B['ulna' + X].quaternion.copy(qa).invert().multiply(qb);
      if (B['manus' + X]) B['manus' + X].quaternion.copy(qb).invert().multiply(qc);
    }

    // legs: walking strides; paddling when swimming; tucked (swan) or trailing (heron) in flight;
    // feet forward for landing; running steps in the take-off run
    for (const S of [1, -1]) {
      const X = S > 0 ? '_L' : '_R', off = S > 0 ? 0 : 0.5;
      const p = (legPh + off) % 1, sw = Math.sin(TAU * p), lift = Math.max(0, Math.cos(TAU * p));
      const walkT = -0.45 * sw * move, walkS = -0.6 * lift * move, walkTa = 0.9 * lift * move;
      const paddle = Math.sin(st.t * 4 + (S > 0 ? 0 : Math.PI)) * swim * (0.3 + 0.5 * clamp01(sp / T.swimSpeed));
      const tuck = fly * (cfg.trailLegs ? 1 : 0.8);
      const runSteps = take * Math.sin(st.t * 14 + (S > 0 ? 0 : Math.PI)) * 0.7;
      // (a heron's legs trail straight back; a swan's tuck back under the tail)
      rot(B['thigh' + X], walkT + paddle * 0.5 + tuck * (cfg.trailLegs ? 1.45 : 1.3) - land * 0.8 + runSteps * 0.6, 0, 0);
      rot(B['shin' + X], walkS + paddle * 0.4 + tuck * (cfg.trailLegs ? 0.05 : 0.25) + land * 0.4 + runSteps * 0.3, 0, 0);
      rot(B['tarsus' + X], walkTa + paddle * 0.6 + tuck * (cfg.trailLegs ? 0.05 : 0.3) + land * 0.5, 0, 0);
      rot(B['toes' + X], -0.4 * lift * move + tuck * (cfg.trailLegs ? 0.9 : 0.6) + swim * 0.3, 0, 0);
    }
    // tail: up a little on water and when walking, spread fan follows the bank
    for (let i = 0; i < tail.length; i++) rot(tail[i], 0.1 * swim + 0.05 * move * Math.sin(TAU * legPh * 2) - fly * 0.1, 0, -bank * 0.3);
    model.uniforms.uFurPush.value.set(0, -0.1, -0.3 * fly);
    model.uniforms.uTime.value = st.t;
  }
  return { update, state: st };
}
