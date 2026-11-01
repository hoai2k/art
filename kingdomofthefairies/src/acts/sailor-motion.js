// New poses are fitted by head/body scale, not by silhouette height. A squat
// gets shorter; a raised hand gets taller. Each 360x440 canvas shares the
// same body-axis/lowest-boot anchor at (180, 440), in 2x art pixels.
import { walkPose } from '../walking.js';
export const MOVEMENT_SIZE = [360, 440];
export const MOVEMENT_IDS = ['sailor-apex', 'sailor-fall', 'sailor-land', 'sailor-throw',
  'sailor-climb-a', 'sailor-climb-b', 'sailor-stairs-a', 'sailor-stairs-b'];

export function drawMovement(k, pose, x, by, standingHeight, face = 1) {
  const id = 'sailor-' + pose;
  if (!MOVEMENT_IDS.includes(id) || !k.img(id)) return false;
  const scale = standingHeight / 360;
  const c = k.c;
  c.save(); c.translate(x, by); c.scale(face, 1);
  const drawn = k.asset(id, 0, 0, MOVEMENT_SIZE[0] * scale, MOVEMENT_SIZE[1] * scale);
  c.restore();
  return drawn;
}

// Rising, he leaps; coming down from a jump he reaches for his landing (the
// apex frame). The flailing fall frame is only for a long drop, once he is
// falling faster than any jump of his comes down.
export const FALL_VY = 1000;
export function airbornePose(vy) {
  return vy < -95 ? 'leap' : vy > FALL_VY ? 'fall' : 'apex';
}

export function whalePose(s, phase) {
  if (phase === 'down') return 'fall';
  if (!s.on) return airbornePose(s.vy);
  if (s.landT > 0) return 'land';
  return Math.abs(s.vx) > 30 ? walkPose(s.walk) : 'stand';
}

export function cliffPose(st, pos, hold) {
  if (st.defeatT != null) return 'fall';
  if (pos.moving) {
    if (st.cl.kind === 'fall') return 'fall';
    if (st.cl.kind === 'leap') return pos.k < 0.38 ? 'leap' : 'apex';
    return pos.k < 0.5 ? 'climb-a' : 'climb-b';
  }
  if (hold.kind === 'ledge' || hold.kind === 'top') {
    if (['leap', 'fall'].includes(st.cl.kind) && st.cl.moveT - st.cl.moveDur < 0.16) return 'land';
    return 'stand';
  }
  return 'climb-a';
}

export function housePose(st, floors) {
  const p = st.p;
  if (p.carry || p.liftT > 0) return 'carry';
  if (st.defeatT != null) return 'fall';
  if (p.conn) {
    const steps = p.conn.c.kind === 'stairs' || p.conn.c.kind === 'slope';
    const { a, b } = p.conn.c;
    const length = Math.hypot(b.x - a.x, floors[b.f] - floors[a.f]);
    if (steps) return 'stairs-' + walkPose(p.conn.u * length, 26).replace('walk-', '');
    const stride = Math.floor(p.conn.u * length / 26) % 2;
    return 'climb-' + (stride ? 'b' : 'a');
  }
  if (p.f < 0) return airbornePose(p.vy);
  if (st.throwT != null && st.throwT < 0.4) return 'throw';
  if (p.landT > 0) return 'land';
  return Math.abs(p.vx) > 1 ? 'walk' : 'stand';
}
