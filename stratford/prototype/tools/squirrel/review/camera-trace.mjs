// node stratford/prototype/tools/squirrel/review/camera-trace.mjs <out.json> [town]
// Records the follow camera over scripted runs in the bench (lab/squirrel.html; the stand-in
// yard, or the real town with `town`), each at three frame rates, and writes per-frame traces
// plus summary numbers: camera acceleration (frame-to-frame jerk), look-direction jumps, yaw and
// pitch changes with and without stick input, distance pops (collision pull-in / release), the
// closest the camera gets to the squirrel, and how much the path depends on the frame rate.
// Reads only the three.js camera and the squirrel, so it measures any camera version.
// Plot with review/camera-plot.py.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { launch, serve } = await import(pathToFileURL(join(HERE, '../../../../../shared/test/lib.mjs')).href);
const OUT = process.argv[2] || 'camera-trace.json';
const TOWN = process.argv.includes('town');
const GAME = process.env.GAME_DIR || join(HERE, '../../../game');
const srv = await serve(GAME);
const b = await launch();
const page = await b.newPage({ viewport: { width: 400, height: 260 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(srv.url + '/lab/squirrel.html?test=1' + (TOWN ? '&town=1' : ''));
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 300000 });

const res = await page.evaluate(async (TOWN) => {
  const L = window.__lab, T = L.THREE, W = L.world, sq = L.squirrel, cam = L.cam, camera = L.camera;
  L.paused = true;
  const idle = { move: [0, 0], look: [0, 0], jump: false, jumpPressed: false, sprint: 0, sitPressed: false, digPressed: false, recenter: false, zoom: 0 };
  // spawn points: the yard's open grass / the town's spawn street
  const SP = TOWN ? { x: W.spawn.x, y: W.spawn.y, z: W.spawn.z, yaw: W.spawn.yaw } : { x: -14, y: 0, z: 18, yaw: -Math.PI / 2 };
  const WALL = TOWN ? null : { x: 4, y: 0, z: -11, yaw: 0 };
  const S = {
    straight: { spawn: SP, dur: 3, c: (t) => ({ move: [0, 1], sprint: t > 1 ? 1 : 0 }) },
    turns: { spawn: TOWN ? SP : { x: -15, y: 0, z: 21, yaw: 0 }, dur: 4, c: (t) => ({ move: [Math.sin(t * 3.2) > 0 ? 0.9 : -0.9, 0.5], sprint: 0.5 }) },
    stopstart: { spawn: SP, dur: 4, c: (t) => ({ move: [0, (t % 1.2) < 0.6 ? 1 : 0] }) },
    jumps: { spawn: SP, dur: 4, c: (t, i, dt) => { const ph = t % 0.9; return { move: [0, 1], jump: ph < 0.45, jumpPressed: ph < dt * 0.999 }; } },
    stickHeld: { spawn: SP, dur: 3, c: (t, i, dt) => ({ move: [0, 0.8], look: [t < 1.5 ? 1.8 * dt : 0, 0] }) },
    lookUp: { spawn: SP, dur: 4, c: (t, i, dt) => ({ move: [0, t > 1 ? 1 : 0], look: [0, t < 0.5 ? 0.6 * dt : 0] }) },
    ...(WALL ? { climb: { spawn: WALL, dur: 2.8, c: () => ({ move: [0, 1] }) } } : {}),
    ...(WALL ? { overEdge: { spawn: WALL, dur: 4.5, c: () => ({ move: [0, 1] }) } } : {}),
    ...(TOWN ? { street: { spawn: SP, dur: 8, c: (t) => ({ move: [Math.sin(t * 0.7) * 0.35, 1], sprint: 1 }) } } : {}),
  };
  const out = {};
  for (const [name, sc] of Object.entries(S)) {
    out[name] = {};
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      if (TOWN) await W.ready(sc.spawn);
      sq.reset(sc.spawn);
      sq.update(1e-3, idle, W, camera);
      cam.snapBehind();
      if (Object.getOwnPropertyDescriptor(cam, 'pitch')?.set) cam.pitch = sq.tuning.camPitch;   // each run from the default pitch
      if (Object.getOwnPropertyDescriptor(cam, 'zoom')?.set) cam.zoom = 0;
      for (let k = 0; k < 3; k++) cam.update(1 / 60, idle);       // settle
      const fr = [];
      const n = Math.round(sc.dur / dt);
      const dir = new T.Vector3();
      for (let i = 0; i < n; i++) {
        const t = i * dt;
        const c = { ...idle, ...sc.c(t, i, dt) };
        sq.update(dt, c, W, camera);
        cam.update(dt, c);
        W.update(dt, camera, sq.position);
        camera.getWorldDirection(dir);
        const p = camera.position, q = sq.position;
        const centre = q.clone().addScaledVector(sq.controller.up, 0.04);
        fr.push([+(t + dt).toFixed(5), +p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4),
          +Math.atan2(-dir.x, -dir.z).toFixed(5), +Math.asin(-dir.y).toFixed(5),
          +p.distanceTo(centre).toFixed(4), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4),
          Math.abs(c.look[0]) + Math.abs(c.look[1]) > 0 ? 1 : 0, sq.state, +camera.fov.toFixed(2),
          cam.debug ? [+cam.debug.free.toFixed(3), +cam.debug.dist.toFixed(3), +(cam.debug.bend || 0).toFixed(3), cam.debug.cuts || 0, cam.debug.focus.toArray().map((v) => +v.toFixed(3))] : null]);
      }
      out[name][Math.round(1 / dt)] = fr;
    }
  }
  return out;
}, TOWN);
await b.close(); srv.close();

