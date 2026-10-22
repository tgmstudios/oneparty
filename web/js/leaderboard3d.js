// Costume contest leaderboard as a live 3D haunted ballroom (lazy-loaded by leaderboard.js when the board first goes on).
// A podium of pillars (height = votes, revealed last place first), gallery frames with each costume's photo, dancing skeletons & friends
// (engine/dancers.js, read-only), spot beams, chandelier, bats, confetti + pyro on reveals. Music comes from window.oneAudio via engine music().
// Guest text only ever reaches the screen through canvas fillText; images through TextureLoader. Everything here is disposed when the board goes off.
import { THREE, TAU, makeStage } from '../engine/lib.js';
import { createKit } from '../engine/dancers.js';
import { music, haze } from '../engine/lib2.js';

const S = Math.sin, C = Math.cos, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const GOLD = 0xffc23a, MIN_H = 2.3, H0 = 2.3, H1 = 4.6;
const TRIM = ['#ffd23f', '#cfd6e6', '#d98a4a', '#a98bff'];
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
let cssDone = false;
function injectCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = '.bd-3d{position:absolute;inset:0;z-index:0}.bd-3d canvas{display:block}.b3d .bd-head,.b3d .bd-foot{position:relative;z-index:1}.b3d .bd-list{display:none}.b3d .bd-head{margin-bottom:0}.b3d .bd-t{font-size:5.6vh}.b3d .bd-k{font-size:1.8vh}.b3d .bd-s{font-size:2.2vh}.b3d .bd-foot{margin-top:auto}.b3d .bd-conf{z-index:2}';
  document.head.appendChild(s);
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function fit(g, text, max, size, weight = '800', min = 20) { do { g.font = `${weight} ${size}px system-ui,"Segoe UI",sans-serif`; if (g.measureText(text).width <= max) return; size -= 2; } while (size > min); }
function rounded(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

const plaqueTex = (row, rank, shown) => canvasTex(512, 256, (g, w, h) => {
  const col = TRIM[Math.min(3, (row?.rank ?? rank) - 1)] || TRIM[3];
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a1d3d'); bg.addColorStop(1, '#120a1c'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = shown ? col : '#6a5a80'; g.lineWidth = 8; rounded(g, 8, 8, w - 16, h - 16, 18); g.stroke();
  g.textBaseline = 'middle';
  g.fillStyle = shown ? col : '#8a7aa0'; g.textAlign = 'center'; g.font = '900 120px system-ui,sans-serif'; g.fillText(String(shown ? row.rank : rank), 84, 124);
  g.textAlign = 'left';
  if (!shown) { g.fillStyle = '#8a7aa0'; g.font = '900 70px system-ui,sans-serif'; g.fillText('? ? ?', 176, 120); return; }
  const cost = clean(row.costume, 60), name = clean(row.name, 40), W2 = 330;
  g.fillStyle = '#fff'; g.font = '800 60px system-ui,sans-serif';
  if (g.measureText(cost).width <= W2) { fit(g, cost, W2, 60); g.fillText(cost, 168, 78); }
  else {   // long costume names wrap to two lines instead of shrinking to nothing
    const words = cost.split(' '); let l1 = '', i = 0; while (i < words.length && (g.font = '800 44px system-ui,sans-serif', g.measureText((l1 + ' ' + words[i]).trim()).width <= W2)) l1 = (l1 + ' ' + words[i++]).trim();
    let l2 = words.slice(i).join(' '); if (!l1) { l1 = l2.slice(0, 16); l2 = l2.slice(16); }
    fit(g, l1, W2, 44, '800', 24); g.fillText(l1, 168, 58); fit(g, l2, W2, 44, '800', 24); g.fillText(l2, 168, 106);
  }
  g.fillStyle = '#cdbfe6'; fit(g, name, W2, 38, '600'); g.fillText(name, 168, 154);
  g.fillStyle = col; g.font = '900 54px system-ui,sans-serif'; g.fillText(row.votes + (row.votes === 1 ? ' vote' : ' votes'), 168, 212);
});
const mysteryTex = () => canvasTex(256, 256, (g, w, h) => {
  const bg = g.createRadialGradient(128, 110, 10, 128, 128, 180); bg.addColorStop(0, '#3a2358'); bg.addColorStop(1, '#0c0614'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#9a7acb'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 190px system-ui,sans-serif'; g.fillText('?', 128, 138);
});
const noPhotoTex = () => canvasTex(256, 256, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#3a1d58'); bg.addColorStop(1, '#ff6a10'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '130px system-ui,"Segoe UI Emoji",sans-serif'; g.fillText('🎭', 128, 140);
});
const gradAlpha = () => canvasTex(2, 64, (g, w, h) => { const l = g.createLinearGradient(0, 0, 0, h); l.addColorStop(0, '#fff'); l.addColorStop(1, '#262626'); g.fillStyle = l; g.fillRect(0, 0, w, h); });

export function createBoard3D(host, { onError } = {}) {
  injectCss();
  const wrap = document.createElement('div'); wrap.className = 'bd-3d'; host.insertBefore(wrap, host.firstChild);
  let W = host.clientWidth || innerWidth, Hh = host.clientHeight || innerHeight;
  const res = Math.min(1, 1080 / Hh);
  const st = makeStage(Math.round(W * res), Math.round(Hh * res), { host: wrap });
  const { scene, camera } = st;
  let dead = false, raf = 0, model = null, slots = [], first = true, lastT = performance.now(), winnerT = -1, kickPrev = 0;
  const accent = new THREE.Color((getComputedStyle(host).getPropertyValue('--accent') || '#ff6a10').trim() || '#ff6a10');
  const beamCols = [accent, new THREE.Color(0x9b6bff), new THREE.Color(0x30e0ff), new THREE.Color(0xff2fa0), new THREE.Color(0x46d37a)];

  // ---------- ballroom ----------
  scene.background = new THREE.Color(0x06030c); scene.fog = new THREE.FogExp2(0x0a0514, 0.014);
  st.bloom.strength = 0.55; st.bloom.radius = 0.6; st.bloom.threshold = 0.85;
  scene.add(new THREE.AmbientLight(0x5a3a8a, 0.7), new THREE.HemisphereLight(0xb8a0ff, 0x1a0c10, 0.5));
  const key = new THREE.DirectionalLight(0xffe0c0, 1.9); key.position.set(-6, 14, 20); scene.add(key);
  const rimL = new THREE.PointLight(0x9b6bff, 260, 0, 1.6); rimL.position.set(-14, 7, 6); const rimR = new THREE.PointLight(0xff6a10, 260, 0, 1.6); rimR.position.set(14, 7, 6); scene.add(rimL, rimR);

  const floorTex = canvasTex(256, 256, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) & 1 ? '#0c0814' : '#1b1228'; g.fillRect(x * 128, y * 128, 128, 128); g.strokeStyle = '#2d2040'; g.lineWidth = 3; g.strokeRect(x * 128, y * 128, 128, 128); } });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(15, 10);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(75, 50), mat(0xffffff, { map: floorTex, roughness: 0.22, metalness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); scene.add(floor);
  const wallTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#150d20'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d1230'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 16, h); g.fillStyle = '#26183c'; for (let y = 8; y < 128; y += 32) for (let x = 8; x < 128; x += 32) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(28, 12);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 38), mat(0xffffff, { map: wallTex, roughness: 0.9 })); wall.position.set(0, 19, -11); scene.add(wall);
  scene.add(box(90, 3.2, 0.5, mat(0x0e0814, { roughness: 0.4 }), 0, 1.6, -10.7), box(90, 0.25, 0.6, mat(GOLD, { metalness: 0.9, roughness: 0.3, emissive: 0x3a2400, emissiveIntensity: 0.6 }), 0, 3.3, -10.6));

  // arched moonlit windows
  const winShape = new THREE.Shape(); winShape.moveTo(-2, 0); winShape.lineTo(-2, 8); winShape.absarc(0, 8, 2, Math.PI, 0, true); winShape.lineTo(2, 0); winShape.closePath();
  const winGeo = new THREE.ShapeGeometry(winShape, 24), winMat = new THREE.MeshBasicMaterial({ color: 0x5a7cff, toneMapped: false, fog: false }), dark = mat(0x08050c, { roughness: 0.8 });
  const windows = [];
  for (const x of [-29, -18.5, 18.5, 29]) {
    const g = new THREE.Group(); g.position.set(x, 4, -10.4); g.add(new THREE.Mesh(winGeo, winMat));
    g.add(box(0.18, 11, 0.12, dark, 0, 5.5, 0.05), box(4.2, 0.18, 0.12, dark, 0, 5, 0.05), box(4.2, 0.18, 0.12, dark, 0, 8.4, 0.05));
    const hz = haze(0x6a8cff, 16, 0.22, [0, 6.5, 1.5]); g.add(hz); scene.add(g); windows.push({ g, hz });
  }
  // columns + velvet curtains
  for (const x of [-15.2, 15.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1, 30, 20), mat(0x20152e, { roughness: 0.35, metalness: 0.2 })); c.position.set(x, 15, -8); scene.add(c); scene.add(box(2.6, 0.5, 2.6, mat(GOLD, { metalness: 0.9, roughness: 0.3 }), x, 0.25, -8)); }
  const curtMat = mat(0x6a0e22, { roughness: 0.75, side: THREE.DoubleSide, emissive: 0x240006, emissiveIntensity: 0.6 }), curtains = [];
  for (const x of [-21, 21]) { const g = new THREE.PlaneGeometry(6, 30, 28, 1), p = g.attributes.position; g.userData.base = Float32Array.from(p.array); const m = new THREE.Mesh(g, curtMat); m.position.set(x, 15, -5.5); scene.add(m); curtains.push(m); }

  // chandelier (candle flames flicker; hangs high behind the winner)
  const chand = new THREE.Group(); chand.position.set(-9.5, 14.6, -4); chand.scale.setScalar(0.8); scene.add(chand); const chand2 = chand.clone(); chand2.position.x = 9.5; scene.add(chand2);
  const gold = mat(GOLD, { metalness: 0.95, roughness: 0.25, emissive: 0x3a2400, emissiveIntensity: 0.5 });
  chand.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 48), gold).rotateX(Math.PI / 2), new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 40), gold).rotateX(Math.PI / 2), box(0.1, 8, 0.1, gold, 0, 4.5, 0));
  const flames = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = i % 2 ? 2.6 : 1.5, f = haze(0xffb050, 1.1, 0.8, [C(a) * r, 0.6, S(a) * r]); chand.add(box(0.12, 0.5, 0.12, mat(0xf0e6c8), C(a) * r, 0.25, S(a) * r), f); flames.push(f); }

  // bats circling the chandelier
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.5, 0.5, 1, 0.1); wingShape.lineTo(0.7, -0.1); wingShape.lineTo(0.5, 0.05); wingShape.lineTo(0.25, -0.12); wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape), batM = new THREE.MeshBasicMaterial({ color: 0x07040b, side: THREE.DoubleSide });
  const bats = Array.from({ length: 12 }, (_, i) => { const g = new THREE.Group(), l = new THREE.Mesh(wingGeo, batM), r = new THREE.Mesh(wingGeo, batM); r.scale.x = -1; g.add(l, r, new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), batM)); g.scale.setScalar(0.9); scene.add(g); return { g, l, r, ph: i * 1.7, rad: 4 + (i % 4) * 2.4, h: 11 + (i % 3) * 1.6, sp: 0.35 + (i % 5) * 0.07 }; });

  // drifting embers/dust
  const NP = 220, pp = new Float32Array(NP * 3); for (let i = 0; i < NP; i++) { pp[i * 3] = (Math.random() - 0.5) * 50; pp[i * 3 + 1] = Math.random() * 16; pp[i * 3 + 2] = -10 + Math.random() * 22; }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: 0xffb070, size: 0.1, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); dust.frustumCulled = false; scene.add(dust);

  // ---------- dancers ----------
  const K = createKit(scene, { floorY: 0 });
  const back = [[K.skeleton({ eye: 0xff2fa0 }), -11.5], [K.pumpkin({ R: 1, face: 'grin' }), -8.6], [K.skeleton({ eye: 0x30e0ff, hat: true }), -5.8], [K.ghost({ tint: 0xd8e8ff }), -2.9], [K.zombie({ shirt: 0x6a2a6a }), 0], [K.mummy({ eye: 0x40ffd0 }), 2.9], [K.skeleton({ eye: 0x46d37a }), 5.8], [K.pumpkin({ R: 1, face: 'smile', hat: true }), 8.6], [K.skeleton({ eye: 0xffd040, hat: true }), 11.5]];
  back.forEach(([d, x], i) => K.place(d, x, -5.6 - (i % 2) * 0.9, 0.78, i * 0.37));
  const kinds = [() => K.skeleton({ hat: true, eye: 0xffd040 }), () => K.pumpkin({ R: 1, face: 'grin', hat: true }), () => K.ghost({ tint: 0xffd8f0, hat: true }), () => K.skeleton({ eye: 0xff2fa0 }), () => K.zombie({ shirt: 0x2a6a6a })];

  // ---------- particles: confetti + pyro sparks ----------
  const NC = 420, NSP = 320, tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();
  const mkPool = (n, geo, material, colors) => {
    const im = new THREE.InstancedMesh(geo, material, n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) { im.setColorAt(i, tmpC.set(colors[i % colors.length])); tmpM.compose(tmpP.set(0, -50, 0), tmpQ.identity(), tmpS.set(1e-4, 1e-4, 1e-4)); im.setMatrixAt(i, tmpM); }
    scene.add(im);
    return { im, n, i: 0, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n), life: new Float32Array(n), max: new Float32Array(n), sp: new Float32Array(n) };
  };
  const confetti = mkPool(NC, new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), [0xffd23f, 0xff6a10, 0xff3d81, 0x46d3ff, 0x9b6bff, 0x46d37a]);
  const sparks = mkPool(NSP, new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [0xffe08a, 0xffb040, 0xff7a20, 0xffffff]);
  const emit = (p, x, y, z, vx, vy, vz, life) => { const i = p.i++ % p.n; p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz; p.life[i] = p.max[i] = life; p.sp[i] = Math.random() * TAU; };
  const burstConfetti = (x, y, z, n, power = 1) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, u = Math.random(); emit(confetti, x, y, z, C(a) * (4 + 9 * u) * power, (9 + Math.random() * 11) * power, S(a) * (3 + 6 * u) * power + 2, 3.5 + Math.random() * 3); } };
  const fountain = (x, z, n, power = 1) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, u = Math.random() * 2.2; emit(sparks, x, 0.4, z, C(a) * u, (11 + Math.random() * 7) * power, S(a) * u, 0.9 + Math.random() * 0.9); } };
  function stepPools(dt, t) {
    for (let i = 0; i < NC; i++) {
      if (confetti.life[i] <= 0) { if (confetti.life[i] > -1) { confetti.life[i] = -2; tmpM.compose(tmpP.set(0, -50, 0), tmpQ.identity(), tmpS.set(1e-4, 1e-4, 1e-4)); confetti.im.setMatrixAt(i, tmpM); } continue; }
      confetti.life[i] -= dt; confetti.vy[i] -= 8 * dt; const drag = Math.exp(-dt * 0.9); confetti.vx[i] *= drag; confetti.vz[i] *= drag; if (confetti.vy[i] < -3.2) confetti.vy[i] = -3.2;
      confetti.x[i] += (confetti.vx[i] + S(t * 3 + confetti.sp[i]) * 0.8) * dt; confetti.y[i] += confetti.vy[i] * dt; confetti.z[i] += confetti.vz[i] * dt;
      if (confetti.y[i] < 0.05) { confetti.y[i] = 0.05; confetti.vy[i] = 0; confetti.vx[i] = confetti.vz[i] = 0; }
      tmpE.set(t * 6 + confetti.sp[i], t * 4 + confetti.sp[i] * 2, confetti.sp[i]); tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpP.set(confetti.x[i], confetti.y[i], confetti.z[i]), tmpQ, tmpS.setScalar(confetti.y[i] <= 0.06 ? 0.7 : 1)); confetti.im.setMatrixAt(i, tmpM);
    }
    for (let i = 0; i < NSP; i++) {
      if (sparks.life[i] <= 0) { if (sparks.life[i] > -1) { sparks.life[i] = -2; tmpM.compose(tmpP.set(0, -50, 0), tmpQ.identity(), tmpS.set(1e-4, 1e-4, 1e-4)); sparks.im.setMatrixAt(i, tmpM); } continue; }
      sparks.life[i] -= dt; sparks.vy[i] -= 15 * dt; sparks.x[i] += sparks.vx[i] * dt; sparks.y[i] += sparks.vy[i] * dt; sparks.z[i] += sparks.vz[i] * dt;
      if (sparks.y[i] < 0.1) { sparks.y[i] = 0.1; sparks.vy[i] *= -0.35; }
      const k = clamp(sparks.life[i] / sparks.max[i]); tmpM.compose(tmpP.set(sparks.x[i], sparks.y[i], sparks.z[i]), tmpQ.identity(), tmpS.setScalar(0.4 + 1.4 * k)); sparks.im.setMatrixAt(i, tmpM);
    }
    confetti.im.instanceMatrix.needsUpdate = true; sparks.im.instanceMatrix.needsUpdate = true;
  }
  // confetti cannons at the sides
  const cannons = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 14), mat(0x2a2236, { metalness: 0.7, roughness: 0.35 })); c.position.set(s * 15.5, 1.2, 3); c.rotation.z = -s * 0.5; scene.add(c); return c; });

  // ---------- podium slots ----------
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const beamAlpha = gradAlpha(), mystery = mysteryTex(), noPhoto = noPhotoTex();
  const pillarM = mat(0x2a1d3a, { roughness: 0.3, metalness: 0.25 }), trimM = () => mat(GOLD, { metalness: 0.95, roughness: 0.25, emissive: 0x4a2c00, emissiveIntensity: 0.6 });
  const crownGeo = (() => { const g = new THREE.Group(), m = mat(GOLD, { metalness: 1, roughness: 0.2, emissive: 0x6a4000, emissiveIntensity: 0.9 }); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.75, 0.5, 5, 1, true), m)); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.7, 6), m); c.position.set(C(a) * 0.82, 0.55, S(a) * 0.82); g.add(c); const j = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: [0xff2fa0, 0x30e0ff, 0x46d37a][i % 3], toneMapped: false })); j.position.set(C(a) * 0.82, 0.95, S(a) * 0.82); g.add(j); } return g; })();

  function buildSlot(i, n, x, k) {
    const group = new THREE.Group(); group.position.set(x, 0, 0); group.scale.setScalar(k); scene.add(group);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1, 2.4), pillarM), cap = box(4.4, 0.22, 2.8, trimM()), base = box(4.4, 0.3, 2.8, trimM(), 0, 0.15, 0);
    const plaqueMat = new THREE.MeshBasicMaterial({ map: mystery, toneMapped: false }), plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), plaqueMat); plaque.position.z = 1.22;
    group.add(shaft, cap, base, plaque);
    const win = i === 0, fs = win ? 1.28 : 1, frame = new THREE.Group(); frame.position.set(0, win ? 9.8 : 9.2, -8.2); frame.scale.setScalar(fs); group.add(frame);
    const photoMat = new THREE.MeshBasicMaterial({ map: mystery, toneMapped: false });
    frame.add(box(3.8, 3.8, 0.3, trimM()), box(3.3, 3.3, 0.34, dark), new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), photoMat).translateZ(0.19));
    const lamp = haze(0xffe0a0, 3.4, 0.0, [0, -2.2, 0.6]); frame.add(lamp);
    let crown = null; if (win) { crown = crownGeo.clone(); crown.position.set(0, 2.35, 0.1); crown.scale.setScalar(1.35); crown.visible = false; frame.add(crown); }
    const col = beamCols[i % beamCols.length];
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 17, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, alphaMap: beamAlpha, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    group.add(beam);
    const pool = haze(col, 7, 0, [0, 0.1, 0.3]); group.add(pool);
    const light = new THREE.PointLight(col, 0, 14, 1.6); light.position.set(0, 3, 4); group.add(light);
    const d = kinds[i % kinds.length](); K.place(d, x, 0, (win ? 0.95 : 0.7) * k, i * 0.23); d.root.visible = false;
    return { i, x, k, group, shaft, cap, base, plaque, plaqueMat, frame, photoMat, crown, beam, pool, light, lamp, d, base0: win ? 0.95 : 0.7, h: MIN_H, shown: 0, want: false, sig: '', photoUrl: undefined, photoTex: null, revealAt: -9, flash: 0 };
  }
  function disposeSlot(s) {
    scene.remove(s.group, s.d.root); K.cast.splice(K.cast.findIndex(c => c.d === s.d), 1);
    s.group.traverse(o => { o.geometry?.dispose?.(); if (o.material && o.material !== pillarM && o.material !== dark) { o.material.map && ![mystery, noPhoto, beamAlpha].includes(o.material.map) && o.material.map.dispose(); o.material.dispose(); } });
    s.photoTex?.dispose(); s.d.root.traverse(o => { /* shared kit geometry/materials are freed with the stage */ });
  }
  function setPhoto(s, url) {
    if (s.photoUrl === url) return; s.photoUrl = url; s.photoTex?.dispose(); s.photoTex = null;
    if (!url) { s.photoMat.map = noPhoto; s.photoMat.needsUpdate = true; return; }
    loader.load(url, tex => {
      if (dead || s.photoUrl !== url) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace; const a = tex.image.width / tex.image.height;   // cover-crop into the square frame
      if (a > 1) { tex.repeat.x = 1 / a; tex.offset.x = (1 - 1 / a) / 2; } else { tex.repeat.y = a; tex.offset.y = (1 - a) / 2; }
      s.photoTex = tex; s.photoMat.map = tex; s.photoMat.needsUpdate = true;
    }, undefined, () => { if (!dead && s.photoUrl === url) { s.photoMat.map = noPhoto; s.photoMat.needsUpdate = true; } });
  }
  function layout(n) {
    slots.forEach(disposeSlot); slots = [];
    const sp = n <= 5 ? 5.1 : Math.max(3.2, 27 / n), k = Math.min(1, sp / 5.1), order = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5];
    for (let i = 0; i < n; i++) slots.push(buildSlot(i, n, order[i] * sp, k));
  }
  function refresh(s, row, rank, shown) {   // redraw plaque/photo for what this slot should currently show
    const sig = shown ? [row.id, row.name, row.costume, row.image, row.votes, row.rank].join('|') : 'hidden';
    if (sig === s.sig) return; s.sig = sig;
    if (s.plaqueMat.map && s.plaqueMat.map !== mystery) s.plaqueMat.map.dispose();
    s.plaqueMat.map = plaqueTex(row, rank, shown); s.plaqueMat.needsUpdate = true;
    if (shown) setPhoto(s, row.image || null); else { s.photoUrl = undefined; s.photoTex?.dispose(); s.photoTex = null; s.photoMat.map = mystery; s.photoMat.needsUpdate = true; }
  }

  // ---------- model from leaderboard.js ----------
  function update(m) {
    model = m; const n = m.n;
    if (n !== slots.length) layout(n);
    const top = Math.max(1, ...m.rows.map(r => r.votes));
    slots.forEach((s, i) => {
      const shown = i >= n - m.revealed, row = m.rows[i];
      s.top = top; s.row = row; s.target = shown;
      refresh(s, row, i + 1, shown);
      if (shown && !s.want) {
        s.want = true;
        if (first) { s.shown = 1; s.h = H0 + (H1 - H0) * clamp(row.votes / top); s.revealAt = -9; }
        else { s.revealAt = performance.now() / 1000; s.flash = 1; fountain(s.x, 0, 90, 1.1); burstConfetti(s.x, 3, 1.5, i === 0 ? 0 : 45, 0.8); if (i === 0) winnerT = performance.now() / 1000; }
      } else if (!shown && s.want) { s.want = false; }
    });
    first = false;
    if (m.revealed < n) winnerT = -1;
  }

  // ---------- frame loop ----------
  const t0 = performance.now() / 1000;
  function frame() {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    try {
      const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - lastT) / 1000), sec = nowMs / 1000, el = sec - t0; lastT = nowMs;
      if (host.clientWidth && (host.clientWidth !== W || host.clientHeight !== Hh)) { W = host.clientWidth; Hh = host.clientHeight; const r = Math.min(1, 1080 / Hh); st.resize(Math.round(W * r), Math.round(Hh * r)); }
      const m = music(el / 12), ctx = K.tick(el / 12), kick = ctx.kick || 0, bass = ctx.bass || 0, env = ctx.env || [];
      // pillars: grow to their vote height with a little overshoot once revealed, sink back when hidden
      for (const s of slots) {
        const target = s.target && s.row ? H0 + (H1 - H0) * clamp(s.row.votes / s.top) : MIN_H;
        s.shown += ((s.target ? 1 : 0) - s.shown) * Math.min(1, dt * 3.2);
        const age = sec - s.revealAt, spring = s.target && age < 1.6 ? 0.28 * Math.exp(-age * 3.5) * S(age * 11) : 0;
        s.h += (target - s.h) * Math.min(1, dt * 4.5);
        const h = s.h + spring * s.h * 0.35;
        s.shaft.scale.y = h; s.shaft.position.y = h / 2; s.cap.position.y = h + 0.11; s.plaque.position.y = Math.max(1.1, h - 1.2);
        const sh = s.shown, win = s.i === 0, band = Math.min(15, Math.round(Math.abs(s.x) / 10.5 * 15)), lv = env[band] || 0;
        s.flash = Math.max(0, s.flash - dt * 1.2);
        s.cap.material.emissiveIntensity = 0.5 + sh * (0.7 + 1.4 * lv + 1.6 * s.flash); s.base.material.emissiveIntensity = 0.4 + sh * 0.6;
        s.beam.position.y = h + 8.4; s.beam.material.opacity = sh * (0.16 + 0.22 * lv + 0.16 * kick + 0.4 * s.flash + (win ? 0.08 : 0)); s.beam.rotation.z = S(el * 0.7 + s.i) * 0.04 * sh;
        s.pool.position.y = h + 0.3; s.pool.material.opacity = sh * (0.25 + 0.4 * lv + 0.4 * s.flash); s.light.position.y = h + 3; s.light.intensity = sh * (40 + 90 * lv + 260 * s.flash);
        s.lamp.material.opacity = sh * 0.3; s.frame.scale.setScalar((win ? 1.28 : 1) * (1 + (s.flash * 0.1)) * (0.92 + 0.08 * sh)); s.frame.position.y = (win ? 9.8 : 9.2) + 0.08 * S(el * 1.3 + s.i * 2) * sh;
        s.frame.rotation.z = 0.025 * S(el * 0.9 + s.i) * sh;
        if (s.crown) { s.crown.visible = sh > 0.5; s.crown.rotation.y = el * 1.2; s.crown.position.y = 2.35 + 0.1 * S(el * 3); }
        const dd = s.d.root; dd.visible = sh > 0.35; dd.position.set(s.x, h * s.k, 0); dd.scale.setScalar(s.base0 * s.k * (0.7 + 0.3 * ease(sh)));
      }
      // winner payoff: pyro fountains at both ends of the podium + a confetti rain while the camera pushes in
      const winSince = winnerT > 0 ? sec - winnerT : -1;
      if (winSince >= 0 && winSince < 5) { fountain(slots[0]?.x || 0, 0, 2, 1.2); if (Math.random() < 0.25) for (const c of cannons) burstConfetti(c.position.x, 2.4, 3, 6, 1.1); }
      if (winSince >= 0 && winSince < 0.15) for (const c of cannons) burstConfetti(c.position.x, 2.4, 3, 70, 1.25);
      if (winSince >= 5 && kick > 0.8 && kickPrev <= 0.8 && slots[0]) { fountain(slots[0].x, 0, 14, 0.8); burstConfetti(slots[0].x, 6, 1.5, 8, 0.7); }   // keeps celebrating on the kick
      kickPrev = kick;
      cannons.forEach((c, i) => c.scale.set(1, 1 - 0.18 * Math.exp(-Math.max(0, winSince) * 10), 1));
      stepPools(dt, el);
      // room: windows breathe with the bass, flames flicker, bats circle, curtains sway, camera drifts and kicks
      winMat.color.setRGB(0.25 + 0.2 * bass, 0.4 + 0.2 * bass, 1);
      windows.forEach((w, i) => { w.hz.material.opacity = 0.16 + 0.2 * bass + 0.05 * S(el * 0.8 + i); });
      flames.forEach((f, i) => { f.material.opacity = 0.65 + 0.25 * S(el * 11 + i * 3.1) + 0.15 * kick; f.scale.setScalar(1 + 0.15 * S(el * 9 + i)); });
      chand.rotation.y = el * 0.25; chand2.rotation.y = -el * 0.25; chand.position.y = chand2.position.y = 14.6 + 0.1 * S(el * 0.8);
      bats.forEach((b, i) => { const a = el * b.sp + b.ph; b.g.position.set(C(a) * b.rad * 1.5, b.h + S(a * 2.1) * 0.8, -3 + S(a) * b.rad * 0.5); b.g.rotation.y = -a + Math.PI / 2; const f = S(el * 14 + i) * 0.9; b.l.rotation.z = f; b.r.rotation.z = -f; });
      curtains.forEach((c, ci) => { const p = c.geometry.attributes.position, base = c.geometry.userData.base; for (let v = 0; v < p.count; v++) { const x = base[v * 3], y = base[v * 3 + 1]; p.setZ(v, S(x * 1.9 + y * 0.12 + el * 0.5 + ci) * (0.35 + 0.06 * bass) + S(x * 4.1) * 0.15); } p.needsUpdate = true; c.geometry.computeVertexNormals(); });
      const da = dust.geometry.attributes.position; for (let i = 0; i < NP; i++) { let y = da.array[i * 3 + 1] + dt * (0.3 + (i % 5) * 0.12); if (y > 16) y = 0; da.array[i * 3 + 1] = y; da.array[i * 3] += S(el * 0.5 + i) * dt * 0.3; } da.needsUpdate = true;
      rimL.intensity = 200 + 260 * kick; rimR.intensity = 200 + 260 * (ctx.snare || 0);
      const camZ = slots.length <= 3 ? 20.5 : slots.length === 4 ? 24 : 26;
      const push = winSince >= 0 ? ease(winSince / 2.5) : 0;
      camera.position.set(1.6 * S(el * 0.3) * (1 - push * 0.7), 7.4 + 0.25 * S(el * 0.5) - push * 0.5, camZ - 3.2 * push - 0.3 * kick); camera.lookAt(0, 6.7 + push * 0.4, 0);
      st.bloom.strength = 0.5 + 0.35 * bass + 0.25 * kick + 0.3 * (winSince >= 0 && winSince < 1.5 ? 1 - winSince / 1.5 : 0);
      st.composer.render();
    } catch (e) { dead = true; cancelAnimationFrame(raf); console.error('leaderboard3d:', e); try { dispose(); } catch { /* ignore */ } onError?.(e); }
  }
  raf = requestAnimationFrame(frame);

  function dispose() {
    dead = true; cancelAnimationFrame(raf);
    slots.forEach(s => { s.photoTex?.dispose(); }); slots = [];
    try { st.dispose(); } catch { /* ignore */ }
    wrap.remove();
  }
  return { update, dispose, get alive() { return !dead; } };
}
