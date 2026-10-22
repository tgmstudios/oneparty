import { THREE, TAU, rng, extrudeText } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { createKit } from '../dancers.js';
import { dawgSign, beams, ledWall, confetti, K, band } from '../pop-kit.js';

// Whiteout Night: Happy Valley under the lights. A stand full of fans in white flips a card stunt between WE ARE / PENN ST every bar, the wave rolls
// across the stands on the beat, a jumbotron answers the chant under a DAWGHOUSE crest, light towers sweep, and a monster halftime crew dances on the field.
export async function build(st, C) {
  const { scene, camera } = st;
  const NAVY = new THREE.Color(0x041e42), BLUE = new THREE.Color(0x96bee6), WHITE = new THREE.Color(0xffffff);
  scene.background = new THREE.Color(0x02060f); scene.fog = new THREE.FogExp2(0x040c1e, 0.012);
  st.bloom.strength = 0.55; st.bloom.radius = 0.6; st.bloom.threshold = 0.82;
  scene.add(new THREE.AmbientLight(0x6a80b0, 0.5));
  const FIELD = -3;

  // ---- field: dark turf, white yard lines, hash marks, navy end zone with the name in the paint
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ color: 0x0d3a2a, roughness: 0.95 })); turf.rotation.x = -Math.PI / 2; turf.position.set(0, FIELD, -8); scene.add(turf);
  const lineM = new THREE.MeshBasicMaterial({ color: 0xdfe8f5, toneMapped: false });
  for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.22), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, FIELD + 0.01, 12 - i * 4.2); scene.add(l); }
  for (const x of [-4, 4]) for (let i = 0; i < 16; i++) { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), lineM); h.rotation.x = -Math.PI / 2; h.position.set(x, FIELD + 0.01, 13 - i * 2.1); scene.add(h); }
  const ez = new THREE.Mesh(new THREE.PlaneGeometry(90, 7), new THREE.MeshStandardMaterial({ color: 0x082a66, roughness: 0.9 })); ez.rotation.x = -Math.PI / 2; ez.position.set(0, FIELD + 0.02, -21); scene.add(ez);
  const paint = extrudeText(C.fonts.block, 'PENN STATE', { size: 2, track: 0.2, depth: 0.1, bevel: 0.01, material: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), targetWidth: 30 });
  paint.group.rotation.x = -Math.PI / 2; paint.group.position.set(0, FIELD + 0.08, -21); scene.add(paint.group);

  // ---- card-stunt stand: white-out fans; the stunt text is sampled from a canvas into navy cards
  const COLS = 46, ROWS = 17, tc = document.createElement('canvas'); tc.width = COLS; tc.height = ROWS; const tg = tc.getContext('2d', { willReadFrequently: true });
  const mask = txt => { tg.clearRect(0, 0, COLS, ROWS); tg.fillStyle = '#fff'; tg.font = '900 100px Arial Black, Arial, sans-serif'; const fs = Math.max(6, Math.min(ROWS - 3, Math.floor(100 * (COLS - 4) / tg.measureText(txt).width))); tg.font = `900 ${fs}px Arial Black, Arial, sans-serif`; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(txt, COLS / 2, ROWS / 2 + 1); const d = tg.getImageData(0, 0, COLS, ROWS).data; return Array.from({ length: COLS * ROWS }, (_, i) => d[i * 4 + 3] > 110); };
  const stunts = [mask('WE ARE'), mask('PENN ST')]; let prevBar = -1, phrase = 0, lastBeatInBar = 0;
  const R = rng(5), jitter = Array.from({ length: COLS * ROWS }, () => R());
  const stand = ledWall(scene, { cols: COLS, rows: ROWS, cell: 0.92, pos: [0, 5.5, -26], rot: [-0.14, 0, 0], gap: 0.9 }, (q, r, u, v, out, a, k) => {
    const i = (ROWS - 1 - r) * COLS + q, on = stunts[curStunt][i], wave = 0.5 + 0.5 * Math.sin(q * 0.28 - a * 8 + v * 2), lift = 0.55 + 0.25 * wave + 0.35 * k.kick * (0.5 + jitter[i]) + 0.25 * band(k.hit, jitter[i]);
    if (on) out.copy(NAVY).lerp(BLUE, 0.25 + 0.3 * wave).multiplyScalar(0.5 + 1.6 * k.kick * 0.4 + 0.6 * wave); else { out.copy(WHITE).lerp(BLUE, 0.12 * jitter[i]).multiplyScalar(lift); if (r % 4 === 0) out.multiplyScalar(0.35).lerp(NAVY, 0.4); }
  });
  let curStunt = 0;
  // side stands (angled), plain whiteout waves
  const side = [-1, 1].map(s => ledWall(scene, { cols: 26, rows: 12, cell: 0.95, pos: [s * 29, 3.2, -14], rot: [-0.1, -s * 1.0, 0], gap: 0.78 }, (q, r, u, v, out, a, k) => { const w = 0.5 + 0.5 * Math.sin((s > 0 ? q : 25 - q) * 0.3 - a * 8); out.copy(WHITE).lerp(BLUE, 0.15).multiplyScalar(0.3 + 0.35 * w + 0.35 * k.snare); }));

  // ---- jumbotron under the DAWGHOUSE crest: chant board redrawn each bar
  const jc = document.createElement('canvas'); jc.width = 512; jc.height = 160; const jg = jc.getContext('2d');
  const jt = new THREE.CanvasTexture(jc); jt.colorSpace = THREE.SRGBColorSpace;
  const drawJ = i => { jg.fillStyle = '#041e42'; jg.fillRect(0, 0, 512, 160); jg.fillStyle = i ? '#96bee6' : '#ffffff'; for (let x = 0; x < 512; x += 32) jg.fillRect(x, 0, 14, 8), jg.fillRect(x + 16, 152, 14, 8); const txt = i ? 'PENN STATE!' : 'WE ARE!'; jg.font = '900 100px Arial Black, Arial, sans-serif'; jg.font = `900 ${Math.min(100, Math.floor(100 * 460 / jg.measureText(txt).width))}px Arial Black, Arial, sans-serif`; jg.textAlign = 'center'; jg.textBaseline = 'middle'; jg.fillStyle = '#fff'; jg.fillText(txt, 256, 84); jt.needsUpdate = true; };
  drawJ(0);
  const jumbo = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.7), new THREE.MeshBasicMaterial({ map: jt, toneMapped: false })); jumbo.position.set(0, 16.4, -25); scene.add(jumbo);
  const jframe = new THREE.Mesh(new THREE.BoxGeometry(15.8, 5.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x0a1426, metalness: 0.6, roughness: 0.5 })); jframe.position.set(0, 16.4, -25.4); scene.add(jframe);
  const sign = dawgSign(scene, C, { width: 15, pos: [0, 20.3, -24.6], size: 2, depth: 0.8, emis: 0x6aa0ff, color: 0xffffff, hop: 0.3, glow: false });

  // ---- light towers + sweeping beams
  const towers = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(s * 21, 0, -19); scene.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 20, 8), new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.7, roughness: 0.5 })).translateY(7));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x0c121e })); bar.position.y = 17.5; g.add(bar);
    const lamps = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); l.position.set(-1.7 + i * 1.13, 17.0 + j * 1.0, 0.26); g.add(l); lamps.push(l); }
    const glare = haze(0xcfe0ff, 9, 0.4, [s * 21, 17.5, -18.5]); scene.add(glare); return { lamps, glare };
  });
  const rig = beams(scene, [-1, 1].flatMap((s, i) => [0, 1].map(j => ({ color: j ? 0x96bee6 : 0xffffff, x: s * 21, y: 17.4, z: -18, len: 40, r: 0.9, sway: [0.35, 0.25], f: [1 + j, 2], ph: i * 1.7 + j, bz: -s * 0.55, bx: 0.15, kind: j ? 'snare' : 'kick' }))));

  // ---- halftime crew: monsters dancing on the field
  const DK = createKit(scene, { floorY: FIELD });
  // ghosts only: a white-sheet halftime crew in school colours (navy / carolina blue / white), some in top hats
  [[DK.ghost({ tint: 0xffffff, hat: true }), -7, 0.5], [DK.ghost({ tint: 0x96bee6 }), -3.6, 2], [DK.ghost({ tint: 0xffffff }), 0.2, 0.2], [DK.ghost({ tint: 0xcfe0ff, hat: true }), 3.8, 2], [DK.ghost({ tint: 0x6a92d0 }), 7, 0.5], [DK.ghost({ tint: 0xe8f0ff, hat: true, size: 0.9 }), -5.2, -3.5], [DK.ghost({ tint: 0xffffff, size: 0.9 }), 5.2, -3.5], [DK.ghost({ tint: 0x96bee6, hat: true, size: 0.8 }), -1.8, -4.5], [DK.ghost({ tint: 0xffffff, size: 0.8 }), 1.9, -4.2]].forEach(([d, x, z], i) => DK.place(d, x, z, 1.05, i * 0.37));
  const fl = new THREE.PointLight(0xdfe8ff, 80, 0, 1.4); fl.position.set(0, 9, 8); scene.add(fl);
  const cf = confetti(scene, { count: 220, box: [36, 18, 14], center: [0, 7, -2], colors: [0xffffff, 0x96bee6, 0x2a5aaa, 0xffffff], cyc: [1, 2], seed: 14 });
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), a = TAU * bg(t);
      // card stunt + jumbotron flip each bar (4 beats): live = count the bar wraps, baked/preview = from the loop position
      const live = typeof window !== 'undefined' && window.oneAudio, bib = (m.bar ?? 0) | 0;
      if (live) { if (bib < lastBeatInBar) phrase++; lastBeatInBar = bib; } else phrase = Math.floor(t * 4);
      if (phrase !== prevBar) { prevBar = phrase; curStunt = phrase % 2; drawJ(curStunt); }
      stand.update(a, m); side.forEach(s => s.update(a, m)); sign.update(m); rig.update(a, m); cf.update(t, k); DK.tick(t);
      towers.forEach(({ lamps, glare }, i) => { lamps.forEach((l, j) => l.material.color.setScalar(0.7 + 0.3 * ((j + i) % 2 ? k.kick : k.snare) + 0.2)); glare.material.opacity = 0.3 + 0.35 * k.kick; });
      jumbo.scale.setScalar(1 + 0.012 * k.kick); fl.intensity = 60 + 50 * k.kick;
      paint.group.children.forEach((c, i) => { c.position.z = 0.0; });
      camera.position.set(1.4 * Math.sin(TAU * t), 3.4 + 0.25 * Math.sin(TAU * t * 2) + 0.1 * k.kick, 18 - 0.4 * k.kick); camera.lookAt(0, 6.4, -16);
    },
  };
}