// ---- metrics
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const summary = {};
for (const [name, runs] of Object.entries(res)) {
  summary[name] = {};
  for (const [fps, fr] of Object.entries(runs)) {
    const dt = 1 / fps, acc = [], yawAcc = [], lookStep = [], pitchDrift = [], distRate = [], yawFight = [];
    let pitchFree = 0, minDist = 1e9;
    for (let i = 2; i < fr.length; i++) {
      const [a, b, c] = [fr[i - 2], fr[i - 1], fr[i]];
      acc.push(Math.hypot(c[1] - 2 * b[1] + a[1], c[2] - 2 * b[2] + a[2], c[3] - 2 * b[3] + a[3]) / dt / dt);
      yawAcc.push(Math.abs(wrap(c[4] - b[4]) - wrap(b[4] - a[4])) / dt / dt);
      lookStep.push(Math.hypot(wrap(c[4] - b[4]), c[5] - b[5]) / dt);
      if (!c[10] && c[11] !== 'climb') pitchFree += Math.abs(c[5] - b[5]);
      distRate.push(Math.abs(c[6] - b[6]) / dt);
      minDist = Math.min(minDist, c[6]);
    }
    summary[name][fps] = {
      camAccP50: +pct(acc, 0.5).toFixed(2), camAccP99: +pct(acc, 0.99).toFixed(1), camAccMax: +Math.max(...acc).toFixed(1),
      yawAccP99: +pct(yawAcc, 0.99).toFixed(1), yawAccMax: +Math.max(...yawAcc).toFixed(1),
      lookRateMax: +Math.max(...lookStep).toFixed(2),
      distRateMax: +Math.max(...distRate).toFixed(2), distRateP99: +pct(distRate, 0.99).toFixed(2),
      pitchDriftNoInput: +pitchFree.toFixed(3), minDist: +minDist.toFixed(3),
    };
  }
  // frame-rate dependence: camera position at common times vs the 144 fps run
  const ref = runs[144];
  for (const fps of [30, 60]) {
    let dev = 0;
    for (const f of runs[fps]) {
      const r = ref.reduce((best, x) => (Math.abs(x[0] - f[0]) < Math.abs(best[0] - f[0]) ? x : best));
      if (Math.abs(r[0] - f[0]) < 0.004) dev = Math.max(dev, Math.hypot((r[1] - r[7]) - (f[1] - f[7]), (r[2] - r[8]) - (f[2] - f[8]), (r[3] - r[9]) - (f[3] - f[9])));   // the camera's offset from the squirrel
    }
    summary[name][fps].dtDevVs144 = +dev.toFixed(3);
  }
}
writeFileSync(OUT, JSON.stringify({ town: TOWN, summary, traces: res }));
for (const [name, s] of Object.entries(summary)) for (const [fps, m] of Object.entries(s)) console.log(name.padEnd(10), String(fps).padStart(3), JSON.stringify(m));
