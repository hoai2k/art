// Getting the browser's own bars out of the way on phones (the approach of
// Bronze Drum and Widow's Bay: bronzedrum/game/src/chrome.js and fit.js).
//
// - Where the Fullscreen API exists (Android, iPad, desktop), fullscreen needs
//   a touch, so turning the device can't start it by itself: the first touch
//   after the device is on its side asks for it (and locks landscape where the
//   browser allows that).
// - Safari on iPhone has no fullscreen for a page. It does tuck its address
//   and tab bars away on its side when the page is scrolled by a finger (not
//   by the page itself), but only if there is something to scroll. So there
//   the page is made taller than the screen, and while the bars show outside
//   play a hint at the top says "Swipe up". During play the hand owns every
//   gesture, so nothing scrolls.
// - Opened from the home screen (manifest.webmanifest) it is already full
//   screen and on its side.
// - The game is sized to what is actually visible (the visual viewport less
//   the notch and home bar), since Safari's 100vh ignores its own bars.

const isIPhone = /iP(hone|od)/.test(navigator.userAgent);
export const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
export const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

export function requestFullscreen() {
  if (fullscreenElement() || !canFullscreen) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    const r = req.call(el, { navigationUI: 'hide' });
    r?.then?.(() => {
      // Phones and tablets play on their side; browsers that allow it lock that in.
      if (matchMedia('(pointer: coarse)').matches) screen.orientation?.lock?.('landscape').catch(() => {});
    }, () => { /* refused: carry on in the window */ });
  } catch { /* refused */ }
}

export function exitFullscreen() {
  try {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
  } catch { /* fine */ }
}

// Keep `app` over exactly the visible part of the screen.
function createFit(app, onChange) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  let last = '';
  function fit() {
    const vv = window.visualViewport;
    const vw = Math.round(vv ? vv.width : innerWidth);
    const vh = Math.round(vv ? vv.height : innerHeight);
    const ox = vv ? Math.round(vv.offsetLeft) : 0;
    const oy = vv ? Math.round(vv.offsetTop) : 0;
    const key = [vw, vh, ox, oy].join(',');
    if (key === last) return;
    last = key;
    Object.assign(app.style, { left: `${ox}px`, top: `${oy}px`, width: `${vw}px`, height: `${vh}px`, right: 'auto', bottom: 'auto' });
    onChange?.();
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 120));
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 60));
  // iOS settles its bars a beat after rotation and scrolling: look again.
  setInterval(fit, 500);
  fit();
  return fit;
}

export function createChrome({ app, isPlaying, hintEl }) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const landscape = () => innerWidth > innerHeight;
  const root = document.documentElement;
  root.classList.toggle('no-fullscreen', !canFullscreen || standalone());

  // 1. The first touch on its side asks for fullscreen (where there is one).
  if (touch && canFullscreen && !standalone()) {
    document.addEventListener('pointerup', () => {
      if (landscape() && !fullscreenElement()) requestFullscreen();
    }, { capture: true });
  }

  // 2. Safari on iPhone: let a swipe tuck the bars away.
  const scrollTrick = isIPhone && !standalone() && !canFullscreen;
  if (scrollTrick) root.classList.add('ios-scroll');
  // The bars are showing when the visible height falls well short of the
  // screen's (on its side the screen's height is its shorter side).
  const barsShowing = () => {
    const full = Math.min(screen.width, screen.height);
    const vh = window.visualViewport ? visualViewport.height : innerHeight;
    return vh < full - 24;
  };
  function update() {
    if (!scrollTrick) return;
    const play = isPlaying();
    root.classList.toggle('ios-scroll-play', play);
    hintEl.hidden = !(landscape() && barsShowing() && !play);
  }
  if (scrollTrick) {
    addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    setInterval(update, 400);
    setTimeout(update, 0);
  }
  createFit(app, update);
  return { update, scrollTrick };
}
