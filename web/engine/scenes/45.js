import { THREE, TAU, rng } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { createKit } from '../dancers.js';
import { dawgSign, beams, ledWall, confetti, crowd, speaker, K, band } from '../pop-kit.js';

// Confetti Club: packed dance club. Tiled LED dance floor, mirror ball throwing light dots, speaker stacks that punch on the kick,
// a glowing DAWGHOUSE neon on the back wall, and confetti cannons that go off every bar.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x05020c); scene.fog = new THREE.FogExp2(0x0a0414, 0.02);
  st.bloom.strength = 0.6; st.bloom.radius = 0.6; st.bloom.threshold = 0.8;
  scene.add(new THREE.AmbientLight(0x4a2a70, 0.45));
  const pal = [0xff2fa0, 0x30e0ff, 0xffd040, 0x9a50ff].map(c => new THREE.Color(c));

  // room: back wall with neon strip panels, floor, side walls
  const wallM = new THREE.MeshStandardMaterial({ color: 0x0b0714, roughness: 0.8 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), wallM); back.position.set(0, 7, -14); scene.add(back);
  for (const x of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), wallM); w.position.set(x * 17, 7, -2); w.rotation.y = -x * Math.PI / 2; scene.add(w); }
  const panels = []; for (let i = 0; i < 11; i++) { const x = -15 + i * 3, p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 11, 0.12), new THREE.MeshBasicMaterial({ color: pal[i % 4], toneMapped: false })); p.position.set(x, 3.5, -13.8); if (Math.abs(x) < 6.2) p.visible = false; scene.add(p); panels.push(p); }
  const floor = ledWall(scene, { cols: 26, rows: 15, cell: 1.45, pos: [0, -3.2, -2], rot: [-Math.PI / 2, 0, 0] }, (q, r, u, v, out, a, k) => {
    const d = Math.hypot(q - 12.5, (r - 7) * 1.1), chk = ((q + r) & 1) ? 1 : 0.55, ring = 0.5 + 0.5 * Math.sin(d * 0.8 - a * 8), e = band(k.env, Math.min(1, Math.abs(u - 0.5) * 2));
    out.copy(pal[(q * 3 + r * 5 + Math.floor(a * 1.3)) % 4 | 0]).multiplyScalar((0.06 + 0.35 * ring * ring * (0.4 + k.kick) + 0.5 * e * k.bass + 0.25 * k.snare * (1 - v)) * chk);
  });

  // neon DAWGHOUSE on the back wall (in a frame)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 4.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x0e0a18, roughness: 0.6 })); frame.position.set(0, 7.2, -13.6); scene.add(frame);
  const sign = dawgSign(scene, C, { width: 14.5, pos: [0, 7.2, -13.2], size: 2, depth: 0.5, emis: 0x20c8ff, color: 0x6ad0ff, hop: 0.3, glow: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.08, 8, 90), new THREE.MeshBasicMaterial({ color: 0xff2fa0, toneMapped: false })); ring.position.set(0, 7.2, -13.6); ring.scale.set(1, 0.3, 1); scene.add(ring);

  // speaker stacks
  const stacks = []; for (const x of [-12.5, 12.5]) for (const [dy, s] of [[-0.9, 1], [3.9, 0.85]]) stacks.push(speaker(scene, { pos: [x, dy, -9], w: 3 * s, h: 4.6 * s, d: 2, rot: -Math.sign(x) * 0.35, trim: x < 0 ? 0xff2fa0 : 0x30e0ff, woofer: 0.95 * s }));

  // mirror ball + orbiting coloured lights give the facets something to reflect, plus dots thrown on the walls
  const ballG = new THREE.Group(); ballG.position.set(0, 10.5, -5); scene.add(ballG);
  ballG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0x444455 })).translateY(3));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 3), new THREE.MeshStandardMaterial({ color: 0xcfd6ee, metalness: 1, roughness: 0.12, flatShading: true })); ballG.add(ball);
  const orbit = [0xff2fa0, 0x30e0ff, 0xffd040].map((c, i) => { const l = new THREE.PointLight(c, 120, 0, 1.5); scene.add(l); return l; });
  const dotsG = new THREE.Group(); dotsG.position.copy(ballG.position); scene.add(dotsG);
  const R = rng(4), dots = []; for (let i = 0; i < 40; i++) { const th = R() * TAU, ph = Math.acos(2 * R() - 1), s = haze(pal[i % 4], 0.8 + R() * 0.6, 0.6, [0, 0, 0]); s.userData = { th, ph, r: 13 + R() * 4 }; dotsG.add(s); dots.push(s); }

  // moving-head beams on a truss
  const bl = []; for (let i = 0; i < 8; i++) { const x = -14 + i * 4; bl.push({ color: pal[i % 4], x, y: 13, z: -6, len: 30, r: 0.5, sway: [0.5, 0.3], f: [1 + (i % 2), 2], ph: i * 0.8, kind: ['kick', 'snare', 'hat', 'kick'][i % 4] }); }
  const rig = beams(scene, bl);
  const truss = new THREE.Mesh(new THREE.BoxGeometry(36, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x222230, metalness: 0.8, roughness: 0.4 })); truss.position.set(0, 13.1, -6); scene.add(truss);

  // cannons: a burst every bar (4 beats). Particles follow a ballistic arc.
  const NB = 90, cannons = [[-11, -2.6, -3, 0.5], [11, -2.6, -3, -0.5]];
  const burst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.17), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), NB * 2), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bp = new THREE.Vector3(), bs = new THREE.Vector3();
  const BP = Array.from({ length: NB * 2 }, (_, i) => { burst.setColorAt(i, pal[i % 4].clone().lerp(new THREE.Color(1, 1, 1), 0.35)); return { c: i % 2, vx: (R() * 0.8 + 0.2), vy: 12 + R() * 8, vz: (R() - 0.5) * 6, sx: 2 + Math.floor(R() * 4), sp: R() * TAU, d: R() * 0.12 }; });
  scene.add(burst);
  const cones = cannons.map(([x, y, z, tilt]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 14), new THREE.MeshStandardMaterial({ color: 0x2a2236, metalness: 0.6, roughness: 0.4 })); c.position.set(x, y, z); c.rotation.z = -tilt * 0.9; scene.add(c); return c; });

  const DK = createKit(scene, { floorY: -3.2 });
  [[DK.skeleton({ hat: true, eye: 0xff2fa0 }), -7, -3], [DK.zombie({ shirt: 0x6a2a6a }), -3.5, -5], [DK.ghost({ tint: 0xffd8f0, hat: true }), 0, -3.5], [DK.mummy({ eye: 0x40ffd0 }), 3.5, -5], [DK.skeleton({ eye: 0x40c8ff }), 7, -3], [DK.pumpkin({ R: 1.0, face: 'grin', hat: true }), -1.8, -7], [DK.pumpkin({ R: 1.0, face: 'smile' }), 2, -7.2]].forEach(([d, x, z], i) => DK.place(d, x, z, 1.15, i * 0.37));
  const dl = new THREE.PointLight(0xfff0ff, 30, 0, 1.4); dl.position.set(0, 6, 4); scene.add(dl);
  const cr = crowd(scene, { rows: [[0, 8.5]], per: 20, x0: -11, x1: 11, y: -2.4, seed: 11 });
  const cf = confetti(scene, { count: 160, box: [28, 14, 14], center: [0, 5, -2], cyc: [1] });
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t);
      DK.tick(t); dl.intensity = 25 + 30 * k.kick; floor.update(a, m); sign.update(m); rig.update(a, m); cr.update(t, k); cf.update(t, k);
      stacks.forEach(s => s.update(k));
      ball.rotation.y = a; ballG.rotation.y = 0; ball.scale.setScalar(1 + 0.06 * k.kick);
      orbit.forEach((l, i) => { const o = a * (i + 1) + i * 2.1; l.position.set(Math.cos(o) * 4, ballG.position.y - 1 + Math.sin(o * 2) * 1, -5 + Math.sin(o) * 4); l.intensity = 40 + 60 * (i ? k.snare : k.kick); });
      dots.forEach((d, i) => { const { th, ph, r } = d.userData, A = th + a * (i % 2 ? 1 : -1), x = Math.sin(ph) * Math.cos(A) * r, z = Math.sin(ph) * Math.sin(A) * r, y = Math.cos(ph) * r * 0.55 - 3; d.position.set(Math.max(-16, Math.min(16, x)), y, Math.max(-13, Math.min(6, z)) + 0); d.material.opacity = 0.15 + 0.35 * k.hat + 0.2 * k.kick; });
      panels.forEach((p, i) => { p.scale.y = 0.5 + 0.5 * band(k.env, i / 10) + 0.2 * k.kick; });
      ring.material.color.copy(pal[Math.floor(a / TAU * 4 + 0.001) % 4]); ring.scale.set(1 + 0.03 * k.kick, 0.3 + 0.05 * k.kick, 1);
      // cannon burst: one per bar, strongest right at the downbeat
      const ph4 = (((t * 4) % 1) + 1) % 1;
      BP.forEach((o, i) => {
        const [cx, cy, cz, tilt] = cannons[o.c], u = Math.max(0, ph4 - o.d * 0.2), tt = u * 3.2, side = tilt;
        const alive = ph4 > 0 ? 1 : 1, g = 9;
        bp.set(cx + side * o.vx * 6 * tt + 1.0 * Math.sin(tt * 3 + o.sp), cy + o.vy * tt - 0.5 * g * tt * tt, cz + o.vz * tt * 0.6); const dead = bp.y < -3.1 || u <= 0;
        be.set(TAU * (t * o.sx) + o.sp, TAU * t * o.sx * 0.5, o.sp); bq.setFromEuler(be); bs.setScalar(dead ? 0.0001 : 1 + 0.5 * k.kick); bm.compose(bp, bq, bs); burst.setMatrixAt(i, bm);
      });
      burst.instanceMatrix.needsUpdate = true;
      cones.forEach((c, i) => { c.scale.set(1, 1 - 0.18 * Math.exp(-ph4 * 14), 1); });
      camera.position.set(1.2 * Math.sin(TAU * t), 3.4 + 0.25 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 14 - 0.4 * k.kick); camera.lookAt(0, 1.8, -7);
    },
  };
}
