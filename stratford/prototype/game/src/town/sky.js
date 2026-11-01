// Painted autumn sky (gradient, soft clouds, sun glow), a low warm sun whose
// shadow camera follows the focus tightly, hemisphere fill, and haze tinted
// to the horizon. Extents scale with the creature (setScale).
import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

export function createSky(scene, shared, renderer, quality) {
  const group = new THREE.Group(); group.name = 'sky';
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSkyTop: shared.uSkyTop, uSkyHorizon: shared.uSkyHorizon, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uTime: shared.uTime, uNight: shared.uNight },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSkyTop, uSkyHorizon, uSunDir, uSunColor; uniform float uTime, uNight;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
        c = mix(c, uSkyHorizon * 0.92, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, uSunDir), 0.0);
        c += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 60.0) * 0.5) * (1.0 - uNight * 0.8);
        c += uSunColor * smoothstep(0.9993, 0.9997, sd) * 2.0 * (1.0 - uNight);
        // soft painted clouds on a dome
        if (h > 0.0) {
          vec2 p = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
          float n = tfbm(p * 0.9) * 0.75 + tnoise(p * 3.1) * 0.25;
          float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.25, h);
          vec3 lit = mix(vec3(1.0, 0.95, 0.88), uSunColor, 0.35) * (1.0 - uNight * 0.85);
          vec3 shade = mix(uSkyHorizon, vec3(0.62, 0.62, 0.72), 0.5) * (1.0 - uNight * 0.7);
          float side = smoothstep(0.4, 0.9, tnoise(p * 2.0 + 3.0));
          c = mix(c, mix(shade, lit, 0.45 + 0.55 * side + pow(sd, 3.0) * 0.4), cl * 0.85);
        }
        // stars at night
        float st = step(0.997, th(floor(d.xz / (abs(d.y) + 0.3) * 260.0))) * uNight * smoothstep(0.1, 0.4, h);
        c += vec3(st);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(geo, mat); dome.frustumCulled = false; dome.renderOrder = -1000; dome.scale.setScalar(1000);
  group.add(dome);

  const hemi = new THREE.HemisphereLight(0xb9c9e6, 0x6b5a40, 1.15);
  const sun = new THREE.DirectionalLight(0xffd6a0, 2.7);
  sun.castShadow = quality !== 'low';
  const sm = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  group.add(hemi, sun, sun.target);
  if (renderer && sun.castShadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; }

  scene.fog = new THREE.Fog(0xe9d6b6, 150, 1800);
  scene.add(group);

  let hours = 16.3, extent = 18, fogFar = 1800;
  const sunDir = new THREE.Vector3();
  const K = {
    day: { top: new THREE.Color(0x5e8fcf), hor: new THREE.Color(0xf2dcb8), sun: new THREE.Color(0xffd29a), hs: new THREE.Color(0xbccbe8), hg: new THREE.Color(0x6e5c40) },
    gold: { top: new THREE.Color(0x6a86c0), hor: new THREE.Color(0xf6c48e), sun: new THREE.Color(0xffb26a), hs: new THREE.Color(0xa9b4d6), hg: new THREE.Color(0x6a5038) },
    dusk: { top: new THREE.Color(0x2b3a6a), hor: new THREE.Color(0xd58a6a), sun: new THREE.Color(0xff8a50), hs: new THREE.Color(0x6a6c94), hg: new THREE.Color(0x3a3028) },
    night: { top: new THREE.Color(0x0a1028), hor: new THREE.Color(0x26304a), sun: new THREE.Color(0x8aa0d0), hs: new THREE.Color(0x30406a), hg: new THREE.Color(0x15151a) },
  };
  const tmp = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
  const mix = (a, b, t) => { for (const k in tmp) tmp[k].copy(a[k]).lerp(b[k], t); };

  function setTimeOfDay(h) {
    hours = ((h % 24) + 24) % 24;
    // mid-October at 43.4 N: sunrise ~7:35, sunset ~18:35, noon altitude ~38 deg
    const t = (hours - 7.6) / 11.0;
    const elev = Math.sin(Math.PI * t) * 38 * Math.PI / 180;
    const az = Math.PI * Math.min(1.2, Math.max(-0.2, t));       // 0 east, pi/2 south, pi west
    const ce = Math.cos(Math.max(elev, -0.2));
    sunDir.set(Math.cos(az) * ce, Math.sin(Math.max(elev, 0.03)), Math.sin(az) * ce).normalize();
    const e = elev * 180 / Math.PI;
    if (e > 20) mix(K.day, K.day, 0);
    else if (e > 6) mix(K.gold, K.day, (e - 6) / 14);
    else if (e > -2) mix(K.dusk, K.gold, (e + 2) / 8);
    else mix(K.night, K.dusk, Math.max(0, (e + 10) / 8));
    const night = THREE.MathUtils.clamp((2 - e) / 10, 0, 1);
    shared.uSkyTop.value.copy(tmp.top); shared.uSkyHorizon.value.copy(tmp.hor);
    shared.uSunColor.value.copy(tmp.sun); shared.uSunDir.value.copy(e > -2 ? sunDir : new THREE.Vector3(0.3, 0.8, -0.4).normalize());
    shared.uNight.value = night;
    sun.color.copy(tmp.sun); sun.intensity = THREE.MathUtils.lerp(2.8, 0.35, night) * (e > -2 ? 1 : 0.6);
    hemi.color.copy(tmp.hs); hemi.groundColor.copy(tmp.hg); hemi.intensity = THREE.MathUtils.lerp(1.15, 0.5, night);
    scene.fog.color.copy(tmp.hor).lerp(tmp.top, 0.12);
  }
  setTimeOfDay(hours);

  // scale: creature body length (m). Shadow box and haze follow it.
  function setScale(scale) {
    extent = THREE.MathUtils.clamp(scale * 70, 1.2, 30);
    fogFar = THREE.MathUtils.clamp(scale * 7200, 160, 1900);
    scene.fog.far = fogFar; scene.fog.near = fogFar * 0.07;
    const sc = sun.shadow.camera;
    sc.left = -extent; sc.right = extent; sc.top = extent; sc.bottom = -extent;
    sc.near = 0.1; sc.far = extent * 8 + 60;
    sc.updateProjectionMatrix();
    sun.shadow.normalBias = Math.max(0.0015, extent * 0.0012);
  }
  const _v = new THREE.Vector3();
  function update(camera, focus) {
    if (camera) dome.position.copy(camera.position);
    if (camera && camera.far) dome.scale.setScalar(camera.far * 0.9);
    const f = focus || (camera && camera.position);
    if (!f) return;
    // snap the shadow camera to texels so shadows do not shimmer
    const texel = (2 * extent) / sun.shadow.mapSize.x;
    _v.copy(f);
    const dist = extent * 4 + 30;
    sun.target.position.set(Math.round(_v.x / texel) * texel, Math.round(_v.y / texel) * texel, Math.round(_v.z / texel) * texel);
    sun.position.copy(sun.target.position).addScaledVector(shared.uSunDir.value, dist);
    sun.target.updateMatrixWorld();
  }
  return {
    group, sun, hemi, setTimeOfDay, setScale, update, get hours() { return hours; },
    dispose() { scene.remove(group); geo.dispose(); mat.dispose(); sun.shadow.map?.dispose(); scene.fog = null; },
  };
}
