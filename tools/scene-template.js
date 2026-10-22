import { THREE, TAU } from '../lib.js';
import { particles, haze } from '../lib2.js';

// Scene template. Copy, edit, then:  node tools/op.mjs new <id> <file> --title "Name" --palette "#ff2fa0,#4a5cff,#8a2bff" --show
// Contract:
//   build(st, C) -> { update(t, frame) }
//   st = { scene, camera, renderer, bloom, composer, W, H }   (three.js; add to st.scene, move st.camera)
//   C  = { W, H, fonts: { block, script }, event: { title, subtitle, theme } }   (use C.event.title for text; never hard-code names)
//   t in [0,1) is ONE seamless loop (16 beats at the current BPM): everything must be periodic in t (use TAU * t, integer multiples),
//   so scenes loop and bake cleanly. Audio reactivity (bloom/exposure/zoom) is added by the display host - no audio code here.
// Helpers: ../lib.js (THREE, TAU, rng, layoutText, extrudeText, tubesFromContours, shapeContours, makeEnv, chrome, gradTex, radialTex)
//          ../lib2.js (particles, haze, glowSprite, rimLight, skyGradient, fbm, lavaTextures, brickTexture)
export async function build(st, C) {
  const { scene, camera, renderer } = st;
  scene.background = new THREE.Color(0x020106);
  st.bloom.strength = 1.1; st.bloom.radius = 0.8; st.bloom.threshold = 0.6;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.12, 16, 128),
    new THREE.MeshBasicMaterial({ color: 0xff2fa0, toneMapped: false }),
  );
  scene.add(ring);
  scene.add(haze(0x8a2bff, 60, 0.18, [0, 0, -10]));
  const dust = particles({ count: 300, seed: 7, box: [30, 16, 12], center: [0, 0, 0], color: 0x9fe8ff, size: 0.08, dir: [0, 1, 0], travel: 14, sway: 0.8, opacity: 0.9, H: C.H, cycles: [1, 2] });
  scene.add(dust);

  return {
    update(t) {
      const a = TAU * t;
      ring.rotation.x = 0.6 * Math.sin(a); ring.rotation.y = a;
      ring.scale.setScalar(1 + 0.08 * Math.sin(2 * a));
      camera.position.set(2 * Math.sin(a), 1 + 0.4 * Math.cos(a), 16); camera.lookAt(0, 0, 0);
      dust.userData.u.uT.value = t;
    },
  };
}
