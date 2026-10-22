import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, particles, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// The Night Bloom: a moonlit garden path under a wrought-iron gate. Giant luminous flowers line the path and open and close with the spectrum
// (low notes on the near ones, highs far away), a colossal bloom at the end unfolds in layers on every bar, pollen drifts up on the kick, moths circle,
// fireflies blink, and DAWGHOUSE hangs glowing under the gate's arch.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x04061a); scene.fog = new THREE.FogExp2(0x0a1030, 0.016);
  st.bloom.strength = 0.5; st.bloom.radius = 0.7; st.bloom.threshold = 0.82;
  const R = rng(37), hue = (h, l = 0.6) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  scene.add(new THREE.AmbientLight(0x4a5a9a, 0.6));
  const moonL = new THREE.DirectionalLight(0x9ab4ff, 0.7); moonL.position.set(-10, 16, 8); scene.add(moonL);
  scene.add(skyGradient([[0, '#03041a'], [0.55, '#0a1a4a'], [0.85, '#1a3a7a'], [1, '#2a4a8a']], -90, 360, 180));

  // moon, stars, ground, path
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, toneMapped: false, fog: false })); moon.position.set(-34, 28, -75); scene.add(moon); scene.add(haze(0x9ab4ff, 40, 0.18, [-34, 28, -76]));
  const sp = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { sp[i * 3] = (R() - 0.5) * 220; sp[i * 3 + 1] = 8 + R() * 60; sp[i * 3 + 2] = -80; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })); scene.add(stars);
  const GY = -2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 160), new THREE.MeshStandardMaterial({ color: 0x0a1a2a, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, GY, -40); scene.add(ground);
  const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x4a5a7a, roughness: 0.7, emissive: 0x101830, emissiveIntensity: 0.5 }), 40), sm = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp3 = new THREE.Vector3(), ss = new THREE.Vector3();
  for (let i = 0; i < 40; i++) { sp3.set((R() - 0.5) * 1.8 + (i % 2 ? 1.2 : -1.2), GY + 0.05, 12 - i * 2.3); ss.set(0.9 + R() * 0.5, 1, 0.9 + R() * 0.5); sm.compose(sp3, sq.identity(), ss); stones.setMatrixAt(i, sm); } scene.add(stones);

  // ---- flowers
  const pal = [[0xff3fa0, 0xffd0f0], [0x40e0ff, 0xd0ffff], [0xb070ff, 0xf0d8ff], [0xffd040, 0xfff4c0], [0x60ff9a, 0xd8ffe8]];
  const makeBloom = (n, len, wid, [c1, c2], layers = 1) => {
    const g = new THREE.Group(), petals = [], geo = new THREE.SphereGeometry(1, 9, 6); geo.scale(wid, len, 0.1); geo.translate(0, len, 0);
    for (let L = 0; L < layers; L++) for (let i = 0; i < n; i++) {
      const piv = new THREE.Group(); piv.rotation.y = (i / n) * TAU + L * (TAU / n / 2); const col = new THREE.Color(c1).lerp(new THREE.Color(c2), L / Math.max(1, layers - 0.5) * 0.8);
      const pm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.4, side: THREE.DoubleSide });
      const pet = new THREE.Mesh(geo, pm); const tilt = new THREE.Group(); tilt.add(pet); piv.add(tilt); g.add(piv); petals.push({ tilt, pm, L, i });
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(wid * 0.9, 8, 6), new THREE.MeshBasicMaterial({ color: c2, toneMapped: false })); core.position.y = len * 0.12; g.add(core);
    const glow = haze(c1, len * 2.2, 0.1, [0, len * 0.5, 0]); g.add(glow);
    return { g, petals, core, glow };
  };
  const stemM = new THREE.MeshStandardMaterial({ color: 0x1a5a4a, roughness: 0.7, emissive: 0x0a3a2a, emissiveIntensity: 0.5 });
  const flowers = []; const slots = [];
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) slots.push({ x: s * (7.4 + (i % 3) * 1.7 + R() * 0.8), z: -1 - i * 7.2 - R() * 2, s, i });
  slots.push({ x: -10.5, z: 11, s: -1, i: 8 }, { x: 11.5, z: 8, s: 1, i: 9 });
  slots.forEach((sl, idx) => {
    const [c1, c2] = pal[idx % 5], H = 3 + R() * 3.5, f = new THREE.Group(); f.position.set(sl.x, GY, sl.z); scene.add(f);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-sl.s * 0.3, H * 0.4, 0), new THREE.Vector3(-sl.s * 0.6, H * 0.8, 0), new THREE.Vector3(-sl.s * 0.5, H, 0)]);
    f.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.14, 6), stemM));
    for (let l = 0; l < 3; l++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), stemM); lf.scale.set(0.9, 0.12, 0.35); lf.position.set(sl.s * 0.7 * (l % 2 ? -1 : 1), 0.8 + l * 0.9, 0); lf.rotation.z = (l % 2 ? 1 : -1) * 0.5; f.add(lf); }
    const b = makeBloom(9, 1.4 + R() * 0.6, 0.55, [c1, c2], 2); b.g.position.set(-sl.s * 0.5, H, 0); b.g.rotation.x = 0.3; f.add(b.g);
    flowers.push({ f, b, H, idx, sl, ph: R() * TAU });
  });
  // colossal bloom at the end
  const giant = makeBloom(14, 6.5, 2.2, [0xff3fa0, 0xffe0f8], 3); giant.g.position.set(0, GY, -66); giant.g.scale.setScalar(1.15); scene.add(giant.g);
  const gstem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 8), stemM); gstem.position.set(0, GY + 3, -66.4); scene.add(gstem);

  // ---- iron gate arch with the sign
  const iron = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, metalness: 0.8, roughness: 0.4 });
  for (const x of [-5.5, 5.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 11, 8), iron); p.position.set(x, GY + 5.5, 3); scene.add(p); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6), iron); fl.position.set(x, GY + 11.4, 3); scene.add(fl); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.2, 8, 40, Math.PI), iron); arch.position.set(0, GY + 9.2, 3); scene.add(arch);
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.1, 6, 40, Math.PI), iron); arch2.position.set(0, GY + 9.2, 3); scene.add(arch2);
  const vineGlows = []; for (let i = 0; i < 26; i++) { const a = (i / 25) * Math.PI, r = 5.2 + 0.4 * Math.sin(i * 1.7); const g = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); g.position.set(Math.cos(a) * r, GY + 9.2 + Math.sin(a) * r, 3.1); scene.add(g); vineGlows.push(g); }
  for (const x of [-5.5, 5.5]) for (let i = 0; i < 8; i++) { const g = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); g.position.set(x + 0.3 * Math.sin(i * 2), GY + 1 + i * 1.2, 3.2); scene.add(g); vineGlows.push(g); }
  const sign = dawgSign(scene, C, { width: 7.6, pos: [0, GY + 8.2, 3.1], size: 2.1, depth: 0.5, emis: 0x40ffd0, color: 0xe8fff8, hop: 0.3, glow: true });
  for (const x of [-3.2, 3.2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 4), iron); ch.position.set(x, GY + 9.9, 3.1); scene.add(ch); }

  // ---- pollen, fireflies, moths
  const pollen = particles({ count: 140, seed: 5, box: [30, 14, 60], center: [0, 2, -28], color: 0xffe8a0, size: 0.16, dir: [0, 1, 0], travel: 10, sway: 1.6, opacity: 0.9, H: C.H, cycles: [1, 2] }); scene.add(pollen);
  const flies = particles({ count: 70, seed: 9, box: [34, 8, 60], center: [0, 0, -28], color: 0xb8ff90, size: 0.2, dir: [0, 1, 0], travel: 4, sway: 3.0, opacity: 0.9, H: C.H, cycles: [1] }); scene.add(flies);
  const moths = Array.from({ length: 6 }, (_, i) => { const g = new THREE.Group(), wm = new THREE.MeshBasicMaterial({ color: 0xfff0d0, side: THREE.DoubleSide, transparent: true, opacity: 0.85, toneMapped: false }); const w1 = new THREE.Mesh(new THREE.CircleGeometry(0.38, 8), wm), w2 = w1.clone(); w1.position.x = -0.3; w2.position.x = 0.3; g.add(w1, w2); scene.add(g); return { g, w1, w2, i }; });
  const mist = [0, 1].map(i => { const h = haze(0x7a9aff, 18, 0.1, [(i - 1.5) * 14, GY + 1.2, -6 - i * 12]); scene.add(h); return h; });
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), bar = Math.floor(p / 4);
      sign.update(m); pollen.userData.u.uT.value = t; flies.userData.u.uT.value = t; stars.material.opacity = 0.55 + 0.4 * k.hat;
      flowers.forEach(({ f, b, idx, sl, ph }) => {
        const e = Math.min(1, band(k.env, Math.min(1, 0.04 + idx * 0.05)) * 0.9 + band(k.hit, Math.min(1, idx * 0.06)) * 0.6), open = 0.18 + 0.82 * Math.min(1, e * 1.2 + 0.25 * (0.5 + 0.5 * Math.sin(a + ph)));
        b.petals.forEach(({ tilt, pm, L }) => { tilt.rotation.x = 0.15 + (1.25 - 0.15) * open - L * 0.18; pm.emissiveIntensity = 0.3 + 0.55 * e; });
        b.g.rotation.z = 0.12 * Math.sin(a + ph); b.core.scale.setScalar(0.9 + 0.5 * e); b.glow.material.opacity = 0.05 + 0.14 * e; b.g.rotation.y = a * 0.25 * (idx % 2 ? 1 : -1); f.rotation.z = 0.04 * Math.sin(a * 2 + ph);
      });
      // colossal bloom: layers open one after another each bar
      giant.petals.forEach(({ tilt, pm, L }) => { const q = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(TAU * (p / 8) - L * 0.9) + 0.25 * k.kick)); tilt.rotation.x = 0.1 + 1.2 * q - L * 0.15; pm.emissiveIntensity = 0.35 + 0.6 * q + 0.4 * k.kick; });
      giant.g.rotation.y = a * 0.15; giant.core.scale.setScalar(1 + 0.25 * k.kick); giant.glow.material.opacity = 0.1 + 0.2 * k.kick; giant.glow.material.color.copy(hue(hu + 0.9, 0.6));
      vineGlows.forEach((g, i) => { const on = 0.5 + 0.5 * Math.sin(a * 4 - i * 0.5); g.material.color.copy(hue(hu + i * 0.03, 0.4 + 0.35 * on + 0.15 * k.kick)); g.scale.setScalar(0.8 + 0.6 * on); });
      moths.forEach(({ g, w1, w2, i }) => { const o = a * (1 + (i % 2)) + i * 1.3; g.position.set(Math.sin(o) * (5 + i), GY + 3 + 2.5 * Math.sin(o * 2 + i), -60 + Math.cos(o) * 4 - (i % 3) * 6 + 40 * 0); g.rotation.y = o; const fl = 0.9 * Math.sin(a * 40 + i); w1.rotation.y = fl; w2.rotation.y = -fl; });
      mist.forEach((h, i) => { h.material.opacity = 0.05 + 0.05 * Math.sin(a + i * 1.7) + 0.03 * k.bass; });
      camera.position.set(1.6 * Math.sin(TAU * t), 3.0 + 0.4 * Math.sin(TAU * t * 2) + 0.08 * k.kick, 24); camera.lookAt(0, 5.2, -30);
    },
  };
}
