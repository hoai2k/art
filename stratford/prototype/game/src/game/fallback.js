// Stand-ins so the shell runs on its own: a capsule creature that moves with
// the stick, its simple follow camera, and a flat little world. Used only when
// the real creature or world modules are missing or throw.

export function createMinimalWorld({ THREE, scene }) {
  scene.background = new THREE.Color(0xe6c9a0);
  scene.fog = new THREE.Fog(0xe6c9a0, 60, 400);
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x6a5a40, 1.6));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.2);
  sun.position.set(-40, 60, 30);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a9a55, roughness: 1 }));
  scene.add(ground);
  const grid = new THREE.GridHelper(400, 80, 0x4a6b3f, 0x62824a);
  grid.position.y = 0.02;
  scene.add(grid);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb5654a, roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(8 + (i % 3) * 4, 6 + (i % 4) * 3, 8), mat);
    b.position.set(-60 + i * 10 - 30 * (i % 2), 4, -40 - (i % 5) * 14);
    b.position.y = b.geometry.parameters.height / 2;
    scene.add(b);
  }
  return {
    scene,
    collider: ground,
    groundAt: () => 0,
    waterAt: () => null,
    spawn: { x: 0, y: 0, z: 0, yaw: 0 },
    landmarks: [
      { id: 'test-hall', name: 'Test Hall', x: 0, z: -34, y: 0, radius: 14, blurb: 'A stand-in landmark for testing the shell on its own.' },
      { id: 'test-bridge', name: 'Test Bridge', x: 50, z: 10, y: 0, radius: 14, blurb: 'Another stand-in, a little way east.' },
    ],
    trees: [],
    stand: true,
    update() {},
    setScale() {},
    ready: () => Promise.resolve(),
    dispose() {},
  };
}

export function createCapsuleCreature({ THREE }) {
  const object = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c8b88, roughness: 0.9 }));
  body.position.y = 0.09;
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.2, 4, 6), new THREE.MeshStandardMaterial({ color: 0xaaa9a4, roughness: 1 }));
  tail.rotation.x = 0.9; tail.position.set(0, 0.2, 0.22);
  object.add(body, tail);
  const listeners = {};
  const c = {
    kind: 'capsule', scale: 0.25, eyeHeight: 0.18, climbs: new Set(), canFly: false,
    object, position: object.position, velocity: new THREE.Vector3(), state: 'idle', yaw: 0, grounded: true,
    on(e, fn) { (listeners[e] ||= []).push(fn); },
    emit(e, d) { for (const fn of listeners[e] || []) fn(d); },
    setCoat(name) { body.material.color.set(name === 'black' ? 0x1c1a1a : 0x8c8b88); tail.material.color.set(name === 'black' ? 0x2a2626 : 0xaaa9a4); },
    reset(sp) { object.position.set(sp.x, sp.y ?? 0, sp.z); c.velocity.set(0, 0, 0); c.yaw = sp.yaw || 0; c.camYaw = c.yaw; object.rotation.y = c.yaw; },
    camYaw: 0,
    update(dt, controls, world) {
      const f = { x: -Math.sin(c.camYaw), z: -Math.cos(c.camYaw) };
      const r = { x: -f.z, z: f.x };
      const sp = (controls.sprint > 0.1 ? 6.5 : 3.6);
      const [mx, my] = controls.move;
      const tx = (f.x * my + r.x * mx) * sp; const tz = (f.z * my + r.z * mx) * sp;
      const k = 1 - Math.exp(-10 * dt);
      c.velocity.x += (tx - c.velocity.x) * k; c.velocity.z += (tz - c.velocity.z) * k;
      const g = world.groundAt(object.position.x, object.position.z);
      const wasAir = !c.grounded;
      if (c.grounded && controls.jumpPressed) { c.velocity.y = 4.2; c.grounded = false; c.emit('jump'); }
      c.velocity.y -= 14 * dt;
      object.position.addScaledVector(c.velocity, dt);
      if (object.position.y <= g) {
        const impact = -c.velocity.y;
        object.position.y = g; c.velocity.y = 0; c.grounded = true;
        if (wasAir && impact > 2) c.emit('land', { speed: impact });
      }
      if (Math.hypot(mx, my) > 0.1) c.yaw = Math.atan2(-tx, -tz);
      object.rotation.y = c.yaw;
      c.state = !c.grounded ? 'air' : Math.hypot(c.velocity.x, c.velocity.z) > 0.4 ? 'move' : 'idle';
      if (controls.digPressed) c.emit('dig');
    },
  };
  return c;
}

export function createCapsuleCamera({ THREE, camera, creature }) {
  let pitch = 0.45;
  const look = new THREE.Vector3();
  return {
    update(dt, controls) {
      creature.camYaw -= controls.look[0];
      pitch = Math.max(-0.15, Math.min(1.2, pitch + controls.look[1]));
      if (controls.recenter) creature.camYaw = creature.yaw;
      const d = 2.4;
      const p = creature.position;
      const fx = -Math.sin(creature.camYaw); const fz = -Math.cos(creature.camYaw);
      camera.position.set(p.x - fx * d * Math.cos(pitch), p.y + 0.35 + d * Math.sin(pitch), p.z - fz * d * Math.cos(pitch));
      look.set(p.x, p.y + 0.2, p.z);
      camera.lookAt(look);
    },
  };
}
