// The town's painted materials: MeshLambertMaterial (cheap on integrated GPUs,
// shadows and fog for free) with procedural colour written into the fragment
// shader. Every pattern has a stand-in; a delivered texture (assets.js) is
// sampled instead when it is listed in assets/manifest.json.
import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

const WORLD_VARYINGS = 'varying vec3 vWP;\nvarying vec3 vWN;\n';
const WORLD_POS = /* glsl */`
{
  vec4 wp4 = vec4(transformed, 1.0);
  vec4 wn4 = vec4(objectNormal, 0.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4; wn4 = instanceMatrix * wn4;
  #endif
  wp4 = modelMatrix * wp4; vWP = wp4.xyz; vWN = normalize((modelMatrix * wn4).xyz);
}
`;

// Shared, animated uniforms (one object referenced by every material).
export function sharedUniforms() {
  return {
    uTime: { value: 0 }, uNight: { value: 0 }, uWind: { value: 1 }, uScale: { value: 0.25 },
    uSkyTop: { value: new THREE.Color(0x6d9bd1) }, uSkyHorizon: { value: new THREE.Color(0xf0d9b5) },
    uSunDir: { value: new THREE.Vector3(-0.6, 0.35, 0.3).normalize() }, uSunColor: { value: new THREE.Color(0xffd9a8) },
  };
}

// Lambert + injected GLSL.
export function painted(params, { shared, uniforms = {}, defines = {}, vertHead = '', vertMain = '', vertBegin = '', fragHead = '', color = '', emissive = '', key }) {
  const m = new THREE.MeshLambertMaterial(params);
  const all = { ...shared, ...uniforms };
  m.userData.uniforms = all;
  m.defines = { ...(m.defines || {}), ...defines };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, all);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}uniform float uTime;\nuniform float uWind;\n${vertHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertBegin}`)
      .replace('#include <project_vertex>', `${WORLD_POS}\n#include <project_vertex>\n${vertMain}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}uniform float uTime;\nuniform float uNight;\n${GLSL_NOISE}\n${fragHead}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${color}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${emissive}`);
  };
  m.customProgramCacheKey = () => key + JSON.stringify(m.defines);
  return m;
}

function texDefines(assets, slots) {
  const defines = {}, uniforms = {};
  for (const s of slots) {
    const t = assets && assets.tex[s];
    if (!t) continue;
    defines['TEX_' + s.toUpperCase()] = '';
    uniforms['t_' + s] = { value: t.texture };
    uniforms['s_' + s] = { value: 1 / t.size };
  }
  return { defines, uniforms };
}
function texDecl(slots) {
  return slots.map((s) => `#ifdef TEX_${s.toUpperCase()}\nuniform sampler2D t_${s}; uniform float s_${s};\n#endif`).join('\n');
}

// ---------------------------------------------------------------- shared GLSL palettes
const GLSL_COMMON = /* glsl */`
uniform float uScale;
// Weight of a close-up texture of real size S (m): it shows where its texels
// resolve on screen, fully for small creatures and only a touch at squirrel scale.
float closeW(float S, float px) {
  float k = px * 1024.0 / S;
  return (1.0 - smoothstep(0.8, 2.5, k)) * clamp((0.07 - uScale) / 0.05, 0.15, 1.0);
}
// sample a tiling texture twice (rotated, rescaled) and blend by low-frequency
// noise, so its repeats do not show across a lawn or a street
vec3 texAT(sampler2D t, vec2 p) {
  vec3 a = texture2D(t, p).rgb;
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.71 + vec2(0.37, 0.61);
  vec3 b = texture2D(t, q).rgb;
  return mix(a, b, smoothstep(0.35, 0.65, tnoise(p * 0.37)));
}
float bitf(float f, float b) { return mod(floor(f / b + 0.001), 2.0); }
float sbox(vec2 p, vec2 lo, vec2 hi, float aa) {
  vec2 a = smoothstep(lo - aa, lo + aa, p) * (1.0 - smoothstep(hi - aa, hi + aa, p)); return a.x * a.y;
}
vec3 leafHue(float h) {
  return h < 0.3 ? vec3(0.70, 0.16, 0.06) : h < 0.55 ? vec3(0.86, 0.40, 0.09) : h < 0.8 ? vec3(0.88, 0.64, 0.16) : vec3(0.52, 0.32, 0.14);
}
// fallen leaves scattered on a surface: returns colour (rgb) and coverage (a)
vec4 fallenLeaves(vec2 p, float density, float px) {
  vec2 q = p * 3.2; vec2 i = floor(q); vec2 f = fract(q) - 0.5;
  float h = th(i);
  vec2 o = (vec2(th(i + 3.1), th(i + 7.7)) - 0.5) * 0.5;
  float ang = th(i + 1.7) * 6.283;
  vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (f - o);
  float lobes = 0.13 + 0.05 * cos(atan(r.y, r.x) * 5.0);
  float d = length(r * vec2(1.0, 1.2)) - lobes * (0.7 + 0.6 * h);
  float aa = px * 3.2;
  float cov = (1.0 - smoothstep(-aa, aa, d)) * step(1.0 - density, th(i + 9.3));
  float far = clamp(px * 6.0 - 0.3, 0.0, 1.0);          // too small to draw: average tint
  cov = mix(cov, density * 0.45, far);
  vec3 c = leafHue(th(i + 5.5)) * (0.85 + 0.3 * th(i + 2.2));
  c = mix(c, vec3(0.74, 0.40, 0.12), far);
  return vec4(c, cov);
}
`;

