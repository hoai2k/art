// Trees: instanced trunks (with real limbs near the focus) and leaf-card
// canopies per kind in autumn colours, swaying in the wind. The instances
// near the focus are refreshed when it moves; trunks and big limbs go into
// the chunk colliders (bark / branch) so creatures can climb them.
import * as THREE from 'three';
import { SURFACE } from '../surface.js';
import { painted } from './materials.js';
import { rng, hash2, Builder } from './util.js';

// Reference trees (metres) per kind. Instances scale them uniformly by
// height and stretch the crown horizontally to the data's crown radius.
const REF = {
  maple: { h: 12, crown: 5, fork: 4.2, limbs: 4, spread: 0.55, cards: 84, shape: 'round', r0: 0.26 },
  oak: { h: 13, crown: 6.5, fork: 3.6, limbs: 5, spread: 0.75, cards: 96, shape: 'broad', r0: 0.32 },
  linden: { h: 13, crown: 4.5, fork: 4.5, limbs: 4, spread: 0.45, cards: 80, shape: 'oval', r0: 0.25 },
  other: { h: 11, crown: 4.8, fork: 3.8, limbs: 4, spread: 0.6, cards: 80, shape: 'round', r0: 0.24 },
  spruce: { h: 14, crown: 3.2, fork: 13.5, limbs: 0, spread: 0, cards: 70, shape: 'cone', r0: 0.22 },
  willow: { h: 12, crown: 6, fork: 2.4, limbs: 5, spread: 0.85, cards: 90, shape: 'weep', r0: 0.38 },
};
export const TREE_KINDS = Object.keys(REF);

// autumn palettes per kind (instance colours)
const PALETTE = {
  maple: [0xc23a1c, 0xd8561e, 0xe07a22, 0xe8a32a, 0xb52e22, 0xd9661a, 0x9e8a2c],
  oak: [0x8a4a22, 0x9c5a2a, 0x7a4a26, 0xa86a30, 0x6e6a2c],
  linden: [0xd8b030, 0xc8a828, 0xb8a434, 0xe0bc3c, 0x9ea83a],
  other: [0xd88a2a, 0xc86a22, 0xb89830, 0x8a9a3a, 0xd0a030, 0xa04a24],
  spruce: [0x2e4a32, 0x335238, 0x2a4430],
  willow: [0xb8b840, 0xa8b048, 0xc8b83c, 0x98a848],
};

