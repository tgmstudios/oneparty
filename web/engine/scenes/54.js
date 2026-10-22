import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, bgClock } from '../lib2.js';
import { createKit, stage } from '../dancers.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Midnight Ferris Wheel: a haunted carnival at midnight. A giant wheel of chasing bulbs turns one gondola per bar, a ghost in every cabin,
// with a DAWGHOUSE marquee across the hub, striped tents, string lights, glowing pumpkins, bats across a huge moon.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x070314); scene.fog = new THREE.FogExp2(0x120626, 0.014);
  st.bloom.strength = 0.8; st.bloom.radius = 0.7; st.bloom.threshold = 0.72;
  const R = rng(54), hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  scene.add(new THREE.AmbientLight(0x6a4a9a, 0.6));
  const warm = new THREE.PointLight(0xff8a30, 160, 0, 1.4); warm.position.set(0, 6, -4); const cool = new THREE.PointLight(0x8a50ff, 120, 0, 1.4); cool.position.set(-12, 10, 6); scene.add(warm, cool);
  scene.add(skyGradient([[0, '#05020e'], [0.5, '#1a0a3a'], [0.85, '#4a1a5a'], [1, '#8a3a5a']], -90, 360, 180));

  // moon + stars
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: 0xffe9b0, toneMapped: false, fog: false })); moon.position.set(-26, 24, -80); scene.add(moon);
  scene.add(haze(0xffd890, 60, 0.3, [-26, 24, -81]));
  const sp = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { sp[i * 3] = (R() - 0.5) * 220; sp[i * 3 + 1] = 6 + R() * 60; sp[i * 3 + 2] = -85; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));

  // ground, tents, poles + string lights, pumpkins
  const GY = -3;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ color: 0x1a1230, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, GY, -30); scene.add(ground);
  const stripe = document.createElement('canvas'); stripe.width = 128; stripe.height = 8; const sc = stripe.getContext('2d'); for (let i = 0; i < 8; i++) { sc.fillStyle = i % 2 ? '#f4e8d0' : '#b0203a'; sc.fillRect(i * 16, 0, 16, 8); }
  const sTex = new THREE.CanvasTexture(stripe); sTex.wrapS = THREE.RepeatWrapping; sTex.colorSpace = THREE.SRGBColorSpace;
  const tents = [[-26, -10, 1.0], [27, -11, 1.1], [-38, -22, 1.5], [40, -24, 1.6]].map(([x, z, s]) => { const g = new THREE.Group(); const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 3.6, 12, 1, true), new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.8, emissive: 0x401020, emissiveIntensity: 0.5, side: THREE.DoubleSide })); roof.position.y = 3.6; const wall = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 3, 12, 1, true), new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.8, emissive: 0x401020, emissiveIntensity: 0.5, side: THREE.DoubleSide })); wall.position.y = 1.5; const glow = haze(0xffb060, 8, 0.4, [0, 1.8, 3.2]); g.add(roof, wall, glow); g.position.set(x, GY, z); g.scale.setScalar(s); scene.add(g); return { g, glow }; });
  const poles = [-24, 24].map(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 9, 6), new THREE.MeshStandardMaterial({ color: 0x2a2030 })); p.position.set(x, GY + 4.5, 4); scene.add(p); return p; });
  const strand = []; for (let i = 0; i < 22; i++) { const u = i / 21, x = -24 + u * 48, y = GY + 8.4 - 2.4 * (1 - Math.pow(2 * u - 1, 2)); const c = hue(i * 0.07, 0.6); const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); b.position.set(x, y, 4); scene.add(b); const g = haze(c, 2.4, 0.3, [x, y, 4]); scene.add(g); strand.push({ b, g, i }); }
  const pumps = [-9, -5, 5, 9, 13, -13].map((x, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 3) * 0.15, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff5a00, emissiveIntensity: 0.6, roughness: 0.6 })); p.scale.y = 0.8; p.position.set(x, GY + 0.7, 8 - (i % 2) * 2); scene.add(p); const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 3), new THREE.MeshBasicMaterial({ color: 0xffe070, toneMapped: false })); f.rotation.x = Math.PI; f.position.set(-0.22, 0.1, 0.8); p.add(f); const f2 = f.clone(); f2.position.x = 0.22; p.add(f2); return p; });

  // the wheel
  const HUBY = 8.2, RAD = 11, wheel = new THREE.Group(); wheel.position.set(0, HUBY, -14); scene.add(wheel);
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd0e0, metalness: 0.9, roughness: 0.3 });
  for (const z of [-1.3, 1.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(RAD, 0.22, 8, 96), steel); r.position.z = z; wheel.add(r); const r2 = new THREE.Mesh(new THREE.TorusGeometry(RAD * 0.55, 0.12, 6, 64), steel); r2.position.z = z; wheel.add(r2); }
  for (let i = 0; i < 24; i++) for (const z of [-1.3, 1.3]) { const a = (i / 24) * TAU, s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, RAD, 5), steel); s.position.set(Math.cos(a) * RAD / 2, Math.sin(a) * RAD / 2, z); s.rotation.z = a - Math.PI / 2; wheel.add(s); }
  const NBU = 72, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), NBU * 2), bm = new THREE.Matrix4(), bc = new THREE.Color();
  for (let i = 0; i < NBU; i++) for (let z = 0; z < 2; z++) { const a = (i / NBU) * TAU; bm.setPosition(Math.cos(a) * (RAD + 0.4), Math.sin(a) * (RAD + 0.4), z ? 1.3 : -1.3); bulbs.setMatrixAt(i * 2 + z, bm); bulbs.setColorAt(i * 2 + z, bc.set(0xffffff)); }
  wheel.add(bulbs);
  const legs = [-1, 1].map(s => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, HUBY - GY + 1.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2438, metalness: 0.5, roughness: 0.5 })); l.position.set(s * 5.2, (HUBY + GY) / 2, -14); l.rotation.z = s * 0.52; scene.add(l); return l; });

  // gondolas with ghost riders (cabins stay upright as the wheel turns)
  const DK = createKit(scene, { floorY: 0 }), NG = 12, gond = [];
  const cabCols = [0xff7a18, 0x8a50ff, 0x30d0a0, 0xff3fa0];
  for (let i = 0; i < NG; i++) {
    const g = new THREE.Group(), col = cabCols[i % 4], mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4, roughness: 0.5 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 0.2, 14), mat); floor.position.y = -1.95; g.add(floor);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.9, 14, 1, true), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); wall.position.y = -1.5; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 14), mat); roof.position.y = 0.55; g.add(roof);
    for (const x of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 4), steel); p.position.set(x, -0.9, 0); g.add(p); }
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 4), steel); hang.position.y = 1.3; g.add(hang);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false })); bulb.position.y = 1.0; g.add(bulb);
    const gh = DK.ghost({ tint: [0xffffff, 0xcfe8ff, 0xffd8f0, 0xe0ffe8][i % 4], hat: i % 3 === 0 }); DK.place(gh, 0, 0, 0.5, i * 0.31); g.add(gh.root); gh.root.position.set(0, -1.85, 0); g.scale.setScalar(1.35);
    scene.add(g); gond.push({ g, i, light: bulb });
  }
  const bats = stage.bats(scene, 5);
  const sign = dawgSign(scene, C, { width: 13.5, pos: [0, HUBY, -11.6], size: 2.2, depth: 0.9, emis: 0xff8a20, color: 0xffe8c0, hop: 0.45, glow: false });
  const board = new THREE.Mesh(new THREE.BoxGeometry(15.4, 3.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x14081e, roughness: 0.5, metalness: 0.4 })); board.position.set(0, HUBY, -12.1); scene.add(board);
  const edgeBulbs = []; for (let i = 0; i < 26; i++) for (const y of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd060, toneMapped: false })); b.position.set(-7.3 + (i / 25) * 14.6, HUBY + y * 1.65, -11.8); scene.add(b); edgeBulbs.push(b.material); }
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, hu = m.hue ?? 0.25 * Math.floor(t * 4), p = u * 16, ctx = DK.tick(t);
      // one gondola-slot every 4 beats: 12-fold symmetric, so it loops
      const rot = -(TAU / NG) * (u * 4) + 0.015 * k.kick;
      wheel.rotation.z = rot;
      for (let i = 0; i < NBU; i++) { const on = 0.5 + 0.5 * Math.sin(TAU * (i / NBU) * 6 - p * 2.2), ph = Math.floor(i / 4) % 3; for (let z = 0; z < 2; z++) bulbs.setColorAt(i * 2 + z, bc.copy(hue(hu + ph * 0.28 + (z ? 0.5 : 0), 0.55)).multiplyScalar(0.25 + 1.0 * on + 0.5 * k.kick)); }
      bulbs.instanceColor.needsUpdate = true;
      gond.forEach(({ g, i, light }) => { const ang = (i / NG) * TAU + rot; g.position.set(Math.cos(ang) * RAD, HUBY + Math.sin(ang) * RAD - 0.4, -14); g.rotation.z = 0.07 * Math.sin(a * 4 + i) + 0.07 * k.snare * Math.sin(a * 12 + i); light.material.color.setScalar(0.7 + 0.5 * k.hat); });
      sign.update(m); edgeBulbs.forEach((mm, i) => mm.color.setHex(Math.floor(p * 2 + i * 0.5) % 2 ? 0xffd060 : 0xff3fa0));
      strand.forEach(({ b, g, i }) => { const on = 0.5 + 0.5 * Math.sin(a * 4 - i * 0.6); g.material.opacity = 0.18 + 0.4 * on + 0.3 * k.hat; b.scale.setScalar(0.8 + 0.5 * on); });
      tents.forEach(({ glow }, i) => glow.material.opacity = 0.25 + 0.3 * (i % 2 ? k.kick : k.snare)); pumps.forEach((pp, i) => { pp.material.emissiveIntensity = 0.4 + 1.0 * (i % 2 ? k.kick : k.snare); pp.scale.set(1 + 0.08 * k.kick, 0.8 - 0.08 * k.kick, 1 + 0.08 * k.kick); });
      bats(ctx); warm.intensity = 120 + 90 * k.kick; cool.intensity = 90 + 80 * k.snare; moon.scale.setScalar(1 + 0.01 * k.bass);
      camera.position.set(2.4 * Math.sin(TAU * t), 2.6 + 0.5 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 27); camera.lookAt(0, 5.6, -14);
    },
  };
}
