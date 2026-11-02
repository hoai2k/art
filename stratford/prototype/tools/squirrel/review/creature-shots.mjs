// node stratford/prototype/tools/squirrel/review/creature-shots.mjs <outDir> [creature ...]
// For each creature (default: beaver rabbit swan heron) renders, on the bench (lab/squirrel.html,
// the stand-in yard): a turnaround (side / top / 3-4 / front, idle) and a strip of 6 frames for
// each of its gaits and actions, followed side-on; then review/boards.py-style boards per creature:
// <out>/<creature>_turnaround.png and <out>/<creature>_gaits.png.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || '/tmp/creatures-review';
const KINDS = process.argv.length > 3 ? process.argv.slice(3) : ['beaver', 'rabbit', 'swan', 'heron'];
mkdirSync(OUT, { recursive: true });
const { launch, serve } = await import(pathToFileURL(join(HERE, '../../../../../shared/test/lib.mjs')).href);
const srv = await serve(join(HERE, '../../../game'));
const browser = await launch();

// per creature: [name, spawn, steps]; a step is [frames to run, controls, frames per shot (0 = none)]
const E = (y = 0) => ({ x: -18, y, z: 18, yaw: -Math.PI / 2 });                  // open grass, facing east
const POND = { x: 7.6, y: 0, z: -3, yaw: -Math.PI / 2 };                           // west of the pond, facing east
const ACTIONS = {
  beaver: [
    ['walk', E(), [[40, { move: [0, 0.7] }, 0], [36, { move: [0, 0.7] }, 6]]],
    ['gallop', E(), [[60, { move: [0, 1], sprint: 1 }, 0], [24, { move: [0, 1], sprint: 1 }, 4]]],
    ['swim', POND, [[150, { move: [0, 0.8] }, 0], [36, { move: [0, 0.6] }, 6]]],
    ['dive', POND, [[150, { move: [0, 0.8] }, 0], [2, { jump: true, jumpPressed: true }, 0], [48, { move: [0, 0.5] }, 8]]],
    ['gnaw', E(), [[30, {}, 0], [2, { digPressed: true }, 0], [60, {}, 10]]],
    ['standup', E(), [[30, {}, 0], [2, { sitPressed: true }, 0], [48, {}, 8]]],
  ],
  rabbit: [
    ['hop', E(), [[40, { move: [0, 0.45] }, 0], [24, { move: [0, 0.45] }, 4]]],
    ['bound', E(), [[60, { move: [0, 1], sprint: 1 }, 0], [12, { move: [0, 1], sprint: 1 }, 2]]],
    ['jump', E(), [[30, { move: [0, 1] }, 0], [2, { move: [0, 1], jump: true, jumpPressed: true }, 0], [36, { move: [0, 1], jump: true }, 6]]],
    ['standtall', E(), [[30, {}, 0], [2, { sitPressed: true }, 0], [48, {}, 8]]],
    ['groom', E(), [[30, {}, 0], [2, { digPressed: true }, 0], [60, {}, 10]]],
    ['freeze', E(), [[30, {}, 0], [600, {}, 100]]],
    ['swim', { x: 8.3, y: 0, z: -3, yaw: -Math.PI / 2 }, [[70, { move: [0, 0.6] }, 0], [180, {}, 30]]],
  ],
  swan: [
    ['walk', E(), [[40, { move: [0, 0.8] }, 0], [48, { move: [0, 0.8] }, 8]]],
    ['preen', E(), [[30, {}, 0], [2, { digPressed: true }, 0], [60, {}, 10]]],
    ['swim', { x: 10.5, y: 0, z: -3, yaw: -Math.PI / 2 }, [[60, { move: [0, 0.6] }, 0], [48, { move: [0, 0.6] }, 8]]],
    ['takeoff', E(), [[100, { move: [0, 1], jump: true }, 0], [48, { move: [0, 1], jump: true }, 8]]],
    ['fly', E(), [[170, { move: [0, 1], jump: true }, 0], [30, { move: [0, 1], jump: true }, 5]]],
    ['glide', E(), [[200, { move: [0, 1], jump: true }, 0], [60, { move: [0, 1] }, 10]]],
    // take off, climb a little, then glide down with the stick back: the strip keeps the frames
    // around the touchdown ('touchdown' steps keep a rolling buffer and stop just after landing)
    ['landing', E(), [[110, { move: [0, 1], jump: true }, 0], [25, { move: [0, 1], jump: true }, 0], [900, { move: [0, -0.5] }, 6, 'touchdown']]],
  ],
  heron: [
    ['walk', E(), [[40, { move: [0, 0.8] }, 0], [60, { move: [0, 0.8] }, 10]]],
    ['stalk', E(), [[40, { move: [0, 0.3] }, 0], [60, { move: [0, 0.3] }, 10]]],
    ['wade', POND, [[200, { move: [0, 1] }, 0], [60, { move: [0, 0.4] }, 10]]],
    ['strike', E(), [[30, {}, 0], [2, { digPressed: true }, 0], [72, {}, 12]]],
    ['takeoff', E(), [[2, { jump: true, jumpPressed: true }, 0], [24, { jump: true, move: [0, 1] }, 4]]],
    ['fly', E(), [[2, { jump: true, jumpPressed: true }, 0], [90, { jump: true, move: [0, 1] }, 0], [30, { jump: true, move: [0, 1] }, 5]]],
    ['glide', E(), [[2, { jump: true, jumpPressed: true }, 0], [90, { jump: true, move: [0, 1] }, 0], [60, { move: [0, 1] }, 10]]],
  ],
};

