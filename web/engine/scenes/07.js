import { THREE, TAU, extrudeText, makeEnv, chrome } from '../lib.js';
import { particles, haze } from '../lib2.js';

// 07 - navy/cyan stadium portal: stadium bowl with light towers, concentric glowing portal rings, DAWGHOUSE floating in the gateway
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x020617); scene.fog = new THREE.FogExp2(0x03102a, 0.012);
  st.bloom.strength = 0.18; st.bloom.radius = 0.4; st.bloom.threshold = 1.1;
  scene.environment = makeEnv(renderer, [{ w: 40, h: 6, c: 0x40d8ff, i: 2.4, pos: [0, 10, 6] }, { w: 10, h: 30, c: 0x2a4aff, i: 1.6, pos: [-16, 0, 4] }, { w: 10, h: 30, c: 0xffffff, i: 1.2, pos: [16, 0, 4] }]); scene.environmentIntensity = 0.7;
  // stadium bowl: stepped rings (stands) in dark navy with light dots
  const bowl = new THREE.Group(); scene.add(bowl);
  for (let i = 0; i < 9; i++) {
    const r = 34 + i * 3.2, h = 1.6 + i * 0.9;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r + 3, r, 3.2, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c1e46, emissive: 0x0a2a70, emissiveIntensity: 0.9, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }));
    m.position.y = -6 + h; bowl.add(m);
    const led = new THREE.Mesh(new THREE.TorusGeometry(r + 1.5, 0.12, 6, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35d8ff).multiplyScalar(1.1 - i * 0.07), toneMapped: false })); led.rotation.x = Math.PI / 2; led.position.y = -6 + h + 1.2; bowl.add(led);
  }
  const seats = particles({ count: 1400, seed: 71, box: [100, 18, 100], center: [0, 6, 0], color: 0x9fe8ff, size: 0.16, dir: [0, 0, 0], travel: 0, sway: 0.0, opacity: 0.8, H: C.H }); bowl.add(seats);
  // pitch
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(34, 96), new THREE.MeshStandardMaterial({ color: 0x031230, roughness: 0.3, metalness: 0.6 })); pitch.rotation.x = -Math.PI / 2; pitch.position.y = -5.9; scene.add(pitch);
  // light towers
  const towers = []; for (let i = 0; i < 6; i++) { const a = Math.PI * (1.12 + i * 0.152); const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 30, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a2a4a })); pole.position.y = 15; g.add(pole);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdff8ff).multiplyScalar(3.5), toneMapped: false })); l.position.set(-1.5 + c, 28.5 + r * 0.8, 0.3); g.add(l); }
    g.position.set(Math.cos(a) * 46, -6, Math.sin(a) * 40 - 6); g.lookAt(0, 20, 0); scene.add(g); towers.push(g); }
  // beams
  const beams = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(2.2, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x40d8ff, transparent: true, opacity: 0.014, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); scene.add(b); beams.push(b); }
  // portal: rings
  const portal = new THREE.Group(); portal.position.set(0, 3.2, -4); scene.add(portal);
  const rings = []; for (let i = 0; i < 9; i++) { const R = 4 + i * 1.05;
    const m = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06 + 0.012 * i, 12, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 3 === 0 ? 0xffffff : 0x35d8ff).multiplyScalar(0.55), toneMapped: false, transparent: true, opacity: 1 }));
    m.position.z = -i * 1.1; portal.add(m); rings.push(m); }
  const core = new THREE.Mesh(new THREE.CircleGeometry(3.9, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1a8cff).multiplyScalar(0.09), toneMapped: false })); core.position.z = -10.5; 
  
  // frame arc of chrome pylons
  const mat = chrome({ color: 0xcfe0ff, roughness: 0.15 });
  const ringChrome = new THREE.Mesh(new THREE.TorusGeometry(13.6, 0.55, 20, 128), mat); ringChrome.position.z = 1.6; portal.add(ringChrome);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(34, 7.5), new THREE.MeshBasicMaterial({ map: (()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');const r=g.createRadialGradient(256,64,10,256,64,256);r.addColorStop(0,'rgba(2,8,28,0.82)');r.addColorStop(0.55,'rgba(2,8,28,0.55)');r.addColorStop(1,'rgba(2,8,28,0)');g.save();g.scale(1,0.5);g.fillStyle=r;g.fillRect(0,0,512,256);g.restore();return new THREE.CanvasTexture(c);})(), transparent: true, depthWrite: false, toneMapped: false })); shade.position.set(0, 3.2, 1.6); scene.add(shade);
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.3, bevel: 0.1, material: chrome({ color: 0x9fb4d8, roughness: 0.3, emissive: 0x0a2a60, emissiveIntensity: 0.4 }), targetWidth: 20 });
  T.group.position.set(0, 3.2, 3.5); scene.add(T.group);
  const k = new THREE.PointLight(0x35d8ff, 12, 0, 1.3); k.position.set(0, 3, 9); scene.add(k);
  const k2 = new THREE.PointLight(0x2a6aff, 120, 0, 1.4); k2.position.set(-14, 3, 4); scene.add(k2);
  const k3 = new THREE.DirectionalLight(0xffffff, 1.2); k3.position.set(6, 10, 12); scene.add(k3);
  const sp = particles({ count: 260, seed: 73, box: [40, 22, 20], center: [0, 3, 0], color: 0x9fe8ff, size: 0.06, dir: [0, 0, 1], travel: 20, sway: 0.4, opacity: 0.7, H: C.H }); scene.add(sp);
  return {
    update(t) {
      const a = TAU * t;
      rings.forEach((m, i) => { // rings travel toward viewer with period 1 ring spacing (9 rings repeated): scale pulse instead for seamlessness
        const ph = (i / rings.length + t) % 1; const s = 0.3 + 0.62 * ph; m.scale.set(s, s, 1); m.position.z = -10 + ph * 11; m.material.opacity = 0.6 * Math.sin(ph * Math.PI) ** 0.9 * Math.min(1, Math.max(0, (s - 0.55) / 0.3)); });
      portal.rotation.z = a; ringChrome.rotation.z = -a * 2;
      beams.forEach((b, i) => { const th = a + i / 6 * TAU; const tw = towers[i]; b.position.set(tw.position.x * 0.5, 20, tw.position.z * 0.5 - 2); b.lookAt(Math.sin(th) * 14, -6, Math.cos(th) * 10 - 6); b.rotateX(Math.PI / 2); });
      T.group.rotation.y = 0.35 * Math.sin(a); T.group.position.y = 3.2 + 0.15 * Math.sin(2 * a);
      k.intensity = 11 + 2 * Math.sin(a);
      camera.position.set(3 * Math.sin(a), 3.5 + 0.7 * Math.cos(a), 26 + 1.2 * Math.sin(2 * a)); camera.lookAt(0, 3, 0);
      sp.userData.u.uT.value = t;
    },
  };
}
