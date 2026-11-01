// Full screen, for the corner button, Press Start and the Settings switch.
// Takes the document so the tests can hand it a stand-in. Older Safari (iPad)
// only has the webkit-prefixed calls; iPhone Safari has none for pages, so
// there the switch is shown disabled with a note.

const el = (doc) => doc.documentElement;

// Can this browser put the page full screen at all?
export function canFullscreen(doc) {
  if (!doc) return false;
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled;
  const root = el(doc);
  return enabled !== false && enabled !== undefined && !!(root?.requestFullscreen || root?.webkitRequestFullscreen);
}

export const isFullscreen = (doc) => !!(doc?.fullscreenElement || doc?.webkitFullscreenElement);

// Ask for full screen (only honoured during a user gesture). Resolves to
// whether the page is full screen afterwards; never throws.
export async function enterFullscreen(doc) {
  if (isFullscreen(doc) || !canFullscreen(doc)) return isFullscreen(doc);
  const root = el(doc);
  try {
    if (root.requestFullscreen) await root.requestFullscreen();
    else await root.webkitRequestFullscreen();
  } catch {
    /* refused: carry on windowed */
  }
  return isFullscreen(doc);
}

export async function exitFullscreen(doc) {
  if (!isFullscreen(doc)) return false;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
  return isFullscreen(doc);
}

// On (true) or off (false); resolves to the state it ends in.
export const setFullscreen = (doc, on) => (on ? enterFullscreen(doc) : exitFullscreen(doc));
export const toggleFullscreen = (doc) => setFullscreen(doc, !isFullscreen(doc));