function leafTexture(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const r = rng(kind.length * 0.137 + 0.3);
  const leaf = (x, y, s, a, shade) => {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    const l = Math.round(150 + shade * 105);
    g.fillStyle = `rgb(${l},${l},${l})`;
    g.beginPath();
    if (kind === 'spruce') { g.rect(-0.6, -9, 1.2, 18); }
    else if (kind === 'willow') { g.ellipse(0, 0, 1.6, 9, 0, 0, Math.PI * 2); }
    else if (kind === 'oak') { for (let k = 0; k < 7; k++) { const t = (k / 6) * Math.PI; g.ellipse(Math.cos(t) * 0, -6 + k * 2, 3.2 - Math.abs(k - 3) * 0.5, 1.6, 0, 0, Math.PI * 2); } }
    else if (kind === 'linden') { g.ellipse(0, 0, 5, 5.5, 0, 0, Math.PI * 2); }
    else { // maple star
      for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2; const rr = k % 2 ? 2.6 : 6.5; const px = Math.cos(t) * rr, py = Math.sin(t) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); }
    }
    g.fill();
    g.restore();
  };
  if (kind === 'willow') {
    for (let s = 0; s < 14; s++) {
      const x = 10 + r() * (S - 20);
      g.strokeStyle = 'rgba(120,110,70,1)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 20, S); g.stroke();
      for (let y = 0; y < S; y += 7) leaf(x + (r() - 0.5) * 8 + (y / S) * 6, y + r() * 4, 1.0, (r() - 0.5) * 0.8, r());
    }
  } else if (kind === 'spruce') {
    for (let b = 0; b < 9; b++) {
      const y = 20 + r() * (S - 40), x0 = 10 + r() * 40, x1 = S - 10 - r() * 40;
      g.strokeStyle = 'rgb(110,90,70)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y + (r() - 0.5) * 20); g.stroke();
      for (let x = x0; x < x1; x += 3) { leaf(x, y + (r() - 0.5) * 6, 1, 0.7 + (r() - 0.5) * 0.4, r()); leaf(x, y + (r() - 0.5) * 6, 1, -0.7 + (r() - 0.5) * 0.4, r()); }
    }
  } else {
    // a cluster: twigs, then leaves densest in the middle
    g.strokeStyle = 'rgb(90,70,55)'; g.lineWidth = 2;
    for (let t = 0; t < 6; t++) { g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + (r() - 0.5) * S * 0.8, S / 2 + (r() - 0.5) * S * 0.8); g.stroke(); }
    const n = kind === 'linden' ? 120 : 140;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.43;
      leaf(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 1.3 + r() * 1.1, r() * 6.28, r());
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Canopy geometry: leaf cards on clumps, normals pointing out from the crown
// centre so lighting reads as soft volumes. lod 0 = near, 1 = far.
function canopyGeometry(kind, lod) {
  const ref = REF[kind], r = rng(0.71 + kind.length * 0.01 + lod * 0.3);
  const b = new Builder({ color: 3, aCard: 1 });
  const nCards = lod ? Math.round(ref.cards * 0.26) : ref.cards;
  const size = (lod ? 4.0 : 2.5) * (kind === 'spruce' ? 0.9 : 1) * (ref.crown / 5) ** 0.5;
  const C = ref.crown;
  const cy = kind === 'spruce' ? ref.h * 0.5 : kind === 'weep' ? 0 : ref.h - C * (ref.shape === 'oval' ? 0.95 : 0.78);
  for (let i = 0; i < nCards; i++) {
    let px, py, pz;
    if (ref.shape === 'cone') {
      const t = r(); const y = 1.2 + t * (ref.h - 1.6); const rad = (1 - t) * C * (0.7 + 0.3 * r());
      const a = r() * Math.PI * 2; px = Math.cos(a) * rad; pz = Math.sin(a) * rad; py = y;
    } else {
      // points in an ellipsoid, biased to the surface
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), rr = 0.45 + 0.5 * Math.cbrt(r());
      const vy = ref.shape === 'oval' ? 1.0 : ref.shape === 'broad' ? 0.62 : ref.shape === 'weep' ? 0.6 : 0.78;
      px = Math.cos(a) * s * rr * C; pz = Math.sin(a) * s * rr * C; py = cy + u * rr * C * vy;
      if (ref.shape === 'weep') {
        // a low dome on top, strands hanging from its rim nearly to the ground
        const rad = Math.sqrt(r()) * C, ang = r() * Math.PI * 2;
        px = Math.cos(ang) * rad; pz = Math.sin(ang) * rad;
        py = ref.h - 0.6 - (rad / C) ** 2 * 3.0;
      }
    }
    // card orientation: random, mostly facing outward
    const ox = px, oy = py - (ref.shape === 'cone' ? py : cy), oz = pz;
    const ol = Math.hypot(ox, oy, oz) || 1;
    const nrm = [ox / ol, oy / ol + 0.25, oz / ol];
    const nl = Math.hypot(...nrm); nrm[0] /= nl; nrm[1] /= nl; nrm[2] /= nl;
    // the card faces out from the crown (with some wobble), rolled at random
    let fx = nrm[0] + (r() - 0.5) * 0.7, fy = nrm[1] * 0.6 + (r() - 0.5) * 0.5, fz = nrm[2] + (r() - 0.5) * 0.7;
    if (ref.shape === 'weep' || ref.shape === 'cone') fy *= 0.3;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    let tx = -fz, ty = 0, tz = fx; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const bx = fy * tz - fz * ty, by = fz * tx - fx * tz, bz = fx * ty - fy * tx;
    const roll = ref.shape === 'weep' ? 0 : r() * Math.PI * 2, cr = Math.cos(roll), sr = Math.sin(roll);
    const ax = [tx * cr + bx * sr, ty * cr + by * sr, tz * cr + bz * sr];
    const ay = [-tx * sr + bx * cr, -ty * sr + by * cr, -tz * sr + bz * cr];
    let w = size * (0.8 + 0.4 * r()), h = w;
    if (ref.shape === 'weep') {
      const strand = i % 5 !== 0;
      if (strand) { h = (lod ? 6 : 4.2) * (0.7 + 0.6 * r()); w = lod ? 2.6 : 1.5; py -= h * 0.45; }
      else { w = h = lod ? 3.4 : 2.4; }
    }
    const shade = 0.75 + 0.35 * r();
    b.set('color', [shade, shade * (0.92 + 0.12 * r()), shade * (0.9 + 0.1 * r())]).set('aCard', [r()]);
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    const ids = corners.map(([sx, sy, u, v]) => b.v(px + ax[0] * sx * w / 2 + ay[0] * sy * h / 2, py + ax[1] * sx * w / 2 + ay[1] * sy * h / 2, pz + ax[2] * sx * w / 2 + ay[2] * sy * h / 2, nrm[0], nrm[1], nrm[2], u, v));
    b.quad(ids[0], ids[1], ids[2], ids[3]);
  }
  return b.geometry();
}

