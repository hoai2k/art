// node stratford/prototype/tools/squirrel/review/shots.mjs [outDir]
// Renders the squirrel from the bench page (lab/squirrel.html) with Playwright: a turnaround
// (side / top / 3-4 / front, next to the reference sheet), a gait strip (walk, half-bound,
// bound: frames across one stride, seen side-on) and an actions strip (jump, climb, sit, dig,
// swim). Writes PNGs to outDir (default $REVIEW_DIR or the system temp dir).
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, '../../../game');
const OUT = process.argv[2] || process.env.REVIEW_DIR || join(os.tmpdir(), 'squirrel-review');
mkdirSync(OUT, { recursive: true });
const { launch, serve } = await import(pathToFileURL(join(HERE, '../../../../../shared/test/lib.mjs')).href);
const srv = await serve(GAME);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(srv.url + '/lab/squirrel.html?review=1&coat=' + (process.env.COAT || 'black'));
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 60000 });
await page.addStyleTag({ content: '#panel, #help { display: none !important; }' });

// helpers in the page
await page.evaluate(() => {
  const L = window.__lab, T = L.THREE;
  L.paused = true;
  L.ctrlCam = new T.PerspectiveCamera();
  L.aim = (from, to) => { L.ctrlCam.position.set(...from); L.ctrlCam.lookAt(...to); L.ctrlCam.updateMatrixWorld(); };
  L.step = (n, controls, dt = 1 / 60) => {
    const c0 = { move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false };
    for (let i = 0; i < n; i++) {
      const c = { ...c0, ...(typeof controls === 'function' ? controls(i) : controls) };
      L.squirrel.update(dt, c, L.world, L.ctrlCam);
    }
  };
  L.view = (dir, dist, up = [0, 1, 0], h = 0.07) => {
    const p = L.squirrel.position, cam = L.camera;
    const tgt = new T.Vector3(p.x, p.y + h, p.z);
    cam.position.set(tgt.x + dir[0] * dist, tgt.y + dir[1] * dist, tgt.z + dir[2] * dist);
    cam.up.set(...up); cam.lookAt(tgt); cam.fov = 30; cam.near = 0.01; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    L.world.update(0, cam, p);
    L.renderer.render(L.scene, cam);
    return L.renderer.domElement.toDataURL('image/png');
  };
  L.viewAt = (tgt, dir, dist, up = [0, 1, 0]) => {
    const cam = L.camera; const t = new T.Vector3(...tgt);
    cam.position.set(t.x + dir[0] * dist, t.y + dir[1] * dist, t.z + dir[2] * dist);
    cam.up.set(...up); cam.lookAt(t); cam.fov = 30; cam.near = 0.01; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    L.world.update(0, cam, L.squirrel.position); L.renderer.render(L.scene, cam);
    return L.renderer.domElement.toDataURL('image/png');
  };
});
const save = (name, url) => writeFileSync(join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));

// ---- turnaround: standing idle on open grass facing east (+x)
const turn = await page.evaluate(() => {
  const L = window.__lab;
  L.squirrel.reset({ x: -16, y: 0, z: 16, yaw: -Math.PI / 2 });
  L.step(90, {});
  // facing +x: side view from -z... the squirrel's left side is +z when facing +x? (left = +x of the model, facing +z)
  return [L.view([0, 0.05, 1], 0.62), L.view([0, 1, 0.0001], 0.7, [1, 0, 0], 0.05), L.view([0.7, 0.35, 0.65], 0.6), L.view([1, 0.12, 0], 0.6)];
});
turn.forEach((u, i) => save(`turn_${i}.png`, u));

// ---- gaits: run at a steady speed and grab frames across ~one stride, side-on
async function gait(name, stick, sprint, frames, every) {
  const shots = await page.evaluate(([stick, sprint, frames, every]) => {
    const L = window.__lab, out = [];
    L.squirrel.reset({ x: -18, y: 0, z: 18, yaw: -Math.PI / 2 });
    L.aim([-30, 1, 18], [10, 1, 18]);   // stick up = east
    L.step(70, { move: [0, stick], sprint });
    for (let f = 0; f < frames; f++) { L.step(every, { move: [0, stick], sprint }); out.push(L.view([0, 0.05, 1], 0.7)); }
    return out;
  }, [stick, sprint, frames, every]);
  shots.forEach((u, i) => save(`gait_${name}_${i}.png`, u));
}
// the lab camera decides "forward": point it east before each run
await gait('walk', 0.32, 0, 6, 4);
await gait('half', 0.6, 0, 6, 2);
await gait('bound', 1, 1, 6, 1);

// ---- actions
const act = await page.evaluate(() => {
  const L = window.__lab, out = {};
  const east = () => L.aim([-30, 1, 18], [10, 1, 18]);
  // jump: run, leap, frames through the arc
  L.squirrel.reset({ x: -18, y: 0, z: 18, yaw: -Math.PI / 2 }); east();
  L.step(40, { move: [0, 1] });
  out.jump = [];
  L.step(1, { move: [0, 1], jump: true, jumpPressed: true });
  for (let f = 0; f < 6; f++) { east(); L.step(6, { move: [0, 1], jump: true }); out.jump.push(L.view([0, 0.1, 1], 1.2, [0, 1, 0], 0.07)); }
  // climb the brick wall (north face at z = -14): seen from the side
  L.squirrel.reset({ x: 4, y: 0, z: -11, yaw: 0 });
  const north = () => L.aim([4, 1, 0], [4, 1, -20]);
  north(); L.step(60, { move: [0, 1] });
  out.climb = [L.view([1, 0.1, 0.6], 1.0), L.view([0, 0.1, 1], 1.0)];
  north(); L.step(120, { move: [0, -1] }); out.climb.push(L.view([1, 0.1, 0.6], 1.0));
  // sit, dig, swim
  L.squirrel.reset({ x: -16, y: 0, z: 16, yaw: -Math.PI / 2 }); east(); L.step(30, {});
  L.step(1, { sitPressed: true }); L.step(60, {}); out.sit = [L.view([0, 0.05, 1], 0.95), L.view([0.7, 0.3, 0.6], 0.95)];
  L.step(1, { move: [0, 0.4] }); L.step(30, {});
  L.step(1, { digPressed: true }); L.step(40, {}); out.dig = [L.view([0, 0.05, 1], 0.95)];
  L.squirrel.reset({ x: 10.5, y: 0, z: -3, yaw: -Math.PI / 2 });
  L.aim([0, 1, -3], [20, 1, -3]);
  L.step(80, { move: [0, 0.8] }); out.swim = [L.view([0, 0.2, 1], 1.0)];
  return out;
});
for (const [k, list] of Object.entries(act)) list.forEach((u, i) => save(`act_${k}_${i}.png`, u));
await browser.close(); srv.close();

// contact sheets (Python/Pillow)
execFileSync('python3', [join(HERE, 'boards.py'), OUT], { stdio: 'inherit' });
console.log('wrote', OUT);
