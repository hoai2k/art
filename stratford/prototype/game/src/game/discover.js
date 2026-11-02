// Landmark discovery: entering a landmark's radius the first time finds it.

export const landmarkDistance = (lm, x, z) => Math.hypot(lm.x - x, lm.z - z);

// The landmarks `pos` is inside that are not in `discovered` yet, nearest first.
export function newDiscoveries(landmarks, pos, discovered) {
  const out = [];
  for (const lm of landmarks || []) {
    if (!lm || discovered[lm.id]) continue;
    const d = landmarkDistance(lm, pos.x, pos.z);
    if (d <= (lm.radius ?? 25)) out.push({ lm, d });
  }
  return out.sort((a, b) => a.d - b.d).map((e) => e.lm);
}
