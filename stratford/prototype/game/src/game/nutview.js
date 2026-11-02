// Draws the nuts: small painted instanced models that bob and glint, and a
// mound of turned earth where a nut is buried.

import * as BGU from 'three/addons/BufferGeometryUtils.js';

function paint(geo, color) {
  const c = { r: ((color >> 16) & 255) / 255, g: ((color >> 8) & 255) / 255, b: (color & 255) / 255 };
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE_.BufferAttribute(arr, 3));
  return geo;
}
let THREE_;

function modelFor(THREE, kind) {
  const parts = [];
  const S = (g, col, fn) => { const geo = g.index ? g.toNonIndexed() : g; fn?.(geo); parts.push(paint(geo, col)); };
  if (kind === 'acorn') {
    S(new THREE.SphereGeometry(0.1, 10, 8), 0xb8803c, (g) => { g.scale(0.82, 1.15, 0.82); g.translate(0, 0.0, 0); });
    S(new THREE.SphereGeometry(0.095, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x6b4423, (g) => { g.scale(1.05, 0.9, 1.05); g.translate(0, 0.07, 0); });
    S(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 5), 0x4a2f18, (g) => g.translate(0, 0.17, 0));
  } else if (kind === 'walnut') {
    S(new THREE.SphereGeometry(0.15, 10, 8), 0x8a9a3a, (g) => g.scale(1, 0.95, 1));
    S(new THREE.SphereGeometry(0.06, 6, 5), 0x6e7e2c, (g) => g.translate(0.07, 0.1, 0.07));
  } else {
    S(new THREE.SphereGeometry(0.13, 10, 8), 0x5a2a14, (g) => g.scale(1, 0.9, 1));
    S(new THREE.CircleGeometry(0.06, 8), 0xc9a06a, (g) => { g.rotateX(-0.5); g.translate(0, 0.05, 0.1); });
  }
  const geo = BGU.mergeGeometries(parts, false);
  geo.computeVertexNormals();
  return geo;
}

export function createNutView({ THREE, scene, capacity = 160 }) {
  THREE_ = THREE;
  const group = new THREE.Group();
  group.name = 'nuts';
  scene.add(group);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0, emissive: 0x3a2a08, emissiveIntensity: 0.6 });
  const meshes = {};
  for (const kind of ['acorn', 'walnut', 'conker']) {
    const m = new THREE.InstancedMesh(modelFor(THREE, kind), mat, capacity);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = false;
    group.add(m);
    meshes[kind] = m;
  }
  // Mounds of earth for buried nuts.
  const moundGeo = new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  moundGeo.scale(1, 0.38, 1);
  const mounds = new THREE.InstancedMesh(moundGeo, new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 }), 128);
  mounds.count = 0;
  mounds.frustumCulled = false;
  group.add(mounds);
  // A soft glint over each lying nut.
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,244,200,1)');
    gr.addColorStop(0.25, 'rgba(255,220,130,0.55)');
    gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,248,220,0.9)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 58); g.moveTo(6, 32); g.lineTo(58, 32); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glintGeo = new THREE.BufferGeometry();
  glintGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
  const glintMat = new THREE.PointsMaterial({ map: tex, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.8 });
  const glints = new THREE.Points(glintGeo, glintMat);
  glints.frustumCulled = false;
  group.add(glints);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const RANGE2 = 160 * 160;

  return {
    group,
    // lying: nuts still to find; buried: the player's mounds; focus: the squirrel's position.
    update(time, lying, buried, focus, reduceMotion = false) {
      const counts = { acorn: 0, walnut: 0, conker: 0 };
      let g = 0;
      const pos = glintGeo.attributes.position;
      for (let i = 0; i < lying.length; i++) {
        const n = lying[i];
        if ((n.x - focus.x) ** 2 + (n.z - focus.z) ** 2 > RANGE2) continue;
        const m = meshes[n.kind];
        if (counts[n.kind] >= capacity) continue;
        const bob = reduceMotion ? 0.12 : 0.1 + Math.sin(time * 2 + i) * 0.05;
        e.set(0, time * 1.2 + i, 0.25);
        q.setFromEuler(e);
        p.set(n.x, n.y + bob + 0.06, n.z);
        m4.compose(p, q, sc);
        m.setMatrixAt(counts[n.kind]++, m4);
        if (g < capacity) {
          pos.setXYZ(g++, n.x, n.y + 0.28 + bob, n.z);
        }
      }
      for (const k of Object.keys(meshes)) { meshes[k].count = counts[k]; meshes[k].instanceMatrix.needsUpdate = true; }
      glintGeo.setDrawRange(0, g);
      pos.needsUpdate = true;
      glintMat.opacity = reduceMotion ? 0.7 : 0.55 + Math.sin(time * 3) * 0.25;
      let mc = 0;
      for (const b of buried) {
        if (mc >= 128) break;
        p.set(b.x, b.y, b.z);
        e.set(0, 0, 0);
        q.setFromEuler(e);
        m4.compose(p, q, sc);
        mounds.setMatrixAt(mc++, m4);
      }
      mounds.count = mc;
      mounds.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(group);
      for (const m of Object.values(meshes)) m.geometry.dispose();
      mat.dispose(); moundGeo.dispose(); tex.dispose();
    },
  };
}
