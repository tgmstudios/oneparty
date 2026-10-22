import { THREE, TAU } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { dawgSign, beams, ledWall, confetti, crowd, K, band } from '../pop-kit.js';

// Arena Pop: sold-out pop show. Spectrum LED wall behind a DAWGHOUSE marquee, laser fans from the truss, a bobbing crowd, confetti on the drops.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x07030f); scene.fog = new THREE.FogExp2(0x0a0418, 0.01);
  st.bloom.strength = 0.55; st.bloom.radius = 0.6; st.bloom.threshold = 0.85;
  scene.add(new THREE.AmbientLight(0x4a3a7a, 0.35));
  const key = new THREE.PointLight(0xff2fa0, 90, 0, 1.4); key.position.set(-9, 5, 6); const key2 = new THREE.PointLight(0x30d0ff, 80, 0, 1.4); key2.position.set(9, 5, 6); scene.add(key, key2);
  const pal = [new THREE.Color(0xff2fa0), new THREE.Color(0x8a50ff), new THREE.Color(0x30d0ff), new THREE.Color(0xffd040)];

  // LED wall: bottom = live spectrum bars (bass in the middle), top = expanding rings on the beat
  const wall = ledWall(scene, { cols: 40, rows: 17, cell: 0.7, pos: [0, 4.6, -13] }, (q, r, u, v, out, a, k) => {
    const d = Math.abs(u - 0.5) * 2, e = band(k.env, d), hh = 0.1 + 0.8 * Math.min(1, e * (0.75 + 0.35 * Math.sin(q * 1.7 + a * 2))), on = v < hh;
    const ring = 0.5 + 0.5 * Math.sin(Math.hypot((u - 0.5) * 40, (v - 0.4) * 17) * 0.55 - a * 8);
    out.copy(pal[Math.min(3, Math.floor(d * 3.2))]);
    if (on) out.multiplyScalar(0.55 + 0.35 * v + 0.35 * band(k.hit, d)).lerp(pal[3], v > hh - 0.12 ? 0.55 : 0);
    else out.multiplyScalar(0.08 + 0.5 * ring * ring * (0.5 + k.kick));
  });
  // truss + marquee
  const truss = new THREE.Mesh(new THREE.BoxGeometry(34, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x20202a, metalness: 0.8, roughness: 0.4 })); truss.position.set(0, 11.3, -9); scene.add(truss);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(wall.width + 1.2, wall.height + 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x0c0a14, metalness: 0.6, roughness: 0.5 })); frame.position.set(0, 4.6, -13.4); scene.add(frame);
  const sign = dawgSign(scene, C, { width: 19, pos: [0, 12.9, -9.4], size: 2.2, depth: 1, emis: 0xff2fa0, hop: 0.6 });
  // stage deck with light strips
  const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 0.7, 11), new THREE.MeshStandardMaterial({ color: 0x120a22, metalness: 0.7, roughness: 0.25 })); deck.position.set(0, -2.9, -7); scene.add(deck);
  const strips = [-14, -7, 0, 7, 14].map((x, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.25), new THREE.MeshBasicMaterial({ color: pal[i % 4], toneMapped: false })); s.position.set(x, -2.52, -2.0); scene.add(s); return s; });
  const glow = haze(0xff2fa0, 26, 0.1, [0, -2.2, -6]); scene.add(glow);
  // lasers: two crossing fans from the truss
  const L = []; for (let i = 0; i < 9; i++) { const x = -15 + i * 3.75, c = pal[i % 4]; L.push({ color: c, x, y: 12.4, z: -8, len: 38, r: 0.35, sway: [0.55, 0.25], f: [1 + (i % 2), 1 + (i % 3)], ph: i * 0.7, bz: (x / 15) * 0.3, kind: ['kick', 'snare', 'hat'][i % 3] }); }
  const rig = beams(scene, L);
  // crowd + confetti
  const cr = crowd(scene, { rows: [[0, 12.5], [0, 15.5]], per: 26, x0: -15, x1: 15, y: -2.6 });
  const cf = confetti(scene, { count: 360, box: [30, 18, 12], center: [0, 6, 1], cyc: [1, 2] });
    const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t);
      wall.update(a, m); sign.update(m); rig.update(a, m); cr.update(t, k); cf.update(t, k);
      key.intensity = 200 + 200 * k.kick; key2.intensity = 160 + 200 * k.snare; glow.material.opacity = 0.05 + 0.14 * k.kick;
      strips.forEach((s, i) => s.scale.x = 1 + 0.5 * band(k.env, i / 4));
      camera.position.set(1.6 * Math.sin(TAU * t), 1.2 + 0.35 * Math.sin(TAU * t * 2) + 0.12 * k.kick, 23 - 0.5 * k.kick); camera.lookAt(0, 5.6, -10);
    },
  };
}
