// Ground-level detail in three tiers (ARCHITECTURE.md, "Many creatures, many
// scales"), all seeded by position:
//   ground-near     a few metres round the creature: fallen leaves as lit, curled
//                   3D cards with contact shadows that scatter when it runs through
//                   them, leaf piles that burst, twigs and branches, pine cones,
//                   acorns and horse chestnuts, weeds in the cracks, clover,
//                   dandelions and mushrooms (walkable and perchable things in the
//                   collider)
//   leaves-pebbles  out to ~26 m: flat leaf cards, pebbles, leaf-pile impostors
//   street-fixtures out to ~55 m: manhole covers, storm grates, tree grates, valve
//                   caps, mulch beds, puddles
// Beyond that the drifts and litter are painted into the ground (materials.js).
// The near tier's radius and density follow the scale and the camera zoom
// (view.zoom: 1 standard follow distance .. 5 far zoom).
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SURFACE } from '../surface.js';
import { Builder, hash1, hash2, bleedColours } from './util.js';
import { pebble } from './detail.js';

// ---------------------------------------------------------------- the sprite atlas
// region: [x, y, w, h] in canvas pixels (top left), columns, rows
const AW = 2048;
export const REGION = {
  leaves: [0, 0, 1024, 1024, 6, 4], debris: [1024, 0, 1024, 512, 4, 3], plants: [1024, 512, 1024, 512, 4, 3],
  items: [0, 1024, 1024, 512, 4, 2], piles: [1024, 1024, 1024, 512, 3, 2], pebbles: [0, 1536, 512, 512, 4, 4],
  blob: [512, 1536, 256, 256, 1, 1], mulch: [768, 1536, 256, 256, 1, 1],
};
// leaf cells of the sheet by tree kind (sprites/leaves_single_hd.png, 6 x 4)
const LEAVES = {
  maple: [0, 1, 2, 3, 4, 12, 13, 14, 22, 23], oak: [5, 6, 15, 16], linden: [7, 11, 17, 21],
  chestnut: [9, 19], other: [8, 18, 11, 21, 1, 2, 7], willow: [8, 18, 21], spruce: [],
};
const KEYS = [10, 20];
const DEBRIS = { cone: 0, branch: 1, twigs: 2, cup: 3, cap: 4, acorn: 5, core: 6, chestnut: 7, feather: 8, stone: 9, keys: 10, shells: 11 };
const PLANT = { dandelion: 0, clover: 1, plantain: 2, crackGrass: 3, moss: 4, mushrooms: 5, fern: 6, goldenrod: 7, chicory: 8, thyme: 9, ivy: 10, lichen: 11 };
const ITEM = { manhole: 0, storm: 1, treeGrate: 2, valve: 3, plate: 4, puddle: 5, crack: 6, marker: 7 };

// uv rect [u0, v0, du, dv] (v up) of cell i of a region, inset a little
export function cellRect(region, i, inset = 0.012) {
  const [x, y, w, h, c, r] = REGION[region];
  const cw = w / c, ch = h / r, cx = x + (i % c) * cw, cy = y + Math.floor(i / c) * ch;
  const ix = cw * inset, iy = ch * inset;
  return [(cx + ix) / AW, 1 - (cy + ch - iy) / AW, (cw - 2 * ix) / AW, (ch - 2 * iy) / AW];
}

// The atlas from the delivered sprites (assets.sprites, real alpha), with a
// procedural stand-in for any sheet not delivered yet.
export function buildAtlas(assets) {
  const cv = document.createElement('canvas'); cv.width = cv.height = AW;
  const g = cv.getContext('2d');
  const sp = (assets && assets.sprites) || {}, tex = (assets && assets.tex) || {};
  const img = (t) => (t && (t.image || t.source?.data)) || null;
  const put = (name, region) => {
    const [x, y, w, h] = REGION[region], im = img(sp[name]);
    if (im) { g.drawImage(im, x, y, w, h); return true; }
    standIn[region](g, x, y, w, h); return false;
  };
  const has = {};
  for (const [name, region] of [['leavesHd', 'leaves'], ['debris', 'debris'], ['plants', 'plants'], ['items', 'items'], ['piles', 'piles'], ['pebbles', 'pebbles']]) has[region] = put(name, region);
  // contact shadow: a soft dark blob
  { const [x, y, w] = REGION.blob, c = x + w / 2, gr = g.createRadialGradient(c, y + w / 2, 0, c, y + w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, y, w, w); }
  // a mulch bed: the mulch texture in a disc with a ragged edge
  { const [x, y, w] = REGION.mulch, c = w / 2, m = img(tex.mulch && tex.mulch.texture);
    g.save(); g.beginPath();
    for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2, r = c * (0.86 + 0.1 * Math.sin(a * 5 + 1) * Math.sin(a * 3)); g.lineTo(x + c + Math.cos(a) * r, y + c + Math.sin(a) * r); }
    g.closePath(); g.clip();
    if (m) g.drawImage(m, 0, 0, m.width / 2, m.height / 2, x, y, w, w); else { g.fillStyle = '#7a3c22'; g.fillRect(x, y, w, w); for (let k = 0; k < 400; k++) { g.fillStyle = `hsl(${15 + (k % 7) * 3},55%,${18 + (k % 5) * 6}%)`; g.fillRect(x + ((k * 37) % w), y + ((k * 61) % w), 6, 2); } }
    g.restore(); }
  bleedColours(cv);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture: t, has };
}

