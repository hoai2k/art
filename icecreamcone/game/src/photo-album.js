// Only pinned photographs survive the next Shuttercluck round.
export function normalizePhotos(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(p => p && typeof p.key === 'string' && !seen.has(p.key)
    && typeof p.src === 'string' && /^data:image\/(webp|png|jpeg);base64,/.test(p.src)
    && (seen.add(p.key), true)).map(p => ({
      key: p.key, src: p.src, name: String(p.name || 'Just grass'),
      pts: Number.isFinite(p.pts) ? p.pts : 0, pinned: !!p.pinned,
    }));
}
export const nextPhotoRound = photos => photos.filter(p => p.pinned);
