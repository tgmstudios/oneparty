// Shared parts for the pop / pop-punk / dance scenes (43-47). Everything is periodic in t (integer cycles per loop) so previews and bakes loop.
import { THREE, TAU, extrudeText, rng } from './lib.js';
import { haze } from './lib2.js';

export const clamp01 = v => Math.min(1, Math.max(0, v));
/** normalised audio hits from music(t): kick/snare/hat onset envelopes, bass, per-band env/hit */
export const K = m => ({ kick: clamp01(m.kick ?? m.beat ?? 0), snare: clamp01(m.snare ?? 0), hat: clamp01(m.hat ?? 0), bass: clamp01(m.bass ?? 0), beat: clamp01(m.beat ?? 0), env: m.env || m.bands || [], hit: m.hit || [] });
const band = (arr, u) => arr[Math.min(15, Math.max(0, Math.round(u * 15)))] || 0;
export { band };

/** DAWGHOUSE as extruded 3D letters that belong to the set: emissive pulse on the kick, each letter hops with its own frequency band. */
export function dawgSign(scene, C, { text = 'DAWGHOUSE', width = 14, pos = [0, 5, -10], color = 0xffffff, emis = 0xff2fa0, size = 2, depth = 0.7, hop = 0.35, glow = true, metal = 0.2 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: emis, emissiveIntensity: 0.9, roughness: 0.35, metalness: metal });
  const t = extrudeText(C.fonts.block, text, { size, track: 0.1, depth, bevel: 0.05, material: mat, targetWidth: width });
  t.group.position.set(...pos); scene.add(t.group);
  const g = glow ? haze(emis, width * 1.2, 0.1, [pos[0], pos[1], pos[2] - 0.7]) : null; if (g) scene.add(g);
  const n = t.meshes.length, ly = t.meshes.map(m => m.position.y), lh = hop / t.k;
  return {
    group: t.group, height: t.height, mat,
    update(m) {
      const k = K(m); mat.emissiveIntensity = 0.6 + 0.9 * k.kick + 0.3 * k.bass;
      if (g) g.material.opacity = 0.06 + 0.16 * k.kick;
      t.meshes.forEach((l, i) => { const e = band(k.env, i / (n - 1)) + band(k.hit, i / (n - 1)) * 0.6; l.position.y = ly[i] + lh * (0.25 * k.kick + 0.35 * Math.min(1, e)); l.rotation.z = 0.05 * (k.snare) * ((i % 2) ? 1 : -1); });
    },
  };
}

/** a rig of additive light beams. mk(i) -> { color, x, y, z, len, r, sway:[ax,ay], f:[fz,fx] (integer cycles/loop), ph, kind:'kick'|'snare'|'hat' } */
export function beams(scene, list) {
  const items = list.map((o, i) => {
    const geo = new THREE.ConeGeometry(o.r ?? 0.6, o.len ?? 30, 20, 1, true); geo.translate(0, -(o.len ?? 30) / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    const m = new THREE.Mesh(geo, mat); m.position.set(o.x, o.y, o.z); scene.add(m);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: o.color, toneMapped: false })); lamp.position.copy(m.position); scene.add(lamp);
    return { m, mat, lamp, o };
  });
  return {
    items,
    update(a, m) {
      const k = K(m);
      items.forEach(({ m: b, mat, lamp, o }, i) => {
        const [ax, ay] = o.sway || [0.4, 0.3], [fz, fx] = o.f || [1, 2], ph = o.ph ?? i * 0.9, hit = o.kind === 'snare' ? k.snare : o.kind === 'hat' ? k.hat : k.kick;
        b.rotation.z = (o.bz ?? 0) + ax * Math.sin(a * fz + ph) + 0.12 * hit * Math.sin(a * 16 + i);
        b.rotation.x = (o.bx ?? 0) + ay * Math.sin(a * fx + ph * 1.3);
        mat.opacity = 0.04 + 0.03 * Math.sin(a * 3 + i) + 0.22 * hit; lamp.scale.setScalar(1 + 1.2 * hit);
      });
    },
  };
}

/** instanced LED wall; paint(c, r, u, v, out:Color, a, k) fills each cell's colour every frame. A plane at `pos`, size cols*cell x rows*cell. */
export function ledWall(scene, { cols = 36, rows = 16, cell = 0.6, pos = [0, 4, -12], rot = [0, 0, 0], gap = 0.86 } = {}, paint) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell * gap, cell * gap), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), cols * rows), mx = new THREE.Matrix4(), c = new THREE.Color();
  const grp = new THREE.Group(); grp.position.set(...pos); grp.rotation.set(...rot);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { mx.setPosition((q - (cols - 1) / 2) * cell, (r - (rows - 1) / 2) * cell, 0); mesh.setMatrixAt(r * cols + q, mx); mesh.setColorAt(r * cols + q, c.set(0)); }
  grp.add(mesh); scene.add(grp);
  return { group: grp, width: cols * cell, height: rows * cell, update(a, m) { const k = K(m); for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { paint(q, r, q / (cols - 1), r / (rows - 1), c, a, k); mesh.setColorAt(r * cols + q, c); } mesh.instanceColor.needsUpdate = true; } };
}

