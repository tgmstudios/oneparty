import { THREE, TAU, extrudeText, makeEnv, tubesFromContours, shapeContours } from '../lib.js';
import { particles, haze } from '../lib2.js';

// 06 - jack-o-lantern neon: giant ribbed 3D pumpkin w/ neon-tube carved face, DAWGHOUSE extruded neon type in front
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x030108); scene.fog = new THREE.FogExp2(0x0a0212, 0.02);
  st.bloom.strength = 1.0; st.bloom.radius = 0.75; st.bloom.threshold = 0.75;
  scene.environment = makeEnv(renderer, [{ w: 30, h: 10, c: 0xff6a00, i: 1.8, pos: [0, 0, 12] }, { w: 20, h: 20, c: 0x8a2cff, i: 1.4, pos: [-16, 4, 0] }, { w: 20, h: 20, c: 0x00d0ff, i: 1.0, pos: [16, 4, 0] }]); scene.environmentIntensity = 0.55;

  // pumpkin: sphere with 10 ribs via radial displacement
  const R = 5.2, geo = new THREE.SphereGeometry(R, 128, 96); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const th = Math.atan2(z, x), ph = Math.acos(y / R);
    const rib = 1 + 0.075 * Math.cos(th * 10) * Math.sin(ph) ** 0.8; const sq = 0.86;
    p.setXYZ(i, x * rib, y * sq * (1 - 0.06 * Math.exp(-((ph) ** 2) * 18)), z * rib); }
  geo.computeVertexNormals();
  // carved face as emissive texture on sphere front is complex; instead use unlit inner glow + carved neon tubes + dark cutouts via emissive map
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
  // face cutouts on texture region centered at u=0.25 (front toward +z for sphere uv: u=0.25 => x=0? we rotate mesh to match)
  const cx = 256, cy = 262;
  g.fillStyle = '#ffffff';
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.8); g.lineTo(x + s, y + s * 0.8); g.lineTo(x, y - s * 0.9); g.closePath(); g.fill(); };
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); 
  tri(cx - 110, cy - 40, 62); tri(cx + 110, cy - 40, 62);
  g.beginPath(); g.moveTo(cx - 20, cy + 15); g.lineTo(cx + 20, cy + 15); g.lineTo(cx, cy + 45); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx - 190, cy + 85); 
  for (let i = 0; i <= 10; i++) { const x = cx - 190 + i * 38; const y = cy + 85 + (i % 2 ? 55 : 0) + 55 * Math.sin(i / 10 * Math.PI) ; g.lineTo(x, y); }
  for (let i = 10; i >= 0; i--) { const x = cx - 190 + i * 38; g.lineTo(x, cy + 85 + 20 * Math.sin(i / 10 * Math.PI) - 18); }
  g.closePath(); g.fill();
  const mask = new THREE.CanvasTexture(cv);
  const pm = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.45, metalness: 0.05, emissive: 0xff7a10, emissiveMap: mask, emissiveIntensity: 2.2 });
  pm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float cut = texture2D(emissiveMap, vEmissiveMapUv).r; diffuseColor.rgb *= mix(1.0, 0.04, cut);'); };
  const pump = new THREE.Mesh(geo, pm); pump.rotation.y = -Math.PI / 2 * 0 + Math.PI / 2 * 0; scene.add(pump);
  pump.rotation.y = Math.PI * 0.5 * 0 - Math.PI / 2 + Math.PI / 2 * 0; // front faces +z when u=.25
  pump.rotation.y = -Math.PI / 2 + Math.PI; 
  // stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0x2f5a1a, roughness: 0.8 })); stem.position.set(0.3, R * 0.86 + 0.1, 0); stem.rotation.z = -0.25; scene.add(stem);
  // inner glow light
  const inner = new THREE.PointLight(0xff8a1a, 260, 0, 1.2); inner.position.set(0, 0, 1.5); scene.add(inner);
  const inner2 = haze(0xff7a10, 26, 0.35, [0, 0, 1]); scene.add(inner2);

  // neon type
  const tubeMat = (c, m) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(m), toneMapped: false });
  const body = new THREE.MeshStandardMaterial({ color: 0x0a0612, metalness: 0.6, roughness: 0.35 });
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.0, bevel: 0.08, material: body, targetWidth: 20 });
  T.group.position.set(0, -5.1, 5.2); scene.add(T.group);
  // neon edge outline on front face of every letter
  const neonCol = new THREE.Color(0x9a4cff); const neonMat = tubeMat(0x9a4cff, 2.2); const neonMat2 = tubeMat(0x00e5ff, 2.0);
  T.meshes.forEach((m, i) => {
    const sh = C.fonts.block.generateShapes(m.userData.ch, 2.4); const bb = new THREE.Box2(); sh.forEach(s => s.getPoints(8).forEach(q => bb.expandByPoint(q)));
    const cxl = (bb.min.x + bb.max.x) / 2, cyl = (bb.min.y + bb.max.y) / 2;
    const geoT = tubesFromContours(shapeContours(sh, 10, 0, -cxl, -cyl), 0.045, { radial: 6 });
    const tube = new THREE.Mesh(geoT, i % 2 ? neonMat2 : neonMat); tube.position.z = 0.55 + 0.07; m.add(tube);
  });
  const purpleL = new THREE.PointLight(0x9a4cff, 70, 0, 1.4); purpleL.position.set(-8, -3, 9); scene.add(purpleL);
  const cyanL = new THREE.PointLight(0x00e5ff, 50, 0, 1.4); cyanL.position.set(9, -3, 9); scene.add(cyanL);
  // floor reflection
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(100, 60), new THREE.MeshStandardMaterial({ color: 0x07030c, metalness: 0.3, roughness: 0.7 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -6.6; scene.add(fl);
  scene.add(haze(0x8a2cff, 60, 0.14, [-14, 2, -10]), haze(0x00b4ff, 45, 0.1, [16, 0, -10]));
  const bats = particles({ count: 160, seed: 61, box: [44, 22, 14], center: [0, 3, -2], color: 0xffa050, size: 0.07, dir: [0, 1, 0], travel: 14, sway: 0.8, opacity: 0.8, H: C.H }); scene.add(bats);
  return {
    update(t) {
      const a = TAU * t;
      pump.rotation.y = 0.28 * Math.sin(a); pump.position.y = 2.4 + 0.12 * Math.sin(a * 2);
      stem.position.y = pump.position.y + R * 0.86 + 0.1; inner.position.y = pump.position.y;
      inner.intensity = 230 + 50 * Math.sin(a); inner2.material.opacity = 0.3 + 0.06 * Math.sin(a);
      pm.emissiveIntensity = 2.0 + 0.4 * Math.sin(a);
      neonMat.color.set(0x9a4cff).multiplyScalar(2.0 + 0.4 * Math.sin(a)); neonMat2.color.set(0x00e5ff).multiplyScalar(1.8 + 0.4 * Math.sin(a + 1.5));
      camera.position.set(2.5 * Math.sin(a), 1.4 + 0.4 * Math.cos(a), 27 + 0.6 * Math.sin(2 * a)); camera.lookAt(0, -0.6, 0);
      bats.userData.u.uT.value = t;
    },
  };
}