// ---------------------------------------------------------------- ground (terrain)
export function groundMaterial(shared, ground, assets, waterLevel) {
  const slots = ['grass', 'asphalt', 'sidewalk', 'gravel', 'leaves', 'soil_cu', 'grass_cu', 'concrete_cu', 'asphalt_cu'];
  const td = texDefines(assets, slots);
  return painted({ color: 0xffffff }, {
    shared, key: 'town-ground', defines: td.defines,
    uniforms: { tGA: { value: ground.texA }, tGB: { value: ground.texB }, uGR: { value: ground.rect }, uWL: { value: waterLevel }, ...td.uniforms },
    fragHead: `uniform sampler2D tGA; uniform sampler2D tGB; uniform vec4 uGR; uniform float uWL;\n${texDecl(slots)}\n${GLSL_COMMON}\n${GLSL_GROUND}`,
    color: 'diffuseColor.rgb = groundColor(vWP);',
  });
}
const GLSL_GROUND = /* glsl */`
vec3 grassCol(vec2 p, float lush, float px) {
#ifdef TEX_GRASS
  vec3 c = texAT(t_grass, p * s_grass) * vec3(0.95, 1.05, 0.9);
  // far away the mip of a leafy lawn averages to olive: keep lawns green
  c = mix(c, mix(vec3(0.27, 0.38, 0.12), vec3(0.36, 0.44, 0.16), tfbm(p * 0.03)), clamp(px * 5.0 - 0.1, 0.0, 0.55));
  return mix(c, c * vec3(0.92, 1.04, 0.88), lush * 0.4) * (0.92 + 0.12 * tfbm(p * 0.05));
#else
  float n1 = tfbm(p * 0.07), n2 = tnoise(p * 0.8), n3 = tnoise(p * 3.1);
  vec3 g1 = vec3(0.27, 0.37, 0.12), g2 = vec3(0.44, 0.50, 0.19), dry = vec3(0.60, 0.55, 0.28);
  vec3 c = mix(g1, g2, n1);
  c = mix(c, dry, smoothstep(0.5, 0.85, tnoise(p * 0.04 + 3.0)) * (1.0 - lush) * 0.55);
  float fine = mix(0.5 + 0.5 * n3, 0.75, clamp(px * 3.0, 0.0, 1.0));
  c *= 0.86 + 0.26 * n2 * fine;
  c = mix(c, vec3(0.26, 0.40, 0.13), lush * 0.35);
  // blades (stroke-like streaks) when close
  float bl = tnoise(vec2(p.x * 40.0, p.y * 9.0)) * aafade(40.0, px);
  c *= 0.92 + 0.16 * bl;
  return c;
#endif
}
vec3 asphaltCol(vec2 p, float px, float light) {
#ifdef TEX_ASPHALT
  return texAT(t_asphalt, p * s_asphalt) * (1.0 + light * 0.25);
#else
  float n = tfbm(p * 0.25), a = th(floor(p * 30.0)) * aafade(30.0, px);
  vec3 c = mix(vec3(0.24, 0.24, 0.25), vec3(0.31, 0.30, 0.30), n) * (1.0 + light * 0.28);
  c *= 0.93 + 0.14 * a;
  float crack = smoothstep(0.012, 0.0, abs(tnoise(p * 0.6) - 0.5)) * aafade(5.0, px) * step(0.55, tnoise(p * 0.11 + 9.0));
  c = mix(c, vec3(0.16), crack * 0.6);
  float patchy = smoothstep(0.62, 0.66, tnoise(p * 0.09 + 4.0));
  return mix(c, c * 0.82, patchy * 0.6);
#endif
}
vec3 concreteCol(vec2 p, float px) {
#ifdef TEX_SIDEWALK
  return texture2D(t_sidewalk, p * s_sidewalk).rgb;
#else
  float n = tfbm(p * 0.4);
  vec3 c = mix(vec3(0.62, 0.60, 0.56), vec3(0.72, 0.69, 0.64), n);
  return c * (0.95 + 0.08 * th(floor(p * 40.0)) * aafade(40.0, px));
#endif
}
vec3 gravelCol(vec2 p, float px) {
#ifdef TEX_GRAVEL
  return texAT(t_gravel, p * s_gravel);
#else
  float s = th(floor(p * 25.0)) * aafade(25.0, px);
  return mix(vec3(0.66, 0.59, 0.46), vec3(0.76, 0.69, 0.55), tfbm(p * 0.5)) * (0.88 + 0.22 * s);
#endif
}
vec3 litterCol(vec2 p, float px) {
#ifdef TEX_LEAVES
  return texAT(t_leaves, p * s_leaves);
#else
  vec4 l1 = fallenLeaves(p, 1.0, px), l2 = fallenLeaves(p * 1.37 + 5.0, 1.0, px);
  vec3 base = mix(vec3(0.42, 0.25, 0.12), vec3(0.62, 0.38, 0.13), tnoise(p * 0.6));
  return mix(mix(base, l1.rgb, l1.a), l2.rgb, l2.a * 0.8);
#endif
}
vec3 groundColor(vec3 wp) {
  vec2 p = wp.xz;
  float px = max(length(fwidth(p)), 1e-4);
  vec2 guv = (p - uGR.xy) * uGR.zw;
  vec4 A = texture2D(tGA, guv), B = texture2D(tGB, guv);
  float n = tnoise(p * 0.45) - 0.5;
  float asph = smoothstep(0.35, 0.65, A.r + n * 0.2);
  float conc = smoothstep(0.35, 0.65, A.g + n * 0.25);
  float grav = smoothstep(0.3, 0.7, A.b + n * 0.3);
  float lit = smoothstep(0.2, 0.8, B.r + n * 0.5);
  float lush = B.g;
  float dirt = smoothstep(0.3, 0.7, B.b + n * 0.4);
  vec3 c = grassCol(p, lush, px);
  c = mix(c, mix(vec3(0.40, 0.31, 0.20), vec3(0.50, 0.40, 0.27), tnoise(p * 0.7)), dirt);
  c = mix(c, litterCol(p, px), lit * 0.92);
  c = mix(c, gravelCol(p, px), grav);
  c = mix(c, concreteCol(p, px), conc);
  c = mix(c, asphaltCol(p, px, 0.0), asph);
  // scattered fallen leaves on lawns and paving
  vec4 fl = fallenLeaves(p + 11.0, mix(0.12, 0.05, asph), px);
  c = mix(c, fl.rgb, fl.a * (1.0 - lit));
#if defined(TEX_GRASS_CU) && defined(TEX_SOIL_CU) && defined(TEX_CONCRETE_CU) && defined(TEX_ASPHALT_CU)
  { float w = closeW(0.25, px);
    if (w > 0.002) {
      vec3 cu = mix(texture2D(t_grass_cu, p * s_grass_cu).rgb, texture2D(t_soil_cu, p * s_soil_cu).rgb, clamp(max(dirt, grav) + lit * 0.5, 0.0, 1.0));
      cu = mix(cu, texture2D(t_concrete_cu, p * s_concrete_cu).rgb, conc);
      cu = mix(cu, texture2D(t_asphalt_cu, p * s_asphalt_cu).rgb, asph);
      c = mix(c, cu, w * 0.9);
    } }
#endif
  // river bed and wet banks
  float under = smoothstep(uWL + 0.4, uWL - 0.5, wp.y);
  c = mix(c, mix(vec3(0.30, 0.27, 0.18), vec3(0.20, 0.22, 0.16), smoothstep(uWL - 0.5, uWL - 2.0, wp.y)), under);
  return c;
}
`;

