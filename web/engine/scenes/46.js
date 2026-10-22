import { THREE, TAU, rng, extrudeText } from '../lib.js';
import { haze, music, brickTexture, bgClock } from '../lib2.js';
import { dawgSign, crowd, beams, K, band } from '../pop-kit.js';
import { createKit } from '../dancers.js';

// Garage Show: pop-punk basement gig. Brick wall, a DAWGHOUSE banner, amp stacks and a drum kit that hit with the music, bare bulbs and strobes.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x070308); scene.fog = new THREE.FogExp2(0x0c0510, 0.022);
  st.bloom.strength = 0.5; st.bloom.radius = 0.55; st.bloom.threshold = 0.85;
  scene.add(new THREE.AmbientLight(0x6a4a5a, 0.18));
  const R = rng(21);

  // brick back wall + plank floor
  const brick = brickTexture({ base: [96, 44, 40], seed: 5 }); brick.repeat.set(7, 3.2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(46, 22), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, color: 0xcdb0a8 })); wall.position.set(0, 6, -9); scene.add(wall);
  for (const x of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, color: 0x907878 })); w.position.set(x * 20, 6, 3); w.rotation.y = -x * Math.PI / 2; scene.add(w); }
  const fc = document.createElement('canvas'); fc.width = fc.height = 256; const fg = fc.getContext('2d'); for (let i = 0; i < 8; i++) { fg.fillStyle = `hsl(25 ${25 + R() * 15}% ${14 + R() * 8}%)`; fg.fillRect(0, i * 32, 256, 31); }
  const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(5, 3); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 30), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.5, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3, 0); scene.add(floor);
  const riser = new THREE.Mesh(new THREE.BoxGeometry(26, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.7 })); riser.position.set(0, -2.65, -5); scene.add(riser);

  // banner: red cloth with cream DAWGHOUSE lettering, hung from two chains
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(17, 4.6, 24, 6), new THREE.MeshStandardMaterial({ color: 0xc8202c, roughness: 0.85, side: THREE.DoubleSide })); cloth.position.set(0, 8.4, -8.5); scene.add(cloth);
  const cp = cloth.geometry.attributes.position, cbase = Float32Array.from(cp.array);
  const sign = dawgSign(scene, C, { width: 14.4, pos: [0, 8.4, -8.1], size: 2, depth: 0.35, emis: 0xffe0a0, color: 0xfff2d6, hop: 0.18, glow: false });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(17.3, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0xf0e0c0 })); const trim2 = trim.clone(); trim.position.set(0, 10.8, -8.45); trim2.position.set(0, 6.0, -8.45); scene.add(trim, trim2);
  for (const x of [-8, 8]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 9, 4), new THREE.MeshBasicMaterial({ color: 0x555560 })); ch.position.set(x, 15, -8.5); scene.add(ch); }

  // amp stacks
  const grille = document.createElement('canvas'); grille.width = grille.height = 128; const gg = grille.getContext('2d'); gg.fillStyle = '#120f12'; gg.fillRect(0, 0, 128, 128); gg.strokeStyle = '#2c262c'; gg.lineWidth = 2; for (let i = 0; i < 128; i += 5) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 128); gg.stroke(); gg.beginPath(); gg.moveTo(0, i); gg.lineTo(128, i); gg.stroke(); }
  const gt = new THREE.CanvasTexture(grille); const amps = [];
  const mkAmp = (x, rotY, big) => {
    const g = new THREE.Group(); g.position.set(x, -2.3, -6.6); g.rotation.y = rotY; scene.add(g);
    const rows = big ? 2 : 1; for (let r = 0; r < rows; r++) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x0c0a0c, roughness: 0.7 })); cab.position.y = 1.2 + r * 2.4; g.add(cab);
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.0), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.9, emissive: 0xff3a10, emissiveIntensity: 0.0 })); gr.position.set(0, 1.2 + r * 2.4, 0.71); g.add(gr);
      const pipe = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.06, 1.44), new THREE.MeshBasicMaterial({ color: 0xf0e0c0 })); pipe.position.y = 2.4 + r * 2.4; g.add(pipe); amps.push({ gr, g });
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030, toneMapped: false })); led.position.set(1.2, 2.2 + (big ? 2.4 : 0), 0.72); g.add(led);
  };
  mkAmp(-10.5, 0.25, true); mkAmp(-7.3, 0.15, false); mkAmp(10.5, -0.25, true); mkAmp(7.3, -0.15, false);

  // drum kit (centre-back): kick drum with face logo ring, snare, toms, cymbals that shake on hats
  const kit = new THREE.Group(); kit.position.set(0, -2.3, -7); kit.scale.setScalar(1.35); scene.add(kit);
  const shell = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.3, metalness: 0.1 }), chromeM = new THREE.MeshStandardMaterial({ color: 0xc8ccd8, metalness: 1, roughness: 0.25 }), brass = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 1, roughness: 0.3, emissive: 0xc08020, emissiveIntensity: 0.5 });
  const kick = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.3, 28), shell); kick.rotation.x = Math.PI / 2; kick.position.set(0, 1.2, 0); kit.add(kick);
  const head = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshStandardMaterial({ color: 0x1a1018, roughness: 0.4, emissive: 0xff2040, emissiveIntensity: 0.3 })); head.position.set(0, 1.2, 0.66); kit.add(head);
  const hring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.07, 8, 32), chromeM); hring.position.set(0, 1.2, 0.66); kit.add(hring);
  const drums = [[-1.6, 2.9, -0.3, 0.55], [-0.5, 3.1, -0.4, 0.5], [1.6, 2.6, -0.1, 0.6], [-2.2, 1.7, 0.9, 0.62]].map(([x, y, z, r]) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 20), shell); d.position.set(x, y, z); d.rotation.x = 0.25; kit.add(d);
    const t = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 20), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.5 })); t.position.set(x, y + 0.26, z + 0.03); t.rotation.x = -Math.PI / 2 + 0.25; kit.add(t);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, y, 4), chromeM); s.position.set(x, y / 2 - 0.2, z - 0.2); kit.add(s); return d;
  });
  const cymbals = [[-3.0, 4.0, -0.4, 0.95], [2.9, 4.2, -0.6, 1.05], [3.4, 3.1, 0.6, 0.8]].map(([x, y, z, r]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.97, 0.04, 28), brass); c.position.set(x, y, z); c.rotation.z = 0.12; kit.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, y + 0.5, 4), chromeM); s.position.set(x, y / 2 - 0.5, z); kit.add(s); return { c, x };
  });

  // bare bulbs on a string
  const bulbs = []; for (let i = 0; i < 12; i++) { const u = i / 11, x = -16 + u * 32, y = 12.2 - 1.8 * (1 - Math.pow(2 * u - 1, 2)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })); b.position.set(x, y, -5); scene.add(b); const g = haze(0xffa040, 2.4, 0.25, [x, y, -5]); scene.add(g); bulbs.push({ b, g }); }
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const u = i / 11; return new THREE.Vector3(-16 + u * 32, 12.4 - 1.8 * (1 - Math.pow(2 * u - 1, 2)), -5); })), 30, 0.03, 4), new THREE.MeshBasicMaterial({ color: 0x1a1418 })); scene.add(cord);
  // strobes + coloured wash
  const strobes = [-12, -4, 4, 12].map((x, i) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.5), m); b.position.set(x, 10.6, -3); b.scale.set(1.5, 1.5, 1.5); scene.add(b); return { m, b, i }; });
  const wash = [0xff2040, 0x30a0ff].map((c, i) => { const l = new THREE.SpotLight(c, 160, 0, 0.7, 0.6, 1.6); l.position.set(i ? 10 : -10, 13, 4); l.target.position.set(0, 3, -8); scene.add(l, l.target); return l; });
  const flash = new THREE.PointLight(0xffffff, 0, 0, 1.4); flash.position.set(0, 9, 2); scene.add(flash);

  // the band: monsters PLAYING on the riser (posed by hand each frame: drummer hits the kit, guitar/bass strum, singer works the mic), plus a dancing pit
  const DK = createKit(scene, { floorY: -2.3 }), PI = Math.PI, riserY = -2.3;
  const guitar = (col, long) => { const g = new THREE.Group(), bodyM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.12), bodyM); g.add(body); const horn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.12), bodyM); horn.position.set(-0.3, 0.38, 0); g.add(horn);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(long ? 1.7 : 1.4, 0.09, 0.07), new THREE.MeshStandardMaterial({ color: 0x3a2412 })); neck.position.set(-(long ? 1.15 : 1.0), 0.02, 0); g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.06), bodyM); head.position.set(-(long ? 2.05 : 1.75), 0.02, 0); g.add(head);
    for (const x of [0.0, 0.2]) { const pu = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 1, roughness: 0.3 })); pu.position.set(x, 0, 0.08); g.add(pu); }
    return g; };
  const mk = (d, x, z, s = 1.45) => { d.root.position.set(x, riserY, z); d.root.scale.setScalar(s); scene.add(d.root); return d; };
  const drummer = mk(DK.skeleton({ eye: 0xff3040, hat: false }), 0, -8.6, 1.5);
  const gtr = mk(DK.zombie({ shirt: 0x2a2a6a }), -5.0, -4.0), bass = mk(DK.mummy({ eye: 0xffc030 }), 5.0, -4.0), singer = mk(DK.skeleton({ eye: 0x30ffa0, hat: true }), -2.2, -2.6, 1.5);
  const g1 = guitar(0xff2040, false); g1.position.set(0.15, 0.5, 0.38); g1.rotation.z = 0.45; g1.rotation.y = -0.2; gtr.torso.add(g1);
  const g2 = guitar(0x30a0ff, true); g2.position.set(0.1, 0.45, 0.38); g2.rotation.z = 0.3; g2.rotation.y = -0.2; bass.torso.add(g2);
  const mic = new THREE.Group(); const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 3.1, 6), new THREE.MeshStandardMaterial({ color: 0x9a9aa8, metalness: 1, roughness: 0.3 })); stand.position.y = 1.55; mic.add(stand);
  const mhead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.6 })); mhead.position.set(0, 3.2, 0.06); mic.add(mhead); mic.position.set(-0.05, 0, 0.7); singer.root.add(mic);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a22 })); seat.position.set(0, riserY + 1.5, -8.6); scene.add(seat);
  const playBand = (t, k) => {
    const b = t * 16, e8 = Math.sin(TAU * t * 32), e4 = Math.sin(TAU * t * 16), bounce = Math.abs(Math.sin(PI * b));
    // drummer: seated, right arm on the toms/snare (eighths + snare accent), left arm on the hats, feet on the kick pedal
    drummer.hips.position.y = 1.05 + 0.03 * k.kick; drummer.lR.rotation.set(-1.45, 0, 0.12); drummer.lL.rotation.set(-1.45, 0, -0.12); drummer.kR.rotation.x = 1.5 - 0.5 * k.kick; drummer.kL.rotation.x = 1.5;
    drummer.aR.rotation.set(-0.95 - 0.55 * Math.max(0, e8) - 0.5 * k.snare, 0, 0.25); drummer.eR.rotation.set(-1.0 - 0.3 * Math.max(0, e8), 0, 0);
    drummer.aL.rotation.set(-0.95 - 0.55 * Math.max(0, -e8) - 0.4 * k.hat, 0, -0.3); drummer.eL.rotation.set(-1.0 - 0.3 * Math.max(0, -e8), 0, 0);
    drummer.torso.rotation.set(0.12 + 0.18 * k.kick, 0.2 * Math.sin(TAU * t * 16), 0); drummer.head.rotation.set(0.2 + 0.5 * k.kick, 0, 0.1 * e4); drummer.jaw.rotation.x = 0.1 + 0.3 * k.snare;
    // guitarist: wide stance, strumming arm hammers, fretting arm out on the neck, headbang on the kick
    for (const [p, side] of [[gtr, 1], [bass, -1]]) {
      p.hips.position.y = 1.7 + 0.1 * bounce; p.root.rotation.y = side * -0.12 + 0.05 * e4; p.lR.rotation.set(-0.1, 0, 0.16); p.lL.rotation.set(-0.1, 0, -0.16); p.kR.rotation.x = 0.2 + 0.2 * bounce; p.kL.rotation.x = 0.2 + 0.2 * bounce;
      p.aR.rotation.set(-0.55 + 0.3 * e8, 0, 0.35); p.eR.rotation.set(-1.1 + 0.2 * e8, 0, 0); p.aL.rotation.set(-1.2, 0, -0.95); p.eL.rotation.set(-0.4, 0, 0);
      p.torso.rotation.set(0.15 + 0.3 * k.kick, 0.2 * -side, 0); p.head.rotation.set(0.25 + 0.7 * k.kick, 0, 0.1 * e4); if (p.jaw) p.jaw.rotation.x = 0.1 + 0.4 * k.kick;
    }
    // singer: leaning into the mic, free hand punching up on the snare
    singer.hips.position.y = 1.7 + 0.12 * bounce; singer.lR.rotation.set(-0.15, 0, 0.12); singer.lL.rotation.set(-0.1, 0, -0.12); singer.kR.rotation.x = 0.2 * bounce; singer.kL.rotation.x = 0.15;
    singer.aR.rotation.set(-1.75, 0, 0.1); singer.eR.rotation.set(-1.0, 0, 0); singer.aL.rotation.set(-0.3 - 2.3 * k.snare, 0, -(0.45 + 0.5 * k.snare)); singer.eL.rotation.set(-0.3, 0, 0);
    singer.torso.rotation.set(0.2 + 0.15 * k.kick, 0.1 * e4, 0); singer.head.rotation.set(-0.1 + 0.3 * k.kick, 0, 0.08 * e4); singer.jaw.rotation.x = 0.15 + 0.7 * Math.max(k.bass, k.snare * 0.6, band(k.env, 0.3));
  };
  const pit = [[DK.pumpkin({ R: 1.0, face: 'grin' }), -8, 3.5], [DK.zombie({ skin: 0x8ab070 }), -4, 4.5], [DK.skeleton({ eye: 0xff9a30 }), 0.5, 5], [DK.pumpkin({ R: 1.0, face: 'oh', hat: true }), 4.5, 4.2], [DK.mummy({ eye: 0x40ffd0 }), 8, 3.4]];
  pit.forEach(([d, x, z], i) => { DK.place(d, x, z, 1.1, i * 0.37); d.root.position.y = -3.0; });
  const stageKey = new THREE.PointLight(0xfff0e0, 70, 0, 1.5); stageKey.position.set(0, 7, 4); scene.add(stageKey); const stageKey2 = new THREE.PointLight(0xffb0a0, 25, 0, 1.5); stageKey2.position.set(-9, 4, 2); scene.add(stageKey2);
  const cr = crowd(scene, { rows: [[0, 11.5], [0, 13.5]], per: 22, x0: -13, x1: 13, y: -2.2, seed: 31 });
  const rig = beams(scene, [{ color: 0xff2040, x: -9, y: 13, z: -2, len: 26, r: 0.7, sway: [0.35, 0.2], f: [1, 2], ph: 0, kind: 'kick', bz: -0.1 }, { color: 0x30a0ff, x: 9, y: 13, z: -2, len: 26, r: 0.7, sway: [0.35, 0.2], f: [2, 1], ph: 2, kind: 'snare', bz: 0.1 }, { color: 0xffd040, x: 0, y: 13, z: -3, len: 26, r: 0.5, sway: [0.5, 0.2], f: [1, 3], ph: 1, kind: 'hat' }]);
  const dustG = haze(0xffb080, 40, 0.04, [0, 4, -2]); scene.add(dustG);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t);
      sign.update(m); cr.update(t, k); DK.tick(t); playBand(t, k);
      // cloth ripples, pushed by the bass
      for (let i = 0; i < cp.count; i++) { const x = cbase[i * 3], y = cbase[i * 3 + 1]; cp.setZ(i, 0.22 * Math.sin(x * 0.55 + a * 2) * (0.5 + k.bass) + 0.1 * Math.sin(y * 1.4 - a * 4)); }
      cp.needsUpdate = true; cloth.geometry.computeVertexNormals();
      kick.scale.set(1 + 0.05 * k.kick, 1, 1 + 0.05 * k.kick); head.material.emissiveIntensity = 0.3 + 1.6 * k.kick; kit.position.y = -2.3 + 0.08 * k.kick;
      drums.forEach((d, i) => { d.scale.setScalar(1 + 0.08 * (i % 2 ? k.snare : k.hat)); });
      cymbals.forEach(({ c, x }, i) => { c.rotation.z = 0.12 + 0.2 * k.hat * Math.sin(a * 20 + i) * Math.sign(x); c.rotation.x = 0.15 * k.snare * Math.sin(a * 14 + i); c.position.y += 0; });
      amps.forEach(({ gr }) => { gr.material.emissiveIntensity = 0.0 + 0.22 * k.kick; });
      bulbs.forEach(({ b, g }, i) => { const on = 0.5 + 0.4 * k.hat + 0.3 * band(k.env, i / 11); g.material.opacity = 0.1 + 0.35 * on; b.scale.setScalar(0.8 + 0.5 * on); });
      strobes.forEach(({ m, b, i }) => { const on = i % 2 ? k.snare : k.kick, v = on > 0.5 ? 1 : 0.12 + 0.2 * on; m.color.setRGB(v, v, v * 1.1); });
      stageKey.intensity = 45 + 60 * k.kick; flash.intensity = 260 * Math.max(0, k.snare - 0.55) ** 1.2; wash[0].intensity = 120 + 420 * k.kick; wash[1].intensity = 120 + 420 * k.snare; rig.update(a, m);
      dustG.material.opacity = 0.03 + 0.05 * k.kick;
      camera.position.set(1.4 * Math.sin(TAU * t), 3.2 + 0.2 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 17.5 - 0.5 * k.kick); camera.lookAt(0, 3.0, -8);
    },
  };
}
