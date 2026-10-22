import { THREE, TAU, mergeGeometries, extrudeText } from '../lib.js';
import { particles, haze } from '../lib2.js';

// Sunburst (Island In The Sun x Dawghouse): spinning ray fan, expanding sun rings, carved pumpkin face core, rising embers.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x0a0212);
  st.bloom.strength = 0.7; st.bloom.radius = 0.6; st.bloom.threshold = 0.8;

  const NR = 20; // rays; one loop rotates exactly one ray-pair step => seamless
  const fan = (n, r, col, z) => {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, len = (TAU / n) * 0.5;
      parts.push(new THREE.CircleGeometry(r, 3, a0, len));
    }
    const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: col, toneMapped: false, side: THREE.DoubleSide }));
    m.position.z = z; scene.add(m); return m;
  };
  const rayA = fan(NR, 60, 0x7a1d8a, -9);
  const rayB = fan(NR, 60, 0xb8420a, -8.5);
  rayB.scale.setScalar(0.55);
  const core = haze(0xff7a10, 26, 0.6, [0, 0, -3]); scene.add(core);

  // expanding rings (fract of t => periodic)
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb040 : 0xff3fa0, toneMapped: false, transparent: true, depthWrite: false }));
    m.position.z = -2; scene.add(m); rings.push(m);
  }

  // pumpkin face disc
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#ff5a00'; g.fillRect(0, 0, 512, 512);
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 250); gr.addColorStop(0, '#ffd070'); gr.addColorStop(0.65, '#ff8a1a'); gr.addColorStop(1, '#ff5a00');
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, TAU); g.fill();
  g.fillStyle = '#2a0630';
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.8); g.lineTo(x + s, y + s * 0.8); g.lineTo(x, y - s * 0.9); g.closePath(); g.fill(); };
  tri(176, 215, 56); tri(336, 215, 56); tri(256, 290, 22);
  g.beginPath(); g.moveTo(140, 335);
  for (let i = 0; i <= 8; i++) g.lineTo(140 + i * 29, 335 + (i % 2 ? 50 : 0));
  for (let i = 8; i >= 0; i--) g.lineTo(140 + i * 29, 365 + (i % 2 ? 50 : 0) - 14);
  g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scene.add(face);

  const house = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 0.9, track: 0.2, depth: 0.2, bevel: 0.02, targetWidth: 10, material: new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false }) });   // event name up top
  house.group.position.set(0, 4.0, 0); scene.add(house.group);

  const embers = particles({ count: 260, seed: 5, box: [34, 12, 8], center: [0, 0, 0], color: 0xffa030, size: 0.1, dir: [0, 1, 0], travel: 10, sway: 0.8, opacity: 0.9, H: C.H, cycles: [1, 2] });
  scene.add(embers);

  return {
    update(t) {
      const a = TAU * t, step = TAU / NR;
      rayA.rotation.z = step * 2 * t;
      rayB.rotation.z = -step * 2 * t;
      core.scale.setScalar(26 + 3 * Math.sin(2 * a));
      face.scale.setScalar(0.75 + 0.03 * Math.sin(2 * a));
      face.rotation.z = 0.06 * Math.sin(a);
      rings.forEach((r, i) => {
        const u = (t * 2 + i / rings.length) % 1;
        r.scale.setScalar(2.7 + u * 16);
        r.material.opacity = (1 - u) * 0.9;
      });
      camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0);
      embers.userData.u.uT.value = t;
    },
  };
}
