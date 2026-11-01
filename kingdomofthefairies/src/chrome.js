// Getting the browser's own bars out of the way on phones.
//
// - Where the Fullscreen API exists (Android, iPad, desktop; iPhone only with
//   Safari's experimental flag), fullscreen needs a user gesture, so turning
//   the device can't trigger it by itself. Instead, the first tap after the
//   device is in landscape requests fullscreen.
// - iPhone Safari has no element fullscreen. It does tuck its address and tab
//   bars away in landscape when the page is scrolled, but only if there is
//   something to scroll. On iPhone Safari (not the home-screen app) the page
//   is made a little taller than the screen, and while the bars are showing a
//   hint says to swipe up. Scrolling is only possible outside play (title,
//   cards, pause); during play the touch controls own every gesture.
// - The home-screen app (Add to Home Screen) is already full screen.

const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIPhone = /iP(hone|od)/.test(navigator.userAgent);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;

export const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export function canFullscreen() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
export function requestFullscreen() {
  const el = document.documentElement;
  if (fullscreenElement()) return;
  try {
    const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    r?.catch?.(() => { /* refused: carry on */ });
  } catch { /* not allowed here */ }
}
export function exitFullscreen() {
  try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {}); } catch { /* ignore */ }
}

export function createChrome({ touch, isPlaying, hintEl }) {
  const landscape = () => innerWidth > innerHeight;

  // 1. The first tap in landscape asks for fullscreen (where supported).
  if (touch && canFullscreen() && !standalone) {
    document.addEventListener('pointerup', () => {
      if (landscape() && !fullscreenElement()) requestFullscreen();
    }, { capture: true });
  }

  // 2. iPhone Safari: let the bars be scrolled away.
  const scrollTrick = isIPhone && !standalone && !canFullscreen();
  if (scrollTrick) document.documentElement.classList.add('ios-scroll');
  // Safari's bars are showing when the visible height falls well short of the
  // screen's (in landscape the screen's height is its shorter side).
  const barsShowing = () => {
    const full = Math.min(screen.width, screen.height);
    const vh = window.visualViewport ? visualViewport.height : innerHeight;
    return vh < full - 24;
  };
  function update() {
    if (!scrollTrick) return;
    const play = isPlaying();
    document.documentElement.classList.toggle('ios-scroll-play', play);
    const show = landscape() && barsShowing() && !play;
    hintEl.hidden = !show;
  }
  if (scrollTrick) {
    addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    setInterval(update, 400);
    setTimeout(update, 0); // after the shell has finished starting up
  }
  return { update, scrollTrick, isIOS, standalone };
}
