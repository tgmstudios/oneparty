import { THREE, TAU, extrudeText } from '../lib.js';
import { particles, haze, music, bgClock } from '../lib2.js';

// Lyric Flight: the song's lyrics fly at you through a neon ring tunnel, one line per slot - the current line hangs dead centre, upcoming lines
// approach from the dark, past lines sweep off past the camera. A giant DAWGHOUSE glows at the far end. With no synced lyrics (or in bakes) it
// chants the event name instead. Lyrics come from window.oneLyrics (display host), hue/beat/bounce from music(t).
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x04010a);
  scene.fog = new THREE.FogExp2(0x04010a, 0.02);
  st.bloom.strength = 0.38; st.bloom.radius = 0.5; st.bloom.threshold = 0.9;

  const name = (C.event.title || 'ONE PARTY').toUpperCase();
  const chant = [name, (C.event.subtitle || 'PARTY').toUpperCase(), 'TRICK OR TREAT', 'DAWG ON'];

  // ---- line planes (canvas text), cached by string
  const cache = new Map();
  const lineTex = text => {
    if (cache.has(text)) return cache.get(text);
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 320; const g = cv.getContext('2d');
    const str = (text || '♪').toUpperCase();
    let px = 190; g.font = `900 ${px}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
    while (g.measureText(str).width > 1940 && px > 60) { px -= 8; g.font = `900 ${px}px "Arial Black", "Segoe UI Black", Impact, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = '#06020c'; g.lineWidth = 26; g.strokeText(str, 1024, 170);
    g.fillStyle = '#ffffff'; g.fillText(str, 1024, 170);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    cache.set(text, t); if (cache.size > 48) { const k = cache.keys().next().value; cache.get(k).dispose(); cache.delete(k); }
    return t;
  };
  const geo = new THREE.PlaneGeometry(25, 25 * 320 / 2048);
  const pool = new Map();   // line index -> { m, mat }
  const getSlot = (j, text) => {
    let s = pool.get(j);
    if (!s) {
      const mat = new THREE.MeshBasicMaterial({ map: lineTex(text), transparent: true, toneMapped: false, depthWrite: false }); const m = new THREE.Mesh(geo, mat);
      const mk = () => new THREE.MeshBasicMaterial({ map: lineTex(text), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
      const e1 = new THREE.Mesh(geo, mk()), e2 = new THREE.Mesh(geo, mk()); e1.visible = e2.visible = false; m.add(e1, e2);
      scene.add(m); s = { m, mat, text, e1, e2 }; pool.set(j, s);
    } else if (s.text !== text) { const t2 = lineTex(text); s.mat.map = t2; s.e1.material.map = t2; s.e2.material.map = t2; s.mat.needsUpdate = true; s.e1.material.needsUpdate = true; s.e2.material.needsUpdate = true; s.text = text; }
    return s;
  };

  // ---- tunnel of light rings, hue-tinted and driven by lyric progress (4 lines = one full tunnel cycle, so it loops)
  const NR = 7, NB = 12, rings = [], bgeo = new THREE.BoxGeometry(0.4, 0.4, 3);
  const mats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  for (let i = 0; i < NR; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < NB; j++) { const m = new THREE.Mesh(bgeo, mats[j % 2]); const a = (j / NB) * TAU; m.position.set(Math.cos(a) * 16, Math.sin(a) * 10, 0); m.rotation.z = a; g.add(m); }
    scene.add(g); rings.push(g);
  }

  // ---- giant name at the far end of the tunnel
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xff6a10, toneMapped: false });
  const big = extrudeText(C.fonts.block, name, { size: 6, track: 0.12, depth: 2, bevel: 0.15, targetWidth: 54, material: faceMat });
  const BIG = new THREE.Group(); BIG.add(big.group); BIG.position.set(0, 0, -62); scene.add(BIG);
  const glow = haze(0xff6a10, 80, 0.1, [0, 0, -60]); scene.add(glow);
  const dust = particles({ count: 140, seed: 21, box: [40, 22, 70], center: [0, 0, -30], color: 0xffffff, size: 0.09, dir: [0, 0, 1], travel: 40, sway: 0.6, opacity: 0.7, H: C.H, cycles: [1, 2] });
  scene.add(dust);

  // shockwave rings off the centre (three per beat, staggered) and a confetti burst that re-fires every beat
  const shocks = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.z = -24; m.visible = false; scene.add(m); return m; });
  const NC = 110, cdir = Array.from({ length: NC }, (_, i) => { const a = (i * 2.399963) % TAU, e = 0.25 + 0.75 * (((i * 53) % 97) / 97); return [Math.cos(a) * e, Math.sin(a) * e * 0.62, 0.35 + 0.9 * (((i * 31) % 89) / 89)]; });
  const cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3));
  const cmat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const confetti = new THREE.Points(cgeo, cmat); confetti.frustumCulled = false; confetti.visible = false; scene.add(confetti);
  const clk = bgClock(), col = new THREE.Color(), D0 = 13, SP = 12, LAG = 2000;
  let uS = null, lastNow = performance.now();
  const sm = (a, b, x) => { const v = Math.max(0, Math.min(1, (x - a) / (b - a))); return v * v * (3 - 2 * v); };

  return {
    update(t) {
      const A = music(t), bg = clk(t), ab = TAU * bg, h = (A.hue + 0.1 * A.mid) % 1;
      const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
      const tint = (hex, l = 0) => col.setHex(hex).offsetHSL(h, 0, l);

      // ---- which lines, and how far through the song are we (u = fractional line index; the camera effectively flies along it)
      const L = typeof window !== 'undefined' && window.oneLyrics, real = L && L.lines && L.lines.length > 2 && L.playing !== false;
      let u, lineAt;
      if (real) {
        const ln = L.lines, pos = L.pos - LAG;   // lines linger LAG ms past their cue before the next one takes over
        let i = -1; for (let k = 0; k < ln.length && ln[k].t <= pos; k++) i = k;
        const t0 = i >= 0 ? ln[i].t : 0, t1 = i + 1 < ln.length ? ln[i + 1].t : t0 + 4000;
        u = i >= 0 ? i + sm(Math.max(0, t1 - t0 - 700), Math.max(400, t1 - t0), pos - t0) :   // hold the sung line centred until ~0.7 s before the next one starts, then fly on
          -1 + Math.max(0, Math.min(1, pos / Math.max(1500, ln[0].t)));
        lineAt = j => (j >= 0 && j < ln.length ? ln[j].text : null);
        if (uS === null || Math.abs(u - uS) > 3) uS = u; else uS += (u - uS) * Math.min(1, dt * 7);
      } else {
        u = t * 4; uS = u;   // 4 chant lines per loop
        lineAt = j => chant[((j % 4) + 4) % 4];
      }
      const us = uS, j0 = Math.floor(us);

      // ---- place the lines (plane is 25 wide; shrink it so the focused line fits the visible width at its distance, with a margin)
      const fit = Math.min(1, 0.9 * 2 * D0 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect / 25);
      const used = new Set();
      for (let d = -2; d <= 7; d++) {
        const j = j0 + d, text = lineAt(j); if (text === null) continue;
        used.add(j);
        const s = getSlot(j, text), f = j - us;          // f>0: still to come, f<0: already sung
        const side = (((j % 2) + 2) % 2 ? 1 : -1);
        const z = -D0 - f * SP;
        s.m.position.set(side * (f > 0 ? f * 0.7 : -f * 9), -3.4 * f * (f > 0 ? 1 : 1.6) + 0.15 * Math.sin(ab + j), z);
        s.m.rotation.set(0.03 * Math.sin(j * 2.3), side * (f > 0 ? -0.05 * f : 0.3 * -f), (f < 0 ? side * 0.1 * -f : 0.03 * Math.sin(j * 3.1)));
        const focus = 1 - sm(0, 0.9, Math.abs(f));
        const fade = f > 0 ? 1 - sm(1.2, 2.6, f) : 1 - sm(0.1, 0.6, -f);
        s.mat.opacity = Math.max(0, fade);
        const hj = (h + 0.1 * (j % 3)) % 1, bF = A.beat * focus;
        s.mat.color.setHSL(hj, focus * (0.1 + 0.3 * A.beat) + (1 - focus) * 0.8, focus * 0.85 + (1 - focus) * 0.55);   // white-hot at rest, snaps to full colour on the beat (no white-out)
        s.m.visible = s.mat.opacity > 0.01;
        s.m.scale.setScalar(fit * (1 + 0.04 * focus * A.beat));
      }
      for (const [j, s] of pool) if (!used.has(j)) { scene.remove(s.m); s.mat.dispose(); pool.delete(j); }

      // ---- tunnel, giant name, atmosphere
      rings.forEach((g, i) => {
        const p = (((i / NR + us * 0.25) % 1) + 1) % 1;
        g.position.z = -86 + p * 90; g.rotation.z = (i % 2 ? -1 : 1) * ab * 0.1 + i * 0.3;
        g.scale.setScalar(1 + 0.04 * A.beat);
      });
      mats[0].color.copy(tint(0xff6a10, 0.04 * A.beat)); mats[1].color.copy(tint(0xff3fa0, 0.04 * A.beat));
      faceMat.color.copy(tint(0xff7a14, 0.08 * A.beat));
      BIG.position.y = 0.4 * Math.sin(ab); BIG.scale.setScalar(1 + 0.04 * A.beat); BIG.rotation.y = 0.12 * Math.sin(ab); 
      glow.material.color.copy(tint(0xff6a10)); glow.material.opacity = 0.07 + 0.07 * A.bass + 0.05 * A.beat;
      const down = A.bar === 0 ? 1 : 0.35;
      scene.fog.color.setHSL(h, 0.7, 0.02 + 0.01 * A.bass); scene.background.copy(scene.fog.color);

      camera.position.set(1.4 * Math.sin(ab * 0.5), 0.5 * Math.cos(ab * 0.5), 0.4);
      camera.lookAt(0, 0.2, -30); camera.rotateZ(0.02 * Math.sin(ab * 0.5));
      dust.userData.u.uT.value = ((bg % 1) + 1) % 1;
    },
  };
}
