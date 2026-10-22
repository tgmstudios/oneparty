import { THREE, TAU, studio, pbr, lacquer, emission, mesh, ball, tube, ring } from './halloween-kit.js?v=2';
import { music, particles } from './lib2.js';
import { extrudeText } from './lib.js';

function eventWord(parent,C,width,material,pos,size=0.82){const g=extrudeText(C.fonts.block,'DAWGHOUSE',{size,track:.08,targetWidth:width,depth:.16,bevel:.035,material}).group;g.position.set(...pos);parent.add(g);return g;}

function porcelainDoll(k, x, y, z, scale, dress, hair, tilt = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); g.rotation.z = tilt; k.scene.add(g);
  const skin = lacquer(0xe7c8ad, { roughness: 0.32 }), blush = pbr(0xb76672, 0.65), eye = lacquer(0x17202a, { roughness: 0.1 });
  const cloth = lacquer(dress, { roughness: 0.38 }), lace = pbr(0xe8d6bd, 0.58), hairMat = lacquer(hair, { roughness: 0.27 });
  // flared skirt, ribbed bodice and the little porcelain face
  mesh(g, new THREE.CylinderGeometry(0.24, 0.82, 1.15, 12, 1), cloth, [0, -0.55, 0]);
  mesh(g, new THREE.CylinderGeometry(0.54, 0.78, 0.12, 16), lace, [0, -1.06, 0]);
  ball(g, cloth, [0, 0.18, 0], [0.43, 0.58, 0.28]);
  ball(g, skin, [0, 1.08, 0.02], [0.54, 0.65, 0.48]);
  ball(g, hairMat, [0, 1.47, -0.04], [0.58, 0.42, 0.5]);
  for (const s of [-1, 1]) {
    ball(g, hairMat, [s * 0.5, 1.02, 0], [0.18, 0.66, 0.35]);
    ball(g, eye, [s * 0.2, 1.13, 0.445], [0.105, 0.145, 0.045]);
    ball(g, pbr(0xf7eee2), [s * 0.2, 1.15, 0.49], [0.035, 0.045, 0.018]);
    ball(g, blush, [s * 0.35, 0.91, 0.425], [0.12, 0.075, 0.028]);
    const arm = tube(g, [[s * 0.32, 0.45, 0], [s * 0.66, 0.12, 0.03], [s * 0.58, -0.3, 0.1]], 0.085, skin);
    ball(g, skin, [s * 0.58, -0.3, 0.1], [0.12, 0.14, 0.11]);
    tube(g, [[s * 0.23, -1.03, 0], [s * 0.25, -1.43, 0.02], [s * 0.4, -1.68, 0.15]], 0.09, skin);
    ball(g, pbr(0x342333), [s * 0.4, -1.69, 0.16], [0.24, 0.12, 0.32]);
  }
  // painted mouth, lace collar, and glass buttons
  ball(g, pbr(0x743c4b), [0, 0.83, 0.47], [0.09, 0.035, 0.025]);
  ring(g, 0.2, 0.045, lace, [0, 0.59, 0]);
  for (let i = 0; i < 3; i++) ball(g, k.glow2, [0, 0.3 - i * 0.23, 0.27], [0.055, 0.055, 0.04]);
  return g;
}