for (const kind of KINDS) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', (e) => console.log(kind, 'pageerror', e.message));
  await page.goto(`${srv.url}/lab/squirrel.html?review=1&creature=${kind}`);
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
  await page.addStyleTag({ content: '#panel, #help { display: none !important; }' });
  const shots = await page.evaluate(async ([actions]) => {
    const L = window.__lab, T = L.THREE, sq = L.squirrel, W = L.world, cam = L.camera;
    L.paused = true;
    const s = sq.scale, out = {};
    const ctrlCam = new T.PerspectiveCamera();
    const aimEast = () => { ctrlCam.position.set(-40, 1, 18); ctrlCam.lookAt(10, 1, 18); ctrlCam.updateMatrixWorld(); };
    const c0 = { move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false, zoom: 0, boost: 0 };
    const view = (dir, dist, up = [0, 1, 0], h = 0.3) => {
      const p = sq.position;
      const tgt = new T.Vector3(p.x, p.y + h * s, p.z);
      cam.position.set(tgt.x + dir[0] * dist, tgt.y + dir[1] * dist, tgt.z + dir[2] * dist);
      cam.up.set(...up); cam.lookAt(tgt); cam.fov = 30; cam.near = 0.01; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      W.update(0, cam, p); L.renderer.render(L.scene, cam);
      return L.renderer.domElement.toDataURL('image/png');
    };
    // turnaround
    sq.reset({ x: -14, y: 0, z: 18, yaw: -Math.PI / 2 }); aimEast();
    for (let i = 0; i < 60; i++) sq.update(1 / 60, c0, W, ctrlCam);
    const D = 3.0 * s, H = sq.kind === 'heron' || sq.kind === 'swan' ? 0.45 : 0.3;
    out.turn = [view([0, 0.05, 1], D, [0, 1, 0], H), view([0, 1, 0.0001], D * 1.1, [1, 0, 0], H), view([0.7, 0.35, 0.65], D, [0, 1, 0], H), view([1, 0.12, 0], D, [0, 1, 0], H)];
    // actions
    for (const [name, spawn, steps] of actions) {
      sq.reset(spawn); aimEast();
      if (spawn.x > 5) { ctrlCam.position.set(spawn.x - 20, 1, spawn.z); ctrlCam.lookAt(spawn.x + 20, 1, spawn.z); ctrlCam.updateMatrixWorld(); }
      sq.update(1 / 60, c0, W, ctrlCam);
      out[name] = [];
      for (const [n, ctl, every, mode] of steps) {
        const ring = []; let after = -1, flew = false;
        for (let i = 0; i < n; i++) {
          sq.update(1 / 60, { ...c0, ...ctl, jumpPressed: !!ctl.jumpPressed && i === 0, sitPressed: !!ctl.sitPressed && i === 0, digPressed: !!ctl.digPressed && i === 0 }, W, ctrlCam);
          const snap = () => view(['swim', 'dive'].includes(sq.state) || sq.controller.wading ? [0, 0.45, 1] : [0, 0.08, 1], (sq.state === 'fly' ? 5 : 3.0) * s, [0, 1, 0], H);
          if (mode === 'touchdown') {
            flew ||= sq.state === 'fly';
            if (after < 0 && flew && sq.state !== 'fly') after = 3;
            if ((i + 1) % every === 0) { ring.push(snap()); if (after < 0 && ring.length > 4) ring.shift(); if (after >= 0 && --after === 0) break; }
          } else if (every && (i + 1) % every === 0) out[name].push(snap());
        }
        out[name].push(...ring);
      }
    }
    return out;
  }, [ACTIONS[kind]]);
  for (const [k, list] of Object.entries(shots)) list.forEach((u, i) => writeFileSync(join(OUT, `${kind}_${k}_${i}.png`), Buffer.from(u.split(',')[1], 'base64')));
  await page.close();
  execFileSync('python3', [join(HERE, 'creature-boards.py'), OUT, kind, ...Object.keys(shots).filter((k) => k !== 'turn')], { stdio: 'inherit' });
}
await browser.close(); srv.close();
