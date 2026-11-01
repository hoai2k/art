// A small test yard on the World contract (ARCHITECTURE.md): flat grass, a road with a 15 cm curb
// and sidewalk, a ramp, steps, boxes of several heights, a climbable brick building with a flat
// roof, a smooth glass wall, a wooden fence, a tree trunk with branches and a small pond. Every
// piece is in the collider with its SURFACE id. The shell uses it as the fallback world; the
// squirrel bench (lab/squirrel.html) and tests run on it.
//
// Layout (metres; +x east, -z north; spawn at the origin facing north):
//   road z 2..8 (y 0) | sidewalk slab z -2..2, top 0.15 (curbs both sides) | yard to the north
//   boxes  x -3.6..3, z -5   heights 0.1 0.2 0.3 0.45 0.7 1.0     steps x -9..-7 rising north
//   ramp   x 6..8, z -4..-8 up to a 1 m platform                    pond at (12, -3), r 3
//   brick building x 2..6, z -14..-18, 3 m, flat roof              glass wall x -6..-2, z -14..-14.4
//   fence  x 9..14, z -12, 1.2 m (wood)                            tree at (-10, -12), trunk r 0.25
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { SURFACE } from './surface.js';

const COLORS = {
  [SURFACE.ground]: 0x8f8a6e, [SURFACE.road]: 0x55575c, [SURFACE.sidewalk]: 0xb9b2a4, [SURFACE.grass]: 0x6f8f45,
  [SURFACE.wall_brick]: 0xa2523a, [SURFACE.wall_stone]: 0xa59d8c, [SURFACE.wall_wood]: 0x9a7650, [SURFACE.wall_smooth]: 0x9fc4cf,
  [SURFACE.roof]: 0x5c5450, [SURFACE.bark]: 0x6e5f52, [SURFACE.branch]: 0x6a5a4b, [SURFACE.water_bed]: 0x5d5a40,
  [SURFACE.prop]: 0xc49a5c, [SURFACE.fence]: 0xb8925f,
};

const POND = { x: 12, z: -3, r: 3, depth: 0.6, level: -0.05 };

function groundHeight(x, z) {
  const d = Math.hypot(x - POND.x, z - POND.z);
  if (d >= POND.r) return 0;
  const t = d / POND.r;
  return -POND.depth * (1 - t * t) * (1 - t * t) * 1.15 + 0.0;
}

function tag(geo, surface) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  const n = geo.attributes.position.count;
  geo.setAttribute('surface', new THREE.BufferAttribute(new Uint8Array(n).fill(surface), 1));
  return geo;
}

// a box with separate surfaces for its sides and top
function box(cx, cy, cz, sx, sy, sz, side, top = side, rotY = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, s = new Uint8Array(n), nrm = g.attributes.normal;
  for (let i = 0; i < n; i++) s[i] = nrm.getY(i) > 0.5 ? top : side;
  g.setAttribute('surface', new THREE.BufferAttribute(s, 1));
  if (rotY) g.rotateY(rotY);
  g.translate(cx, cy, cz);
  return g;
}

function cylinder(r0, r1, len, surface, seg = 16) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 4, false);
  return tag(g, surface);
}