// stand-ins, drawn into the atlas region when a sheet is not delivered
const standIn = {
  leaves(g, x, y, w, h) {
    const hues = ['#c0301a', '#d8601c', '#e0a020', '#b02818', '#a8a070', '#c04018', '#9a6a3a', '#c8b030', '#d08a30', '#c8a028', '#d09a80', '#d8c040'];
    for (let i = 0; i < 24; i++) {
      const cw = w / 6, ch = h / 4, cx = x + (i % 6) * cw + cw / 2, cy = y + Math.floor(i / 6) * ch + ch / 2;
      g.save(); g.translate(cx, cy); g.fillStyle = hues[i % hues.length]; g.beginPath();
      const lobes = i % 3 === 0 ? 5 : i % 3 === 1 ? 7 : 0;
      for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2 - Math.PI / 2; const r = (lobes ? 0.32 + 0.12 * Math.abs(Math.sin(a * lobes / 2)) : 0.4) * cw; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.25); }
      g.fill(); g.strokeStyle = 'rgba(90,50,20,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, ch * 0.45); g.lineTo(0, -ch * 0.35); g.stroke(); g.restore();
    }
  },
  debris(g, x, y, w, h) {
    const cw = w / 4, ch = h / 3, at = (i) => [x + (i % 4) * cw + cw / 2, y + Math.floor(i / 4) * ch + ch / 2];
    const ell = (i, rx, ry, col) => { const [cx, cy] = at(i); g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    ell(0, cw * 0.25, ch * 0.4, '#6a4426'); ell(4, cw * 0.18, cw * 0.18, '#9a9a90'); ell(5, cw * 0.2, ch * 0.32, '#8a5a2a'); ell(6, cw * 0.15, ch * 0.3, '#d8c890');
    ell(7, cw * 0.28, ch * 0.3, '#6a2a10'); ell(9, cw * 0.3, ch * 0.22, '#8a8880'); ell(3, cw * 0.3, ch * 0.25, '#e8e4dc'); ell(11, cw * 0.3, ch * 0.2, '#5a5048');
    for (const i of [1, 2]) { const [cx, cy] = at(i); g.strokeStyle = '#5a3a20'; g.lineWidth = i === 1 ? 14 : 5; g.beginPath(); g.moveTo(cx - cw * 0.42, cy + ch * 0.1); g.lineTo(cx + cw * 0.42, cy - ch * 0.1); g.stroke(); }
    { const [cx, cy] = at(8); g.strokeStyle = '#ddd'; g.lineWidth = 10; g.beginPath(); g.moveTo(cx - cw * 0.4, cy); g.lineTo(cx + cw * 0.4, cy); g.stroke(); }
    { const [cx, cy] = at(10); g.fillStyle = '#c89a70'; g.beginPath(); g.ellipse(cx - cw * 0.15, cy, cw * 0.18, ch * 0.12, 0.4, 0, Math.PI * 2); g.ellipse(cx + cw * 0.15, cy, cw * 0.18, ch * 0.12, -0.4, 0, Math.PI * 2); g.fill(); }
  },
  plants(g, x, y, w, h) {
    const cw = w / 4, ch = h / 3;
    for (let i = 0; i < 12; i++) {
      const cx = x + (i % 4) * cw + cw / 2, by = y + Math.floor(i / 4) * ch + ch * 0.92;
      g.strokeStyle = i === 4 ? '#5a7a2a' : '#4a7a28'; g.lineWidth = 4;
      for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(cx + (k - 4) * 4, by); g.quadraticCurveTo(cx + (k - 4) * 9, by - ch * 0.5, cx + (k - 4) * 14, by - ch * (0.4 + (k % 3) * 0.15)); g.stroke(); }
      if (i === 0 || i === 7) { g.fillStyle = '#f0c820'; g.beginPath(); g.arc(cx, by - ch * 0.62, 12, 0, Math.PI * 2); g.fill(); }
      if (i === 5) { g.fillStyle = '#c8905a'; g.beginPath(); g.ellipse(cx, by - ch * 0.35, cw * 0.2, ch * 0.12, 0, Math.PI, 0); g.fill(); }
      if (i === 8) { g.fillStyle = '#7a8af0'; g.beginPath(); g.arc(cx, by - ch * 0.6, 10, 0, Math.PI * 2); g.fill(); }
    }
  },
  items(g, x, y, w, h) {
    const cw = w / 4, ch = h / 2;
    for (let i = 0; i < 8; i++) {
      const cx = x + (i % 4) * cw + cw / 2, cy = y + Math.floor(i / 4) * ch + ch / 2, r = Math.min(cw, ch) * 0.42;
      g.save(); g.translate(cx, cy);
      if (i === ITEM.manhole || i === ITEM.valve || i === ITEM.marker) {
        g.fillStyle = i === ITEM.valve ? '#3a6aa0' : i === ITEM.marker ? '#a07a40' : '#4a3a30'; g.beginPath(); g.arc(0, 0, i === ITEM.manhole ? r : r * 0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(-r * 0.7, k * r * 0.2); g.lineTo(r * 0.7, k * r * 0.2); g.stroke(); }
      } else if (i === ITEM.storm || i === ITEM.treeGrate || i === ITEM.plate) {
        g.fillStyle = i === ITEM.plate ? '#6a6058' : '#3a3430'; g.fillRect(-r, -r * (i === ITEM.storm ? 0.6 : 1), 2 * r, 2 * r * (i === ITEM.storm ? 0.6 : 1));
        g.fillStyle = '#120e0c'; for (let k = -4; k <= 4; k++) g.fillRect(k * r * 0.2 - 3, -r * 0.5, 6, r);
        if (i === ITEM.treeGrate) { g.fillStyle = '#5a3a24'; g.beginPath(); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); g.fill(); }
      } else if (i === ITEM.puddle) {
        g.fillStyle = '#5a6a7a'; g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.7, 0.2, 0, Math.PI * 2); g.fill();
      } else if (i === ITEM.crack) {
        g.strokeStyle = '#2a2622'; g.lineWidth = 5; g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(-r * 0.2, 0); g.lineTo(r, r * 0.2); g.stroke();
      }
      g.restore();
    }
  },
  piles(g, x, y, w, h) {
    const cw = w / 3, ch = h / 2;
    for (let i = 0; i < 6; i++) {
      const cx = x + (i % 3) * cw + cw / 2, by = y + Math.floor(i / 3) * ch + ch * 0.85;
      for (let k = 0; k < 220; k++) { const a = hash1(k * 3 + i) * Math.PI, rr = Math.sqrt(hash1(k * 7 + i + 1)); g.fillStyle = ['#c04018', '#d87020', '#e0a028', '#9a5a2a'][k % 4]; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr * cw * 0.42, by - Math.sin(a) * rr * ch * 0.55, 9, 5, k, 0, Math.PI * 2); g.fill(); }
    }
  },
  pebbles(g, x, y, w, h) {
    for (let i = 0; i < 16; i++) { const c = w / 4, cx = x + (i % 4) * c + c / 2, cy = y + Math.floor(i / 4) * c + c / 2; const v = 110 + (i * 23) % 70; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.ellipse(cx, cy, c * 0.4, c * 0.32, i, 0, Math.PI * 2); g.fill(); }
  },
};

// ---------------------------------------------------------------- materials
// Cards from the atlas: per-instance uv rect (aRect) and a random number (aRnd)
// that thins them with the zoom (uKeep); a sharpened alpha test so cut-outs stay
// crisp and do not shrink away in the mips; a dithered fade in or out at the
// near tier's radius (uFade: focus x, z, radius, band; mode +1 inside, -1 outside).
export function cardMaterial(atlas, U, { mode = 0, instanced = true, side = THREE.DoubleSide, keep = false } = {}) {
  const m = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5, side });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = U.fade; sh.uniforms.uKeep = U.keep;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uFade; uniform float uKeep; varying vec2 vFadeP; varying float vKeep;\n${instanced ? 'attribute vec4 aRect; attribute float aRnd;' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${instanced ? 'vMapUv = aRect.xy + uv * aRect.zw;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n{ vec4 q = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n q = instanceMatrix * q;\n#endif\n q = modelMatrix * q; vFadeP = q.xz; vKeep = ${instanced && keep ? 'step(aRnd, uKeep)' : '1.0'}; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uFade; varying vec2 vFadeP; varying float vKeep;`)
      .replace('#include <alphatest_fragment>', `
        { float a = diffuseColor.a; float fw = max(fwidth(a), 1e-3);
          a = clamp((a - 0.5) / fw * 0.7 + 0.5, 0.0, 1.0);
          if (a < 0.5 || vKeep < 0.5) discard;
          ${mode ? `float d = length(vFadeP - uFade.xy); float t = clamp((d - uFade.z + uFade.w) / max(uFade.w, 1e-3), 0.0, 1.0);
          float dith = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (${mode > 0 ? 't > dith' : 't < dith'} && uFade.w > 0.0) discard;` : ''}
          diffuseColor.a = 1.0; }`);
  };
  m.customProgramCacheKey = () => `ground-card-${mode}-${instanced}-${keep}`;
  return m;
}

