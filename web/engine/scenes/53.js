import { THREE, TAU, rng, makeEnv } from '../lib.js';
import { haze, music, skyGradient, bgClock } from '../lib2.js';
import { dawgSign, confetti, K, band } from '../pop-kit.js';

// Pinball Frenzy: the whole screen is one neon pinball machine. Chrome balls roll round the table, bumpers flash when a ball touches them (and on the
// drums), flippers snap on the snare, the insert lights chase on the beat, the score ticks up, and DAWGHOUSE stands lit on the backbox.
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x05030c); scene.fog = new THREE.FogExp2(0x0a0418, 0.012);
  st.bloom.strength = 0.55; st.bloom.radius = 0.7; st.bloom.threshold = 0.82;
  scene.environment = makeEnv(renderer, [{ w: 30, h: 6, c: 0xff4aa8, i: 2.2, pos: [0, 12, 8] }, { w: 6, h: 24, c: 0x40c8ff, i: 2.6, pos: [-14, 0, 4] }, { w: 6, h: 24, c: 0xffd060, i: 1.6, pos: [14, 0, 4] }, { w: 30, h: 8, c: 0x2a1a5a, i: 0.8, pos: [0, -10, 6] }], 0x05030c);
  scene.environmentIntensity = 1.2;
  scene.add(new THREE.AmbientLight(0x6a4a9a, 0.55));
  const backdrop = skyGradient([[0, '#3a0e5a'], [0.45, '#180a42'], [1, '#05030c']], -45, 220, 130); scene.add(backdrop);
  const halo = Array.from({ length: 7 }, (_, i) => { const m = new THREE.MeshBasicMaterial({ color: 0xff3fa0, toneMapped: false, transparent: true, opacity: 0.8 }); const r = new THREE.Mesh(new THREE.TorusGeometry(9 + i * 3.2, 0.13, 6, 80), m); r.position.set(0, 7, -22 - i * 1.2); scene.add(r); return { r, m, i }; });
  const cf = confetti(scene, { count: 150, box: [44, 22, 16], center: [0, 6, 2], colors: [0xff3fa0, 0x30d0ff, 0xffd040, 0xb060ff], size: 0.3, seed: 8, cyc: [1, 2] });
  const R = rng(53), hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  const TW = 14, TL = 22;

  // ---- table (tilted group, local x across / y up-table / z up from the playfield)
  const table = new THREE.Group(); table.position.set(0, -3.2, 2); table.rotation.x = -1.05; scene.add(table);
  const pc = document.createElement('canvas'); pc.width = 560; pc.height = 880; const pg = pc.getContext('2d');
  const bgG = pg.createLinearGradient(0, 0, 0, 880); bgG.addColorStop(0, '#2a0a4a'); bgG.addColorStop(0.5, '#10104a'); bgG.addColorStop(1, '#2a0840'); pg.fillStyle = bgG; pg.fillRect(0, 0, 560, 880);
  pg.lineWidth = 5; for (let i = 0; i < 9; i++) { pg.strokeStyle = `hsla(${300 + i * 12} 100% 60% / 0.55)`; pg.beginPath(); pg.arc(280, 300, 40 + i * 34, 0, TAU); pg.stroke(); }
  pg.strokeStyle = 'rgba(80,220,255,0.7)'; pg.lineWidth = 6; for (const x of [80, 480]) { pg.beginPath(); pg.moveTo(x, 520); pg.lineTo(x, 700); pg.stroke(); }
  pg.fillStyle = 'rgba(255,208,64,0.85)'; for (let i = 0; i < 5; i++) { const x = 280, y = 760 - i * 38; pg.beginPath(); pg.moveTo(x - 36, y); pg.lineTo(x, y - 24); pg.lineTo(x + 36, y); pg.lineTo(x + 26, y + 6); pg.lineTo(x, y - 12); pg.lineTo(x - 26, y + 6); pg.fill(); }
  pg.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 40; i++) { pg.beginPath(); pg.arc(R() * 560, R() * 880, 1 + R() * 2, 0, TAU); pg.fill(); }
  const pTex = new THREE.CanvasTexture(pc); pTex.colorSpace = THREE.SRGBColorSpace; pTex.anisotropy = 8;
  table.add(new THREE.Mesh(new THREE.PlaneGeometry(TW, TL), new THREE.MeshBasicMaterial({ map: pTex, toneMapped: false })));
  const rail = new THREE.MeshStandardMaterial({ color: 0xd0d4e4, metalness: 1, roughness: 0.25 });
  for (const x of [-TW / 2 - 0.3, TW / 2 + 0.3]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, TL + 1.2, 1.1), rail); r.position.set(x, 0, 0.55); table.add(r); }
  const topR = new THREE.Mesh(new THREE.BoxGeometry(TW + 1.2, 0.6, 1.1), rail); topR.position.set(0, TL / 2 + 0.3, 0.55); table.add(topR);
  const strips = [-1, 1].map(s => { const m = new THREE.MeshBasicMaterial({ color: 0xff3fa0, toneMapped: false }); const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, TL, 0.12), m); l.position.set(s * (TW / 2 - 0.1), 0, 1.15); table.add(l); return m; });

  // ---- bumpers
  const bumpers = [[-2.7, 5.2], [2.7, 5.2], [0, 8.2], [0, 2.8], [-4.8, 1.0], [4.8, 1.0]].map(([x, y], i) => {
    const g = new THREE.Group(); g.position.set(x, y, 0); const col = hue(0.9 - i * 0.14);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.5, 24), rail); base.rotation.x = Math.PI / 2; base.position.z = 0.25; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); ring.position.z = 0.55; g.add(ring);
    const capM = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.3 }); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 20), capM); cap.rotation.x = Math.PI / 2; cap.position.z = 0.75; g.add(cap);
    const gl = haze(col, 4.2, 0.2, [0, 0, 1.2]); g.add(gl); table.add(g); return { g, capM, ring, gl, x, y, i, pop: 0 };
  });
  // slingshots + flippers
  const sling = [-1, 1].map(s => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 1.9, -1.2); sh.lineTo(s * 0.5, -3.4); sh.closePath(); const m = new THREE.MeshStandardMaterial({ color: 0x3a0a60, emissive: 0xff3fa0, emissiveIntensity: 0.3 }); const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), m); mesh.position.set(s * 4.5, -4.2, 0); table.add(mesh); return m; });
  const flippers = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 2.3, -8.2, 0.3); const shape = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.62, 0.55), new THREE.MeshStandardMaterial({ color: 0xff3fa0, emissive: 0xff3fa0, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.3 })); shape.position.x = -s * 1.45; g.add(shape); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 14), rail); hub.rotation.x = Math.PI / 2; g.add(hub); table.add(g); return { g, s, mat: shape.material }; });

  // ---- inserts: rows of lights that chase on the beat
  const NI = 28, ins = new THREE.InstancedMesh(new THREE.CircleGeometry(0.22, 14), new THREE.MeshBasicMaterial({ toneMapped: false }), NI), im = new THREE.Matrix4(), ip = [];
  for (let i = 0; i < NI; i++) { const side = i < 14 ? -1 : 1, j = i % 14; const x = side * (TW / 2 - 1.2 + (j % 2) * 0.0), y = -6 + j * 1.25; im.setPosition(x, y, 0.02); ins.setMatrixAt(i, im); ins.setColorAt(i, new THREE.Color(1, 1, 1)); ip.push(j); }
  table.add(ins); const ic = new THREE.Color();

  // ---- balls (chrome) following looping paths over the playfield
  const balls = [0, 1, 2].map(i => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 })); table.add(b); const gl = haze(0xffffff, 2.2, 0.3, [0, 0, 0]); table.add(gl); return { b, gl, i, f1: [1, 2, 3][i], f2: [3, 2, 1][i] + (i === 1 ? 1 : 0), ph: i * 0.31, x: 0, y: 0 }; });

  // ---- backbox: backglass art, lit DAWGHOUSE letters, and a live score display
  const back = new THREE.Group(); back.position.set(0, 7.8, -8.2); scene.add(back);
  const bc = document.createElement('canvas'); bc.width = 1120; bc.height = 640; const bgc = bc.getContext('2d');
  const rg = bgc.createRadialGradient(560, 280, 40, 560, 280, 640); rg.addColorStop(0, '#6a1a8a'); rg.addColorStop(0.6, '#1a0a4a'); rg.addColorStop(1, '#05030c'); bgc.fillStyle = rg; bgc.fillRect(0, 0, 1120, 640);
  for (let i = 0; i < 24; i++) { bgc.fillStyle = `hsla(${300 + i * 7} 100% 60% / 0.12)`; bgc.beginPath(); bgc.moveTo(560, 330); bgc.arc(560, 330, 900, (i / 24) * TAU, ((i + 0.5) / 24) * TAU); bgc.fill(); }
  bgc.strokeStyle = '#ff3fa0'; bgc.lineWidth = 14; bgc.strokeRect(14, 14, 1092, 612); bgc.strokeStyle = '#30d0ff'; bgc.lineWidth = 6; bgc.strokeRect(34, 34, 1052, 572);
  const bTex = new THREE.CanvasTexture(bc); bTex.colorSpace = THREE.SRGBColorSpace;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(15, 8.6), new THREE.MeshBasicMaterial({ map: bTex, toneMapped: false })); back.add(glass);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(15.8, 9.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x15102a, metalness: 0.5, roughness: 0.5 })); cabinet.position.z = -0.5; back.add(cabinet);
  const sign = dawgSign(back, C, { width: 11.5, pos: [0, 1.0, 0.7], size: 2.2, depth: 0.9, emis: 0xff8a20, color: 0xffd890, hop: 0.5, glow: false });
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96; const sg = sc.getContext('2d'); const sTex = new THREE.CanvasTexture(sc); sTex.colorSpace = THREE.SRGBColorSpace;
  const scoreM = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.54), new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false })); scoreM.position.set(0, -2.9, 0.2); back.add(scoreM);
  let lastScore = -1;
  const l1 = new THREE.PointLight(0xff3fa0, 90, 0, 1.4); l1.position.set(-8, 9, 8); const l2 = new THREE.PointLight(0x30d0ff, 80, 0, 1.4); l2.position.set(8, 9, 8); scene.add(l1, l2);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, hu = m.hue ?? 0.25 * Math.floor(t * 4), p = u * 16;
      // balls
      balls.forEach(b => { b.x = 5.2 * Math.sin(TAU * (t * b.f1 + b.ph)); b.y = 1.0 + 7.6 * Math.sin(TAU * (t * b.f2 + b.ph * 1.7)); b.b.position.set(b.x, b.y, 0.5); b.b.rotation.set(a * 2, a * 3, 0); b.gl.position.set(b.x, b.y, 0.9); b.gl.material.opacity = 0.2 + 0.3 * k.hat; });
      // bumpers light up when a ball is within reach, and on their own drum
      bumpers.forEach(bp => {
        let near = 0; balls.forEach(b => { const d = Math.hypot(b.x - bp.x, b.y - bp.y); near = Math.max(near, Math.max(0, 1 - d / 2.1)); });
        const drum = [k.kick, k.snare, k.hat, k.beat, k.kick, k.snare][bp.i], v = Math.min(1, near * 1.3 + drum * 0.8);
        bp.capM.emissiveIntensity = 0.35 + 1.3 * v; bp.ring.scale.setScalar(1 + 0.18 * v); bp.g.scale.setScalar(1 + 0.12 * v); bp.gl.material.opacity = 0.06 + 0.28 * v; bp.ring.material.color.copy(hue(hu + bp.i * 0.13, 0.5 + 0.2 * v));
      });
      flippers.forEach(f => { f.g.rotation.z = f.s * (-0.5 + 0.95 * Math.min(1, k.snare * 1.4 + 0.5 * k.kick)); f.mat.emissiveIntensity = 0.3 + 1.0 * k.snare; });
      sling.forEach((mm, i) => mm.emissiveIntensity = 0.25 + 1.2 * (i ? k.kick : k.snare));
      strips.forEach((mm, i) => mm.color.copy(hue(hu + i * 0.5, 0.5)).multiplyScalar(0.5 + 0.9 * k.kick));
      // inserts chase up the lanes one step per half beat
      for (let i = 0; i < NI; i++) { const j = ip[i], on = Math.max(0, 1 - Math.abs((((j - p * 2) % 14) + 14) % 14) / 3); ins.setColorAt(i, ic.copy(hue(hu + j * 0.04, 0.5)).multiplyScalar(0.12 + 1.3 * on)); }
      ins.instanceColor.needsUpdate = true;
      // score: +1250 each beat, wraps with the loop
      const sc2 = Math.floor(p) * 1250 + 90000;
      if (sc2 !== lastScore) { lastScore = sc2; sg.fillStyle = '#10020c'; sg.fillRect(0, 0, 512, 96); sg.font = '900 72px "Courier New", monospace'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#ff7a30'; sg.fillText(String(sc2).padStart(8, '0'), 256, 50); sTex.needsUpdate = true; }
      cf.update(t, k); halo.forEach(({ r, m: mm, i }) => { r.rotation.z = a * (i % 2 ? 1 : -1) * 0.5; r.scale.setScalar(1 + 0.03 * k.kick * (i + 1)); mm.color.copy(hue(hu + i * 0.09, 0.55)).multiplyScalar(0.4 + 0.8 * (i % 2 ? k.snare : k.kick)); });
      sign.update(m); l1.intensity = 70 + 70 * k.kick; l2.intensity = 60 + 70 * k.snare;
      table.position.y = -3.2 + 0.08 * k.kick * Math.sin(a * 30); table.rotation.z = 0.01 * Math.sin(a * 2) * 0 + 0.006 * k.kick;
      camera.position.set(1.8 * Math.sin(a), 7.6 + 0.4 * Math.sin(a * 2) + 0.1 * k.kick, 31); camera.lookAt(0, -0.6, 0);
    },
  };
}
