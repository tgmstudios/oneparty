import { THREE, TAU, extrudeText, makeEnv, chrome } from '../lib.js';
import { particles, haze } from '../lib2.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

// 02 - chrome emblem orbit. PLACEHOLDER original emblem (generic shield + star) unless ?logo=1 and an authorized
// assets/logo-slot/logo.svg is supplied. No institutional mark is used by default.
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x03060f); scene.fog = new THREE.FogExp2(0x040a1c, 0.014);
  st.bloom.strength = 0.35; st.bloom.radius = 0.5; st.bloom.threshold = 1.2;
  scene.environment = makeEnv(renderer, [
    { w: 40, h: 5, c: 0xbcd4ff, i: 2.0, pos: [0, 14, 6] }, { w: 6, h: 30, c: 0x4aa8ff, i: 3, pos: [-18, 0, 4] }, { w: 6, h: 30, c: 0xff8a3a, i: 1.2, pos: [18, 0, 2] },
    { w: 40, h: 6, c: 0x1c2f66, i: 1.2, pos: [0, -14, 6] }, { w: 30, h: 8, c: 0xffffff, i: 0.8, pos: [0, 0, -16] }]);
  scene.environmentIntensity = 1.1;
  const mat = chrome({ roughness: 0.42 });
  const emblem = new THREE.Group(); let usedSlot = false;
  const q = C.q.get('logo');
  if (q) {
    const data = await new SVGLoader().loadAsync('/assets/logo-slot/logo.svg'); usedSlot = true;
    const g = new THREE.Group();
    data.paths.forEach(p => SVGLoader.createShapes(p).forEach(sh => g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 24, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.5, bevelSegments: 3 }), mat))));
    const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    g.position.sub(c); g.scale.set(1, -1, 1); const w = new THREE.Group(); w.add(g); w.scale.setScalar(7 / Math.max(sz.x, sz.y)); emblem.add(w);
  } else {
    // original placeholder: heraldic shield with raised border and 5-point star
    const sh = new THREE.Shape(); sh.moveTo(-2.1, 2.6); sh.lineTo(2.1, 2.6); sh.lineTo(2.1, 0.2); sh.bezierCurveTo(2.1, -1.6, 0.9, -2.5, 0, -3.2); sh.bezierCurveTo(-0.9, -2.5, -2.1, -1.6, -2.1, 0.2); sh.closePath();
    const inner = new THREE.Shape(); const s2 = 0.78; sh.getPoints(24).forEach((p, i) => i ? inner.lineTo(p.x * s2, p.y * s2 - 0.15) : inner.moveTo(p.x * s2, p.y * s2 - 0.15));
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 5, curveSegments: 20 }), mat);
    const face = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 20 }), new THREE.MeshStandardMaterial({ color: 0x0a2a66, metalness: 0.9, roughness: 0.25 }));
    face.position.z = 0.62;
    const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.62 : 1.5, a = Math.PI / 2 + i * Math.PI / 5; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); } star.closePath();
    const st3 = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 }), mat);
    st3.position.set(0, 0.35, 0.9);
    [base, face, st3].forEach(m => emblem.add(m)); emblem.children.forEach(m => m.position.z -= 0.45); emblem.scale.setScalar(1.05);
  }
  scene.add(emblem);

  // giant chrome type behind
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.2, bevel: 0.1, material: chrome({ roughness: 0.18, color: 0xf2f6ff }), targetWidth: 26 });
  T.group.position.set(0, -3.6, -4); scene.add(T.group);
  // orbit rings of chrome torus + satellite shards
  const rings = []; [[6.4, 0.07, 0.35, 0], [8.2, 0.05, -0.2, 1.2], [10, 0.04, 0.12, 2.3]].forEach(([R, r, tilt, ph], i) => {
    const g = new THREE.Group(); const tor = new THREE.Mesh(new THREE.TorusGeometry(R, r, 16, 160), new THREE.MeshStandardMaterial({ color: 0xcfe6ff, metalness: 1, roughness: 0.1 }));
    g.add(tor); const sat = []; for (let k = 0; k < 4 + i * 2; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 - i * 0.04, 0), mat); g.add(s); sat.push(s); }
    g.rotation.x = Math.PI / 2 - 0.25 + tilt; g.rotation.y = ph * 0.2; scene.add(g); g.position.y = 1.6; rings.push({ g, sat, R, i }); });
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x050b1a, metalness: 0.3, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -6.5; scene.add(floor);
  const k1 = new THREE.SpotLight(0xbcd8ff, 25, 0, 0.5, 0.6, 1.5); k1.position.set(-12, 12, 12); k1.target = emblem; scene.add(k1);
  const k2 = new THREE.SpotLight(0xff9a50, 22, 0, 0.5, 0.6, 1.5); k2.position.set(14, 4, 10); k2.target = emblem; scene.add(k2);
  scene.add(haze(0x2a58ff, 50, 0.16, [0, 2, -14]), haze(0x00b4ff, 30, 0.1, [-14, -2, -10]));
  const dust = particles({ count: 200, seed: 21, box: [40, 20, 20], center: [0, 2, 0], color: 0xbcd8ff, size: 0.045, dir: [0, 1, 0], travel: 6, sway: 0.5, opacity: 0.5, H: C.H }); scene.add(dust);
  return {
    usedSlot,
    update(t) {
      const a = TAU * t;
      emblem.rotation.y = a * 1; emblem.rotation.x = 0.12 * Math.sin(a); emblem.position.y = 1.6 + 0.3 * Math.sin(2 * a);
      rings.forEach(({ g, sat, R, i }) => { g.rotation.z = a * (i % 2 ? -1 : 1) * (1 + i); sat.forEach((s, k) => { const th = k / sat.length * TAU; s.position.set(Math.cos(th) * R, Math.sin(th) * R, 0); s.rotation.set(a * 2, a * 3, 0); }); });
      camera.position.set(4.5 * Math.sin(a * 1), 1.8 + 0.6 * Math.cos(a), 21 + 1.2 * Math.cos(a)); camera.lookAt(0, -1.0, 0);
      dust.userData.u.uT.value = t;
    },
  };
}