// Puddles: the atlas puddle's shape and leafy rim, with water that reflects the
// sky, strongest at the grazing angles a squirrel sees it from.
function puddleMaterial(atlas, shared) {
  const m = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uSkyTop: shared.uSkyTop, uSkyHorizon: shared.uSkyHorizon, uTime: shared.uTime });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect; varying vec3 vPW;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = aRect.xy + uv * aRect.zw;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 q = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n q = instanceMatrix * q;\n#endif\n vPW = (modelMatrix * q).xyz; }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uTime; varying vec3 vPW; float pWater = 0.0;')
      .replace('#include <alphatest_fragment>', `
        { float a = diffuseColor.a; a = clamp((a - 0.5) / max(fwidth(a), 1e-3) * 0.7 + 0.5, 0.0, 1.0); if (a < 0.5) discard; diffuseColor.a = 1.0;
          // water where the painted puddle is bluish-grey, the painted rim (leaves, mud) elsewhere
          vec3 s = diffuseColor.rgb; pWater = smoothstep(-0.02, 0.06, s.b - s.r) * smoothstep(0.0, 0.08, 1.0 - max(s.r, s.g));
          diffuseColor.rgb = mix(s, vec3(0.05, 0.06, 0.07), pWater); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 V = normalize(cameraPosition - vPW);
          vec2 rip = vec2(sin(vPW.x * 31.0 + uTime * 1.3), sin(vPW.z * 27.0 - uTime * 1.1)) * 0.012;
          vec3 R = reflect(-V, normalize(vec3(rip.x, 1.0, rip.y)));
          vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
          float fr = 0.06 + 0.94 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
          totalEmissiveRadiance += sky * fr * pWater * 0.9; }`);
  };
  m.customProgramCacheKey = () => 'ground-puddle';
  return m;
}

