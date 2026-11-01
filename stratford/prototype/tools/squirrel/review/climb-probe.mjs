// node stratford/prototype/tools/squirrel/review/climb-probe.mjs [count] [skip]
// Climbs real downtown buildings headlessly (lab/squirrel.html?town=1) with scripted stick input:
// straight up and top out, diagonally toward corners, sideways along the wall, up then down, and
// roaming the roof with jumps. Flags any frame where the squirrel is inside a building footprint
// (more than 8 cm in from its outline) below the eaves, and any frame where the follow camera is
// inside a footprint below the eaves. Prints one line per bad run with a short trace.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { launch, serve } = await import(pathToFileURL(join(HERE, '../../../../../shared/test/lib.mjs')).href);
const N = +(process.argv[2] || 30), SKIP = +(process.argv[3] || 0);
const srv = await serve(join(HERE, '../../../game'));
const b = await launch();
const page = await b.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(srv.url + '/lab/squirrel.html?town=1&test=1');
await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 300000 });
const res = await page.evaluate(async ([N, SKIP]) => {
  const L = window.__lab, T = L.THREE, W = L.world, sq = L.squirrel;
  L.paused = true;
  const ctrlCam = new T.PerspectiveCamera(55, 16 / 9, 0.02, 500);
  const follow = L.cam;               // the real follow camera, driving L.camera
  const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const edgeDist = (x, z, poly) => { let d = 1e9; for (let e = 0; e < poly.length; e++) { const A = poly[e], C = poly[(e + 1) % poly.length]; const vx = C[0] - A[0], vz = C[1] - A[1]; const t = Math.max(0, Math.min(1, ((x - A[0]) * vx + (z - A[1]) * vz) / (vx * vx + vz * vz))); d = Math.min(d, Math.hypot(x - A[0] - vx * t, z - A[1] - vz * t)); } return d; };
  const inside = (p, nb, margin) => { for (const q of nb) { if (!pip(p.x, p.z, q.outer)) continue; const eav = q.base + q.height; if (p.y < eav - 0.2 && p.y > q.base + 0.1 && edgeDist(p.x, p.z, q.outer) > margin) return { id: q.id, eav: +eav.toFixed(2), dIn: +edgeDist(p.x, p.z, q.outer).toFixed(2) }; } return null; };
  const sp = W.spawn;
  const blds = W.data.buildings.filter((q) => q.height > 3 && ['brick_red', 'brick_buff', 'stone', 'clapboard'].includes(q.material))
    .map((q) => ({ q, d: Math.hypot(q.outer[0][0] - sp.x, q.outer[0][1] - sp.z) })).sort((a, b) => a.d - b.d).slice(SKIP, SKIP + N).map((o) => o.q);
  const near = (x, z) => W.data.buildings.filter((q) => Math.abs(q.outer[0][0] - x) < 90 && Math.abs(q.outer[0][1] - z) < 90);
  const out = [];
  const scen = [[0, 1], [0.7, 0.7], [-0.7, 0.7], [1, 0.25], [0, 1, 'down'], [0, 1, 'roam']];
  let k = 0;
  for (const B of blds) {
    let best = 0, bi = 0;
    for (let i = 0; i < B.outer.length; i++) { const a = B.outer[i], c = B.outer[(i + 1) % B.outer.length]; const l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l > best) { best = l; bi = i; } }
    for (const ei of [bi, (bi + 1) % B.outer.length, (bi + 2) % B.outer.length]) {
      const a = B.outer[ei], c = B.outer[(ei + 1) % B.outer.length];
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ex = c[0] - a[0], ez = c[1] - a[1], el = Math.hypot(ex, ez);
      if (el < 2) continue;
      let nx = ez / el, nz = -ex / el;
      if (pip(mx + nx * 0.3, mz + nz * 0.3, B.outer)) { nx = -nx; nz = -nz; }
      const sx = mx + nx * 1.0, sz = mz + nz * 1.0;
      const nb = near(sx, sz);
      if (nb.some((q) => pip(sx, sz, q.outer))) continue;            // a party wall: start is in a neighbour
      await W.ready({ x: sx, y: 0, z: sz });
      const g = W.raycast(new T.Vector3(sx, W.groundAt(sx, sz) + 3, sz), new T.Vector3(0, -1, 0), 6);
      if (!g || g.normal.y < 0.7 || g.point.y > W.groundAt(sx, sz) + 0.6) continue;
      const sc = scen[k++ % scen.length];
      sq.reset({ x: sx, y: g.point.y, z: sz, yaw: Math.atan2(nx, nz) });
      ctrlCam.position.set(sx + nx * 1.5, g.point.y + 0.6, sz + nz * 1.5); ctrlCam.lookAt(mx, g.point.y + 0.5, mz); ctrlCam.updateMatrixWorld();
      follow.snapBehind();
      const rec = { id: B.id, mat: B.material, roof: B.roof, h: B.height, sc: sc.join(','), climbed: false, onRoof: false, bad: null, cam: null };
      const trace = [];
      for (let i = 0; i < 60 * 9; i++) {
        let mv = [sc[0], sc[1]];
        if (sc[2] === 'down' && i > 60 * 2.5) mv = [0, -1];
        if (sc[2] === 'roam' && i > 60 * 4) { const t = i / 60; mv = [Math.sin(t * 1.3), Math.cos(t * 0.9)]; }
        const jp = sc[2] === 'roam' && i % 97 === 0;
        const controls = { move: mv, look: [0, 0], jump: jp, jumpPressed: jp, sprint: i % 200 < 60 ? 1 : 0, sitPressed: false, digPressed: false, recenter: false };
        sq.update(1 / 60, controls, W, ctrlCam);
        follow.update(1 / 60, controls);
        if (i % 30 === 0) W.update(0.5, ctrlCam, sq.position);
        const p = sq.position;
        trace.push([i, sq.state, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), sq.controller.up.toArray().map((v) => +v.toFixed(2)).join('/')]);
        if (trace.length > 30) trace.shift();
        if (sq.state === 'climb') rec.climbed = true;
        if (sq.state !== 'climb' && p.y > B.base + B.height - 0.3) rec.onRoof = true;
        const bad = inside(p, nb, 0.08);
        if (bad && !rec.bad) rec.bad = { i, ...bad, p: p.toArray().map((v) => +v.toFixed(2)), state: sq.state, trace: trace.slice() };
        const cb = inside(L.camera.position, nb, 0.0);
        if (cb && !rec.cam) rec.cam = { i, ...cb, cam: L.camera.position.toArray().map((v) => +v.toFixed(2)), sq: p.toArray().map((v) => +v.toFixed(2)), state: sq.state };
      }
      out.push(rec);
    }
  }
  return out;
}, [N, SKIP]);
let bad = 0, cam = 0;
for (const r of res) {
  if (r.bad) { bad++; console.log('BODY', JSON.stringify({ ...r, cam: undefined })); }
  if (r.cam) { cam++; console.log('CAM ', JSON.stringify({ id: r.id, sc: r.sc, cam: r.cam })); }
}
console.log(`runs ${res.length}  body-inside ${bad}  camera-inside ${cam}  climbed ${res.filter((r) => r.climbed).length}  topped-out ${res.filter((r) => r.onRoof).length}`);
await b.close(); srv.close();
