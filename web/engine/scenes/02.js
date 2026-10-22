import { THREE, TAU, extrudeText, makeEnv, chrome } from '../lib.js';
import { particles, haze } from '../lib2.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

// 02 - chrome emblem orbit. Uses web/assets/logo-slot/logo.svg (Penn State Athletics) when present, else a generic shield + star placeholder.
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x03060f); scene.fog = new THREE.FogExp2(0x040a1c, 0.014);
  st.bloom.strength = 0.8; st.bloom.radius = 0.7; st.bloom.threshold = 0.9;
  scene.environment = makeEnv(renderer, [
    { w: 40, h: 5, c: 0xbcd4ff, i: 2.0, pos: [0, 14, 6] }, { w: 6, h: 30, c: 0x4aa8ff, i: 3, pos: [-18, 0, 4] }, { w: 6, h: 30, c: 0xff8a3a, i: 1.2, pos: [18, 0, 2] },
    { w: 40, h: 6, c: 0x1c2f66, i: 1.2, pos: [0, -14, 6] }, { w: 30, h: 8, c: 0xffffff, i: 0.8, pos: [0, 0, -16] }]);
  scene.environmentIntensity = 1.6;
  const mat = chrome({ roughness: 0.3, color: 0xffffff });
  const emblem = new THREE.Group(); let usedSlot = false;
  // Penn State Athletics logo (web/assets/logo-slot/logo.svg), layered by path order; ?logo=0 forces the placeholder
  let data = null;
  if (C.q.get('logo') !== '0') { try { data = await new SVGLoader().loadAsync('/assets/logo-slot/logo.svg'); } catch (e) { data = null; } }
  if (data) {
    usedSlot = true;
    // plain 3D version of the SVG: every path extruded in its own color, stacked in paint order
    const g = new THREE.Group(), L = 3;
    data.paths.forEach((p, i) => {
      const m = new THREE.MeshStandardMaterial({ color: p.color, metalness: 0.35, roughness: 0.35 });
      SVGLoader.createShapes(p).forEach(sh => { const e = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.3, bevelSegments: 2 }), m); e.position.z = i * L; g.add(e); });
    });
    const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    g.scale.set(1, -1, 1); g.position.set(-c.x, c.y, -c.z); const w = new THREE.Group(); w.add(g); const k = 9 / Math.max(sz.x, sz.y); w.scale.setScalar(k);
    // same logo turned around on the back so it reads correctly from both sides
    const back = w.clone(); w.position.z = sz.z * k / 2; back.position.z = -sz.z * k / 2; back.rotation.y = Math.PI; emblem.add(w, back);
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
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.2, bevel: 0.1, material: new THREE.MeshStandardMaterial({ color: 0x3a96ff, emissive: 0x1f6fff, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.3 }), targetWidth: 26 });
  T.group.position.set(0, -3.6, -4); scene.add(T.group);
  // orbit rings of chrome torus + satellite shards
  const rings = []; [[6.4, 0.07, 0.35, 0], [8.2, 0.05, -0.2, 1.2], [10, 0.04, 0.12, 2.3]].forEach(([R, r, tilt, ph], i) => {
    const g = new THREE.Group(); const tor = new THREE.Mesh(new THREE.TorusGeometry(R, r, 16, 160), new THREE.MeshStandardMaterial({ color: 0xcfe6ff, metalness: 1, roughness: 0.1 }));
    g.add(tor); const sat = []; for (let k = 0; k < 8 + i * 4; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 - i * 0.04, 0), mat); g.add(s); sat.push(s); }
    g.rotation.x = Math.PI / 2 - 0.25 + tilt; g.rotation.y = ph * 0.2; scene.add(g); g.position.y = 3.4; rings.push({ g, sat, R, i }); });
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x050b1a, metalness: 0.3, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -6.5; scene.add(floor);
  const k1 = new THREE.SpotLight(0xbcd8ff, 70, 0, 0.5, 0.6, 1.5); k1.position.set(-12, 12, 12); k1.target = emblem; scene.add(k1);
  const k2 = new THREE.SpotLight(0xffc89a, 40, 0, 0.5, 0.6, 1.5); k2.position.set(14, 4, 10); k2.target = emblem; scene.add(k2);
  scene.add(haze(0x2a58ff, 50, 0.16, [0, 2, -14]), haze(0x00b4ff, 30, 0.1, [-14, -2, -10]));
  const dust = particles({ count: 700, seed: 21, box: [40, 24, 20], center: [0, 2, 0], color: 0xbcd8ff, size: 0.07, dir: [0, 1, 0], travel: 14, sway: 0.5, opacity: 0.5, H: C.H }); scene.add(dust);
  // hype: colored spotlights sweeping around the emblem, beat shockwave rings, pulsing glow
  const sweep = [[0xff2fa0, 0], [0x2fd0ff, 2.09], [0xffd02f, 4.19]].map(([c, ph]) => { const l = new THREE.SpotLight(c, 60, 0, 0.35, 0.7, 1.5); l.target = emblem; scene.add(l); return { l, ph }; });
  const shocks = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 96), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })); m.position.y = 3.4; scene.add(m); return m; });
  const pulseGlow = haze(0x3a8cff, 22, 0.35, [0, 3.4, -3]); scene.add(pulseGlow);
  return {
    usedSlot,
    update(t) {
      const a = TAU * t, bt = (t * 16) % 1, pulse = Math.exp(-5 * bt);   // pulse = 1 on each beat, decays
      emblem.rotation.y = a * 2; emblem.rotation.x = 0.18 * Math.sin(a * 2); emblem.rotation.z = 0.06 * Math.sin(a * 4);
      emblem.position.y = 3.4 + 0.4 * Math.sin(2 * a); emblem.scale.setScalar(1 + 0.12 * pulse);
      rings.forEach(({ g, sat, R, i }) => { g.rotation.z = a * (i % 2 ? -1 : 1) * (2 + i * 2); g.scale.setScalar(1 + 0.04 * pulse); sat.forEach((s, k) => { const th = k / sat.length * TAU; s.position.set(Math.cos(th) * R, Math.sin(th) * R, 0); s.rotation.set(a * 4, a * 6, 0); s.scale.setScalar(1 + 0.8 * pulse); }); });
      sweep.forEach(({ l, ph }) => { const th = a * 2 + ph; l.position.set(Math.cos(th) * 16, 3 + 7 * Math.sin(a * 3 + ph), 8 + Math.sin(th) * 10); l.intensity = 50 + 40 * pulse; });
      shocks.forEach((m, i) => { const u = ((t * 4 + i / 4) % 1); m.scale.setScalar(2 + u * 20); m.material.opacity = 0.7 * (1 - u) * (1 - u); m.rotation.x = Math.PI / 2 - 0.25; });
      pulseGlow.material.opacity = 0.25 + 0.35 * pulse; pulseGlow.scale.setScalar(22 + 10 * pulse);
      camera.position.set(7 * Math.sin(a), 2.4 + 1.2 * Math.cos(a * 2), 19 + 2.5 * Math.cos(a * 2)); camera.lookAt(0, 1.4, 0);
      dust.userData.u.uT.value = t;
    },
  };
}