// ---------------------------------------------------------------- streets
// aSt: x kind, y distance from curb (m), z boulevard width, w seed; aDir: street direction
export const STREET = { road: 0, plate: 1, curb: 2, footway: 3, path: 4, service: 5, white: 6, yellow: 7, stone: 8, railing: 9, deck: 10, pavers: 11 };
export function streetMaterial(shared, assets) {
  const slots = ['grass', 'asphalt', 'sidewalk', 'gravel', 'stone', 'soil_cu', 'grass_cu', 'concrete_cu', 'asphalt_cu'];
  const td = texDefines(assets, slots);
  return painted({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, {
    shared, key: 'town-street', defines: td.defines, uniforms: td.uniforms,
    vertHead: 'attribute vec4 aSt; attribute vec2 aDir; varying vec4 vSt; varying vec2 vDir; flat varying float vBlv;',
    vertMain: 'vSt = aSt; vDir = aDir; vBlv = aSt.z;',
    fragHead: `varying vec4 vSt; varying vec2 vDir; flat varying float vBlv;\n${texDecl(slots)}\n${GLSL_COMMON}\n${GLSL_GROUND.replace(/vec3 groundColor[\s\S]*$/, '')}\n${GLSL_STREET}`,
    color: 'diffuseColor.rgb = streetColor(vWP);',
  });
}
const GLSL_STREET = /* glsl */`
vec3 streetBase(vec3 wp);
vec3 streetColor(vec3 wp) {
  vec3 c = streetBase(wp);
#if defined(TEX_GRASS_CU) && defined(TEX_SOIL_CU) && defined(TEX_CONCRETE_CU) && defined(TEX_ASPHALT_CU)
  vec2 p = wp.xz;
  float px = max(length(fwidth(p)), 1e-4);
  float w = closeW(0.3, px);
  if (w > 0.002) {
    float kind = floor(vSt.x + 0.5);
    vec2 q = abs(vWN.y) > 0.5 ? p : vec2(dot(p, normalize(vDir + 1e-5)), wp.y);
    vec3 cu;
    if (kind == 0.0 || kind == 5.0) cu = texture2D(t_asphalt_cu, q * s_asphalt_cu).rgb;
    else if (kind == 4.0) cu = texture2D(t_soil_cu, q * s_soil_cu).rgb;
    else if (kind == 1.0 && vBlv > 0.05 && vSt.y > 0.2 && vSt.y < vBlv) cu = texture2D(t_grass_cu, q * s_grass_cu).rgb;
    else if (kind <= 3.0 || kind == 8.0) cu = texture2D(t_concrete_cu, q * s_concrete_cu).rgb;
    else return c;
    // keep markings readable: tint the close-up by the far colour's brightness
    c = mix(c, cu * (dot(c, vec3(0.333)) / max(0.05, dot(cu, vec3(0.333)))) * 0.5 + cu * 0.5, w * 0.85);
  }
#endif
  return c;
}
vec3 streetBase(vec3 wp) {
  vec2 p = wp.xz;
  float px = max(length(fwidth(p)), 1e-4);
  float kind = floor(vSt.x + 0.5);
  vec2 dir = length(vDir) > 0.01 ? normalize(vDir) : vec2(1.0, 0.0);
  float along = dot(p, dir), across = dot(p, vec2(-dir.y, dir.x));
  if (kind == 0.0 || kind == 5.0) {
    vec3 c = asphaltCol(p, px, kind == 5.0 ? 1.0 : 0.0);
    // grit, for eyes a few centimetres above the road
    c *= 0.9 + 0.2 * th(floor(p * 160.0)) * aafade(160.0, px);
    vec4 fl = fallenLeaves(p + 3.0, 0.05, px);
    return mix(c, fl.rgb, fl.a);
  }
  if (kind == 1.0) {               // sidewalk plate: curb stone, boulevard grass, slabs
    float d = vSt.y, blv = vBlv;
    vec3 conc = concreteCol(vec2(along, across), px);
    // control joints every 1.5 m along, and a line where the slab meets the boulevard
    float j = min(fract(along / 1.5), 1.0 - fract(along / 1.5)) * 1.5;
    float joint = (1.0 - smoothstep(0.004, 0.004 + px, j)) * aafade(4.0, px);
#ifndef TEX_SIDEWALK
    conc *= 1.0 - 0.28 * joint;
#endif
    vec3 c = conc;
    if (blv > 0.05 && d > 0.2 && d < blv) {
      c = grassCol(p, 0.3, px);
      vec4 fl = fallenLeaves(p + 7.0, 0.25, px);
      c = mix(c, fl.rgb, fl.a);
    } else {
      vec4 fl = fallenLeaves(p + 7.0, 0.07, px);
      c = mix(c, fl.rgb, fl.a);
    }
    if (d < 0.2) c = concreteCol(p, px) * 1.08;        // the curb's top
    return c;
  }
  if (kind == 2.0) return concreteCol(vec2(along, wp.y * 3.0), px) * 0.92;
  if (kind == 3.0) {
    vec3 c = concreteCol(vec2(along, across), px) * 0.97;
    float j = min(fract(along / 1.5), 1.0 - fract(along / 1.5)) * 1.5;
    c *= 1.0 - 0.25 * (1.0 - smoothstep(0.004, 0.004 + px, j)) * aafade(4.0, px);
    vec4 fl = fallenLeaves(p + 1.0, 0.1, px); return mix(c, fl.rgb, fl.a);
  }
  if (kind == 4.0) { vec3 c = gravelCol(p, px); vec4 fl = fallenLeaves(p + 2.0, 0.12, px); return mix(c, fl.rgb, fl.a); }
  if (kind == 6.0 || kind == 7.0) {
    // paint on the asphalt: the surface shows through where it is worn
    vec3 paint = kind == 6.0 ? vec3(0.86, 0.85, 0.80) : vec3(0.90, 0.70, 0.18);
    vec3 road = asphaltCol(p, px, 0.0);
    float wear = smoothstep(0.35, 0.8, tnoise(p * 2.3)) * 0.55 + th(floor(p * 30.0)) * 0.2 * aafade(30.0, px);
    return mix(road, paint * (0.8 + 0.3 * dot(road, vec3(0.33))), 0.82 * (1.0 - wear * 0.7));
  }
  if (kind == 8.0) {               // dressed stone (bridges, walls)
#ifdef TEX_STONE
    return texture2D(t_stone, vec2(along, wp.y) * s_stone).rgb;
#endif
    float row = floor(wp.y / 0.4); float x = along / 0.8 + 0.5 * mod(row, 2.0);
    float jx = min(fract(x), 1.0 - fract(x)) * 0.8, jy = min(fract(wp.y / 0.4), 1.0 - fract(wp.y / 0.4)) * 0.4;
    float joint = (1.0 - smoothstep(0.01, 0.01 + px, min(jx, jy))) * aafade(3.0, px);
    vec3 c = mix(vec3(0.62, 0.58, 0.50), vec3(0.72, 0.68, 0.60), th(vec2(floor(x), row)));
    return mix(c, vec3(0.45, 0.42, 0.37), joint * 0.6);
  }
  if (kind == 9.0) return vec3(0.10, 0.12, 0.11);
  if (kind == 10.0) {              // timber deck boards
    float b = fract(along / 0.14);
    return mix(vec3(0.42, 0.31, 0.21), vec3(0.52, 0.40, 0.28), th(vec2(floor(along / 0.14), floor(across / 3.0)))) * (0.85 + 0.15 * smoothstep(0.0, 0.1, b));
  }
  if (kind == 11.0) {              // brick pavers, herringbone-ish
    vec2 q = vec2(along, across) / vec2(0.2, 0.1);
    float r = floor(q.y); q.x += 0.5 * mod(r, 2.0);
    vec2 f = fract(q);
    float joint = (1.0 - smoothstep(0.04, 0.04 + px * 8.0, min(min(f.x, 1.0 - f.x) * 0.5, min(f.y, 1.0 - f.y)))) * aafade(10.0, px);
    vec3 c = mix(vec3(0.55, 0.30, 0.22), vec3(0.66, 0.42, 0.30), th(floor(q)));
    c = mix(c, vec3(0.62, 0.58, 0.52), joint * 0.7);
    vec4 fl = fallenLeaves(p + 4.0, 0.08, px); return mix(c, fl.rgb, fl.a);
  }
  return vec3(1.0, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------- buildings
// uv: (u along the wall from its start, m; v height above the base, m)
// aF0: part, wall length, eaves height, storeys
// aF1: material, flags, seed, ground-floor height
// aFac: facade-elevation candidate (index into FACADES) or -1
export const PART = { wall: 0, roof: 1, flat: 2, trim: 3, awning: 4, glass: 5, plain: 6, clock: 7, copper: 8, dark: 9, porch: 10, stone: 11, sign: 12 };
export const MAT = { brick_red: 0, brick_buff: 1, stone: 2, clapboard: 3, stucco: 4, glass: 5, metal: 6 };
export const FLAG = { store: 1, arched: 2, front: 4, church: 8, house: 16, theatre: 32, noWindows: 64, painted: 128 };

export function buildingMaterial(shared, assets) {
  const slots = ['brick_red', 'brick_buff', 'stone', 'clapboard', 'shingles', 'slate', 'roof_metal'];
  const td = texDefines(assets, slots);
  const uniforms = { ...td.uniforms };
  const defines = { ...td.defines };
  if (assets && assets.facadeArray) {
    defines.FACADES = '';
    uniforms.tFac = { value: assets.facadeArray };
    uniforms.uFacLayer = { value: assets.facadeLayer.map((v) => v) };
    uniforms.uFacAspect = { value: assets.facadeAspect.slice() };
    defines.N_FAC = String(assets.facadeLayer.length);
  }
  const m = painted({ color: 0xffffff }, {
    shared, key: 'town-building', defines, uniforms,
    vertHead: 'attribute vec4 aF0; attribute vec4 aF1; attribute float aFac; flat varying vec4 vF0; flat varying vec4 vF1; varying vec2 vUv2; flat varying float vFac;',
    vertMain: 'vF0 = aF0; vF1 = aF1; vUv2 = uv; vFac = aFac;',
    fragHead: `flat varying vec4 vF0; flat varying vec4 vF1; varying vec2 vUv2; flat varying float vFac;\n${texDecl(slots)}
#ifdef FACADES
uniform highp sampler2DArray tFac; uniform float uFacLayer[N_FAC]; uniform float uFacAspect[N_FAC];
#endif
${GLSL_COMMON}\n${GLSL_BUILDING}`,
    color: 'float glow = 0.0; diffuseColor.rgb = buildingColor(glow);',
    emissive: 'totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * glow * uNight * 0.9;',
  });
  return m;
}

const GLSL_BUILDING = /* glsl */`
vec3 trimColor(float s) {
  float h = fract(s * 7.13);
  return h < 0.3 ? vec3(0.86, 0.82, 0.70) : h < 0.45 ? vec3(0.17, 0.27, 0.21) : h < 0.58 ? vec3(0.38, 0.14, 0.12)
       : h < 0.75 ? vec3(0.92, 0.91, 0.86) : h < 0.88 ? vec3(0.30, 0.21, 0.14) : vec3(0.14, 0.16, 0.20);
}
vec3 signColor(float h) {
  return h < 0.2 ? vec3(0.16, 0.30, 0.24) : h < 0.4 ? vec3(0.42, 0.13, 0.13) : h < 0.55 ? vec3(0.15, 0.20, 0.34)
       : h < 0.7 ? vec3(0.12, 0.12, 0.12) : h < 0.85 ? vec3(0.80, 0.72, 0.52) : vec3(0.52, 0.36, 0.18);
}
vec3 paintColor(float s) {
  float h = fract(s * 3.71);
  return h < 0.3 ? vec3(0.90, 0.88, 0.82) : h < 0.45 ? vec3(0.88, 0.81, 0.62) : h < 0.58 ? vec3(0.85, 0.77, 0.50)
       : h < 0.7 ? vec3(0.60, 0.67, 0.54) : h < 0.82 ? vec3(0.57, 0.63, 0.70) : h < 0.92 ? vec3(0.66, 0.60, 0.52) : vec3(0.55, 0.22, 0.17);
}
vec3 wallMat(float mat, float s, vec2 uv, float px) {
  vec3 c;
  if (mat < 0.5 || (mat > 0.5 && mat < 1.5)) {
    bool red = mat < 0.5;
#if defined(TEX_BRICK_RED) && defined(TEX_BRICK_BUFF)
    return red ? texture2D(t_brick_red, uv * s_brick_red).rgb : texture2D(t_brick_buff, uv * s_brick_buff).rgb;
#endif
    vec3 base = red ? mix(vec3(0.56, 0.23, 0.15), vec3(0.64, 0.32, 0.19), fract(s * 5.3))
                    : mix(vec3(0.78, 0.66, 0.45), vec3(0.84, 0.74, 0.54), fract(s * 5.3));
    float ch = 0.077, bw = 0.215;
    float row = floor(uv.y / ch);
    float x = uv.x / bw + 0.5 * mod(row, 2.0);
    vec2 id = vec2(floor(x), row);
    float fx = fract(x), fy = fract(uv.y / ch);
    float de = min(min(fx, 1.0 - fx) * bw, min(fy, 1.0 - fy) * ch);
    float k = clamp((ch / px - 1.5) / 3.0, 0.0, 1.0);
    vec3 b = base * (0.86 + 0.26 * th(id + s));
    b = mix(b, base * (0.95 + 0.1 * tnoise(uv * 0.7)), 1.0 - k);
    float mort = (1.0 - smoothstep(0.005, 0.005 + px, de)) * k;
    c = mix(b, red ? vec3(0.74, 0.68, 0.60) : vec3(0.86, 0.82, 0.72), mort * 0.75);
  } else if (mat < 2.5) {
#ifdef TEX_STONE
    return texture2D(t_stone, uv * s_stone).rgb;
#endif
    float rh = 0.42, row = floor(uv.y / rh), x = uv.x / 0.9 + 0.5 * mod(row, 2.0);
    float de = min(min(fract(x), 1.0 - fract(x)) * 0.9, min(fract(uv.y / rh), 1.0 - fract(uv.y / rh)) * rh);
    vec3 base = mix(vec3(0.66, 0.61, 0.52), vec3(0.74, 0.70, 0.61), th(vec2(floor(x), row) + s));
    c = mix(base, vec3(0.80, 0.77, 0.70), (1.0 - smoothstep(0.008, 0.008 + px, de)) * aafade(2.0, px) * 0.8);
  } else if (mat < 3.5) {
#ifdef TEX_CLAPBOARD
    return texture2D(t_clapboard, uv * s_clapboard).rgb * paintColor(s) * 1.1;
#endif
    vec3 p = paintColor(s);
    float fy = fract(uv.y / 0.15);
    float k = aafade(6.7, px);
    c = p * mix(1.0, (0.86 + 0.16 * fy) * (1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.1, fy))), k);
  } else if (mat < 4.5) {
    c = mix(vec3(0.82, 0.78, 0.68), vec3(0.88, 0.85, 0.77), fract(s * 9.1)) * (0.94 + 0.08 * tnoise(uv * 2.0));
  } else if (mat < 5.5) {
    vec2 g = vec2(fract(uv.x / 1.5), fract(uv.y / 1.25));
    float mull = 1.0 - sbox(g, vec2(0.04), vec2(0.96), px / 1.4);
    vec3 gl = mix(vec3(0.26, 0.33, 0.38), vec3(0.62, 0.70, 0.74), clamp(uv.y / 14.0, 0.0, 1.0) * 0.6 + 0.15 * tnoise(uv * 0.3));
    c = mix(gl, vec3(0.22, 0.20, 0.18), mull);
  } else {
    float rib = smoothstep(0.0, px * 2.0 + 0.02, abs(fract(uv.x / 0.6) - 0.5) - 0.45);
    c = vec3(0.56, 0.58, 0.58) * (0.9 + 0.1 * rib);
  }
  return c;
}

