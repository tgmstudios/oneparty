import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, particles, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// The Dollhouse: a giant open-front dollhouse in the moonlit garden. Four wallpapered rooms and an attic, every one alive: porcelain dolls dance
// on the beat, a piano's keys light up with the spectrum, a rocking horse rocks, a jack-in-the-box pops on the kick, windows chase in sequence,
// smoke curls from the chimney, and DAWGHOUSE is carved on a sign standing on the ridge of the roof.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x070a1c); scene.fog = new THREE.FogExp2(0x0a1030, 0.011);
  st.bloom.strength = 0.45; st.bloom.radius = 0.6; st.bloom.threshold = 0.85;
  scene.add(new THREE.AmbientLight(0x6a78b8, 0.4));
  const moonL = new THREE.DirectionalLight(0x9ab4ff, 0.9); moonL.position.set(-14, 20, 14); scene.add(moonL);
  const R = rng(38), BASE = -6, FH = 5, D = 6, HW = 10.5;
  const hue = (h, l = 0.6) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 0.85, l);
  scene.add(skyGradient([[0, '#05071a'], [0.55, '#10204a'], [0.85, '#2a3a7a'], [1, '#3a4a8a']], -70, 300, 160));

  // ---- sky + garden
  const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false, fog: false })); moon.position.set(-24, 12, -60); scene.add(moon); scene.add(haze(0xbcd0ff, 55, 0.25, [-24, 12, -61]));
  const sp = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { sp[i * 3] = (R() - 0.5) * 200; sp[i * 3 + 1] = 4 + R() * 50; sp[i * 3 + 2] = -65; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })); scene.add(stars);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.MeshStandardMaterial({ color: 0x15283a, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, BASE, -20); scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(5, 30), new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.9 })); path.rotation.x = -Math.PI / 2; path.position.set(0, BASE + 0.02, 14); scene.add(path);
  // picket fence
  const pk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0xe8e4f4, roughness: 0.7 }), 36), pm = new THREE.Matrix4();
  for (let i = 0; i < 36; i++) { const x = -22 + i * 1.25; if (Math.abs(x) < 2.8) { pm.makeScale(0.0001, 0.0001, 0.0001); } else pm.makeTranslation(x, BASE + 0.9, 7); pk.setMatrixAt(i, pm); } scene.add(pk);
  // bare tree + pumpkins
  const tree = new THREE.Group(); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 9, 7), new THREE.MeshStandardMaterial({ color: 0x120a18 })); trunk.position.y = 4.5; tree.add(trunk);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 4.5, 5), trunk.material); b.position.set(0.9 * (i % 2 ? 1 : -1), 6 + i * 0.5, 0); b.rotation.z = (i % 2 ? -1 : 1) * (0.7 + i * 0.1); tree.add(b); }
  tree.position.set(-19, BASE, -2); scene.add(tree);
  const pumps = [[-13, 5], [13.5, 5.5], [16, 3], [-16, 4.5]].map(([x, z], i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 9), new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff5a00, emissiveIntensity: 0.5 })); p.scale.y = 0.8; p.position.set(x, BASE + 0.7, z); scene.add(p); return p; });
  const fly = particles({ count: 120, seed: 4, box: [46, 10, 24], center: [0, -2, -2], color: 0xc8ff90, size: 0.18, dir: [0, 1, 0], travel: 5, sway: 2.0, opacity: 0.9, H: C.H, cycles: [1, 2] }); scene.add(fly);

  // ---- house shell
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a3a58, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf4eaf4, roughness: 0.6 });
  const paper = (type, a, b) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b;
    if (type === 0) for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128);
    else if (type === 1) for (let y = 16; y < 128; y += 32) for (let x = 16; x < 128; x += 32) { g.beginPath(); g.arc(x + ((y / 32) % 2) * 16, y, 7, 0, TAU); g.fill(); }
    else if (type === 2) for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { g.beginPath(); g.moveTo(x + 16, y + 2); g.lineTo(x + 30, y + 16); g.lineTo(x + 16, y + 30); g.lineTo(x + 2, y + 16); g.fill(); }
    else for (let y = 0; y < 128; y += 42) for (let x = 0; x < 128; x += 42) { g.beginPath(); g.arc(x + 21, y + 21, 12, 0, TAU); g.fill(); g.fillStyle = a; g.beginPath(); g.arc(x + 21, y + 21, 5, 0, TAU); g.fill(); g.fillStyle = b; }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const roomDefs = [{ cx: -5, f: 0, p: paper(0, '#f0b8cc', '#e090b0') }, { cx: 5, f: 0, p: paper(1, '#bfe6dc', '#8fcab8') }, { cx: -5, f: 1, p: paper(2, '#cdbdf0', '#a898e0') }, { cx: 5, f: 1, p: paper(3, '#f6e2b0', '#e0c070') }];
  const rooms = roomDefs.map(({ cx, f, p }, ri) => {
    const y0 = BASE + f * FH, g = new THREE.Group(); scene.add(g);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(10, FH), new THREE.MeshStandardMaterial({ map: p, roughness: 0.9, emissive: 0x201420, emissiveIntensity: 0.25 })); back.position.set(cx, y0 + FH / 2, -D); g.add(back);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, D), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.6 })); floor.position.set(cx, y0 + 0.0, -D / 2); g.add(floor);
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 0.15), trim); base.position.set(cx, y0 + 0.4, -D + 0.1); g.add(base);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false })); bulb.position.set(cx, y0 + FH - 0.9, -D / 2); g.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0x222222 })); cord.position.set(cx, y0 + FH - 0.45, -D / 2); g.add(cord);
    const glow = haze(0xffd890, 4.6, 0.2, [cx, y0 + FH - 1.2, -D / 2 + 0.5]); g.add(glow);
    const light = new THREE.PointLight(0xffc880, 12, 0, 1.4); light.position.set(cx, y0 + FH - 1.2, -2); g.add(light);
    return { g, cx, y0, bulb, glow, light, ri };
  });
  // dividing walls, floors/ceilings, side walls
  const wall = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); scene.add(m); return m; };
  for (const x of [-HW, 0, HW]) wall(x, BASE + FH, -D / 2, 0.45, FH * 2 + 0.3, D + 0.3);
  for (let f = 0; f <= 2; f++) wall(0, BASE + f * FH, -D / 2, HW * 2 + 0.6, 0.45, D + 0.3);
  const porch = wall(0, BASE - 0.4, 0.8, HW * 2 + 2, 0.6, 3.4);
  for (const x of [-HW - 0.4, HW + 0.4]) wall(x, BASE + 0.3, 0.8, 0.5, 1.4, 3.4);
  // roof + attic
  const AY = BASE + FH * 2;
  const atticBack = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, FH + 0.4), new THREE.MeshStandardMaterial({ map: paper(1, '#2a1a4a', '#4a3a7a'), roughness: 0.9, emissive: 0x201040, emissiveIntensity: 0.5 })); atticBack.position.set(0, AY + FH / 2 + 0.2, -D); scene.add(atticBack);
  const shingle = new THREE.MeshStandardMaterial({ color: 0x4a2a6a, roughness: 0.7 });
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(HW * 1.28, 0.45, D + 1.5), shingle); r.position.set(s * (HW / 2 + 0.25), AY + FH * 0.62, -D / 2 + 0.1); r.rotation.z = -s * 0.58; scene.add(r); }
  const slate = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0x5a3a8a, roughness: 0.6 }), 40);
  for (let i = 0; i < 40; i++) { const s = i < 20 ? -1 : 1, k = i % 20, row = Math.floor(k / 10), col = k % 10; const x = s * (1.2 + col * 0.9 + (row % 2) * 0.45); const y = AY + FH * 1.18 - (x * s) * 0.62 + 0.05 - row * 0.0; pm.compose(new THREE.Vector3(x, AY + FH * 1.1 - Math.abs(x) * 0.6 + 0.35, 0.25 - row * 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -s * 0.55)), new THREE.Vector3(1, 1, 1)); slate.setMatrixAt(i, pm); } scene.add(slate);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 1.6), new THREE.MeshStandardMaterial({ color: 0x8a3a4a, roughness: 0.9 })); chim.position.set(6.2, AY + FH + 0.8, -3); scene.add(chim);
  const smoke = Array.from({ length: 6 }, (_, i) => { const s = haze(0xcfd8ff, 2.4, 0.3, [6.2, AY + FH + 3, -3]); scene.add(s); return { s, i }; });
  // roof ridge sign (posts + carved DAWGHOUSE plaque)
  const RY = AY + FH * 1.02 + 2.2;
  for (const x of [-4.6, 4.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.4, 6), wood); p.position.set(x, RY - 0.6, -0.8); scene.add(p); }
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(11.4, 2.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.7 })); plaque.position.set(0, RY + 0.9, -0.8); scene.add(plaque);
  const sign = dawgSign(scene, C, { width: 10.2, pos: [0, RY + 0.9, -0.5], size: 2, depth: 0.5, emis: 0xffa040, color: 0xffe0a0, hop: 0.25, glow: false });

  // ---- dolls
  const dollMats = { skin: new THREE.MeshStandardMaterial({ color: 0xf6dccb, roughness: 0.35 }), shoe: new THREE.MeshStandardMaterial({ color: 0x15101a, roughness: 0.5 }), black: new THREE.MeshBasicMaterial({ color: 0x120a12 }), cheek: new THREE.MeshBasicMaterial({ color: 0xff7a9a }), lip: new THREE.MeshBasicMaterial({ color: 0xc02040 }) };
  const makeDoll = (dress, hair, bow) => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const dm = new THREE.MeshStandardMaterial({ color: dress, roughness: 0.55, emissive: dress, emissiveIntensity: 0.15 }), hm = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.6 });
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.7, 18, 1, true), dm); skirt.position.y = 1.25; skirt.material.side = THREE.DoubleSide; body.add(skirt);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), dm); torso.position.y = 2.15; torso.scale.y = 0.95; body.add(torso);
    const head = new THREE.Group(); head.position.y = 3.0; body.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 16), dollMats.skin));
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12, 0, TAU, 0, Math.PI * 0.55), hm); hairTop.position.y = 0.06; head.add(hairTop);
    for (const s of [-1, 1]) { const braid = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hm); braid.position.set(s * 0.68, -0.25, 0); braid.scale.y = 1.8; head.add(braid); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), dollMats.black); eye.position.set(s * 0.25, 0.04, 0.58); head.add(eye); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.25 + 0.04, 0.09, 0.69); head.add(hl); const ch = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), dollMats.cheek); ch.position.set(s * 0.4, -0.2, 0.55); ch.lookAt(s * 0.4 * 2, -0.2, 2); head.add(ch); }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), dollMats.lip); mouth.position.set(0, -0.28, 0.62); mouth.scale.set(1.4, 0.8, 0.6); head.add(mouth);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 5), new THREE.MeshStandardMaterial({ color: bow, emissive: bow, emissiveIntensity: 0.3 })); b.position.set(s * 0.36, 0.55, 0.15); b.rotation.z = -s * 1.2; head.add(b); }
    const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * 0.62, 2.3, 0); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 1.0, 8), dollMats.skin); rod.position.y = -0.5; a.add(rod); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), dollMats.skin); hand.position.y = -1.05; a.add(hand); body.add(a); return a; });
    const legs = [-1, 1].map(s => { const l = new THREE.Group(); l.position.set(s * 0.3, 0.7, 0); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.8, 8), dollMats.skin); rod.position.y = -0.4; l.add(rod); const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.5), dollMats.shoe); shoe.position.set(0, -0.85, 0.1); l.add(shoe); body.add(l); return l; });
    return { g, body, head, arms, legs, mouth };
  };
  const dolls = [[0, 0xff4a8a, 0x3a1a10, 0xffd040], [1, 0x40c0b0, 0xc07a30, 0xff4a8a], [2, 0x8a60e0, 0x120a18, 0x40d0ff], [3, 0xffb040, 0x8a2a1a, 0x8a60e0]].map(([ri, dress, hair, bow], i) => {
    const d = makeDoll(dress, hair, bow), r = rooms[ri]; d.g.position.set(r.cx + (i % 2 ? 1.4 : -1.4), r.y0 + 0.15, -3.4); d.g.scale.setScalar(1.05); scene.add(d.g); d.i = i; d.x0 = d.g.position.x; return d;
  });

  // ---- furniture
  const box = (w, h, d, col, x, y, z, parent = scene, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })); m.position.set(x, y, z); parent.add(m); return m; };
  const k0 = rooms[0]; box(2.4, 0.2, 1.4, 0, k0.cx - 2.6, k0.y0 + 1.5, -4.4, scene, new THREE.MeshStandardMaterial({ color: 0xe8e0d8 })); for (const [x, z] of [[-3.7, -5], [-1.5, -5], [-3.7, -3.8], [-1.5, -3.8]]) box(0.14, 1.4, 0.14, 0, k0.cx + x + 0.0, k0.y0 + 0.8, z, scene, wood);
  const stove = box(1.8, 2.2, 1.4, 0xcfd0dc, k0.cx + 3.4, k0.y0 + 1.2, -5.0); const burners = [-0.4, 0.4].map(dx => { const b = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 16), new THREE.MeshStandardMaterial({ color: 0xff5a20, emissive: 0xff3a10, emissiveIntensity: 0.6 })); b.rotation.x = Math.PI / 2; b.position.set(k0.cx + 3.4 + dx, k0.y0 + 2.35, -5.0); scene.add(b); return b; });
  const n0 = rooms[1]; const horse = new THREE.Group(); horse.position.set(n0.cx + 2.9, n0.y0 + 0.4, -4.2); scene.add(horse);
  const hbody = box(1.7, 0.7, 0.6, 0, 0, 1.2, 0, horse, new THREE.MeshStandardMaterial({ color: 0xf0e0c0 })); const hneck = box(0.5, 1.2, 0.5, 0, 0.7, 1.9, 0, horse, new THREE.MeshStandardMaterial({ color: 0xf0e0c0 })); hneck.rotation.z = -0.3; const hhead = box(0.9, 0.5, 0.45, 0, 1.0, 2.5, 0, horse, new THREE.MeshStandardMaterial({ color: 0xf0e0c0 })); const rockerM = new THREE.MeshStandardMaterial({ color: 0xc03a5a }); const rocker = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 24, Math.PI), rockerM); rocker.rotation.z = Math.PI; rocker.position.y = 1.1; horse.add(rocker);
  const crib = box(2.6, 0.2, 1.6, 0, n0.cx - 3.0, n0.y0 + 1.0, -4.8); for (let i = 0; i < 9; i++) box(0.08, 1.2, 0.08, 0, n0.cx - 4.2 + i * 0.3, n0.y0 + 1.7, -4.0, scene, trim);
  const b0 = rooms[2]; box(3.6, 0.5, 2.2, 0, b0.cx - 2.8, b0.y0 + 0.9, -4.7, scene, new THREE.MeshStandardMaterial({ color: 0xf4eaf4 })); box(3.7, 0.3, 2.3, 0, b0.cx - 2.7, b0.y0 + 1.3, -4.6, scene, new THREE.MeshStandardMaterial({ color: 0xc86aa0, emissive: 0x402040, emissiveIntensity: 0.3 })); box(0.4, 1.8, 2.3, 0, b0.cx - 4.7, b0.y0 + 1.3, -4.6, scene, trim);
  const dresser = box(1.8, 2.2, 1.2, 0x8a5a3a, b0.cx + 3.6, b0.y0 + 1.2, -5.2);
  const m0 = rooms[3]; const piano = new THREE.Group(); piano.position.set(m0.cx - 0.2, m0.y0, -4.6); scene.add(piano);
  box(5.0, 2.0, 1.6, 0, 0, 1.3, 0, piano, new THREE.MeshStandardMaterial({ color: 0x1a1220, roughness: 0.35, metalness: 0.3 })); box(5.2, 0.15, 1.9, 0, 0, 2.35, 0, piano, new THREE.MeshStandardMaterial({ color: 0x120a18 }));
  const keys = []; for (let i = 0; i < 14; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.9), new THREE.MeshStandardMaterial({ color: 0xf8f4ee, emissive: 0xff3fa0, emissiveIntensity: 0 })); k.position.set(-2.1 + i * 0.32, 1.9, 0.85); piano.add(k); keys.push(k); }
  box(1.3, 0.6, 0.7, 0x8a3a58, m0.cx - 0.2, m0.y0 + 0.6, -3.1);
  const stool = null;
  const toy = new THREE.Group(); toy.position.set(0, AY + 0.3, -3.6); scene.add(toy);
  const chest = box(3.0, 1.4, 1.8, 0x7a3a58, -3.5, 0.7, 0, toy); const chestLid = box(3.1, 0.2, 1.9, 0xc09a4a, -3.5, 1.5, 0, toy);
  const jack = new THREE.Group(); jack.position.set(3.2, 0, 0); toy.add(jack); box(1.7, 1.5, 1.7, 0, 0, 0.75, 0, jack, new THREE.MeshStandardMaterial({ color: 0x40b0e0, emissive: 0x104060, emissiveIntensity: 0.4 }));
  const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 10), new THREE.MeshStandardMaterial({ color: 0xcfd0dc, metalness: 1, roughness: 0.3 })); spring.position.y = 1.5; jack.add(spring);
  const jhead = new THREE.Group(); jack.add(jhead); jhead.add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf4e4d0 }))); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2040 })); nose.position.set(0, -0.05, 0.72); jhead.add(nose); const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xff3fa0, emissive: 0xff3fa0, emissiveIntensity: 0.4 })); hat.position.y = 0.95; jhead.add(hat); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), dollMats.black); e.position.set(s * 0.25, 0.2, 0.62); jhead.add(e); }
  const lid = box(1.8, 0.16, 1.8, 0x2a90c0, 0, 1.55, 0, jack);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), bounce = Math.abs(Math.sin(Math.PI * p));
      sign.update(m); fly.userData.u.uT.value = t; stars.material.opacity = 0.55 + 0.4 * k.hat;
      // rooms: warm light flickers, chased in sequence on the beat
      rooms.forEach(r => { const on = Math.max(0, Math.cos(TAU * (p / 4 - r.ri / 4))) ** 2, v = 0.45 + 0.55 * on + 0.5 * k.kick * (r.ri % 2 ? 0.4 : 1); r.glow.material.opacity = 0.08 + 0.2 * v; r.light.intensity = 6 + 16 * v; r.bulb.material.color.setScalar(0.7 + 0.5 * v); r.glow.material.color.copy(hue(0.08 + 0.12 * on, 0.6)); });
      // dolls: each a different dance
      dolls.forEach(d => {
        const s = d.i % 2 ? -1 : 1, q = p + d.i * 0.5, bb = Math.abs(Math.sin(Math.PI * q)), swing = Math.sin(TAU * q / 2);
        d.g.position.y = rooms[[0, 1, 2, 3][d.i]].y0 + 0.15 + 0.35 * bb * (0.5 + k.kick);
        d.body.scale.set(1 + 0.04 * k.kick, 1 - 0.05 * k.kick * (1 - bb), 1 + 0.04 * k.kick);
        if (d.i === 0) { d.arms[0].rotation.z = -1.0 + 1.6 * Math.max(0, swing) + 0.5 * k.snare; d.arms[1].rotation.z = 1.0 - 1.6 * Math.max(0, -swing) - 0.5 * k.snare; d.body.rotation.y = 0.25 * Math.sin(a * 2); }
        else if (d.i === 1) { d.body.rotation.y = a * 2; d.arms[0].rotation.z = -1.6; d.arms[1].rotation.z = 1.6; }
        else if (d.i === 2) { d.head.rotation.x = 0.5 * k.kick * 2 - 0.2 + 0.2 * Math.sin(a * 8); d.arms[0].rotation.z = -0.5 - 1.8 * k.snare; d.arms[1].rotation.z = 0.5 + 1.8 * k.snare; d.body.rotation.y = 0.3 * Math.sin(a * 4); }
        else { d.g.position.x = d.x0 + 0.9 * Math.sin(a * 2); d.arms[0].rotation.z = -1.2 * Math.max(0, swing) - 0.3; d.arms[1].rotation.z = 1.2 * Math.max(0, swing) + 0.3; d.body.rotation.y = 0.3 * Math.cos(a * 2); }
        d.legs[0].rotation.x = 0.5 * Math.sin(Math.PI * q); d.legs[1].rotation.x = -0.5 * Math.sin(Math.PI * q); d.head.rotation.z = 0.12 * Math.sin(Math.PI * q) * s; d.mouth.scale.set(1.4, 0.8 + 1.4 * Math.max(k.bass, band(k.env, 0.3)), 0.6);
      });
      // furniture
      horse.rotation.z = 0.22 * Math.sin(a * 4) + 0.1 * k.kick; burners.forEach((b, i) => b.material.emissiveIntensity = 0.4 + 1.4 * (i ? k.snare : k.kick));
      keys.forEach((kk, i) => { const e = band(k.env, i / 13); const hot = Math.max(e, band(k.hit, i / 13)); kk.material.emissiveIntensity = 0.05 + 2.2 * hot; kk.position.y = 1.9 - 0.06 * hot; kk.material.emissive.copy(hue(hu + i * 0.05, 0.55)); });
      jhead.position.y = 1.9 + 1.5 * Math.min(1, k.kick * 1.2) + 0.1 * Math.sin(a * 6); spring.scale.y = 0.3 + 1.6 * Math.min(1, k.kick * 1.2); spring.position.y = 1.55 + 0.5 * spring.scale.y - 0.15; lid.rotation.z = -0.9 * Math.min(1, k.kick * 1.3); lid.position.x = -0.7 * Math.min(1, k.kick * 1.3) + 0; chestLid.rotation.z = 0.12 * Math.sin(a * 4) * k.snare;
      smoke.forEach(({ s, i }) => { const q = (((t * 2 + i / 6) % 1) + 1) % 1; s.position.set(6.2 + 1.8 * q + 0.5 * Math.sin(q * 8 + i), AY + FH + 3 + q * 7, -3); s.scale.setScalar(2 + q * 4); s.material.opacity = 0.35 * (1 - q) * (1 - q); });
      pumps.forEach((pp, i) => pp.material.emissiveIntensity = 0.35 + 0.9 * (i % 2 ? k.kick : k.snare));
      camera.position.set(2.8 * Math.sin(TAU * t), 1.4 + 0.5 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 30 - 0.5 * k.kick); camera.lookAt(0, 4.0, -3);
    },
  };
}