export function dollhouse(st, C) {
  const k = studio(st, C, { accent: 0xc477aa, secondary: 0x76b8bb, bg: 0x100d18, title: false });
  const hero = porcelainDoll(k, 0, 1.1, 0, 1.2, 0x71344f, 0x231c2a, -0.05);
  const side = [porcelainDoll(k, -6.4, 0.25, -5, 0.72, 0x416b72, 0x211923, 0.05), porcelainDoll(k, 6.5, 0.2, -6, 0.76, 0x98613b, 0x3c2228, -0.06)];
  // Three open-backed dollhouse frames establish a stage without hiding the figures.
  const wood = pbr(0x593447, 0.42, 0.25), trim = k.metal;
  for (let n = 0; n < 3; n++) {
    const x = (n - 1) * 6.5, z = -8 - Math.abs(n - 1) * 2;
    for (const s of [-1, 1]) mesh(k.scene, new THREE.BoxGeometry(0.16, 6.8, 0.24), wood, [x + s * 2.7, 0.1, z]);
    mesh(k.scene, new THREE.BoxGeometry(5.55, 0.18, 0.28), wood, [x, 3.5, z]);
    mesh(k.scene, new THREE.BoxGeometry(5.55, 0.16, 0.28), wood, [x, -3.3, z]);
    for (const s of [-1, 1]) { ball(k.scene, k.glow2, [x + s * 2.72, 3.48, z + 0.18], [0.12, 0.12, 0.12]); }
    const sig = ring(k.scene, 2.4, 0.035, n === 1 ? k.glow : k.glow2, [x, 0.15, z + 0.1]); sig.rotation.x = Math.PI / 2;
  }
  // Set the sign directly into the middle room's lintel, centered on its full width.
  mesh(k.scene,new THREE.BoxGeometry(5.55,0.86,0.3),wood,[0,4.65,-7.68]);
  const dollWord=eventWord(k.scene,C,4.75,k.glow2,[0,4.65,-7.48],0.78);
  for(const x of [-2.62,2.62])mesh(k.scene,new THREE.BoxGeometry(0.16,0.72,0.26),wood,[x,3.86,-7.68]);
  const dollWordBase=dollWord.scale.clone();
  const dust = particles({ count: 140, seed: 38, box: [30, 15, 18], center: [0, 2, -4], color: 0xe8b5d0, size: 0.045, opacity: 0.55, H: C.H, travel: 10, sway: 0.45 }); k.scene.add(dust);
  return { update(t) {
    const a = TAU * t, m = music(t);
    const pulse=1+0.025*m.beat;dollWord.scale.set(dollWordBase.x*pulse,dollWordBase.y*pulse,dollWordBase.z*pulse);
    hero.rotation.y = 0.16 * Math.sin(a); hero.rotation.z = -0.05 + 0.035 * Math.sin(2 * a); hero.position.y = 1.1 + 0.1 * Math.sin(2 * a);
    side[0].rotation.y = 0.15 * Math.sin(a + 1); side[1].rotation.y = 0.15 * Math.sin(a + 3);
    st.camera.position.set(0, 1.5 + 0.35 * Math.cos(a * 2), 27 + 0.5 * Math.sin(a)); st.camera.lookAt(0, 0.7, -2);
    k.tick(t, m); dust.userData.u.uT.value = t;
  } };
}

function clownFigure(k, x, z, scale, suit, hair, phase = 0) {
  const g = new THREE.Group(); g.position.set(x, 0.2, z); g.scale.setScalar(scale); k.scene.add(g);
  const skin = pbr(0xf1d7bc, 0.58), paint = pbr(0xb41e31, 0.35), black = pbr(0x171520, 0.28), cloth = lacquer(suit, { roughness: 0.32 });
  ball(g, cloth, [0, -0.35, 0], [0.62, 1.05, 0.45]);
  ball(g, skin, [0, 1.35, 0], [0.68, 0.74, 0.57]);
  // swept hair tufts and a tapered party hat
  for (const s of [-1, 1]) { const puff = ball(g, lacquer(hair, { roughness: 0.28 }), [s * 0.66, 1.58, 0], [0.44, 0.33, 0.4]); puff.rotation.z = s * -0.5; }
  const hat = mesh(g, new THREE.ConeGeometry(0.48, 1.15, 24), cloth, [0, 2.08, 0]); hat.rotation.z = 0.15;
  ball(g, k.glow, [0.07, 2.64, 0.02], [0.18, 0.18, 0.18]);
  for (const s of [-1, 1]) {
    ball(g, black, [s * 0.23, 1.47, 0.5], [0.105, 0.13, 0.06]);
    ball(g, pbr(0xfffaf0), [s * 0.23, 1.5, 0.55], [0.035, 0.045, 0.025]);
    ball(g, paint, [s * 0.46, 1.18, 0.44], [0.19, 0.14, 0.065]);
    const arm = new THREE.Group(); arm.position.set(s * 0.45, 0.2, 0); g.add(arm);
    tube(arm, [[0, 0.2, 0], [s * 0.55, -0.1, 0.05], [s * 0.8, -0.55, 0.08]], 0.16, cloth);
    ball(arm, skin, [s * 0.8, -0.55, 0.08], [0.2, 0.22, 0.17]);
    arm.userData.side = s; (g.userData.arms ||= []).push(arm);
  }
  ball(g, paint, [0, 1.24, 0.56], [0.24, 0.27, 0.25]);
  // pleated ruff, oversized buttons and baggy trouser legs
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ball(g, i % 2 ? pbr(0xf2e5d2) : paint, [0.61 * Math.cos(a), 0.82, 0.51 * Math.sin(a)], [0.18, 0.2, 0.14]); }
  for (const s of [-1, 1]) { ball(g, cloth, [s * 0.29, -1.25, 0], [0.34, 0.72, 0.39]); ball(g, black, [s * 0.35, -1.93, 0.1], [0.48, 0.16, 0.58]); }
  for (let i = 0; i < 3; i++) ball(g, k.glow2, [0, 0.4 - i * 0.4, 0.44], [0.07, 0.07, 0.05]);
  g.userData.phase = phase; return g;
}