// Trunk + limbs in reference metres (near LOD) or a plain tapered trunk (far).
function trunkGeometry(kind, lod, colliderParts) {
  const ref = REF[kind], r = rng(0.37 + kind.length * 0.013);
  const b = new Builder({ color: 3 });
  const seg = lod ? 5 : 8;
  const tube = (p0, p1, r0, r1, n = seg, collect = null) => {
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const L = Math.hypot(...d);
    const up = Math.abs(d[1] / L) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; let sl = Math.hypot(...s); s = s.map((v) => v / sl);
    let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map((v) => v / tl);
    const ring = (c, rad, v) => { const ids = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const nx = s[0] * Math.cos(a) + t[0] * Math.sin(a), ny = s[1] * Math.cos(a) + t[1] * Math.sin(a), nz = s[2] * Math.cos(a) + t[2] * Math.sin(a); ids.push(b.v(c[0] + nx * rad, c[1] + ny * rad, c[2] + nz * rad, nx, ny, nz, (i / n) * rad * 6.28, v)); } return ids; };
    b.set('color', [1, 1, 1]);
    const A = ring(p0, r0, p0[1]), B = ring(p1, r1, p1[1]);
    for (let i = 0; i < n; i++) b.quad(A[i], A[i + 1], B[i + 1], B[i]);
    if (collect) collect.push({ p0, p1, r0, r1 });
  };
  const main = colliderParts || null;
  if (kind === 'spruce') { tube([0, -0.3, 0], [0, ref.h * 0.92, 0], ref.r0, 0.04, seg, main); return b.geometry(); }
  const fork = [0, ref.fork, 0];
  tube([0, -0.4, 0], fork, ref.r0, ref.r0 * 0.72, seg, main);
  // root flare
  if (!lod) tube([0, -0.1, 0], [0, 0.5, 0], ref.r0 * 1.45, ref.r0, seg);
  if (lod) { tube(fork, [0, ref.h * 0.75, 0], ref.r0 * 0.72, 0.06, seg); return b.geometry(); }
  for (let i = 0; i < ref.limbs; i++) {
    const a = (i / ref.limbs) * Math.PI * 2 + r() * 0.8;
    const out = ref.crown * ref.spread * (0.55 + 0.4 * r());
    const top = kind === 'willow' ? ref.h - 2.5 : ref.h - ref.crown * 0.55 - r() * 1.5;
    const mid = [Math.cos(a) * out * 0.5, ref.fork + (top - ref.fork) * 0.45, Math.sin(a) * out * 0.5];
    const end = [Math.cos(a) * out, top, Math.sin(a) * out];
    const rr = ref.r0 * (0.58 - 0.06 * i / ref.limbs);
    tube(fork, mid, rr, rr * 0.72, 6, main);
    tube(mid, end, rr * 0.72, 0.05, 5, i < 3 ? main : null);
    // twigs
    for (let k = 0; k < 2; k++) {
      const a2 = a + (r() - 0.5) * 1.6;
      const s0 = [mid[0] + (end[0] - mid[0]) * 0.4, mid[1] + (end[1] - mid[1]) * 0.4, mid[2] + (end[2] - mid[2]) * 0.4];
      tube(s0, [s0[0] + Math.cos(a2) * ref.crown * 0.35, s0[1] + 1.2 + r(), s0[2] + Math.sin(a2) * ref.crown * 0.35], rr * 0.35, 0.03, 4);
    }
  }
  // a central leader
  tube(fork, [0, ref.h * 0.85, 0], ref.r0 * 0.5, 0.05, 6);
  return b.geometry();
}

