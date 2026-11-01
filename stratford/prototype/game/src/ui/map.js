// The map and journal: a painted parchment map drawn from town.json (roads,
// buildings, water, parks), with the squirrel, painted pins for the landmarks
// found and a list of landmarks found and not yet found. Pan and zoom with the
// sticks, keys, mouse drag and wheel, or a finger and a pinch.

import { BTN } from '../input.js';

const $ = (s) => document.querySelector(s);

const GREENS = { park: '#b9c98a', grass: '#c6d39a', garden: '#aebf7c', wood: '#93ad71', pitch: '#bccb86', cemetery: '#b4c28a' };

const bboxOf = (pts) => {
  let x0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let z1 = -Infinity;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return [x0, z0, x1, z1];
};

function mulberry(seed) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createMap({ input, exploration, getPlayer, getTown, parchmentUrl = null }) {
  const view = $('#map-view');
  const canvas = $('#map-canvas');
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const paper = document.createElement('canvas');
  let paperImg = null;
  let paperSize = '';
  let town = null; // prepared town data
  let open = false;
  const cam = { x: 0, z: 0, scale: 0.55 };
  let dirty = true;
  let W = 0; let H = 0; let dpr = 1;
  let lastHeading = 0;
  const MIN = 0.1; const MAX = 3.2;

  if (parchmentUrl) {
    const img = new Image();
    img.onload = () => { paperImg = img; paperSize = ''; dirty = true; };
    img.src = parchmentUrl;
  }

  function prepare(raw) {
    if (!raw) return null;
    const t = { raw, areas: [], roads: [], buildings: [], trees: [], rivers: [], waters: [], railways: [], labels: [] };
    for (const a of raw.areas || []) if (a.outer?.length > 2) t.areas.push({ a, box: bboxOf(a.outer) });
    for (const r of raw.roads || []) if (r.points?.length > 1) t.roads.push({ r, box: bboxOf(r.points) });
    for (const b of raw.buildings || []) if (b.outer?.length > 2) t.buildings.push({ b, box: bboxOf(b.outer) });
    for (const w of raw.water?.polygons || []) if (w.outer?.length > 2) t.waters.push({ w, box: bboxOf(w.outer) });
    for (const r of raw.water?.rivers || []) if (r.points?.length > 1) t.rivers.push({ r, box: bboxOf(r.points) });
    for (const r of raw.railways || []) if (r.points?.length > 1) t.railways.push({ r, box: bboxOf(r.points) });
    t.trees = (raw.trees || []).map((tr) => [tr.x, tr.z, tr.crown || 4]);
    // One label per named street: at the middle of its longest piece.
    const best = new Map();
    for (const { r } of t.roads) {
      if (!r.name || !['primary', 'secondary', 'tertiary', 'residential'].includes(r.kind)) continue;
      let len = 0; let bi = 0; let bl = 0;
      for (let i = 1; i < r.points.length; i++) {
        const l = Math.hypot(r.points[i][0] - r.points[i - 1][0], r.points[i][1] - r.points[i - 1][1]);
        len += l; if (l > bl) { bl = l; bi = i; }
      }
      const cur = best.get(r.name);
      if (!cur || bl > cur.bl) {
        const p = r.points[bi - 1]; const q = r.points[bi];
        best.set(r.name, { name: r.name, x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2, ang: Math.atan2(q[1] - p[1], q[0] - p[0]), bl, kind: r.kind });
      }
    }
    t.labels = [...best.values()].filter((l) => l.bl > 35);
    return t;
  }

  function size() {
    const r = view.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width)); const h = Math.max(10, Math.round(r.height));
    if (w * dpr !== canvas.width || h * dpr !== canvas.height) {
      W = w; H = h;
      canvas.width = base.width = Math.round(w * dpr);
      canvas.height = base.height = Math.round(h * dpr);
      dirty = true;
    }
  }

  // The parchment: the delivered painting if there is one, else paper drawn here.
  function drawPaper() {
    const key = `${canvas.width}x${canvas.height}${paperImg ? 'i' : 'p'}`;
    if (key === paperSize) return;
    paperSize = key;
    paper.width = canvas.width; paper.height = canvas.height;
    const c = paper.getContext('2d');
    if (paperImg) { c.drawImage(paperImg, 0, 0, paper.width, paper.height); return; }
    const g = c.createRadialGradient(paper.width / 2, paper.height / 2, paper.height * 0.1, paper.width / 2, paper.height / 2, paper.width * 0.75);
    g.addColorStop(0, '#f1e2b9'); g.addColorStop(0.7, '#e6d2a0'); g.addColorStop(1, '#cdb27a');
    c.fillStyle = g; c.fillRect(0, 0, paper.width, paper.height);
    const rnd = mulberry(7);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${110 + rnd() * 40},${80 + rnd() * 30},40,${rnd() * 0.05})`;
      c.beginPath(); c.arc(rnd() * paper.width, rnd() * paper.height, 1 + rnd() * 18 * dpr, 0, 7); c.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = rnd() * paper.width; const y = rnd() * paper.height; const r = (40 + rnd() * 120) * dpr;
      const sg = c.createRadialGradient(x, y, r * 0.5, x, y, r);
      sg.addColorStop(0, 'rgba(150,100,40,0)'); sg.addColorStop(0.85, 'rgba(150,100,40,0.06)'); sg.addColorStop(1, 'rgba(150,100,40,0)');
      c.fillStyle = sg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  const toScreen = (x, z) => [(x - cam.x) * cam.scale + W / 2, (z - cam.z) * cam.scale + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.scale + cam.x, (sy - H / 2) / cam.scale + cam.z];

  function ring(c, pts) {
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy] = toScreen(pts[i][0], pts[i][1]);
      if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy);
    }
    c.closePath();
  }
  const poly = (c, outer, holes) => { c.beginPath(); ring(c, outer); for (const h of holes || []) ring(c, h); };

  function drawBase() {
    drawPaper();
    const c = bctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(paper, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!town) {
      c.fillStyle = 'rgba(42,29,20,0.7)';
      c.font = 'italic 500 18px Lora, Georgia, serif';
      c.textAlign = 'center';
      c.fillText('The map of town has not been drawn yet.', W / 2, H / 2);
      return;
    }
    const [vx0, vz0] = toWorld(-20, -20); const [vx1, vz1] = toWorld(W + 20, H + 20);
    const vis = (b) => b[2] >= vx0 && b[0] <= vx1 && b[3] >= vz0 && b[1] <= vz1;
    const s = cam.scale;
    c.lineJoin = 'round'; c.lineCap = 'round';

    // Land use.
    for (const { a, box } of town.areas) {
      if (!vis(box) || a.kind === 'water') continue;
      poly(c, a.outer, a.holes);
      c.fillStyle = GREENS[a.kind] || (a.kind === 'parking' ? '#d8cdb0' : a.kind === 'plaza' ? '#ead8aa' : null) || 'rgba(0,0,0,0)';
      if (a.kind === 'railway') continue;
      c.fill('evenodd');
    }
    // Water.
    c.fillStyle = '#9fc2c4'; c.strokeStyle = '#6f979b'; c.lineWidth = 1.2;
    for (const { w, box } of town.waters) { if (!vis(box)) continue; poly(c, w.outer, w.holes); c.fill('evenodd'); c.stroke(); }
    for (const { a, box } of town.areas) { if (a.kind !== 'water' || !vis(box)) continue; poly(c, a.outer, a.holes); c.fill('evenodd'); c.stroke(); }
    c.strokeStyle = '#9fc2c4';
    for (const { r, box } of town.rivers) {
      if (!vis(box)) continue;
      c.lineWidth = Math.max(2, (r.width || 20) * s);
      c.beginPath(); r.points.forEach(([x, z], i) => { const [sx, sy] = toScreen(x, z); if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy); }); c.stroke();
    }
    // Railways.
    c.strokeStyle = '#7d6a55'; c.lineWidth = Math.max(1, 1.6 * s); c.setLineDash([6, 4]);
    for (const { r, box } of town.railways) { if (!vis(box)) continue; c.beginPath(); r.points.forEach(([x, z], i) => { const [sx, sy] = toScreen(x, z); if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy); }); c.stroke(); }
    c.setLineDash([]);
    // Roads: a dark casing, then a pale fill.
    const major = { primary: 1, secondary: 1, tertiary: 1, residential: 1, service: 1 };
    const stroke = (r, w, col) => {
      c.strokeStyle = col; c.lineWidth = w;
      c.beginPath(); r.points.forEach(([x, z], i) => { const [sx, sy] = toScreen(x, z); if (i) c.lineTo(sx, sy); else c.moveTo(sx, sy); }); c.stroke();
    };
    const vroads = town.roads.filter(({ box }) => vis(box));
    for (const { r } of vroads) if (major[r.kind]) stroke(r, Math.max(2, (r.width || 7) * s + 2), '#8b7355');
    for (const { r } of vroads) if (major[r.kind]) stroke(r, Math.max(1, (r.width || 7) * s), r.kind === 'primary' ? '#fff0c4' : '#fbf3dc');
    c.setLineDash([4, 3]);
    for (const { r } of vroads) if (!major[r.kind]) stroke(r, Math.max(1, 1.8 * s), '#8b6f4e');
    c.setLineDash([]);
    // Trees as soft green dots.
    if (s > 0.3) {
      c.fillStyle = 'rgba(74,107,63,0.45)';
      for (const [x, z, cr] of town.trees) {
        if (x < vx0 || x > vx1 || z < vz0 || z > vz1) continue;
        const [sx, sy] = toScreen(x, z);
        c.beginPath(); c.arc(sx, sy, Math.max(1.5, cr * s * 0.55), 0, 7); c.fill();
      }
    }
    // Buildings.
    c.lineWidth = Math.max(0.6, 0.9);
    for (const { b, box } of town.buildings) {
      if (!vis(box)) continue;
      poly(c, b.outer, b.holes);
      c.fillStyle = b.use === 'church' ? '#b86b52' : b.use === 'civic' || b.use === 'theatre' ? '#c4745a' : b.use === 'residential' ? '#d4a083' : b.use === 'shed' || b.use === 'garage' ? '#cdb89b' : '#cf8e6f';
      c.fill('evenodd');
      c.strokeStyle = 'rgba(70,35,22,0.75)'; c.stroke();
    }
    // Street names along the road.
    if (s > 0.5) {
      c.font = `italic 600 ${Math.min(15, 9 + s * 3)}px Lora, Georgia, serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const l of town.labels) {
        if (l.x < vx0 || l.x > vx1 || l.z < vz0 || l.z > vz1) continue;
        const [sx, sy] = toScreen(l.x, l.z);
        c.save(); c.translate(sx, sy);
        let a = l.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
        c.rotate(a);
        c.lineWidth = 3; c.strokeStyle = 'rgba(251,243,223,0.85)'; c.strokeText(l.name, 0, 0);
        c.fillStyle = '#4a3322'; c.fillText(l.name, 0, 0);
        c.restore();
      }
    }
  }

  function pinPath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x - r * 1.2, y - r * 1.1, x - r * 1.1, y - r * 2.7, x, y - r * 2.7);
    c.bezierCurveTo(x + r * 1.1, y - r * 2.7, x + r * 1.2, y - r * 1.1, x, y);
    c.closePath();
  }

  function drawMarkers() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = getPlayer();
    // Landmarks: painted pins for those found, a faint question mark for the rest.
    c.textAlign = 'center';
    for (const lm of exploration.landmarks) {
      const [sx, sy] = toScreen(lm.x, lm.z);
      if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue;
      if (exploration.isFound(lm.id)) {
        c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
        pinPath(c, sx, sy, 8); c.fillStyle = '#b3261e'; c.fill(); c.restore();
        pinPath(c, sx, sy, 8); c.lineWidth = 2; c.strokeStyle = '#4b1410'; c.stroke();
        c.beginPath(); c.arc(sx, sy - 14, 3.2, 0, 7); c.fillStyle = '#f4e8cf'; c.fill();
        if (cam.scale > 0.22) {
          c.font = '700 13px "Playfair Display", Georgia, serif'; c.textBaseline = 'top';
          c.lineWidth = 4; c.strokeStyle = 'rgba(251,243,223,0.92)'; c.strokeText(lm.name, sx, sy + 4);
          c.fillStyle = '#2a1d14'; c.fillText(lm.name, sx, sy + 4);
        }
      } else {
        c.beginPath(); c.arc(sx, sy, 9, 0, 7); c.fillStyle = 'rgba(251,243,223,0.7)'; c.fill();
        c.setLineDash([3, 3]); c.lineWidth = 1.6; c.strokeStyle = 'rgba(70,45,28,0.7)'; c.stroke(); c.setLineDash([]);
        c.font = '800 12px "Nunito Sans", sans-serif'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(70,45,28,0.85)'; c.fillText('?', sx, sy + 0.5);
      }
    }
    // The squirrel: an arrow in maple red.
    const [px, py] = toScreen(p.x, p.z);
    c.save(); c.translate(px, py); c.rotate(p.heading);
    c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 9); c.lineTo(0, 4); c.lineTo(-9, 9); c.closePath();
    c.fillStyle = '#f4e8cf'; c.fill(); c.shadowColor = 'transparent';
    c.lineWidth = 2.5; c.strokeStyle = '#2a1d14'; c.stroke();
    c.beginPath(); c.moveTo(0, -8); c.lineTo(4.5, 5); c.lineTo(0, 2); c.lineTo(-4.5, 5); c.closePath(); c.fillStyle = '#a8281f'; c.fill();
    c.restore();
    // A small compass rose, a scale bar.
    c.save(); c.translate(W - 36, H - 52);
    c.fillStyle = 'rgba(251,243,223,0.8)'; c.beginPath(); c.arc(0, 0, 20, 0, 7); c.fill(); c.strokeStyle = '#2a1d14'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#a8281f'; c.beginPath(); c.moveTo(0, -17); c.lineTo(5, 0); c.lineTo(-5, 0); c.closePath(); c.fill();
    c.fillStyle = '#2a1d14'; c.beginPath(); c.moveTo(0, 17); c.lineTo(5, 0); c.lineTo(-5, 0); c.closePath(); c.fill();
    c.font = '800 10px "Nunito Sans", sans-serif'; c.textAlign = 'center'; c.fillText('N', 0, -23);
    c.restore();
    const nice = [10, 20, 50, 100, 200, 500, 1000].find((m) => m * cam.scale >= 60) || 1000;
    const bx = 14; const by = H - 40;
    c.fillStyle = 'rgba(251,243,223,0.85)'; c.fillRect(bx - 6, by - 14, nice * cam.scale + 12, 26);
    c.strokeStyle = '#2a1d14'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by - 4); c.lineTo(bx, by + 4); c.lineTo(bx + nice * cam.scale, by + 4); c.lineTo(bx + nice * cam.scale, by - 4); c.stroke();
    c.fillStyle = '#2a1d14'; c.font = '700 11px "Nunito Sans", sans-serif'; c.textAlign = 'left'; c.fillText(`${nice} m`, bx + 3, by - 6);
  }

  function draw() {
    if (!open) return;
    size();
    if (dirty) { drawBase(); dirty = false; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    drawMarkers();
  }

  function zoomAt(factor, sx = W / 2, sy = H / 2) {
    const [wx, wz] = toWorld(sx, sy);
    cam.scale = Math.min(MAX, Math.max(MIN, cam.scale * factor));
    cam.x = wx - (sx - W / 2) / cam.scale;
    cam.z = wz - (sy - H / 2) / cam.scale;
    dirty = true;
  }
  function center() {
    const p = getPlayer();
    cam.x = p.x; cam.z = p.z; dirty = true;
  }

  function fillJournal() {
    const list = $('#landmark-list');
    list.innerHTML = '';
    for (const lm of exploration.landmarks) {
      const found = exploration.isFound(lm.id);
      const li = document.createElement('li');
      li.className = found ? 'found' : 'unfound';
      const h = document.createElement('h4');
      h.innerHTML = found
        ? '<svg class="pinmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.500 7 12 7 12z" fill="#b3261e" stroke="#4b1410" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#f4e8cf"/></svg>'
        : '<span class="pinmark" aria-hidden="true">?</span>';
      h.append(document.createTextNode(found ? lm.name : lm.name));
      const p = document.createElement('p');
      p.textContent = found ? lm.blurb || '' : 'Not found yet. Run up to it to write it in the journal.';
      li.append(h, p);
      if (!found) li.setAttribute('aria-label', `${lm.name}: not found yet`);
      list.append(li);
    }
    if (!exploration.landmarks.length) list.innerHTML = '<li class="unfound"><p>No landmarks in this world yet.</p></li>';
    $('#j-lm').textContent = `${exploration.landmarksFound} of ${exploration.landmarkTotal} landmarks`;
    $('#j-nuts').textContent = `${exploration.nutsFound} of ${exploration.nutTotal} nuts`;
  }

  // Pointer: drag to pan, wheel and pinch to zoom.
  const pts = new Map();
  let pinch = 0;
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.map-tools')) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    view.setPointerCapture?.(e.pointerId);
    pinch = pts.size === 2 ? Math.hypot(...[...pts.values()].reduce((a, p, i) => (i ? [a[0] - p[0], a[1] - p[1]] : [p[0], p[1]]), [])) : 0;
  });
  view.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const now = [e.clientX, e.clientY];
    pts.set(e.pointerId, now);
    if (pts.size === 1) {
      cam.x -= (now[0] - prev[0]) / cam.scale; cam.z -= (now[1] - prev[1]) / cam.scale; dirty = true;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) { const r = view.getBoundingClientRect(); zoomAt(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
      pinch = d;
    }
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  $('#map-zoom-in').addEventListener('click', () => zoomAt(1.4));
  $('#map-zoom-out').addEventListener('click', () => zoomAt(1 / 1.4));
  $('#map-center').addEventListener('click', center);

  const api = {
    get open() { return open; },
    get camera() { return cam; },
    setTown(raw) { town = prepare(raw); dirty = true; if (raw?.attribution) { $('#map-attr').textContent = raw.attribution; } },
    get hasTown() { return !!town; },
    show() {
      open = true;
      fillJournal();
      size();
      center();
      cam.scale = Math.min(MAX, Math.max(MIN, cam.scale));
      dirty = true;
      const k = input.kind === 'controller'
        ? 'Left stick: pan   Right stick / LB RB: zoom   A: centre   B: close'
        : 'Drag: pan   Wheel or + -: zoom   Enter: centre   Esc or M: close';
      $('#map-keys').textContent = k;
      draw();
    },
    hide() { open = false; pts.clear(); },
    // Each frame while open (driven by menus.handle).
    frame(nav, dt) {
      if (!open) return;
      let px = nav.stick[0]; let py = nav.stick[1];
      const held = (a, b) => (input.keyDown(a) ? 1 : 0) - (input.keyDown(b) ? 1 : 0);
      px += held('ArrowRight', 'ArrowLeft') + held('KeyD', 'KeyA') + (input.padHeld(BTN.RIGHT) ? 1 : 0) - (input.padHeld(BTN.LEFT) ? 1 : 0);
      py += held('ArrowDown', 'ArrowUp') + held('KeyS', 'KeyW') + (input.padHeld(BTN.DOWN) ? 1 : 0) - (input.padHeld(BTN.UP) ? 1 : 0);
      if (px || py) {
        const sp = 520 / cam.scale;
        cam.x += px * sp * dt; cam.z += py * sp * dt; dirty = true;
      }
      const rz = nav.rstick[1];
      if (rz) zoomAt(Math.exp(-rz * 1.8 * dt));
      const kz = (input.keyDown('Equal') || input.keyDown('NumpadAdd') ? 1 : 0) - (input.keyDown('Minus') || input.keyDown('NumpadSubtract') ? 1 : 0);
      if (kz) zoomAt(Math.exp(kz * 1.8 * dt));
      if (nav.lb || input.padPressed(BTN.LB)) zoomAt(1 / 1.4);
      if (nav.rb || input.padPressed(BTN.RB)) zoomAt(1.4);
      if (nav.confirm) center();
      draw();
    },
    draw,
    refreshJournal: fillJournal,
    setHeading(h) { lastHeading = h; },
    _toScreen: toScreen,
  };
  void getTown; void lastHeading;
  return api;
}
