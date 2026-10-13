import * as THREE from 'three';
import { rng, TAU, radialTex } from './lib.js';

// Loop-safe GPU particles. Every motion term is periodic in t (integer cycles per loop).
export function particles({ count, seed = 1, box = [20, 10, 10], center = [0, 0, 0], color = 0xffffff, size = 0.1, dir = [0, 1, 0], travel = 10, sway = 0.5, opacity = 1, H = 1080, fov = 40, cycles = [1, 2], blending = THREE.AdditiveBlending }) {
  const r = rng(seed); const pos = new Float32Array(count * 3), s = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (r() - 0.5) * box[0]; pos[i * 3 + 1] = center[1] + (r() - 0.5) * box[1]; pos[i * 3 + 2] = center[2] + (r() - 0.5) * box[2];
    s[i * 4] = r(); s[i * 4 + 1] = cycles[Math.floor(r() * cycles.length)]; s[i * 4 + 2] = r(); s[i * 4 + 3] = 0.5 + r();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 4));
  const u = { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uSize: { value: size }, uPx: { value: H / (2 * Math.tan(fov * Math.PI / 360)) }, uDir: { value: new THREE.Vector3(...dir).normalize() }, uTravel: { value: travel }, uSway: { value: sway }, uOp: { value: opacity } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending,
    vertexShader: `attribute vec4 aS; uniform float uT,uSize,uPx,uTravel,uSway; uniform vec3 uDir; varying float vF;
    void main(){ float f=fract(aS.x+aS.y*uT); vec3 p=position+uDir*(f-.5)*uTravel;
      float a=6.2831853*(uT+aS.z); p+=uSway*vec3(sin(a),cos(a*1.0+1.3),sin(a+2.1))*aS.w;
      vF=smoothstep(0.,.12,f)*smoothstep(1.,.88,f);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,uSize*aS.w*uPx/-mv.z); }`,
    fragmentShader: `uniform vec3 uC; uniform float uOp; varying float vF; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=smoothstep(1.,.0,d); a*=a; gl_FragColor=vec4(uC*uOp,a*vF*uOp); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.u = u; return p;
}

export function haze(color, scale, opacity, pos) {
  const m = new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(m); s.scale.set(scale, scale, 1); s.position.set(...pos); return s;
}

// periodic (tileable) value-noise helpers on a canvas
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function pnoise(u, v, P, seed) {
  const x = u * P, y = v * P, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash(((i % P) + P) % P, ((j % P) + P) % P, seed);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(u, v, P, seed, oct = 4) { let a = 0, amp = 0.5, tot = 0; for (let o = 0; o < oct; o++) { a += amp * pnoise(u, v, P << o, seed + o); tot += amp; amp *= 0.5; } return a / tot; }

export function lavaTextures(size = 512) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const ce = mk(), cc = mk(); const ge = ce.getContext('2d'), gc = cc.getContext('2d');
  const ie = ge.createImageData(size, size), ic = gc.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const w = fbm(u, v, 3, 7, 3);
    const n = fbm(u + (w - 0.5) * 0.35, v + (w - 0.5) * 0.35, 4, 21, 4);
    const ridge = 1 - Math.abs(n * 2 - 1); // 1 on crack
    const crack = Math.pow(ridge, 7);
    const heat = Math.min(1, crack * 1.3 + Math.pow(fbm(u, v, 2, 3, 2), 3) * 0.25);
    const i = (y * size + x) * 4;
    // emissive: black -> deep red -> orange -> yellow-white
    const r = Math.min(1, heat * 2.2), g = Math.max(0, Math.min(1, heat * 1.5 - 0.35)), b = Math.max(0, heat * 1.2 - 0.95);
    ie.data[i] = r * 255; ie.data[i + 1] = g * 255; ie.data[i + 2] = b * 255; ie.data[i + 3] = 255;
    const rock = 20 + 40 * fbm(u, v, 8, 55, 4);
    ic.data[i] = rock * 1.1; ic.data[i + 1] = rock * 0.85; ic.data[i + 2] = rock * 0.8; ic.data[i + 3] = 255;
  }
  ge.putImageData(ie, 0, 0); gc.putImageData(ic, 0, 0);
  const tx = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
  return { emissive: tx(ce, true), color: tx(cc, true) };
}

// tileable brick/stone texture; tiles vertically/horizontally
export function brickTexture({ size = 512, rows = 8, cols = 4, mortar = '#07060a', base = [60, 38, 34], vary = 26, seed = 3 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, size, size); const r = rng(seed);
  const bh = size / rows, bw = size / cols;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const off = (j % 2) * bw / 2, x = i * bw + off, y = j * bh, k = (r() - 0.5) * vary;
    g.fillStyle = `rgb(${base[0] + k},${base[1] + k * 0.8},${base[2] + k * 0.8})`;
    for (const dx of [0, -size]) g.fillRect(x + dx + 3, y + 3, bw - 6, bh - 6);
    for (let q = 0; q < 14; q++) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.fillRect(x + 3 + r() * (bw - 10), y + 3 + r() * (bh - 8), 2 + r() * 14, 2 + r() * 6); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function glowSprite(color, scale, opacity, pos) { return haze(color, scale, opacity, pos); }

export function rimLight(scene, color, intensity, pos) { const l = new THREE.PointLight(color, intensity, 0, 1.4); l.position.set(...pos); scene.add(l); return l; }

export function skyGradient(stops, z = -60, w = 260, h = 140) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([t, col]) => gr.addColorStop(t, col)); g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, fog: false, depthWrite: false, toneMapped: false }));
  m.position.z = z; m.renderOrder = -10; return m;
}
export { TAU };
