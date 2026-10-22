import { THREE, TAU, rng, extrudeText } from '../lib.js';
import { haze, particles, music, bgClock } from '../lib2.js';
import { createKit } from '../dancers.js';
import { dawgSign, beams, ledWall, confetti, K, band } from '../pop-kit.js';

// Skeleton Ball: a candle-lit gothic ballroom. A checkered LED marble floor ripples on the kick, a grand chandelier (candles, crystals, three counter-rotating
// tiers) hangs over the floor and swells/swings with the bass, a gilded DAWGHOUSE sign hangs under the arched moonlit windows, and a ballroom full of
// costumed skeletons (top hats, bow ties, boas) dances in two rows with a king skeleton on the stage steps. Spotlights sweep, candles flicker, embers rise.
export async function build(st, C) {
  const { scene, camera } = st;
  const FLOOR = -3.2, GOLD = 0xffb23a;
  scene.background = new THREE.Color(0x07030d); scene.fog = new THREE.FogExp2(0x150a1e, 0.021);
  st.bloom.strength = 0.5; st.bloom.radius = 0.7; st.bloom.threshold = 0.86;
  scene.add(new THREE.AmbientLight(0x5a3a80, 0.4));
  scene.add(new THREE.HemisphereLight(0x8a70c0, 0x1a0a10, 0.25));
  const pal = [0xff7a18, 0x40ff9a, 0xb450ff, 0xffd040].map(c => new THREE.Color(c));
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89030, metalness: 0.9, roughness: 0.3, emissive: 0x3a2000, emissiveIntensity: 0.6 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0x1a0c22, roughness: 0.85, emissive: 0x08020e, emissiveIntensity: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 0.9 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x6a0c22, roughness: 0.8, emissive: 0x200008, emissiveIntensity: 0.8 });
  const R = rng(9);

  // ---- room shell: back wall, side walls, ceiling shadow
  const back = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), wallM); back.position.set(0, 10, -17); scene.add(back);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), wallM); w.position.set(s * 22, 10, -2); w.rotation.y = -s * Math.PI / 2; scene.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), dark); ceil.position.set(0, 23, -4); ceil.rotation.x = Math.PI / 2; scene.add(ceil);

  // ---- arched windows with moonlight
  const archShape = (w, h) => { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; };
  const wins = [];
  for (const x of [-16.5, -9, 9, 16.5]) {
    const g = new THREE.Group(); g.position.set(x, -1.2, -16.6); scene.add(g);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(archShape(3.6, 11)), new THREE.MeshBasicMaterial({ color: 0x4a62c8, toneMapped: false, fog: false })); g.add(glass);
    for (const mx of [-0.9, 0.9]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 10, 0.1), dark); m.position.set(mx, 5, 0.05); g.add(m); }
    for (const my of [3, 6.5, 9]) { const m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.1), dark); m.position.set(0, my, 0.05); g.add(m); }
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape(4.2, 11.6), { depth: 0.2, bevelEnabled: false }), gold); fr.position.set(0, -0.3, -0.25); g.add(fr);
    const moon = haze(0x6a86ff, 11, 0.28, [x, 5, -15.8]); scene.add(moon); wins.push({ glass, moon });
  }
  // curtains flanking each window pair
  for (const x of [-19.8, -12.5, 12.5, 19.8]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 14, 0.7), velvet); c.position.set(x, 3.4, -16.2); scene.add(c); for (let i = -1; i <= 1; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 14, 8), velvet); f.position.set(x + i * 0.45, 3.4, -15.8); scene.add(f); } }

  // ---- floor: LED checker marble, ripples from the centre on the kick, sparkles on the highs
  const floor = ledWall(scene, { cols: 28, rows: 18, cell: 1.45, pos: [0, FLOOR - 0.02, -4], rot: [-Math.PI / 2, 0, 0], gap: 0.97 }, (q, r, u, v, out, a, k) => {
    const d = Math.hypot((q - 13.5) * 1.0, (r - 9) * 1.15), chk = (q + r) & 1, ring = Math.sin(d * 0.75 - a * 8) * 0.5 + 0.5, e = band(k.env, Math.min(1, Math.abs(u - 0.5) * 2));
    const base = chk ? 0.05 : 0.012, lit = (0.1 + 0.5 * ring * ring) * (0.3 + 0.9 * k.kick) + 0.45 * e * k.bass + 0.2 * k.snare * (1 - v);
    out.copy(pal[((q >> 1) + (r >> 1) + Math.floor(a / TAU * 4)) & 3]).multiplyScalar(chk ? base + lit * 0.9 : base + lit * 0.25);
  });
  // gold border around the dance floor
  for (const [w, d, x, z] of [[41.5, 0.3, 0, 9.1], [41.5, 0.3, 0, -17.1], [0.3, 26.5, -20.4, -4], [0.3, 26.5, 20.4, -4]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), gold); b.position.set(x, FLOOR, z); scene.add(b); }

  // ---- stage steps + gilded throne at the back
  const steps = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(11 - i * 2.6, 0.55, 5.2 - i * 1.2), new THREE.MeshStandardMaterial({ color: 0x2a0e30, roughness: 0.5, metalness: 0.2, emissive: 0x12041a, emissiveIntensity: 1 })); s.position.set(0, FLOOR + 0.27 + i * 0.55, -12.5 + i * 0.5); scene.add(s); steps.push(s); const e = new THREE.Mesh(new THREE.BoxGeometry(11 - i * 2.6 + 0.05, 0.07, 5.25 - i * 1.2), gold); e.position.set(0, FLOOR + 0.55 + i * 0.55, -12.5 + i * 0.5); scene.add(e); }
  const STAGE_Y = FLOOR + 1.65;
  const throne = new THREE.Group(); throne.position.set(0, STAGE_Y, -14.6); scene.add(throne);
  throne.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 1.4), velvet).translateY(0.5), new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.6, 0.5), velvet).translateY(3.4).translateZ(-0.5));
  for (const sx of [-1.25, 1.25]) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 6), gold); sp.position.set(sx, 6.5, -0.5); throne.add(sp); }
  throne.add(new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 6), gold).translateY(7).translateZ(-0.5));

  // ---- DAWGHOUSE: gilded sign hung on chains, with a small SKELETON BALL plaque under it
  const sign = dawgSign(scene, C, { width: 15.5, pos: [0, 15.4, -15.6], size: 2, depth: 0.7, emis: GOLD, color: 0xffe0a0, hop: 0.35, glow: true, metal: 0.55 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(18.2, 4.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x12061a, roughness: 0.5, metalness: 0.4 })); board.position.set(0, 15.4, -16.2); scene.add(board);
  const bTrim = new THREE.Mesh(new THREE.BoxGeometry(18.6, 4.7, 0.3), gold); bTrim.position.set(0, 15.4, -16.45); scene.add(bTrim);
  for (const sx of [-8.2, 8.2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 5), gold); ch.position.set(sx, 23, -16); scene.add(ch); }
  const plaque = extrudeText(C.fonts.script, 'Skeleton Ball', { size: 1, track: 0.05, depth: 0.15, bevel: 0.02, material: new THREE.MeshStandardMaterial({ color: 0xffe9c0, emissive: 0xff8a20, emissiveIntensity: 0.7 }), targetWidth: 6.5 });
  plaque.group.position.set(0, 12.7, -15.9); scene.add(plaque.group);

  // ---- the chandelier: the centrepiece. Three tiers, candles + flames, hanging crystals; swells on the kick, tiers counter-rotate, crystals follow the bands
  const chand = new THREE.Group(); chand.position.set(0, 8.6, -4); scene.add(chand);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 14, 6), gold); chain.position.y = 7; chand.add(chain);
  chand.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), gold));
  const tiers = [], flames = [], crystals = [];
  const flameTex = haze(0xffffff, 1, 1, [0, 0, 0]).material.map;
  const flameMat = () => new THREE.SpriteMaterial({ map: flameTex, color: 0xffb040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  [[4.2, 14, -0.6], [2.9, 10, -1.5], [1.6, 6, -2.3]].forEach(([r, n, y], ti) => {
    const g = new THREE.Group(); g.position.y = y; chand.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 10, 64), gold); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, c = new THREE.Group(); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.add(c);
      c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xf2ead6, emissive: 0x5a4020, emissiveIntensity: 0.6 })).translateY(0.35));
      const f = new THREE.Sprite(flameMat()); f.scale.set(0.7, 1.1, 1); f.position.y = 0.95; c.add(f); flames.push({ f, ph: R() * TAU, k: 1 + (i % 3) });
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.2 + 0.05 * (i % 3), 0), new THREE.MeshStandardMaterial({ color: 0xcfe0ff, emissive: 0x5a78ff, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.3, flatShading: true })); cr.scale.y = 2.2; cr.position.set(Math.cos(a) * 0.01, -0.7 - (i % 2) * 0.35, 0); c.add(cr); crystals.push({ m: cr, u: i / n });
    }
    tiers.push({ g, dir: ti % 2 ? -1 : 1, ti });
  });
  const chandGlow = haze(0xffa840, 11, 0.1, [0, 8.2, -4]); scene.add(chandGlow);
  const chandLight = new THREE.PointLight(0xffb060, 60, 0, 1.4); chandLight.position.set(0, 6, -4); scene.add(chandLight);

  // ---- candelabra + pillars along the sides
  const lamps = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = 5 - i * 5.2, g = new THREE.Group(); g.position.set(s * 19.2, FLOOR, z); scene.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1, 10), gold).translateY(0.5), new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 8), gold).translateY(3.2));
    for (let j = 0; j < 3; j++) { const ax = (j - 1) * 0.6, arm = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 14, Math.PI), gold); arm.position.set(ax, 5.4, 0); arm.rotation.z = Math.PI; g.add(arm); }
    for (const ax of [-0.6, 0, 0.6]) { g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 7), new THREE.MeshStandardMaterial({ color: 0xf2ead6, emissive: 0x4a3010, emissiveIntensity: 0.6 })).translateX(ax).translateY(5.5)); const f = new THREE.Sprite(flameMat()); f.scale.set(0.55, 0.9, 1); f.position.set(ax, 6.1, 0); g.add(f); flames.push({ f, ph: R() * TAU, k: 1 + ((i + (ax > 0)) % 3) }); }
    lamps.push(g);
  }

  // ---- spotlights from the ceiling
  const spots = [-14, -8, -2.5, 2.5, 8, 14].map((x, i) => ({ color: pal[i % 4].getHex(), x, y: 21, z: -2 - (i % 2) * 3, len: 30, r: 0.75, sway: [0.35, 0.25], f: [1 + (i % 2), 2], ph: i * 0.9, kind: ['kick', 'snare', 'hat'][i % 3] }));
  const rig = beams(scene, spots);

  // ---- the guests: two rows of skeletons in costume. extras (hats, bow ties, boas) ride on each skeleton's head/torso.
  const DK = createKit(scene, { floorY: FLOOR });
  const bowTie = (d, c) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), m); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.12, 1.12, 0.2); d.torso.add(w); } d.torso.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m).translateY(1.12).translateZ(0.2)); };
  const boa = (d, c) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 1 }); for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); const a = i / 9 * TAU; p.position.set(Math.cos(a) * 0.38, 1.06 + 0.05 * Math.sin(i * 2), Math.sin(a) * 0.24); d.torso.add(p); } };
  const crown = d => { const g = new THREE.Group(); g.position.y = 0.34; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), gold); c.position.set(Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24); g.add(c); } g.add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 18), gold).rotateX(Math.PI / 2)); d.head.add(g); };
  const lineup = [
    [{ hat: true, eye: 0xff7a18 }, -8.5, 3, 1.1, 'bow', 0xff2f6a], [{ eye: 0x40ff9a }, -5.2, 5, 1.05, 'boa', 0xff5ad0], [{ hat: true, eye: 0xb450ff }, -1.8, 3.6, 1.12, 'bow', 0x40e0ff],
    [{ eye: 0xffd040 }, 1.8, 5.2, 1.05, 'boa', 0x40ffb0], [{ hat: true, eye: 0x40c8ff }, 5.4, 3.2, 1.1, 'bow', 0xffd040], [{ eye: 0xff2f6a }, 8.8, 4.8, 1.05, 'boa', 0xb450ff],
    [{ hat: true, eye: 0x40ff9a }, -11, -0.5, 1.0, 'bow', 0xff7a18], [{ eye: 0xffd040 }, -6.6, -1.2, 0.98, 'boa', 0x40ff9a], [{ hat: true, eye: 0xff7a18 }, 6.8, -1.2, 0.98, 'bow', 0xb450ff], [{ eye: 0xb450ff }, 11.2, -0.4, 1.0, 'boa', 0xff7a18],
    [{ hat: true, eye: 0x40ff9a }, -3.2, -2.6, 0.95, 'bow', 0xff2f6a], [{ eye: 0xff2f6a }, 3.3, -2.8, 0.95, 'boa', 0x40e0ff],
  ];
  lineup.forEach(([o, x, z, s, kind, col], i) => { const d = DK.skeleton(o); (kind === 'bow' ? bowTie : boa)(d, col); DK.place(d, x, z, s, (i * 0.29) % 1); });
  const king = DK.skeleton({ eye: 0xffd040 }); crown(king); boa(king, 0xb01030); DK.place(king, 0, -10.6, 1.45, 0.12); king.root.position.y = STAGE_Y;   // top step, dancing in front of the throne

  // ---- dust, embers, confetti, floor haze
  const embers = particles({ count: 120, seed: 21, box: [38, 14, 18], center: [0, 4, -4], color: 0xffa040, size: 0.14, dir: [0, 1, 0], travel: 10, sway: 1.1, opacity: 0.9, H: C.H, cycles: [1, 2] }); scene.add(embers);
  const cf = confetti(scene, { count: 110, box: [30, 16, 14], center: [0, 8, -3], colors: [0xff7a18, 0x40ff9a, 0xb450ff, 0xffd040], cyc: [1, 2], seed: 33 });
  const mist = haze(0x6a3a9a, 46, 0.2, [0, FLOOR + 1.2, -4]); scene.add(mist);
  const fill = new THREE.PointLight(0xffe0ff, 25, 0, 1.3); fill.position.set(0, 5, 9); scene.add(fill);
  const bg = bgClock(); camera.fov = 50; camera.updateProjectionMatrix();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t), A = TAU * t;
      DK.tick(t); floor.update(a, m); sign.update(m); rig.update(a, m); cf.update(t, k); embers.userData.u.uT.value = t;
      // chandelier: swells on the kick, swings, tiers counter-rotate, crystals follow bands, flames flicker
      const sw = 1 + 0.08 * k.kick + 0.05 * k.bass;
      chand.scale.set(0.85 * sw, 0.85 * (1 + 0.05 * k.kick), 0.85 * sw); chand.rotation.z = 0.05 * Math.sin(A) + 0.03 * k.snare * Math.sin(A * 8); chand.rotation.x = 0.04 * Math.sin(A * 2 + 1);
      chand.position.y = 8.6 + 0.3 * k.kick;
      tiers.forEach(({ g, dir, ti }) => { g.rotation.y = dir * A * (ti + 1) + dir * 0.4 * k.beat; });
      crystals.forEach(({ m: c, u }, i) => { const e = band(k.env, u); c.material.emissiveIntensity = 0.4 + 1.6 * e + 0.8 * k.kick; c.rotation.y = A * 2 + i; c.scale.y = 2.2 + 0.7 * band(k.hit, u); });
      flames.forEach(({ f, ph, k: fk }) => { const fl = 0.85 + 0.15 * Math.sin(A * 6 * fk + ph) + 0.1 * Math.sin(A * 12 + ph * 3); f.scale.set(0.7 * fl, 1.1 * (fl + 0.3 * k.hat), 1); f.material.opacity = 0.7 + 0.3 * fl; });
      chandGlow.material.opacity = 0.07 + 0.12 * k.kick; chandGlow.scale.setScalar(11 * (1 + 0.1 * k.kick));
      chandLight.intensity = 40 + 80 * k.kick;
      wins.forEach(({ glass, moon }, i) => { glass.material.color.setHex(0x3a50b0).multiplyScalar(0.7 + 0.5 * band(k.env, 0.2 + i * 0.2) + 0.4 * k.snare); moon.material.opacity = 0.2 + 0.12 * k.bass; });
      mist.material.opacity = 0.14 + 0.08 * k.bass; fill.intensity = 30 + 30 * k.snare;
      throne.rotation.y = 0.02 * Math.sin(A); plaque.group.position.y = 12.7 + 0.08 * k.kick;
      // camera: low and wide, drifting on a gentle figure-8, pushing in on the kick
      camera.position.set(2.4 * Math.sin(A), 2.6 + 0.35 * Math.sin(A * 2) + 0.1 * k.kick, 19.5 - 0.6 * k.kick); camera.lookAt(0.6 * Math.sin(A), 3.9, -6);
    },
  };
}
