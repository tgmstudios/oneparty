import { THREE, TAU, rng } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Vinyl Galaxy: a giant record spins like a planet in deep space. Shockwave rings roll out of the label on every bar, an EQ halo of bars circles the rim,
// a tonearm rides the groove and jolts on the kick, little records orbit, and DAWGHOUSE floats over the label.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x03020a); scene.fog = new THREE.FogExp2(0x06031a, 0.004);
  st.bloom.strength = 0.6; st.bloom.radius = 0.7; st.bloom.threshold = 0.82;
  scene.add(new THREE.AmbientLight(0x6a5aa0, 0.55));
  const key = new THREE.PointLight(0xff3fa0, 160, 0, 1.4); key.position.set(-14, 8, 14); const key2 = new THREE.PointLight(0x30d0ff, 140, 0, 1.4); key2.position.set(14, -6, 12); scene.add(key, key2);
  const R = rng(50), hue = h => new THREE.Color().setHSL(((h % 1) + 1) % 1, 0.9, 0.58);

  // starfield + soft nebulae
  const sp = new Float32Array(500 * 3); for (let i = 0; i < 500; i++) { const a = R() * TAU, b = (R() - 0.5) * 2, r = 120 + R() * 60; sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = b * 70; sp[i * 3 + 2] = -Math.abs(Math.sin(a)) * r - 20; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })); scene.add(stars);
  [[0xff2fa0, -40, 14, -70, 130], [0x3060ff, 44, -10, -80, 150], [0x8a2bff, 0, 30, -90, 140], [0x30d0ff, -50, -22, -85, 110]].forEach(([c, x, y, z, s]) => scene.add(haze(c, s, 0.16, [x, y, z])));

  // the record: groove texture, a conic "sheen" that rotates against it, a label, and a spindle
  const rc = document.createElement('canvas'); rc.width = rc.height = 1024; const g = rc.getContext('2d');
  g.fillStyle = '#08070d'; g.fillRect(0, 0, 1024, 1024);
  for (let r = 150; r < 506; r += 2.2) { g.strokeStyle = `rgba(255,255,255,${0.025 + 0.05 * R()})`; g.lineWidth = 1; g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); }
  for (const r of [230, 300, 372, 440]) { g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); }
  const recTex = new THREE.CanvasTexture(rc); recTex.colorSpace = THREE.SRGBColorSpace; recTex.anisotropy = 8;
  const RAD = 9, world = new THREE.Group(); world.rotation.set(-0.55, 0.38, 0); scene.add(world);
  const spin = new THREE.Group(); world.add(spin);
  spin.add(new THREE.Mesh(new THREE.CircleGeometry(RAD, 128), new THREE.MeshStandardMaterial({ map: recTex, metalness: 0.5, roughness: 0.4 })));
  const lc = document.createElement('canvas'); lc.width = lc.height = 512; const lg = lc.getContext('2d');
  const grd = lg.createLinearGradient(0, 0, 512, 512); grd.addColorStop(0, '#ff2fa0'); grd.addColorStop(0.55, '#ff8a30'); grd.addColorStop(1, '#ffd040'); lg.fillStyle = grd; lg.fillRect(0, 0, 512, 512);
  lg.strokeStyle = 'rgba(0,0,0,0.35)'; lg.lineWidth = 4; for (const r of [235, 200, 170]) { lg.beginPath(); lg.arc(256, 256, r, 0, TAU); lg.stroke(); }
  const lTex = new THREE.CanvasTexture(lc); lTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(new THREE.CircleGeometry(3.1, 64), new THREE.MeshStandardMaterial({ map: lTex, roughness: 0.6, emissive: 0x401020, emissiveIntensity: 0.5 })); label.position.z = 0.02; spin.add(label);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: 0x050308 })); hole.position.z = 0.04; spin.add(hole);
  const cc = document.createElement('canvas'); cc.width = cc.height = 512; const cg = cc.getContext('2d'); const cone = cg.createConicGradient(0, 256, 256);
  [[0, 0], [0.04, 0.9], [0.1, 0], [0.5, 0], [0.54, 0.9], [0.6, 0], [1, 0]].forEach(([p, a]) => cone.addColorStop(p, `rgba(255,255,255,${a})`)); cg.fillStyle = cone; cg.fillRect(0, 0, 512, 512);
  const cTex = new THREE.CanvasTexture(cc); const sheenMat = new THREE.MeshBasicMaterial({ map: cTex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const sheen = new THREE.Mesh(new THREE.CircleGeometry(RAD - 0.1, 96), sheenMat); sheen.position.z = 0.05; world.add(sheen);
  const edge = new THREE.Mesh(new THREE.RingGeometry(RAD - 0.06, RAD + 0.1, 128), new THREE.MeshBasicMaterial({ color: 0xff3fa0, toneMapped: false })); edge.position.z = 0.01; world.add(edge);

  // shockwave rings rolling out of the label (4 beats each, staggered)
  const rings = Array.from({ length: 5 }, (_, i) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }); const r = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), m); r.position.z = 0.08; world.add(r); return { r, m, i }; });

  // EQ halo: 64 bars standing around the rim, length from the spectrum (mirrored), colour sweeping around the hue wheel
  const NB = 64, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 1, 0.22), new THREE.MeshBasicMaterial({ toneMapped: false }), NB), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bs = new THREE.Vector3(), bc = new THREE.Color();
  world.add(bars);

  // tonearm
  const pivot = new THREE.Vector3(11.2, 6.6, 1.2), tip = new THREE.Vector3(5.6, -1.2, 0.35), arm = new THREE.Group(); world.add(arm);
  const armM = new THREE.MeshStandardMaterial({ color: 0xcfd4e4, metalness: 1, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.4, 20), armM); base.rotation.x = Math.PI / 2; base.position.copy(pivot); base.position.z -= 0.6; arm.add(base);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), armM); arm.add(tube);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.22), new THREE.MeshStandardMaterial({ color: 0xff3fa0, emissive: 0xff3fa0, emissiveIntensity: 0.5 })); arm.add(shell);
  const yv = new THREE.Vector3(0, 1, 0), tq = new THREE.Quaternion(), dv = new THREE.Vector3();
  const aim = (m, a, b) => { dv.subVectors(b, a); const L = dv.length(); m.position.copy(a).addScaledVector(dv, 0.5); m.scale.set(1, L, 1); m.quaternion.copy(tq.setFromUnitVectors(yv, dv.normalize())); };

  // orbiting mini records + a drifting dust belt
  const moons = [0, 1, 2].map(i => { const m = new THREE.Group(); const d = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x1a1830, metalness: 0.4, roughness: 0.4, emissive: 0x1a1040, emissiveIntensity: 0.6 })); d.rotation.x = Math.PI / 2; m.add(d); const l = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: hue(0.1 + i * 0.3), toneMapped: false })); l.position.z = 0.06; m.add(l); const rim = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.25, 40), new THREE.MeshBasicMaterial({ color: hue(0.1 + i * 0.3), toneMapped: false })); rim.position.z = 0.06; m.add(rim); scene.add(m); return { m, i }; });
  const dp = new Float32Array(420 * 3); for (let i = 0; i < 420; i++) { const a = R() * TAU, r = 12.5 + R() * 5; dp[i * 3] = Math.cos(a) * r; dp[i * 3 + 1] = Math.sin(a) * r; dp[i * 3 + 2] = (R() - 0.5) * 1.6; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3)); const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xffc0f0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); world.add(dust);

  const sign = dawgSign(world, C, { width: 10.5, pos: [0, 0, 3.4], size: 2.2, depth: 0.9, emis: 0xff2fa0, color: 0xffffff, hop: 0.5, glow: false });
  const glow = haze(0xff2fa0, 34, 0.13, [0, 0, -1]); world.add(glow);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, hu = m.hue ?? 0.25 * Math.floor(t * 4);
      spin.rotation.z = -a; sheen.rotation.z = a * 2; dust.rotation.z = a * 1; world.scale.setScalar(1 + 0.025 * k.kick);
      rings.forEach(({ r, m: mat, i }) => { const p = (((t * 4 + i / 5) % 1) + 1) % 1; r.scale.setScalar(3.2 + p * (RAD * 1.05 - 3.2) * (1 + 0.12 * k.bass)); mat.opacity = (1 - p) * (0.15 + 0.7 * k.kick) * (p < 0.04 ? 0 : 1); mat.color.copy(hue(hu + p * 0.25)); });
      for (let i = 0; i < NB; i++) {
        const ang = (i / NB) * TAU, d = Math.abs(i - NB / 2) / (NB / 2), e = band(k.env, d) * 0.9 + band(k.hit, d) * 0.5, len = 0.35 + 2.2 * Math.min(1.1, e);
        bp.set(Math.cos(ang) * (RAD + 0.8 + len / 2), Math.sin(ang) * (RAD + 0.8 + len / 2), 0.1); bq.setFromAxisAngle(bs.set(0, 0, 1), ang - Math.PI / 2); bs.set(1, len, 1); bm.compose(bp, bq, bs); bars.setMatrixAt(i, bm); bars.setColorAt(i, bc.copy(hue(hu + i / NB)).multiplyScalar(0.7 + 0.5 * e));
      }
      bars.instanceMatrix.needsUpdate = true; bars.instanceColor.needsUpdate = true;
      const jolt = 0.35 * k.kick, tipNow = tip.clone(); tipNow.x += 0.12 * Math.sin(a * 2) + 0.1 * k.bass; tipNow.y += jolt; tipNow.z += jolt * 0.6;
      aim(tube, pivot, tipNow); aim(shell, tipNow.clone().add(new THREE.Vector3(0.1, 0.25, 0.05)), tipNow.clone().add(new THREE.Vector3(-0.1, -0.25, 0)));
      moons.forEach(({ m: mm, i }) => { const o = a * (i % 2 ? -1 : 1) * (i + 1) + i * 2.1, rr = 15 + i * 3.2; mm.position.set(Math.cos(o) * rr, Math.sin(o * 0.9) * (4 + i * 2.5) + 2, Math.sin(o) * rr * 0.55 - 4); mm.rotation.set(0.6 * Math.sin(o), a * 2 + i, 0.3); mm.scale.setScalar(1 + 0.18 * (i % 2 ? k.snare : k.kick)); });
      sign.update(m); glow.material.opacity = 0.08 + 0.2 * k.kick; sheenMat.opacity = 0.14 + 0.3 * k.snare + 0.1 * k.bass; edge.material.color.copy(hue(hu));
      key.intensity = 120 + 120 * k.kick; key2.intensity = 100 + 120 * k.snare; stars.material.opacity = 0.6 + 0.35 * k.hat;
      camera.position.set(2.0 * Math.sin(TAU * t), 1.0 + 0.6 * Math.sin(TAU * t * 2), 31 - 0.8 * k.kick); camera.lookAt(0, 0.4, 0);
    },
  };
}
