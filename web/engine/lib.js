import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
export { THREE, mergeGeometries };

export const TAU = Math.PI * 2;

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function loadFont(url) {
  return new Promise((res, rej) => new TTFLoader().load(url, j => res(new Font(j)), undefined, rej));
}

export function gradTex(stops, h = 512) {
  const c = document.createElement('canvas'); c.width = 4; c.height = h;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([t, col]) => gr.addColorStop(t, col)); g.fillStyle = gr; g.fillRect(0, 0, 4, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function radialTex(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([t, col]) => gr.addColorStop(t, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- text layout (per glyph, so each letter is its own mesh) ----
export function layoutText(font, text, size, track = 0) {
  const s = size / font.data.resolution; let x = 0; const letters = [];
  for (const ch of text) {
    const g = font.data.glyphs[ch] || font.data.glyphs['?'];
    if (ch !== ' ') letters.push({ ch, x, shapes: font.generateShapes(ch, size) });
    x += g.ha * s + track;
  }
  return { letters, width: x - track };
}
function shapesBox(shapes) {
  const b = new THREE.Box2();
  shapes.forEach(sh => { sh.getPoints(8).forEach(p => b.expandByPoint(p)); });
  return b;
}
// returns {group, meshes[], width, height, box}; origin-centred, letters have own pivots
export function extrudeText(font, text, { size = 2.3, track = 0.04, depth = 0.8, bevel = 0.07, material, targetWidth = 0 }) {
  const L = layoutText(font, text, size, track);
  const group = new THREE.Group(); const meshes = [];
  const tot = new THREE.Box2();
  const parts = L.letters.map(l => {
    const b = shapesBox(l.shapes); const bb = b.clone(); bb.min.x += l.x; bb.max.x += l.x; tot.union(bb);
    return { l, b };
  });
  const cx = (tot.min.x + tot.max.x) / 2, cy = (tot.min.y + tot.max.y) / 2;
  parts.forEach(({ l, b }) => {
    const geo = new THREE.ExtrudeGeometry(l.shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 6 });
    const lcx = (b.min.x + b.max.x) / 2, lcy = (b.min.y + b.max.y) / 2;
    geo.translate(-lcx, -lcy, -depth / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.set(l.x + lcx - cx, lcy - cy, 0);
    m.userData = { ch: l.ch, w: b.max.x - b.min.x, h: b.max.y - b.min.y };
    group.add(m); meshes.push(m);
  });
  const w = tot.max.x - tot.min.x, h = tot.max.y - tot.min.y;
  if (targetWidth) group.scale.setScalar(targetWidth / w);
  const k = targetWidth ? targetWidth / w : 1;
  return { group, meshes, width: w * k, height: h * k, k };
}

// neon tube outline of shapes; returns merged geometry, centred like extrudeText would not be (caller supplies offset)
export function tubesFromContours(contours, r, { radial = 6, closed = true, mult = 2 } = {}) {
  const geos = [];
  contours.forEach(pts3 => {
    const clean = [];
    pts3.forEach(p => { if (!clean.length || clean[clean.length - 1].distanceTo(p) > 1e-3) clean.push(p); });
    if (closed && clean.length > 2 && clean[0].distanceTo(clean[clean.length - 1]) < 1e-3) clean.pop();
    if (clean.length < 3) return;
    const curve = new THREE.CatmullRomCurve3(clean, closed, 'centripetal');
    geos.push(new THREE.TubeGeometry(curve, Math.max(16, Math.round(clean.length * mult)), r, radial, closed));
  });
  return mergeGeometries(geos);
}
export function shapeContours(shapes, div = 10, z = 0, dx = 0, dy = 0) {
  const out = [];
  shapes.forEach(sh => {
    out.push(sh.getPoints(div).map(p => new THREE.Vector3(p.x + dx, p.y + dy, z)));
    sh.holes.forEach(h => out.push(h.getPoints(div).map(p => new THREE.Vector3(p.x + dx, p.y + dy, z))));
  });
  return out;
}

// custom tube with radius function (for slime stream)
export function updateStream(mesh, pts, radiusFn, radial = 14) {
  const n = pts.length; const pos = new Float32Array(n * radial * 3);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.subVectors(b, a).normalize(); N.crossVectors(T, up).normalize(); B.crossVectors(T, N).normalize();
    const r = radiusFn(i / (n - 1));
    for (let j = 0; j < radial; j++) {
      const t = (j / radial) * TAU; const c = Math.cos(t) * r, s = Math.sin(t) * r;
      pos[(i * radial + j) * 3] = pts[i].x + N.x * c + B.x * s;
      pos[(i * radial + j) * 3 + 1] = pts[i].y + N.y * c + B.y * s;
      pos[(i * radial + j) * 3 + 2] = pts[i].z + N.z * c + B.z * s;
    }
  }
  if (!mesh.geometry.index || mesh.geometry.userData.n !== n) {
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
      idx.push(a, c, b, b, c, d);
    }
    mesh.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setIndex(idx); g.userData.n = n; mesh.geometry = g;
  }
  mesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
}

// environment from emissive panels
export function makeEnv(renderer, panels, bg = 0x020208) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  panels.forEach(p => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.c).multiplyScalar(p.i ?? 1), side: THREE.DoubleSide }));
    m.position.set(...p.pos); m.lookAt(0, 0, 0); s.add(m);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.03).texture; pm.dispose(); return t;
}

export const chrome = (extra = {}) => new THREE.MeshStandardMaterial({ color: 0xd8dde8, metalness: 1, roughness: 0.14, ...extra });

// ---- stage ----
// Live stage: renders into the page, follows window size. `dispose` frees GL for scene swaps.
export function makeStage(W, H, { dpr = 1, host = document.body } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr); renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);
  const rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const stage = { renderer, composer, W, H, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(40, W / H, 0.1, 400) };
  stage.renderPass = new RenderPass(stage.scene, stage.camera);
  stage.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.6, 0.85);
  composer.addPass(stage.renderPass); composer.addPass(stage.bloom); composer.addPass(new OutputPass());
  // anti-banding dither
  stage.dither = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uF: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uF; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} void main(){vec4 c=texture2D(tDiffuse,vUv); float n=h(gl_FragCoord.xy+uF*7.13)+h(gl_FragCoord.yx*1.7+uF*3.1)-1.; c.rgb+=n*(1.6/255.); gl_FragColor=c;}',
  });
  composer.addPass(stage.dither);
  stage.resize = (w, h) => { stage.W = w; stage.H = h; renderer.setSize(w, h, false); composer.setSize(w, h); stage.camera.aspect = w / h; stage.camera.updateProjectionMatrix(); };
  stage.dispose = () => {
    stage.scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { Object.values(x).forEach(v => v?.isTexture && v.dispose()); x.dispose(); }); });
    composer.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  return stage;
}
