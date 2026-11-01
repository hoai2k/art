// The mobile camera: on a phone the 1280x720 stage is small, so while the
// player has the scene in hand the camera eases in a little toward him and
// follows him, and it eases back out to the whole stage for everything else:
// a scene's opening and close, cutscenes, the witch's and Aurora's passes,
// cards and menus. Desktops and tablets always see the whole stage, and
// Settings > Mobile camera turns it off. Headless (no DOM): main.js says
// whether it applies and what the act is doing; src/art.js draws through it.
//
// It only ever shows part of the stage, never past its edges, so the painted
// frame, the HUD and the captions (drawn outside it) stay where they are.

export const CAMERA = {
  zoom: 1.3,        // how far in, on a phone, while the player moves
  settle: 1.1,      // s of play in a scene before it goes in (the scene is set first)
  inRate: 1.5,      // easing in (per s): about 2 s to arrive, unhurried
  outRate: 3.2,     // easing out: about 1 s, so a cutscene is seen whole
  follow: 3.0,      // how quickly it follows him (per s)
  lead: 70,         // stage px it looks ahead of him as he travels
};
const W = 1280, H = 720;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The camera centre that keeps a z-times view inside the stage.
export function clampView(z, x, y) {
  const hw = W / 2 / z, hh = H / 2 / z;
  return { x: clamp(x, hw, W - hw), y: clamp(y, hh, H - hh) };
}

export function createCamera() {
  const cam = { z: 1, x: W / 2, y: H / 2 };
  let liveT = 0, key = '', last = null, lead = 0;

  return {
    view: cam,
    // Back to the whole stage at once (a new act, a retry, the title).
    reset() { cam.z = 1; cam.x = W / 2; cam.y = H / 2; liveT = 0; key = ''; last = null; lead = 0; },
    // enabled: a phone, with the setting on. live: the player has the scene
    // (not a cutscene, outro or ending). scene: changes with each new scene,
    // so each is set on the whole stage first. focus: his middle, stage px,
    // or null for the whole stage.
    update(dt, { enabled, live, scene, focus }) {
      if (scene !== key) { key = scene; liveT = 0; }
      // it goes in only once he has had the scene a moment, and comes back
      // out at once for anything else (so it never flickers in and out)
      liveT = live && focus ? liveT + dt : 0;
      const zoomIn = enabled && live && focus && liveT >= CAMERA.settle;
      const target = zoomIn ? CAMERA.zoom : 1;
      const rate = target > cam.z ? CAMERA.inRate : CAMERA.outRate;
      cam.z += (target - cam.z) * (1 - Math.exp(-rate * dt));
      if (Math.abs(cam.z - target) < 0.001) cam.z = target;
      // Follow him, looking a little ahead the way he travels; zooming out,
      // drift back to the middle (the clamp does that as z reaches 1).
      if (focus) {
        if (last && dt > 0) {
          const vx = (focus.x - last.x) / dt;
          const want = Math.abs(vx) > 40 ? Math.sign(vx) * CAMERA.lead : lead * 0.98;
          lead += (want - lead) * (1 - Math.exp(-1.5 * dt));
        }
        last = { x: focus.x, y: focus.y };
      } else { last = null; lead *= 0.9; }
      const aim = focus && zoomIn ? { x: focus.x + lead, y: focus.y } : { x: cam.x, y: cam.y };
      const want = clampView(cam.z, aim.x, aim.y);
      const k = 1 - Math.exp(-CAMERA.follow * dt);
      const held = clampView(cam.z, cam.x + (want.x - cam.x) * k, cam.y + (want.y - cam.y) * k);
      cam.x = held.x; cam.y = held.y;
      return cam;
    },
  };
}
