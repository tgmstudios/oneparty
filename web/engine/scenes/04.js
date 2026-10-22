import { THREE, TAU, extrudeText, makeEnv } from '../lib.js';
import { particles, haze } from '../lib2.js';


// Procedural magma: domain-warped fbm. Crust = dark cooled rock, cracks = white-hot at the seams, with heat that boils through.
// Time only enters through a circle of radius R in noise space (cos/sin of the loop angle), so one loop is exactly periodic.
const LAVA_VS = `varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main() { vP = position; vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LAVA_FS = `precision highp float; varying vec3 vP; varying vec3 vN; varying vec3 vW;
uniform float uA, uScale, uGlow, uBeat, uVolc;
float h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = 0.5, t = 0.0; for (int i = 0; i < 5; i++) { t += a * vn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return t; }
vec3 ramp(float t) {   // cooled crust -> deep red -> orange -> yellow -> white-hot
  vec3 c = mix(vec3(0.015, 0.004, 0.002), vec3(0.55, 0.03, 0.0), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(1.0, 0.28, 0.02), smoothstep(0.25, 0.55, t));
  c = mix(c, vec3(1.0, 0.72, 0.18), smoothstep(0.5, 0.8, t));
  return mix(c, vec3(1.0, 0.95, 0.7), smoothstep(0.8, 1.0, t));
}
void main() {
  vec3 p = vP * uScale; float c = cos(uA), s = sin(uA);
  // two slow convection swirls moving in opposite senses warp the sample point
  vec3 q = p + vec3(c, s, 0.0) * 0.9;
  vec3 w = vec3(fbm(q * 0.55), fbm(q * 0.55 + 7.3), fbm(q * 0.55 + 13.1));
  p += (w - 0.5) * 3.2; p.xy += vec2(-s, c) * 0.7;
  float n = fbm(p * 0.9 + vec3(0.0, 0.0, c * 0.6));
  float n2 = fbm(p * 2.3 + vec3(s * 0.9, 0.0, 4.0));
  float ridge = abs(n - 0.5) * 2.0;                           // 0 along the seams between crust plates
  float crack = pow(1.0 - smoothstep(0.0, 0.15, ridge), 1.5);
  float fine = pow(1.0 - smoothstep(0.0, 0.1, abs(n2 - 0.5) * 2.0), 2.0) * 0.5;
  float hot = clamp(crack + fine * crack + 0.16 * smoothstep(0.72, 0.95, 1.0 - n), 0.0, 1.0);
  if (uVolc > 0.5) hot *= smoothstep(0.5, 12.0, vP.y) * 1.1;   // volcano: veins only glow towards the summit
  hot *= 0.82 + 0.18 * sin(uA * 2.0 + n * 9.0) + uBeat * 0.35;   // heat breathing, flaring on the beat
  vec3 emit = ramp(hot * 0.78) * (0.03 + 0.95 * hot * uGlow);
  float rock = 0.5 + 0.5 * n2;                                // crust grain, lit softly so the plates read as solid
  vec3 L = normalize(vec3(-0.4, 0.8, 0.6));
  vec3 crust = vec3(0.055, 0.03, 0.022) * rock * (0.35 + 0.65 * max(dot(normalize(vN), L), 0.0)) * (1.0 - hot);
  gl_FragColor = vec4(emit + crust, 1.0);
}`;
const lavaMat = (scale, glow = 1) => new THREE.ShaderMaterial({ vertexShader: LAVA_VS, fragmentShader: LAVA_FS, uniforms: { uA: { value: 0 }, uScale: { value: scale }, uGlow: { value: glow }, uBeat: { value: 0 }, uVolc: { value: 0 } }, toneMapped: false });

// 04 - molten orange typography: cracked-lava extruded letters over magma glow, rising embers
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x070100); scene.fog = new THREE.FogExp2(0x1a0600, 0.011);
  st.bloom.strength = 0.45; st.bloom.radius = 0.55; st.bloom.threshold = 1.0;
  scene.environment = makeEnv(renderer, [{ w: 40, h: 8, c: 0xff5a00, i: 2.2, pos: [0, -10, 6] }, { w: 30, h: 4, c: 0xffb060, i: 1.4, pos: [0, 12, 5] }]); scene.environmentIntensity = 0.5;
  const mat = lavaMat(0.55, 1.0), floorMat = lavaMat(0.16, 0.8);
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.16, depth: 1.5, bevel: 0.12, material: mat, targetWidth: 21 });
  // remap uv so texture spans text (ExtrudeGeometry uvs are world units of shape; fine with repeat)
  T.group.position.y = 0.4; scene.add(T.group);
  // also glossy molten outline copy slightly behind for rim bloom
  const rim = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.16, depth: 0.4, bevel: 0.02, material: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a10).multiplyScalar(1.0), toneMapped: false }), targetWidth: 21 });
  rim.group.scale.multiplyScalar(1.05); rim.group.position.set(0, 0.4, -1.4); scene.add(rim.group);
  // magma floor: displaced emissive plane
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(120, 110, 1, 1), floorMat); fl.position.z = -22;
  fl.rotation.x = -Math.PI / 2; fl.position.y = -4.6; scene.add(fl);
  // volcano on the horizon: lathe cone with a crater, rock + glowing veins, erupting embers and a pulsing crater glow
  const prof = [[34, 0], [26, 1.5], [19, 4.4], [13.5, 8.6], [9.5, 12.4], [7, 15.2], [5.4, 16.6], [4.6, 16.0], [3.6, 14.4], [0.01, 13.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const vg = new THREE.LatheGeometry(prof, 96, 0, TAU), vp = vg.attributes.position;
  for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), y = vp.getY(i), z = vp.getZ(i), th = Math.atan2(z, x), k = 1 + 0.07 * Math.sin(th * 5 + y * 0.4) + 0.05 * Math.sin(th * 11 - y * 0.9) + 0.03 * Math.sin(th * 23 + y * 1.7); vp.setXYZ(i, x * k, y + 0.35 * Math.sin(th * 7 + y), z * k); }
  vg.computeVertexNormals();
  const volMat = lavaMat(0.5, 1.0); volMat.uniforms.uVolc.value = 1;
  const volcano = new THREE.Mesh(vg, volMat); volcano.position.set(0, -4.6, -40); volcano.scale.set(0.5, 0.95, 0.5); scene.add(volcano);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), lavaMat(0.9, 1.5)); crater.rotation.x = -Math.PI / 2; crater.position.set(0, -4.6 + 15.3 * 0.95, -40); scene.add(crater);
  const craterGlow = haze(0xff5a10, 16, 0.5, [0, -4.6 + 16.5 * 0.95, -39]); scene.add(craterGlow);
  const plume = particles({ count: 260, seed: 61, box: [3, 12, 3], center: [0, -4.6 + 21 * 0.95, -40], color: 0xff8a20, size: 0.22, dir: [0, 1, 0], travel: 16, sway: 3.2, opacity: 1.0, H: C.H, cycles: [1, 2] }); scene.add(plume);
  const L1 = new THREE.PointLight(0xff6a10, 40, 0, 1.4); L1.position.set(0, -2.6, 5); scene.add(L1);
  const L2 = new THREE.PointLight(0xffd29a, 60, 0, 1.6); L2.position.set(-8, 7, 9); scene.add(L2);
  const L3 = new THREE.DirectionalLight(0xff9a50, 1.4); L3.position.set(8, 4, 10); scene.add(L3);
  scene.add(haze(0xff4a00, 210, 0.14, [0, -3, -70]), haze(0xff8a20, 120, 0.16, [0, 3, -72]));   // far behind the volcano so the sprites never cut across the floor
  const emb = particles({ count: 380, seed: 41, box: [36, 18, 18], center: [0, 1, 0], color: 0xff9a30, size: 0.09, dir: [0.15, 1, 0], travel: 16, sway: 1.1, opacity: 1.0, H: C.H, cycles: [1, 2, 3] }); scene.add(emb);
  const emb2 = particles({ count: 120, seed: 43, box: [40, 20, 12], center: [0, 1, 6], color: 0xffd080, size: 0.16, dir: [0.1, 1, 0], travel: 20, sway: 0.8, opacity: 0.6, H: C.H, cycles: [1, 2] }); scene.add(emb2);
  return {
    update(t) {
      const a = TAU * t;
      const bt = (t * 16) % 1, kick = Math.exp(-5 * bt);
      craterGlow.material.opacity = 0.4 + 0.3 * kick; craterGlow.scale.setScalar(16 + 5 * kick); plume.userData.u.uT.value = t;
      [mat, floorMat, volMat, crater.material].forEach(m => { m.uniforms.uA.value = a; m.uniforms.uBeat.value = kick * 0.5; });
      L1.intensity = 36 + 10 * Math.sin(a);
      T.group.rotation.y = 0.28 * Math.sin(a); T.group.rotation.x = -0.05 + 0.03 * Math.cos(a); rim.group.rotation.copy(T.group.rotation);
      camera.position.set(3.2 * Math.sin(a), 1.4 + 0.5 * Math.cos(a), 20 + 0.8 * Math.sin(2 * a)); camera.lookAt(0, 0, 0);
      emb.userData.u.uT.value = t; emb2.userData.u.uT.value = t;
    },
  };
}
