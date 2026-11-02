// Loads a built creature (assets/<name>/<name>.json + .bin, written by tools/squirrel/build.py
// --creature <name>) into a THREE.SkinnedMesh on its skeleton, with the painted fur / plumage
// material: per-vertex coat colours, a hair- (or feather-) direction sheen, a soft rim and short
// shells for a soft edge. Optional parts from the build's metadata:
//   eyes      glossy spheres on the head bone (colour, optional ring)
//   whiskers  line whiskers on the muzzle
//   wings     feather cards (alpha-tested quads) skinned to the wing bones: primaries on the hand,
//             secondaries on the forearm, tertials on the upper arm, a row of coverts over them,
//             and a tail fan; laid out in the rest (spread) pose, folded by the animator
// The squirrel keeps its own loader (src/squirrel/model.js); this is the general one.
import * as THREE from 'three';

const TYPES = { f32: Float32Array, u8: Uint8Array, i8: Int8Array, u16: Uint16Array, u32: Uint32Array };

export async function loadCreatureModel(name, url = new URL(`../../assets/${name}/`, import.meta.url).href) {
  const meta = await (await fetch(url + `${name}.json`)).json();
  const bin = await (await fetch(url + `${name}.bin`)).arrayBuffer();
  return { meta, bin };
}

function attr(meta, bin, name) {
  const a = meta.attributes[name], T = TYPES[a.type];
  return new T(bin, a.offset, meta.vertexCount * a.itemSize);
}
const coatAttrName = (c) => 'color' + c[0].toUpperCase() + c.slice(1);

