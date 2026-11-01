// Ground walking needs a passing pose between opposite contacts. Two
// spread-leg sprites alone look like sliding, especially under long gowns.
export const WALK_PHASES = ['walk-a', 'pass-a', 'walk-b', 'pass-b'];
export function walkPhase(travel, halfStride = 38) {
  if (!Number.isFinite(travel)) return 0;
  if (!Number.isFinite(halfStride) || !(halfStride > 0)) throw new RangeError('Walking half-stride must be finite and positive');
  return ((Math.floor(travel / (halfStride / 2)) % 4) + 4) % 4;
}
export const walkPose = (travel, halfStride) => WALK_PHASES[walkPhase(travel, halfStride)];
export const walkFrame = (prefix, travel, halfStride) => `${prefix}-${walkPose(travel, halfStride)}`;
export const walkStep = (travel, halfStride) => [1, 0, -1, 0][walkPhase(travel, halfStride)];
// Compatibility for a scripted caller that supplies only a sinusoidal
// step: its zero crossing still needs a passing frame, not a contact.
export const walkFrameFromSwing = (prefix, swing) => `${prefix}-${Math.abs(swing) < 0.3 ? 'pass-a' : swing > 0 ? 'walk-a' : 'walk-b'}`;
