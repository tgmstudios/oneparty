import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, bgClock } from '../lib2.js';
import { dawgSign, beams, confetti, K, band } from '../pop-kit.js';

// Clown Midway: a funhouse carnival at night. A giant clown-face entrance (eyes that look around, a nose that honks on the kick, a mouth you walk into),
// a juggler, a dancer and a unicycle clown out front, game booths whose balloons pop and bottles wobble, a strength-tester that rockets on the kick,
// chasing light strings, searchlights and confetti. DAWGHOUSE is the marquee board on the clown's hat.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x0a0618); scene.fog = new THREE.FogExp2(0x180a2e, 0.013);
  st.bloom.strength = 0.65; st.bloom.radius = 0.7; st.bloom.threshold = 0.8;
  scene.add(new THREE.AmbientLight(0x8a6aa8, 0.55));
  const R = rng(39), GY = -4, hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  scene.add(skyGradient([[0, '#06030f'], [0.5, '#1a0a3a'], [0.85, '#4a1a5a'], [1, '#7a2a5a']], -90, 360, 180));
  const key = new THREE.PointLight(0xffc880, 140, 0, 1.4); key.position.set(0, 9, 14); const rimL = new THREE.PointLight(0x40c8ff, 90, 0, 1.4); rimL.position.set(-14, 6, 4); const rim2 = new THREE.PointLight(0xff3fa0, 90, 0, 1.4); rim2.position.set(14, 6, 4); scene.add(key, rimL, rim2);
  const mat = (c, e = 0.2, r = 0.55) => new THREE.MeshStandardMaterial({ color: c, roughness: r, emissive: c, emissiveIntensity: e });
  const add = (o, parent = scene) => { parent.add(o); return o; };

  // ---- ground + stars
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.95 }))); ground.rotation.x = -Math.PI / 2; ground.position.set(0, GY, -30);
  const tc = document.createElement('canvas'); tc.width = tc.height = 128; const tg = tc.getContext('2d'); tg.fillStyle = '#2a1a44'; tg.fillRect(0, 0, 128, 128); tg.fillStyle = '#3a2058'; tg.fillRect(0, 0, 64, 64); tg.fillRect(64, 64, 64, 64);
  const tt = new THREE.CanvasTexture(tc); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(10, 10); tt.colorSpace = THREE.SRGBColorSpace;
  const lane = add(new THREE.Mesh(new THREE.PlaneGeometry(18, 60), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.8 }))); lane.rotation.x = -Math.PI / 2; lane.position.set(0, GY + 0.02, -6);
  const sp = new Float32Array(200 * 3); for (let i = 0; i < 200; i++) { sp[i * 3] = (R() - 0.5) * 200; sp[i * 3 + 1] = 12 + R() * 50; sp[i * 3 + 2] = -80; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));

  // ---- the giant clown-face funhouse entrance
  const FZ = -17, F = new THREE.Group(); F.position.set(0, 0, FZ); scene.add(F);
  const skin = new THREE.MeshStandardMaterial({ color: 0xf6ece0, roughness: 0.6, emissive: 0x403030, emissiveIntensity: 0.35 });
  const head = add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1.6, 48), skin), F); head.rotation.x = Math.PI / 2; head.position.set(0, 5.5, 0);
  const puffs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 7.4, 7.2, 0); F.add(g); const c = s < 0 ? 0xff7a18 : 0x30d0a0; for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.9 - i * 0.12, 16, 12), mat(c, 0.35)); b.position.set(s * (i % 2) * 0.9, 1.2 - i * 1.0, 0.1 * i); g.add(b); } return g; });
  const hat = add(new THREE.Mesh(new THREE.ConeGeometry(5.0, 7.5, 24), mat(0x8a2ae0, 0.4)), F); hat.position.set(0, 16.2, -0.4); const hatStripe = add(new THREE.Mesh(new THREE.ConeGeometry(3.1, 4.9, 24), mat(0xffc830, 0.4)), F); hatStripe.position.set(0, 16.9, -0.38);
  const pom = add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10), mat(0xff3fa0, 0.6)), F); pom.position.set(0, 20.2, -0.4);
  const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.6, 40), mat(0x5a1a9a, 0.3)), F); brim.position.set(0, 12.6, -0.2);
  // eyes (look around), eyebrows, cheeks, nose, mouth with teeth
  const eyes = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 2.6, 8.4, 0.9); F.add(g); const w = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); w.scale.z = 0.5; g.add(w); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: 0x120a18 })); pu.position.z = 0.55; g.add(pu); const dia = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0x20b8c0, toneMapped: false })); dia.position.y = 0.2; g.add(dia); const brow = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 8, 20, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: 0x120a18 })); brow.position.set(0, 2.0, 0.2); brow.rotation.z = Math.PI * 0.1 + (s < 0 ? 0.1 : -0.1); g.add(brow); return { g, pu, brow, s }; });
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), new THREE.MeshBasicMaterial({ color: 0xff5a8a })); ch.position.set(s * 4.6, 5.4, 0.85); F.add(ch); }
  const nose = add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), mat(0xff2a3a, 0.7, 0.3)), F); nose.position.set(0, 6.1, 1.5);
  const mouthG = new THREE.Group(); mouthG.position.set(0, 2.4, 0.85); F.add(mouthG);
  const cav = new THREE.Mesh(new THREE.CircleGeometry(2.9, 32, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0x15040a })); cav.scale.set(1.25, 0.95, 1); cav.rotation.z = 0; mouthG.add(cav);
  const lipM = new THREE.MeshStandardMaterial({ color: 0xe02040, emissive: 0xe02040, emissiveIntensity: 0.5 }); const lip = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.38, 8, 40, Math.PI), lipM); lip.scale.set(1.25, 0.95, 1); lip.rotation.z = Math.PI; mouthG.add(lip);
  const mouthTop = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 0.5), lipM); mouthTop.position.y = 0.0; mouthG.add(mouthTop);
  const inner = haze(0xff3fa0, 9, 0.6, [0, -1.0, 0.2]); mouthG.add(inner);
  const steps = []; for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(5 - i * 0.25, 0.28, 1.6), new THREE.MeshBasicMaterial({ color: 0xffc830, toneMapped: false })); t.position.set(0, GY + 0.2 + i * 0.0, 5.8 - i * 0.0); steps.push(t); }
  for (let i = 0; i < 9; i++) { const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.9, 0.25), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.4 })); tooth.position.set(-3.4 + i * 0.85, -0.5, 0.35); mouthG.add(tooth); }
  const ruff = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * TAU, b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), mat(i % 2 ? 0x20b8c0 : 0xff3fa0, 0.45)); b.position.set(Math.cos(a) * 5.8, -0.2 + Math.sin(a) * 1.4, 0.3); b.scale.z = 0.7; return b; });
  const collar = new THREE.Group(); collar.position.set(0, -1.2, 0); F.add(collar); ruff.forEach(r => collar.add(r)); collar.position.z = 0.5; collar.position.y = -0.6;
  // marquee board on the hat brim: DAWGHOUSE
  const board = add(new THREE.Mesh(new THREE.BoxGeometry(13.4, 3.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x1a0a2a, roughness: 0.5 })), F); board.position.set(0, 13.9, 5.2);
  const sign = dawgSign(F, C, { width: 11.6, pos: [0, 13.9, 5.75], size: 2.2, depth: 0.7, emis: 0xffc030, color: 0xfff0b0, hop: 0.4, glow: false });
  const bbulbs = []; for (let i = 0; i < 30; i++) for (const y of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); b.position.set(-6.3 + (i / 29) * 12.6, 13.9 + y * 1.45, 5.65); F.add(b); bbulbs.push(b.material); }

  // ---- clowns (built by hand: juggler, dancer, unicycle)
  const makeClown = (suit, suit2, hair, hat2) => {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const sM = mat(suit, 0.3), s2M = mat(suit2, 0.3);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), sM); torso.position.y = 2.0; torso.scale.set(1.05, 1.15, 0.95); body.add(torso);
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), s2M); const a = i * 1.26; d.position.set(Math.sin(a) * 0.9, 2.0 + Math.cos(a * 1.7) * 0.6, 0.55 + Math.cos(a) * 0.3); body.add(d); }
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.2, 8, 18), new THREE.MeshStandardMaterial({ color: 0xfff6e8 })); col.rotation.x = Math.PI / 2; col.position.y = 3.0; body.add(col);
    const hd = new THREE.Group(); hd.position.y = 3.65; body.add(hd);
    hd.add(new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), new THREE.MeshStandardMaterial({ color: 0xf8eee4, roughness: 0.5 })));
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0x120a18 })); e.position.set(s * 0.28, 0.14, 0.64); hd.add(e); const bw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: hair, emissive: hair, emissiveIntensity: 0.3 })); bw.position.set(s * 0.72, 0.1, 0); bw.scale.set(1, 1.1, 1); hd.add(bw); const ch = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshBasicMaterial({ color: 0xff5a8a })); ch.position.set(s * 0.42, -0.14, 0.66); hd.add(ch); }
    const nz = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2040 })); nz.position.set(0, -0.02, 0.74); hd.add(nz);
    const mo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0xd02040 })); mo.rotation.z = Math.PI; mo.position.set(0, -0.2, 0.62); hd.add(mo);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, TAU, 0, Math.PI / 2), mat(hair, 0.3)); hr.position.y = 0.45; hd.add(hr);
    const hc = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 10), mat(hat2, 0.4)); hc.position.y = 1.15; hd.add(hc); const hp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(0xffffff, 0.6)); hp.position.y = 1.8; hd.add(hp);
    const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * 1.05, 2.7, 0); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 1.3, 8), sM); r.position.y = -0.65; a.add(r); const h = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff })); h.position.y = -1.4; a.add(h); body.add(a); return a; });
    const legs = [-1, 1].map(s => { const l = new THREE.Group(); l.position.set(s * 0.45, 1.1, 0); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.9, 8), s2M); r.position.y = -0.45; l.add(r); const sh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(0xe02a2a, 0.3)); sh.scale.set(0.8, 0.5, 1.6); sh.position.set(0, -1.0, 0.35); l.add(sh); body.add(l); return l; });
    return { g, body, hd, arms, legs, mo };
  };
  const juggler = makeClown(0xe02a3a, 0xffc830, 0xff7a18, 0x20b8c0), dancer = makeClown(0x2090e0, 0xff3fa0, 0x30d0a0, 0xffc830), cyclist = makeClown(0x8a2ae0, 0xffc830, 0xff3fa0, 0xe02a3a);
  juggler.g.position.set(-5.5, GY + 0.1, -0.5); dancer.g.position.set(5.2, GY + 0.1, 0.5); cyclist.g.position.set(0, GY + 1.5, 3.5); [juggler, dancer, cyclist].forEach(c => { c.g.scale.setScalar(1.05); scene.add(c.g); });
  const wheelG = new THREE.Group(); wheelG.position.set(0, GY + 0.95, 3.5); scene.add(wheelG);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), new THREE.MeshStandardMaterial({ color: 0xcfd0dc, metalness: 0.9, roughness: 0.3 })); wheelG.add(wheel); for (let i = 0; i < 6; i++) { const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 4), wheel.material); sp2.rotation.z = (i / 6) * Math.PI; wheel.add(sp2); } const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5), wheel.material); fork.position.y = 0.9; wheelG.add(fork);
  const balls = [0, 1, 2].map(i => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ color: [0xff3fa0, 0xffc830, 0x30d0ff][i], toneMapped: false })); scene.add(b); return b; });

  // ---- booths, strength tester
  const stripe = document.createElement('canvas'); stripe.width = 128; stripe.height = 8; const sc = stripe.getContext('2d'); for (let i = 0; i < 8; i++) { sc.fillStyle = i % 2 ? '#fff4e0' : '#e02a3a'; sc.fillRect(i * 16, 0, 16, 8); }
  const sTex = new THREE.CanvasTexture(stripe); sTex.wrapS = THREE.RepeatWrapping; sTex.colorSpace = THREE.SRGBColorSpace;
  const booths = [], balloons = [], bottles = [];
  const mkBooth = (x, z, side, kind) => {
    const g = new THREE.Group(); g.position.set(x, GY, z); g.rotation.y = -side * 0.35; scene.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.3, 2.2), mat(0x3a1a4a, 0.15)); base.position.y = 1.15; g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.5, 0.2), mat(0x241238, 0.15)); back.position.set(0, 3.3, -1.0); g.add(back);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 3.0), new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.8, emissive: 0x401010, emissiveIntensity: 0.5 })); awn.position.set(0, 5.3, 0.2); awn.rotation.x = -0.28; g.add(awn);
    for (const px of [-2.6, 2.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 6), mat(0xffc830, 0.4)); p.position.set(px, 2.7, 1.2); g.add(p); }
    const lamp = haze(0xffd890, 5, 0.35, [0, 4.6, 1.0]); g.add(lamp);
    if (kind === 0) { for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(i * 0.083, 1, 0.55), emissive: new THREE.Color().setHSL(i * 0.083, 1, 0.4), emissiveIntensity: 0.5, roughness: 0.2 })); b.position.set(-1.7 + (i % 4) * 1.13, 2.8 + Math.floor(i / 4) * 0.85, -0.7); g.add(b); balloons.push({ b, i, booth: g }); } }
    else { for (let r = 0; r < 3; r++) for (let c = 0; c <= 2 - r; c++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: 0.3 })); b.position.set(-0.6 * (2 - r) / 1 + c * 1.2 - 0.2, 2.7 + r * 0.8, -0.2); g.add(b); bottles.push({ b, r, c }); } }
    booths.push({ g, lamp, kind }); return g;
  };
  mkBooth(-13, -3, -1, 0); mkBooth(13, -4, 1, 1); mkBooth(-15, -11, -1, 1); mkBooth(15.5, -12, 1, 0);
  const tester = new THREE.Group(); tester.position.set(10.5, GY, 3.5); scene.add(tester);
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10, 0.4), mat(0xe02a3a, 0.3)); pole.position.y = 5; tester.add(pole); const track = new THREE.Mesh(new THREE.BoxGeometry(0.16, 9, 0.2), new THREE.MeshBasicMaterial({ color: 0xffc830, toneMapped: false })); track.position.set(0, 5, 0.3); tester.add(track);
  const puck = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); puck.position.set(0, 1, 0.42); tester.add(puck);
  const tbell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10, 0, TAU, 0, Math.PI / 2), mat(0xffc830, 0.5)); tbell.position.y = 10.1; tester.add(tbell); const tglow = haze(0xffc830, 5, 0.1, [0, 10.4, 0.3]); tester.add(tglow);
  const hammerBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.5, 16), mat(0x3a1a4a, 0.2)); hammerBase.position.y = 0.25; tester.add(hammerBase);

  // ---- bulb strings, searchlights, balloons, confetti
  const strands = []; for (const [zz, y0] of [[0, 9.5], [-8, 11]]) for (let i = 0; i < 26; i++) { const u = i / 25, x = -20 + u * 40, y = y0 - 2.4 * (1 - Math.pow(2 * u - 1, 2)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); b.position.set(x, y, zz); scene.add(b); strands.push({ b, i, zz }); }
  const rig = beams(scene, [-1, 1].flatMap((s, i) => [0, 1].map(j => ({ color: j ? 0xff3fa0 : 0x40c8ff, x: s * 20, y: 18, z: -10, len: 50, r: 1.2, sway: [0.4, 0.2], f: [1 + j, 2], ph: i * 1.5 + j, bz: -s * 0.25, kind: j ? 'snare' : 'kick' }))));
  const floats = Array.from({ length: 9 }, (_, i) => { const g = new THREE.Group(), c = [0xff3fa0, 0xffc830, 0x30d0ff, 0x8a2ae0, 0x30d0a0][i % 5]; const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.2 })); b.scale.y = 1.25; g.add(b); const str = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 3), new THREE.MeshBasicMaterial({ color: 0xcccccc })); str.position.y = -2; g.add(str); g.position.set(-14 + i * 3.5, 6 + (i % 3), -2 - (i % 4) * 2); scene.add(g); return { g, i }; });
  const cf = confetti(scene, { count: 170, box: [40, 22, 20], center: [0, 8, -4], colors: [0xff3fa0, 0xffc830, 0x30d0ff, 0x8a2ae0, 0xffffff], size: 0.28, seed: 9, cyc: [1, 2] });
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), bnc = Math.abs(Math.sin(Math.PI * p));
      sign.update(m); rig.update(a, m); cf.update(t, k);
      // face
      nose.scale.setScalar(1 + 0.35 * k.kick); eyes.forEach(({ g, pu, brow, s }) => { pu.position.x = 0.45 * Math.sin(a * 2 + s); pu.position.y = 0.2 * Math.cos(a * 3); brow.position.y = 2.0 + 0.35 * k.kick + 0.2 * Math.sin(a * 4 + s); g.scale.setScalar(1 + 0.05 * k.snare); });
      mouthG.scale.y = 1 + 0.08 * Math.max(k.bass, band(k.env, 0.2)); inner.material.color.copy(hue(hu, 0.55)); inner.material.opacity = 0.35 + 0.5 * k.kick; lipM.emissiveIntensity = 0.4 + 0.9 * k.kick;
      puffs.forEach((g, i) => { g.rotation.z = 0.1 * Math.sin(a * 2 + i * 3) * (1 + k.snare); g.position.y = 7.2 + 0.25 * k.bass; }); pom.position.y = 20.2 + 0.5 * Math.abs(Math.sin(a * 4)) + 0.4 * k.kick; hat.rotation.z = 0.03 * Math.sin(a * 2);
      collar.children.forEach((r, i) => r.scale.setScalar(1 + 0.12 * band(k.env, i / 16)));
      bbulbs.forEach((mm, i) => { const on = (Math.floor(p * 2 + i * 0.4) % 3); mm.color.copy([hue(0.12, 0.6), hue(0.92, 0.6), hue(0.5, 0.6)][on]); });
      // clowns
      const bob = (c, ph) => { c.body.position.y = 0.3 * bnc * (0.6 + k.kick) + 0; c.hd.rotation.z = 0.12 * Math.sin(Math.PI * (p + ph)); c.mo.scale.set(1, 1 + 0.8 * Math.max(k.bass, band(k.env, 0.3)), 1); };
      bob(juggler, 0); bob(dancer, 0.5); bob(cyclist, 0.25);
      const sw = Math.sin(TAU * p / 2);
      juggler.arms[0].rotation.set(-0.5, 0, -0.9 + 0.3 * Math.sin(TAU * p)); juggler.arms[1].rotation.set(-0.5, 0, 0.9 - 0.3 * Math.sin(TAU * p + Math.PI)); juggler.legs[0].rotation.x = 0.2 * Math.sin(Math.PI * p); juggler.legs[1].rotation.x = -0.2 * Math.sin(Math.PI * p);
      balls.forEach((b, i) => { const s = (((p / 2 + i / 3) % 1) + 1) % 1 * 2, idx = Math.floor(s), f = s - idx, L = idx % 2 ? 1 : -1; b.position.set(juggler.g.position.x + (L * -1 + (L * 2) * f) * 1.0, GY + 3.2 + 3.4 * 4 * f * (1 - f) + 0.2, juggler.g.position.z + 0.9); });
      dancer.body.rotation.y = a * 2; dancer.arms[0].rotation.z = -1.6; dancer.arms[1].rotation.z = 1.6; dancer.legs[0].rotation.x = 0.6 * Math.sin(Math.PI * p); dancer.legs[1].rotation.x = -0.6 * Math.sin(Math.PI * p); dancer.g.position.x = 5.2 + 1.2 * Math.sin(a);
      cyclist.g.position.x = 3.2 * Math.sin(a); wheelG.position.x = cyclist.g.position.x; wheel.rotation.z = -a * 6 * Math.sign(Math.cos(a) || 1) * 0 - a * 6; cyclist.arms[0].rotation.z = -1.1 + 0.4 * Math.sin(a * 4); cyclist.arms[1].rotation.z = 1.1 - 0.4 * Math.sin(a * 4); cyclist.legs[0].rotation.x = -0.9 + 0.9 * Math.sin(a * 6); cyclist.legs[1].rotation.x = -0.9 - 0.9 * Math.sin(a * 6); cyclist.g.rotation.z = -0.12 * Math.cos(a);
      // booths
      booths.forEach(({ lamp }, i) => lamp.material.opacity = 0.25 + 0.3 * (i % 2 ? k.kick : k.snare));
      const pop = Math.floor(p) % 12, fr = p - Math.floor(p);
      balloons.forEach(({ b, i }) => { const since = (pop - i + 12) % 12; b.scale.setScalar(since === 0 ? Math.max(0.0001, 1.6 - fr * 3.2) : Math.min(1, since / 3.5)); b.visible = !(since === 0 && fr > 0.55); });
      bottles.forEach(({ b, r, c }, i) => { b.rotation.z = 0.12 * Math.sin(a * 4 + i) * (0.4 + k.snare * 2); b.position.y = 2.7 + r * 0.8 + 0.1 * k.kick * (r + 1); });
      const h = Math.min(1, k.kick * 1.25); puck.position.y = 1 + 8.6 * h; tbell.material.emissiveIntensity = 0.4 + 2.0 * h; tglow.material.opacity = 0.1 + 0.6 * h; tbell.scale.setScalar(1 + 0.2 * h);
      strands.forEach(({ b, i, zz }) => { const on = 0.5 + 0.5 * Math.sin(a * 4 - i * 0.5 + zz); b.material.color.copy(hue(hu + i * 0.04, 0.4 + 0.3 * on)); b.scale.setScalar(0.8 + 0.5 * on); });
      floats.forEach(({ g, i }) => { g.position.y = 6 + (i % 3) + 0.7 * Math.sin(a * 2 + i) + 0.3 * k.bass; g.rotation.z = 0.12 * Math.sin(a + i); });
      key.intensity = 110 + 80 * k.kick; rimL.intensity = 70 + 70 * k.snare; rim2.intensity = 70 + 70 * k.kick;
      camera.position.set(2.2 * Math.sin(TAU * t), 3.4 + 0.5 * Math.sin(TAU * t * 2) + 0.12 * k.kick, 28 - 0.6 * k.kick); camera.lookAt(0, 4.6, -8);
    },
  };
}