export function barkMaterial(shared, assets) {
  const has = assets && assets.tex.bark;
  const defines = {}, uniforms = {};
  for (const k of ['bark', 'bark_cu', 'moss']) if (assets && assets.tex[k]) { defines['TEX_' + k.toUpperCase()] = ''; uniforms['t_' + k] = { value: assets.tex[k].texture }; uniforms['s_' + k] = { value: 1 / assets.tex[k].size }; }
  void has;
  return painted({ color: 0xffffff, vertexColors: true }, {
    shared, key: 'town-bark', defines, uniforms,
    vertHead: 'varying vec2 vBarkUv;', vertMain: 'vBarkUv = uv;',
    vertBegin: SWAY_TRUNK,
    fragHead: `#ifdef TEX_BARK
uniform sampler2D t_bark; uniform float s_bark;
#endif
#ifdef TEX_BARK_CU
uniform sampler2D t_bark_cu; uniform float s_bark_cu;
#endif
#ifdef TEX_MOSS
uniform sampler2D t_moss; uniform float s_moss;
#endif
uniform float uScale;
varying vec2 vBarkUv;`,
    color: `
      #ifdef TEX_BARK
      { vec3 c = texture2D(t_bark, vBarkUv * vec2(1.0, 0.5) * s_bark).rgb;
        float px = max(length(fwidth(vBarkUv)), 1e-4);
        #ifdef TEX_BARK_CU
        // close-up bark when the creature is small enough to read it
        float w = (1.0 - smoothstep(0.8, 2.5, px * 1024.0 / 0.3)) * clamp((0.07 - uScale) / 0.05, 0.15, 1.0);
        if (w > 0.002) c = mix(c, texture2D(t_bark_cu, vBarkUv * vec2(1.0, 0.5) * s_bark_cu).rgb, w * 0.9);
        #endif
        #ifdef TEX_MOSS
        // moss low on the shady (north, -z) side of the trunk
        float m = smoothstep(1.2, 0.2, vBarkUv.y) * smoothstep(0.1, 0.7, -vWN.z) * smoothstep(0.35, 0.6, tnoise(vBarkUv * vec2(3.0, 2.0)));
        if (m > 0.0) c = mix(c, texture2D(t_moss, vBarkUv * s_moss).rgb, m * 0.85);
        #endif
        diffuseColor.rgb *= c; }
      #else
      { vec2 q = vBarkUv * vec2(2.2, 0.55);
        float f = tnoise(vec2(q.x * 2.0, q.y * 0.6)) * 0.6 + tnoise(q * vec2(5.0, 1.2)) * 0.4;
        float px = max(length(fwidth(vBarkUv)), 1e-4);
        vec3 c = mix(vec3(0.24, 0.21, 0.19), vec3(0.47, 0.44, 0.40), smoothstep(0.3, 0.7, f));
        c = mix(vec3(0.38, 0.35, 0.31), c, aafade(2.0, px));
        // a little green moss low on the trunk
        c = mix(c, vec3(0.32, 0.38, 0.20), smoothstep(1.2, 0.0, vWP.y - vBarkUv.y + vBarkUv.y * 0.0) * 0.0);
        diffuseColor.rgb *= c; }
      #endif`,
  });
}
const SWAY_TRUNK = /* glsl */`
#ifdef USE_INSTANCING
{ vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.37 + ip.z * 0.23;
  float k = max(0.0, transformed.y - 3.0) / 12.0; k *= k;
  transformed.x += sin(uTime * 0.9 + ph) * 0.12 * k * uWind; transformed.z += cos(uTime * 0.7 + ph) * 0.08 * k * uWind; }
#endif
`;
export function leafMaterial(shared, tex) {
  return painted({ color: 0xffffff, vertexColors: true, map: tex, alphaTest: 0.45, side: THREE.DoubleSide }, {
    shared, key: 'town-leaf',
    vertHead: 'attribute float aCard;',
    vertBegin: SWAY_TRUNK + /* glsl */`
      { float ph = aCard * 6.28 + position.x * 0.3;
        transformed += vec3(sin(uTime * 2.3 + ph), sin(uTime * 1.9 + ph * 1.3) * 0.6, cos(uTime * 2.1 + ph)) * 0.06 * uWind; }`,
    // keep the cards' painted light soft: lift the shadowed side a little
    color: 'diffuseColor.rgb *= 0.92 + 0.16 * tnoise(vWP.xz * 0.4 + vWP.y);',
  });
}

