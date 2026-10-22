import { THREE, TAU, extrudeText } from '../lib.js';
import { particles, haze, music, bgClock } from '../lib2.js';

// Flip Wall: you stand inside a curved LED wall whose panels flip in colour waves (a quarter-turn of hue per bar, landing on the beat).
// The event name floats in front on a dark band so it always reads; glowing rings and dust drift behind it. Background speed follows the Speed control.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x03010a);
  scene.fog = new THREE.FogExp2(0x03010a, 0.016);
  st.bloom.strength = 0.5; st.bloom.radius = 0.55; st.bloom.threshold = 0.85;

  // LED panel texture: dark bezel, bright rounded centre with a soft falloff; tinted per tile through material.color
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 66); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#d8d8d8'); gr.addColorStop(1, '#707070');
  g.fillStyle = gr; g.beginPath(); g.roundRect(10, 10, 108, 108, 14); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;

  const COLS = 21, ROWS = 9, S = 1.7, R = 16, ARC = 140 * Math.PI / 180;
  const geo = new THREE.PlaneGeometry(S * 0.94, S * 0.94), slab = new THREE.BoxGeometry(S * 0.94, S * 0.94, 0.2), body = new THREE.MeshBasicMaterial({ color: 0x07030f });
  const tiles = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const th = (c / (COLS - 1) - 0.5) * ARC;
    const outer = new THREE.Group(); outer.position.set(R * Math.sin(th), (r - (ROWS - 1) / 2) * S, -R * Math.cos(th)); outer.rotation.y = -th;
    const mf = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), mb = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const a = new THREE.Mesh(geo, mf), b = new THREE.Mesh(geo, mb); a.position.z = 0.11; b.position.z = -0.11; b.rotation.y = Math.PI;
    const pv = new THREE.Group(); pv.add(new THREE.Mesh(slab, body), a, b); outer.add(pv); scene.add(outer);
    tiles.push({ pv, mf, mb, c, r });
  }

  // ---- the name: bright face + dark outline, on a dark band that dims the wall behind it
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), edgeMat = new THREE.MeshBasicMaterial({ color: 0x05010a });
  const name = (C.event.title || 'ONE PARTY').toUpperCase();
  const face = extrudeText(C.fonts.block, name, { size: 3, track: 0.14, depth: 0.9, bevel: 0.06, targetWidth: 19, material: faceMat });
  const edge = extrudeText(C.fonts.block, name, { size: 3, track: 0.14, depth: 1.4, bevel: 0.45, targetWidth: 19.8, material: edgeMat }); edge.group.position.z = -1.7;   // outline sits wholly behind the face
  const band = new THREE.Mesh(new THREE.PlaneGeometry(40, 4.6), new THREE.MeshBasicMaterial({ color: 0x03010a, transparent: true, opacity: 0.78, depthWrite: false })); band.position.z = -1.4;
  const T = new THREE.Group(); T.add(band, edge.group, face.group); T.position.set(0, 0.3, -7); scene.add(T);

  // ---- background: orbiting glow rings + haze + dust
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(8.5 + i * 2.2, 0.07, 10, 128), new THREE.MeshBasicMaterial({ color: 0xff6a10, toneMapped: false }));
    m.position.set(0, 0.3, -11 - i * 0.5); scene.add(m); rings.push(m);
  }
  const hz = haze(0x7a2aff, 90, 0.07, [0, 0, -17]); scene.add(hz);
  const dust = particles({ count: 300, seed: 3, box: [34, 14, 22], center: [0, 0, -4], color: 0xffffff, size: 0.09, dir: [0, 1, 0], travel: 10, sway: 0.7, opacity: 0.7, H: C.H, cycles: [1, 2] });
  scene.add(dust);

  const clk = bgClock(), ease = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v), col = new THREE.Color();
  return {
    update(t) {
      const A = music(t), bg = clk(t), ab = TAU * bg;
      // A.hue steps a quarter turn per bar and lands on the (predicted) downbeat; A.anticipate swells just before each beat
      const h = (A.hue + 0.1 * A.mid) % 1;
      tiles.forEach(({ pv, mf, mb, c, r }) => {
        const x = bg * 2 - (c / COLS * 0.6 + r / ROWS * 0.3), f = ((x % 1) + 1) % 1, k = Math.floor(((x % 2) + 2) % 2);
        pv.rotation.y = (r % 2 ? -1 : 1) * Math.PI * (k + ease(f / 0.4));
        pv.position.z = Math.sin(Math.PI * Math.min(1, f / 0.4)) * 1.2;
        const glow = A.beat * (0.5 + 0.5 * Math.sin(c * 0.55 + r * 0.35 - ab * 2)) + 0.25 * A.anticipate;
        const grad = 0.14 * (c / COLS) + 0.06 * (r / ROWS);
        mf.color.copy(col.setHSL((h + grad) % 1, 0.9, 0.15 + 0.14 * glow + 0.06 * A.level));
        mb.color.copy(col.setHSL((h + 0.5 + grad) % 1, 0.9, 0.13 + 0.14 * glow + 0.06 * A.level));
      });
      faceMat.color.setHSL((h + 0.5) % 1, 1, 0.5 + 0.02 * A.beat);   // saturated complement of the wall, kept under the bloom threshold so the outline defines the letters
      T.position.y = 0.3 + 0.2 * Math.sin(ab); T.rotation.y = 0.08 * Math.sin(ab); T.scale.setScalar(1 + 0.05 * A.beat + 0.02 * A.anticipate);
      rings.forEach((m, i) => { m.rotation.x = 0.35 * Math.sin(ab + i * 2.1); m.rotation.y = 0.5 * Math.cos(ab + i); m.rotation.z = (i % 2 ? -1 : 1) * ab * 0.25; m.material.color.setHSL((h + 0.12 * i) % 1, 1, 0.55 + 0.15 * A.beat); m.scale.setScalar(1 + 0.08 * A.beat); });
      hz.material.color.setHSL(h, 0.8, 0.5); hz.material.opacity = 0.07 + 0.1 * A.bass;
      scene.fog.color.setHSL(h, 0.6, 0.02 + 0.02 * A.bass); scene.background.copy(scene.fog.color);
      camera.position.set(2.2 * Math.sin(ab * 0.5), 0.5 * Math.cos(ab * 0.5), 9.5 + 1.2 * Math.cos(ab * 0.5)); camera.lookAt(0, 0, -R);
      dust.userData.u.uT.value = ((bg % 1) + 1) % 1;
    },
  };
}