// Signed-distance-ish window shape: kind 0 rectangle, 1 round arch, 2 pointed arch.
float winSD(vec2 q, float ww, float wh, float kind) {
  float hw = ww * 0.5;
  if (kind < 0.5) { vec2 d = abs(q - vec2(0.0, wh * 0.5)) - vec2(hw, wh * 0.5); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  float rh = kind < 1.5 ? wh - hw : wh - 0.866 * ww;
  vec2 d = abs(q - vec2(0.0, rh * 0.5)) - vec2(hw, rh * 0.5);
  float sr = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  float sc = kind < 1.5 ? length(q - vec2(0.0, rh)) - hw
                        : max(length(q - vec2(hw, rh)) - ww, length(q - vec2(-hw, rh)) - ww);
  return min(sr, max(sc, rh - q.y));
}

vec3 glassColor(vec2 q, float wh, float h, out float lit) {
  vec3 g = mix(vec3(0.17, 0.20, 0.24), vec3(0.50, 0.58, 0.64), clamp(q.y / wh, 0.0, 1.0) * 0.55 + 0.2 * h);
  float streak = smoothstep(0.1, 0.0, abs(fract(q.x * 0.6 + q.y * 0.35 + h) - 0.5) - 0.32) * 0.18;
  g += streak;
  // curtains / blinds
  if (h > 0.55) g = mix(g, vec3(0.80, 0.72, 0.56), 0.55 * step(abs(q.x) + 0.15, 0.6) * step(wh * (0.35 + 0.4 * fract(h * 7.0)), q.y));
  lit = step(0.42, fract(h * 13.7));
  return g;
}

vec3 windowAt(vec2 q, float ww, float wh, float kind, vec3 wall, vec3 trim, vec3 sill, float h, float px, out float glow) {
  glow = 0.0;
  float d = winSD(q, ww, wh, kind);
  float aa = px * 0.8;
  vec3 c = wall;
  // hood / lintel and sill
  if (kind > 0.5) {
    float rh = kind < 1.5 ? wh - ww * 0.5 : wh - 0.866 * ww;
    float band = smoothstep(-aa, aa, d) * (1.0 - smoothstep(0.13 - aa, 0.13 + aa, d)) * step(rh - 0.02, q.y);
    c = mix(c, sill, band);
    float key = sbox(q, vec2(-0.09, wh - 0.02), vec2(0.09, wh + 0.17), aa);
    c = mix(c, sill * 0.95, key);
  } else {
    c = mix(c, sill, sbox(q, vec2(-ww * 0.5 - 0.12, wh), vec2(ww * 0.5 + 0.12, wh + 0.2), aa));
  }
  c = mix(c, sill, sbox(q, vec2(-ww * 0.5 - 0.08, -0.1), vec2(ww * 0.5 + 0.08, 0.0), aa));
  // frame, glass and sash bars
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside > 0.0) {
    float lit;
    vec3 g = glassColor(q, wh, h, lit);
    float frame = smoothstep(-0.075 - aa, -0.075 + aa, d);
    float sash = 1.0 - smoothstep(0.022, 0.022 + aa, abs(q.y - wh * 0.48));
    float mull = ww > 0.8 ? 1.0 - smoothstep(0.018, 0.018 + aa, abs(q.x)) : 0.0;
    float bars = max(frame, max(sash, mull) * aafade(25.0, px));
    vec3 w = mix(g * (0.8 + 0.2 * smoothstep(-0.25, -0.05, -d)), trim, bars);
    c = mix(c, w, inside);
    glow = lit * inside * (1.0 - bars);
  }
  return c;
}

