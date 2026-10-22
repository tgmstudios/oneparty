import { THREE, TAU } from '../lib.js';
import { particles, haze, music, bgClock } from '../lib2.js';

// Split-Flap: a huge departure board flips the event name, flanked by corridors of flapping boards and a far back wall, camera drifting through.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x050200);
  scene.fog = new THREE.FogExp2(0x050200, 0.018);
  st.bloom.strength = 0.5; st.bloom.radius = 0.5; st.bloom.threshold = 0.88;

  const cache = new Map();
  const tex = (ch) => {
    const key = ch; if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160; const g = cv.getContext('2d');
    g.fillStyle = '#140a04'; g.fillRect(0, 0, 128, 160);
    g.fillStyle = '#fff'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 88);
    g.fillStyle = '#000'; g.fillRect(0, 78, 128, 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
  };
  const mats = [];   // every letter material: text is white in the texture, colour comes from material.color so music can hue-shift it
  const mat = (ch, fg, dim) => { const m = new THREE.MeshBasicMaterial({ map: tex(ch), toneMapped: false }); mats.push({ m, fg: fg === '#ffa030' ? 0xffa030 : 0xff3fa0, dim: (dim & 255) / 255 }); return m; };
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x0a0502 });

  // generic board: group of flipping tiles, front/back letters per tile; returns tiles with delay
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  function board(cols, rows, S, fronts, backs, dim, fx) {
    const g = new THREE.Group(), tiles = [];
    const geo = new THREE.PlaneGeometry(S * 0.9, S * 1.12), slab = new THREE.BoxGeometry(S * 0.9, S * 1.12, 0.14);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const A = fronts(r, c), B = backs(r, c);
      const front = new THREE.Mesh(geo, mat(A, '#ffa030', dim)), back = new THREE.Mesh(geo, mat(B, '#ff3fa0', dim));
      front.position.z = 0.075; back.position.z = -0.075; back.rotation.x = Math.PI;
      const pv = new THREE.Group(); pv.add(new THREE.Mesh(slab, bodyMat), front, back);
      pv.position.set((c - (cols - 1) / 2) * S, ((rows - 1) / 2 - r) * S * 1.25, 0); g.add(pv);
      tiles.push({ pv, d: fx(r, c) });
    }
    scene.add(g); return { g, tiles };
  }
  const pad = (s, n) => { s = s.slice(0, n); const l = Math.floor((n - s.length) / 2); return ' '.repeat(l) + s + ' '.repeat(n - s.length - l); };
  const COLS = 12, rows = [[C.event.title.toUpperCase(), 'DAWG ON'], ['TRICK', 'OR TREAT'], [(C.event.subtitle || 'PARTY').toUpperCase(), 'NIGHT']];
  const P = rows.map(([a, b]) => [pad(a, COLS), pad(b, COLS)]);
  const main = board(COLS, 3, 1.75, (r, c) => P[r][0][c], (r, c) => P[r][1][c], 0xffffff, (r, c) => c / COLS * 0.25 + r * 0.07);
  const rl = () => LET[Math.floor(rnd() * LET.length)];
  const left = board(10, 6, 1.7, rl, rl, 0x777777, (r, c) => rnd() * 0.9);
  const right = board(10, 6, 1.7, rl, rl, 0x777777, (r, c) => rnd() * 0.9);
  left.g.position.set(-24, 0, -4); left.g.rotation.y = 1.0;
  right.g.position.set(24, 0, -4); right.g.rotation.y = -1.0;
  const back = board(26, 9, 1.7, rl, rl, 0x444444, (r, c) => (c / 26) * 0.5 + (r / 9) * 0.3);
  back.g.position.set(0, 0, -26); back.g.scale.setScalar(1.35);
  // flap floor + ceiling glow strips for depth
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xff6a10, toneMapped: false });
  const strip = (y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.25), stripMat); m.position.set(0, y, -10); scene.add(m); };
  strip(-6.4); strip(6.4);
  const dust = particles({ count: 260, seed: 5, box: [40, 14, 30], center: [0, 0, -6], color: 0xffb060, size: 0.09, dir: [0, 1, 0], travel: 10, sway: 0.6, opacity: 0.8, H: C.H, cycles: [1, 2] });
  scene.add(dust);

  const hz = haze(0xff6a10, 80, 0.08, [0, 0, -20]); scene.add(hz);
  const clk = bgClock();   // side/back boards, camera and dust run on the Speed-controlled clock; the main board stays on the loop
  const ease = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  const run = (b, t, lift) => b.tiles.forEach(({ pv, d }) => {
    const x = t * 2 - d, f = ((x % 1) + 1) % 1, k = Math.floor(((x % 2) + 2) % 2), u = ease((f - 0.5) / 0.5);
    pv.rotation.x = -Math.PI * (k + u); pv.position.z = lift * Math.sin(Math.PI * u);
  });
  return {
    update(t) {
      const a = TAU * t, bg = clk(t), ab = TAU * bg;
      // music -> colour: mids/beat spin the board's colours round the wheel; beat flashes brighten and bass pushes the boards forward
      // A.hue steps a quarter turn per bar and lands exactly on the (predicted) downbeat; A.anticipate swells just before each beat
      const A = music(t), h = (A.hue + 0.12 * A.mid + 0.03 * A.beat) % 1, lift = 1 + 0.5 * A.beat;
      mats.forEach(({ m, fg, dim }) => m.color.setHex(fg).offsetHSL(h, 0, 0.1 * A.beat).multiplyScalar(dim));
      stripMat.color.setHex(0xff6a10).offsetHSL(h, 0, 0.15 * A.beat);
      hz.material.color?.setHex(0xff6a10).offsetHSL(h, 0, 0); hz.material.opacity = 0.08 + 0.1 * A.bass;
      main.g.scale.setScalar(1 + 0.05 * A.beat + 0.02 * A.anticipate);
      run(main, t, 1.2); run(left, bg, 1.0); run(right, bg, 1.0); run(back, bg, 1.5);
      camera.position.set(3 * Math.sin(ab), 0.8 * Math.cos(ab), 17 + 1.5 * Math.cos(ab)); camera.lookAt(0, 0, -2);
      dust.userData.u.uT.value = ((bg % 1) + 1) % 1;
    },
  };
}
