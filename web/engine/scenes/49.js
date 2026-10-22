import { THREE, TAU, rng, extrudeText } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { createKit } from '../dancers.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { dawgSign, beams, K, band } from '../pop-kit.js';

// Happy Valley Fireworks: post-win celebration. Fireworks burst over the stadium bowl on the beat, searchlights sweep, a DAWGHOUSE blimp floats overhead,
// and a ghost cheer squad shakes pom-poms on the field in school colours.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x01040c); scene.fog = new THREE.FogExp2(0x030818, 0.006);
  st.bloom.strength = 0.8; st.bloom.radius = 0.7; st.bloom.threshold = 0.7;
  scene.add(new THREE.AmbientLight(0x6a80b0, 0.45));
  const FIELD = -3, R = rng(49);
  const NAVY = new THREE.Color(0x082a66), BLUE = new THREE.Color(0x96bee6), GOLD = new THREE.Color(0xffd060), WH = new THREE.Color(0xffffff);

  // sky + stars
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, fog: false, map: (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#01030a'); gr.addColorStop(0.55, '#06122e'); gr.addColorStop(0.8, '#123a7a'); gr.addColorStop(1, '#2a5ea8'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() })); scene.add(sky);
  const sp = new Float32Array(300 * 3); for (let i = 0; i < 300; i++) { const a = R() * TAU, e = 0.15 + R() * 1.1, r = 200; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r * 0.9 + 10; sp[i * 3 + 2] = -Math.abs(Math.sin(a)) * Math.cos(e) * r - 20; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })); scene.add(stars);

  // stadium bowl: a curved wall of fans with tier lines, pennants and tiny phone lights
  const cvs = document.createElement('canvas'); cvs.width = 2048; cvs.height = 256; const g = cvs.getContext('2d');
  g.fillStyle = '#071226'; g.fillRect(0, 0, 2048, 256);
  for (let row = 0; row < 14; row++) { const y = 14 + row * 17; g.fillStyle = row % 4 === 0 ? '#0e2a5a' : '#0a1a38'; g.fillRect(0, y + 8, 2048, 3); for (let x = 0; x < 2048; x += 9 + (R() * 3 | 0)) { const w = R(); g.fillStyle = w < 0.7 ? `rgba(255,255,255,${0.35 + R() * 0.5})` : w < 0.85 ? '#96bee6' : w < 0.93 ? '#2a5ea8' : '#ffe9a0'; g.beginPath(); g.arc(x + R() * 3, y + R() * 5, 2.6 + R() * 1.4, 0, TAU); g.fill(); } }
  const bowlTex = new THREE.CanvasTexture(cvs); bowlTex.colorSpace = THREE.SRGBColorSpace;
  const bowlMat = new THREE.MeshBasicMaterial({ map: bowlTex, side: THREE.BackSide, toneMapped: false });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(78, 66, 13, 64, 1, true, Math.PI - 1.15, 2.3), bowlMat); bowl.position.set(0, 3.5, 14); scene.add(bowl);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(78.5, 78.5, 1.2, 64, 1, true, Math.PI - 1.15, 2.3), new THREE.MeshBasicMaterial({ color: 0x96bee6, side: THREE.BackSide, toneMapped: false })); rim.position.set(0, 10.4, 14); scene.add(rim);

  // field
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.MeshStandardMaterial({ color: 0x0c3626, roughness: 0.95 })); turf.rotation.x = -Math.PI / 2; turf.position.set(0, FIELD, -20); scene.add(turf);
  const lineM = new THREE.MeshBasicMaterial({ color: 0xdfe8f5, toneMapped: false });
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.25), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, FIELD + 0.01, 8 - i * 6); scene.add(l); }
  const paint = extrudeText(C.fonts.block, 'WE ARE', { size: 2, track: 0.3, depth: 0.1, bevel: 0.01, material: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), targetWidth: 26 });
  paint.group.rotation.x = -Math.PI / 2; paint.group.position.set(0, FIELD + 0.08, -16); scene.add(paint.group);

  // light towers on the rim
  const towers = [-48, -22, 22, 48].map(x => { const gl = haze(0xcfe0ff, 14, 0.5, [x, 18, -50]); scene.add(gl); const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); bar.position.set(x, 18, -50); scene.add(bar); return { gl, bar }; });
  // searchlights fanning into the sky
  const rig = beams(scene, [-48, -22, 22, 48].flatMap((x, i) => [0, 1].map(j => ({ color: j ? 0x96bee6 : 0xffffff, x, y: 14, z: -52, len: 90, r: 0.8, sway: [0.28, 0.18], f: [1 + j, 1 + (i % 2)], ph: i * 1.3 + j * 2, bx: Math.PI, bz: -Math.sign(x) * 0.22, kind: j ? 'snare' : 'kick' }))));

  // DAWGHOUSE blimp
  const blimp = new THREE.Group(); blimp.position.set(0, 16.5, -32); scene.add(blimp);
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshStandardMaterial({ color: 0x0b2a66, metalness: 0.4, roughness: 0.4, emissive: 0x061a44, emissiveIntensity: 0.6 })); hull.scale.set(15, 4.6, 4.6); blimp.add(hull);
    for (const [x, a] of [[-12.5, 0], [-12.5, Math.PI / 2], [-12.5, Math.PI], [-12.5, -Math.PI / 2]]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 3.2), new THREE.MeshStandardMaterial({ color: 0x082a66 })); fin.position.set(x, Math.sin(a) * 2.8, Math.cos(a) * 2.8); fin.rotation.x = a; blimp.add(fin); }
  const gond = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.4), new THREE.MeshStandardMaterial({ color: 0xdfe8f5 })); gond.position.set(1, -4.9, 0); blimp.add(gond);
  const blimpSign = dawgSign(blimp, C, { width: 15, pos: [0, 0.2, 4.55], size: 2, depth: 0.5, emis: 0x2a5ac0, color: 0xdfe8ff, hop: 0.25, glow: false });
  const nav = [[-15, 0xff3030], [15, 0x30ff60]].map(([x, c]) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); l.position.set(x * 0.92, 0, 0); blimp.add(l); return l; });
  const bl = new THREE.PointLight(0xbcd8ff, 90, 0, 1.4); bl.position.set(0, 3, 8); blimp.add(bl);

  // fireworks: 4 launchers, each bursts twice per loop (positions repeat with the loop), expanding sparks with gravity
  const NF = 4, NP = 64, fw = [];
  const dirs = Array.from({ length: NP }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / NP, r = Math.sqrt(1 - y * y), a = i * 2.399963; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); });
  const spots = [[[-26, 28, -60], [22, 24, -58]], [[18, 34, -64], [-18, 27, -62]], [[-4, 38, -70], [6, 30, -66]], [[34, 21, -56], [-34, 20, -54]]];
  const cols = [[WH, BLUE], [BLUE, GOLD], [WH, GOLD], [GOLD, BLUE]];
  for (let f = 0; f < NF; f++) {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, transparent: true }), NP); mesh.frustumCulled = false; scene.add(mesh);
    const flash = haze(0xffffff, 1, 0, [0, 0, 0]); scene.add(flash); fw.push({ mesh, flash, sp: Array.from({ length: NP }, () => 0.6 + R() * 0.5) });
    for (let i = 0; i < NP; i++) mesh.setColorAt(i, WH);
  }
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), fs = new THREE.Vector3(), fc = new THREE.Color();

  // ghost cheer squad with pom-poms
  const DK = createKit(scene, { floorY: FIELD });
  const pom = c => { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.8 })); return p; };
  [[0xc8d8f4, -5.2, 7.5, true], [0x96bee6, -1.8, 8.2, false], [0xc8d8f4, 1.8, 7.4, true], [0x6a92d0, 5.2, 8.0, false], [0xb8cce8, -8.6, 2.5, true], [0xc8d8f4, -4.2, 2.0, false], [0x96bee6, 0, 2.6, true], [0xc8d8f4, 4.2, 2.0, true], [0x6a92d0, 8.6, 2.5, false]].forEach(([tint, x, z, hat], i) => {
    const gh = DK.ghost({ tint, hat }); DK.place(gh, x, z, z > 5 ? 0.95 : 0.85, i * 0.31); gh.root.position.y = FIELD + (z > 5 ? 2.6 : 2.0);
    for (const [e, s] of [[gh.eR, 1], [gh.eL, -1]]) { const p = pom(i % 2 ? 0x96bee6 : 0xffffff); p.position.set(0, -0.5, 0); e.add(p); }
  });
  const fl = new THREE.PointLight(0xdfe8ff, 60, 0, 1.4); fl.position.set(0, 7, 13); scene.add(fl);
  // flying Penn State logos (web/assets/logo-slot/logo.svg, same extrusion as scene 02), looping Lissajous paths through the sky, spinning, popping on the kick
  const flyers = [];
  try {
    const data = await new SVGLoader().loadAsync('/assets/logo-slot/logo.svg'), lg = new THREE.Group(), L = 1.2;
    data.paths.forEach((p, i) => { const m = new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.28, metalness: 0.2, roughness: 0.45 }); SVGLoader.createShapes(p).forEach(sh => { const e = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 1 }), m); e.position.z = i * L * 0.6; lg.add(e); }); });
    const bb = new THREE.Box3().setFromObject(lg), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    lg.scale.set(1, -1, 1); lg.position.set(-c.x, c.y, -c.z); const one = new THREE.Group(); one.add(lg); const k0 = 3.6 / Math.max(sz.x, sz.y); one.scale.setScalar(k0);
    const back = one.clone(); one.position.z = sz.z * k0 / 2; back.position.z = -sz.z * k0 / 2; back.rotation.y = Math.PI;
    const proto = new THREE.Group(); proto.add(one, back);
    for (let i = 0; i < 7; i++) { const w = proto.clone(true); scene.add(w); flyers.push({ w, i, f1: 1 + (i % 2), f2: 1 + (i % 3), p1: i / 7, p2: (i * 0.37) % 1, ax: 11 + (i % 3) * 2, ay: 1.6 + (i % 2) * 0.8, y0: 6.6 + (i % 3) * 1.0, z0: -6 - (i % 4) * 2.4, spin: i % 2 ? 1 : -1 }); }
  } catch (e) { /* no logo asset: scene still works without the flyers */ }
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t);
      rig.update(a, m); DK.tick(t); blimpSign.update(m);
      for (let f = 0; f < NF; f++) {
        const x = t * 2 + f / NF, cyc = Math.floor(x), u = x - cyc, [cx, cy, cz] = spots[f][((cyc % 2) + 2) % 2], [c1, c2] = cols[(f + cyc) % 4], { mesh, flash, sp: spd } = fw[f];
        const burst = 1 - Math.exp(-5 * u), size = 20 + 14 * k.bass, fade = Math.max(0, 1 - Math.pow(u, 1.6));
        for (let i = 0; i < NP; i++) {
          const d = dirs[i], v = size * spd[i];
          fp.set(cx + d.x * v * burst, cy + d.y * v * burst - 14 * u * u * (0.6 + spd[i]), cz + d.z * v * burst * 0.5); fs.setScalar(0.2 + 1.8 * fade * (0.7 + 0.4 * band(k.hit, i / NP)) * (u < 0.02 ? 0 : 1));
          fm.compose(fp, fq, fs); mesh.setMatrixAt(i, fm); mesh.setColorAt(i, fc.copy(i % 2 ? c1 : c2).lerp(WH, Math.max(0, 0.6 - u * 2)));
        }
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.material.opacity = Math.min(1, fade * 1.6);
        flash.position.set(cx, cy, cz); flash.scale.setScalar(12 * (0.5 + 1.8 * Math.exp(-u * 9))); flash.material.opacity = 0.45 * Math.exp(-u * 8); flash.material.color.copy(c1);
      }
      towers.forEach(({ gl, bar }, i) => { gl.material.opacity = 0.35 + 0.35 * (i % 2 ? k.snare : k.kick); bar.material.color.setScalar(0.75 + 0.25 * (i % 2 ? k.kick : k.snare)); });
      bowlMat.color.setScalar(0.75 + 0.35 * k.kick + 0.15 * band(k.env, 0.5)); stars.material.opacity = 0.5 + 0.4 * k.hat;
      blimp.position.y = 16.5 + 0.7 * Math.sin(TAU * t * 2) + 0.4 * k.kick; blimp.position.x = 5 * Math.sin(TAU * t); blimp.rotation.z = 0.025 * Math.sin(TAU * t * 2); blimp.rotation.y = 0.06 * Math.cos(TAU * t);
      nav.forEach((l, i) => l.material.color.setScalar(0.25 + (Math.sin(TAU * t * 16 + i * 3) > 0.6 ? 1 : 0)));
      flyers.forEach(({ w, i, f1, f2, p1, p2, ax, ay, y0, z0, spin }) => {
        const a1 = TAU * (t * f1 + p1), a2 = TAU * (t * f2 + p2), pop = 1 + 0.16 * (i % 2 ? k.kick : k.snare);
        w.position.set(ax * Math.sin(a1), y0 + ay * Math.sin(a2), z0 + 3.5 * Math.cos(a1)); w.rotation.set(0.12 * Math.sin(a2), spin * TAU * (t * 2 + p1) + 0.4 * Math.sin(a1), 0.1 * Math.cos(a1)); w.scale.setScalar(pop);
      });
      fl.intensity = 14 + 18 * k.kick;
      camera.position.set(1.0 * Math.sin(TAU * t), 3.0 + 0.15 * Math.sin(TAU * t * 2) + 0.06 * k.kick, 17); camera.lookAt(0, 7.8, -30);
    },
  };
}