vec3 buildingColor(out float glow) {
  glow = 0.0;
  float part = floor(vF0.x + 0.5), len = vF0.y, eaves = vF0.z, storeys = max(1.0, vF0.w);
  float mat = vF1.x, flags = vF1.y, seed = vF1.z, gfh = vF1.w;
  vec2 uv = vUv2;
  float px = max(length(fwidth(uv)), 1e-4);
  vec3 trim = trimColor(seed);

  if (part == 1.0) {                       // pitched roof
    float h = fract(seed * 11.3);
    vec3 rc = h < 0.3 ? vec3(0.24, 0.23, 0.23) : h < 0.55 ? vec3(0.33, 0.28, 0.25) : h < 0.7 ? vec3(0.40, 0.23, 0.18)
            : h < 0.88 ? vec3(0.29, 0.32, 0.37) : vec3(0.31, 0.43, 0.37);
    vec3 c;
    if (h >= 0.88) {
#ifdef TEX_ROOF_METAL
      c = texture2D(t_roof_metal, uv * s_roof_metal).rgb;
#else
      float seam = 1.0 - smoothstep(0.0, 0.02 + px, abs(fract(uv.x / 0.45) - 0.5) - 0.46);
      c = rc * (0.92 + 0.12 * tnoise(uv * 0.5)) * (1.0 - 0.25 * seam * aafade(3.0, px));
#endif
    } else {
#if defined(TEX_SHINGLES) && defined(TEX_SLATE)
      c = (h > 0.7 && h < 0.88) ? texture2D(t_slate, uv * s_slate).rgb : texture2D(t_shingles, uv * s_shingles).rgb * (h < 0.3 ? vec3(0.9) : h < 0.55 ? vec3(1.05, 0.98, 0.92) : vec3(1.15, 0.85, 0.75));
#else
      float rowh = 0.18, row = floor(uv.y / rowh), x = uv.x / 0.32 + 0.5 * mod(row, 2.0);
      float fy = fract(uv.y / rowh);
      float k = aafade(1.0 / rowh, px);
      float tab = min(fract(x), 1.0 - fract(x)) * 0.32;
      float shade = mix(1.0, (0.78 + 0.3 * fy) * (1.0 - 0.3 * (1.0 - smoothstep(0.004, 0.004 + px, tab))), k);
      c = rc * (0.86 + 0.22 * th(vec2(floor(x), row) + seed)) * shade;
      c = mix(c, rc, 1.0 - k * 0.8);
#endif
    }
    c *= 0.9 + 0.15 * tfbm(uv * 0.3 + seed * 10.0);
    vec4 fl = fallenLeaves(uv + seed * 50.0, 0.06, px);
    return mix(c, fl.rgb, fl.a);
  }
  if (part == 2.0) {                       // flat roof: tar and gravel
    vec3 c = mix(vec3(0.40, 0.39, 0.37), vec3(0.50, 0.48, 0.44), tfbm(uv * 0.2 + seed));
    c *= 0.9 + 0.12 * th(floor(uv * 20.0)) * aafade(20.0, px);
    vec4 fl = fallenLeaves(uv + seed * 50.0, 0.05, px);
    return mix(c, fl.rgb, fl.a);
  }
  if (part == 3.0) {                       // cornice and trim: brackets along the face
    float br = 1.0 - smoothstep(0.0, px + 0.01, abs(fract(uv.x / 0.9) - 0.5) - 0.42);
    float dent = step(0.5, fract(uv.x / 0.18)) * aafade(5.5, px);
    vec3 c = trim * (0.85 + 0.15 * smoothstep(0.0, 0.3, fract(uv.y)));
    return c * (1.0 - 0.18 * br) * (1.0 - 0.08 * dent);
  }
  if (part == 4.0) {                       // awning stripes
    vec3 a = signColor(fract(seed * 3.3 + floor(uv.y * 0.0)));
    float plain = step(0.6, fract(seed * 5.1));
    float stripe = step(0.5, fract(uv.x / 0.32));
    vec3 c = mix(a, mix(vec3(0.90, 0.87, 0.78), a, plain), stripe * (1.0 - plain));
    return c * (0.9 + 0.1 * tnoise(uv * 3.0));
  }
  if (part == 5.0) return wallMat(5.0, seed, uv, px);
  if (part == 6.0) return wallMat(mat, seed, uv, px) * 0.95;
  if (part == 7.0) {                       // clock face: uv in [-1, 1]
    float r = length(uv);
    bool blue = bitf(flags, 1.0) > 0.5;          // City Hall's blue face with gilded hands
    vec3 face = blue ? vec3(0.10, 0.17, 0.45) : vec3(0.93, 0.91, 0.84), ink = blue ? vec3(0.86, 0.68, 0.28) : vec3(0.1);
    vec3 c = mix(face, blue ? vec3(0.92, 0.9, 0.84) : vec3(0.15), smoothstep(0.86, 0.9, r));
    float a = atan(uv.x, uv.y);
    float ticks = step(0.75, r) * step(r, 0.86) * step(0.93, cos(a * 12.0));
    vec2 hh = vec2(sin(1.1), cos(1.1)), mm = vec2(sin(4.2), cos(4.2));
    float hand = max(step(abs(dot(uv, vec2(hh.y, -hh.x))), 0.035) * step(0.0, dot(uv, hh)) * step(dot(uv, hh), 0.45),
                     step(abs(dot(uv, vec2(mm.y, -mm.x))), 0.025) * step(0.0, dot(uv, mm)) * step(dot(uv, mm), 0.7));
    return mix(c, ink, max(ticks, hand));
  }
  if (part == 8.0) {                       // copper / slate spires
    vec3 c = fract(seed * 7.7) < 0.5 ? vec3(0.36, 0.56, 0.49) : vec3(0.19, 0.20, 0.23);
    float rowh = 0.25, fy = fract(uv.y / rowh);
    return c * (0.85 + 0.2 * fy * aafade(4.0, px)) * (0.9 + 0.15 * tnoise(uv * vec2(3.0, 0.3)));
  }
  if (part == 9.0) return vec3(0.11, 0.12, 0.12) * (0.9 + 0.2 * tnoise(uv * 4.0));
  if (part == 10.0) return trimColor(seed + 0.37) * (0.9 + 0.1 * smoothstep(0.0, 0.1, fract(uv.x / 0.14)));
  if (part == 11.0) return wallMat(2.0, seed, uv, px);
  if (part == 12.0) {                      // theatre marquee / blade sign
    float h = step(0.5, fract(uv.x * 2.0 + uv.y * 2.0));
    glow = 0.8;
    return mix(vec3(0.45, 0.10, 0.10), vec3(0.95, 0.85, 0.55), sbox(fract(uv * 3.0), vec2(0.3), vec2(0.7), 0.05) * 0.8);
  }

  // ---- walls
  bool store = bitf(flags, 1.0) > 0.5, arched = bitf(flags, 2.0) > 0.5, front = bitf(flags, 4.0) > 0.5;
  bool church = bitf(flags, 8.0) > 0.5, house = bitf(flags, 16.0) > 0.5, theatre = bitf(flags, 32.0) > 0.5;
  bool nowin = bitf(flags, 64.0) > 0.5;
  vec3 wall = wallMat(mat, seed, uv, px);
  bool brick = mat < 1.5;
  vec3 sill = brick ? (mat < 0.5 ? vec3(0.82, 0.76, 0.62) : vec3(0.70, 0.40, 0.28)) : trim;
  if (mat > 2.5 && mat < 3.5) sill = vec3(0.92, 0.91, 0.86);
  float y = uv.y;
  // painted light: darker toward the ground, mottled
  float ao = 0.72 + 0.28 * smoothstep(0.0, 1.4, y);
  wall *= 0.93 + 0.12 * tfbm(uv * 0.25 + seed * 7.0);

#ifdef FACADES
  if (vFac >= -0.5 && y < eaves) {
    int fi = int(vFac + 0.5);
    float L = uFacLayer[fi];
    if (L >= 0.0) {
      // tile the elevation along the wall at its own aspect, stretched to whole tiles
      float n = max(1.0, floor(len / (eaves * uFacAspect[fi]) + 0.5));
      vec2 fc = vec2(uv.x / (len / n), clamp(y / eaves, 0.0, 1.0));
      vec3 c = textureGrad(tFac, vec3(fract(fc.x), fc.y, L), dFdx(fc), dFdy(fc)).rgb;
      return c * (0.86 + 0.14 * smoothstep(0.0, 0.8, y));
    }
  }
#endif

  if (y > eaves - 0.02) return wall * ao;        // gables and parapets: plain
  // foundation band
  if (y < 0.45 && !store) { wall = mix(wall, vec3(0.55, 0.52, 0.47) * (0.9 + 0.2 * tnoise(uv * 3.0)), 0.85); }
  // a corbelled band under the eaves of brick commercial blocks
  if (brick && !house && eaves > 6.0 && y > eaves - 0.55) {
    float dent = step(0.5, fract(uv.x / 0.32)) * aafade(3.0, px);
    wall = mix(wall, wall * mix(1.05, 0.7, dent * smoothstep(eaves - 0.5, eaves - 0.35, y)), 0.9);
  }
  if (nowin || len < 1.6) return wall * ao;

  float upperH = storeys > 1.5 ? (eaves - gfh) / (storeys - 1.0) : eaves;
  float st, sy, sh;
  if (storeys < 1.5) { st = 0.0; sy = y; sh = eaves; }
  else if (y < gfh) { st = 0.0; sy = y; sh = gfh; }
  else { st = 1.0 + floor((y - gfh) / upperH); sy = y - gfh - (st - 1.0) * upperH; sh = upperH; }
  // belt course between storeys on commercial brick
  if (!house && brick && st > 0.5 && sy < 0.14) wall = mix(wall, sill, 0.85);

  // ---- storefront
  if (store && front && st == 0.0) {
    float units = max(1.0, floor(len / 7.0 + 0.4)), uw = len / units;
    float ui = floor(uv.x / uw), ux = uv.x - ui * uw, uh = th(vec2(ui, seed * 17.0));
    vec3 tc = trimColor(seed + uh);
    float signB = gfh - 0.95, signT = gfh - 0.25;
    float aa = px;
    vec3 c = wall;
    float pil = 0.38;
    if (ux < pil || ux > uw - pil) return wall * ao;            // brick piers
    if (y > signT) return mix(wall, sill, 0.9) * ao;            // storefront cornice
    if (y > signB) {                                            // sign band, blank board
      vec3 s = signColor(uh);
      float mould = 1.0 - sbox(vec2(ux, y), vec2(pil + 0.06, signB + 0.07), vec2(uw - pil - 0.06, signT - 0.07), aa);
      return mix(s, tc * 1.1, mould) * ao;
    }
    float doorX = uh < 0.5 ? pil + 0.25 : uw - pil - 1.35;
    bool door = ux > doorX && ux < doorX + 1.1;
    if (door) {
      if (y > 2.35) { float lit; vec3 g = glassColor(vec2(ux - doorX - 0.55, y - 2.35), 0.5, uh, lit); glow = lit; return mix(g, tc, 1.0 - sbox(vec2(ux, y), vec2(doorX + 0.06, 2.42), vec2(doorX + 1.04, signB - 0.06), aa)); }
      vec3 dc = signColor(fract(uh * 3.7)) * 0.9;
      float pane = sbox(vec2(ux, y), vec2(doorX + 0.18, 1.0), vec2(doorX + 0.92, 2.15), aa);
      float lit; vec3 g = glassColor(vec2(ux - doorX - 0.55, y - 1.0), 1.2, uh, lit);
      glow = lit * pane * 0.8;
      vec3 c2 = mix(dc, g, pane);
      return mix(c2, vec3(0.75, 0.62, 0.30), step(abs(ux - (doorX + (uh < 0.5 ? 0.95 : 0.15))), 0.03) * step(abs(y - 1.05), 0.12));
    }
    if (y < 0.55) {                                             // kickplate panels
      float inset = sbox(vec2(fract(ux / 1.2), y), vec2(0.08, 0.1), vec2(0.92, 0.45), aa / 1.2);
      return tc * (0.75 + 0.2 * inset) * ao;
    }
    // display window with mullions and a transom row
    float transom = signB - 0.6;
    float mx = fract((ux - pil) / 1.6);
    float bars = max(1.0 - smoothstep(0.03, 0.03 + aa, min(mx, 1.0 - mx) * 1.6), 1.0 - smoothstep(0.035, 0.035 + aa, abs(y - transom)));
    bars = max(bars, 1.0 - sbox(vec2(ux, y), vec2(pil + 0.08, 0.62), vec2(uw - pil - 0.08, signB - 0.06), aa));
    // what is behind the glass: warm interior with goods
    vec2 cell = floor(vec2(ux * 2.2, y * 3.0));
    vec3 goods = mix(vec3(0.20, 0.15, 0.11), signColor(th(cell + uh * 13.0)) * 1.3, 0.35 * step(0.45, th(cell + 2.0)) * step(y, 1.9));
    vec3 g = mix(goods, vec3(0.55, 0.62, 0.66), 0.18 + 0.25 * smoothstep(0.0, 2.5, y));
    g += smoothstep(0.12, 0.0, abs(fract(ux * 0.35 + y * 0.25 + uh) - 0.5) - 0.3) * 0.16;
    glow = (1.0 - bars) * 0.9;
    return mix(g, tc, bars);
  }

  // ---- windows
  float bay = church ? 4.2 : house ? 3.1 : 2.7;
  float nb = max(1.0, floor(len / bay + 0.35)), bw = len / nb;
  float bi = floor(uv.x / bw), bx = uv.x - (bi + 0.5) * bw;
  float bh = th(vec2(bi, st) + seed * 31.7);
  // a house's front door in the middle bay
  if (house && front && st == 0.0 && bi == floor(nb * 0.5)) {
    vec3 dc = signColor(fract(seed * 2.9 + 0.2));
    float aa = px;
    float frameD = sbox(vec2(bx, y), vec2(-0.62, 0.35), vec2(0.62, 2.75), aa);
    float doorD = sbox(vec2(bx, y), vec2(-0.48, 0.35), vec2(0.48, 2.45), aa);
    float panel = sbox(vec2(fract((bx + 0.48) / 0.48), y), vec2(0.15, 0.6), vec2(0.85, 1.5), aa / 0.48) + sbox(vec2(fract((bx + 0.48) / 0.48), y), vec2(0.15, 1.7), vec2(0.85, 2.3), aa / 0.48);
    vec3 c = mix(wall, trim, frameD);
    c = mix(c, dc * (1.0 - 0.15 * panel), doorD);
    float tr = sbox(vec2(bx, y), vec2(-0.48, 2.5), vec2(0.48, 2.7), aa);
    float lit; vec3 g = glassColor(vec2(bx, y - 2.5), 0.2, seed, lit); glow = lit * tr;
    c = mix(c, g, tr);
    return c * ao;
  }
  bool skip = (!front && bh > (house ? 0.6 : 0.35)) || (!front && !house && st == 0.0) || (store && st == 0.0);
  if (theatre && st == 0.0) skip = true;
  if (skip) return wall * ao;
  float ww = church ? 1.1 : min(bw * 0.48, house ? 1.0 : 0.95);
  float wh = church ? min(sh * 0.72, 6.0) : min(sh * (house ? 0.55 : 0.58), 2.3);
  float wy0 = church ? sh * 0.22 : (st == 0.0 ? max(0.85, sh * 0.3) : sh * 0.25);
  float kind = church ? 2.0 : arched ? (bitf(flags, 128.0) > 0.5 ? 0.0 : 1.0) : 0.0;
  float g;
  vec3 c = windowAt(vec2(bx, sy - wy0), ww, wh, kind, wall, mat > 2.5 && mat < 3.5 ? sill : trim, sill, bh, px, g);
  // shutters on clapboard houses
  if (house && mat > 2.5 && mat < 3.5 && fract(seed * 4.3) < 0.5) {
    float sh2 = sbox(vec2(abs(bx), sy - wy0), vec2(ww * 0.5 + 0.06, 0.0), vec2(ww * 0.5 + 0.48, wh), px);
    c = mix(c, vec3(0.16, 0.27, 0.20) * (0.9 + 0.1 * step(0.5, fract((sy - wy0) / 0.08))), sh2);
  }
  glow = g * step(0.3, fract(bh * 5.3));
  return c * ao;
}
`;

// ---------------------------------------------------------------- water
export function waterMaterial(shared, assets) {
  const td = texDefines(assets, ['water']);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLevel: { value: 0 } }]),
    defines: td.defines,
    fog: true, transparent: false,
    vertexShader: /* glsl */`
      varying vec3 vWP;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNight;
      ${texDecl(['water'])}
      varying vec3 vWP;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      ${GLSL_COMMON}
      void main() {
        vec2 p = vWP.xz;
        float px = max(length(fwidth(p)), 1e-4);
        float t = uTime;
        // two drifting ripple layers make a painted, gently moving normal
        vec2 q1 = p * 0.35 + vec2(t * 0.05, t * 0.03), q2 = p * 1.3 - vec2(t * 0.09, -t * 0.04);
        float e = 0.08;
        float h0 = tnoise(q1) + 0.35 * tnoise(q2);
        vec2 grad = vec2(tnoise(q1 + vec2(e, 0.0)) + 0.35 * tnoise(q2 + vec2(e, 0.0)) - h0, tnoise(q1 + vec2(0.0, e)) + 0.35 * tnoise(q2 + vec2(0.0, e)) - h0) / e;
        vec3 n = normalize(vec3(-grad.x * 0.12, 1.0, -grad.y * 0.12));
        vec3 v = normalize(cameraPosition - vWP);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 deep = vec3(0.12, 0.25, 0.24), shallow = vec3(0.26, 0.38, 0.30);
        vec3 c = mix(deep, shallow, 0.4 * tfbm(p * 0.05));
#ifdef TEX_WATER
        c = mix(texture2D(t_water, p * s_water + vec2(t * 0.006, t * 0.002) + n.xz * 0.6).rgb, texture2D(t_water, mat2(0.8, -0.6, 0.6, 0.8) * p * s_water * 0.7 - vec2(t * 0.004)).rgb, 0.5) * 0.95;
#endif
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(r.y * 1.6, 0.0, 1.0));
        c = mix(c, sky * 0.85, 0.15 + 0.55 * fres);
        float glint = pow(max(dot(r, uSunDir), 0.0), 180.0);
        c += uSunColor * glint * 1.4 * (1.0 - uNight);
        // painted ripple highlights
        float band = smoothstep(0.47, 0.5, tnoise(q2 * 1.7)) * (1.0 - smoothstep(0.5, 0.53, tnoise(q2 * 1.7)));
        c += vec3(0.14, 0.16, 0.14) * band * aafade(1.0, px);
        // floating leaves
        vec4 fl = fallenLeaves(p + vec2(t * 0.08, t * 0.03), 0.035, px);
        c = mix(c, fl.rgb * 0.9, fl.a);
        c *= mix(1.0, 0.35, uNight);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  Object.assign(m.uniforms, { uScale: shared.uScale, uTime: shared.uTime, uSkyTop: shared.uSkyTop, uSkyHorizon: shared.uSkyHorizon, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uNight: shared.uNight }, td.uniforms);
  return m;
}

// ---------------------------------------------------------------- vertex-coloured props
export function propMaterial(shared, opts = {}) {
  return painted({ color: 0xffffff, vertexColors: true, ...opts }, {
    shared, key: 'town-prop' + (opts.side || ''),
    color: 'diffuseColor.rgb *= 0.94 + 0.12 * tnoise(vWP.xz * 3.0 + vWP.y * 2.0);',
    emissive: 'totalEmissiveRadiance += vColor.rgb * step(0.97, vColor.r) * step(0.75, vColor.g) * step(vColor.b, 0.7) * uNight * 1.6;',
  });
}