export function createTrees(ctx, shared, assets) {
  const group = new THREE.Group(); group.name = 'trees';
  const trees = ctx.trees;
  const kinds = {};
  const bark = barkMaterial(shared, assets);
  const farTrunkGeo = trunkGeometry('maple', 1);
  const farTrunk = new THREE.InstancedMesh(farTrunkGeo, bark, trees.length);
  farTrunk.count = 0; farTrunk.castShadow = false; farTrunk.frustumCulled = false; group.add(farTrunk);
  const collParts = {};
  for (const k of TREE_KINDS) {
    const sprite = assets && assets.sprites[k === 'other' || k === 'linden' ? 'maple' : k];
    const tex = sprite || leafTexture(k);
    const leaf = leafMaterial(shared, tex);
    if (sprite) leaf.alphaTest = 0.38;
    const n = trees.filter((t) => t.kind === k).length;
    if (!n) continue;
    collParts[k] = []; trunkGeometry(k, 0, collParts[k]);
    const near = new THREE.InstancedMesh(canopyGeometry(k, 0), leaf, n);
    const far = new THREE.InstancedMesh(canopyGeometry(k, 1), leaf, n);
    const trunk = new THREE.InstancedMesh(trunkGeometry(k, 0), bark, n);
    for (const m of [near, far, trunk]) { m.count = 0; m.frustumCulled = false; group.add(m); }
    near.castShadow = true; trunk.castShadow = true; trunk.receiveShadow = true; near.receiveShadow = true;
    far.castShadow = false;
    near.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    far.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    // painted sprites carry their own colour: tint them only lightly (linden and others borrow the maple sprite)
    kinds[k] = { near, far, trunk, leaf, tint: sprite ? (k === 'linden' || k === 'other' ? 0.45 : 0.75) : 0 };
  }
  // per-tree transform and colour
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  for (const t of trees) {
    const ref = REF[t.kind] || REF.other;
    const s = t.height / ref.h;
    const sx = Math.max(0.6, Math.min(1.6, t.crown / (ref.crown * s)));
    t._s = s; t._sx = sx; t._yaw = hash2(t.x, t.z) * Math.PI * 2;
    const pal = PALETTE[t.kind] || PALETTE.other;
    t._col = pal[Math.floor(hash2(t.z, t.x) * pal.length)];
    const K = kinds[t.kind];
    if (K && K.tint) t._col = new THREE.Color(t._col).lerp(new THREE.Color(1, 1, 1), K.tint).getHex();
  }
  let lastFocus = null, lastR = 0;
  const update = (focus, nearR, farR) => {
    if (lastFocus && lastFocus.distanceToSquared(focus) < 36 && nearR === lastR) return;
    lastFocus = (lastFocus || new THREE.Vector3()).copy(focus); lastR = nearR;
    const counts = {};
    for (const k in kinds) counts[k] = { near: 0, far: 0, trunk: 0 };
    let farT = 0;
    const n2 = nearR * nearR, f2 = farR * farR;
    for (const t of trees) {
      const dx = t.x - focus.x, dz = t.z - focus.z, d2 = dx * dx + dz * dz;
      if (d2 > f2) continue;
      const K = kinds[t.kind]; if (!K) continue;
      _q.setFromAxisAngle(_p.set(0, 1, 0), t._yaw);
      _s.set(t._s * t._sx, t._s, t._s * t._sx);
      _m.compose(_p.set(t.x, t.y, t.z), _q, _s);
      _c.setHex(t._col);
      const c = counts[t.kind];
      if (d2 < n2) {
        K.near.setMatrixAt(c.near, _m); K.near.setColorAt(c.near, _c); c.near++;
        _s.set(t._s, t._s, t._s); _m.compose(_p.set(t.x, t.y, t.z), _q, _s);
        K.trunk.setMatrixAt(c.trunk++, _m);
      } else {
        K.far.setMatrixAt(c.far, _m); K.far.setColorAt(c.far, _c); c.far++;
        if (d2 < f2 * 0.3) { _s.set(t._s, t._s, t._s); _m.compose(_p.set(t.x, t.y, t.z), _q, _s); farTrunk.setMatrixAt(farT++, _m); }
      }
    }
    for (const k in kinds) {
      const K = kinds[k], c = counts[k];
      K.near.count = c.near; K.far.count = c.far; K.trunk.count = c.trunk;
      for (const m of [K.near, K.far, K.trunk]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    farTrunk.count = farT; farTrunk.instanceMatrix.needsUpdate = true;
  };
  // collider: trunk + main limbs of each tree (called per chunk)
  const addColliders = (list, cb, ox, oz) => {
    for (const t of list) {
      const parts = collParts[t.kind]; if (!parts) continue;
      const c = Math.cos(t._yaw), s = Math.sin(t._yaw);
      const W = (p) => [t.x - ox + (p[0] * c + p[2] * s) * t._s, t.y + p[1] * t._s, t.z - oz + (-p[0] * s + p[2] * c) * t._s];
      parts.forEach((p, i) => {
        const a = W(p.p0), b = W(p.p1);
        prismBetween(cb, a, b, Math.max(0.05, p.r0 * t._s), Math.max(0.04, p.r1 * t._s), i === 0 ? 7 : 5, i === 0 ? SURFACE.bark : SURFACE.branch);
      });
    }
  };
  const dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    bark.dispose(); for (const k in kinds) { kinds[k].leaf.map?.dispose(); kinds[k].leaf.dispose(); }
  };
  return { group, update, addColliders, dispose, kinds };
}

// prism between two points (collider)
export function prismBetween(cb, a, b, r0, r1, n, surf) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d); if (L < 1e-3) return;
  const up = Math.abs(d[1] / L) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let s = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const sl = Math.hypot(...s); s = s.map((v) => v / sl);
  let t = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]]; const tl = Math.hypot(...t); t = t.map((v) => v / tl);
  const P = (c, r, i) => { const ang = (i / n) * Math.PI * 2; return [c[0] + (s[0] * Math.cos(ang) + t[0] * Math.sin(ang)) * r, c[1] + (s[1] * Math.cos(ang) + t[1] * Math.sin(ang)) * r, c[2] + (s[2] * Math.cos(ang) + t[2] * Math.sin(ang)) * r]; };
  for (let i = 0; i < n; i++) cb.quad(P(a, r0, i), P(a, r0, i + 1), P(b, r1, i + 1), P(b, r1, i), surf);
}

// Fill-in: when the data's trees are uniform placeholders (all one height),
// vary heights so the canopy reads natural.
export function prepareTrees(data, hf) {
  const trees = data.trees.map((t) => ({ ...t }));
  const hs = new Set(trees.slice(0, 200).map((t) => t.height));
  const uniform = trees.length > 20 && hs.size <= 2;
  for (const t of trees) {
    if (!REF[t.kind]) t.kind = 'other';
    if (uniform) {
      const h = hash2(t.x, t.z);
      t.height *= 0.75 + h * 0.6; t.crown *= 0.8 + hash2(t.z, t.x) * 0.45;
    }
    t.y = hf.at(t.x, t.z);
  }
  return trees;
}
