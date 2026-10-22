import { THREE, TAU, extrudeText, makeEnv, chrome } from '../lib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { particles, haze, music, bgClock } from '../lib2.js';

// 01 - cup pouring glossy glowing slime over extruded DAWGHOUSE. Slime shell: bulging bead edge, wet wobbling normals, fresnel glow.
//      Music: hue steps a quarter turn per bar (landing on the beat), bass thickens the stream and flings droplets, beats shake the camera.
// tube along pts with a per-ring elliptical section (rn: in-plane thickness, rb: width along z) - a flat ribbon at the cup lip, a round rope below
function updateRibbon(mesh, pts, rFn, radial = 20) {
  const n = pts.length, pos = new Float32Array(n * radial * 3), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize(); N.crossVectors(T, up).normalize(); B.crossVectors(T, N).normalize();
    const [rn, rb] = rFn(i / (n - 1));
    for (let j = 0; j < radial; j++) {
      const t = (j / radial) * TAU, c = Math.cos(t) * rn, s = Math.sin(t) * rb, k = (i * radial + j) * 3;
      pos[k] = pts[i].x + N.x * c + B.x * s; pos[k + 1] = pts[i].y + N.y * c + B.y * s; pos[k + 2] = pts[i].z + N.z * c + B.z * s;
    }
  }
  if (!mesh.geometry.index || mesh.geometry.userData.n !== n) {
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial; idx.push(a, c, b, b, c, d); }
    mesh.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setIndex(idx); g.userData.n = n; mesh.geometry = g;
  }
  mesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
}

