// Whiteout: pure white screen with one big 3D DAWGHOUSE spinning in the middle. Own tiny renderer, created on first use and paused while off.
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { loadFont } from '../engine/lib.js';

export function createWhiteout(host) {
  let r, scene, cam, mesh, top, raf = 0, running = false;
  const init = async () => {
    const font = await loadFont('/assets/fonts/Lato-Black.ttf');
    r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setClearColor(0xffffff, 1);
    host.appendChild(r.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100); cam.position.set(0, 0, 14);
    const g = new TextGeometry('DAWGHOUSE', { font, size: 1.5, depth: 0.7, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
    g.computeBoundingBox(); g.center();
    mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xff7a10, roughness: 0.35, metalness: 0.15 }));
    const tg = new TextGeometry('HALLOWEEN @ THE', { font, size: 0.62, depth: 0.25, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2 });
    tg.computeBoundingBox(); tg.center();
    top = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4, metalness: 0.1 })); top.position.y = 2.1;
    scene.add(mesh, top, new THREE.HemisphereLight(0xffffff, 0xb0b0b8, 1.4));
    const k = new THREE.DirectionalLight(0xffffff, 3); k.position.set(4, 6, 8); scene.add(k);
    const w = g.boundingBox.max.x - g.boundingBox.min.x; mesh.userData.w = w;
  };
  const size = () => {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    r.setSize(w, h, false); cam.aspect = w / h;
    const need = (mesh.userData.w * 1.15) / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / cam.aspect;   // keep the whole word in frame while it spins
    cam.position.z = Math.max(need, 8); cam.updateProjectionMatrix();
  };
  const frame = t => { if (!running) return; mesh.rotation.y = t / 1000 * 0.4; top.rotation.y = Math.sin(t / 2500) * 0.25; mesh.rotation.x = Math.sin(t / 1700) * 0.12; size(); r.render(scene, cam); raf = requestAnimationFrame(frame); };
  let starting = false;
  return {
    async set(on) {
      if (on === running) return;
      if (on) { if (starting) return; starting = true; try { if (!r) await init(); } finally { starting = false; } running = true; host.classList.add('on'); raf = requestAnimationFrame(frame); }
      else { running = false; cancelAnimationFrame(raf); host.classList.remove('on'); }
    },
  };
}
