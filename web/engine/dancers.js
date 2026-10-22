import { THREE, TAU, extrudeText } from './lib.js';
import { haze, skyGradient, music } from './lib2.js';

// Shared kit for the "dance party" scenes (Monster Mash family): rigged dancers (skeleton, pumpkin, ghost, zombie, mummy), a beat-locked dance
// engine, and reusable stage pieces. A scene = a lineup + a few stage parts:
//   const K = createKit(scene, { floorY });  K.place(K.zombie({...}), x, z, scale, off);  const parts = [stage.floorTiles(K, ...), ...];
//   update(t): const ctx = K.tick(t); parts.forEach(p => p(ctx));
// Dancers lock to music(t) (live beat phase/loudness/bass from the display host, or a synthetic 16-beat grid in bakes), and every move is periodic
// in beats, so baked loops are seamless. ctx = { t, A, b (beat position), beat, bass, lvl, ant, E }.
const S = Math.sin, PI = Math.PI, clamp01 = x => Math.max(0, Math.min(1, x));
export const Pm = (m, p, r) => { m.position.set(...p); if (r) m.rotation.set(...r); return m; };

const G = { sph: new THREE.SphereGeometry(1, 20, 14), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10) };
export const mesh = (geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
/** rod hanging down from its pivot; `end` is the group at its far end (the next joint) */
const rod = (len, r, mat, x, y, z = 0, joint = true) => {
  const p = new THREE.Group(); p.position.set(x, y, z);
  p.add(mesh(G.cyl, mat, r, len, r, 0, -len / 2, 0)); if (joint) p.add(mesh(G.sph, mat, r * 1.5, r * 1.5, r * 1.5));
  const end = new THREE.Group(); end.position.y = -len; p.add(end); return { p, end };
};
const tri = pts => { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return new THREE.ShapeGeometry(s); };
const faceGeo = {
  eye: tri([[-0.2, -0.14], [0.2, -0.14], [0, 0.22]]), nose: tri([[-0.09, -0.08], [0.09, -0.08], [0, 0.1]]),
  grin: tri([[-0.62, 0.1], [-0.42, -0.04], [-0.28, 0.08], [-0.14, -0.1], [0, 0.06], [0.14, -0.1], [0.28, 0.08], [0.42, -0.04], [0.62, 0.1], [0.5, -0.3], [0, -0.46], [-0.5, -0.3]]),
  smile: tri([[-0.6, 0.12], [-0.3, -0.18], [0.3, -0.18], [0.6, 0.12], [0.5, -0.24], [0.2, -0.46], [-0.2, -0.46], [-0.5, -0.24]]),
  oh: new THREE.CircleGeometry(0.26, 14),
};
function bandageTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#d8ccae'; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 14) { g.fillStyle = y % 28 ? '#bfb394' : '#e6dcc2'; g.fillRect(0, y, 64, 9); g.fillStyle = 'rgba(60,45,25,0.35)'; g.fillRect(0, y + 9, 64, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createKit(scene, { floorY = -3.4 } = {}) {
  const cast = [], FLOOR = floorY;
  const bone = std(0xece4cc, { roughness: 0.5, emissive: 0x3a3020, emissiveIntensity: 0.55 });
  const black = std(0x0a0a0c);
  const pumpMat = std(0xff7414, { roughness: 0.5, emissive: 0x5a1c00, emissiveIntensity: 0.6 });
  const vine = std(0x3f8a2a, { roughness: 0.7, emissive: 0x0a2a08, emissiveIntensity: 0.5 });
  const stem = std(0x5a4220, { roughness: 0.8 });
  const baseGlow = glow(0xff9a18);
  const wrap = std(0xffffff, { map: bandageTex(), roughness: 0.9, emissive: 0x2a2418, emissiveIntensity: 0.5 });

  const hatTop = (head, y, col = 0xff3fa0) => head.add(mesh(G.cyl, black, 0.46, 0.04, 0.46, 0, y, 0), mesh(G.cyl, black, 0.25, 0.42, 0.25, 0, y + 0.22, 0), mesh(G.cyl, std(col, { emissive: col, emissiveIntensity: 0.5 }), 0.26, 0.08, 0.26, 0, y + 0.06, 0));

  // ---------- skeleton
  function skeleton({ eye = 0x40ff9a, hat = false } = {}) {
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 1.75; root.add(hips);
    hips.add(mesh(G.box, bone, 0.62, 0.22, 0.32), mesh(G.sph, bone, 0.2, 0.2, 0.2, 0.3, 0.05, 0), mesh(G.sph, bone, 0.2, 0.2, 0.2, -0.3, 0.05, 0));
    const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
    torso.add(mesh(G.cyl, bone, 0.06, 1.05, 0.06, 0, 0.52, -0.05));
    for (let i = 0; i < 6; i++) { const w = [0.26, 0.32, 0.35, 0.34, 0.3, 0.24][i]; const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 6, 20), bone); rib.rotation.x = Math.PI / 2; rib.scale.set(w, w * 0.72, w * 0.86); rib.position.set(0, 0.32 + i * 0.13, 0); torso.add(rib); }
    torso.add(mesh(G.box, bone, 0.06, 0.6, 0.05, 0, 0.62, 0.25));
    const clav = mesh(G.cyl, bone, 0.045, 0.92, 0.045, 0, 1.08, 0); clav.rotation.z = Math.PI / 2; torso.add(clav, mesh(G.cyl, bone, 0.06, 0.22, 0.06, 0, 1.2, 0));
    const head = new THREE.Group(); head.position.y = 1.5; torso.add(head);
    head.add(mesh(G.sph, bone, 0.31, 0.33, 0.32, 0, 0.08, 0));
    for (const s of [-1, 1]) head.add(mesh(G.sph, black, 0.1, 0.12, 0.08, s * 0.12, 0.1, 0.27), mesh(G.sph, glow(eye), 0.045, 0.045, 0.04, s * 0.12, 0.1, 0.33));
    head.add(mesh(G.box, black, 0.05, 0.08, 0.04, 0, -0.01, 0.31));
    for (let i = -2; i <= 2; i++) head.add(mesh(G.box, bone, 0.045, 0.07, 0.04, i * 0.062, -0.13, 0.27));
    const jaw = new THREE.Group(); jaw.position.set(0, -0.14, 0.03); head.add(jaw);
    jaw.add(mesh(G.box, bone, 0.4, 0.07, 0.3, 0, -0.04, 0.12)); for (let i = -2; i <= 2; i++) jaw.add(mesh(G.box, bone, 0.045, 0.07, 0.04, i * 0.062, 0, 0.25));
    if (hat) hatTop(head, 0.36);
    const aR = rod(0.62, 0.055, bone, 0.46, 1.08), eR = rod(0.6, 0.05, bone, 0, 0); aR.end.add(eR.p); eR.end.add(mesh(G.sph, bone, 0.09, 0.09, 0.09));
    const aL = rod(0.62, 0.055, bone, -0.46, 1.08), eL = rod(0.6, 0.05, bone, 0, 0); aL.end.add(eL.p); eL.end.add(mesh(G.sph, bone, 0.09, 0.09, 0.09));
    torso.add(aR.p, aL.p);
    const lR = rod(0.85, 0.07, bone, 0.17, -0.02), kR = rod(0.85, 0.06, bone, 0, 0); lR.end.add(kR.p); kR.end.add(mesh(G.box, bone, 0.14, 0.07, 0.3, 0, -0.04, 0.08));
    const lL = rod(0.85, 0.07, bone, -0.17, -0.02), kL = rod(0.85, 0.06, bone, 0, 0); lL.end.add(kL.p); kL.end.add(mesh(G.box, bone, 0.14, 0.07, 0.3, 0, -0.04, 0.08));
    hips.add(lR.p, lL.p);
    return { kind: 'skel', style: 'club', root, hips, torso, head, jaw, aR: aR.p, eR: eR.p, aL: aL.p, eL: eL.p, lR: lR.p, kR: kR.p, lL: lL.p, kL: kL.p, restY: 1.75, hop: 0.42 };
  }

  // ---------- humanoid (zombie / mummy): chunky limbs, same joint names as the skeleton so one pose engine drives both
  function humanoid({ skin, shirt, pants, shoe = 0x1a1410, eye = 0xffee60, mummy = false, hat = false, hair = 0x1c140c, armFwd = 1.25, style = 'zombie', wound = false }) {
    const sk = mummy ? wrap : std(skin, { emissive: 0x0a1a06, emissiveIntensity: 0.5 }), sh = mummy ? wrap : std(shirt), pn = mummy ? wrap : std(pants);
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 1.75; root.add(hips);
    hips.add(mesh(G.box, pn, 0.6, 0.3, 0.36));
    const torso = new THREE.Group(); torso.position.y = 0.12; hips.add(torso);
    torso.add(mesh(G.box, sh, 0.62, 1.05, 0.36, 0, 0.55, 0), mesh(G.box, sh, 0.8, 0.22, 0.36, 0, 1.02, 0));
    if (!mummy) for (let i = 0; i < 5; i++) torso.add(mesh(G.box, sh, 0.1, 0.22 + (i % 2) * 0.1, 0.05, -0.25 + i * 0.125, 0.0 - (i % 2) * 0.05, 0.19));    // ragged hem
    if (wound) torso.add(mesh(G.sph, std(0x8a0a0a, { emissive: 0x300000, emissiveIntensity: 0.6 }), 0.13, 0.11, 0.04, 0.12, 0.75, 0.19));
    const head = new THREE.Group(); head.position.y = 1.52; torso.add(head);
    head.add(mesh(G.cyl, sk, 0.09, 0.24, 0.09, 0, -0.12, 0), mesh(G.sph, sk, 0.3, 0.34, 0.31, 0, 0.1, 0));
    if (!mummy) { head.add(mesh(G.sph, std(hair), 0.31, 0.2, 0.32, 0, 0.26, -0.03), mesh(G.sph, sk, 0.06, 0.09, 0.05, -0.31, 0.08, 0), mesh(G.sph, sk, 0.06, 0.09, 0.05, 0.31, 0.08, 0)); }
    for (const s of [-1, 1]) {
      if (mummy) head.add(mesh(G.box, black, 0.12, 0.05, 0.05, s * 0.12, 0.14, 0.29), mesh(G.sph, glow(eye), 0.04, 0.04, 0.03, s * 0.12, 0.14, 0.31));
      else head.add(mesh(G.sph, std(0xf2f0d0), 0.075, 0.075, 0.05, s * 0.12, 0.14, 0.28), mesh(G.sph, glow(eye), 0.03, 0.03, 0.03, s * 0.12 + s * -0.01, 0.13, 0.32));
    }
    const jaw = new THREE.Group(); jaw.position.set(0, -0.06, 0.04); head.add(jaw);
    jaw.add(mesh(G.box, mummy ? sk : std(0x2a0a0a), 0.3, 0.06, 0.22, 0, -0.06, 0.2)); if (!mummy) for (let i = -2; i <= 2; i++) jaw.add(mesh(G.box, std(0xd8d0a0), 0.04, 0.06, 0.03, i * 0.055, -0.02, 0.3));
    if (hat) hatTop(head, 0.34, 0x8a2bff);
    const arm = side => { const a = rod(0.62, 0.1, sh, side * 0.5, 1.02), e = rod(0.6, 0.085, sk, 0, 0); a.end.add(e.p); e.end.add(mesh(G.sph, sk, 0.12, 0.12, 0.12)); torso.add(a.p); return { a: a.p, e: e.p }; };
    const R_ = arm(1), L_ = arm(-1);
    const leg = side => { const l = rod(0.85, 0.13, pn, side * 0.18, -0.05), k = rod(0.85, 0.11, mummy ? wrap : pn, 0, 0); l.end.add(k.p); k.end.add(mesh(G.box, std(shoe), 0.2, 0.12, 0.38, 0, -0.04, 0.1)); hips.add(l.p); return { l: l.p, k: k.p }; };
    const lgR = leg(1), lgL = leg(-1);
    const extras = [];
    if (mummy) for (const [e, ph] of [[R_.e, 0], [L_.e, 2]]) { const t = new THREE.Group(); t.position.y = -0.55; t.add(mesh(G.box, wrap, 0.07, 0.5, 0.01, 0, -0.25, 0)); e.add(t); extras.push({ g: t, ph }); }
    return { kind: 'human', style, root, hips, torso, head, jaw, aR: R_.a, eR: R_.e, aL: L_.a, eL: L_.e, lR: lgR.l, kR: lgR.k, lL: lgL.l, kL: lgL.k, restY: 1.75, hop: 0.3, armFwd, extras };
  }
  const zombie = o => humanoid({ skin: 0x78a85a, shirt: 0x5a3a6a, pants: 0x2a2f3a, wound: true, ...o });
  const mummy = o => humanoid({ mummy: true, skin: 0xd8ccae, eye: 0xffc030, armFwd: 0.9, style: 'mummy', ...o });

  const cone = (r, h, mat, p, rot) => Pm(new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mat), p, rot);
  // witch: green skin, long nose, big hat, flared dress
  function witch({ skin = 0x6aa84a, dress = 0x2a1048, trim = 0xff3fa0, hat = 0x180a28, hair = 0x0e2a12, eye = 0xffee60 } = {}) {
    const d = humanoid({ skin, shirt: dress, pants: dress, eye, hair, style: 'club' }), m = std(skin, { emissive: 0x0a1a06, emissiveIntensity: 0.5 }), dm = std(dress, { roughness: 0.7, side: THREE.DoubleSide }), hm = std(hat, { roughness: 0.7, emissive: 0x1a0830, emissiveIntensity: 0.5 });
    d.head.add(cone(0.05, 0.24, m, [0, 0.04, 0.38], [PI / 2 + 0.2, 0, 0]));
    const h = new THREE.Group(); h.position.set(0, 0.34, 0); h.rotation.z = -0.12; d.head.add(h);
    h.add(mesh(G.cyl, hm, 0.58, 0.04, 0.58, 0, 0, 0), cone(0.3, 0.95, hm, [0, 0.5, 0], [0, 0, 0.12]), mesh(G.cyl, std(trim, { emissive: trim, emissiveIntensity: 0.6 }), 0.31, 0.09, 0.31, 0, 0.1, 0), mesh(G.box, std(0xe0b030, { metalness: 0.8, roughness: 0.3 }), 0.1, 0.1, 0.02, 0, 0.1, 0.31));
    for (const sx of [-1, 1]) d.head.add(mesh(G.box, std(hair), 0.08, 0.55, 0.08, sx * 0.29, -0.08, -0.04));
    d.hips.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.66, 0.9, 18, 1, true), dm), [0, -0.5, 0]), mesh(G.cyl, std(trim, { emissive: trim, emissiveIntensity: 0.5 }), 0.67, 0.05, 0.67, 0, -0.93, 0));
    d.torso.add(mesh(G.box, std(0xe0b030, { metalness: 0.8, roughness: 0.3 }), 0.64, 0.07, 0.38, 0, 0.15, 0));
    return d;
  }
  // vampire: pale, slick hair, fangs, flapping cape
  function vampire({ cape = 0xa00a20, eye = 0xff3030 } = {}) {
    const d = humanoid({ skin: 0xe6dce6, shirt: 0x14101c, pants: 0x14101c, eye, hair: 0x050508, style: 'club' });
    for (const sx of [-1, 1]) d.head.add(cone(0.028, 0.1, std(0xffffff), [sx * 0.07, -0.06, 0.29], [PI, 0, 0]));
    const out = std(0x14101c, { roughness: 0.6, side: THREE.DoubleSide }), inn = std(cape, { emissive: cape, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    const c = new THREE.Group(); c.position.set(0, 1.0, -0.2); d.torso.add(c);
    c.add(mesh(G.box, out, 1.7, 1.7, 0.04, 0, -0.8, -0.02), mesh(G.box, inn, 1.62, 1.6, 0.03, 0, -0.8, 0.01));
    for (const sx of [-1, 1]) Pm(d.torso.add(mesh(G.box, out, 0.05, 0.5, 0.4, sx * 0.3, 1.25, -0.08)) && d.torso.children.at(-1), [sx * 0.3, 1.25, -0.08], [0, 0, sx * 0.3]);
    c.rotation.x = 0.0; d.extras = [...(d.extras || []), { g: c, ph: 1, amp: 0.4, base: 0.35 }];
    return d;
  }
  // frankenstein's monster: boxy head, bolts, stitches, flat-top
  function frank({ skin = 0x8ab870, suit = 0x2a2a3a, eye = 0xfff0a0 } = {}) {
    const d = humanoid({ skin, shirt: suit, pants: suit, eye, hair: 0x0a0a0c, style: 'zombie', armFwd: 0.7, wound: false }), m = std(skin, { emissive: 0x0a1a06, emissiveIntensity: 0.5 });
    d.head.add(mesh(G.box, m, 0.6, 0.5, 0.52, 0, 0.12, 0), mesh(G.box, std(0x0a0a0c), 0.62, 0.18, 0.54, 0, 0.42, 0), mesh(G.box, std(0x6a8a50), 0.52, 0.07, 0.1, 0, 0.26, 0.27));
    for (let i = 0; i < 4; i++) d.head.add(mesh(G.box, std(0x1a1a1a), 0.025, 0.1, 0.02, -0.12 + i * 0.08, 0.34, 0.27));
    d.head.add(mesh(G.box, std(0x1a1a1a), 0.34, 0.02, 0.02, 0, 0.34, 0.27));
    for (const sx of [-1, 1]) { const bolt = new THREE.Group(); bolt.position.set(sx * 0.22, -0.1, 0); bolt.rotation.z = Math.PI / 2; d.head.add(bolt); bolt.add(mesh(G.cyl, std(0x8a9098, { metalness: 0.9, roughness: 0.3 }), 0.045, 0.3, 0.045), mesh(G.cyl, std(0x8a9098, { metalness: 0.9, roughness: 0.3 }), 0.08, 0.04, 0.08, 0, 0.16, 0)); }
    return d;
  }
  // scarecrow: burlap, straw hat, stitched grin, carrot nose, patches, straw cuffs
  function scarecrow({ shirt = 0xa83a22, pants = 0x3a5a8a, hat = 0x6a4a1a } = {}) {
    const d = humanoid({ skin: 0xc9a45c, shirt, pants, eye: 0x111111, hair: 0xe0b840, style: 'club' }), straw = std(0xe0b840, { roughness: 0.9, emissive: 0x302008, emissiveIntensity: 0.4 }), blk = std(0x111111);
    const h = new THREE.Group(); h.position.set(0, 0.34, 0); h.rotation.z = 0.1; d.head.add(h);
    h.add(mesh(G.cyl, std(hat, { roughness: 0.9 }), 0.62, 0.04, 0.62, 0, 0, 0), mesh(G.cyl, std(hat, { roughness: 0.9 }), 0.3, 0.3, 0.3, 0, 0.17, 0), mesh(G.cyl, std(0xa03030), 0.31, 0.07, 0.31, 0, 0.06, 0));
    for (const sx of [-1, 1]) d.head.add(mesh(G.sph, blk, 0.07, 0.07, 0.04, sx * 0.12, 0.14, 0.31));
    d.head.add(cone(0.05, 0.2, std(0xff7a14, { emissive: 0x401800, emissiveIntensity: 0.5 }), [0, 0.04, 0.36], [PI / 2, 0, 0]));
    for (let i = -3; i <= 3; i++) d.head.add(mesh(G.box, blk, 0.015, 0.05, 0.015, i * 0.055, -0.1 + Math.abs(i) * -0.012 * -1, 0.3));
    for (const [e, y] of [[d.eR, -0.6], [d.eL, -0.6], [d.kR, -0.85], [d.kL, -0.85]]) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; e.add(Pm(new THREE.Mesh(G.box, straw), [Math.cos(a) * 0.07, y + 0.02, Math.sin(a) * 0.07], [0.5 * Math.cos(a), 0, 0.5 * Math.sin(a)])); e.children.at(-1).scale.set(0.02, 0.2, 0.02); }
    d.torso.add(mesh(G.box, std(0x3a7a4a), 0.22, 0.22, 0.02, -0.14, 0.72, 0.19), mesh(G.box, std(0xe0a030), 0.18, 0.18, 0.02, 0.16, 0.4, 0.19));
    return d;
  }
  // black cat on its hind legs
  function cat({ fur = 0x14141c, eye = 0xffe040, bow = 0xff3fa0, hat = false } = {}) {
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.88; root.add(hips);
    const fm = glow(eye), fr = std(fur, { roughness: 0.8, emissive: 0x10101a, emissiveIntensity: 0.7 }), pink = std(0xff8aa0), body = new THREE.Group(); hips.add(body);
    body.add(mesh(G.sph, fr, 0.5, 0.62, 0.45));
    const head = new THREE.Group(); head.position.y = 0.8; body.add(head);
    head.add(mesh(G.sph, fr, 0.42, 0.36, 0.36));
    for (const sx of [-1, 1]) {
      head.add(cone(0.14, 0.32, fr, [sx * 0.24, 0.33, 0], [0, 0, -sx * 0.25]), mesh(G.sph, fm, 0.08, 0.1, 0.04, sx * 0.15, 0.06, 0.3), mesh(G.box, std(0x050505), 0.02, 0.1, 0.02, sx * 0.15, 0.06, 0.34));
      for (const k of [-1, 0, 1]) head.add(Pm(new THREE.Mesh(G.box, std(0xe8e8f0)), [sx * 0.36, -0.08 + k * 0.04, 0.28], [0, 0, k * 0.15 * sx])), head.children.at(-1).scale.set(0.3, 0.008, 0.008);
    }
    head.add(mesh(G.sph, pink, 0.04, 0.03, 0.03, 0, -0.03, 0.36));
    const mouth = mesh(G.sph, std(0x300810), 0.07, 0.05 * 0.95, 0.03, 0, -0.12, 0.34); head.add(mouth);
    body.add(cone(0.13, 0.2, std(bow, { emissive: bow, emissiveIntensity: 0.5 }), [0.17, 0.5, 0.2], [0, 0, PI / 2]), cone(0.13, 0.2, std(bow, { emissive: bow, emissiveIntensity: 0.5 }), [-0.17, 0.5, 0.2], [0, 0, -PI / 2]));
    if (hat) { const h = new THREE.Group(); h.position.set(0.1, 0.38, 0); h.rotation.z = -0.25; head.add(h); const hm = std(0x1a0a28, { emissive: 0x2a0a40, emissiveIntensity: 0.4 }); h.add(mesh(G.cyl, hm, 0.34, 0.03, 0.34), cone(0.17, 0.5, hm, [0, 0.27, 0])); }
    const tail = new THREE.Group(); tail.position.set(0, -0.3, -0.4); body.add(tail);
    const tm = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 14, PI * 1.1), fr); tm.rotation.set(0, PI / 2, 0.4); tm.position.y = 0.4; tail.add(tm);
    const mk = side => { const a = rod(0.3, 0.075, fr, side * 0.5, 0.2), e = rod(0.25, 0.07, fr, 0, 0); a.end.add(e.p); e.end.add(mesh(G.sph, fr, 0.11, 0.08, 0.11)); a.p.rotation.z = side * 0.4; body.add(a.p); return { a: a.p, e: e.p }; };
    const R_ = mk(1), L_ = mk(-1);
    const mkLeg = side => { const l = rod(0.22, 0.09, fr, side * 0.22, -0.45), k = rod(0.2, 0.08, fr, 0, 0); l.end.add(k.p); k.end.add(mesh(G.sph, fr, 0.15, 0.07, 0.22, 0, -0.03, 0.06)); hips.add(l.p); return { l: l.p, k: k.p }; };
    const lgR = mkLeg(1), lgL = mkLeg(-1);
    return { kind: 'pump', style: 'club', root, hips, body, mouth, fm, R: 0.05, tail, aR: R_.a, eR: R_.e, aL: L_.a, eL: L_.e, lR: lgR.l, kR: lgR.k, lL: lgL.l, kL: lgL.k, restY: 0.88, hop: 0.5 };
  }

  // ---------- pumpkin
  function pumpkin({ R = 1.2, face = 'grin', hat = false } = {}) {
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.62 + R * 0.9; root.add(hips);
    const body = new THREE.Group(); hips.add(body);
    body.add(mesh(G.sph, pumpMat, R * 0.74, R * 0.88, R * 0.74));
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; body.add(mesh(G.sph, pumpMat, R * 0.5, R * 0.9, R * 0.5, Math.cos(a) * R * 0.62, 0, Math.sin(a) * R * 0.62)); }
    body.add(mesh(G.cyl, stem, 0.16, 0.5, 0.16, 0.05, R * 0.95, 0).rotateZ(0.25));
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14, Math.PI * 1.6), vine); curl.position.set(0.28, R * 0.85, 0.1); body.add(curl);
    const fc = new THREE.Group(); fc.position.z = R * 1.14; body.add(fc);
    fc.add(mesh(G.sph, std(0x3a1300, { roughness: 0.9 }), R * 0.62, R * 0.55, 0.08, 0, -0.05 * R, -0.04));
    const fm = baseGlow.clone();
    for (const s of [-1, 1]) { const e = new THREE.Mesh(faceGeo.eye, fm); e.position.set(s * R * 0.34, R * 0.22, 0.06); e.scale.setScalar(R * 0.95); e.rotation.z = s * -0.18; fc.add(e); }
    const nose = new THREE.Mesh(faceGeo.nose, fm); nose.position.set(0, R * 0.02, 0.06); nose.scale.setScalar(R); fc.add(nose);
    const mouth = new THREE.Mesh(faceGeo[face], fm); mouth.position.set(0, -R * 0.26, 0.06); mouth.scale.setScalar(R * 0.95); fc.add(mouth);
    body.add(haze(0xffa020, R * 3.4, 0.22, [0, 0, 0.2]));
    if (hat) {
      const hm = std(0x1a0a28, { roughness: 0.7, emissive: 0x2a0a40, emissiveIntensity: 0.4 });
      const h = new THREE.Group(); h.position.set(0, R * 0.9, 0); h.rotation.z = -0.15; body.add(h);
      h.add(mesh(G.cyl, hm, R * 0.85, 0.05, R * 0.85, 0, 0.05, 0), Pm(new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, R * 1.4, 14), hm), [0, R * 0.72, 0]), mesh(G.cyl, std(0xff3fa0, { emissive: 0xff3fa0, emissiveIntensity: 0.6 }), R * 0.52, 0.12, R * 0.52, 0, 0.18, 0));
    }
    const mk = side => { const a = rod(0.5, 0.06, vine, side * R * 0.86, R * 0.15), e = rod(0.5, 0.05, vine, 0, 0); a.end.add(e.p); e.end.add(mesh(G.sph, vine, 0.13, 0.08, 0.13)); a.p.rotation.z = side * 0.4; body.add(a.p); return { a: a.p, e: e.p }; };
    const R_ = mk(1), L_ = mk(-1);
    const mkLeg = side => { const l = rod(0.3, 0.09, vine, side * R * 0.35, -R * 0.8), k = rod(0.3, 0.08, vine, 0, 0); l.end.add(k.p); k.end.add(mesh(G.sph, black, 0.17, 0.09, 0.26, 0, -0.04, 0.07)); hips.add(l.p); return { l: l.p, k: k.p }; };
    const lgR = mkLeg(1), lgL = mkLeg(-1);
    return { kind: 'pump', style: 'club', root, hips, body, mouth, fm, R, aR: R_.a, eR: R_.e, aL: L_.a, eL: L_.e, lR: lgR.l, kR: lgR.k, lL: lgL.l, kL: lgL.k, restY: hips.position.y, hop: 0.55 };
  }

  // ---------- ghost: floating sheet, no legs
  function ghost({ tint = 0xdff4ff, eye = 0x0a0a14, hat = false, size = 1 } = {}) {
    const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 2.2 * size; root.add(hips);
    const body = new THREE.Group(); body.scale.setScalar(size); hips.add(body);
    const m = std(tint, { roughness: 0.4, emissive: tint, emissiveIntensity: 0.18, transparent: true, opacity: 0.88 });
    const skirt = new THREE.CylinderGeometry(0.62, 1.05, 1.5, 28, 6, true); const pa = skirt.attributes.position;
    for (let i = 0; i < pa.count; i++) if (pa.getY(i) < -0.74) { const a = Math.atan2(pa.getZ(i), pa.getX(i)); pa.setY(i, -0.75 - 0.22 * (0.5 + 0.5 * S(a * 6))); }
    skirt.computeVertexNormals(); const sk = new THREE.Mesh(skirt, m); sk.position.y = -0.45; sk.material.side = THREE.DoubleSide; body.add(sk);
    body.add(mesh(G.sph, m, 0.64, 0.66, 0.62, 0, 0.35, 0));
    const face = new THREE.Group(); face.position.set(0, 0.4, 0.55); body.add(face);
    const em = std(eye, { roughness: 0.3 });
    for (const s of [-1, 1]) face.add(mesh(G.sph, em, 0.11, 0.17, 0.06, s * 0.22, 0.06, 0), mesh(G.sph, glow(0xffffff), 0.03, 0.04, 0.03, s * 0.22 + 0.03, 0.1, 0.05));
    const mouth = mesh(G.sph, em, 0.13, 0.17, 0.06, 0, -0.22, 0); face.add(mouth);
    for (const s of [-1, 1]) face.add(mesh(G.sph, glow(0xff8aa8), 0.1, 0.06, 0.02, s * 0.36, -0.1, -0.02));
    const mkArm = side => { const a = rod(0.5, 0.11, m, side * 0.62, 0.1), e = rod(0.4, 0.1, m, 0, 0); a.end.add(e.p); e.end.add(mesh(G.sph, m, 0.12, 0.12, 0.12)); body.add(a.p); return { a: a.p, e: e.p }; };
    const R_ = mkArm(1), L_ = mkArm(-1);
    if (hat) { const h = new THREE.Group(); h.position.set(0, 0.95, 0); h.rotation.z = 0.2; body.add(h); hatTop(h, 0, 0x40ff9a); }
    const dummy = new THREE.Group();
    return { kind: 'ghost', style: 'ghost', root, hips, body, mouth, aR: R_.a, eR: R_.e, aL: L_.a, eL: L_.e, lR: dummy, kR: dummy, lL: dummy, kL: dummy, restY: hips.position.y, hop: 0.5 };
  }

  // ---------- moves: pose targets as functions of beat position b; every term has an integer period in beats
  const MOVES = {
    club: [
      b => ({ hop: 1, sway: 0.05 * S(PI * b), twist: 0.15 * S(PI * b / 2), aR: 2.1 + 0.8 * S(PI * b), aL: 2.1 - 0.8 * S(PI * b), xR: 0, xL: 0, eR: 1.4, eL: 1.4, lR: Math.max(0, S(PI * b)) * 0.7, lL: Math.max(0, -S(PI * b)) * 0.7, nod: 0.18 * S(PI * b), jaw: 0.5 }),
      b => ({ hop: 0.55, sway: 0.2 * S(PI * b), twist: 0.2 * S(PI * b), aR: 1.7 + 1.0 * (0.5 + 0.5 * S(PI * b)), aL: 0.55, xR: 0, xL: 0, eR: 0.15, eL: 1.7, lR: 0.1 + 0.25 * Math.max(0, S(PI * b)), lL: 0.1 + 0.25 * Math.max(0, -S(PI * b)), nod: 0.1, jaw: 0.3 }),
      b => ({ hop: 0.8, sway: 0.1 * S(PI * b), twist: 0, aR: 2.75 + 0.3 * S(PI * b), aL: 2.75 + 0.3 * S(PI * b + PI), xR: 0, xL: 0, eR: 0.3, eL: 0.3, lR: 0.35, lL: 0.35, nod: 0.3 * S(PI * b), jaw: 0.7 }),
      b => ({ hop: 0.4, sway: 0.04, twist: 0.75 * S(PI * b / 2), aR: 1.1, aL: 1.1, xR: 0.9 * S(PI * b / 2), xL: -0.9 * S(PI * b / 2), eR: 0.9, eL: 0.9, lR: 0.15, lL: 0.15, nod: 0.12 * S(PI * b), jaw: 0.35 }),
    ],
    zombie: [      // arms out front, claws; heavy stomps
      b => ({ hop: 0.45, sway: 0.1 * S(PI * b / 2), twist: 0.3 * S(PI * b / 2), aR: 0.25, aL: 0.25, xR: 0.35 * S(PI * b), xL: -0.35 * S(PI * b), eR: 0.5, eL: 0.5, lR: Math.max(0, S(PI * b)) * 0.8, lL: Math.max(0, -S(PI * b)) * 0.8, nod: 0.35 * S(PI * b / 2), jaw: 0.6 }),
      b => ({ hop: 0.3, sway: 0.28 * S(PI * b / 2), twist: 0.55 * S(PI * b / 2), aR: 0.3, aL: 0.3, xR: 0.5, xL: 0.5, eR: 0.9, eL: 0.9, lR: 0.3, lL: 0.3, nod: 0.5 * S(PI * b / 2 + 1), jaw: 0.8 }),
      b => ({ hop: 0.55, sway: 0.08, twist: 0.2, aR: 2.6, aL: 0.3, xR: 0, xL: 0.6, eR: 0.2, eL: 0.7, lR: 0.2 + 0.6 * Math.max(0, S(PI * b)), lL: 0.2 + 0.6 * Math.max(0, -S(PI * b)), nod: 0.2 * S(PI * b), jaw: 0.5 }),
      b => ({ hop: 0.4, sway: 0.22 * S(PI * b), twist: 0.4 * S(PI * b / 2), aR: 0.9 + 0.5 * S(PI * b), aL: 0.9 - 0.5 * S(PI * b), xR: 0.3, xL: 0.3, eR: 0.6, eL: 0.6, lR: 0.35 * Math.max(0, S(PI * b)), lL: 0.35 * Math.max(0, -S(PI * b)), nod: 0.25 * S(PI * b), jaw: 0.4 }),
    ],
    mummy: [       // stiff and square: straight arms, blocky stomps
      b => ({ hop: 0.5, sway: 0.03, twist: 0.5 * S(PI * b / 2), aR: 0.3, aL: 0.3, xR: 0.4 * S(PI * b), xL: -0.4 * S(PI * b), eR: 0.1, eL: 0.1, lR: Math.max(0, S(PI * b)) * 0.55, lL: Math.max(0, -S(PI * b)) * 0.55, nod: 0.2 * S(PI * b), jaw: 0.3 }),
      b => ({ hop: 0.7, sway: 0.08 * S(PI * b), twist: 0.2, aR: 2.4, aL: 2.4, xR: 0, xL: 0, eR: 0.1, eL: 0.1, lR: 0.4 * Math.max(0, S(PI * b)), lL: 0.4 * Math.max(0, -S(PI * b)), nod: 0.3 * S(PI * b), jaw: 0.5 }),
      b => ({ hop: 0.45, sway: 0.15 * S(PI * b / 2), twist: 0.8 * S(PI * b / 2), aR: 1.57, aL: 1.57, xR: 0, xL: 0, eR: 0.1, eL: 0.1, lR: 0.25, lL: 0.25, nod: 0.1, jaw: 0.4 }),     // "walk like an Egyptian": arms out to the sides
      b => ({ hop: 0.6, sway: 0.05, twist: 0.35 * S(PI * b), aR: 0.2 + 1.6 * Math.max(0, S(PI * b)), aL: 0.2 + 1.6 * Math.max(0, -S(PI * b)), xR: 0.5, xL: 0.5, eR: 0.1, eL: 0.1, lR: 0.3, lL: 0.3, nod: 0.25 * S(PI * b), jaw: 0.5 }),
    ],
    ghost: [
      b => ({ hop: 0.9, sway: 0.12 * S(PI * b), twist: 0.4 * S(PI * b / 2), aR: 2.2 + 0.7 * S(PI * b), aL: 2.2 - 0.7 * S(PI * b), xR: 0, xL: 0, eR: 0.6, eL: 0.6, lR: 0, lL: 0, nod: 0.15 * S(PI * b), jaw: 0.5 }),
      b => ({ hop: 0.6, sway: 0.1, twist: 1.3 * S(PI * b / 2), aR: 1.5, aL: 1.5, xR: 0, xL: 0, eR: 0.3, eL: 0.3, lR: 0, lL: 0, nod: 0.1, jaw: 0.7 }),
      b => ({ hop: 1, sway: 0.22 * S(PI * b / 2), twist: 0.2, aR: 2.8, aL: 2.8, xR: 0, xL: 0, eR: 0.2, eL: 0.2, lR: 0, lL: 0, nod: 0.25 * S(PI * b), jaw: 0.9 }),
      b => ({ hop: 0.7, sway: 0.28 * S(PI * b), twist: 0.6 * S(PI * b / 2), aR: 1.2 + 0.8 * S(PI * b), aL: 1.2 - 0.8 * S(PI * b), xR: 0, xL: 0, eR: 0.8, eL: 0.8, lR: 0, lL: 0, nod: 0.2, jaw: 0.4 }),
    ],
  };
  const KEYS = Object.keys(MOVES.club[0](0)), smooth = x => x * x * (3 - 2 * x);
  /** blend the style's four moves, one per bar, with smooth crossfades (all periodic, so loops are seamless) */
  function pose(style, b, off) {
    const mv = MOVES[style] || MOVES.club, bar = (b / 4 + off) % 4, w = [0, 1, 2, 3].map(m => smooth(Math.max(0, 1 - Math.abs(((bar - m + 2 + 4) % 4) - 2))));
    const sum = w[0] + w[1] + w[2] + w[3] || 1, out = Object.fromEntries(KEYS.map(k => [k, 0]));
    for (let m = 0; m < 4; m++) { const p = mv[m](b + off * 4), k = w[m] / sum; for (const key of KEYS) out[key] += p[key] * k; }
    return out;
  }

  let B = 0, lastPh = null;       // continuous beat position: whole beats counted from phase wraps, plus the phase
  const beatPos = m => { const ph = m.phase ?? 0; if (lastPh !== null && ph < lastPh - 0.5) B = (B + 1) % 16; lastPh = ph; return B + ph; };

  const api = {
    scene, FLOOR, cast, skeleton, zombie, mummy, pumpkin, ghost, humanoid, witch, vampire, frank, scarecrow, cat, mats: { bone, black, wrap },
    place(d, x, z, s = 1, off = 0) { d.root.position.set(x, FLOOR, z); d.root.scale.setScalar(s); scene.add(d.root); cast.push({ d, off, x, z, band: Math.min(15, Math.round(Math.abs(x) / 10.5 * 15)) }); return d; },   // band: bass near the centre, highs at the edges (same map as the floor)
    /** call once per frame; poses every dancer and returns the music context for stage parts */
    tick(t) {
      const A = TAU * t, m0 = music(t), b = beatPos(m0);
      const lvl = clamp01((m0.level || 0) * 1.4), bass = clamp01(m0.bass || 0), beat = clamp01(m0.beat || 0), ant = m0.anticipate || 0, E = 0.6 + 0.8 * lvl;
      const env = m0.env || m0.bands || [], hit = m0.hit || [], kick = clamp01(m0.kick || 0), snare = clamp01(m0.snare || 0), hat = clamp01(m0.hat || 0);
      const bassF = Math.max(env[0] || 0, env[1] || 0, env[2] || 0);                            // fast bass (jaws, mouths)
      for (const { d, off, x, band } of cast) {
        const p = pose(d.style, b, off), bd = b + off * 4, pop = hit[band] || 0, lv = env[band] || 0, punch = Math.max(pop, kick * 0.8);
        const hopv = Math.abs(S(PI * bd)) * Math.min(1, p.hop * E), land = 1 - hopv;
        d.hips.position.y = d.restY + d.hop * hopv + d.hop * 0.55 * punch - 0.16 * ant * (1 - hopv) - 0.1 * kick * land + (d.kind === 'ghost' ? 0.12 * S(A * 2 + x) : 0);
        d.root.rotation.z = p.sway * E + 0.05 * (snare - hat) * S(A * 8 + x); d.root.rotation.y = p.twist * (d.kind === 'ghost' ? 0.9 : 0.25) * E + x * -0.02;
        const fwd = d.armFwd || 0, flail = 0.55 * snare + 0.5 * pop;                           // arms snap on the snare and on this dancer's own band
        if (d.kind === 'skel' || d.kind === 'human') {
          d.torso.rotation.y = p.twist * E; d.torso.rotation.x = p.nod * 0.3 + 0.16 * kick; d.head.rotation.x = p.nod * E + 0.35 * kick + 0.4 * pop; d.head.rotation.z = 0.14 * S(PI * bd / 2) * E + 0.12 * hat * S(A * 60 + x);
          d.jaw.rotation.x = 0.06 + (d.kind === 'human' ? 0.5 : 0.7) * Math.max(bassF, lv * 0.8);
          d.aR.rotation.set(p.xR * E - fwd, 0, p.aR + flail); d.aL.rotation.set(p.xL * E - fwd, 0, -(p.aL + flail));
          d.eR.rotation.set(-fwd * 0.2, 0, p.eR * 0.6 + 0.4 * snare); d.eL.rotation.set(-fwd * 0.2, 0, -(p.eL * 0.6 + 0.4 * snare));
          d.lR.rotation.set(-p.lR * E - 0.3 * kick, 0, 0.08); d.lL.rotation.set(-p.lL * E - 0.3 * kick, 0, -0.08);
          d.kR.rotation.x = p.lR * 1.3 * E + 0.1 * hopv + 0.4 * kick; d.kL.rotation.x = p.lL * 1.3 * E + 0.1 * hopv + 0.4 * kick;
          if (d.extras) for (const ex of d.extras) { const k = ex.amp ?? 1; ex.g.rotation.set((ex.base || 0) + k * (0.5 * S(A * 6 + ex.ph) + 0.5 * kick + 0.3 * snare), 0, k * 0.3 * S(A * 4 + ex.ph)); }
        } else if (d.kind === 'pump') {
          d.body.rotation.y = p.twist * 0.7 * E; d.body.rotation.x = p.nod * 0.5 + 0.12 * kick + 0.3 * pop;
          const sqz = (0.14 * land * p.hop + 0.16 * kick) * E; d.body.scale.set(1 + 0.9 * sqz, 1 - sqz + 0.05 * hopv + 0.12 * pop, 1 + 0.9 * sqz);
          d.aR.rotation.set(p.xR * E, 0, p.aR * 0.8 + flail); d.aL.rotation.set(p.xL * E, 0, -(p.aL * 0.8 + flail));
          d.eR.rotation.set(0, 0, p.eR * 0.5); d.eL.rotation.set(0, 0, -p.eL * 0.5);
          d.lR.rotation.set(-p.lR * 1.2 * E, 0, 0); d.lL.rotation.set(-p.lL * 1.2 * E, 0, 0); d.kR.rotation.x = p.lR * 1.4 * E; d.kL.rotation.x = p.lL * 1.4 * E;
          const f = 0.62 + 0.3 * lv + 0.35 * pop + 0.06 * S(A * 8 + x); d.fm.color.setRGB(f, 0.6 * f, 0.1 * f); d.mouth.scale.y = d.R * 0.95 * (1 + 0.8 * Math.max(bassF, lv));
          if (d.tail) d.tail.rotation.z = 0.5 * S(A * 4 + x) + 0.6 * kick + 0.3 * hat * S(A * 40);
        } else {   // ghost
          d.body.rotation.x = p.nod * 0.4 + 0.15 * pop; d.body.scale.set(1 + 0.04 * land + 0.08 * kick, 1 - 0.04 * land + 0.06 * hopv + 0.1 * pop, 1 + 0.04 * land + 0.08 * kick);
          d.aR.rotation.set(0, 0, p.aR * 0.85 + flail); d.aL.rotation.set(0, 0, -(p.aL * 0.85 + flail)); d.eR.rotation.set(0, 0, p.eR * 0.5); d.eL.rotation.set(0, 0, -p.eL * 0.5);
          d.mouth.scale.set(0.13 * (1 + 0.4 * bassF), 0.17 * (1 + 1.2 * Math.max(bassF, lv)), 0.06);
        }
      }
      return { t, A, b, beat, bass, lvl, ant, E, m: m0, kick, snare, hat, env, hit, bassF };
    },
  };
  return api;
}

