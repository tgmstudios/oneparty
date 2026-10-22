import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Nocturne in the Crypt: a candlelit gothic nave. A vampire rises from a black coffin on the dais, cape flaring on the snare, while dozens of candle
// flames dance with the spectrum, a chandelier swings, bats wheel under the vaults, and DAWGHOUSE glows on the marble slab above a blood-moon window.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x0a0410); scene.fog = new THREE.FogExp2(0x1a0a24, 0.016);
  st.bloom.strength = 0.65; st.bloom.radius = 0.7; st.bloom.threshold = 0.78;
  const R = rng(34), hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  scene.add(new THREE.AmbientLight(0x8a6aaa, 1.15));
  const key = new THREE.PointLight(0xff9a50, 40, 0, 1.5); key.position.set(0, 9, 6); scene.add(key);
  const red = new THREE.PointLight(0xff2a3a, 120, 0, 1.4); red.position.set(0, 8, -16); scene.add(red);
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a3a5a, roughness: 0.85, emissive: 0x2a1838, emissiveIntensity: 0.9 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x2a2036, roughness: 0.9, emissive: 0x241030, emissiveIntensity: 1.0 });
  const flameM = new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false });

  // ---- floor (checker) + dark back
  const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fg = fc.getContext('2d'); fg.fillStyle = '#2a2036'; fg.fillRect(0, 0, 128, 128); fg.fillStyle = '#4a3a58'; fg.fillRect(0, 0, 64, 64); fg.fillRect(64, 64, 64, 64);
  const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(8, 28); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 56), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.45, metalness: 0.2 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -16); scene.add(floor);

  // ---- nave: columns, ribs, niches with sarcophagi
  const NCOL = 7, colZ = i => 6 - i * 7;
  for (const s of [-1, 1]) for (let i = 0; i < NCOL; i++) {
    const z = colZ(i), x = s * 8;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 12, 10), stone); shaft.position.set(x, 6, z); scene.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.6, 10), darkStone); base.position.set(x, 0.3, z); scene.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 0.8, 10), darkStone); cap.position.set(x, 12, z); scene.add(cap);
    // vault rib across the nave (half arch)
    if (s < 0) { const rib = new THREE.Mesh(new THREE.TorusGeometry(8, 0.4, 8, 24, Math.PI), stone); rib.scale.set(1, 0.55, 1); rib.position.set(0, 12, z); scene.add(rib); }
    // niche + sarcophagus behind each column pair
    const niche = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 1), new THREE.MeshStandardMaterial({ color: 0x120a1c, roughness: 0.95 })); niche.position.set(s * 12.5, 4, z - 3.5); scene.add(niche);
    const sarc = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.6), darkStone); sarc.position.set(s * 11.2, 0.7, z - 3.4); scene.add(sarc); const lidd = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 1.8), stone); lidd.position.set(s * 11.2, 1.45, z - 3.4); scene.add(lidd);
  }
  for (const s of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), darkStone); wl.rotation.y = -s * Math.PI / 2; wl.position.set(s * 14.5, 8, -16); scene.add(wl); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), new THREE.MeshStandardMaterial({ color: 0x1a1224, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 18, -16); scene.add(ceil);

  // ---- candles: instanced flames that dance with the spectrum, plus candelabra stands
  const cand = [];
  for (const s of [-1, 1]) for (let i = 0; i < NCOL; i++) { const z = colZ(i) - 3.5; const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 4.2, 6), new THREE.MeshStandardMaterial({ color: 0xc8a850, metalness: 1, roughness: 0.3 })); stand.position.set(s * 6.2, 2.1, z); scene.add(stand); const arm = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 6, 16, Math.PI), stand.material); arm.position.set(s * 6.2, 4.2, z); scene.add(arm); for (let c = 0; c < 3; c++) cand.push({ x: s * 6.2 + (c - 1) * 0.9, y: 4.3 + (c === 1 ? 0.15 : 0), z, i: cand.length }); }
  const NC = cand.length, flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 0.6, 7), flameM, NC), wax = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 7), new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.6 }), NC), fm = new THREE.Matrix4(), fp = new THREE.Vector3(), fq = new THREE.Quaternion(), fs = new THREE.Vector3();
  cand.forEach((c, i) => { fm.makeTranslation(c.x, c.y - 0.1, c.z); wax.setMatrixAt(i, fm); }); scene.add(flames, wax);
  const candGlow = Array.from({ length: 8 }, (_, i) => { const c = cand[(i * 5) % NC], g = haze(0xffa040, 8, 0.25, [c.x, c.y + 0.4, c.z]); scene.add(g); return g; });

  // ---- the dais, coffin and rising vampire
  const dais = new THREE.Group(); dais.position.set(0, 0, -4.5); dais.scale.setScalar(1.35); scene.add(dais);
  for (let i = 0; i < 3; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(11 - i * 2, 0.5, 7 - i * 1.4), i % 2 ? darkStone : stone); step.position.set(0, 0.25 + i * 0.5, 0); dais.add(step); }
  const cofShape = new THREE.Shape(); [[-1.3, -3], [1.3, -3], [2.2, 1.2], [1.4, 3.2], [-1.4, 3.2], [-2.2, 1.2]].forEach(([x, y], i) => i ? cofShape.lineTo(x, y) : cofShape.moveTo(x, y));
  const coffin = new THREE.Mesh(new THREE.ExtrudeGeometry(cofShape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0x1a0a18, roughness: 0.4, metalness: 0.3 })); coffin.rotation.x = -Math.PI / 2; coffin.position.set(0, 1.7, 2.4); dais.add(coffin);
  const lining = new THREE.Mesh(new THREE.ShapeGeometry(cofShape), new THREE.MeshStandardMaterial({ color: 0x8a0a2a, roughness: 0.8, emissive: 0x400010, emissiveIntensity: 0.5 })); lining.rotation.x = -Math.PI / 2; lining.position.set(0, 2.95, 2.4); lining.scale.set(0.9, 0.93, 1); dais.add(lining);
  const lidP = new THREE.Group(); lidP.position.set(-2.2, 3.05, 0.0); dais.add(lidP);
  const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(cofShape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0x241020, roughness: 0.4, metalness: 0.3 })); lid.rotation.x = -Math.PI / 2; lid.position.set(2.2, 0, 2.4); lidP.add(lid);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.1), new THREE.MeshStandardMaterial({ color: 0xc8a850, metalness: 1, roughness: 0.3 })); cross.position.set(2.2, 0.3, 2.4); cross.rotation.x = -Math.PI / 2; lidP.add(cross); const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.1), cross.material); cross2.position.set(2.2, 0.3, 2.4 - 0.6); cross2.rotation.x = -Math.PI / 2; lidP.add(cross2);
  // vampire
  const vamp = new THREE.Group(); vamp.position.set(0, 2.5, 2.4); dais.add(vamp);
  const black = new THREE.MeshStandardMaterial({ color: 0x120a18, roughness: 0.5 }), pale = new THREE.MeshStandardMaterial({ color: 0xe8e0ea, roughness: 0.4 }), crimson = new THREE.MeshStandardMaterial({ color: 0x9a1030, roughness: 0.6, emissive: 0x400010, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 3.0, 12), black); body.position.y = 1.2; vamp.add(body);
  const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), new THREE.MeshStandardMaterial({ color: 0xf4f0f0 })); shirt.position.set(0, 1.6, 0.82); vamp.add(shirt);
  const cravat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff2040 })); cravat.rotation.x = Math.PI; cravat.position.set(0, 2.4, 0.9); vamp.add(cravat);
  const vhead = new THREE.Group(); vhead.position.y = 3.35; vamp.add(vhead);
  vhead.add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), pale));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 10, 0, TAU, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x08040c })); hair.position.y = 0.12; hair.rotation.x = -0.25; vhead.add(hair);
  const widow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x08040c })); widow.rotation.x = Math.PI; widow.position.set(0, 0.55, 0.52); vhead.add(widow);
  const eyesV = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })); e.position.set(s * 0.24, 0.08, 0.52); vhead.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 5), pale); ear.position.set(s * 0.64, 0.05, 0); ear.rotation.z = -s * 1.3; vhead.add(ear); const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); f.rotation.x = Math.PI; f.position.set(s * 0.14, -0.28, 0.55); vhead.add(f); return e; });
  const mouthV = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x20060c })); mouthV.position.set(0, -0.22, 0.58); vhead.add(mouthV);
  const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * 1.0, 2.5, 0.2); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 1.9, 8), black); r.position.y = -0.95; a.add(r); const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), pale); h.position.y = -2.0; a.add(h); for (let f = 0; f < 3; f++) { const fi = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.5, 4), pale); fi.position.set((f - 1) * 0.1, -2.35, 0); a.add(fi); } vamp.add(a); return a; });
  const capeG = new THREE.PlaneGeometry(4.4, 5.2, 18, 14), capeBase = Float32Array.from(capeG.attributes.position.array), cape = new THREE.Mesh(capeG, crimson); cape.position.set(0, 2.2, -0.9); vamp.add(cape);
  const collarL = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), crimson); c.position.set(s * 0.7, 3.0, -0.2); c.rotation.z = -s * 0.35; vamp.add(c); return c; });

  // ---- blood-moon window + DAWGHOUSE slab
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.45, 8, 32, Math.PI), stone); arch.position.set(0, 7, -24); scene.add(arch);
  for (const x of [-4.6, 4.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 7, 1), stone); p.position.set(x, 3.5, -24); scene.add(p); }
  const bmoon = new THREE.Mesh(new THREE.CircleGeometry(4.1, 40, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff3a3a, toneMapped: false })); bmoon.position.set(0, 7, -24.5); scene.add(bmoon);
  const bmoon2 = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 7), new THREE.MeshBasicMaterial({ color: 0x8a1822, toneMapped: false })); bmoon2.position.set(0, 3.5, -24.5); scene.add(bmoon2);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 36), new THREE.MeshBasicMaterial({ color: 0xffb0a0, toneMapped: false })); moonDisc.position.set(0, 7.2, -24.3); scene.add(moonDisc);
  const moonHalo = haze(0xff2a3a, 22, 0.4, [0, 7, -24]); scene.add(moonHalo);
  for (let i = -3; i <= 3; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 12, 0.2), darkStone); bar.position.set(i * 1.2, 5, -23.9); scene.add(bar); }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(12.6, 2.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a2a48, roughness: 0.5, metalness: 0.2 })); slab.position.set(0, 14.4, -22); scene.add(slab);
  const sign = dawgSign(scene, C, { width: 11, pos: [0, 14.4, -21.4], size: 2.1, depth: 0.5, emis: 0xff2a3a, color: 0xffd8d0, hop: 0.2, glow: true });

  // chandelier + bats
  const chand = new THREE.Group(); chand.position.set(0, 16.5, -5); scene.add(chand);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 28), new THREE.MeshStandardMaterial({ color: 0x2a2030, metalness: 0.8, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.y = -3; chand.add(ring); const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), ring.material); chain.position.y = -1.5; chand.add(chain);
  const chFlames = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * TAU; const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), flameM); f.position.set(Math.cos(a) * 2.2, -2.6, Math.sin(a) * 2.2); chand.add(f); return f; });
  const chGlow = haze(0xffa040, 9, 0.3, [0, -2.6, 0]); chand.add(chGlow);
  const batG = new THREE.BufferGeometry(); batG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -1.2, 0.5, 0, -0.4, -0.3, 0, 0, 0, 0, 1.2, 0.5, 0, 0.4, -0.3, 0, -0.25, 0, 0, 0.25, 0, 0, 0, -0.5, 0]), 3));
  const NB = 14, bats = new THREE.InstancedMesh(batG, new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.DoubleSide }), NB), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bs = new THREE.Vector3(), bp = new THREE.Vector3(); scene.add(bats);
  const BPd = Array.from({ length: NB }, (_, i) => ({ r: 5 + R() * 7, y: 9 + R() * 6, f: 1 + (i % 2), ph: R(), w: 6 + R() * 5 })); const mist = [0, 1, 2].map(i => { const h = haze(0x8a6aaa, 26, 0.1, [(i - 1) * 8, 1.2, -4 - i * 10]); scene.add(h); return h; });
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), rise = 0.5 - 0.5 * Math.cos(TAU * p / 8), pop = Math.min(1, k.kick * 1.2);
      sign.update(m);
      // candles dance with the spectrum
      for (let i = 0; i < NC; i++) { const c = cand[i], e = band(k.env, (i % 14) / 13) * 0.8 + band(k.hit, (i % 14) / 13) * 0.5, fl = 0.8 + 0.3 * Math.sin(a * 13 + i * 1.7) + 0.2 * Math.sin(a * 29 + i) + 0.9 * e; fp.set(c.x, c.y + 0.5, c.z); fs.set(0.9 + 0.2 * e, fl, 0.9 + 0.2 * e); fm.compose(fp, fq.identity(), fs); flames.setMatrixAt(i, fm); }
      flames.instanceMatrix.needsUpdate = true; candGlow.forEach((g, i) => g.material.opacity = 0.14 + 0.2 * band(k.env, i / 7) + 0.15 * k.kick);
      key.intensity = 26 + 12 * Math.sin(a * 11) + 22 * k.kick; red.intensity = 50 + 50 * k.kick + 30 * k.snare; moonHalo.material.opacity = 0.3 + 0.3 * k.kick; moonDisc.scale.setScalar(1 + 0.04 * k.bass);
      // lid lifts and the vampire rises: slow swell over 8 beats, popped by the kick
      lidP.rotation.z = 0.15 + 1.25 * rise + 0.15 * pop; vamp.position.y = 2.5 - 2.6 + 2.8 * rise + 0.25 * pop; vamp.rotation.y = 0.15 * Math.sin(a);
      const spread = Math.min(1, k.snare * 1.3 + 0.3 * rise); arms[0].rotation.set(-0.3 * (1 - spread), 0, 0.5 + 1.1 * spread); arms[1].rotation.set(-0.3 * (1 - spread), 0, -0.5 - 1.1 * spread);
      vhead.rotation.set(0.15 * Math.sin(a * 2) + 0.25 * pop, 0.4 * Math.sin(a), 0); eyesV.forEach(e => e.scale.setScalar(1 + 0.8 * k.kick)); mouthV.scale.set(1, 1 + 8 * Math.max(k.bass, band(k.env, 0.2)), 1); collarL.forEach((c, i) => c.rotation.z = (i ? 1 : -1) * (-0.35 - 0.3 * spread));
      const pos = cape.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = capeBase[i * 3], y = capeBase[i * 3 + 1], dn = (2.6 - y) / 5.2; pos.setXYZ(i, x * (1 + (0.55 * spread + 0.15) * dn * 1.4), y, -0.4 * dn * (1 + 1.2 * spread) + 0.28 * Math.sin(y * 1.7 + a * 4 + x * 0.8) * dn * (0.6 + k.snare * 1.5)); } pos.needsUpdate = true; cape.geometry.computeVertexNormals();
      // chandelier + bats
      chand.rotation.z = 0.09 * Math.sin(a * 2); chand.rotation.x = 0.05 * Math.cos(a * 2); chFlames.forEach((f, i) => f.scale.set(1, 0.8 + 0.3 * Math.sin(a * 17 + i * 2) + 0.7 * band(k.env, i / 7), 1)); chGlow.material.opacity = 0.2 + 0.2 * k.kick;
      for (let i = 0; i < NB; i++) { const b = BPd[i], ang = TAU * (t * b.f + b.ph); bp.set(Math.cos(ang) * b.r, b.y + Math.sin(ang * 2) * 1.2, -12 + Math.sin(ang) * b.r * 1.6); be.set(0, -ang + Math.PI / 2, 0.2 * Math.sin(ang)); bq.setFromEuler(be); bs.set(1.2, 0.35 + 0.65 * Math.abs(Math.sin(a * b.w + i)), 1); bm.compose(bp, bq, bs); bats.setMatrixAt(i, bm); } bats.instanceMatrix.needsUpdate = true;
      mist.forEach((h, i) => h.material.opacity = 0.07 + 0.06 * Math.sin(a + i * 2) + 0.04 * k.bass);
      camera.position.set(1.8 * Math.sin(TAU * t), 3.6 + 0.4 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 23 - 0.5 * k.kick); camera.lookAt(0, 5.6, -12);
    },
  };
}
