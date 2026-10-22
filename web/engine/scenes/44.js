import { THREE, TAU, rng } from '../lib.js';
import { haze, music, skyGradient, bgClock } from '../lib2.js';
import { dawgSign, K, band } from '../pop-kit.js';

// Neon Drive: endless synthwave highway at dusk. A striped sun sinks behind a DAWGHOUSE gantry; grid, lamps and palms stream past on the beat.
export async function build(st, C) {
  const { scene, camera } = st;
  scene.background = new THREE.Color(0x0a0420); scene.fog = new THREE.Fog(0x2a0a40, 40, 150);
  st.bloom.strength = 0.8; st.bloom.radius = 0.7; st.bloom.threshold = 0.7;
  scene.add(new THREE.AmbientLight(0x6a3a9a, 0.9));
  const sky = skyGradient([[0, '#07021a'], [0.35, '#2a0a52'], [0.62, '#a02a8a'], [0.78, '#ff4f90'], [0.88, '#ffa060'], [1, '#ffd890']], -150, 520, 260); sky.position.y = 26; scene.add(sky);

  // stars
  const R = rng(9), sp = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { sp[i * 3] = (R() - 0.5) * 300; sp[i * 3 + 1] = 28 + R() * 60; sp[i * 3 + 2] = -140; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })); scene.add(stars);

  // striped sun
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#ffd040'); gr.addColorStop(0.45, '#ff4f90'); gr.addColorStop(1, '#b020ff'); g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { const y = 250 + i * 30, h = 3 + i * 3.2; g.fillRect(0, y, 512, h); }
  const sunTex = new THREE.CanvasTexture(cv); sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, toneMapped: true })); sun.position.set(0, 16, -135); scene.add(sun);
  const sunGlow = haze(0xff3fa0, 120, 0.22, [0, 16, -136]); scene.add(sunGlow);

  // mountains: dark low-poly with glowing ridge lines
  const mtn = new THREE.Group(); scene.add(mtn);
  for (let i = 0; i < 14; i++) {
    const x = -110 + i * 17 + (R() - 0.5) * 8, h = 12 + R() * 22, w = 14 + R() * 10, geo = new THREE.ConeGeometry(w, h, 4, 1); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x12062a, fog: false })); m.position.set(x, -0.5, -118 - R() * 6); m.rotation.y = Math.PI / 4; mtn.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: i % 2 ? 0xff3fa0 : 0x30d0ff, fog: false })); e.position.copy(m.position); e.rotation.copy(m.rotation); mtn.add(e);
  }

  // ground: dark plane + scrolling glowing grid
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshBasicMaterial({ color: 0x14052a })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -100); scene.add(ground);
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d'); gg.fillStyle = '#000'; gg.fillRect(0, 0, 256, 256); gg.strokeStyle = '#fff'; gg.lineWidth = 6; gg.strokeRect(0, 0, 256, 256);
  const gridTex = new THREE.CanvasTexture(gc); gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(60, 40);
  const gridMat = new THREE.MeshBasicMaterial({ map: gridTex, color: 0xff3fa0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(400, 270), gridMat); grid.rotation.x = -Math.PI / 2; grid.position.set(0, 0, -95); scene.add(grid);
  // road: darker strip with edge lines and dashes
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 270), new THREE.MeshBasicMaterial({ color: 0x07020f })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -95); scene.add(road);
  for (const x of [-7, 7]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 270), new THREE.MeshBasicMaterial({ color: x < 0 ? 0x30d0ff : 0xff3fa0, toneMapped: false })); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.04, -95); scene.add(l); }
  const CELL = 270 / 40, NDASH = 30, dashes = []; const dm = new THREE.MeshBasicMaterial({ color: 0xffe070, toneMapped: false });
  for (let i = 0; i < NDASH; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), dm); d.rotation.x = -Math.PI / 2; scene.add(d); dashes.push(d); }

  // roadside: lamps + palms stream toward the camera (period = 1 beat-step so it loops)
  const SP = 270 / 20, NS = 12, side = [];
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 6, 6), frondG = new THREE.ConeGeometry(0.35, 3.4, 5), pm = new THREE.MeshBasicMaterial({ color: 0x090212 }), lampM = new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false });
  for (let i = 0; i < NS; i++) for (const s of [-1, 1]) {
    const grp = new THREE.Group();
    if ((i + (s > 0 ? 1 : 0)) % 2) { // palm
      const tr = new THREE.Mesh(trunkG, pm); tr.position.y = 3; tr.rotation.z = 0.12 * -s; grp.add(tr);
      for (let f = 0; f < 6; f++) { const fr = new THREE.Mesh(frondG, pm), a = (f / 6) * TAU; fr.position.set(Math.cos(a) * 0.9 - 0.7 * s * 0.12 * 6 * 0.17, 6.1, Math.sin(a) * 0.9); fr.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); grp.add(fr); }
      grp.userData = { palm: true };
    } else { // lamp
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), pm); pole.position.y = 3.5; grp.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.12), pm); arm.position.set(-s * 1, 7, 0); grp.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lampM); bulb.position.set(-s * 1.9, 6.85, 0); grp.add(bulb);
      const gl = haze(0xffb060, 6, 0.4, [-s * 1.9, 6.85, 0]); grp.add(gl); grp.userData = { gl };
    }
    grp.userData.x = s * (10.5 + (i % 3)); grp.userData.i = i; scene.add(grp); side.push(grp);
  }
  // gantry with the sign
  const gan = new THREE.Group(); gan.position.set(0, 0, -62); scene.add(gan);
  const steel = new THREE.MeshStandardMaterial({ color: 0x1a1428, metalness: 0.7, roughness: 0.4 });
  for (const x of [-15, 15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 17, 1.1), steel); p.position.set(x, 8.5, 0); gan.add(p); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(32, 6.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x0a0616, metalness: 0.5, roughness: 0.5 })); bar.position.set(0, 14.5, -0.5); gan.add(bar);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(32.2, 0.18, 0.9), new THREE.MeshBasicMaterial({ color: 0x30d0ff, toneMapped: false })); const edge2 = edge.clone(); edge.position.set(0, 17.7, -0.5); edge2.position.set(0, 11.3, -0.5); edge2.material = new THREE.MeshBasicMaterial({ color: 0xff3fa0, toneMapped: false }); gan.add(edge, edge2);
  const sign = dawgSign(gan, C, { width: 26, pos: [0, 14.5, 0.2], size: 2.2, depth: 0.9, emis: 0xffe070, color: 0xfff0c0, hop: 0.4, glow: false });
  const spot = new THREE.PointLight(0xff3fa0, 80, 0, 1.4); spot.position.set(0, 12, 8); scene.add(spot);

  // ---- the car: low wedge sports car seen from behind, weaving down the lane. Wheels spin, taillights/underglow punch on the kick.
  const car = new THREE.Group(); scene.add(car);
  const paint = new THREE.MeshStandardMaterial({ color: 0x3a0f78, metalness: 0.75, roughness: 0.25, emissive: 0x1a0540, emissiveIntensity: 0.6 });
  const prof = new THREE.Shape(); [[2.2, 0.3], [-2.2, 0.3], [-2.2, 0.62], [-1.5, 0.78], [-0.3, 1.05], [0.35, 1.4], [1.1, 1.4], [1.85, 0.98], [2.2, 0.85]].forEach(([x, y], i) => i ? prof.lineTo(x, y) : prof.moveTo(x, y));
  const bodyG = new THREE.ExtrudeGeometry(prof, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }); bodyG.translate(0, 0, -1.0); bodyG.rotateY(-Math.PI / 2);
  const body = new THREE.Mesh(bodyG, paint); body.position.y = 0.22; car.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 4.5), new THREE.MeshBasicMaterial({ color: 0xff3fa0, toneMapped: false })); stripe.position.y = 0.58; car.add(stripe);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.95), new THREE.MeshStandardMaterial({ color: 0x08101e, metalness: 0.9, roughness: 0.1, emissive: 0x103a6a, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
  glass.position.set(0, 1.4, 1.5); glass.rotation.x = -(Math.PI / 2 - Math.atan2(0.42, 0.75)); car.add(glass);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.55), paint); wing.position.set(0, 1.42, 2.1); car.add(wing);
  for (const x of [-0.8, 0.8]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.2), paint); st.position.set(x, 1.22, 2.0); car.add(st); }
  const tailM = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.13, 0.08), tailM); tailBar.position.set(0, 0.88, 2.32); car.add(tailBar);
  for (const x of [-0.8, 0.8]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.08), tailM); b.position.set(x, 0.68, 2.32); car.add(b); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0xffe070, toneMapped: false })); plate.position.set(0, 0.62, 2.34); car.add(plate);
  const tailGlow = haze(0xff1030, 3.4, 0.3, [0, 0.85, 2.5]); tailGlow.material.depthTest = false; tailGlow.renderOrder = 5; car.add(tailGlow);
  const wheels = []; const tireG = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 20), rimG = new THREE.TorusGeometry(0.33, 0.045, 6, 16), spokeG = new THREE.BoxGeometry(0.04, 0.6, 0.04), tireM = new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 0.8 }), rimM = new THREE.MeshBasicMaterial({ color: 0x30e0ff, toneMapped: false });
  for (const [x, z] of [[-1.08, 1.45], [1.08, 1.45], [-1.08, -1.45], [1.08, -1.45]]) {
    const w = new THREE.Group(); w.position.set(x, 0.46, z); const tire = new THREE.Mesh(tireG, tireM); tire.rotation.z = Math.PI / 2; w.add(tire);
    const hub = new THREE.Group(); hub.position.x = Math.sign(x) * 0.22; const rim = new THREE.Mesh(rimG, rimM); rim.rotation.y = Math.PI / 2; hub.add(rim);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(spokeG, rimM); sp.rotation.x = (i / 3) * Math.PI; sp.position.x = 0; hub.add(sp); } w.add(hub); car.add(w); wheels.push(hub);
  }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d'); const gr = g2.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(255,60,170,0.95)'); gr.addColorStop(1, 'rgba(255,60,170,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = 0.06; car.add(under);
  const flame = [-0.55, 0.55].map(x => { const f = haze(0xffa030, 1.3, 0, [x, 0.4, 2.7]); car.add(f); return f; });
  const rim = new THREE.PointLight(0x30e0ff, 40, 0, 1.6); rim.position.set(-3, 3, 5); car.add(rim); const rim2 = new THREE.PointLight(0xff3fa0, 30, 0, 1.6); rim2.position.set(3, 2, 6); car.add(rim2);
  car.scale.setScalar(1.25);
  const bg = bgClock();

  return {
    update(t) {
      const m = music(t), k = K(m), u = bg(t);
      // streaming: everything moves one grid cell per beat (16 per loop) -> exactly periodic
      const p = u * 16, flow = ((p % 1) + 1) % 1;
      dashes.forEach((d, i) => { d.position.set(0, 0.05, 6 - ((((i - p) % NDASH) + NDASH) % NDASH) * CELL); });
      gridTex.offset.y = flow;
      side.forEach(gr => { const d = gr.userData, z = 10 - ((((d.i - p / 2) % NS) + NS) % NS) * SP; gr.position.set(d.x, 0, z); if (d.gl) d.gl.material.opacity = 0.3 + 0.5 * k.hat + 0.2 * k.kick; if (d.palm) gr.rotation.z = 0.03 * Math.sin(TAU * (t * 4 + d.i * 0.13)) * (0.5 + k.snare); });
      gridMat.opacity = 0.9 + 0.5 * k.kick; gridMat.color.setHSL(0.92 + 0.06 * Math.sin(TAU * t) - 0.06 * k.kick, 1, 0.55);
      sun.scale.setScalar(1 + 0.05 * k.bass + 0.07 * k.kick); sunGlow.material.opacity = 0.14 + 0.22 * k.kick; sun.position.y = 14 + 2 * k.kick;
      mtn.children.forEach((c, i) => { if (c.material.color && i % 2) c.material.color.setHSL(0.82, 0.8, 0.5 + 0.5 * k.bass); });
      // car: weave across the lane once per loop, squat on the kick, wheels spin a whole number of turns
      const cx = 2.4 * Math.sin(TAU * t), vx = 2.4 * Math.cos(TAU * t);
      car.position.set(cx, 0.03 * Math.sin(TAU * t * 8) - 0.05 * k.kick, -1.5); car.rotation.y = -vx * 0.05; car.rotation.z = -vx * 0.012 + 0.012 * Math.sin(TAU * t * 4);
      wheels.forEach(w => { w.rotation.x = -TAU * t * 24; });
      tailM.color.setRGB(0.8 + 0.6 * k.kick, 0.05 + 0.1 * k.kick, 0.12 + 0.1 * k.kick); tailGlow.material.opacity = 0.18 + 0.3 * k.kick;
      under.material.opacity = 0.35 + 0.35 * k.bass + 0.3 * k.kick; flame.forEach(f => { f.material.opacity = 0.9 * k.snare; f.scale.setScalar(1 + 1.2 * k.snare); });
      sign.update(m); spot.intensity = 60 + 90 * k.kick;
      stars.material.opacity = 0.5 + 0.4 * k.hat;
      camera.position.set(0.8 * Math.sin(TAU * t), 2.3 + 0.12 * Math.sin(TAU * t * 2) + 0.08 * k.kick, 12); camera.lookAt(0, 6.5, -60);
    },
  };
}