export function clownMidway(st, C) {
  const k = studio(st, C, { accent: 0xf34b34, secondary: 0x4f9ed4, bg: 0x0c0b17, title: false });
  const clowns = [clownFigure(k, 0, 0, 1.25, 0x9d1934, 0xffbd43), clownFigure(k, -7.2, -5, 0.76, 0x31578e, 0xc73a6a, 2), clownFigure(k, 7.3, -6, 0.8, 0x5f397f, 0x4ea46f, 4)];
  // A striped big-top canopy, radial pennants, bulbs and a ringmaster's brass hoop.
  const canopy = new THREE.Group(); canopy.position.set(0, 4.15, -7); k.scene.add(canopy);
  mesh(canopy, new THREE.ConeGeometry(7.4, 2.5, 12, 1, true), pbr(0x4d253a, 0.45), [0, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, stripe = mesh(canopy, new THREE.ConeGeometry(7.42, 2.52, 1, 1, true, a, TAU / 12), i % 2 ? pbr(0x9e293a, 0.4) : pbr(0x24375c, 0.42), [0, 0, 0]);
    ball(canopy, i % 2 ? k.glow : k.glow2, [7.15 * Math.cos(a), -1.2, 7.15 * Math.sin(a)], [0.13, 0.13, 0.13]);
  }
  // Lettering is part of the big top's front valance, above the ringmaster.
  mesh(canopy,new THREE.BoxGeometry(5.8,0.82,0.24),pbr(0x201426,0.3,0.56),[0,-0.7,7.18]);
  const midwayWord=eventWord(canopy,C,4.8,k.glow,[0,-0.7,7.34],0.88);
  const midwayWordBase=midwayWord.scale.clone();
  const hoop = ring(k.scene, 4.2, 0.09, k.glow, [0, -1.9, 2.5]); hoop.rotation.x = Math.PI / 2;
  const balloons = [];
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * TAU, balloon = new THREE.Group(); balloon.position.set(8.5 * Math.cos(a), 1.2 + (i % 3) * 0.5, -3 + 4 * Math.sin(a)); k.scene.add(balloon);
    ball(balloon, i % 2 ? k.glow : k.glow2, [0, 0, 0], [0.28, 0.39, 0.26]);
    tube(balloon, [[0, -0.35, 0], [0.08, -0.75, 0.02], [0, -1.1, 0]], 0.012, k.metal);
    balloons.push(balloon);
  }
  const dust = particles({ count: 130, seed: 39, box: [34, 18, 20], center: [0, 3, -5], color: 0xffca78, size: 0.05, opacity: 0.48, H: C.H, travel: 12, sway: 0.5 }); k.scene.add(dust);
  return { update(t) {
    const a = TAU * t, m = music(t);
    const pulse=1+0.025*m.beat;midwayWord.scale.set(midwayWordBase.x*pulse,midwayWordBase.y*pulse,midwayWordBase.z*pulse);
    clowns.forEach((g, i) => { const p = g.userData.phase; g.position.y = 0.2 + 0.12 * Math.sin(a * 2 + p); g.rotation.y = 0.18 * Math.sin(a + p); g.userData.arms.forEach((arm, n) => { arm.rotation.z = arm.userData.side * (0.12 + 0.2 * Math.sin(a * 2 + p + n)); }); });
    canopy.rotation.y = 0.025 * Math.sin(a); balloons.forEach((b, i) => { b.position.y = 1.2 + (i % 3) * 0.5 + 0.28 * Math.sin(a * 2 + i); b.rotation.z = 0.12 * Math.sin(a + i); });
    hoop.rotation.z = a; st.camera.position.set(0, 1.8 + 0.35 * Math.cos(a * 2), 28 + 0.7 * Math.sin(a)); st.camera.lookAt(0, 0.6, -2); k.tick(t, m); dust.userData.u.uT.value = t;
  } };
}
