import { THREE, TAU, extrudeText, makeEnv, updateStream, chrome } from '../lib.js';
import { particles, haze } from '../lib2.js';

// 01 - cup pouring glowing slime over extruded DAWGHOUSE
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x03060a);
  scene.fog = new THREE.FogExp2(0x04100a, 0.018);
  st.bloom.strength = 0.6; st.bloom.radius = 0.6; st.bloom.threshold = 0.95;

  scene.environment = makeEnv(renderer, [
    { w: 30, h: 6, c: 0x7bff3a, i: 2.2, pos: [0, 14, 8] }, { w: 14, h: 14, c: 0xff6a00, i: 1.6, pos: [-18, 2, 6] },
    { w: 14, h: 14, c: 0x7a2cff, i: 1.8, pos: [18, 2, 4] }, { w: 40, h: 4, c: 0x223344, i: 0.8, pos: [0, -12, 8] }]);
  scene.environmentIntensity = 0.7;

  // backdrop: dark wet floor + back wall with soft vertical gradient glow
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.18, metalness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.2; scene.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), new THREE.MeshBasicMaterial({ color: 0x02080a, fog: false }));
  back.position.z = -22; scene.add(back);
  const bg1 = haze(0x35ff6a, 60, 0.16, [0, 0, -18]); scene.add(bg1);
  const bg2 = haze(0x8a2cff, 36, 0.16, [-18, 6, -17]); scene.add(bg2);
  const bg3 = haze(0xff7a1a, 30, 0.12, [20, 2, -16]); scene.add(bg3);

  // extruded type
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.7, roughness: 0.35 });
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.1, bevel: 0.09, material: stone, targetWidth: 20.5 });
  T.group.position.set(0, -0.4, 0); scene.add(T.group);
  const topY = T.height / 2 - 0.4;

  // slime shell on each letter: same extruded shape inflated, clipped by a moving "pour line"
  const U = { uT: { value: 0 }, uCx: { value: 0 }, uTop: { value: topY } };
  const slimeMat = new THREE.MeshStandardMaterial({ color: 0x39ff4a, emissive: 0x16c43a, emissiveIntensity: 0.3, metalness: 0.0, roughness: 0.12, envMapIntensity: 1.0 });
  slimeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT,uCx,uTop;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float a=6.2831853*uT; float x=vWP.x;
        float pool=exp(-pow((x-uCx)/3.4,2.));
        float wob=.45*sin(x*1.7-a)+.3*sin(x*3.3+2.*a)+.18*sin(x*6.1-a);
        float depth=.55+1.1*pool+wob*.18;
        // drips: periodic tongues hanging below the line
        float dr=0.; for(int i=0;i<9;i++){ float fi=float(i); float dx=-9.+fi*2.25+.6*sin(fi*2.7); float w=.22+.07*sin(fi*1.9);
          float ph=fract(uT+fi*.173); float len=smoothstep(0.,.8,ph)*(1.-smoothstep(.86,1.,ph))*(1.+1.4*pool*.0)+0.25;
          dr+=exp(-pow((x-dx)/w,2.))*len*(1.3+.9*fract(fi*.37)); }
        float bound=uTop-depth-dr;
        if(vWP.y<bound) discard; }`);
  };
  T.meshes.forEach(m => {
    const g = m.geometry.clone();
    const s = new THREE.Mesh(g, slimeMat); s.position.copy(m.position); s.scale.set(1.035, 1.035, 1.12); m.parent.add(s);
  });

  // cup
  const cup = new THREE.Group();
  const prof = []; const h = 1.7;
  for (let i = 0; i <= 10; i++) prof.push(new THREE.Vector2(0.62 + 0.28 * (i / 10), -h / 2 + h * (i / 10)));
  prof.push(new THREE.Vector2(0.9, h / 2)); for (let i = 10; i >= 0; i--) prof.push(new THREE.Vector2(0.62 + 0.28 * (i / 10) - 0.06, -h / 2 + 0.06 + (h - 0.06) * (i / 10)));
  const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xd8161e, roughness: 0.28, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), cupMat); cup.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 10, 48), cupMat); rim.rotation.x = Math.PI / 2; rim.position.y = h / 2; cup.add(rim);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.775, 0.69, 0.22, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, side: THREE.DoubleSide })); stripe.position.y = -0.05; stripe.scale.set(1.012, 1, 1.012); cup.add(stripe);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x58ff63).multiplyScalar(1.0), toneMapped: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.55; cup.add(fill);
  cup.scale.setScalar(1.8); scene.add(cup);

  // stream
  const stream = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x4dff55, emissive: 0x20dd40, emissiveIntensity: 0.7, roughness: 0.1 })); stream.frustumCulled = false; scene.add(stream);
  const splash = haze(0x6bff6b, 5.5, 0.55, [0, 0, 1.2]); scene.add(splash);
  // droplets
  const drops = []; for (let i = 0; i < 26; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.09 + (i % 4) * 0.025, 10, 8), slimeMat); scene.add(d); drops.push(d); }
  const fillL = new THREE.DirectionalLight(0xcfe8ff, 2.2); fillL.position.set(-4, 6, 14); scene.add(fillL);
  const pl = new THREE.PointLight(0x3dff5a, 8, 0, 1.5); pl.position.set(0, 2, 5); scene.add(pl);
  const pl2 = new THREE.PointLight(0xff6a1a, 30, 0, 1.6); pl2.position.set(-9, 1, 5); scene.add(pl2);
  const pl3 = new THREE.PointLight(0x8a3cff, 30, 0, 1.6); pl3.position.set(10, 3, 5); scene.add(pl3);
  const spores = particles({ count: 260, seed: 11, box: [44, 22, 18], center: [0, 2, -2], color: 0x7bff7b, size: 0.07, dir: [0.1, 1, 0], travel: 8, sway: 0.6, opacity: 0.6, H: C.H });
  scene.add(spores);

  const lip = new THREE.Vector3();
  return {
    update(t) {
      const a = TAU * t;
      const cx = 6.6 * Math.sin(a);
      cup.position.set(cx - 1.4, topY + 3.3 + 0.12 * Math.sin(2 * a), 0.8);
      cup.rotation.set(0, 0, -(1.78 + 0.07 * Math.sin(2 * a)));  // ~102° tilt, lip toward +x
      cup.updateMatrixWorld(true);
      lip.set(0.9, h / 2, 0).applyMatrix4(cup.matrixWorld); lip.y -= 0.12;
      U.uT.value = t; U.uCx.value = cx + 1.0 * Math.cos(a) * 0 + 1.2;
      // ballistic stream from lip to text top
      const target = new THREE.Vector3(lip.x + 1.1, topY + 0.05, 0.8);
      const pts = []; const N = 36; const vy0 = 0;
      const fallH = lip.y - target.y;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1); const x = lip.x + (target.x - lip.x) * Math.pow(u, 0.8);
        const y = lip.y - fallH * u * u; pts.push(new THREE.Vector3(x, y, lip.z));
      }
      updateStream(stream, pts, u => 0.15 + 0.07 * Math.sin(u * 14 - 3 * a * 2) * u + 0.06 * (1 - u) + 0.04 * Math.sin(u * 5 + a));
      splash.position.set(target.x, topY + 0.2, 1.3); splash.material.opacity = 0.10 + 0.03 * Math.sin(2 * a);
      pl.position.set(target.x, topY + 1.2, 3.5); pl.intensity = 7 + 2 * Math.sin(2 * a);
      drops.forEach((d, i) => {
        const ph = ((i / drops.length) * 3 + t * 2) % 1; const dir = i % 2 ? 1 : -1;
        const vx = dir * (0.8 + 0.6 * ((i * 37) % 10) / 10), vy = 2.6 + 1.2 * ((i * 53) % 10) / 10;
        const tt = ph * 1.0;
        d.position.set(target.x + vx * tt * 1.6, topY + 0.1 + vy * tt - 5.5 * tt * tt, 0.8 + ((i * 17) % 10 - 5) * 0.08);
        d.visible = d.position.y > topY - 0.3; d.scale.setScalar(Math.sin(ph * Math.PI));
      });
      spores.userData.u.uT.value = t;
      camera.position.set(2.2 * Math.sin(a + 0.6), 0.9 + 0.5 * Math.cos(a), 23 + 0.7 * Math.sin(2 * a));
      camera.lookAt(0, 1.0, 0);
    },
  };
}
