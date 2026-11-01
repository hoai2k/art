import test from 'node:test';
import assert from 'node:assert/strict';
import { canFullscreen, isFullscreen, setFullscreen, toggleFullscreen } from '../src/fullscreen.js';

// A stand-in document: full screen allowed or refused, prefixed or not.
function fakeDoc({ enabled = true, prefixed = false, refuse = false } = {}) {
  const doc = { fullscreenElement: null };
  const root = {};
  const enter = () => (refuse ? Promise.reject(new Error('no gesture')) : Promise.resolve((doc[prefixed ? 'webkitFullscreenElement' : 'fullscreenElement'] = root)));
  const leave = () => Promise.resolve((doc[prefixed ? 'webkitFullscreenElement' : 'fullscreenElement'] = null));
  if (prefixed) {
    delete doc.fullscreenElement;
    doc.webkitFullscreenEnabled = enabled;
    root.webkitRequestFullscreen = enter;
    doc.webkitExitFullscreen = leave;
  } else {
    doc.fullscreenEnabled = enabled;
    root.requestFullscreen = enter;
    doc.exitFullscreen = leave;
  }
  doc.documentElement = root;
  return doc;
}

test('full screen is offered only where the browser has it', () => {
  assert.equal(canFullscreen(fakeDoc()), true);
  assert.equal(canFullscreen(fakeDoc({ prefixed: true })), true, 'older Safari, prefixed');
  assert.equal(canFullscreen(fakeDoc({ enabled: false })), false, 'turned off (an iframe without allowfullscreen)');
  assert.equal(canFullscreen({ documentElement: {} }), false, 'iPhone Safari: no API at all');
  assert.equal(canFullscreen(null), false);
});

test('the switch turns full screen on and off, and reports the real state', async () => {
  for (const prefixed of [false, true]) {
    const doc = fakeDoc({ prefixed });
    assert.equal(isFullscreen(doc), false);
    assert.equal(await setFullscreen(doc, true), true);
    assert.equal(isFullscreen(doc), true);
    assert.equal(await setFullscreen(doc, true), true, 'on again stays on');
    assert.equal(await toggleFullscreen(doc), false);
    assert.equal(isFullscreen(doc), false);
    assert.equal(await setFullscreen(doc, false), false, 'off again stays off');
  }
});

test('a refused request leaves it off without throwing', async () => {
  const doc = fakeDoc({ refuse: true });
  assert.equal(await setFullscreen(doc, true), false);
  assert.equal(await setFullscreen({ documentElement: {} }, true), false, 'no API: nothing happens');
});