export function buildCreatureModel({ meta, bin }, { coat, shells: SHELLS = 4, furStrands = 900 } = {}) {
  const n = meta.vertexCount;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(attr(meta, bin, 'position'), 3));
  geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(attr(meta, bin, 'normal'), 4), 3, 0, true));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(attr(meta, bin, 'skinIndex'), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(attr(meta, bin, 'skinWeight'), 4, true));
  const coatNames = meta.coats || ['natural'];
  const coats = Object.fromEntries(coatNames.map((c) => [c, new THREE.BufferAttribute(attr(meta, bin, coatAttrName(c)), 4, true)]));
  coat = coats[coat] ? coat : coatNames[0];
  geo.setAttribute('coat', coats[coat]);
  geo.setAttribute('fur', new THREE.BufferAttribute(attr(meta, bin, 'fur'), 4, true));
  geo.setAttribute('furDir', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(attr(meta, bin, 'furDir'), 4), 3, 0, true));
  const I = meta.index.type === 'u32' ? Uint32Array : Uint16Array;
  geo.setIndex(new THREE.BufferAttribute(new I(bin, meta.index.offset, meta.indexCount), 1));
  geo.computeBoundingSphere();

  // skeleton (rest rotations are identity: bone axes = model axes)
  const bones = meta.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
  meta.bones.forEach((b, i) => {
    const p = b.parent >= 0 ? meta.bones[b.parent].pos : [0, 0, 0];
    bones[i].position.set(b.pos[0] - p[0], b.pos[1] - p[1], b.pos[2] - p[2]);
    if (b.parent >= 0) bones[b.parent].add(bones[i]);
  });
  const skeleton = new THREE.Skeleton(bones);
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  const index = Object.fromEntries(meta.bones.map((b, i) => [b.name, i]));
  const rest = Object.fromEntries(meta.bones.map((b) => [b.name, new THREE.Vector3(...b.pos)]));

  const uniforms = { uFurLen: { value: meta.fur.max }, uFurPush: { value: new THREE.Vector3() }, uTime: { value: 0 }, uStrands: { value: furStrands } };
  const body = new THREE.SkinnedMesh(geo, furMaterial(uniforms, false));
  body.add(bones[0]);
  body.bind(skeleton);
  body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
  body.name = `${meta.creature}-body`;

  // fur shells
  let shells = null, shellGeo = null;
  const expand = (a) => {
    const size = a.itemSize, out = new (a.array.constructor)(n * size * SHELLS);
    for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) {
      const v = a.isInterleavedBufferAttribute ? a.data.array[i * a.data.stride + a.offset + k] : a.array[i * size + k];
      for (let s = 0; s < SHELLS; s++) out[(s * n + i) * size + k] = v;
    }
    return new THREE.BufferAttribute(out, size, a.normalized);
  };
  if (SHELLS > 0) {
    const idx = geo.index.array, sIdx = new Uint32Array(idx.length * SHELLS), sh = new Float32Array(n * SHELLS);
    shellGeo = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'skinIndex', 'skinWeight', 'coat', 'fur', 'furDir']) shellGeo.setAttribute(k, expand(geo.getAttribute(k)));
    for (let s = 0; s < SHELLS; s++) {
      for (let i = 0; i < n; i++) sh[s * n + i] = (s + 1) / SHELLS;
      for (let j = 0; j < idx.length; j++) sIdx[s * idx.length + j] = idx[j] + s * n;
    }
    shellGeo.setAttribute('shell', new THREE.BufferAttribute(sh, 1));
    shellGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
    shellGeo.boundingSphere = geo.boundingSphere.clone();
    shells = new THREE.SkinnedMesh(shellGeo, furMaterial(uniforms, true));
    shells.bind(skeleton, body.bindMatrix);
    shells.receiveShadow = true; shells.frustumCulled = false;
    shells.name = `${meta.creature}-fur`;
  }

  // eyes on the head bone
  const E = meta.eyes, headBone = byName[E.bone || 'head'], hp = rest[E.bone || 'head'];
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: E.color || 0x120c0a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const eyes = [];
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(E.r, 16, 12), eyeMat);
    e.position.set(E.pos[0] * s, E.pos[1], E.pos[2]).sub(hp);
    const o = E.out || [1, 0.25, 0.3];
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(o[0] * s, o[1], o[2]).normalize());
    if (E.pupil) {   // a dark pupil on a light iris (birds)
      const p = new THREE.Mesh(new THREE.SphereGeometry(E.r * 0.55, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.1, clearcoat: 1 }));
      p.position.z = E.r * 0.55; e.add(p);
    }
    if (E.ring) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(E.r, E.r * 0.15, 6, 20), new THREE.MeshStandardMaterial({ color: E.ring, roughness: 0.9 }));
      ring.position.z = E.r * 0.25; e.add(ring);
    }
    headBone.add(e); eyes.push(e);
  }
  // whiskers
  let whiskers = null;
  if (meta.whiskers) {
    const w0 = new THREE.Vector3(...meta.whiskers.pos).sub(hp), wpos = [];
    const L0 = meta.whiskers.length || 0.06;
    for (const s of [1, -1]) for (let i = 0; i < 6; i++) {
      const a = (i / 5 - 0.5) * 0.9, L = L0 * (0.8 + 0.25 * Math.sin(i * 2.3));
      const o = new THREE.Vector3(w0.x * s, w0.y + (i % 3 - 1) * 0.002, w0.z);
      const tip = o.clone().add(new THREE.Vector3(s * Math.cos(a) * 0.8, Math.sin(a) * 0.6 - 0.1, -0.35).normalize().multiplyScalar(L));
      wpos.push(...o.toArray(), ...tip.toArray());
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    whiskers = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: meta.whiskers.color || 0x2a2522, transparent: true, opacity: 0.5 }));
    headBone.add(whiskers);
  }
  // feather cards
  let feathers = null;
  if (meta.wings) feathers = featherCards(meta, rest, index, skeleton, body);

  const group = new THREE.Group();
  group.name = meta.creature;
  group.add(body);
  if (shells) group.add(shells);
  if (feathers) group.add(feathers);
  return {
    group, body, shells, feathers, skeleton, bones: byName, rest, meta, eyes, whiskers, uniforms, coats: coatNames,
    setCoat(name) {
      if (!coats[name]) return;
      geo.setAttribute('coat', coats[name]);
      if (shellGeo) shellGeo.setAttribute('coat', expand(coats[name]));
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Feather cards: quads in the wing's rest (spread) plane, each rigid on one wing bone.
function featherTexture() {
  const c = globalThis.document?.createElement?.('canvas');
  if (!c) return null;
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 256);
  // the vane: a long rounded blade, the tip at the bottom (v = 1)
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(32, 2); g.bezierCurveTo(62, 40, 62, 200, 34, 254); g.bezierCurveTo(4, 200, 2, 40, 32, 2); g.fill();
  g.globalCompositeOperation = 'source-atop';
  for (let y = 10; y < 250; y += 5) { g.strokeStyle = `rgba(0,0,0,${0.06 + 0.04 * Math.sin(y)})`; g.beginPath(); g.moveTo(32, y); g.lineTo(2, y + 10); g.moveTo(32, y); g.lineTo(62, y + 10); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 250); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function featherCards(meta, rest, index, skeleton, body) {
  const W = meta.wings, pos = [], uv = [], si = [], sw = [], col = [], ids = [];
  const color = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const card = (root, dir, len, width, lift, bone, hex) => {
    const d = dir.clone().normalize(), side = new THREE.Vector3().crossVectors(up, d).normalize().multiplyScalar(width / 2);
    const r = root.clone(); r.y += lift;
    const tip = r.clone().addScaledVector(d, len);
    const base = pos.length / 3;
    for (const [p, u, v] of [[r.clone().sub(side), 0, 0], [r.clone().add(side), 1, 0], [tip.clone().add(side), 1, 1], [tip.clone().sub(side), 0, 1]]) {
      pos.push(p.x, p.y, p.z); uv.push(u, v); si.push(index[bone], 0, 0, 0); sw.push(1, 0, 0, 0);
      color.set(hex).convertSRGBToLinear(); col.push(color.r, color.g, color.b);
    }
    ids.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const s of [1, -1]) {
    const X = s > 0 ? '_L' : '_R';
    const P = (name) => { const v = rest[name + X]; return v ? v.clone() : null; };
    const shoulder = P(W.bones[0]), elbow = P(W.bones[1]), wrist = P(W.bones[2]);
    const tipEnd = new THREE.Vector3(...(meta.ends[W.bones[2] + '_L'] || [0, 0, 0])); tipEnd.x *= s;
    const back = new THREE.Vector3(0, 0, -1);
    // primaries: from the hand, fanning from backward (inner) to outward (outer)
    const np = W.primaries.n;
    for (let i = 0; i < np; i++) {
      const t = i / (np - 1);
      const root = wrist.clone().lerp(tipEnd, 0.15 + 0.85 * t);
      const ang = (W.primaries.fan0 ?? 0.15) + t * (W.primaries.fan1 ?? 1.25);
      const dir = new THREE.Vector3(Math.sin(ang) * s, 0, -Math.cos(ang));
      card(root, dir, W.primaries.len * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.3))), W.primaries.width, 0.002 * i, W.bones[2] + X, t > 0.5 ? (W.tipColor || W.color) : W.color);
    }
    // secondaries along the forearm, tertials along the upper arm (trailing straight back)
    const row = (a, b, nn, len, width, bone, lift, hex, sweep = 0) => {
      for (let i = 0; i < nn; i++) {
        const t = (i + 0.5) / nn;
        card(a.clone().lerp(b, t), new THREE.Vector3(sweep * s * t, 0, -1), len, width, lift, bone, hex);
      }
    };
    row(elbow, wrist, W.secondaries.n, W.secondaries.len, W.secondaries.width, W.bones[1] + X, 0.001, W.secColor || W.color, 0.15);
    row(shoulder, elbow, W.tertials.n, W.tertials.len, W.tertials.width, W.bones[0] + X, 0.0015, W.color, 0.05);
    // coverts: shorter rows on top, overlapping the roots
    row(elbow, wrist, Math.round(W.secondaries.n * 0.8), W.secondaries.len * 0.45, W.secondaries.width * 1.2, W.bones[1] + X, 0.006, W.covertColor || W.color, 0.1);
    row(shoulder, elbow, Math.round(W.tertials.n * 0.8), W.tertials.len * 0.5, W.tertials.width * 1.2, W.bones[0] + X, 0.007, W.covertColor || W.color);
    row(wrist, tipEnd.clone().lerp(wrist, 0.5), 4, W.primaries.len * 0.35, W.primaries.width * 1.4, W.bones[2] + X, 0.005, W.covertColor || W.color, 0.6);
    void back;
  }
  // tail fan
  if (W.tail) {
    const t0 = rest.tail0, nT = W.tail.n;
    for (let i = 0; i < nT; i++) {
      const a = (i / (nT - 1) - 0.5) * (W.tail.spread || 0.9);
      card(t0.clone().add(new THREE.Vector3(Math.sin(a) * 0.01, 0, 0)), new THREE.Vector3(Math.sin(a), 0.1, -Math.cos(a)), W.tail.len, W.tail.width, 0.001 * i, 'tail0', W.tail.color || W.color);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ids);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: featherTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  // feathers pass light: a card turned away from the sun (the far wing on the upstroke) keeps
  // part of its own colour instead of going black
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.28;');
  };
  mat.customProgramCacheKey = () => 'feather-translucent';
  const m = new THREE.SkinnedMesh(g, mat);
  m.bind(skeleton, body.bindMatrix);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  m.name = `${meta.creature}-feathers`;
  return m;
}