// contact shadows under the near leaves: a soft blob texture of its own (in the atlas
// its neighbours would bleed into it in the far mips), thinned and faded as the leaves are
function shadowMaterial(U) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#999'); gr.addColorStop(1, '#000');     // an alpha map reads the grey
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = U.fade; sh.uniforms.uKeep = U.keep;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uFade; uniform float uKeep; attribute float aRnd; varying vec2 vFadeP; varying float vKeep;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 q = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n q = instanceMatrix * q;\n#endif\n vFadeP = (modelMatrix * q).xz; vKeep = step(aRnd, uKeep); }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uFade; varying vec2 vFadeP; varying float vKeep;')
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        if (vKeep < 0.5) discard;
        if (uFade.w > 0.0) diffuseColor.a *= 1.0 - clamp((length(vFadeP - uFade.xy) - uFade.z + uFade.w) / uFade.w, 0.0, 1.0);`);
  };
  m.customProgramCacheKey = () => 'ground-blob';
  m.userData.tex = tex;
  return m;
}

// ---------------------------------------------------------------- geometry
// a leaf: 5 x 3 vertices, folded along the midrib and its tip lifted (curl scaled per instance by y)
function leafGeometry() {
  const g = new THREE.BufferGeometry(), P = [], UV = [], I = [];
  const NX = 3, NZ = 5;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = (i / (NX - 1) - 0.5) * 0.667, z = 0.5 - j / (NZ - 1);   // the sheet's cells are 2:3
    const y = 0.42 * x * x + 0.06 * Math.max(0, -z - 0.1) ** 2 * 8 + 0.03 * (1 - Math.abs(z * 2));
    P.push(x, y, z); UV.push(i / (NX - 1), 1 - j / (NZ - 1));
  }
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; I.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
// a flat card lying on the ground (-0.5..0.5), uv 0..1
function flatGeometry(lift = 0) {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); if (lift) g.translate(0, lift, 0); return g;
}
// two crossed upright cards (plants, pile impostors), standing on y = 0
function crossGeometry() {
  const g = new THREE.BufferGeometry(), P = [], N = [], UV = [], I = [];
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const b = P.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push((u - 0.5) * ax, v, (u - 0.5) * az); N.push(-az * 0.4, 0.9, ax * 0.4); UV.push(u, v); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  return g;
}

// an instanced set from a list of { m: Matrix4, rect, rnd, col }
function instanced(geo, mat, list, { color = true } = {}) {
  const n = list.length, mesh = new THREE.InstancedMesh(geo, mat, n);
  const rect = new Float32Array(n * 4), rnd = new Float32Array(n);
  list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); rect.set(it.rect, i * 4); rnd[i] = it.rnd ?? 0; if (color) mesh.setColorAt(i, _col.setRGB(it.col[0], it.col[1], it.col[2])); });
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 1));
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  return mesh;
}
const _col = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const compose = (x, y, z, rx, ry, rz, sx, sy, sz, out = new THREE.Matrix4()) => out.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));

// colliders from triangle soup [x,y,z]* with one surface id per triangle
function colliderMesh(tris, surfs) {
  if (!tris.length) return null;
  const pos = new Float32Array(tris.length * 3); tris.forEach((P, i) => pos.set(P, i * 3));
  const s = new Uint8Array(tris.length); for (let i = 0; i < surfs.length; i++) s[i * 3] = s[i * 3 + 1] = s[i * 3 + 2] = surfs[i];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('surface', new THREE.BufferAttribute(s, 1));
  g.boundsTree = new MeshBVH(g);
  return new THREE.Mesh(g);
}

// ---------------------------------------------------------------- shared placement
// The ground under a cell, sampled on a grid (one raycast per sample); points
// between samples take the nearest sample's plane, or their own raycast where
// the samples disagree (curbs, steps).
function groundGrid(env, x0, z0, size, step) {
  const n = Math.ceil(size / step) + 1, S = new Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) S[j * n + i] = env.surfaceAt(x0 + i * step, z0 + j * step);
  return (x, z) => {
    const fi = (x - x0) / step, fj = (z - z0) / step, i = Math.max(0, Math.min(n - 1, Math.round(fi))), j = Math.max(0, Math.min(n - 1, Math.round(fj)));
    const s = S[j * n + i]; if (!s) return null;
    const i0 = Math.max(0, Math.min(n - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(n - 2, Math.floor(fj)));
    let lo = Infinity, hi = -Infinity, same = true;
    for (const k of [j0 * n + i0, j0 * n + i0 + 1, (j0 + 1) * n + i0, (j0 + 1) * n + i0 + 1]) { const q = S[k]; if (!q) { same = false; continue; } lo = Math.min(lo, q.y); hi = Math.max(hi, q.y); if (q.surface !== s.surface) same = false; }
    if (!same || hi - lo > 0.03) return env.surfaceAt(x, z);
    return { x, z, y: env.heightNear(s, x, z), surface: s.surface, normal: s.normal };
  };
}
// leaf fall density (leaves per m2) under the trees near a point, and the nearest tree
function treeCover(trees, x, z) {
  let dens = 0, near = null, nd = Infinity;
  for (const t of trees) {
    const d = Math.hypot(t.x - x, t.z - z);
    if (t.kind !== 'spruce' && d < t.crown * 1.35) dens = Math.max(dens, 42 * Math.min(1, 1.15 - d / (t.crown * 1.35)));
    if (d < t.crown * 1.5 && d / t.crown < nd) { nd = d / t.crown; near = t; }
  }
  return { dens, tree: near };
}
const chestnut = (t) => t.kind === 'other' && hash2(t.x + 0.5, t.z) < 0.3;
function leafCells(t) { return t ? (chestnut(t) ? LEAVES.chestnut : LEAVES[t.kind] || LEAVES.other) : LEAVES.other; }
const surfOk = (s) => s && (s.surface === SURFACE.ground || s.surface === SURFACE.road || s.surface === SURFACE.sidewalk || s.surface === SURFACE.grass);
// leaf piles: some lawn trees have one, raked under the crown (deterministic by the tree)
export function pilesOf(env, trees, x0, z0, size) {
  const out = [];
  for (const t of trees) {
    if (t.x < x0 || t.x >= x0 + size || t.z < z0 || t.z >= z0 + size || t.kind === 'spruce' || t.crown < 2.5) continue;
    const h = hash2(t.x * 1.7, t.z * 0.3); if (h > 0.2) continue;
    const a = hash2(t.z, t.x * 2.1) * Math.PI * 2, r = t.crown * (0.45 + 0.3 * hash2(t.x, t.z * 3.3));
    const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
    const s = env.surfaceAt(x, z); if (!s || (s.surface !== SURFACE.grass && s.surface !== SURFACE.ground) || s.normal.y < 0.9) continue;
    const R = 0.4 + 0.3 * hash2(x, z), H = R * (0.42 + 0.18 * hash2(z, x));
    out.push({ x, z, y: s.y, R, H, cell: Math.floor(hash2(x * 3, z) * 6), tree: t });
  }
  return out;
}

// ---------------------------------------------------------------- near tier
export function nearLayer(env, U, atlas, view) {
  const leafMat = cardMaterial(atlas, U, { mode: 1, keep: true });
  const plantMat = cardMaterial(atlas, U, { mode: 1, keep: true });
  const solidMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  const domeMat = new THREE.MeshLambertMaterial({ map: atlas, color: 0xe0b090 });
  const blobMat = shadowMaterial(U);
  const leafGeo = leafGeometry(), quadGeo = flatGeometry(0.0015), crossGeo = crossGeometry();
  const live = new Set();
  const layer = {
    id: 'ground-near', minScale: 0.03, maxScale: 1.2, cellSize: 6,
    get radius() { return view.rNear; },
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell;
      const sc = Math.max(0.5, Math.min(2, (cell.scale || 0.25) / 0.25));
      const trees = env.treesNear(x0 + size / 2, z0 + size / 2, size * 0.75 + 16);
      const gnd = groundGrid(env, x0, z0, size, 0.5);
      const leaves = [], plants = [], tris = [], surfs = [];
      const sb = new Builder({ color: 3 });              // solid debris (cones, acorns, chestnuts, stones, twigs, branches)
      const ox = cell.ox, oz = cell.oz;
      const L = { x: [], y: [], z: [], g: [], ry: [], rx: [], rz: [], s: [], sy: [], vx: [], vy: [], vz: [], spin: [], fly: [], pile: [] };
      const addLeaf = (x, y, z, size2, cellIdx, gy, pile = -1, tilt = 0.12) => {
        const ry = rng() * Math.PI * 2, rx = (rng() - 0.5) * tilt * 2, rz = (rng() - 0.5) * tilt * 2, sy = 0.4 + rng() * 1.3;
        const k = 0.78 + rng() * 0.3, damp = rng() < 0.25 ? 0.72 : 1;
        leaves.push({ m: compose(x - ox, y, z - oz, rx, ry, rz, size2, size2 * sy, size2), rect: cellRect('leaves', cellIdx), rnd: rng(), col: [k * damp, k * damp * 0.97, k * damp * 0.92] });
        L.x.push(x - ox); L.y.push(y); L.z.push(z - oz); L.g.push(gy); L.ry.push(ry); L.rx.push(rx); L.rz.push(rz); L.s.push(size2); L.sy.push(sy);
        L.vx.push(0); L.vy.push(0); L.vz.push(0); L.spin.push(0); L.fly.push(0); L.pile.push(pile);
      };
      // fallen leaves, densest under the crowns and drifted against curbs and walls
      const nTry = Math.round(size * size * 46);
      for (let k = 0; k < nTry; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const { dens, tree } = treeCover(trees, x, z);
        let d = dens + 1.2;
        const si = env.streetInfo(x, z);
        if (si && si.d < 0 && si.d > -0.45) d = d * 2.2 + 6;            // the gutter, against the curb
        else if (si && si.d < 0) d *= 0.3;                              // carriageway: blown and driven over
        else if (si && si.band > 0 && si.d > si.band - 0.5 && si.d < si.band + 0.1) d = d * 1.8 + 4;   // back of the sidewalk, against walls and fences
        if (rng() * 46 > d) continue;
        const s = gnd(x, z); if (!surfOk(s) || s.normal.y < 0.85) continue;
        if (rng() < 0.03 && tree && tree.kind === 'maple') { addLeaf(x, s.y + 0.002, z, (0.045 + rng() * 0.02) * sc, KEYS[Math.floor(rng() * 2)], s.y); continue; }
        const set = leafCells(tree); if (!set.length) continue;
        addLeaf(x, s.y + 0.002, z, (0.075 + rng() * 0.07) * sc, set[Math.floor(rng() * set.length)], s.y);
      }
      // leaf piles: a mound and leaves heaped over it
      const piles = pilesOf(env, trees, x0, z0, size), domes = [];
      piles.forEach((p, pi) => {
        const db = new Builder(), N = 10, M = 5, pr = cellRect('piles', p.cell, 0.05);
        for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2, t = j / M, r = p.R * Math.sin(t * Math.PI / 2 + Math.PI / 2) * 1.0, y = p.H * Math.sin(t * Math.PI / 2);
          const rr = p.R * Math.cos(t * Math.PI / 2);
          db.v(Math.cos(a) * rr, y - 0.02, Math.sin(a) * rr, Math.cos(a) * Math.cos(t * 1.4), Math.sin(t * 1.4) + 0.3, Math.sin(a) * Math.cos(t * 1.4), pr[0] + pr[2] * (0.5 + Math.cos(a) * 0.4 * (1 - t)), pr[1] + pr[3] * (0.25 + 0.5 * t));
          void r;
        }
        for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; db.quad(a, a + 1, a + N + 2, a + N + 1); }
        const dm = new THREE.Mesh(db.geometry(), domeMat); dm.position.set(p.x - ox, p.y, p.z - oz); dm.receiveShadow = true; dm.castShadow = true; dm.userData.notGround = true; domes.push(dm);   // a creature dives into it: no collider
        p.mesh = dm; p.burst = 0; p.t = 0;
        const set = leafCells(p.tree);
        for (let k = 0; k < 320; k++) {
          const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * p.R * 1.05, h = p.H * Math.sqrt(Math.max(0, 1 - (rr / p.R) ** 2));
          addLeaf(p.x + Math.cos(a) * rr, p.y + h + 0.004, p.z + Math.sin(a) * rr, (0.1 + rng() * 0.06) * sc, set[Math.floor(rng() * set.length)] ?? 1, p.y, pi, 0.9);
        }
      });
      // debris under the trees: twigs and branches, pine cones, acorns, horse chestnuts
      for (const t of trees) {
        const reach = t.crown * 1.1;
        if (t.x + reach < x0 || t.x - reach > x0 + size || t.z + reach < z0 || t.z - reach > z0 + size) continue;
        const area = Math.min(size * size, Math.PI * reach * reach);
        const counts = t.kind === 'spruce' ? { cone: area * 0.5, twig: area * 0.05 } : { twig: area * 0.06, branch: area * 0.006, acorn: t.kind === 'oak' ? area * 0.5 : 0, chestnut: chestnut(t) ? area * 0.25 : 0 };
        for (const [kind, c] of Object.entries(counts)) {
          const n = Math.floor(c * 0.45 + rng());
          for (let k = 0; k < n; k++) {
            const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * reach, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
            if (x < x0 || x >= x0 + size || z < z0 || z >= z0 + size) continue;
            const s = gnd(x, z); if (!surfOk(s) || s.normal.y < 0.85) continue;
            if (s.surface === SURFACE.road || (kind === 'branch' && s.surface === SURFACE.sidewalk)) continue;   // the carriageway is swept by traffic
            const lx = x - ox, lz = z - oz;
            if (kind === 'cone') solid(sb, tris, surfs, lx, s.y, lz, 0.045 * sc, 0.022 * sc, rng, cellRect('debris', DEBRIS.cone), SURFACE.prop);
            else if (kind === 'acorn') { solid(sb, tris, surfs, lx, s.y, lz, 0.013 * sc, 0.01 * sc, rng, cellRect('debris', DEBRIS.acorn), SURFACE.prop); if (rng() < 0.4) leaves.push(flatCard(lx + 0.03, s.y + 0.003, lz, 0.025 * sc, cellRect('debris', DEBRIS.cap), rng)); }
            else if (kind === 'chestnut') solid(sb, tris, surfs, lx, s.y, lz, 0.016 * sc, 0.014 * sc, rng, cellRect('debris', DEBRIS.chestnut), SURFACE.prop);
            else stick(sb, tris, surfs, lx, s.y, lz, kind === 'branch' ? (0.6 + rng() * 0.7) * sc : (0.12 + rng() * 0.22) * sc, kind === 'branch' ? (0.018 + rng() * 0.012) * sc : 0.005 * sc, rng, kind === 'branch' ? SURFACE.branch : SURFACE.prop, kind === 'branch' ? 3 : 1);
          }
        }
      }
      // plants: clover, dandelions and plantain in lawns and boulevards, mushrooms in the
      // shade, weeds in the sidewalk cracks; a bit of litter
      const nP = Math.round(size * size * 3);
      for (let k = 0; k < nP; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const s = gnd(x, z); if (!s || s.normal.y < 0.85) continue;
        const lx = x - ox, lz = z - oz;
        if (s.surface === SURFACE.grass || (s.surface === SURFACE.ground && [0, 1, 5].includes(env.groundClass(x, z)))) {
          const shade = treeCover(trees, x, z).dens > 20;
          const r = rng();
          const kind = shade ? (r < 0.06 ? PLANT.mushrooms : r < 0.4 ? PLANT.clover : r < 0.5 ? PLANT.plantain : -1)
            : (r < 0.35 ? PLANT.clover : r < 0.47 ? PLANT.dandelion : r < 0.57 ? PLANT.plantain : r < 0.6 ? PLANT.chicory : -1);
          if (kind < 0) continue;
          const h = (kind === PLANT.mushrooms ? 0.06 : kind === PLANT.clover ? 0.05 : kind === PLANT.chicory ? 0.22 : 0.1) * (0.7 + rng() * 0.6) * sc;
          plants.push({ m: compose(lx, s.y - 0.004, lz, 0, rng() * Math.PI, 0, h * 1.5, h, h * 1.5), rect: cellRect('plants', kind), rnd: rng(), col: [1, 1, 1] });
        } else if (s.surface === SURFACE.sidewalk && k % 6 === 0) {
          // weeds where slabs meet: snapped to the 1.5 m joints along the street
          const si = env.streetInfo(x, z); if (!si) continue;
          const al = x * si.dx + z * si.dz, snap = Math.round(al / 1.5) * 1.5 - al;
          const wx = x + si.dx * snap, wz = z + si.dz * snap;
          const s2 = gnd(wx, wz); if (!s2 || s2.surface !== SURFACE.sidewalk || rng() > 0.25) continue;
          const kind = rng() < 0.6 ? PLANT.crackGrass : rng() < 0.5 ? PLANT.moss : PLANT.dandelion, h = (kind === PLANT.moss ? 0.03 : 0.07) * (0.7 + rng() * 0.5) * sc;
          plants.push({ m: compose(wx - ox, s2.y - 0.003, wz - oz, 0, Math.atan2(si.dx, si.dz), 0, h * 1.6, h, h * 1.6), rect: cellRect('plants', kind), rnd: rng(), col: [1, 1, 1] });
        } else if (k % 40 === 0 && s.surface !== SURFACE.road) {
          const it = [DEBRIS.cap, DEBRIS.shells, DEBRIS.feather, DEBRIS.cup, DEBRIS.core][Math.floor(rng() * 5)];
          leaves.push(flatCard(lx, s.y + 0.002, lz, (it === DEBRIS.cup ? 0.09 : it === DEBRIS.feather ? 0.1 : 0.03) * sc, cellRect('debris', it), rng));
        }
      }
      if (!leaves.length && !plants.length && !sb.n && !domes.length) return null;
      const group = new THREE.Group(), st = { L, leafMesh: null, blobMesh: null, piles, x0, z0, ox, oz, gnd, moving: 0 };
      if (leaves.length) {
        const nLeaf = L.x.length;
        const lm = instanced(leafGeo.clone(), leafMat, leaves);
        group.add(lm); st.leafMesh = lm;
        // contact shadows (leaves only, not the flat bits): flat blobs on the ground under each leaf
        const bg = quadGeo.clone(); bg.setAttribute('aRnd', new THREE.InstancedBufferAttribute(lm.geometry.attributes.aRnd.array.slice(0, nLeaf), 1));
        const blobs = new THREE.InstancedMesh(bg, blobMat, nLeaf); blobs.frustumCulled = false;
        for (let i = 0; i < nLeaf; i++) blobs.setMatrixAt(i, blobMatrix(L, i));
        group.add(blobs); st.blobMesh = blobs; st.nLeaf = nLeaf;
        lm.renderOrder = 1;
      }
      if (plants.length) group.add(instanced(crossGeo.clone(), plantMat, plants, { color: false }));
      if (sb.n) { const m = new THREE.Mesh(sb.geometry(), solidMat); m.receiveShadow = true; m.castShadow = true; group.add(m); }
      for (const d of domes) group.add(d);
      // buckets for finding the leaves a creature runs into
      st.bucket = new Map();
      for (let i = 0; i < (st.nLeaf || 0); i++) { const k = `${Math.floor(L.x[i] / 0.5)},${Math.floor(L.z[i] / 0.5)}`; let a = st.bucket.get(k); if (!a) st.bucket.set(k, a = []); a.push(i); }
      live.add(st);
      const col = colliderMesh(tris, surfs);
      return { object: group, colliders: col ? [col] : [], onDrop: () => live.delete(st) };
    },
    // leaves kicked up by a running creature, piles burst by one diving in
    tick(dt, v) {
      if (!dt || !live.size) return;
      const sc = Math.max(0.5, Math.min(2, v.scale / 0.25)), sp = Math.hypot(v.vel.x, v.vel.z);
      for (const st of live) {
        const fx = v.focus.x - st.ox, fz = v.focus.z - st.oz;
        const L = st.L;
        // piles
        for (const p of st.piles) {
          const px = p.x - st.ox, pz = p.z - st.oz;
          if (!p.burst && Math.hypot(fx - px, fz - pz) < p.R * 0.85 && Math.abs(v.focus.y - p.y) < p.H + 0.5) {
            p.burst = 1;
            for (let i = 0; i < st.nLeaf; i++) if (L.pile[i] === st.piles.indexOf(p)) launch(L, i, (L.x[i] - px) * 4, 1.6 + Math.random() * 2.2, (L.z[i] - pz) * 4, v.vel, sc), st.moving++;
          }
          if (p.burst && p.t < 1) { p.t = Math.min(1, p.t + dt * 2.5); p.mesh.scale.set(1 + p.t * 0.25, Math.max(0.01, 1 - p.t), 1 + p.t * 0.25); if (p.t >= 1) p.mesh.visible = false; }   // flattened, then gone (its leaves lie about)
        }
        // a running creature kicks up the leaves in its way
        if (sp > 0.35 * sc && st.bucket) {
          const r = 0.13 * sc + sp * 0.025;
          if (fx > -r && fz > -r && fx < st.x0 - st.ox + 6 + r && fz < st.z0 - st.oz + 6 + r) {
            for (let bi = Math.floor((fx - r) / 0.5); bi <= Math.floor((fx + r) / 0.5); bi++) for (let bj = Math.floor((fz - r) / 0.5); bj <= Math.floor((fz + r) / 0.5); bj++) {
              const a = st.bucket.get(`${bi},${bj}`); if (!a) continue;
              for (const i of a) {
                if (L.fly[i] || Math.hypot(L.x[i] - fx, L.z[i] - fz) > r || L.y[i] - v.focus.y > 0.2) continue;
                const ox = (L.x[i] - fx) / r, oz = (L.z[i] - fz) / r;
                launch(L, i, ox * 0.8, (0.4 + Math.random() * 0.8) * Math.min(1.6, sp / sc), oz * 0.8, v.vel, sc); st.moving++;
              }
            }
          }
        }
        if (!st.moving) continue;
        // flight: drag-limited fall, flutter, settle where they land
        let moving = 0;
        for (let i = 0; i < st.nLeaf; i++) {
          if (!L.fly[i]) continue;
          const k = Math.exp(-dt * 2.6);
          L.vx[i] *= k; L.vz[i] *= k; L.vy[i] = L.vy[i] * Math.exp(-dt * 1.2) - 9.8 * 0.45 * dt * sc;
          L.vy[i] = Math.max(L.vy[i], -0.9 * sc);
          L.x[i] += L.vx[i] * dt + Math.sin(L.spin[i] * 3 + L.y[i] * 20) * 0.08 * dt * sc; L.z[i] += L.vz[i] * dt; L.y[i] += L.vy[i] * dt;
          L.ry[i] += L.spin[i] * dt; L.rx[i] += L.spin[i] * 0.7 * dt; L.rz[i] -= L.spin[i] * 0.5 * dt;
          if (L.vy[i] < 0) {
            const g = st.gnd(L.x[i] + st.ox, L.z[i] + st.oz), gy = g && surfOk(g) ? g.y : L.g[i];
            if (L.y[i] <= gy + 0.002) { L.y[i] = gy + 0.002; L.g[i] = gy; L.fly[i] = 0; L.rx[i] = (Math.random() - 0.5) * 0.24; L.rz[i] = (Math.random() - 0.5) * 0.24; }
          }
          if (L.fly[i]) moving++;
          st.leafMesh.setMatrixAt(i, compose(L.x[i], L.y[i], L.z[i], L.rx[i], L.ry[i], L.rz[i], L.s[i], L.s[i] * L.sy[i], L.s[i], _m));
          st.blobMesh.setMatrixAt(i, blobMatrix(L, i));
        }
        st.leafMesh.instanceMatrix.needsUpdate = true; st.blobMesh.instanceMatrix.needsUpdate = true;
        st.moving = moving;
      }
    },
    // leaves in the air now (for the bench and the tests)
    get flying() { let n = 0; for (const st of live) n += st.moving || 0; return n; },
    dispose() { leafMat.dispose(); plantMat.dispose(); solidMat.dispose(); domeMat.dispose(); blobMat.userData.tex.dispose(); blobMat.dispose(); leafGeo.dispose(); quadGeo.dispose(); crossGeo.dispose(); live.clear(); },
  };
  return layer;
}
function launch(L, i, ox, up, oz, vel, sc) {
  L.fly[i] = 1;
  L.vx[i] = vel.x * 0.55 + ox * sc + (Math.random() - 0.5) * 0.3 * sc;
  L.vz[i] = vel.z * 0.55 + oz * sc + (Math.random() - 0.5) * 0.3 * sc;
  L.vy[i] = up * sc; L.spin[i] = (Math.random() - 0.5) * 14;
}
function blobMatrix(L, i) {
  const h = Math.max(0, L.y[i] - L.g[i]), k = Math.max(0.15, 1 - h * 4) * L.s[i];
  return compose(L.x[i], L.g[i], L.z[i], 0, L.ry[i], 0, k * 0.95, 1, k * 1.35, _m);
}
function flatCard(x, y, z, s, rect, rng) {
  return { m: compose(x, y, z, 0, rng() * Math.PI * 2, 0, s, s * 0.6, s), rect, rnd: rng(), col: [1, 1, 1] };
}
// a small solid lying on the ground (cone, acorn, chestnut, stone): an ellipsoid of
// half-length a and radius b with the atlas cell projected from the side; in the collider
function solid(b, tris, surfs, x, y, z, a, r, rng, rect, surf) {
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position, n = geo.attributes.normal;
  const yaw = rng() * Math.PI * 2, c = Math.cos(yaw), s = Math.sin(yaw), base = b.n, pts = [];
  b.set('color', [1, 1, 1]);
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i) * a, py = p.getY(i) * r * 0.9, pz = p.getZ(i) * r;
    const u = rect[0] + rect[2] * (0.5 + p.getY(i) * 0.22), v = rect[1] + rect[3] * (0.5 + p.getX(i) * 0.3);  // its length along the sprite's height (the opaque middle)
    const P = [x + px * c + pz * s, y + py + r * 0.82, z - px * s + pz * c];
    pts.push(P);
    b.v(P[0], P[1], P[2], n.getX(i) * c + n.getZ(i) * s, n.getY(i), -n.getX(i) * s + n.getZ(i) * c, u, v);
  }
  for (let i = 0; i < p.count; i += 3) { b.tri(base + i, base + i + 1, base + i + 2); tris.push(pts[i], pts[i + 1], pts[i + 2]); surfs.push(surf); }
  geo.dispose();
}
// a twig or branch: a bent stick with forks, lying on the ground; in the collider
function stick(b, tris, surfs, x, y, z, len, r, rng, surf, forks) {
  const yaw = rng() * Math.PI * 2, dx = Math.cos(yaw), dz = Math.sin(yaw);
  const rect = cellRect('debris', DEBRIS.branch), mid = [rect[0] + rect[2] * 0.3, rect[1] + rect[3] * 0.5];   // bark from the painted branch
  const seg = (A, B, r0, r1) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); if (L < 1e-4) return;
    const ux = (B[0] - A[0]) / L, uz = (B[2] - A[2]) / L, nx = -uz, nz = ux, N = 5;
    const ring = (P, rr) => Array.from({ length: N }, (_, k) => { const t = (k / N) * Math.PI * 2; return [P[0] + nx * Math.cos(t) * rr, P[1] + Math.sin(t) * rr, P[2] + nz * Math.cos(t) * rr, Math.cos(t), Math.sin(t)]; });
    const ra = ring(A, r0), rb = ring(B, r1);
    b.set('color', [0.9, 0.85, 0.8]);
    const ia = ra.map((q) => b.v(q[0], q[1], q[2], nx * q[3], q[4], nz * q[3], mid[0] + rect[2] * 0.1 * q[3], mid[1])), ib = rb.map((q) => b.v(q[0], q[1], q[2], nx * q[3], q[4], nz * q[3], mid[0] + rect[2] * 0.1 * q[3], mid[1] + rect[3] * 0.05));
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N; b.quad(ia[k], ia[k2], ib[k2], ib[k]);
      tris.push(ra[k].slice(0, 3), ra[k2].slice(0, 3), rb[k2].slice(0, 3), ra[k].slice(0, 3), rb[k2].slice(0, 3), rb[k].slice(0, 3)); surfs.push(surf, surf);
    }
  };
  const pts = [], n = 4;
  for (let k = 0; k <= n; k++) { const t = k / n, bend = Math.sin(t * Math.PI) * len * 0.08 * (rng() - 0.5); pts.push([x + dx * (t - 0.5) * len - dz * bend, y + r * 0.7, z + dz * (t - 0.5) * len + dx * bend]); }
  for (let k = 0; k < n; k++) seg(pts[k], pts[k + 1], r * (1 - k * 0.15), r * (1 - (k + 1) * 0.15));
  for (let f = 0; f < forks; f++) {
    const P = pts[1 + Math.floor(rng() * (n - 1))], a = yaw + (rng() < 0.5 ? 0.6 : -0.6), l = len * (0.2 + rng() * 0.2);
    seg(P, [P[0] + Math.cos(a) * l, y + r * 0.5, P[2] + Math.sin(a) * l], r * 0.5, r * 0.25);
  }
}

// ---------------------------------------------------------------- middle tier
// flat leaf cards and pebbles out to ~26 m, faded out inside the near tier;
// leaf-pile impostors (id kept: the tests and the bench know it)
export function midLayer(env, U, atlas, view) {
  const mat = cardMaterial(atlas, U, { mode: -1, instanced: false });
  const pileMat = cardMaterial(atlas, U, { mode: -1, side: THREE.DoubleSide });
  const pebbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: (env.sprites && env.sprites.pebbles) || null });
  const crossGeo = crossGeometry();
  return {
    id: 'leaves-pebbles', minScale: 0.06, maxScale: 2.0, cellSize: 12,
    get radius() { return 26 * Math.max(0.7, Math.min(1.4, Math.sqrt(view.scale / 0.25))); },
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell;
      const b = new Builder({ color: 3 }), pb = new Builder({ color: 3 });
      const pcoll = [];
      const trees = env.treesNear(x0 + size / 2, z0 + size / 2, size * 0.75 + 14);
      const nTry = Math.round(size * size * 2.2);
      for (let k = 0; k < nTry; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size;
        const { dens, tree } = treeCover(trees, x, z);
        const s = env.surfaceAt(x, z);
        if (!surfOk(s)) continue;
        const isPebble = s.surface !== SURFACE.road && rng() < (s.surface === SURFACE.ground ? 0.3 : 0.06);   // none on the carriageway (swept by traffic)
        if (!isPebble && rng() * 46 > (s.surface === SURFACE.road ? 0.3 : 1) * (dens * 0.9 + 2)) continue;
        const lx = x - cell.ox, lz = z - cell.oz, y = s.y + 0.004, up = s.normal;
        if (isPebble) { pcoll.push(...pebble(pb, lx, y - 0.003, lz, 0.008 + rng() * 0.02, Math.floor(rng() * 16), rng)); continue; }
        const set = leafCells(tree); if (!set.length) continue;
        const R = cellRect('leaves', set[Math.floor(rng() * set.length)]), sz = 0.08 + rng() * 0.07, a = rng() * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a), hw = sz * 0.333, hl = sz * 0.5, sh = 0.75 + rng() * 0.3;
        b.set('color', [sh, sh * 0.97, sh * 0.93]);
        const P = [[-hw, -hl, R[0], R[1]], [hw, -hl, R[0] + R[2], R[1]], [hw, hl, R[0] + R[2], R[1] + R[3]], [-hw, hl, R[0], R[1] + R[3]]];
        const ids = P.map(([u, w, tu, tv], i) => b.v(lx + u * ca - w * sa, y + (i % 2 ? 0.004 : 0), lz + u * sa + w * ca, up.x, up.y, up.z, tu, tv));
        b.tri(ids[0], ids[1], ids[2]); b.tri(ids[0], ids[2], ids[3]);
      }
      const piles = pilesOf(env, trees, x0, z0, size).map((p) => ({ m: compose(p.x - cell.ox, p.y - 0.03, p.z - cell.oz, 0, rng() * Math.PI, 0, p.R * 2.3, p.R * 1.55, p.R * 2.3), rect: cellRect('piles', p.cell, 0.03), rnd: 0, col: [1, 1, 1] }));
      if (!b.n && !pb.n && !piles.length) return null;
      const group = new THREE.Group();
      if (b.n) { const m = new THREE.Mesh(b.geometry(), mat); m.receiveShadow = true; group.add(m); }
      if (pb.n) { const m = new THREE.Mesh(pb.geometry(), pebbleMat); m.receiveShadow = true; group.add(m); }
      if (piles.length) group.add(instanced(crossGeo.clone(), pileMat, piles, { color: false }));
      if (!pcoll.length) return { object: group };
      return { object: group, colliders: [colliderMesh(pcoll, new Array(pcoll.length / 3).fill(SURFACE.prop))] };
    },
    dispose() { mat.dispose(); pileMat.dispose(); pebbleMat.dispose(); crossGeo.dispose(); },
  };
}

// ---------------------------------------------------------------- street fixtures
// manholes and storm grates along the curbed streets, tree grates and mulch beds
// round the downtown street trees, valve caps and utility plates in the
// sidewalks, puddles in the gutters and on paths; flush with the ground
export function fixturesLayer(env, U, atlas, shared) {
  const mat = cardMaterial(atlas, U, { mode: 0, side: THREE.FrontSide });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -6;
  const pmat = puddleMaterial(atlas, shared);
  const quad = flatGeometry();
  return {
    id: 'street-fixtures', minScale: 0.01, maxScale: 3, cellSize: 40, radius: 60,
    build(chunkKey, cell) {
      const { x0, z0, size, rng } = cell, ox = cell.ox, oz = cell.oz;
      const items = [], puddles = [];
      const inCell = (x, z) => x >= x0 && x < x0 + size && z >= z0 && z < z0 + size;
      const where = [];                                   // (for the bench: what is where)
      const place = (list, x, z, w, l, yaw, rect, lift, want) => {
        const s = env.surfaceAt(x, z); if (!s || s.normal.y < 0.97 || (want && !want.includes(s.surface))) return false;
        list.push({ m: compose(x - ox, s.y + lift, z - oz, 0, yaw, 0, w, 1, l), rect, rnd: rng(), col: [1, 1, 1] });
        where.push({ x, z, kind: list === puddles ? 'puddle' : Object.keys(ITEM).find((k) => cellRect('items', ITEM[k], 0.04)[0] === rect[0] && cellRect('items', ITEM[k], 0.04)[1] === rect[1]) || 'mulch' });
        return true;
      };
      // along each curbed street: manholes in the lanes, storm grates at the curb
      for (const r of env.roadsIn(x0, z0, size)) {
        const P = r.points; let s0 = 0;
        for (let i = 1; i < P.length; i++) {
          const ax = P[i - 1][0], az = P[i - 1][1], bx = P[i][0], bz = P[i][1], L = Math.hypot(bx - ax, bz - az); if (L < 1) { s0 += L; continue; }
          const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx, yaw = Math.atan2(-dz, dx);   // the card's x along the street
          for (const [step, kind] of [[47, ITEM.manhole], [31, ITEM.storm]]) {
            const ph = hash1(r.id * 7 + kind) * step;
            for (let s = Math.ceil((s0 - ph) / step) * step + ph; s < s0 + L; s += step) {
              const t = s - s0; if (t < 0) continue;
              const side = hash1(Math.floor(s) * 13 + r.id) < 0.5 ? -1 : 1;
              const off = kind === ITEM.manhole ? r.hw * (0.3 + 0.2 * hash1(Math.floor(s) + r.id)) * side : (r.hw - 0.32) * side;
              const x = ax + dx * t + nx * off, z = az + dz * t + nz * off; if (!inCell(x, z)) continue;
              if (kind === ITEM.manhole) place(items, x, z, 0.78, 0.78, rng() * 6.28, cellRect('items', kind, 0.04), 0.002, [SURFACE.road]);
              else {
                if (place(items, x, z, 0.62, 0.42, yaw, cellRect('items', kind, 0.04), 0.002, [SURFACE.road]) && rng() < 0.5)
                  place(puddles, x - nx * side * 0.35 + dx * 0.9, z - nz * side * 0.35 + dz * 0.9, 0.9 + rng() * 0.8, 0.55 + rng() * 0.3, yaw, cellRect('items', ITEM.puddle, 0.03), 0.003, [SURFACE.road]);
              }
            }
          }
          s0 += L;
        }
      }
      // trees: grates in the sidewalk, mulch beds in downtown lawns
      for (const t of env.treesNear(x0 + size / 2, z0 + size / 2, size * 0.72)) {
        if (!inCell(t.x, t.z) || t.kind === 'spruce') continue;
        const s = env.surfaceAt(t.x + 0.45, t.z + 0.1); if (!s) continue;
        const si = env.streetInfo(t.x, t.z);
        if (s.surface === SURFACE.sidewalk) place(items, t.x, t.z, 1.25, 1.25, si ? Math.atan2(-si.dz, si.dx) : 0, cellRect('items', ITEM.treeGrate, 0.04), 0.003);
        else if ((s.surface === SURFACE.grass || s.surface === SURFACE.ground) && env.downtownAt(t.x, t.z)) place(items, t.x, t.z, 2.2 + rng() * 0.6, 2.2 + rng() * 0.6, rng() * 6.28, cellRect('mulch', 0, 0.01), 0.004);
      }
      // sidewalks: a valve cap or a utility plate now and then, a crack with a dandelion; puddles on paths and lots
      for (let k = 0; k < 18; k++) {
        const x = x0 + rng() * size, z = z0 + rng() * size, r = rng();
        const s = env.surfaceAt(x, z); if (!s) continue;
        if (s.surface === SURFACE.sidewalk) {
          const kind = r < 0.3 ? ITEM.valve : r < 0.5 ? ITEM.plate : r < 0.6 ? ITEM.marker : -1; if (kind < 0) continue;
          const si = env.streetInfo(x, z), w = kind === ITEM.plate ? 0.5 : 0.16;
          place(items, x, z, w, w * (kind === ITEM.plate ? 0.7 : 1), si ? Math.atan2(-si.dz, si.dx) : 0, cellRect('items', kind, 0.04), 0.002);
        } else if ((s.surface === SURFACE.ground || s.surface === SURFACE.road) && r < 0.25 && env.groundClass(x, z) !== 1) {
          place(puddles, x, z, 0.8 + rng() * 1.4, 0.5 + rng() * 0.6, rng() * 6.28, cellRect('items', ITEM.puddle, 0.03), 0.003);
        }
      }
      if (!items.length && !puddles.length) return null;
      const group = new THREE.Group();
      if (items.length) group.add(instanced(quad.clone(), mat, items, { color: false }));
      if (puddles.length) { const m = instanced(quad.clone(), pmat, puddles, { color: false }); group.add(m); }
      group.userData.fixtures = where;
      return { object: group };
    },
    dispose() { mat.dispose(); pmat.dispose(); quad.dispose(); },
  };
}

// ---------------------------------------------------------------- view state
// Shared by the tiers: the creature (focus, velocity), its scale and the camera
// zoom (camera distance / the follow camera's standard distance, 1..5).
export function createView() {
  const view = {
    focus: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 0.25, zoom: 1, rNear: 5,
    U: { fade: { value: new THREE.Vector4(0, 0, 5, 1) }, keep: { value: 1 } },
    _prev: null,
    update(dt, focus, camera, scale) {
      view.scale = scale;
      if (view._prev && dt > 0) {
        const vx = (focus.x - view._prev.x) / dt, vy = (focus.y - view._prev.y) / dt, vz = (focus.z - view._prev.z) / dt;
        const ok = Math.hypot(vx, vz) < 40 * Math.max(0.25, scale);           // a teleport is not a run
        const k = Math.min(1, dt * 12);
        if (ok) view.vel.set(view.vel.x + (vx - view.vel.x) * k, view.vel.y + (vy - view.vel.y) * k, view.vel.z + (vz - view.vel.z) * k); else view.vel.set(0, 0, 0);
      }
      view._prev = view._prev || new THREE.Vector3(); view._prev.copy(focus);
      view.focus.copy(focus);
      if (camera) {
        const std = 3.4 * scale, d = camera.position.distanceTo(focus);
        view.zoom = Math.max(1, Math.min(5, d / std));
      }
      // the near tier: a few metres for a squirrel, scaled by its size, pulled in as the camera zooms out
      const base = Math.max(2.4, Math.min(9, 20 * scale));
      view.rNear = base * (1 - 0.1 * (view.zoom - 1));
      const nearOn = scale >= 0.03 && scale <= 1.2;
      view.U.fade.value.set(focus.x, focus.z, view.rNear, nearOn ? Math.max(0.6, view.rNear * 0.18) : 0);
      view.U.keep.value = 1 - 0.12 * (view.zoom - 1);
    },
  };
  return view;
}