/** confetti / streamers falling (or rising) in a box, `bursts` pops of extra speed are not needed: pure periodic fall. cyc = loops per cycle (integer). */
export function confetti(scene, { count = 320, box = [26, 16, 14], center = [0, 4, 0], colors = [0xff2fa0, 0x30d0ff, 0xffd040, 0x8a50ff, 0xffffff], size = 0.26, cyc = [1, 2], seed = 5, dir = -1 } = {}) {
  const R = rng(seed), mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size * 0.55), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), count), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const P = Array.from({ length: count }, (_, i) => { mesh.setColorAt(i, new THREE.Color(colors[i % colors.length])); return { x: (R() - 0.5) * box[0], z: (R() - 0.5) * box[2], o: R(), c: cyc[Math.floor(R() * cyc.length)], sx: 2 + Math.floor(R() * 4), sp: R() * TAU, w: 0.4 + R() * 0.8 }; });
  scene.add(mesh);
  return {
    mesh,
    update(t, k) {
      P.forEach((o, i) => {
        const u = (((t * o.c + o.o) % 1) + 1) % 1, y = center[1] + box[1] * (dir < 0 ? 0.5 - u : u - 0.5);
        p.set(center[0] + o.x + 0.7 * Math.sin(TAU * (t * o.c * 2 + o.o) + o.sp), y, center[2] + o.z);
        e.set(TAU * (t * o.sx) + o.sp, TAU * (t * o.sx * 0.5) + o.sp * 2, o.sp); q.setFromEuler(e); s.setScalar(1 + 0.6 * k.kick * o.w);
        mx.compose(p, q, s); mesh.setMatrixAt(i, mx);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** a crowd of dark silhouettes bobbing on the beat with hands up. rows of heads + raised arms, lit only by rim from the stage. */
export function crowd(scene, { x0 = -16, x1 = 16, rows = [[0, 11, -3.0], [0, 13.5, -3.3]], per = 22, seed = 3, color = 0x0a0612, y = -3.0 } = {}) {
  const R = rng(seed), n = rows.length * per, mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 8), mat, n), bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.42, 1.0, 4, 8), mat, n), arms = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.09, 0.9, 3, 6), mat, n * 2);
  const P = []; rows.forEach(([, z], ri) => { for (let i = 0; i < per; i++) P.push({ x: x0 + (x1 - x0) * ((i + 0.5 + (R() - 0.5) * 0.7) / per), z: z + (R() - 0.5) * 0.8, h: 0.9 + R() * 0.35, ph: Math.floor(R() * 4) / 4, up: R() < 0.55, f: R() < 0.5 ? 1 : 2, row: ri }); });
  scene.add(heads, bodies, arms);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    update(t, k) {
      P.forEach((o, i) => {
        const b = Math.abs(Math.sin(Math.PI * (t * 16 * o.f + o.ph))) * (0.12 + 0.3 * k.kick), sway = 0.06 * Math.sin(TAU * (t * 2 + o.ph)), by = y + o.row * 0.35 + b;
        s.set(1, o.h, 1); p.set(o.x, by + 0.9 * o.h, o.z); q.identity(); mx.compose(p, q, s); bodies.setMatrixAt(i, mx);
        s.set(1, 1, 1); p.set(o.x + sway, by + 2.0 * o.h, o.z); mx.compose(p, q, s); heads.setMatrixAt(i, mx);
        for (let a = 0; a < 2; a++) {
          const side = a ? 1 : -1, up = o.up ? 1 : 0.2, wave = o.up ? 0.5 * Math.sin(TAU * (t * 4 * o.f + o.ph + a * 0.3)) * (0.4 + k.snare) : 0;
          p.set(o.x + side * 0.5 + sway, by + (1.5 + 0.55 * up) * o.h, o.z); e.set(0, 0, side * (0.35 + 0.2 * (1 - up)) + wave * side); q.setFromEuler(e); s.set(1, 0.6 + 0.8 * up, 1); mx.compose(p, q, s); arms.setMatrixAt(i * 2 + a, mx);
        }
      });
      heads.instanceMatrix.needsUpdate = bodies.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
    },
  };
}

/** speaker stack: cabinet with two woofer cones that punch on the kick. returns update */
export function speaker(scene, { pos = [0, 0, 0], w = 2.4, h = 4.6, d = 1.6, rot = 0, woofer = 0.8, trim = 0xff2fa0 } = {}) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.y = rot; scene.add(g);
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x120e16, roughness: 0.8 })); g.add(box);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06), new THREE.MeshBasicMaterial({ color: trim, toneMapped: false })); rim.position.y = h / 2; g.add(rim);
  const cones = [-1, 1].map(s => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(woofer, 0.07, 8, 28), new THREE.MeshBasicMaterial({ color: trim, toneMapped: false })); ring.position.set(0, s * h * 0.22, d / 2 + 0.02); g.add(ring);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(woofer * 0.95, 28), new THREE.MeshStandardMaterial({ color: 0x24202c, roughness: 0.6, emissive: trim, emissiveIntensity: 0.1 })); cone.position.set(0, s * h * 0.22, d / 2 + 0.03); g.add(cone);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(woofer * 0.32, 14, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3444, roughness: 0.4, emissive: trim, emissiveIntensity: 0.1 })); dome.rotation.x = Math.PI / 2; dome.position.set(0, s * h * 0.22, d / 2 + 0.04); g.add(dome);
    return { cone, dome };
  });
  return { group: g, update(k) { cones.forEach(({ cone, dome }, i) => { const p = 1 + 0.12 * k.kick; cone.scale.setScalar(p); cone.material.emissiveIntensity = 0.05 + 0.5 * k.kick; dome.scale.setScalar(1 + 0.4 * k.kick * (i ? 1 : 0.8)); dome.position.z = (i ? 1 : 1) * (d / 2 + 0.04 + 0.12 * k.kick); }); g.scale.setScalar(1 + 0.012 * k.kick); } };
}
