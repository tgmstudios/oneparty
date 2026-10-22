import { THREE, TAU, extrudeText } from '../lib.js';
import { particles, haze, music, bgClock } from '../lib2.js';

// Backflip Dawg: huge lit 3D letters backflip in a wave inside a rushing ring tunnel, over a flipping tile floor, with tumbling cubes behind.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x070100);
  scene.fog = new THREE.FogExp2(0x070100, 0.022);
  st.bloom.strength = 0.45; st.bloom.radius = 0.5; st.bloom.threshold = 0.9;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const l1 = new THREE.PointLight(0xff6a10, 160, 0, 1.6); l1.position.set(-12, 7, 9); scene.add(l1);
  const l2 = new THREE.PointLight(0xff3fa0, 160, 0, 1.6); l2.position.set(12, 7, 9); scene.add(l2);
  const l3 = new THREE.PointLight(0x8a2bff, 120, 0, 1.4); l3.position.set(0, 2, -6); scene.add(l3);

  // ---- letters (tall, thick, lit)
  const text = C.event.title.toUpperCase();
  const cols = [0xff6a10, 0xff3fa0, 0xffb040, 0x9a4bff];
  const letters = []; let x = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') { x += 1.2; continue; }
    const mat = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], emissive: cols[i % cols.length], emissiveIntensity: 0.2, metalness: 0.2, roughness: 0.3 });
    const e = extrudeText(C.fonts.block, ch, { size: 3, track: 0, depth: 1.4, bevel: 0.1, material: mat });
    const box = new THREE.Box3().setFromObject(e.group); const w = box.max.x - box.min.x;
    const pivot = new THREE.Group(); e.group.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
    pivot.add(e.group); pivot.position.x = x + w / 2; x += w + 0.45;
    scene.add(pivot); letters.push({ pivot, mat, base: cols[i % cols.length] });
  }
  const total = x - 0.45, s = 25 / total;
  letters.forEach(l => { l.pivot.position.x = (l.pivot.position.x - total / 2) * s; l.pivot.scale.set(s, s * 1.7, s); l.pivot.position.y = 0.6; });

  // ---- flipping tile floor, receding to the horizon
  const FC = 26, FR = 26, FS = 2;
  const floor = new THREE.Group(); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.4; scene.add(floor);
  const fgeo = new THREE.PlaneGeometry(FS * 0.94, FS * 0.94);
  const fA = new THREE.MeshBasicMaterial({ color: 0xa8380a, toneMapped: false }), fB = new THREE.MeshBasicMaterial({ color: 0x5a1a9a, toneMapped: false });
  const ftiles = [];
  for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) {
    const pv = new THREE.Group(), a = new THREE.Mesh(fgeo, fA), b = new THREE.Mesh(fgeo, fB); b.rotation.x = Math.PI; pv.add(a, b);
    pv.position.set((c - (FC - 1) / 2) * FS, -(r * FS) + 8, 0); floor.add(pv); ftiles.push({ pv, c, r });
  }

  // ---- ring tunnel of lights rushing at the camera (equally spaced => seamless)
  const NR = 8, NB = 14, rings = [];
  const ringBase = [0xff8a2a, 0xff3fa0], ringMats = ringBase.map(c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  const tint = (col, base, h, l = 0) => col.setHex(base).offsetHSL(h, 0, l);   // hue-rotate a base colour
  const bgeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  for (let i = 0; i < NR; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < NB; j++) {
      const m = new THREE.Mesh(bgeo, ringMats[j % 2]);
      const a = (j / NB) * TAU; m.position.set(Math.cos(a) * 15, Math.sin(a) * 9.5, 0); m.scale.set(1, 1, 4); g.add(m);
    }
    scene.add(g); rings.push(g);
  }

  // ---- tumbling cubes in the back
  const cubes = [], cg = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 34; i++) {
    const k = i * 7.13, hue = [0xff6a10, 0xff3fa0, 0x8a2bff][i % 3];
    const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.35 }));
    const sc = 0.8 + (i % 5) * 0.45; m.scale.setScalar(sc);
    const px = ((k * 3.7) % 50) - 25, py = ((k * 1.9) % 12) - 1, pz = -8 - ((k * 2.3) % 30);
    cubes.push({ m, sc, px, py, pz, ax: 1 + (i % 2), ay: 1 + ((i >> 1) % 2), ph: k });
    m.position.set(px, py, pz); scene.add(m);
  }
  scene.add(haze(0xa3195b, 70, 0.1, [0, 2, -20]));
  const embers = particles({ count: 260, seed: 11, box: [40, 14, 20], center: [0, 2, -4], color: 0xffa030, size: 0.1, dir: [0, 1, 0], travel: 12, sway: 0.8, opacity: 0.9, H: C.H, cycles: [1, 2] });
  scene.add(embers);

  const ease = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  const n = letters.length, clk = bgClock();   // background (floor, rings, cubes, camera) runs on the Speed-controlled clock; letters stay on the loop
  return {
    update(t) {
      const a = TAU * t, bg = clk(t), ab = TAU * bg;
      // music -> colour: mids slide the whole palette round the colour wheel, bass/beat flare the lights and letters
      // A.hue steps a quarter turn per bar and lands exactly on the (predicted) downbeat; A.anticipate swells just before each beat
      const A = music(t), h = (A.hue + 0.12 * A.mid + 0.03 * A.beat) % 1;
      letters.forEach(({ mat, base }) => { tint(mat.color, base, h); tint(mat.emissive, base, h); mat.emissiveIntensity = 0.15 + 0.22 * A.beat + 0.1 * A.anticipate; });
      tint(l1.color, 0xff6a10, h); tint(l2.color, 0xff3fa0, h); tint(l3.color, 0x8a2bff, h);
      l1.intensity = l2.intensity = 150 * (1 + 0.45 * A.bass); l3.intensity = 110 * (1 + 0.6 * A.beat + 0.3 * A.anticipate);
      tint(fA.color, 0xa8380a, h, 0.08 * A.high); tint(fB.color, 0x5a1a9a, h, 0.08 * A.high);
      ringMats.forEach((m, i) => tint(m.color, ringBase[i], h, 0.12 * A.beat));
      cubes.forEach(q => { q.m.material.emissiveIntensity = 0.25 + 0.35 * A.high; q.m.scale.setScalar(q.sc * (1 + 0.35 * A.bass)); });
      letters.forEach(({ pivot }, k) => {
        const f = ((t * 2 - k / n * 0.6) % 1 + 1) % 1, u = f / 0.4;
        pivot.rotation.x = -TAU * (u >= 1 ? 1 : ease(u));
        pivot.position.y = 0.6 + (u >= 1 ? 0 : Math.sin(Math.PI * u) * 3.2);
        pivot.position.z = u >= 1 ? 0 : Math.sin(Math.PI * u) * 2.5;
      });
      ftiles.forEach(({ pv, c, r }) => {
        const x = bg * 2 - (r / FR * 1.0 + Math.abs(c - FC / 2) / FC * 0.3), f = ((x % 1) + 1) % 1, k = Math.floor(((x % 2) + 2) % 2);
        pv.rotation.x = Math.PI * (k + ease(f / 0.35));
        pv.position.z = Math.sin(Math.PI * Math.min(1, f / 0.35)) * 0.8;
      });
      rings.forEach((g, i) => {
        const u = ((bg + i / NR) % 1 + 1) % 1;
        g.position.z = -48 + u * 54;
        g.rotation.z = (i % 2 ? -1 : 1) * (TAU / NB) * 2 * bg + i * 0.2;
        g.scale.setScalar(1 + 0.04 * Math.sin(2 * ab + i) + 0.1 * A.beat - 0.04 * A.anticipate);
      });
      cubes.forEach(q => {
        q.m.rotation.x = TAU * q.ax * bg + q.ph; q.m.rotation.y = TAU * q.ay * bg;
        q.m.position.y = q.py + Math.sin(ab + q.ph) * 1.2;
      });
      camera.position.set(3 * Math.sin(ab), 1.5 + 0.8 * Math.cos(ab), 21); camera.lookAt(0, 0.5, 0);
      embers.userData.u.uT.value = ((bg % 1) + 1) % 1;
    },
  };
}