export async function createStandInWorld({ THREE: _T, renderer, scene } = {}) {
  scene = scene || new THREE.Scene();
  const parts = [];
  // ground: a height field with the pond bowl; road strip has its own surface
  const N = 96, size = 48;
  const gg = new THREE.PlaneGeometry(size, size, N, N).rotateX(-Math.PI / 2);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)));
  gg.computeVertexNormals();
  const ground = gg.toNonIndexed(); ground.deleteAttribute('uv');
  {
    const p = ground.attributes.position, s = new Uint8Array(p.count);
    for (let t = 0; t < p.count; t += 3) {
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
      const id = Math.hypot(cx - POND.x, cz - POND.z) < POND.r ? SURFACE.water_bed : (cz > 2 && cz < 8 ? SURFACE.road : SURFACE.grass);
      s[t] = s[t + 1] = s[t + 2] = id;
    }
    ground.setAttribute('surface', new THREE.BufferAttribute(s, 1));
  }
  parts.push(ground);
  // sidewalk slab with 15 cm curbs
  parts.push(box(0, 0.075, 0, 40, 0.15, 4, SURFACE.sidewalk));
  // boxes of several heights
  [0.1, 0.2, 0.3, 0.45, 0.7, 1.0].forEach((h, i) => parts.push(box(-3.6 + i * 1.3, h / 2, -5, 0.6, h, 0.6, SURFACE.prop)));
  // steps rising to the north
  for (let i = 0; i < 5; i++) parts.push(box(-8, 0.15 * (i + 1) / 2, -4 - i * 0.3 - (4 - i) * 0.15, 2, 0.15 * (i + 1), 0.3 + (4 - i) * 0.3, SURFACE.sidewalk));
  parts.push(box(-8, 0.375, -6.5, 2, 0.75, 1.5, SURFACE.sidewalk));
  // ramp to a 1 m platform
  {
    const len = 4, h = 1, ang = Math.atan2(h, len), L = Math.hypot(len, h);
    const g = new THREE.BoxGeometry(2, 0.1, L).toNonIndexed(); g.deleteAttribute('uv');
    g.translate(0, -0.05, 0); g.rotateX(ang); g.translate(7, h / 2, -4 - len / 2);
    const s = new Uint8Array(g.attributes.position.count);
    for (let i = 0; i < s.length; i++) s[i] = g.attributes.normal.getY(i) > 0.5 ? SURFACE.ground : SURFACE.prop;
    g.setAttribute('surface', new THREE.BufferAttribute(s, 1)); parts.push(g);
    parts.push(box(7, 0.5, -9, 2, 1, 2, SURFACE.prop, SURFACE.ground));
  }
  // brick building with a flat roof (and a parapet-free edge to top out onto)
  parts.push(box(4, 1.5, -16, 4, 3, 4, SURFACE.wall_brick, SURFACE.roof));
  // smooth glass wall (not climbable)
  parts.push(box(-4, 1.5, -14.2, 4, 3, 0.4, SURFACE.wall_smooth, SURFACE.roof));
  // wooden fence with a cap rail
  parts.push(box(11.5, 0.6, -12, 5, 1.2, 0.05, SURFACE.fence));
  // tree: trunk and two branches
  const TREE = { x: -10, z: -12 };
  { const t = cylinder(0.32, 0.22, 7, SURFACE.bark, 20); t.translate(TREE.x, 3.5, TREE.z); parts.push(t); }
  for (const [y, ang, len] of [[2.4, 0.3, 2.4], [3.8, 2.6, 2.0], [5.0, -1.4, 1.6]]) {
    const b = cylinder(0.09, 0.05, len, SURFACE.branch, 12);
    b.rotateZ(-Math.PI / 2); b.translate(len / 2, 0, 0); b.rotateZ(0.12); b.rotateY(ang); b.translate(TREE.x, y, TREE.z);
    parts.push(b);
  }

  const geo = mergeGeometries(parts.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'surface'].includes(k)) g.deleteAttribute(k); return g; }));
  geo.boundsTree = new MeshBVH(geo);
  const collider = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  collider.name = 'stand-in-collider';
  collider.updateMatrixWorld(true);

  // visuals: the same geometry, coloured per surface
  const vis = geo.clone();
  {
    const s = vis.attributes.surface, c = new Float32Array(s.count * 3), col = new THREE.Color();
    for (let i = 0; i < s.count; i++) { col.setHex(COLORS[s.getX(i)] ?? 0x888888).convertSRGBToLinear(); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    vis.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  // a little painted texture: brick courses, sidewalk joints, grass mottling (world-space, in the shader)
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 c = diffuseColor.rgb;
  bool wall = abs(vWN.y) < 0.5;
  if (wall && c.r > 0.25 && c.g < 0.12) {  // brick: courses 7.5 cm, bricks 22 cm
    vec2 q = vec2(dot(vWP.xz, normalize(vec2(-vWN.z, vWN.x))), vWP.y) / vec2(0.22, 0.075);
    q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q);
    float mortar = step(f.y, 0.12) + step(f.x, 0.04);
    c *= 0.85 + 0.3 * h21(floor(q));
    c = mix(c, vec3(0.55, 0.52, 0.47), clamp(mortar, 0.0, 1.0));
  } else if (!wall) {
    float n = vn(vWP.xz * 3.0) * 0.6 + vn(vWP.xz * 13.0) * 0.4;
    c *= 0.82 + 0.3 * n;
    vec2 g = abs(fract(vWP.xz / 1.5) - 0.5);
    if (c.r > 0.35 && c.g > 0.35) c *= 1.0 - 0.25 * step(0.485, max(g.x, g.y));   // sidewalk joints
  } else {
    c *= 0.9 + 0.15 * vn(vWP.xy * 8.0 + vWP.zy * 8.0);
  }
  diffuseColor.rgb = c;
}`);
  };
  const visual = new THREE.Mesh(vis, mat);
  visual.receiveShadow = true; visual.castShadow = true;
  visual.name = 'stand-in-world';
  scene.add(visual);

  // water surface
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r - 0.05, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3f6f78, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78 }));
  water.position.set(POND.x, POND.level, POND.z);
  scene.add(water);
  // tree canopy (visual only)
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshStandardMaterial({ color: 0xc0602a, roughness: 0.9, flatShading: true }));
  crown.position.set(TREE.x, 7.2, TREE.z); crown.castShadow = true; scene.add(crown);

  // sky, light
  scene.background = new THREE.Color(0xbfd3e0);
  scene.fog = new THREE.Fog(0xbfd3e0, 25, 70);
  const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x6f6450, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2bd, 2.6);
  sun.position.set(-6, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 0.5; sc.far = 30;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
  scene.add(sun); scene.add(sun.target);

  const _ray = new THREE.Ray();
  const world = {
    scene,
    collider,
    groundAt: (x, z) => groundHeight(x, z),
    waterAt: (x, z) => (Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.05 ? POND.level : null),
    spawn: { x: 0, y: 0, z: 5, yaw: 0 },
    landmarks: [],
    trees: [{ x: TREE.x, y: 0, z: TREE.z, height: 9, crown: 2.6, kind: 'maple' }],
    collidersNear: (box3) => [collider],
    raycast(origin, dir, far) {
      _ray.origin.copy(origin); _ray.direction.copy(dir);
      const hit = geo.boundsTree.raycastFirst(_ray, THREE.DoubleSide, 0, far);
      if (!hit) return null;
      const normal = hit.face.normal.clone();
      if (normal.dot(dir) > 0) normal.negate();
      return { point: hit.point.clone(), normal, distance: hit.distance, surface: geo.attributes.surface.getX(hit.face.a) };
    },
    setScale() {},
    ready: () => Promise.resolve(),
    update(dt, camera, focus) {
      if (focus) {   // keep the tight shadow camera on the creature
        sun.target.position.copy(focus);
        sun.position.copy(focus).add(new THREE.Vector3(-6, 9, 5));
      }
    },
    dispose() {
      scene.remove(visual, water, crown, hemi, sun, sun.target);
      vis.dispose(); geo.dispose(); mat.dispose(); water.geometry.dispose(); water.material.dispose(); crown.geometry.dispose(); crown.material.dispose();
    },
  };
  return world;
}
