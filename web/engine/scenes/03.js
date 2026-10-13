import { THREE, TAU, extrudeText, makeEnv } from '../lib.js';
import { particles, haze, brickTexture } from '../lib2.js';

// 03 - haunted tunnel: endless arched crypt corridor, camera flies forward in a seamless loop
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x020103); scene.fog = new THREE.FogExp2(0x07030a, 0.055);
  st.bloom.strength = 0.7; st.bloom.radius = 0.8; st.bloom.threshold = 0.8;
  scene.environment = makeEnv(renderer, [{ w: 20, h: 20, c: 0xff7a1a, i: 1.0, pos: [0, 0, -15] }, { w: 20, h: 6, c: 0x5a2aa0, i: 0.8, pos: [0, 10, 0] }]); scene.environmentIntensity = 0.25;
  const SP = 5.0, N = 17, RX = 4.4, RY = 4.0;
  const brick = brickTexture({ base: [74, 52, 46], seed: 9 });
  const wallMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, metalness: 0.0 });
  const ribMat = new THREE.MeshStandardMaterial({ map: brick, color: 0xa88f86, roughness: 0.8 });
  // tunnel shell: half-cylinder vault + side walls + floor, along -z (length repeats with period SP via texture offset)
  const tun = new THREE.Group(); scene.add(tun);
  const shellGeo = new THREE.CylinderGeometry(RX, RX, N * SP * 2, 32, 1, true, 0, Math.PI*2);
  const shell = new THREE.Mesh(shellGeo, wallMat.clone()); shell.material.side = THREE.BackSide; shell.material.map = brick.clone(); shell.material.map.repeat.set(6, N * 2 * SP / 4); shell.material.map.needsUpdate = true;
  shell.rotation.x = Math.PI / 2; shell.scale.set(1, 1, RY / RX); tun.add(shell);
  const side = (sx) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(N * SP * 2, 2.4), wallMat.clone()); w.material.map = brick.clone(); w.material.map.repeat.set(N * 2 * SP / 4, 1); w.material.map.needsUpdate = true; w.rotation.y = -sx * Math.PI / 2; w.position.set(sx * RX, -1.2, 0); tun.add(w); };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, N * SP * 2), new THREE.MeshStandardMaterial({ color: 0x0b0709, roughness: 0.18, metalness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; tun.add(floor);
  // ribs + lanterns (repeat each SP)
  const ribs = [], lamps = [];
  const archGeo = new THREE.TorusGeometry(RX, 0.22, 10, 40, Math.PI);
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); const arch = new THREE.Mesh(archGeo, ribMat); arch.scale.y = RY / RX; g.add(arch);
    [-1, 1].forEach(sx => { const col = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.4, 0.44), ribMat); col.position.set(sx * RX, -1.2, 0); g.add(col);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff8a22).multiplyScalar(2.6), toneMapped: false })); lamp.position.set(sx * (RX - 0.4), 1.1, 0.0); g.add(lamp); lamps.push(lamp); });
    if (i % 2 === 0) { // hanging cobweb-ish cross bar & chain lantern
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4), new THREE.MeshBasicMaterial({ color: 0x1a1418 })); ch.position.set(0, RY - 0.6, 0); g.add(ch);
      const lan = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9a4cff).multiplyScalar(2.2), toneMapped: false })); lan.position.set(0, RY - 1.4, 0); lan.scale.y = 1.4; g.add(lan); lamps.push(lan); }
    g.position.z = -i * SP; scene.add(g); ribs.push(g);
  }
  // sparse point lights that travel with the camera for local lit glow
  const l1 = new THREE.PointLight(0xff7a22, 40, 0, 1.4), l2 = new THREE.PointLight(0x8a48ff, 26, 0, 1.4); scene.add(l1, l2);
  // big extruded title floating at tunnel end (fixed, far), glowing orange rim
  const tm = new THREE.MeshStandardMaterial({ color: 0x1a1216, metalness: 0.7, roughness: 0.3, emissive: 0xff6a1a, emissiveIntensity: 1.4 });
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.0, bevel: 0.09, material: tm, targetWidth: 9.2 * 0.78 })  // v2: text 22% smaller (probe: no wall/rib occlusion, >=0.59 m inside vault);
  scene.add(T.group);
  const glow = haze(0xff6a14, 22, 0.22, [0, 0.5, -34]); scene.add(glow);
  const mist = particles({ count: 320, seed: 31, box: [RX * 1.8, 6, 40], center: [0, 0.5, -16], color: 0xc9a4ff, size: 0.11, dir: [0, 0, 1], travel: 40, sway: 0.7, opacity: 0.35, H: C.H, cycles: [1] }); scene.add(mist);
  const ghosts = []; for (let i = 0; i < 4; i++) { const h = haze(0x9a7aff, 3.2, 0.22, [0, 0, 0]); h.userData = { i }; scene.add(h); ghosts.push(h); }
  camera.fov = 62; camera.updateProjectionMatrix();
  const inst = {
    update(t) {
      const a = TAU * t; const z = -t * SP * 2; // two rib periods per loop: even-lantern pattern repeats every 2*SP
      camera.position.set(0.35 * Math.sin(a * 1), 0.2 + 0.18 * Math.sin(a * 2), z); camera.rotation.set(0.02 * Math.sin(a), 0.03 * Math.sin(a + 1), 0.015 * Math.sin(a * 2));
      l1.position.set(0, 1.4, z - 4); l2.position.set(0, 2.5, z - 12);
      T.group.position.set(0, 0.4 + 0.12 * Math.sin(a), z - 9.5); T.group.rotation.y = 0.12 * Math.sin(a);
      glow.position.set(0, 0.5, z - 11);
      ghosts.forEach((h, i) => { const ph = (t * 2 + i / 4) % 1; h.position.set(Math.sin(a + i * 2) * 1.6, -0.2 + Math.cos(a * 2 + i) * 0.4, z - 5 - ph * 22); h.material.opacity = 0.2 * Math.sin(ph * Math.PI); });
      mist.position.z = z; mist.userData.u.uT.value = t * 1;
    },
  };
  if (C.q.get('probe')) window.__s03 = { THREE, T, camera, scene, tun, ribs, inst };
  return inst;
}
