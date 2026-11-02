// Loads the built squirrel (assets/squirrel/squirrel.json + .bin, written by
// tools/squirrel/build.py) into a THREE.SkinnedMesh on its skeleton, with a painted fur material:
// per-vertex coat colours (grey / black), a hair-direction sheen, a soft rim, and fur shells
// (copies of the skin pushed out along the normal, cut into strands in the shader) that give the
// soft edge and the light, fluffy tail. Eyes (glossy), eye-rings and whiskers ride the head bone.
import * as THREE from 'three';

const TYPES = { f32: Float32Array, u8: Uint8Array, i8: Int8Array, u16: Uint16Array, u32: Uint32Array };
const SHELLS = 6;

export async function loadSquirrelModel(url = new URL('../../assets/squirrel/', import.meta.url).href) {
  const meta = await (await fetch(url + 'squirrel.json')).json();
  const bin = await (await fetch(url + 'squirrel.bin')).arrayBuffer();
  return { meta, bin };
}

function attr(meta, bin, name) {
  const a = meta.attributes[name], T = TYPES[a.type];
  return new T(bin, a.offset, meta.vertexCount * a.itemSize);
}

export function buildSquirrelModel({ meta, bin }, coat = 'black') {
  const n = meta.vertexCount;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(attr(meta, bin, 'position'), 3));
  const nrm = new THREE.InterleavedBuffer(attr(meta, bin, 'normal'), 4);
  geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(nrm, 3, 0, true));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(attr(meta, bin, 'skinIndex'), 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(attr(meta, bin, 'skinWeight'), 4, true));
  const coats = { grey: new THREE.BufferAttribute(attr(meta, bin, 'colorGrey'), 4, true), black: new THREE.BufferAttribute(attr(meta, bin, 'colorBlack'), 4, true) };
  geo.setAttribute('coat', coats[coat] || coats.black);
  geo.setAttribute('fur', new THREE.BufferAttribute(attr(meta, bin, 'fur'), 4, true));
  const fd = new THREE.InterleavedBuffer(attr(meta, bin, 'furDir'), 4);
  geo.setAttribute('furDir', new THREE.InterleavedBufferAttribute(fd, 3, 0, true));
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
  const rest = Object.fromEntries(meta.bones.map((b) => [b.name, new THREE.Vector3(...b.pos)]));

  const uniforms = { uFurLen: { value: meta.fur.max }, uFurPush: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const body = new THREE.SkinnedMesh(geo, furMaterial(uniforms, false));
  body.add(bones[0]);
  body.bind(skeleton);
  body.castShadow = true; body.receiveShadow = true;
  body.frustumCulled = false;
  body.name = 'squirrel-body';

  // shells: SHELLS copies of the skin, each with its height
  const idx = geo.index.array, sIdx = new Uint32Array(idx.length * SHELLS);
  const shellAttr = new Float32Array(n * SHELLS);
  const expand = (a) => {
    const size = a.itemSize, out = new (a.array.constructor)(n * size * SHELLS);
    for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) {
      const v = a.isInterleavedBufferAttribute ? a.data.array[i * a.data.stride + a.offset + k] : a.array[i * size + k];
      for (let s = 0; s < SHELLS; s++) out[(s * n + i) * size + k] = v;
    }
    return new THREE.BufferAttribute(out, size, a.normalized);
  };
  const shellGeo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight', 'coat', 'fur', 'furDir']) shellGeo.setAttribute(k, expand(geo.getAttribute(k)));
  for (let s = 0; s < SHELLS; s++) {
    for (let i = 0; i < n; i++) shellAttr[s * n + i] = (s + 1) / SHELLS;
    for (let j = 0; j < idx.length; j++) sIdx[s * idx.length + j] = idx[j] + s * n;
  }
  shellGeo.setAttribute('shell', new THREE.BufferAttribute(shellAttr, 1));
  shellGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
  shellGeo.boundingSphere = geo.boundingSphere.clone();
  const shells = new THREE.SkinnedMesh(shellGeo, furMaterial(uniforms, true));
  shells.bind(skeleton, body.bindMatrix);
  shells.castShadow = false; shells.receiveShadow = true; shells.frustumCulled = false;
  shells.name = 'squirrel-fur';

  // eyes, eye-rings, whiskers on the head bone
  const head = byName.head, hp = rest.head;
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x120c0a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
  const ringMat = new THREE.MeshStandardMaterial({ color: coat === 'grey' ? 0xe8dcc6 : 0x8a7a68, roughness: 0.9 });
  const eyes = [];
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(meta.eyes.r, 20, 14), eyeMat);
    const p = new THREE.Vector3(meta.eyes.pos[0] * s, meta.eyes.pos[1], meta.eyes.pos[2]);
    e.position.copy(p).sub(hp);
    const out = new THREE.Vector3(s, 0.25, 0.3).normalize();
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(meta.eyes.r * 1.0, meta.eyes.r * 0.14, 6, 24), ringMat);
    ring.position.set(0, 0, meta.eyes.r * 0.25);
    e.add(ring);
    head.add(e); eyes.push(e);
  }
  const wpos = [];
  const w0 = new THREE.Vector3(...meta.whiskers.pos).sub(hp);
  for (const s of [1, -1]) for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 0.9, L = 0.035 + 0.012 * Math.sin(i * 2.3);
    const o = new THREE.Vector3(w0.x * s, w0.y + (i % 3 - 1) * 0.0018, w0.z - (i % 2) * 0.002);
    const tip = o.clone().add(new THREE.Vector3(s * Math.cos(a) * 0.8, Math.sin(a) * 0.7 - 0.08, -0.35).normalize().multiplyScalar(L));
    wpos.push(...o.toArray(), ...tip.toArray());
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  const whiskers = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: coat === 'grey' ? 0x2a2522 : 0xbdb3a8, transparent: true, opacity: 0.55 }));
  head.add(whiskers);

  const group = new THREE.Group();
  group.name = 'squirrel';
  group.add(body, shells);
  return {
    group, body, shells, skeleton, bones: byName, rest, meta, eyes, whiskers, uniforms,
    setCoat(name) {
      const a = coats[name] || coats.black;
      geo.setAttribute('coat', a);
      shellGeo.setAttribute('coat', expand(a));
      whiskers.material.color.set(name === 'grey' ? 0x2a2522 : 0xbdb3a8);
      ringMat.color.set(name === 'grey' ? 0xe8dcc6 : 0x8a7a68);
    },
  };
}

