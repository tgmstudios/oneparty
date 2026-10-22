import { THREE, TAU, rng } from '../lib.js';
import { haze, music, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Hotel Nowhere: an endless hotel corridor you are always walking down. One room slides past per beat; every door swings open as you reach it, onto a
// different glowing world (desert dusk, midnight sea, neon city, moon forest, deep space, aurora) that spills light across the carpet. Chandeliers swing,
// sconces flicker, the elevator at the far end counts floors, and its neon DAWGHOUSE sign never gets any closer.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x05040c); scene.fog = new THREE.Fog(0x0a0816, 25, 105);
  st.bloom.strength = 0.6; st.bloom.radius = 0.7; st.bloom.threshold = 0.8;
  const R = rng(41), W = 9, H = 6.4, L = 6, NSEG = 14, FARZ = 6 - NSEG * L;
  const hue = (h, l = 0.58) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
  scene.add(new THREE.AmbientLight(0x6a5a8a, 0.55));

  // ---- continuous shell: carpet, wallpaper, ceiling (textures scroll one tile per beat)
  const tile = (draw, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const carpet = tile((g, w, h) => { g.fillStyle = '#5a1030'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8a850'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#a01848'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(w / 2, 30 + i * 60); g.lineTo(w - 40, 60 + i * 60); g.lineTo(w / 2, 90 + i * 60); g.lineTo(40, 60 + i * 60); g.fill(); } g.fillStyle = '#d8a850'; g.beginPath(); g.arc(w / 2, h / 2, 14, 0, TAU); g.fill(); }, 256, 256);
  carpet.repeat.set(2, (NSEG * L + 40) / 18);
  const paper = tile((g, w, h) => { g.fillStyle = '#122a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c4466'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h); g.strokeStyle = '#d8a850'; g.lineWidth = 3; for (let y = 24; y < h; y += 96) { g.beginPath(); g.arc(w / 2, y, 10, 0, TAU); g.stroke(); } }, 128, 128);
  paper.repeat.set((NSEG * L + 40) / 6, 1);
  const ceilT = tile((g, w, h) => { g.fillStyle = '#1a1230'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8a850'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); }, 128, 128); ceilT.repeat.set(3, (NSEG * L + 40) / 6);
  const SL = NSEG * L + 40, CZ = 6 - SL / 2 + 10;
  const mk = (geo, map, rx, ry, x, y) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.75, emissive: 0x201020, emissiveIntensity: 0.3 })); m.rotation.set(rx, ry, 0); m.position.set(x, y, CZ); scene.add(m); return m; };
  mk(new THREE.PlaneGeometry(W, SL), carpet, -Math.PI / 2, 0, 0, 0); mk(new THREE.PlaneGeometry(W, SL), ceilT, Math.PI / 2, 0, 0, H);
  const wl = mk(new THREE.PlaneGeometry(SL, H), paper, 0, Math.PI / 2, -W / 2, H / 2), wr = mk(new THREE.PlaneGeometry(SL, H), paper, 0, -Math.PI / 2, W / 2, H / 2);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a850, metalness: 0.9, roughness: 0.3 });
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, SL), gold); r.position.set(x, 1.0, CZ); scene.add(r); }

  // ---- portal worlds painted on canvases
  const portals = [
    g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2a1060'); gr.addColorStop(0.55, '#ff5a80'); gr.addColorStop(1, '#ffb040'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.fillStyle = '#ffe890'; g.beginPath(); g.arc(64, 150, 34, 0, TAU); g.fill(); g.fillStyle = '#3a1040'; g.beginPath(); g.moveTo(0, 256); g.lineTo(0, 200); g.quadraticCurveTo(40, 170, 80, 205); g.quadraticCurveTo(110, 190, 128, 210); g.lineTo(128, 256); g.fill(); },
    g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#02062a'); gr.addColorStop(1, '#0a4a6a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.fillStyle = '#f4f0d0'; g.beginPath(); g.arc(90, 50, 18, 0, TAU); g.fill(); g.strokeStyle = 'rgba(150,230,255,0.7)'; g.lineWidth = 3; for (let y = 140; y < 256; y += 14) { g.beginPath(); for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 4); g.stroke(); } },
    g => { g.fillStyle = '#10062a'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 9; i++) { const w = 12 + R() * 10, h = 60 + R() * 150, x = i * 15; g.fillStyle = '#1a0c3a'; g.fillRect(x, 256 - h, w, h); for (let y = 256 - h + 6; y < 250; y += 9) for (let xx = x + 2; xx < x + w - 2; xx += 6) if (R() < 0.6) { g.fillStyle = R() < 0.5 ? '#ff3fa0' : '#40e0ff'; g.fillRect(xx, y, 3, 4); } } },
    g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#04141a'); gr.addColorStop(1, '#0a3a2a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.fillStyle = '#e8ffe0'; g.beginPath(); g.arc(64, 70, 30, 0, TAU); g.fill(); g.fillStyle = '#03140e'; for (let i = 0; i < 8; i++) { const x = i * 18 - 4, h = 70 + R() * 60; g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 14, 256 - h); g.lineTo(x + 28, 256); g.fill(); } },
    g => { g.fillStyle = '#05020f'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`; g.fillRect(R() * 128, R() * 256, 1.6, 1.6); } const gr = g.createRadialGradient(50, 150, 4, 50, 150, 44); gr.addColorStop(0, '#ffd890'); gr.addColorStop(1, '#8a2ae0'); g.fillStyle = gr; g.beginPath(); g.arc(50, 150, 40, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,200,255,0.8)'; g.lineWidth = 4; g.beginPath(); g.ellipse(50, 150, 62, 14, -0.4, 0, TAU); g.stroke(); },
    g => { g.fillStyle = '#02101a'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 4; i++) { const gr = g.createLinearGradient(0, 40 + i * 20, 0, 200); gr.addColorStop(0, `hsla(${130 + i * 40} 100% 60% / 0.0)`); gr.addColorStop(0.4, `hsla(${130 + i * 40} 100% 60% / 0.6)`); gr.addColorStop(1, 'hsla(160 100% 60% / 0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 60 + i * 20); for (let x = 0; x <= 128; x += 8) g.lineTo(x, 70 + i * 20 + Math.sin(x * 0.07 + i) * 18); g.lineTo(128, 256); g.lineTo(0, 256); g.fill(); } },
  ].map(d => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; d(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; });
  const pcol = [0xff8a50, 0x40b0ff, 0xff3fa0, 0x60ff90, 0xb070ff, 0x30ffc0];

  // ---- the doors: one pair per segment, riding the corridor
  const leafM = new THREE.MeshStandardMaterial({ color: 0x5a1a34, roughness: 0.5, metalness: 0.2 });
  const segs = Array.from({ length: NSEG }, (_, i) => {
    const doors = [-1, 1].map(side => {
      const k = (i * 2 + (side > 0 ? 1 : 0)) % 6, g = new THREE.Group(); g.position.set(side * (W / 2 - 0.02), 0, -(side > 0 ? 3 : 0)); scene.add(g);
      const rec = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 4.0), new THREE.MeshBasicMaterial({ map: portals[k], toneMapped: false })); rec.rotation.y = -side * Math.PI / 2; rec.position.set(-side * 0.02, 2.05, 0); g.add(rec);
      const frame = new THREE.Group(); for (const [w, h, y, z] of [[2.2, 0.2, 4.15, 0], [0.2, 4.2, 2.1, -1.0], [0.2, 4.2, 2.1, 1.0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, w === 2.2 ? 2.2 : 0.2), gold); b.position.set(-side * 0.1, y, z); frame.add(b); } g.add(frame);
      const hinge = new THREE.Group(); hinge.position.set(-side * 0.12, 0, -0.95); g.add(hinge);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.0, 1.9), leafM); leaf.position.set(0, 2.05, 0.95); hinge.add(leaf); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), gold); knob.position.set(-side * 0.1, 2.0, 1.6); leaf.add(knob);
      const nc = document.createElement('canvas'); nc.width = 128; nc.height = 64; const ng = nc.getContext('2d'); ng.fillStyle = '#1a0a14'; ng.fillRect(0, 0, 128, 64); ng.strokeStyle = '#d8a850'; ng.lineWidth = 5; ng.strokeRect(3, 3, 122, 58); ng.fillStyle = '#ffd890'; ng.font = '900 40px Georgia, serif'; ng.textAlign = 'center'; ng.textBaseline = 'middle'; ng.fillText(String(100 + (i * 2 + (side > 0 ? 1 : 0)) * 3 + 1), 64, 34);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), toneMapped: false })); plate.rotation.y = -side * Math.PI / 2; plate.position.set(-side * 0.05, 4.7, 0); g.add(plate);
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4), new THREE.MeshBasicMaterial({ color: pcol[k], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); spill.rotation.x = -Math.PI / 2; spill.position.set(-side * 2.2, 0.03, 0); g.add(spill);
      const pl = new THREE.PointLight(pcol[k], 0, 0, 1.6); pl.position.set(-side * 1.2, 2.2, 0); g.add(pl);
      return { g, hinge, side, spill, pl, rec, k };
    });
    const lamp = new THREE.Group(); lamp.position.set(0, H, 0); scene.add(lamp);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), gold); chain.position.y = -0.35; lamp.add(chain);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 20), gold); crown.rotation.x = Math.PI / 2; crown.position.y = -0.8; lamp.add(crown);
    const crystals = []; for (let c = 0; c < 10; c++) { const a = (c / 10) * TAU, cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffe8c0, toneMapped: false })); cr.position.set(Math.cos(a) * 0.8, -1.1, Math.sin(a) * 0.8); lamp.add(cr); crystals.push(cr); }
    const halo = haze(0xffd890, 4.5, 0.3, [0, -0.9, 0]); lamp.add(halo);
    const sconces = [-1, 1].map(s => { const sg = new THREE.Group(); sg.position.set(s * (W / 2 - 0.2), 3.6, -1.5); scene.add(sg); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890, toneMapped: false })); sg.add(b); const gl = haze(0xffc070, 2.2, 0.35, [0, 0, 0]); sg.add(gl); return { sg, gl }; });
    return { doors, lamp, crystals, halo, sconces, i };
  });

  // ---- the elevator + sign at the far end
  const elev = new THREE.Group(); elev.position.set(0, 0, FARZ + 4); scene.add(elev);
  const edoor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.6, 0.3), new THREE.MeshStandardMaterial({ color: 0xcfd0dc, metalness: 0.9, roughness: 0.25 })); edoor.position.y = 2.3; elev.add(edoor);
  const gap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.6, 0.34), new THREE.MeshBasicMaterial({ color: 0x120a14 })); gap.position.y = 2.3; elev.add(gap);
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 96; const dg = dc.getContext('2d'); const dTex = new THREE.CanvasTexture(dc); dTex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.82), new THREE.MeshBasicMaterial({ map: dTex, toneMapped: false })); disp.position.set(0, 5.35, 0.2); elev.add(disp);
  const sign = dawgSign(scene, C, { width: 7.4, pos: [0, 4.35, -20], size: 2.2, depth: 0.6, emis: 0xff2fa0, color: 0xffd8f4, hop: 0.4, glow: true });
  for (const x of [-3.2, 3.2]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), gold); rod.position.set(x, 5.4, -20); scene.add(rod); }
  const endGlow = haze(0xff7ad0, 24, 0.35, [0, 3.5, 1.6]); elev.add(endGlow); let lastFloor = -1;
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t), a = TAU * u, p = u * 16, hu = m.hue ?? 0.25 * Math.floor(t * 4), flow = ((p % 1) + 1) % 1;
      // scroll textures: one segment (L) per beat
      carpet.offset.y = flow * (L / 18); paper.offset.x = -flow; ceilT.offset.y = flow;
      segs.forEach(({ doors, lamp, crystals, halo, sconces, i }) => {
        const dseg = (((i - p) % NSEG) + NSEG) % NSEG, z = 6 - dseg * L, near = Math.max(0, Math.min(1, (9 - dseg) / 5)), fade = Math.min(1, dseg / 1.2);
        doors.forEach((d, di) => {
          d.g.position.z = z - (d.side > 0 ? 3 : 0); const knock = 0.12 * Math.sin(a * 8 + i + di) * k.snare, open = near * (1.25 + 0.15 * Math.sin(a * 2 + i)) * (0.55 + 0.45 * Math.min(1, 0.5 + k.kick)) + knock;
          d.hinge.rotation.y = -d.side * -open * (d.side > 0 ? -1 : 1) * 1; const glow = Math.min(1, near * (0.55 + 0.6 * k.kick + 0.3 * band(k.env, (i % 8) / 7))) * fade;
          d.spill.material.opacity = 0.55 * glow; d.pl.intensity = 28 * glow; d.rec.material.color.setScalar(0.45 + 0.7 * glow);
        });
        lamp.position.z = z - 1.5; lamp.rotation.z = 0.1 * Math.sin(a * 2 + i) * (1 + k.snare); lamp.rotation.x = 0.06 * Math.cos(a * 2 + i);
        halo.material.opacity = 0.2 + 0.3 * k.kick + 0.1 * Math.sin(a * 4 + i); crystals.forEach((c, ci) => { c.rotation.y = a * 2 + ci; c.material.color.setScalar(0.7 + 0.5 * band(k.hit, ci / 9)); });
        sconces.forEach(({ sg, gl }, si) => { sg.position.z = z - 1.5; const fl = 0.7 + 0.3 * Math.sin(a * 11 + i * 2 + si) + 0.4 * k.hat; gl.material.opacity = 0.2 + 0.3 * fl; });
      });
      // elevator display counts floors each beat
      const fl2 = Math.floor(p) % 16 + 1; if (fl2 !== lastFloor) { lastFloor = fl2; dg.fillStyle = '#100608'; dg.fillRect(0, 0, 256, 96); dg.fillStyle = '#ff4a30'; dg.font = '900 78px "Courier New", monospace'; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.fillText((fl2 < 10 ? ' ' : '') + fl2 + '▲', 128, 52); dTex.needsUpdate = true; }
      edoor.scale.x = 1 + 0.01 * k.kick; gap.scale.x = 1 + 6 * k.kick; sign.update(m); sign.mat.emissive.copy(hue(hu + 0.9, 0.5)); endGlow.material.opacity = 0.25 + 0.4 * k.kick; endGlow.material.color.copy(hue(hu + 0.85, 0.65));
      camera.fov = 52 + 3 * k.kick; camera.updateProjectionMatrix();
      camera.position.set(0.35 * Math.sin(a) + 0.06 * k.kick * Math.sin(a * 31), 2.5 + 0.1 * Math.sin(a * 2) + 0.05 * k.kick, 6); camera.lookAt(0.3 * Math.sin(a), 2.8 + 0.1 * Math.cos(a), -40); camera.rotateZ(0.025 * Math.sin(a * 2) + 0.05 * k.snare * Math.sin(a * 8));
    },
  };
}
