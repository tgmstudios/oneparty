import { THREE, TAU, rng, makeEnv, extrudeText } from '../lib.js';
import { haze, music, skyGradient, brickTexture, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// When the Bell Tolls: the belfry of a storm-lashed gothic tower. A colossal bronze bell swings in the pointed arch; every four beats it tolls -
// shockwave rings roll out across the sky, bats burst from the tower, lightning cracks on the snare, a stained-glass rose window flares, torches flicker,
// rain streaks past, and DAWGHOUSE is carved on the stone lintel over the arch.
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x06050e); scene.fog = new THREE.FogExp2(0x0c0a1c, 0.01);
  st.bloom.strength = 0.6; st.bloom.radius = 0.7; st.bloom.threshold = 0.8;
  scene.environment = makeEnv(renderer, [{ w: 14, h: 14, c: 0xff9a40, i: 3.0, pos: [-14, 6, 8] }, { w: 14, h: 14, c: 0xff9a40, i: 3.0, pos: [14, 6, 8] }, { w: 40, h: 8, c: 0x6a8aff, i: 1.2, pos: [0, 16, 4] }, { w: 30, h: 6, c: 0x201030, i: 0.6, pos: [0, -10, 6] }], 0x06050e);
  scene.environmentIntensity = 1.3;
  const R = rng(36), hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  const amb = new THREE.AmbientLight(0x6a6aaa, 0.8); scene.add(amb);
  const torchL = [-1, 1].map(s => { const l = new THREE.PointLight(0xff8a30, 60, 0, 1.5); l.position.set(s * 9.2, 3.2, 4); scene.add(l); return l; });

  // sky + moon behind the tower
  scene.add(skyGradient([[0, '#05040e'], [0.5, '#16123a'], [0.8, '#2a2a5a'], [1, '#3a3a6a']], -60, 400, 220));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshBasicMaterial({ color: 0xe8e8ff, toneMapped: false, fog: false })); moon.position.set(5, 14, -50); scene.add(moon); scene.add(haze(0x9aa8ff, 60, 0.25, [5, 14, -51]));
  const clouds = [0, 1, 2, 3, 4].map(i => { const h = haze(0x2a2a4a, 70, 0.4, [(i - 2) * 26, 8 + (i % 2) * 8, -45]); scene.add(h); return { h, i }; });

  // ---- tower wall with a pointed-arch opening
  const wallW = 40, wallH = 28, wallShape = new THREE.Shape(); wallShape.moveTo(-wallW / 2, -4); wallShape.lineTo(wallW / 2, -4); wallShape.lineTo(wallW / 2, wallH - 4); wallShape.lineTo(-wallW / 2, wallH - 4); wallShape.closePath();
  const hole = new THREE.Path(); hole.moveTo(-6, -4); hole.lineTo(-6, 4.5); hole.bezierCurveTo(-6, 9, -2.4, 11.4, 0, 13.4); hole.bezierCurveTo(2.4, 11.4, 6, 9, 6, 4.5); hole.lineTo(6, -4); hole.closePath(); wallShape.holes.push(hole);
  const brick = brickTexture({ base: [62, 58, 78], vary: 22, rows: 10, cols: 5, seed: 9, mortar: '#0a0814' }); brick.repeat.set(1 / 8, 1 / 8);
  const wg = new THREE.ExtrudeGeometry(wallShape, { depth: 3, bevelEnabled: false }); const uvA = wg.attributes.uv, pos = wg.attributes.position; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, pos.getX(i) / 7, pos.getY(i) / 6);
  const stone = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, emissive: 0x2a2038, emissiveIntensity: 0.9 }); brick.repeat.set(1, 1);
  const wall = new THREE.Mesh(wg, stone); wall.position.set(0, 0, -1.5); scene.add(wall);
  const trimM = new THREE.MeshStandardMaterial({ color: 0x4a4660, roughness: 0.8 });
  for (const s of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(1.4, wallH, 3.6), trimM); pil.position.set(s * 6.9, wallH / 2 - 4, 0.3); scene.add(pil); const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 4), trimM); cap.rotation.y = Math.PI / 4; cap.position.set(s * 6.9, wallH - 2.4, 0.3); scene.add(cap); }
  // arch moulding (two nested thin extrusions via torus segments)
  for (const [r, w] of [[6.55, 0.35], [7.1, 0.28]]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 32, Math.PI), trimM); m.scale.set(1, 1.25, 1); m.position.set(0, 5.4, 1.7); scene.add(m); }
  // lintel with carved lettering (stone, backlit warm)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(13.6, 2.2, 0.9), trimM); lintel.position.set(0, 14.9, 1.6); scene.add(lintel);
  const sign = dawgSign(scene, C, { width: 11.8, pos: [0, 14.9, 2.2], size: 2, depth: 0.55, emis: 0xffa030, color: 0xe0d4c0, hop: 0.2, glow: false, metal: 0.1 });

  // rose window above the lintel
  const rc = document.createElement('canvas'); rc.width = rc.height = 256; const rg = rc.getContext('2d');
  const cols = ['#e02a5a', '#2a8ae0', '#ffc030', '#40d090', '#a050e0', '#ff7a30'];
  for (let i = 0; i < 12; i++) { rg.fillStyle = cols[i % 6]; rg.beginPath(); rg.moveTo(128, 128); rg.arc(128, 128, 124, (i / 12) * TAU, ((i + 1) / 12) * TAU); rg.fill(); } rg.fillStyle = '#10081a'; for (let i = 0; i < 12; i++) { rg.save(); rg.translate(128, 128); rg.rotate((i / 12) * TAU); rg.fillRect(-2, 20, 4, 108); rg.restore(); } rg.strokeStyle = '#10081a'; rg.lineWidth = 6; for (const r of [124, 80, 40]) { rg.beginPath(); rg.arc(128, 128, r, 0, TAU); rg.stroke(); }
  const rTex = new THREE.CanvasTexture(rc); rTex.colorSpace = THREE.SRGBColorSpace;
  const rose = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshBasicMaterial({ map: rTex, toneMapped: false })); rose.position.set(0, 20.2, 1.6); scene.add(rose);
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.3, 8, 48), trimM); roseRing.position.set(0, 20.2, 1.6); scene.add(roseRing);
  const roseGlow = haze(0xff8aff, 14, 0.25, [0, 20.2, 2.2]); scene.add(roseGlow);
  // slit windows
  const slits = [-14, 14, -10.5, 10.5].map((x, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.6), new THREE.MeshBasicMaterial({ color: pcol(i), toneMapped: false })); m.position.set(x, 5 + (i > 1 ? 4 : 0), 1.6); scene.add(m); return m; });
  function pcol(i) { return [0xff7a30, 0x60a0ff, 0xff3fa0, 0x60ff9a][i % 4]; }

  // ---- belfry interior: floor, beams, yoke, the bell
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.8 });
  const bfloor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 5), wood); bfloor.position.set(0, -3.8, -0.5); scene.add(bfloor);
  const beams = [[0, 11.4, -0.5, 13, 0.7, 0.7], [0, 9.2, -2.2, 13, 0.5, 0.5], [-5.6, 3.8, -2.2, 0.6, 14, 0.6], [5.6, 3.8, -2.2, 0.6, 14, 0.6]];
  beams.forEach(([x, y, z, w, h, d]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); b.position.set(x, y, z); scene.add(b); });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(13, 18), new THREE.MeshBasicMaterial({ color: 0x0c0a18 })); back.position.set(0, 5, -3.2); scene.add(back);
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb87a38, metalness: 1, roughness: 0.28, envMapIntensity: 1.4 });
  const pivot = new THREE.Group(); pivot.position.set(0, 10.8, -0.5); scene.add(pivot);
  const profile = [[0, 2.6], [0.22, 2.48], [0.43, 1.9], [0.8, 0.85], [1.35, 0.12], [1.5, -0.22], [1.35, -0.38], [0.4, -0.2], [0, -0.18]].map(([r, y]) => new THREE.Vector2(r * 2.3, y * 2.3));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 56), bronze); bell.position.y = -6.9; pivot.add(bell);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.7), wood); yoke.position.y = 0; pivot.add(yoke);
  for (const [r, y] of [[3.45, -7.4], [1.84, -4.9], [1.0, -2.5]]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 8, 40), new THREE.MeshStandardMaterial({ color: 0xe0a850, metalness: 1, roughness: 0.25 })); rim.rotation.x = Math.PI / 2; rim.position.y = y; pivot.add(rim); }
  const clapper = new THREE.Group(); clapper.position.set(0, -6.2, 0); pivot.add(clapper); const cs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 6), bronze); cs.position.y = -2.6; clapper.add(cs); const cb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), bronze); cb.position.y = -5.4; clapper.add(cb);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 9, 6), new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.9 })); rope.position.set(2.2, 6.5, 0.5); scene.add(rope);
  const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc02a3a, emissive: 0x601018, emissiveIntensity: 0.4 })); tassel.position.set(2.2, 2.0, 0.5); scene.add(tassel);

  // ---- torches
  const flames = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 9.4, 2.4, 2.4); scene.add(g); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.4, 6), wood); stick.position.y = -0.8; g.add(stick); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.8 })); cup.position.y = 0.55; g.add(cup); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xff9a30, toneMapped: false })); fl.position.y = 1.5; g.add(fl); const fl2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.0, 8), new THREE.MeshBasicMaterial({ color: 0xffe080, toneMapped: false })); fl2.position.y = 1.35; g.add(fl2); const gl = haze(0xff8a30, 7, 0.5, [0, 1.4, 0.3]); g.add(gl); return { g, fl, fl2, gl, s }; });

  // ---- toll rings, bats, rain
  const rings = [0, 1, 2].map(i => { const m = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }); const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 80), m); r.position.set(0, 4.5, -4 - i * 0.2); scene.add(r); return { r, m, i }; });
  const batG = new THREE.BufferGeometry(); batG.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -1.2, 0.5, 0, -0.4, -0.3, 0, 0, 0, 0, 1.2, 0.5, 0, 0.4, -0.3, 0, -0.25, 0, 0, 0.25, 0, 0, 0, -0.5, 0]), 3));
  const NB = 26, bats = new THREE.InstancedMesh(batG, new THREE.MeshBasicMaterial({ color: 0x0a0812, side: THREE.DoubleSide, fog: false }), NB), bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bs = new THREE.Vector3(), be = new THREE.Euler();
  const BP = Array.from({ length: NB }, (_, i) => ({ ang: (i / NB) * TAU + R() * 0.3, spd: 0.6 + R() * 0.8, off: R() * 0.25, up: 0.3 + R() * 0.7, f: 6 + R() * 5 })); scene.add(bats);
  const NR = 240, rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.9, 0.03), new THREE.MeshBasicMaterial({ color: 0xaab8ff, transparent: true, opacity: 0.55, fog: false }), NR), rm = new THREE.Matrix4();
  const RP = Array.from({ length: NR }, () => ({ x: (R() - 0.5) * 64, z: 4 + R() * 18, o: R(), c: 2 + Math.floor(R() * 2) })); scene.add(rain);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), toll = (((p / 4) % 1) + 1) % 1;
      sign.update(m);
      // bell swings (extremes every 4 beats), clapper lags; the bell shudders on the kick
      const th = 0.34 * Math.sin(TAU * p / 8) + 0.02 * k.kick * Math.sin(a * 40); pivot.rotation.z = th; clapper.rotation.z = -0.7 * Math.sin(TAU * p / 8 - 0.7) - 0.15 * th;
      bronze.emissive.setHex(0xff7a20); bronze.emissiveIntensity = 0.05 + 0.5 * k.kick; rope.rotation.z = 0.05 * Math.sin(a * 2); tassel.position.x = 2.2 + 0.1 * Math.sin(a * 2);
      // toll rings: three staggered shockwaves every 4 beats
      rings.forEach(({ r, m: mat, i }) => { const q = (((p / 4 + i / 3) % 1) + 1) % 1; r.scale.setScalar(2 + q * 46); mat.opacity = Math.pow(1 - q, 2.2) * (0.12 + 0.6 * k.kick) * (q < 0.02 ? 0 : 1); mat.color.copy(hue(0.08 + 0.1 * (1 - q), 0.6)); });
      // bats burst out after each toll
      for (let i = 0; i < NB; i++) { const b = BP[i], q = Math.min(1, ((toll + b.off) % 1) * 1.6), r = q * 36 * b.spd; bp.set(Math.cos(b.ang) * r, 5 + Math.sin(b.ang) * r * 0.8 * b.up + Math.sin(q * 9 + i) * 0.8, 6 + q * 14); be.set(0, 0, Math.sin(b.ang) * 0.3); bq.setFromEuler(be); const fl = 0.35 + 0.65 * Math.abs(Math.sin(a * b.f + i)); bs.set(1 + q * 0.6, fl, 1); bm.compose(bp, bq, bs); bats.setMatrixAt(i, bm); }
      bats.instanceMatrix.needsUpdate = true;
      // rain + lightning
      for (let i = 0; i < NR; i++) { const o = RP[i], q = (((t * o.c * 4 + o.o) % 1) + 1) % 1; bp.set(o.x, 22 - q * 30, o.z); bq.setFromEuler(be.set(0, 0, 0.15)); bs.set(1, 1, 1); rm.compose(bp, bq, bs); rain.setMatrixAt(i, rm); }
      rain.instanceMatrix.needsUpdate = true;
      const flash = Math.pow(Math.max(0, k.snare - 0.4) / 0.6, 2); amb.intensity = 0.75 + 2.4 * flash; scene.background.setRGB(0.02 + 0.5 * flash, 0.02 + 0.5 * flash, 0.05 + 0.6 * flash);
      clouds.forEach(({ h, i }) => { h.position.x = (i - 2) * 26 + 6 * Math.sin(a + i); h.material.opacity = 0.35 + 0.2 * Math.sin(a * 2 + i) + 0.3 * flash; });
      // rose window + slits flare on the toll
      rose.rotation.z = a * 0.5; rose.material.color.setScalar(0.65 + 0.6 * k.kick + 0.4 * (1 - toll) * (1 - toll)); roseGlow.material.opacity = 0.12 + 0.3 * k.kick + 0.2 * flash; roseGlow.material.color.copy(hue(hu, 0.6));
      slits.forEach((s, i) => s.material.color.setHex(pcol(i)).multiplyScalar(0.5 + 0.8 * (i % 2 ? k.snare : k.kick)));
      flames.forEach(({ fl, fl2, gl, s }, i) => { const f = 0.8 + 0.35 * Math.sin(a * 13 + i * 2) + 0.2 * Math.sin(a * 31 + i); fl.scale.set(1 + 0.2 * f, f, 1 + 0.2 * f); fl2.scale.set(1, 0.9 * f, 1); gl.material.opacity = 0.35 + 0.3 * f + 0.2 * k.kick; torchL[i].intensity = 45 + 30 * f + 40 * k.kick; });
      camera.position.set(1.8 * Math.sin(TAU * t), 3.0 + 0.5 * Math.sin(TAU * t * 2) + 0.15 * k.kick, 45 - 0.6 * k.kick); camera.lookAt(0, 9.0, 0);
    },
  };
}
