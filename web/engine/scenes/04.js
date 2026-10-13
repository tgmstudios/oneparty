import { THREE, TAU, extrudeText, makeEnv } from '../lib.js';
import { particles, haze, lavaTextures } from '../lib2.js';

// 04 - molten orange typography: cracked-lava extruded letters over magma glow, rising embers
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x070100); scene.fog = new THREE.FogExp2(0x1a0600, 0.02);
  st.bloom.strength = 0.55; st.bloom.radius = 0.6; st.bloom.threshold = 0.9;
  scene.environment = makeEnv(renderer, [{ w: 40, h: 8, c: 0xff5a00, i: 2.2, pos: [0, -10, 6] }, { w: 30, h: 4, c: 0xffb060, i: 1.4, pos: [0, 12, 5] }]); scene.environmentIntensity = 0.5;
  const tex = lavaTextures(512);
  // emissive crack shader mat: animated by scrolling emissive slowly (periodic: offset advances by 1 full texture tile per loop => seamless)
  tex.emissive.repeat.set(0.35, 0.8);
  const mat = new THREE.MeshStandardMaterial({ map: tex.color, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.65, metalness: 0.2 });
  tex.color.repeat.copy(tex.emissive.repeat);
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.16, depth: 1.5, bevel: 0.12, material: mat, targetWidth: 21 });
  // remap uv so texture spans text (ExtrudeGeometry uvs are world units of shape; fine with repeat)
  T.group.position.y = 0.4; scene.add(T.group);
  // also glossy molten outline copy slightly behind for rim bloom
  const rim = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.16, depth: 0.4, bevel: 0.02, material: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a10).multiplyScalar(1.0), toneMapped: false }), targetWidth: 21 });
  rim.group.scale.multiplyScalar(1.05); rim.group.position.set(0, 0.4, -1.4); scene.add(rim.group);
  // magma floor: displaced emissive plane
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(90, 60, 1, 1), new THREE.MeshStandardMaterial({ map: tex.color, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 }));
  fl.material.map = tex.color.clone(); fl.material.emissiveMap = tex.emissive.clone(); [fl.material.map, fl.material.emissiveMap].forEach(m => { m.repeat.set(5, 3.5); m.needsUpdate = true; });
  fl.rotation.x = -Math.PI / 2; fl.position.y = -4.6; scene.add(fl);
  const L1 = new THREE.PointLight(0xff6a10, 40, 0, 1.4); L1.position.set(0, -2.6, 5); scene.add(L1);
  const L2 = new THREE.PointLight(0xffd29a, 60, 0, 1.6); L2.position.set(-8, 7, 9); scene.add(L2);
  const L3 = new THREE.DirectionalLight(0xff9a50, 1.4); L3.position.set(8, 4, 10); scene.add(L3);
  scene.add(haze(0xff4a00, 70, 0.14, [0, -3, -10]), haze(0xff8a20, 40, 0.16, [0, 3, -12]));
  const emb = particles({ count: 380, seed: 41, box: [36, 18, 18], center: [0, 1, 0], color: 0xff9a30, size: 0.09, dir: [0.15, 1, 0], travel: 16, sway: 1.1, opacity: 1.0, H: C.H, cycles: [1, 2, 3] }); scene.add(emb);
  const emb2 = particles({ count: 120, seed: 43, box: [40, 20, 12], center: [0, 1, 6], color: 0xffd080, size: 0.16, dir: [0.1, 1, 0], travel: 20, sway: 0.8, opacity: 0.6, H: C.H, cycles: [1, 2] }); scene.add(emb2);
  return {
    update(t) {
      const a = TAU * t;
      tex.emissive.offset.set(t * 0.0, 0); // static pattern; motion from pulsing heat (loop-safe)
      mat.emissiveIntensity = 0.8 + 0.2 * Math.sin(a);
      fl.material.emissiveIntensity = 0.3 + 0.08 * Math.sin(a + 1);
      fl.material.emissiveMap.offset.x = t; fl.material.map.offset.x = t; // one full tile of 5 repeats... integer tile => seamless
      fl.material.emissiveMap.repeat.x = 5; 
      L1.intensity = 36 + 10 * Math.sin(a);
      T.group.rotation.y = 0.28 * Math.sin(a); T.group.rotation.x = -0.05 + 0.03 * Math.cos(a); rim.group.rotation.copy(T.group.rotation);
      camera.position.set(3.2 * Math.sin(a), 1.4 + 0.5 * Math.cos(a), 20 + 0.8 * Math.sin(2 * a)); camera.lookAt(0, 0, 0);
      emb.userData.u.uT.value = t; emb2.userData.u.uT.value = t;
    },
  };
}
