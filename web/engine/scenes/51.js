import { THREE, TAU, rng } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Screen Tunnel: flying down a square tunnel lined with giant LED screens. Every wall segment and every big floating panel plays one of eight live
// animations (spectrum, ripples, marquee, warp grid, scope, sunburst, stripes, chant words) drawn from the music; a giant DAWGHOUSE hangs ahead.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x020106); scene.fog = new THREE.Fog(0x04020c, 40, 150);
  st.bloom.strength = 0.55; st.bloom.radius = 0.6; st.bloom.threshold = 0.85;
  const W = 17, H = 10, SEGL = 8, NSEG = 18, R = rng(51);
  const col = (h, l = 55, s = 100) => `hsl(${(((h % 1) + 1) % 1) * 360} ${s}% ${l}%)`;

  // ---- the shared "video": one canvas atlas, 4x2 channels of 256px, redrawn every frame
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const S = 256, WORDS = ['DANCE', 'PARTY', 'JUMP', 'HYPE'];
  const draw = [
    (a, k, hu, p) => { for (let i = 0; i < 16; i++) { const e = band(k.env, i / 15) * 0.85 + band(k.hit, i / 15) * 0.4, h = 12 + e * (S - 20); g.fillStyle = col(hu + i / 20); g.fillRect(i * 16 + 2, S - h, 12, h); g.fillStyle = '#fff'; g.fillRect(i * 16 + 2, S - h - 4, 12, 3); } },
    (a, k, hu, p) => { for (let i = 0; i < 6; i++) { const q = (((p / 4 + i / 6) % 1) + 1) % 1; g.strokeStyle = col(hu + q * 0.3); g.lineWidth = 3 + 9 * (1 - q) * (0.4 + k.kick); g.globalAlpha = 1 - q * 0.8; g.beginPath(); g.arc(S / 2, S / 2, q * S * 0.78, 0, TAU); g.stroke(); } g.globalAlpha = 1; },
    (a, k, hu, p) => { g.fillStyle = col(hu + 0.5, 20); g.fillRect(0, 0, S, S); g.font = '900 78px Arial Black, Arial, sans-serif'; g.textBaseline = 'middle'; const w = g.measureText('DAWGHOUSE ').width, o = ((p / 16) % 1) * w * 2; g.fillStyle = col(hu); for (let x = -w; x < S + w; x += w) g.fillText('DAWGHOUSE ', x - (o % w), 70); g.fillStyle = col(hu + 0.33); for (let x = -w; x < S + w; x += w) g.fillText('DAWGHOUSE ', x + (o % w) - w, 190); },
    (a, k, hu, p) => { g.strokeStyle = col(hu, 55); g.lineWidth = 3; const f = (p / 2) % 1; for (let i = 0; i <= 8; i++) { const x = ((i + f) / 8) * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); const y = ((i + f) / 8) * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); } g.fillStyle = col(hu + 0.5, 60); const c = 30 + 90 * k.kick; g.beginPath(); g.arc(S / 2, S / 2, c, 0, TAU); g.fill(); },
    (a, k, hu, p) => { for (let j = 0; j < 3; j++) { g.strokeStyle = col(hu + j * 0.15); g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= S; x += 4) { const y = S / 2 + Math.sin(x * 0.045 * (1 + j) + a * 6 + j) * (18 + 90 * band(k.env, 0.1 + j * 0.3)) * (0.5 + 0.5 * Math.sin(x * 0.02 + j)); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } },
    (a, k, hu, p) => { g.save(); g.translate(S / 2, S / 2); g.rotate(a * 2); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? col(hu, 55) : col(hu + 0.5, 25); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S, (i / 16) * TAU, ((i + 1) / 16) * TAU); g.fill(); } g.restore(); g.fillStyle = '#fff'; g.beginPath(); g.arc(S / 2, S / 2, 18 + 40 * k.kick, 0, TAU); g.fill(); },
    (a, k, hu, p) => { for (let i = -2; i < 10; i++) { g.fillStyle = col(hu + i * 0.09, i % 2 ? 55 : 22); const o = ((p / 2) % 1) * 48; g.beginPath(); g.moveTo(i * 48 + o, 0); g.lineTo(i * 48 + o + 24, 0); g.lineTo(i * 48 + o - 80, S); g.lineTo(i * 48 + o - 104, S); g.fill(); } },
    (a, k, hu, p) => { g.fillStyle = col(hu + 0.2, 18); g.fillRect(0, 0, S, S); const wd = WORDS[(Math.floor(p) % 4 + 4) % 4]; g.font = '900 64px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const f = 1 + 0.25 * k.kick; g.save(); g.translate(S / 2, S / 2); g.scale(f, f); g.lineWidth = 8; g.strokeStyle = col(hu); g.strokeText(wd, 0, 0); g.fillStyle = '#fff'; g.fillText(wd, 0, 0); g.restore(); },
  ];
  const paintAtlas = (a, k, hu, p) => { for (let c = 0; c < 8; c++) { g.save(); g.translate((c % 4) * S, Math.floor(c / 4) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); g.fillStyle = col(hu + c * 0.11 + 0.6, 12); g.fillRect(0, 0, S, S); g.globalAlpha = 1; draw[c](a, k, hu + c * 0.11, p); g.restore(); } tex.needsUpdate = true; };
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const remap = (geo, c) => { const uv = geo.attributes.uv, c0 = c % 4, r0 = Math.floor(c / 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, (c0 + 0.01 + uv.getX(i) * 0.98) / 4, 1 - (r0 + 1 - 0.01 - uv.getY(i) * 0.98 + 0) / 2 + 0 * 0); };
  // (uv v: canvas row r occupies v in [1-(r+1)/2, 1-r/2])
  const remap2 = (geo, c) => { const uv = geo.attributes.uv, c0 = c % 4, r0 = Math.floor(c / 4); for (let i = 0; i < uv.count; i++) uv.setXY(i, (c0 + 0.01 + uv.getX(i) * 0.98) / 4, 1 - (r0 + 1) / 2 + (0.01 + uv.getY(i) * 0.98) / 2); };

  // ---- walls: 4 sides x NSEG screen segments that stream toward the camera one slot per beat
  const segs = [];
  for (let w = 0; w < 4; w++) for (let i = 0; i < NSEG; i++) {
    const horiz = w < 2, geo = new THREE.PlaneGeometry(horiz ? W - 0.5 : H - 0.5, SEGL * 0.93); remap2(geo, (i + w * 3) % 8);
    const m = new THREE.Mesh(geo, mat);
    if (w === 0) { m.rotation.x = -Math.PI / 2; m.position.y = -H / 2; } else if (w === 1) { m.rotation.x = Math.PI / 2; m.position.y = H / 2; }
    else if (w === 2) { m.rotation.y = Math.PI / 2; m.position.x = -W / 2; } else { m.rotation.y = -Math.PI / 2; m.position.x = W / 2; }
    scene.add(m); segs.push({ m, i });
  }
  // corner rails
  const rails = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, NSEG * SEGL + 30), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); r.position.set(x * W / 2, y * H / 2, -(NSEG * SEGL) / 2 + 6); scene.add(r); return r.material; });
  // cross frames every other segment (the bezels between giant screens)
  const frames = []; for (let i = 0; i < NSEG; i += 1) { const fr = new THREE.Group(); const bx = new THREE.MeshBasicMaterial({ color: 0x120a22 }); for (const [w, h, x, y] of [[W + 0.6, 0.35, 0, H / 2], [W + 0.6, 0.35, 0, -H / 2], [0.35, H + 0.6, -W / 2, 0], [0.35, H + 0.6, W / 2, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), bx); b.position.set(x, y, 0); fr.add(b); } scene.add(fr); frames.push({ fr, i }); }

  // ---- giant floating screens that drift down the tunnel past the camera
  const panels = [0, 1, 2].map(i => { const geo = new THREE.PlaneGeometry(6.4, 3.6); remap2(geo, [7, 5, 0][i]); const m = new THREE.Mesh(geo, mat); const bez = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.0, 0.3), new THREE.MeshStandardMaterial({ color: 0x0c0818, metalness: 0.7, roughness: 0.4 })); bez.position.z = -0.2; const grp = new THREE.Group(); grp.add(bez, m); scene.add(grp); return { grp, i }; });

  // ---- star streaks + the hovering sign + end glow
  const NS = 220, streak = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 2.8), new THREE.MeshBasicMaterial({ color: 0xcfd8ff, toneMapped: false, transparent: true, opacity: 0.85 }), NS), sm = new THREE.Matrix4(), sp = new THREE.Vector3(), sq = new THREE.Quaternion(), ss = new THREE.Vector3();
  const SP_ = Array.from({ length: NS }, () => ({ x: (R() - 0.5) * (W - 1), y: (R() - 0.5) * (H - 1), z0: R() * NSEG * SEGL, v: [1, 2][Math.floor(R() * 2)] })); scene.add(streak);
  const sign = dawgSign(scene, C, { width: 13, pos: [0, 0, -46], size: 2.2, depth: 1.4, emis: 0xff2fa0, color: 0xffffff, hop: 1.0, glow: true });
  const endGlow = haze(0xff2fa0, 30, 0.35, [0, 0, -(NSEG * SEGL) + 8]); scene.add(endGlow);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), flow = ((p % 1) + 1) % 1;
      paintAtlas(a, k, hu, p);
      mat.color.setScalar(0.9 + 0.15 * k.kick);
      segs.forEach(({ m: mm, i }) => { mm.position.z = 4 - ((((i - p) % NSEG) + NSEG) % NSEG) * SEGL - SEGL / 2; });
      frames.forEach(({ fr, i }) => { fr.position.z = 4 - ((((i - p) % NSEG) + NSEG) % NSEG) * SEGL; });
      rails.forEach((mm, i) => { mm.color.copy(new THREE.Color().setHSL(((hu + i * 0.12) % 1 + 1) % 1, 1, 0.5)).multiplyScalar(0.5 + 0.9 * k.kick); });
      panels.forEach(({ grp, i }) => { const q = (((p / 4 + i / 3) % 1) + 1) % 1, z = 3 - q * (NSEG * SEGL * 0.9), side = i === 1 ? 1 : -1; grp.position.set(i === 2 ? 0 : side * 5.4, i === 2 ? 3.4 : (i ? -1.6 : 1.2) + 0.4 * Math.sin(a * 2 + i), z); grp.rotation.set(0.05 * Math.sin(a + i), -side * 0.2 + 0.1 * Math.sin(a * 2 + i), 0.05 * Math.cos(a + i)); grp.scale.setScalar(0.85 + 0.04 * k.kick); });
      SP_.forEach((o, i) => { const z = 4 - (NSEG * SEGL - (((o.z0 + p * SEGL * o.v * 0.7) % (NSEG * SEGL)))); sp.set(o.x, o.y, z); ss.set(1, 1, 1 + 0.8 * k.kick * o.v); sm.compose(sp, sq, ss); streak.setMatrixAt(i, sm); });
      streak.instanceMatrix.needsUpdate = true;
      sign.update(m); sign.group.position.y = 0.2 * Math.sin(a * 2); sign.mat.emissive.setHSL(((hu + 0.9) % 1 + 1) % 1, 1, 0.5); endGlow.material.opacity = 0.2 + 0.3 * k.kick;
      // camera: FOV punch on the kick, roll on the snare, slow sway
      camera.fov = 44 + 4 * k.kick; camera.updateProjectionMatrix();
      camera.position.set(0.5 * Math.sin(a) + 0.1 * k.kick * Math.sin(a * 37), 0.3 * Math.sin(a * 2) + 0.08 * k.kick * Math.cos(a * 29), 6);
      camera.lookAt(0.8 * Math.sin(a), 0.3 * Math.cos(a), -40); camera.rotateZ(0.06 * Math.sin(a * 2) + 0.12 * k.snare * Math.sin(a * 8));
    },
  };
}
