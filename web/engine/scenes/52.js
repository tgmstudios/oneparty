import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, particles, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Jellyfish Disco: a bioluminescent ballroom on the seafloor. Jellyfish pulse their bells to the kick and trail glowing tentacles, a bait-ball of fish
// swirls round a coral arch holding a neon DAWGHOUSE, god rays sway from the surface and bubbles stream up.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x02101c); scene.fog = new THREE.FogExp2(0x03283a, 0.018);
  st.bloom.strength = 0.9; st.bloom.radius = 0.8; st.bloom.threshold = 0.65;
  const R = rng(52), hue = (h, l = 0.6) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 0.9, l);
  scene.add(new THREE.AmbientLight(0x2a6a8a, 0.9));
  const sky = skyGradient([[0, '#1a8aa8'], [0.35, '#0a4a6a'], [0.7, '#04203a'], [1, '#02101c']], -60, 240, 140); scene.add(sky);

  // god rays from the surface
  const rays = Array.from({ length: 7 }, (_, i) => { const geo = new THREE.ConeGeometry(3.2, 40, 16, 1, true); geo.translate(0, -20, 0); const c = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x7ae8ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false })); c.position.set(-24 + i * 8, 20, -14 - (i % 3) * 3); scene.add(c); return { c, i }; });

  // seafloor with coral + sea grass that sway
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ color: 0x1a3a44, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -9, -14); scene.add(floor);
  const corals = []; const cm = [0xff3fa0, 0xff8a40, 0xb060ff, 0x40ffd0].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, roughness: 0.6 }));
  for (let i = 0; i < 34; i++) { const x = -34 + (i / 33) * 68 + (R() - 0.5) * 3, z = -8 - R() * 18, h = 2 + R() * 4.5, g = new THREE.Group(); const base = new THREE.Mesh(new THREE.ConeGeometry(0.5 + R() * 0.5, h, 6), cm[i % 4]); base.position.y = h / 2; g.add(base); for (let b = 0; b < 3; b++) { const br = new THREE.Mesh(new THREE.ConeGeometry(0.25, h * 0.6, 5), cm[i % 4]); br.position.set((b - 1) * 0.5, h * 0.55, 0); br.rotation.z = (b - 1) * 0.5; g.add(br); } g.position.set(x, -9, z); scene.add(g); corals.push({ g, i }); }

  // coral arch + the neon sign
  const arch = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.7, 10, 60, Math.PI), cm[3]); arch.position.set(0, -5.4, -15); scene.add(arch);
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.35, 8, 60, Math.PI), cm[0]); arch2.position.set(0, -5.4, -14.7); scene.add(arch2);
  const sign = dawgSign(scene, C, { width: 14, pos: [0, 0.4, -14.4], size: 2.2, depth: 0.9, emis: 0xff2a80, color: 0xfff4f8, hop: 0.6, glow: false });

  // jellyfish
  const jellies = [];
  const specs = [[-9, 3, -4, 1.9, 0.92], [8, 5, -6, 2.3, 0.82], [-3.5, 8, -8, 1.5, 0.15], [4.5, 1, -2, 1.2, 0.5], [-13, 8, -10, 2.1, 0.75], [13, -1, -9, 1.8, 0.35], [0, 10, -12, 2.6, 0.6], [-6, -3, -1, 1.0, 0.1], [10, 9, -3, 1.0, 0.0], [-1, -4, 2, 0.9, 0.88]];
  specs.forEach(([x, y, z, s, h], i) => {
    const g = new THREE.Group(), big = i === 6, col = hue(h, 0.62);
    const bellG = new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2);
    const bell = new THREE.Mesh(bellG, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.3, flatShading: big })); g.add(bell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); rim.rotation.x = Math.PI / 2; g.add(rim);
    const core = haze(col, 3.4, 0.45, [0, 0.35, 0]); g.add(core);
    const NT = 14, NP = 14, pos = new Float32Array(NT * (NP - 1) * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tent = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); tent.frustumCulled = false; g.add(tent);
    g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); jellies.push({ g, bell, rim, core, tent, pos, NT, NP, i, x, y, s, ph: i * 0.8, col });
  });

  // bait ball of fish orbiting the arch
  const NF = 110, fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.13, 0.62, 5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false }), NF), fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), fs = new THREE.Vector3(1, 1, 1), fe = new THREE.Euler();
  const FP = Array.from({ length: NF }, (_, i) => ({ r: 6 + R() * 5, ph: R(), y: (R() - 0.5) * 8, f: R() < 0.5 ? 1 : 2, w: R() })); FP.forEach((f, i) => fish.setColorAt(i, new THREE.Color().setHSL(0.5 + 0.12 * f.w, 0.6, 0.7))); scene.add(fish);
  const bub = particles({ count: 260, seed: 5, box: [40, 22, 20], center: [0, -2, -8], color: 0xbfffff, size: 0.12, dir: [0, 1, 0], travel: 22, sway: 1.1, opacity: 0.8, H: C.H, cycles: [1, 2] }); scene.add(bub);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, hu = m.hue ?? 0.25 * Math.floor(t * 4);
      rays.forEach(({ c, i }) => { c.rotation.z = 0.18 * Math.sin(a + i * 0.9); c.material.opacity = 0.04 + 0.03 * Math.sin(a * 2 + i) + 0.05 * k.hat; });
      corals.forEach(({ g, i }) => { g.rotation.z = 0.05 * Math.sin(a * 2 + i * 0.7) + 0.03 * k.bass; g.scale.y = 1 + 0.08 * band(k.env, (i % 16) / 15); });
      cm.forEach((mm, i) => mm.emissiveIntensity = 0.3 + 0.35 * (i % 2 ? k.snare : k.kick));
      arch.material.emissiveIntensity = 0.35 + 0.45 * k.kick; sign.update(m);
      jellies.forEach(j => {
        const { g, bell, rim, core, pos, NT, NP, i, x, y, s, ph } = j, hit = i % 3 === 0 ? k.kick : i % 3 === 1 ? k.snare : band(k.env, 0.3), pulse = 0.5 + 0.5 * Math.sin(a * 4 + ph * 2) , sq = 0.1 * pulse + 0.2 * hit;
        g.position.set(x + 1.6 * Math.sin(a + ph), y + 1.3 * Math.sin(a * 2 + ph) + 0.8 * hit, g.position.z); g.rotation.set(0.12 * Math.sin(a + ph), a * 0.5 + ph, 0.1 * Math.cos(a + ph));
        bell.scale.set(1 + sq, 0.8 - sq * 0.9 + 0.1 * pulse, 1 + sq); rim.scale.set(1 + sq, 1 + sq, 1 + sq); rim.position.y = 0;
        bell.material.emissiveIntensity = 0.5 + 1.4 * hit; core.material.opacity = 0.3 + 0.5 * hit; j.tent.material.opacity = 0.5 + 0.4 * hit;
        let o = 0; for (let tt = 0; tt < NT; tt++) { const ang = (tt / NT) * TAU, rx = Math.cos(ang) * (1 + sq), rz = Math.sin(ang) * (1 + sq); let px = rx, py = 0, pz = rz; for (let p = 0; p < NP - 1; p++) { const q = (p + 1) / (NP - 1), nx = rx * (1 - 0.35 * q) + Math.sin(a * 3 - q * 4 + tt) * 0.35 * q * (1 + hit), nz = rz * (1 - 0.35 * q) + Math.cos(a * 2 - q * 3.5 + tt * 0.7) * 0.35 * q, ny = -q * (2.6 + 1.4 * (tt % 3) / 3) - 0.35 * sq * q; pos[o++] = px; pos[o++] = py; pos[o++] = pz; pos[o++] = nx; pos[o++] = ny; pos[o++] = nz; px = nx; py = ny; pz = nz; } }
        j.tent.geometry.attributes.position.needsUpdate = true;
      });
      for (let i = 0; i < NF; i++) { const f = FP[i], ang = TAU * (t * f.f + f.ph), r = f.r * (1 + 0.1 * k.bass), tx = -Math.sin(ang), tz = Math.cos(ang); fp.set(Math.cos(ang) * r, f.y + 1.2 * Math.sin(ang * 2 + i), -10 + Math.sin(ang) * r * 0.55); fq.setFromRotationMatrix(fm.lookAt(new THREE.Vector3(), new THREE.Vector3(tx, 0, tz * 0.55), new THREE.Vector3(0, 1, 0))); fs.setScalar(1 + 0.5 * k.hat * f.w); fm.compose(fp, fq, fs); fish.setMatrixAt(i, fm); }
      fish.instanceMatrix.needsUpdate = true; bub.userData.u.uT.value = t;
      camera.position.set(1.8 * Math.sin(a), 0.8 + 0.7 * Math.sin(a * 2) + 0.1 * k.kick, 19); camera.lookAt(0, 0.5, -8);
    },
  };
}
