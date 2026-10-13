import { THREE, TAU, layoutText, tubesFromContours, shapeContours, makeEnv } from '../lib.js';
import { particles, haze } from '../lib2.js';

// 05 - original DAWGHOUSE neon script nightclub sign (inspired by user's reference vibe; no third-party branding)
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x010103);
  scene.fog = new THREE.FogExp2(0x05020d, 0.012);
  st.bloom.strength = 1.15; st.bloom.radius = 0.85; st.bloom.threshold = 0.55;
  renderer.toneMappingExposure = 1.0;

  const pink = new THREE.Color(0xff1f9a), core = new THREE.Color(0xffd0ec), violet = new THREE.Color(0xa24bff);
  const neon = [];
  function neonText(font, text, size, targetW, rad, col, coreCol, skew = 0) {
    const L = layoutText(font, text, size, size * 0.05);
    const k = targetW / L.width; const g = new THREE.Group();
    const m1 = new THREE.MeshBasicMaterial({ color: col.clone(), toneMapped: false });
    const m2 = new THREE.MeshBasicMaterial({ color: coreCol.clone(), toneMapped: false });
    const blk = new THREE.MeshBasicMaterial({ color: 0x010103 });
    const inner = new THREE.Group(); const bbAll = new THREE.Box3();
    // per-glyph: tubes + opaque black fill just behind them; each later glyph sits slightly in front, so the
    // overlapping script joins read as one continuous sign instead of crossed outlines
    L.letters.forEach((l, i) => {
      const z = i * 0.3 / k;
      const cs = shapeContours(l.shapes, 14, 0, l.x, 0);
      const ga = tubesFromContours(cs, rad / k, { radial: 8, mult: 1.0 }), gb = tubesFromContours(cs, rad / k * 0.45, { radial: 6, mult: 1.0 });
      const A = new THREE.Mesh(ga, m1), B = new THREE.Mesh(gb, m2); A.position.z = B.position.z = z;
      const fg = new THREE.ShapeGeometry(l.shapes, 14); fg.translate(l.x, 0, z - 0.12 / k);
      inner.add(new THREE.Mesh(fg, blk), A, B); ga.computeBoundingBox(); const bx = ga.boundingBox.clone(); bx.min.z = bx.max.z = 0; bbAll.union(bx);
    });
    const cx = (bbAll.min.x + bbAll.max.x) / 2, cy = (bbAll.min.y + bbAll.max.y) / 2;
    inner.position.set(-cx, -cy, 0); g.add(inner);
    g.scale.setScalar(k); g.rotation.z = skew;
    const out = new THREE.Group(); out.add(g);
    neon.push({ m1, m2, col, coreCol }); out.userData = { w: (bbAll.max.x - bbAll.min.x) * k, h: (bbAll.max.y - bbAll.min.y) * k };
    return out;
  }
  const word = neonText(C.fonts.script, C.event.title || 'One Party', 6, 21, 0.085, pink, core, 0.0);
  word.position.set(0, 0.9, 0); word.rotation.z = THREE.MathUtils.degToRad(-5);
  const rig = new THREE.Group(); scene.add(rig); rig.add(word);
  const sub = neonText(C.fonts.script, C.event.subtitle || 'Party', 2.4, 7.2, 0.04, pink.clone().lerp(violet, 0.35), core, 0);
  sub.position.set(3.6, -3.1, 0.05); sub.rotation.z = THREE.MathUtils.degToRad(-5); const subRig = new THREE.Group(); subRig.add(sub); rig.add(subRig);

  // mounting standoffs (small dark posts) so it reads as a real mounted sign
  // black glossy display panel behind
  const env = makeEnv(renderer, [{ w: 30, h: 4, c: 0xff2fa0, i: 2.5, pos: [0, 0, 14] }, { w: 30, h: 3, c: 0x4a5cff, i: 1.6, pos: [0, 12, 4] }, { w: 10, h: 20, c: 0x8a2bff, i: 1.4, pos: [-16, 0, 6] }]);
  scene.environment = env; scene.environmentIntensity = 0.35;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ color: 0x050407, roughness: 0.28, metalness: 0.6 }));
  panel.position.z = -2.2; scene.add(panel);
  // subtle panel seams like LED display modules
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x0b0a14 });
  for (let i = -4; i <= 4; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 50), seamMat); s.position.set(i * 7.2, 0, -2.18); scene.add(s); }
  for (let j = -2; j <= 2; j++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.05), seamMat); s.position.set(0, j * 4.4, -2.18); scene.add(s); }

  const lp = new THREE.PointLight(0xff2a9c, 90, 0, 1.6); lp.position.set(0, 0.8, 4.5); scene.add(lp);
  const lb = new THREE.PointLight(0x5a52ff, 40, 0, 1.6); lb.position.set(-9, 5, 3); scene.add(lb);

  // blue-white LED ceiling strips (perspective lines)
  const strips = [];
  [[-5.5, 8.8], [5.5, 8.8], [-12, 8.4], [12, 8.4], [0, 9.2]].forEach(([x, y], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6aa8ff).multiplyScalar(1.1), toneMapped: false, transparent: true, opacity: 0.55 }));
    m.position.set(x, y, -50); scene.add(m); strips.push(m);
  });

  // haze
  const hz = [];
  [[-9, 2, -4, 0x5a2cff, 22, 0.16], [8, -2, -4, 0x2b4dff, 24, 0.12], [0, 1, -5, 0xb01ccc, 30, 0.10], [-3, 6, -4, 0x3a2cff, 18, 0.1]].forEach(([x, y, z, c, s, o], i) => { const h = haze(c, s, o, [x, y, z]); h.userData = { x, y, i }; scene.add(h); hz.push(h); });
  const dust = particles({ count: 220, seed: 5, box: [40, 22, 14], center: [0, 0, 1], color: 0xb48cff, size: 0.05, dir: [0.2, 1, 0], travel: 6, sway: 0.8, opacity: 0.55, H: C.H });
  scene.add(dust);

  camera.fov = 40; camera.updateProjectionMatrix();
  return {
    update(t) {
      const a = TAU * t, D = THREE.MathUtils.degToRad, S = Math.sin, K = Math.cos;
      // all terms are integer-cycle sin/cos of a -> seamless 8 s loop
      // sign rig: figure-8 sway (x once, y twice per loop), yaw/roll/scale; Halloween trails with delay + counter-motion
      rig.position.set(1.5 * S(a), 0.6 * S(2 * a), 0.5 * K(2 * a));
      rig.rotation.set(D(2.5) * S(2 * a + 0.6), D(9) * S(a + 0.5), D(3.5) * S(2 * a - 0.4));
      rig.scale.setScalar(1 + 0.025 * K(2 * a));
      subRig.position.set(-1.0 * S(a - 0.9), 0.4 * S(2 * a - 1.3), 0.5 * S(a - 0.9));
      subRig.rotation.set(0, D(-9) * S(a - 0.9), D(-3) * S(2 * a - 1.5));
      // camera dolly push/pull (2 cycles) + drifting orbit, aimed near sign centre so text stays framed
      camera.position.set(1.0 * S(a + 2.2), 0.55 * K(a + 1.0) + 0.4, 24.2 + 1.5 * S(2 * a - 1.2));
      camera.lookAt(0.35 * S(a), 0.5, 0);
      const br = 0.5 + 0.5 * S(a);
      const I = 1.75 + 0.4 * br;
      neon.forEach(n => { n.m1.color.copy(n.col).multiplyScalar(I); n.m2.color.copy(n.coreCol).multiplyScalar(0.9 + 0.2 * br); });
      // slow light sweep across the sign (movement, not flicker)
      lp.position.set(7 * S(a + 0.3), 0.8 + 1.5 * S(2 * a), 4.5);
      lp.intensity = 80 + 25 * br;
      lb.position.set(-9 * K(a), 5 + 2 * S(2 * a), 3);
      hz.forEach((h, i) => { h.position.x = h.userData.x + 3.2 * S(a + i * 1.7); h.position.y = h.userData.y + 1.2 * K(a + i); h.material.opacity = [0.16, 0.12, 0.1, 0.1][i] * (0.88 + 0.12 * S(a + i * 2)); });
      strips.forEach((m, i) => { m.position.x = [-5.5, 5.5, -12, 12, 0][i] + 0.8 * S(a + i); });
      dust.userData.u.uT.value = t;
      window.__pose = { x: rig.position.x, y: rig.position.y, yaw: rig.rotation.y, roll: rig.rotation.z, cz: camera.position.z, sx: subRig.position.x };
    },
  };
}