// ---------------------------------------------------------------------------------------------
function furMaterial(uniforms, shell) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  m.defines = shell ? { FUR_SHELL: 1 } : {};
  m.customProgramCacheKey = () => (shell ? 'cr-shell' : 'cr-body');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 coat; attribute vec4 fur; attribute vec3 furDir;
#ifdef FUR_SHELL
attribute float shell;
#endif
uniform float uFurLen; uniform vec3 uFurPush;
varying vec4 vCoat; varying vec4 vFur; varying vec3 vRest; varying vec3 vFurV; varying float vShell;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
vRest = position; vCoat = coat; vFur = fur; vShell = 0.0;
#ifdef FUR_SHELL
  vShell = shell;
  float flen = fur.r * uFurLen;
  transformed += normalize(objectNormal) * flen * shell;
  transformed += uFurPush * flen * shell * shell;
#endif
{
  vec3 fdir = furDir;
  #ifdef USE_SKINNING
    fdir = (bindMatrixInverse * (skinMatrix * (bindMatrix * vec4(fdir, 0.0)))).xyz;
  #endif
  vFurV = normalize((modelViewMatrix * vec4(fdir, 0.0)).xyz + 1e-5);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uStrands;
varying vec4 vCoat; varying vec4 vFur; varying vec3 vRest; varying vec3 vFurV; varying float vShell;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 coatC = pow(vCoat.rgb, vec3(2.2));
float strand = vnoise(vRest * vec3(uStrands)) * 0.6 + vnoise(vRest * uStrands * 0.38) * 0.4;
float tipL = vCoat.a;
#ifdef FUR_SHELL
  float h = vShell, len = vFur.r;
  float keep = strand * (0.75 + 0.5 * len) - h * (1.0 + 0.6 * (1.0 - len));
  if (keep < 0.0 || len < 0.02) discard;
  coatC = mix(coatC, mix(coatC, vec3(1.0, 0.98, 0.94), 0.6), smoothstep(0.35, 1.0, h) * tipL);
  coatC *= 0.7 + 0.3 * h;
#else
  coatC *= 0.75 + 0.25 * strand;
#endif
coatC *= mix(0.7, 1.0, vFur.a);
diffuseColor.rgb = coatC;`)
      .replace('#include <opaque_fragment>', `
{
  vec3 V = normalize(vViewPosition);
  vec3 Tn = normalize(vFurV);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.45));
  vec3 H = normalize(L + V);
  float th = dot(Tn, H);
  float sheen = pow(sqrt(max(0.0, 1.0 - th * th)), 40.0);
  float ndv = clamp(dot(normalize(normal), V), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  outgoingLight += diffuseColor.rgb * (0.16 * sheen + 0.3 * rim);
}
#include <opaque_fragment>`);
  };
  return m;
}