// ---------------------------------------------------------------------------------------------
function furMaterial(uniforms, shell) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, side: THREE.FrontSide });
  m.defines = shell ? { FUR_SHELL: 1 } : {};
  m.customProgramCacheKey = () => (shell ? 'sq-shell' : 'sq-body');
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
  vec3 dirN = normalize(objectNormal);
  transformed += dirN * flen * shell;
  // hair bends with gravity / motion, more toward the tips
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
varying vec4 vCoat; varying vec4 vFur; varying vec3 vRest; varying vec3 vFurV; varying float vShell;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 coatC = pow(vCoat.rgb, vec3(2.2));
// strands: fine streaks elongated along the hair direction (rest space), grizzled
float strand = vnoise(vRest * vec3(1100.0)) * 0.6 + vnoise(vRest * 420.0) * 0.4;
float tipL = vCoat.a;
#ifdef FUR_SHELL
  float h = vShell;
  float len = vFur.r;
  // keep the strand if it is longer than this shell's height (tail hairs vary, body is dense)
  float keep = strand * (0.75 + 0.5 * len) - h * (1.0 + 0.6 * (1.0 - len));
  if (keep < 0.0 || len < 0.02) discard;
  coatC = mix(coatC, mix(coatC, vec3(1.0, 0.98, 0.94), 0.75), smoothstep(0.35, 1.0, h) * tipL);  // pale tips: silvery fringe
  coatC *= 0.62 + 0.38 * h;           // darker toward the roots
#else
  coatC *= 0.55 + 0.25 * strand;      // under-fur
#endif
coatC *= mix(0.7, 1.0, vFur.a);       // baked occlusion
diffuseColor.rgb = coatC;`)
      .replace('#include <opaque_fragment>', `
{
  // hair sheen along the strands (Kajiya-Kay-like, toward the viewer's key light) and a soft rim
  vec3 V = normalize(vViewPosition);
  vec3 Tn = normalize(vFurV);
  vec3 L = normalize(vec3(-0.4, 0.8, 0.45));
  vec3 H = normalize(L + V);
  float th = dot(Tn, H);
  float sheen = pow(sqrt(max(0.0, 1.0 - th * th)), 40.0);
  float ndv = clamp(dot(normalize(normal), V), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  outgoingLight += diffuseColor.rgb * (0.18 * sheen + 0.35 * rim) * (0.6 + 0.4 * vCoat.a);
}
#include <opaque_fragment>`);
  };
  return m;
}
