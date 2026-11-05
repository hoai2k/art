// Share image selection with the preload generator. Every metadata test here
// uses delivered slots, never whichever frames happened to finish downloading.
export const WALK_IMAGES = {
  'prince-walk-a': ['prince-stride', 'prince-stride-a', 'prince-walk-a'],
  'prince-walk-b': ['prince-stride', 'prince-stride-b', 'prince-stand'],
  'prince-court-walk-a': ['prince-court-stride', 'prince-court-stride-a', 'prince-court-walk-a'],
  'prince-court-walk-b': ['prince-court-stride', 'prince-court-stride-b', 'prince-court'],
  'sailor-walk-a': ['sailor-stride', 'sailor-stride-a', 'sailor-walk-a'],
  'sailor-walk-b': ['sailor-stride', 'sailor-stride-b', 'sailor-walk-b'],
  'sailor-pass-a': ['sailor-stride', 'sailor-pass-a', 'sailor-walk-a'],
  'sailor-pass-b': ['sailor-stride', 'sailor-pass-b', 'sailor-walk-b'],
};

const castImage = (id, { cast = {}, available }) => cast[id] && available(cast[id]) ? cast[id] : id;
export function resolveImageId(id, options) {
  const { available, tinted = false } = options;
  let result = castImage(id, options);
  if (!result) return result;
  const walk = WALK_IMAGES[result];
  if (walk) result = available(walk[0] + '-a') && available(walk[0] + '-b') ? walk[1] : walk[2];
  return tinted && available(result + '-tinted') ? result + '-tinted' : result;
}

// Include both walk contacts even when only one is mentioned by a caller.
// Retain the cast base alongside its selected tint for compatibility with
// image probes and the loader's historical base-image dependencies.
export function imageDependencies(id, options) {
  const result = new Set(), { available } = options;
  const add = raw => {
    const selected = resolveImageId(raw, options);
    if (available(selected)) result.add(selected);
    const mapped = castImage(raw, options);
    if (mapped !== raw && available(mapped)) result.add(mapped);
  };
  add(id);
  const walk = WALK_IMAGES[castImage(id, options)];
  if (walk && available(walk[0] + '-a') && available(walk[0] + '-b')) {
    add(walk[0] + '-a'); add(walk[0] + '-b');
  }
  return [...result];
}
