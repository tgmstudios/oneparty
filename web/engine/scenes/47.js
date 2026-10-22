import { THREE, TAU, rng } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Hyperdrive Rave: flying down an endless LED tunnel at warp speed toward a giant DAWGHOUSE gate. Rings stream past one per beat,
// star streaks rush by, the kick flashes the whole tunnel white and the snare rolls the camera.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x030108); scene.fog = new THREE.Fog(0x050210, 40, 160);
  st.bloom.strength = 0.7; st.bloom.radius = 0.6; st.bloom.threshold = 0.78;
  const R = rng(77), NR = 20, SPR = 5, RAD = 7.5;

  // rings: octagonal LED frames that fly toward the camera, one ring-spacing per beat
  const ringG = new THREE.TorusGeometry(RAD, 0.15, 6, 8), ringM = [], rings = [];
  for (let i = 0; i < NR; i++) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: true }); const r = new THREE.Mesh(ringG, m); r.rotation.z = Math.PI / 8; scene.add(r); rings.push(r); ringM.push(m); }
  // inner accent rings (smaller, counter rotating) for depth
  const inG = new THREE.TorusGeometry(RAD * 0.55, 0.05, 4, 6), inner = [], innerM = [];
  for (let i = 0; i < NR; i += 2) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); const r = new THREE.Mesh(inG, m); scene.add(r); inner.push(r); innerM.push(m); }

  // corner rails
  const rails = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, NR * SPR + 40), m); r.position.set(Math.cos(a) * RAD, Math.sin(a) * RAD, -(NR * SPR) / 2 + 6); scene.add(r); rails.push(m); }

  // star streaks (instanced), wrap exactly one field-length per 16 beats * k
  const NS = 320, FL = NR * SPR, streak = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 2.6), new THREE.MeshBasicMaterial({ color: 0xcfd8ff, toneMapped: false, transparent: true, opacity: 0.9 }), NS), sm = new THREE.Matrix4(), sp = new THREE.Vector3(), sq = new THREE.Quaternion(), ss = new THREE.Vector3();
  const SP_ = Array.from({ length: NS }, () => { const a = R() * TAU, r = 0.5 + Math.sqrt(R()) * (RAD * 0.9); return { x: Math.cos(a) * r, y: Math.sin(a) * r, z0: R() * FL, v: [1, 2, 3][Math.floor(R() * 3)] }; });
  scene.add(streak);

  // the gate at the end of the tunnel
  const sign = dawgSign(scene, C, { width: 40, pos: [0, 0, -(FL + 8)], size: 2.4, depth: 1.6, emis: 0xff2fa0, color: 0xffffff, hop: 1.4, glow: true });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(28, 0.45, 8, 64), new THREE.MeshBasicMaterial({ color: 0x30e0ff, toneMapped: false })); halo.position.set(0, 0, -(FL + 8.5)); scene.add(halo);
  const core = haze(0xff2fa0, 70, 0.2, [0, 0, -(FL + 14)]); scene.add(core);
  const white = new THREE.Color(1, 1, 1), bg = bgClock(); const hc = new THREE.Color();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hue = (m.hue ?? 0.25 * Math.floor(t * 4));
      rings.forEach((r, i) => {
        const d = ((((i - p) % NR) + NR) % NR), z = 4 - d * SPR, e = band(k.env, d / NR);
        r.position.z = z; r.rotation.z = Math.PI / 8 + (i % 2 ? 1 : -1) * a * 0.25 + 0.02 * k.snare * i;
        hc.setHSL((hue + d * 0.035) % 1, 1, 0.5 + 0.1 * e); ringM[i].color.copy(hc).multiplyScalar(0.5 + 0.7 * e + 0.45 * k.kick).lerp(white, Math.min(0.35, 0.25 * k.kick * (1 - d / NR) + 0.15 * band(k.hit, d / NR)));
        r.scale.setScalar((1 + 0.06 * k.kick * (1 - d / NR) + 0.04 * band(k.hit, d / NR)) * (1 + 3.4 * Math.pow(d / NR, 3)));
      });
      inner.forEach((r, j) => { const i = j * 2, d = ((((i - p) % NR) + NR) % NR); r.position.z = 4 - d * SPR; r.rotation.z = -a * 0.5 + j; r.scale.setScalar(1 + 3.4 * Math.pow(d / NR, 3)); hc.setHSL((hue + 0.5 + d * 0.03) % 1, 0.9, 0.55); innerM[j].color.copy(hc).multiplyScalar(0.25 + 0.6 * k.snare + 0.2 * band(k.env, 0.6)); });
      rails.forEach((mm, i) => { hc.setHSL((hue + i * 0.06) % 1, 1, 0.55); mm.color.copy(hc).multiplyScalar(0.25 + 0.6 * k.kick + 0.2 * k.bass); });
      SP_.forEach((o, i) => { const z = -(((o.z0 + p * SPR * o.v * 0.5) % FL)) + 4 - FL + FL; sp.set(o.x, o.y, 4 - (FL - ((o.z0 + p * SPR * o.v * 0.5) % FL))); ss.set(1, 1, 1 + 0.8 * k.kick * o.v); sm.compose(sp, sq, ss); streak.setMatrixAt(i, sm); });
      streak.instanceMatrix.needsUpdate = true;
      sign.update(m); halo.rotation.z = a * 0.5; halo.scale.setScalar(1 + 0.05 * k.kick); halo.material.color.setHSL((hue + 0.5) % 1, 1, 0.55);
      core.material.opacity = 0.12 + 0.25 * k.kick; sign.mat.emissive.setHSL((hue + 0.9) % 1, 1, 0.5);
      // camera: forward shake on the kick, roll on the snare, sway otherwise
      camera.position.set(0.5 * Math.sin(a) + 0.12 * k.kick * Math.sin(a * 37), 0.35 * Math.sin(a * 2) + 0.1 * k.kick * Math.cos(a * 29), 6);
      camera.lookAt(0.8 * Math.sin(a), 0.4 * Math.cos(a), -40); camera.rotateZ(0.12 * Math.sin(a * 2) + 0.16 * k.snare * Math.sin(a * 8));
    },
  };
}