export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x03060a);
  scene.fog = new THREE.FogExp2(0x04100a, 0.018);
  st.bloom.strength = 0.6; st.bloom.radius = 0.6; st.bloom.threshold = 0.95;

  scene.environment = makeEnv(renderer, [
    { w: 30, h: 6, c: 0x7bff3a, i: 2.2, pos: [0, 14, 8] }, { w: 14, h: 14, c: 0xff6a00, i: 1.6, pos: [-18, 2, 6] },
    { w: 14, h: 14, c: 0x7a2cff, i: 1.8, pos: [18, 2, 4] }, { w: 40, h: 4, c: 0x223344, i: 0.8, pos: [0, -12, 8] },
    { w: 2.2, h: 22, c: 0xffffff, i: 3, pos: [-9, 4, 10] }, { w: 2.2, h: 22, c: 0xcfffe0, i: 2.4, pos: [9, 4, 10] }, { w: 34, h: 1.6, c: 0xffffff, i: 2.6, pos: [0, 12, 6] }]);
  scene.environmentIntensity = 0.9;

  // backdrop: dark wet floor + back wall with soft vertical gradient glow
  // wet floor: a real planar mirror (reflects the type, the slime and the lights) under a dark smoked layer
  const mirror = new Reflector(new THREE.PlaneGeometry(120, 80), { textureWidth: 1024, textureHeight: 1024, color: 0x9aaaa6, clipBias: 0.003 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -4.2; scene.add(mirror);
  const smoke = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshBasicMaterial({ color: 0x03080a, transparent: true, opacity: 0.66, depthWrite: false }));
  smoke.rotation.x = -Math.PI / 2; smoke.position.y = -4.19; scene.add(smoke);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), new THREE.MeshBasicMaterial({ color: 0x02080a, fog: false }));
  back.position.z = -22; scene.add(back);
  const bg1 = haze(0x35ff6a, 60, 0.16, [0, 0, -18]); scene.add(bg1);
  const bg2 = haze(0x8a2cff, 36, 0.16, [-18, 6, -17]); scene.add(bg2);
  const bg3 = haze(0xff7a1a, 30, 0.12, [20, 2, -16]); scene.add(bg3);

  // glow pool on the floor under the type, a glossy puddle that breathes, and ripples from dripping runoff
  const poolGlow = haze(0x35ff6a, 46, 0.5, [0, -4.1, 2]); poolGlow.scale.set(46, 10, 1); scene.add(poolGlow);
  const pc = document.createElement('canvas'); pc.width = pc.height = 256; { const g = pc.getContext('2d'), gr = g.createRadialGradient(128, 128, 10, 128, 128, 126); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#aaa'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const puddleMat = new THREE.MeshPhysicalMaterial({ color: 0x39ff4a, emissive: 0x12a02c, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.75, alphaMap: new THREE.CanvasTexture(pc), depthWrite: false });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 64), puddleMat); puddle.rotation.x = -Math.PI / 2; puddle.position.set(0, -4.16, 2.2); scene.add(puddle);
  const ripples = []; const ringGeo = new THREE.RingGeometry(0.94, 1, 64);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x7bff7b, transparent: true, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; scene.add(m); ripples.push(m); }

  // extruded type
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.7, roughness: 0.35 });
  const T = extrudeText(C.fonts.block, (C.event.title || 'ONE PARTY').toUpperCase(), { size: 2.4, track: 0.14, depth: 1.1, bevel: 0.09, material: stone, targetWidth: 24 });
  T.group.position.set(0, -0.4, 0); scene.add(T.group);
  const topY = T.height / 2 - 0.4, T0 = T.group.scale.x;

  // Slime shell on each letter = the letter's extrusion inflated, shaded by a 2D signed-distance field of the slime in world XY:
  // a pouring sheet with a wavy edge smooth-unioned with viscous drips that end in bulbs (the union fillets the joins like a real meniscus).
  // The field gives (1) the cut-out (discard outside), (2) a dome profile - thickest inside, thin at the rim - whose gradient tilts the normal
  // so the edge catches light like a rounded bead, (3) translucency + glow that scale with thickness, so thin film is clear and deep slime is rich.
  const letterX = T.meshes.map(m => m.getWorldPosition(new THREE.Vector3()).x);
  const U = { uT: { value: 0 }, uCx: { value: 0 }, uTop: { value: topY }, uPulse: { value: 0 }, uBoost: { value: 0 }, uGlow: { value: new THREE.Color(0x0fb82e) }, uDX: { value: letterX.map((x, i) => x + 0.5 * Math.sin(i * 2.3)) } };
  const ND = letterX.length;
  const SDF = `uniform float uT,uCx,uTop,uPulse,uBoost; uniform vec3 uGlow; uniform float uDX[${ND}];
    float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
    float dripExt(float ph){ return smoothstep(0.,.8,ph)*(1.-smoothstep(.82,.95,ph))+.25; }
    float sdSlime(vec2 p){ float a=6.2831853*uT;
      float pool=exp(-pow((p.x-uCx)/3.6,2.));
      float wob=.45*sin(p.x*1.7-a)+.3*sin(p.x*3.3+2.*a)+.18*sin(p.x*6.1-a);
      float d=(uTop-(.55+1.1*pool+wob*.18+uBoost*.9))-p.y;
      for(int i=0;i<${ND};i++){ float fi=float(i);
        float ph=fract(uT+fi*.173+.08); float len=dripExt(ph)*(1.3+.9*fract(fi*.37)); float tip=uTop-.8-len*(1.9+uBoost*1.2);
        float r=.17+.05*sin(fi*1.9); float dx=uDX[i];
        float cy=clamp(p.y,tip,uTop-.5);
        float cap=length(vec2(p.x-dx,p.y-cy))-r*(1.+.3*smoothstep(tip+1.,tip,p.y));
        float bulb=length(p-vec2(dx,tip))-r*1.8;
        d=smin(d,smin(cap,bulb,.14),.4); }
      return d; }`;
  const WET = `{ float a2=6.2831853*uT; normal=normalize(normal+.05*vec3(sin(vWP.x*7.+a2)*cos(vWP.y*5.-a2*2.), sin(vWP.y*9.-a2)*.7+sin(vWP.x*13.+a2*3.)*.3, 0.)); }`;
  const slimeMat = new THREE.MeshPhysicalMaterial({ color: 0x14c832, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.45, envMapIntensity: 1.5, transparent: true, depthWrite: false });
  slimeMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\n' + SDF)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float d0=sdSlime(vWP.xy); if(d0>0.) discard; float th=smoothstep(0.,-.5,d0);')
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n diffuseColor.a*=mix(.55,.97,th);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float e=.04; vec2 g=vec2(sdSlime(vWP.xy+vec2(e,0.))-sdSlime(vWP.xy-vec2(e,0.)), sdSlime(vWP.xy+vec2(0.,e))-sdSlime(vWP.xy-vec2(0.,e)))/(2.*e);
        vec3 gv=normalize((viewMatrix*vec4(g,0.,0.)).xyz+vec3(0.,0.,.0001)); normal=normalize(normal+gv*1.6*pow(1.-th,1.5)); }` + WET)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr=pow(1.-clamp(dot(normalize(normal),normalize(vViewPosition)),0.,1.),2.5);
        totalEmissiveRadiance += uGlow*(.06+.5*pow(th,1.3)+.14*fr)*(1.+uPulse*.4); }`);
  };
  // airborne slime (pour stream, droplets): same wet normals, translucent, scattering glow
  const gooMat = new THREE.MeshPhysicalMaterial({ color: 0x1fd23a, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.45, envMapIntensity: 1.6, transparent: true, opacity: 0.92 });
  gooMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uT,uPulse; uniform vec3 uGlow;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WET)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr=pow(1.-clamp(dot(normalize(normal),normalize(vViewPosition)),0.,1.),2.2); totalEmissiveRadiance += uGlow*(.25+.9*(1.-fr))*(1.+uPulse*.9); }`);
  };
  // the pour itself: refractive gel (transmission) so it bends the letters/lights behind it like real thick liquid
  const pourMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.4, ior: 1.36, attenuationColor: new THREE.Color(0x14c832), attenuationDistance: 0.7,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.0, emissive: 0x0b8a20, emissiveIntensity: 0.55 });
  T.meshes.forEach(m => {
    const g = m.geometry.clone();
    const sm = new THREE.Mesh(g, slimeMat); sm.position.copy(m.position); sm.scale.set(1.05, 1.05, 1.18); sm.renderOrder = 2; m.parent.add(sm);
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
  const stream = new THREE.Mesh(new THREE.BufferGeometry(), pourMat); stream.frustumCulled = false; scene.add(stream);
  const splash = haze(0x6bff6b, 5.5, 0.55, [0, 0, 1.2]); scene.add(splash);
  // droplets
  const drops = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 4) * 0.03, 16, 12), pourMat); scene.add(d); drops.push(d); }
  // pinch-off: each drip's bulb detaches and falls to the floor (mirrors the field's drip timing)
  const dripDrops = U.uDX.value.map((x, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), pourMat); scene.add(m); return { m, x, i }; });
  const fillL = new THREE.DirectionalLight(0xcfe8ff, 2.2); fillL.position.set(-4, 6, 14); scene.add(fillL);
  const pl = new THREE.PointLight(0x3dff5a, 8, 0, 1.5); pl.position.set(0, 2, 5); scene.add(pl);
  const pl2 = new THREE.PointLight(0xff6a1a, 30, 0, 1.6); pl2.position.set(-9, 1, 5); scene.add(pl2);
  const pl3 = new THREE.PointLight(0x8a3cff, 30, 0, 1.6); pl3.position.set(10, 3, 5); scene.add(pl3);
  const spores = particles({ count: 260, seed: 11, box: [44, 22, 18], center: [0, 2, -2], color: 0x7bff7b, size: 0.07, dir: [0.1, 1, 0], travel: 8, sway: 0.6, opacity: 0.6, H: C.H });
  scene.add(spores);

  const spring = { x: 0, v: 0, prev: 0, at: performance.now() };
  const lip = new THREE.Vector3(), clk = bgClock(), col = new THREE.Color();
  return {
    update(t) {
      const a = TAU * t, A = music(t), bg = clk(t), ab = TAU * bg;
      // bounce: a damped spring kicked on every beat (rising edge of A.beat) - letters squash/stretch and hop, the cup bobs, the slime swells
      const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - spring.at) / 1000); spring.at = nowMs;
      if (A.beat > spring.prev + 0.25) spring.v += 7 + 5 * A.bass; spring.prev = A.beat;
      spring.v += (-90 * spring.x - 9 * spring.v) * dt; spring.x += spring.v * dt;
      const BN = window.oneAudio ? Math.max(-0.6, Math.min(1.4, spring.x)) : 0.7 * A.beat;
      // hue: green is the home colour; A.hue steps a quarter turn per bar landing on the downbeat (green > blue > magenta > orange > green)
      const hs = A.hue % 1, B = A.beat, K = A.bass;
      const sl = (hex, l = 0) => col.setHex(hex).offsetHSL(hs, 0, l);
      slimeMat.color.copy(sl(0x14c832)); gooMat.color.copy(sl(0x1fd23a)); U.uGlow.value.copy(sl(0x0fb82e)); U.uPulse.value = B + 0.5 * A.anticipate;
      puddleMat.color.copy(sl(0x39ff4a)); puddleMat.emissive.copy(sl(0x12a02c)); puddleMat.emissiveIntensity = 0.5 + 0.8 * B;
      poolGlow.material.color.copy(sl(0x35ff6a)); poolGlow.material.opacity = 0.12 + 0.14 * K + 0.08 * B;
      bg1.material.color.copy(sl(0x35ff6a)); bg1.material.opacity = 0.10 + 0.06 * K;
      bg2.material.color.copy(sl(0x8a2cff)); bg3.material.color.copy(sl(0xff7a1a));
      scene.environmentIntensity = 0.75 + 0.15 * B;
      puddle.scale.set(8.5 + 1.5 * Math.sin(a) + 1.5 * K + 1.6 * BN, 1.9 + 0.3 * Math.sin(2 * a) + 0.3 * K, 1);
      ripples.forEach((m, i) => { const u = ((bg * 2 + i / ripples.length) % 1 + 1) % 1, rx = -9 + ((i * 5.3) % 18);
        m.position.set(rx, -4.15, 1.5 + (i % 3) * 0.5); m.scale.set(0.4 + u * 2.6, 0.4 + u * 1.2, 1); m.material.opacity = (1 - u) * (0.5 + 0.4 * B); m.material.color.copy(sl(0x7bff7b)); });
      T.group.position.y = -0.4 + 0.22 * BN; T.group.scale.set(T0 * (1 - 0.035 * BN), T0 * (1 + 0.1 * BN), T0 * (1 - 0.035 * BN));
      U.uBoost.value = 0.35 * Math.max(0, BN) + 0.5 * K;
      const cx = 6.6 * Math.sin(a);
      cup.position.set(cx - 1.4, topY + 3.3 + 0.12 * Math.sin(2 * a) + 0.55 * BN, 0.8);
      cup.rotation.set(0, 0, -(1.78 + 0.07 * Math.sin(2 * a) - 0.09 * BN));  // ~102° tilt, lip toward +x
      cup.updateMatrixWorld(true);
      lip.set(0.9, h / 2, 0).applyMatrix4(cup.matrixWorld); lip.y -= 0.12;
      U.uT.value = t; U.uCx.value = cx + 1.0 * Math.cos(a) * 0 + 1.2;
      // ballistic stream from lip to text top
      // pour arc: leaves the lip horizontally, gravity bends it to vertical; wide ribbon at the lip, necking as it speeds up, swelling on impact
      const target = new THREE.Vector3(lip.x + 1.3, topY + 0.1, 0.8);
      const pts = [], N = 48, fallH = lip.y - target.y;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), sway = 0.1 * Math.sin(u * 8 - ab * 3) * u * (1 - u) * 4;
        pts.push(new THREE.Vector3(lip.x - 0.35 + (target.x - lip.x + 0.35) * (1 - Math.pow(1 - u, 2.3)) + sway, lip.y + 0.2 - (fallH + 0.2) * u * u, lip.z + 0.06 * Math.sin(u * 6 - ab * 2) * u));
      }
      updateRibbon(stream, pts, u => {
        const base = (0.62 + 0.22 * K) * (1 - 0.42 * Math.min(1, u / 0.6)), wave = 1 + 0.12 * Math.sin(u * 17 - ab * 4) * u + 0.1 * Math.sin(u * 7 + ab);
        const swell = 1 + 0.9 * Math.pow(Math.max(0, (u - 0.82) / 0.18), 2), flat = 1 - u;
        return [base * wave * swell * (0.62 + 0.38 * u), base * wave * swell * (1 + 0.9 * flat * flat)];
      });
      pourMat.attenuationColor.copy(sl(0x14c832)); pourMat.emissive.copy(sl(0x0b8a20)); pourMat.emissiveIntensity = 0.5 + 0.6 * B;
      splash.position.set(target.x, topY + 0.2, 1.3); splash.material.opacity = 0.08 + 0.03 * Math.sin(2 * a) + 0.12 * B; splash.material.color.copy(sl(0x6bff6b)); splash.scale.setScalar(5.5 + 3 * B);
      pl.position.set(target.x, topY + 1.2, 3.5); pl.intensity = 7 + 2 * Math.sin(2 * a) + 18 * B; pl.color.copy(sl(0x3dff5a));
      pl2.color.copy(sl(0xff6a1a)); pl3.color.copy(sl(0x8a3cff)); pl2.intensity = 30 * (1 + 1.5 * K); pl3.intensity = 30 * (1 + 1.5 * K);
      dripDrops.forEach(({ m, x, i }) => {   // bulb pinches off at phase .82 (see dripExt in the shader) and falls under gravity
        const ph = (((t + i * 0.173 + 0.08) % 1) + 1) % 1, tt = (ph - 0.82) / 0.18;
        const tip0 = topY - 0.8 - 1.25 * (1.3 + 0.9 * (((i * 0.37) % 1 + 1) % 1)) * 1.9, y = tip0 - 9 * tt * tt;
        m.visible = tt > 0 && y > -4.0; m.position.set(x, y, 0.9); m.scale.setScalar(0.9 + 0.1 * Math.sin(tt * 9));
      });
      drops.forEach((d, i) => {
        const ph = ((i / drops.length) * 3 + t * 2) % 1; const dir = i % 2 ? 1 : -1;
        const vx = dir * (0.8 + 0.6 * ((i * 37) % 10) / 10) * (1 + 1.2 * K), vy = (2.6 + 1.2 * ((i * 53) % 10) / 10) * (1 + 0.6 * K);
        const tt = ph * 1.0;
        d.position.set(target.x + vx * tt * 1.6, topY + 0.1 + vy * tt - 5.5 * tt * tt, 0.8 + ((i * 17) % 10 - 5) * 0.08);
        d.visible = d.position.y > topY - 0.3; d.scale.setScalar(Math.sin(ph * Math.PI));
      });
      spores.userData.u.uT.value = ((bg % 1) + 1) % 1; spores.material.color?.copy(sl(0x7bff7b));
      camera.position.set(2.2 * Math.sin(ab + 0.6) + 0.18 * B * Math.sin(t * 190), 0.9 + 0.5 * Math.cos(ab) + 0.14 * B * Math.cos(t * 230), 19.5 + 0.7 * Math.sin(2 * ab) - 1.1 * B - 0.8 * BN);   // punch in and shake on the beat
      camera.lookAt(0, 1.0, 0);
    },
  };
}
