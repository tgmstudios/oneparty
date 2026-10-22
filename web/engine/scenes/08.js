import { THREE, TAU, gradTex, extrudeText } from '../lib.js';
import { particles, haze, skyGradient } from '../lib2.js';

// Island In The Sun (Weezer) x Dawghouse Halloween: a jack-o-lantern sun sinking into a purple sea,
// spooky palm silhouettes, bats crossing, the event name. Everything periodic in t.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x07010c);
  st.bloom.strength = 0.8; st.bloom.radius = 0.6; st.bloom.threshold = 0.78;

  scene.add(skyGradient([[0, '#0a0216'], [0.35, '#3a0a4a'], [0.5, '#a3195b'], [0.58, '#ff6a10'], [1, '#ffb040']], -40, 200, 120));

  // pumpkin sun with carved face
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#ff5a00'; g.fillRect(0, 0, 512, 512); const gr = g.createRadialGradient(256, 256, 20, 256, 256, 250); gr.addColorStop(0, '#ffd070'); gr.addColorStop(0.6, '#ff8a1a'); gr.addColorStop(1, '#ff5a00');
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, TAU); g.fill();
  g.fillStyle = '#2a0630';
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.8); g.lineTo(x + s, y + s * 0.8); g.lineTo(x, y - s * 0.9); g.closePath(); g.fill(); };
  tri(176, 215, 56); tri(336, 215, 56); tri(256, 290, 22);
  g.beginPath(); g.moveTo(150, 340);
  for (let i = 0; i <= 8; i++) g.lineTo(150 + i * 26.5, 340 + (i % 2 ? 46 : 0));
  for (let i = 8; i >= 0; i--) g.lineTo(150 + i * 26.5, 372 + (i % 2 ? 46 : 0) - 14);
  g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  sun.position.set(0, 0.9, -8); scene.add(sun);
  const corona = haze(0xff7a10, 22, 0.5, [0, 0.9, -8.2]); scene.add(corona);

  // sea backdrop (occludes lower half of the sun = setting sun)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 12), new THREE.MeshBasicMaterial({ map: gradTex([[0, '#ff6a10'], [0.05, '#8a1a5a'], [0.3, '#2a0838'], [1, '#07010c']]), toneMapped: false }));
  sea.position.set(0, -7, -4); scene.add(sea);
  const wmat = (c) => new THREE.LineBasicMaterial({ color: c, toneMapped: false });
  const waves = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const pts = []; const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3));
    const k = i / (N - 1);
    const col = new THREE.Color().lerpColors(new THREE.Color(0xffa040), new THREE.Color(0x7a2aff), k);
    const line = new THREE.Line(geo, wmat(col)); line.position.z = -3.8 + k * 3; scene.add(line);
    waves.push({ geo, y: -1.2 - k * k * 4.2 - k * 0.3, amp: 0.05 + k * 0.18, n: 1 + (i % 3), ph: i * 0.9, k });
  }

  // sun reflection bars
  const bars = [];
  for (let i = 0; i < 9; i++) {
    const k = i / 8;
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffa030, toneMapped: false, transparent: true, opacity: 0.85 - k * 0.5 }));
    b.position.set(0, -1.5 - k * 3.2, -3.9); scene.add(b); bars.push({ b, k, w: 5.5 - k * 2.2 });
  }

  // palm trees (dark silhouettes)
  const palmMat = new THREE.MeshBasicMaterial({ color: 0x05010a });
  function palm(x, lean, s) {
    const grp = new THREE.Group();
    const trunkC = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -5, 0), new THREE.Vector3(lean * 0.3, -1.5, 0), new THREE.Vector3(lean * 0.9, 1.5, 0), new THREE.Vector3(lean, 3.4, 0)]);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(trunkC, 24, 0.16, 8), palmMat));
    const top = new THREE.Group(); top.position.set(lean, 3.4, 0); grp.add(top);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * TAU, dx = Math.cos(a), dz = Math.sin(a) * 0.4;
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx * 1.2, 0.8, dz), new THREE.Vector3(dx * 2.4, 0.5, dz * 1.5), new THREE.Vector3(dx * 3.2, -0.9, dz * 2)]);
      top.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.07, 6), palmMat));
    }
    grp.position.set(x, 0, 1); grp.scale.setScalar(s); scene.add(grp);
    return { grp, top };
  }
  const palms = [palm(-9.5, -0.9, 1.15), palm(10.5, 0.9, 1.0), palm(-14, -0.5, 0.8)];
  const island = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 12, 0, TAU, 0, Math.PI / 2), palmMat); island.scale.set(3, 0.55, 0.6); island.position.set(-8, -7.4, 0.5); scene.add(island);
  const island2 = island.clone(); island2.position.set(11, -7.4, 0.5); island2.scale.set(2.4, 0.5, 0.6); scene.add(island2);

  // bats
  const bs = new THREE.Shape(); bs.moveTo(0, 0); bs.lineTo(0.5, 0.35); bs.lineTo(1.1, 0.1); bs.lineTo(0.8, -0.25); bs.lineTo(0.35, -0.1); bs.lineTo(0, -0.3); bs.lineTo(-0.35, -0.1); bs.lineTo(-0.8, -0.25); bs.lineTo(-1.1, 0.1); bs.lineTo(-0.5, 0.35); bs.closePath();
  const bats = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(bs), new THREE.MeshBasicMaterial({ color: 0x05010a, side: THREE.DoubleSide }));
    m.position.z = -1; scene.add(m); bats.push({ m, ph: i / 5, y: 2.2 + (i % 3) * 0.9, dir: i % 2 ? 1 : -1, s: 0.55 + 0.15 * (i % 3) });
  }

  const house = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 0.9, track: 0.2, depth: 0.2, bevel: 0.02, targetWidth: 9, material: new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false }) });   // event name up top
  house.group.position.set(0, 3.3, 0); scene.add(house.group);

  const embers = particles({ count: 220, seed: 11, box: [34, 10, 8], center: [0, -2, 0], color: 0xffa030, size: 0.09, dir: [0, 1, 0], travel: 9, sway: 0.7, opacity: 0.9, H: C.H, cycles: [1, 2] });
  scene.add(embers);

  return {
    update(t) {
      const a = TAU * t;
      corona.scale.setScalar(22 + 2.5 * Math.sin(2 * a));
      sun.scale.setScalar(1 + 0.025 * Math.sin(2 * a));
      for (const w of waves) {
        const p = w.geo.attributes.position;
        for (let j = 0; j < 160; j++) {
          const x = -60 + (120 * j) / 159;
          p.setXYZ(j, x, w.y + w.amp * Math.sin(x * 0.35 * w.n + a * (w.n % 2 ? 1 : -1) * w.n + w.ph), 0);
        }
        p.needsUpdate = true;
      }
      for (const r of bars) {
        r.b.scale.x = r.w * (0.6 + 0.4 * Math.sin(a * 2 + r.k * 6));
        r.b.position.x = 0.3 * Math.sin(a + r.k * 4);
      }
      palms.forEach((p, i) => { p.top.rotation.z = 0.05 * Math.sin(a + i); p.grp.rotation.z = 0.015 * Math.sin(a + i * 2); });
      for (const b of bats) {
        const u = (b.ph + t) % 1;
        b.m.position.x = b.dir * (-26 + 52 * u);
        b.m.position.y = b.y + 0.6 * Math.sin(a * 2 + b.ph * 9);
        b.m.scale.set(b.s * b.dir, b.s * (0.5 + 0.5 * Math.abs(Math.sin(a * 16 + b.ph * 7))), 1);
      }
      camera.position.set(1.2 * Math.sin(a), 0.5 + 0.25 * Math.cos(a), 14);
      camera.lookAt(0, 0, 0);
      embers.userData.u.uT.value = t;
    },
  };
}