// =========================== stage parts: each returns update(ctx) ===========================
const dark = new THREE.MeshBasicMaterial({ color: 0x050108 });
const sprite = (c, s, o, p) => haze(c, s, o, p);

export const stage = {   // (see each part's comment)
  /** gradient sky + big moon (+ glow) */
  sky(scene, { stops, moon = 0xffb060, moonPos = [0, 7, -60], moonR = 7, glow: g = 0xff8a30 }) {
    scene.add(skyGradient(stops, -70, 300, 170));
    const m = new THREE.Mesh(new THREE.CircleGeometry(moonR, 48), new THREE.MeshBasicMaterial({ color: moon, toneMapped: false, fog: false })); m.position.set(...moonPos); scene.add(m);
    const hz = haze(g, moonR * 6.5, 0.3, [moonPos[0], moonPos[1], moonPos[2] + 2]); scene.add(hz);
    return ({ bass }) => { hz.material.opacity = 0.26 + 0.1 * bass; };
  },
  graveyard(scene, FLOOR, { n = 16, z = -42, trees = true } = {}) {
    for (let i = 0; i < n; i++) {
      const x = -52 + i * (104 / n) + (i % 3) * 1.3, h = 3 + (i * 37 % 5), w = 1.6 + (i % 3) * 0.5, st = new THREE.Group();
      st.add(Pm(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), dark), [0, h / 2, 0]));
      st.add(i % 2 ? Pm(new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.5, 12), dark), [0, h, 0], [Math.PI / 2, 0, 0]) : Pm(new THREE.Mesh(new THREE.BoxGeometry(w * 1.8, 0.5, 0.5), dark), [0, h * 0.75, 0]));
      st.position.set(x, FLOOR - 0.2, z - (i % 4) * 3); scene.add(st);
    }
    if (trees) for (const [x, s] of [[-30, 1.3], [27, 1.5]]) {
      const g = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.6 * s, 9 * s, 6), dark); tr.position.y = 4.5 * s; g.add(tr);
      for (const [a, l, y] of [[0.9, 4, 6], [-1.0, 3.6, 5], [0.6, 3, 8], [-0.5, 3, 8.4]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.22 * s, l * s, 5), dark); b.position.set(Math.sin(a) * l * s * 0.45, y * s, 0); b.rotation.z = -a; g.add(b); }
      g.position.set(x, FLOOR, -34); scene.add(g);
    }
    return () => {};
  },
  /** haunted mansion silhouette with flickering windows */
  mansion(scene, FLOOR, { x = 0, z = -46, glow: gc = 0xffb050, scale = 1 } = {}) {
    const g = new THREE.Group(), wins = [];
    const add = (w, h, px, py) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), dark); b.position.set(px, py + h / 2, 0); g.add(b); return b; };
    add(26, 12, 0, 0); add(8, 22, -9, 0); add(7, 18, 10, 0);
    for (const [px, py, r, h] of [[-9, 22, 5.4, 9], [10, 18, 4.6, 8], [0, 12, 8, 6]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), dark); c.position.set(px, py + h / 2, 0); c.rotation.y = PI / 4; g.add(c); }
    for (const [px, py] of [[-12, 6], [-6, 6], [0, 7], [6, 6], [-9, 14], [10, 12], [-9, 18], [10, 15], [13, 6]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2), new THREE.MeshBasicMaterial({ color: gc, toneMapped: false })); m.position.set(px, py, 1.1); g.add(m); wins.push(m);
    }
    g.position.set(x, FLOOR - 0.2, z); g.scale.setScalar(scale); scene.add(g);
    return ({ A, env = [], hit = [] }) => wins.forEach((w, i) => { const k = Math.min(15, i * 2), on = 0.3 + 0.15 * S(A * 3 + i * 1.7) + 0.6 * (env[k] || 0) + 0.5 * (hit[k] || 0); w.material.color.setHex(gc).multiplyScalar(on); });
  },
  /** rotating disco ball with orbiting light flecks */
  discoBall(scene, { y = 4.8, z = -6, r = 1.5 } = {}) {
    const g = new THREE.Group(); g.position.set(0, y, z);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), new THREE.MeshStandardMaterial({ color: 0xcfd6e8, metalness: 0.7, roughness: 0.45, flatShading: true, emissive: 0x202838, emissiveIntensity: 0.25 }));
    g.add(ball, mesh(G.cyl, dark, 0.03, 4, 0.03, 0, r + 2, 0)); scene.add(g);
    const dots = [], cols = [0xff3fa0, 0x40c8ff, 0xffd040, 0xa060ff, 0x40ff9a];
    for (let i = 0; i < 46; i++) { const s = haze(cols[i % 5], 0.9, 0.7, [0, 0, 0]); scene.add(s); dots.push({ s, a: (i / 46) * TAU * 3 % TAU, y: -9 + (i * 0.43) % 15, rad: 11 + (i % 5) * 3, sp: 1 + (i % 2) }); }
    const hz = haze(0xaad0ff, 5, 0.04, [0, y, z]); scene.add(hz);
    return ({ t, beat, bass, kick = 0, hat = 0 }) => {
      ball.rotation.y = TAU * t * 2; g.scale.setScalar(1 + 0.08 * kick);
      for (const d of dots) { const a = d.a + TAU * t * d.sp; d.s.position.set(Math.cos(a) * d.rad, d.y + 3, -14 + Math.sin(a) * 6); d.s.material.opacity = 0.2 + 0.2 * kick + 0.7 * hat; }
      hz.material.opacity = 0.03 + 0.05 * bass;
    };
  },
  /** egyptian night: pyramids + torches */
  pyramids(scene, FLOOR) {
    const sand = new THREE.MeshBasicMaterial({ color: 0x0d0618 });
    for (const [x, s, z] of [[-18, 14, -50], [14, 20, -56], [34, 9, -46]]) { const p = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s, 4), sand); p.position.set(x, FLOOR + s / 2 - 0.2, z); p.rotation.y = PI / 4; scene.add(p); }
    const flames = [];
    for (const x of [-13, -7, 7, 13]) {
      scene.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.6, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a18 })), [x, FLOOR + 1.8, -9]));
      scene.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x6a5020, metalness: 0.7, roughness: 0.4 })), [x, FLOOR + 3.7, -9]));
      const f = haze(0xff8a20, 2.6, 0.9, [x, FLOOR + 4.4, -9]), f2 = haze(0xffd060, 1.3, 0.9, [x, FLOOR + 4.2, -9]); scene.add(f, f2); flames.push({ f, f2, x });
    }
    return ({ A, hit = [], env = [] }) => flames.forEach(({ f, f2, x }) => { const bn = Math.min(15, Math.round(((x + 13) / 26) * 15)), k = 1 + 0.12 * S(A * 9 + x) + 0.1 * S(A * 13 + x * 2) + 0.35 * (env[bn] || 0) + 0.5 * (hit[bn] || 0); f.scale.set(2.6 * k, 3.1 * k, 1); f2.scale.set(1.3 * k, 1.8 * k, 1); });
  },
  /** gothic ballroom: columns, arched moonlit windows, swinging chandeliers */
  ballroom(scene, FLOOR, { y = 2.6 } = {}) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), new THREE.MeshStandardMaterial({ color: 0x2a0f2a, roughness: 0.9, emissive: 0x120414, emissiveIntensity: 0.6 })); wall.position.set(0, 6, -16); scene.add(wall);
    const winMat = new THREE.MeshBasicMaterial({ color: 0x5a7ad0, toneMapped: false }), frame = new THREE.MeshStandardMaterial({ color: 0x0c0610, roughness: 0.8 });
    for (const x of [-24, -12, 0, 12, 24]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 9), winMat), b = new THREE.Mesh(new THREE.CircleGeometry(2.1, 20, 0, PI), winMat);
      a.position.set(x, 2.4, -15.8); b.position.set(x, 6.9, -15.8); scene.add(a, b);
      for (const [px, py, w, h] of [[0, 2.4, 0.18, 9], [0, 5, 4.3, 0.16]]) scene.add(Pm(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), frame), [x + px, py, -15.7]));
    }
    for (const x of [-18, -6, 6, 18]) { scene.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 22, 12), new THREE.MeshStandardMaterial({ color: 0x3a2040, roughness: 0.6 })), [x, 5, -13])); }
    const chans = [];
    for (const [x, ph] of [[-10, 0], [10, 1.5]]) {
      const g = new THREE.Group(); g.position.set(x, y + 3, -5);
      g.add(mesh(G.cyl, dark, 0.03, 4, 0.03, 0, 2.2, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.1, 8, 28), new THREE.MeshStandardMaterial({ color: 0xd0a040, metalness: 1, roughness: 0.3 })); ring.rotation.x = PI / 2; g.add(ring);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.add(mesh(G.cyl, std(0xf0e8d0), 0.06, 0.4, 0.06, Math.cos(a) * 1.7, 0.2, Math.sin(a) * 1.7)); g.add(sprite(0xffc060, 1.2, 0.8, [Math.cos(a) * 1.7, 0.55, Math.sin(a) * 1.7])); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.add(mesh(G.sph, std(0xcfe8ff, { emissive: 0x6080c0, emissiveIntensity: 0.6 }), 0.08, 0.2, 0.08, Math.cos(a) * 1.4, -0.5 - (i % 3) * 0.2, Math.sin(a) * 1.4)); }
      scene.add(g); chans.push({ g, ph });
    }
    return ({ A, snare = 0 }) => chans.forEach(({ g, ph }) => { g.rotation.z = 0.1 * S(A + ph) + 0.12 * snare * S(A * 12 + ph); g.rotation.y = A * 0.5; });
  },
  /** music-driven floor: a scrolling spectrogram. Columns are frequency bands (bass in the centre, highs at the edges), rows are older moments
   *  flowing toward the back, so you can see the song. palette = 4 hex colours from centre to edge. Live: ring buffer of real bands; bakes: analytic. */
  spectrum(scene, FLOOR, { palette = [0xff6a10, 0xff2fa0, 0x8a2bff, 0x30e090], FC = 23, FR = 12, FS = 1.7, hype = false } = {}) {
    const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(FS * 0.9, FS * 0.9), new THREE.MeshBasicMaterial({ toneMapped: false }), FC * FR), tm = new THREE.Matrix4(), pc = palette.map(c => new THREE.Color(c)), tc = new THREE.Color(), mid = (FC - 1) / 2;
    for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) { tm.makeRotationX(-PI / 2).setPosition((c - mid) * FS, FLOOR, 4 - r * FS); tiles.setMatrixAt(r * FC + c, tm); tiles.setColorAt(r * FC + c, pc[0]); }
    scene.add(tiles);
    const hist = []; let lastPush = 0;
    const flat = m => Array.from({ length: 16 }, (_, i) => i < 5 ? m.bass : i < 11 ? m.mid : m.high);
    // hype: tiles pop up and scale on hits, beat-locked rings ripple out from the centre, checker strobe on the kick, white-hot flashes + a glow pool
    const glow = hype ? haze(pc[1], 34, 0.3, [0, FLOOR + 0.04, -1.5]) : null; if (glow) scene.add(glow);
    const hc = new THREE.Color(0xffffff), tp = new THREE.Vector3(), tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0)), ts = new THREE.Vector3();
    return ({ t, b = 0, beat, m, kick = 0, snare = 0 }) => {
      const live = typeof window !== 'undefined' && window.oneAudio, rows = [], cur = m.env || m.bands || flat(m), hit = m.hit || [];
      if (hype) glow.material.opacity = 0.18 + 0.5 * kick + 0.2 * (beat || 0);
      if (live) { const now = performance.now(); if (now - lastPush >= 70) { lastPush = now; hist.unshift(Array.from(cur)); if (hist.length > FR) hist.pop(); } rows.push(cur); for (let r = 1; r < FR; r++) rows.push(hist[r] || hist[hist.length - 1] || cur); }
      else for (let r = 0; r < FR; r++) rows.push(music((((t - r / 64) % 1) + 1) % 1).bands);
      for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) {
        const dist = Math.abs(c - mid), band = Math.min(15, Math.round((dist / mid) * 15)), f = (dist / mid) * 3, i0 = Math.min(2, Math.floor(f)), e = Math.pow(clamp01(rows[r][band]), 1.25), h = r < 3 ? (hit[band] || 0) * (1 - r * 0.3) : 0;
        tc.copy(pc[i0]).lerp(pc[i0 + 1], f - i0).multiplyScalar((0.03 + 0.8 * e + 0.55 * h) * (1 - 0.05 * r) + 0.03 * kick);
        if (hype) {
          const d = Math.hypot(c - mid, r * 1.3), ring = Math.max(0, S(d * 0.9 - b * PI) * 0.5 + 0.5), ring2 = Math.pow(ring, 6), chk = ((c + r + Math.floor(b)) & 1) ? 1 : 0.35;
          const pop = Math.min(1.2, e * 0.9 + (hit[band] || 0) * 0.8 + kick * ring2 * 0.8);
          tc.multiplyScalar(1.2 + 0.5 * chk * kick).lerp(hc, Math.min(0.5, 0.3 * pop * pop + 0.2 * snare * ring + 0.22 * kick * ring2));
          const ac = pc[(i0 + 1) % 4], aw = 0.5 * ring2 * (0.3 + kick) + 0.12 * ring; tc.r += ac.r * aw; tc.g += ac.g * aw; tc.b += ac.b * aw;
          tp.set((c - mid) * FS, FLOOR + 0.05 + 0.45 * pop * pop + 0.25 * kick * ring2, 4 - r * FS); const sc = 1 + 0.12 * pop; ts.set(sc, sc, 1);
          tm.compose(tp, tq, ts); tiles.setMatrixAt(r * FC + c, tm);
        }
        tiles.setColorAt(r * FC + c, tc);
      }
      tiles.instanceColor.needsUpdate = true; if (hype) tiles.instanceMatrix.needsUpdate = true;
    };
  },
  /** pulsing dance-floor tiles; palette = 4 hex colours */
  floorTiles(scene, FLOOR, pal = [0xff6a10, 0xff2fa0, 0x8a2bff, 0x30e090], { FC = 22, FR = 12, FS = 1.7 } = {}) {
    const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(FS * 0.92, FS * 0.92), new THREE.MeshBasicMaterial({ toneMapped: false }), FC * FR), tm = new THREE.Matrix4(), cols = pal.map(c => new THREE.Color(c)), tc = new THREE.Color();
    for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) { tm.makeRotationX(-PI / 2).setPosition((c - (FC - 1) / 2) * FS, FLOOR, 4 - r * FS); tiles.setMatrixAt(r * FC + c, tm); tiles.setColorAt(r * FC + c, cols[0]); }
    scene.add(tiles);
    return ({ b, beat, bass }) => {
      for (let r = 0; r < FR; r++) for (let c = 0; c < FC; c++) {
        const v = 0.5 + 0.5 * S(PI * b / 2 - r * 0.7) * Math.cos(PI * b / 4 + c * 0.55), ci = ((c + r) % 2 === 0 ? 0 : 2) + (v > 0.55 ? 1 : 0);
        tc.copy(cols[ci % 4]).multiplyScalar(0.05 + 0.3 * v * v + 0.18 * beat * v + 0.05 * bass); tiles.setColorAt(r * FC + c, tc);
      }
      tiles.instanceColor.needsUpdate = true;
    };
  },
  /** sweeping spotlight cones with floor pools */
  spots(scene, FLOOR, cols = [[0xff8a20, -7], [0xff3fa0, 0], [0x40ff9a, 7]], { top = 9, z = -3 } = {}) {
    const cones = cols.map(([col, x], i) => {
      const geo = new THREE.ConeGeometry(2.6, 18, 24, 1, true); geo.translate(0, -9, 0);
      const c = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); c.position.set(x, top, z); scene.add(c);
      const pool = haze(col, 9, 0.28, [x, FLOOR + 0.05, -1]); scene.add(pool); return { c, pool, x, i };
    });
    return ({ A, kick = 0, snare = 0, hat = 0 }) => cones.forEach(({ c, pool, x, i }) => { const g = [kick, snare, hat][i % 3], a = 0.32 * S(A * 2 + i * 2.1) + 0.14 * g * S(A * 14 + i); c.rotation.z = a; pool.position.x = x + (top - FLOOR) * Math.tan(a); c.material.opacity = 0.04 + 0.025 * (0.5 + 0.5 * S(A * 4 + i)) + 0.13 * g; pool.material.opacity = 0.16 + 0.45 * g; });
  },
  /** string of party bulbs across the top */
  garland(scene, cols = [0xff7a20, 0xff3fa0, 0x9a4bff, 0x40ff9a], { y = 6.2, z = -3 } = {}) {
    const bulbs = [];
    for (let i = 0; i < 21; i++) {
      const u = i / 20, x = (u - 0.5) * 30, yy = y - 1.6 * (1 - Math.pow(2 * u - 1, 2)), col = cols[i % cols.length];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); b.position.set(x, yy, z); scene.add(b);
      const g = haze(col, 2.2, 0.35, [x, yy, z]); scene.add(g); bulbs.push({ bulb: b, g, i });
    }
    return ({ b, env = [], hit = [] }) => bulbs.forEach(({ bulb, g, i }) => { const k = Math.min(15, Math.round((i / 20) * 15)), on = 0.2 + 0.1 * S(PI * b / 2 - i * 0.6) + 0.65 * (env[k] || 0) + 0.6 * (hit[k] || 0); g.material.opacity = 0.1 + 0.5 * on; bulb.scale.setScalar(0.7 + 0.6 * on); });
  },
  bats(scene, n = 7) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.9, 0.35); sh.lineTo(0.7, 0.05); sh.lineTo(1.1, -0.1); sh.lineTo(0.6, -0.12); sh.lineTo(0.3, -0.3); sh.closePath();
    const wg = new THREE.ShapeGeometry(sh), bm = new THREE.MeshBasicMaterial({ color: 0x020005, side: THREE.DoubleSide }), bats = [];
    for (let i = 0; i < n; i++) { const g = new THREE.Group(), wR = new THREE.Mesh(wg, bm), wL = new THREE.Mesh(wg, bm); wL.scale.x = -1; g.add(wR, wL, mesh(G.sph, bm, 0.14, 0.2, 0.12)); scene.add(g); bats.push({ g, wR, wL, i }); }
    return ({ t, A }) => bats.forEach(({ g, wR, wL, i }) => {
      const u = (t * (1 + (i % 2)) + i / n) % 1, a = u * TAU;
      g.position.set(Math.cos(a) * (13 + i), 3 + 1.8 * S(a * 2 + i) + (i % 3) * 0.6, -8 + 2 * S(a)); g.rotation.y = -S(a) * 0.6;
      const fl = S(A * (14 + (i % 3) * 2) + i) * 0.7; wR.rotation.z = fl; wL.rotation.z = -fl; g.scale.setScalar(0.9 + (i % 3) * 0.25);
    });
  },
  /** low drifting ground fog */
  fog(scene, FLOOR, color = 0x8a60c0, { n = 9, opacity = 0.16, z = -4 } = {}) {
    const s = []; for (let i = 0; i < n; i++) { const h = haze(color, 12 + (i % 3) * 4, opacity, [0, FLOOR + 0.6, z - (i % 4) * 2]); scene.add(h); s.push({ h, i }); }
    return ({ t }) => s.forEach(({ h, i }) => { h.position.x = ((i / n + t * (1 + (i % 2))) % 1 - 0.5) * 44; });
  },
  /** neon sign with the event title (+ optional subtitle) */
  sign(scene, C, { y = 3.6, z = -12, width = 15, color = 0xff8a2a, emis = 0xff5a00, sub = 0xff3fa0, subEmis = 0xff2f90 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, emissive: emis, emissiveIntensity: 0.6, roughness: 0.4 });
    const t = extrudeText(C.fonts.block, String(C.event.title).toUpperCase(), { size: 2, track: 0.06, depth: 0.5, bevel: 0.05, material: m, targetWidth: width }); t.group.position.set(0, y, z); scene.add(t.group);
    if (C.event.subtitle) { const s = extrudeText(C.fonts.block, String(C.event.subtitle).toUpperCase(), { size: 1, track: 0.3, depth: 0.3, bevel: 0.03, material: new THREE.MeshStandardMaterial({ color: sub, emissive: subEmis, emissiveIntensity: 1.0 }), targetWidth: width * 0.43 }); s.group.position.set(0, y - 1.9, z); scene.add(s.group); }
    const g = haze(emis, width * 1.5, 0.12, [0, y, z - 0.5]); scene.add(g); const L = t.meshes, base = L.map(l => l.scale.clone());
    return ({ A, kick = 0, bass, env = [], hit = [] }) => { m.emissiveIntensity = 0.5 + 0.4 * kick + 0.1 * bass + 0.05 * S(A * 24); g.material.opacity = 0.09 + 0.12 * kick; L.forEach((l, i) => { const k = Math.min(15, Math.round((i / Math.max(1, L.length - 1)) * 15)), s = 1 + 0.07 * (env[k] || 0) + 0.18 * (hit[k] || 0); l.scale.set(base[i].x * s, base[i].y * s, base[i].z); l.position.y = 0.12 * (hit[k] || 0); }); };
  },
  /** standard three-point light rig; returns update that kicks the lights with the music */
  lights(scene, { a = 0xff7a20, b = 0xff3fa0, rim = 0x40ff9a, amb = 0x6a4aa0 } = {}) {
    scene.add(new THREE.AmbientLight(amb, 0.55));
    const k1 = new THREE.PointLight(a, 260, 0, 1.5); k1.position.set(-11, 6, 9); const k2 = new THREE.PointLight(b, 170, 0, 1.5); k2.position.set(11, 6, 9); const r = new THREE.PointLight(rim, 180, 0, 1.4); r.position.set(0, 4, -8);
    scene.add(k1, k2, r);
    return ({ kick = 0, snare = 0, hat = 0 }) => { r.intensity = 100 + 170 * hat; k1.intensity = 190 + 170 * kick; k2.intensity = 120 + 170 * snare; };
  },
  /** layered pine forest silhouettes */
  woods(scene, FLOOR, { n = 46, z = -34, tint = 0x05020a } = {}) {
    const m1 = new THREE.MeshBasicMaterial({ color: tint }), m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).offsetHSL(0, 0, 0.03) });
    for (let i = 0; i < n; i++) {
      const x = -75 + (i / n) * 150 + (i * 7 % 5), zz = z - (i * 13 % 7) * 4, h = 9 + (i * 17 % 9), g = new THREE.Group(), m = i % 2 ? m1 : m2;
      for (let k = 0; k < 3; k++) g.add(Pm(new THREE.Mesh(new THREE.ConeGeometry(2.6 - k * 0.6, h * 0.5, 7), m), [0, h * (0.28 + k * 0.22), 0]));
      g.position.set(x, FLOOR - 0.3, zz); scene.add(g);
    }
    return () => {};
  },
  /** bubbling cauldron over a fire */
  cauldron(scene, FLOOR, { x = 0, z = -3, color = 0x40ff60, s = 1 } = {}) {
    const g = new THREE.Group(); g.position.set(x, FLOOR, z); g.scale.setScalar(s); scene.add(g);
    const iron = new THREE.MeshStandardMaterial({ color: 0x14141a, metalness: 0.8, roughness: 0.4 });
    g.add(mesh(G.sph, iron, 1.4, 1.1, 1.4, 0, 1.25, 0));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 8, 28), iron); rim.rotation.x = PI / 2; rim.position.y = 2.15; g.add(rim);
    const liq = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28), new THREE.MeshBasicMaterial({ color, toneMapped: false })); liq.rotation.x = -PI / 2; liq.position.y = 2.12; g.add(liq);
    for (const a of [0.5, 2.6, 4.7]) g.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), iron), [Math.cos(a) * 0.95, 0.25, Math.sin(a) * 0.95]));
    const glowS = haze(color, 7, 0.3, [0, 2.6, 0.5]); g.add(glowS); const fire = haze(0xff7a20, 3, 0.5, [0, 0.4, 0.5]); g.add(fire);
    const lt = new THREE.PointLight(color, 40, 0, 1.6); lt.position.set(0, 3, 1); g.add(lt);
    const bub = []; for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.9 })); g.add(b); bub.push(b); }
    const steam = []; for (let i = 0; i < 6; i++) { const sp = haze(color, 2.4, 0.18, [0, 3, 0]); g.add(sp); steam.push(sp); }
    return ({ t, beat, bass, kick = 0, bassF = 0 }) => {
      bub.forEach((b, i) => { const u = (t * (2 + (i % 3)) + i / 10) % 1, a = i * 2.1; b.position.set(Math.cos(a) * 0.8 * (0.3 + 0.7 * ((i * 0.37) % 1)), 2.12 + u * (1.2 + 1.8 * kick), Math.sin(a) * 0.8 * (0.3 + 0.7 * ((i * 0.37) % 1))); b.scale.setScalar(0.6 + 0.8 * Math.sin(u * PI)); b.material.opacity = 0.9 * Math.sin(u * PI); });
      steam.forEach((sp, i) => { const u = (t * 2 + i / 6) % 1; sp.position.set(Math.sin(u * 6 + i) * 0.5, 2.4 + u * 3.5, 0.2); sp.material.opacity = 0.2 * Math.sin(u * PI) * (0.7 + beat); sp.scale.setScalar(2 + u * 2.5); });
      glowS.material.opacity = 0.2 + 0.4 * kick + 0.12 * bassF; lt.intensity = 25 + 90 * kick; fire.scale.set(3 + 0.5 * S(t * TAU * 7), 3 + 0.6 * S(t * TAU * 9 + 1), 1);
    };
  },
  /** mad-scientist lab: back wall, tesla coils with lightning arcs, glowing jars, storm window */
  lab(scene, FLOOR, { arc = 0xaee8ff } = {}) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 36), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9, emissive: 0x08121c, emissiveIntensity: 0.7 })); wall.position.set(0, 4, -15); scene.add(wall);
    for (let i = -7; i <= 7; i++) scene.add(Pm(new THREE.Mesh(new THREE.BoxGeometry(0.1, 30, 0.1), new THREE.MeshStandardMaterial({ color: 0x0a1018 })), [i * 6, 4, -14.9]));
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, toneMapped: false, transparent: true, opacity: 0.2 })); flash.position.set(0, 4.8, -14.7); scene.add(flash);
    scene.add(Pm(new THREE.Mesh(new THREE.BoxGeometry(9.6, 9.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x080c12 })), [0, 4.8, -14.9]));
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a98a8, metalness: 1, roughness: 0.25 }), coils = [];
    for (const x of [-10.5, 10.5]) {
      const g = new THREE.Group(); g.position.set(x, FLOOR, -8); scene.add(g);
      g.add(mesh(G.cyl, steel, 0.9, 0.5, 0.9, 0, 0.25, 0), mesh(G.cyl, std(0x3a2a20), 0.55, 4.6, 0.55, 0, 2.7, 0));
      for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.55 + 0.06 * (i % 2), 0.07, 6, 18), steel); r.rotation.x = PI / 2; r.position.y = 1 + i * 0.6; g.add(r); }
      const top = mesh(G.sph, steel, 0.85, 0.85, 0.85, 0, 5.4, 0); g.add(top);
      const halo = haze(arc, 4, 0.3, [0, 5.4, 0]); g.add(halo); coils.push({ x, top: new THREE.Vector3(x, FLOOR + 5.4, -8), halo });
    }
    const NA = 5, NS = 12, arcs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: arc, toneMapped: false }), NA * NS), dm = new THREE.Object3D();
    scene.add(arcs); arcs.frustumCulled = false;
    const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
    const jars = []; for (let i = 0; i < 8; i++) {
      const col = [0x40ff60, 0xff3fa0, 0x40c8ff, 0xffc040][i % 4], x = -9 + i * 2.6, y = FLOOR + 3.4 + (i % 2) * 2.2;
      scene.add(Pm(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1), std(0x2a2018)), [x, y - 0.1, -14.2]));
      scene.add(Pm(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })), [x, y + 0.6, -14.2]));
      const gl = haze(col, 2.4, 0.3, [x, y + 0.6, -14]); scene.add(gl); jars.push({ gl, i });
    }
    return ({ t, A, beat, bass, kick = 0, snare = 0, env = [] }) => {
      const fr = Math.floor(t * 40), on = hash(fr * 7) > 0.3 || kick > 0.4;
      let n = 0;
      const seg = (a, b, w, amp, seed) => {
        for (let k = 0; k < NS; k++) {
          const u0 = k / NS, u1 = (k + 1) / NS, p = u => { const j = u * (1 - u) * 4 * amp; return new THREE.Vector3(a.x + (b.x - a.x) * u + (hash(seed + k * 3 + (u === u1 ? 3 : 0)) - 0.5) * j * (k === 0 && u === u0 ? 0 : 1), a.y + (b.y - a.y) * u + (hash(seed + k * 5 + 1 + (u === u1 ? 5 : 0)) - 0.5) * j, a.z + (b.z - a.z) * u + (hash(seed + k * 7 + 2) - 0.5) * j * 0.3); };
          const p0 = p(u0), p1 = p(u1), len = p0.distanceTo(p1) || 0.001;
          dm.position.copy(p0).add(p1).multiplyScalar(0.5); dm.lookAt(p1); dm.scale.set(on ? w : 0, on ? w : 0, len); dm.updateMatrix(); arcs.setMatrixAt(n++, dm.matrix);
        }
      };
      const A0 = coils[0].top, A1 = coils[1].top, mid = new THREE.Vector3(0, FLOOR, -3);
      seg(A0, A1, 0.06 + 0.08 * snare, 1.6 + 1.5 * kick, fr * 31); seg(A0, A1, 0.04, 2.2, fr * 31 + 99);
      seg(A0, new THREE.Vector3(-4 + hash(fr) * 4, FLOOR + 0.1, -4), 0.05, 1.2, fr * 17 + 5); seg(A1, new THREE.Vector3(4 - hash(fr + 9) * 4, FLOOR + 0.1, -4), 0.05, 1.2, fr * 13 + 7);
      seg(A0.clone().lerp(A1, 0.5), mid, 0.04, 1, fr * 5 + 3);
      arcs.instanceMatrix.needsUpdate = true;
      coils.forEach(c => { c.halo.material.opacity = 0.1 + 0.2 * (on ? 1 : 0.2) * (0.5 + beat); });
      flash.material.opacity = 0.03 + 0.4 * snare * (hash(fr * 3) > 0.4 ? 1 : 0.3) + 0.2 * kick;
      jars.forEach(({ gl, i }) => { gl.material.opacity = 0.12 + 0.1 * S(A * 3 + i) + 0.7 * (env[Math.min(15, i * 2)] || 0); });
    };
  },
  /** harvest: cornfield rows, hay bales, big low harvest moon is added by stage.sky */
  cornfield(scene, FLOOR, { rows = 7, z0 = -11 } = {}) {
    const stalks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.11, 6.4, 5), new THREE.MeshBasicMaterial({ color: 0x4a4a12 }), rows * 60), leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x3a4a14 }), rows * 60 * 3), tm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    let n = 0, nl = 0;
    for (let r = 0; r < rows; r++) for (let i = 0; i < 60; i++) {
      const x = -42 + i * 1.45 + (r % 2) * 0.7 + (Math.sin(i * 12.9 + r * 4.1) * 0.4), z = z0 - r * 3, hs = 0.85 + 0.3 * ((i * 7 + r * 3) % 5) / 5;
      stalks.setMatrixAt(n++, tm.compose(v.set(x, FLOOR + 3.2 * hs, z), q.identity(), sc.set(1, hs, 1)));
      for (let k = 0; k < 3; k++) { e.set(0, ((i + k) % 2 ? 1 : -1) * 0.5, ((i + k) % 2 ? 1 : -1) * 0.35); q.setFromEuler(e); leaves.setMatrixAt(nl++, tm.compose(v.set(x + ((i + k) % 2 ? 0.5 : -0.5), FLOOR + (1.6 + k * 1.3) * hs, z), q, sc.set(1, 1, 1))); }
    }
    scene.add(stalks, leaves);
    const straw = std(0xc8a040, { roughness: 1, emissive: 0x302008, emissiveIntensity: 0.5 });
    for (const [x, z] of [[-14, -7], [15, -7.5], [-17.5, -2], [17.5, -2.5]]) {
      const b = Pm(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.8, 16), straw), [x, FLOOR + 1.1, z], [0, 0, PI / 2]); b.rotation.y = 0.3; scene.add(b);
      for (const k of [-0.5, 0.5]) { const band = Pm(new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 20), std(0x6a4a1a)), [x + k, FLOOR + 1.1, z], [0, PI / 2, 0]); scene.add(band); }
    }
    return ({ A }) => { stalks.rotation.z = leaves.rotation.z = 0.004 * S(A * 2); };
  },
  /** embers/spores floating up (uses the shared particle shader) */
  camera(st, { x = 1.6, y = 0.9, z = 15.5, look = [0, -0.4, 0] } = {}) {
    return ({ A, kick = 0, snare = 0 }) => { st.camera.position.set(x * S(A) + 0.07 * kick * S(A * 53), y + 0.35 * Math.cos(A) - 0.09 * kick, z - 0.2 * snare); st.camera.lookAt(...look); };
  },
};
