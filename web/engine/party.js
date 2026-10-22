import { THREE } from './lib.js';
import { particles } from './lib2.js';
import { createKit, stage } from './dancers.js';

// Party theme engine. A dance-party scene is just a config; this builds it from the shared assets in dancers.js.
//
//   import { partyScene } from '../party.js';
//   export const build = partyScene({
//     bg: 0x07010d, fog: [0x07010d, 0.016], bloom: [0.42, 0.5, 0.86],         // scene colour, fog [colour, density], bloom [strength, radius, threshold]
//     lights: { a, b, rim, amb },                                            // two key lights, a rim light, ambient (hex)
//     stage: [ ['sky', {...}], ['woods', {...}], ['cauldron', {...}], ... ],  // set pieces, in order (see STAGE below)
//     floor: { palette: [c0, c1, c2, c3] },                                   // music floor: spectrogram, bass in the centre -> highs at the edges
//     sign:  { color, emis, sub, subEmis, y, z, width },                      // neon sign with the event title/subtitle (false = none)
//     cast:  { front: [7 entries], back: [6 entries] },                        // 'kind' | ['kind', opts | (i) => opts] | null (empty slot)
//     particles: { color, count, size, travel, sway },                         // floating embers / sparks / fireflies
//   });
// Cast kinds: skeleton zombie mummy pumpkin ghost witch vampire frank scarecrow cat. Add new ones in dancers.js (maker + a MOVES style if it needs its own dance).
// Stage parts: sky graveyard woods mansion pyramids ballroom lab cornfield cauldron spots garland bats fog discoBall (and 'floor'/'sign' via the config keys).

const SIZE = { skeleton: 1.22, zombie: 1.22, mummy: 1.22, vampire: 1.22, frank: 1.22, scarecrow: 1.22, witch: 1.22, pumpkin: 1.2, ghost: 1.4, cat: 1.55 };
const BACK = 0.78;                                   // back row is smaller (depth)
const MAKE = { pumpkin: (K, o) => K.pumpkin({ R: 1.2, ...o }) };

// adapters: every stage part takes (ctx, opts) here; ctx = { scene, FLOOR, C, st }
const STAGE = {
  sky: (c, o) => stage.sky(c.scene, o), graveyard: (c, o) => stage.graveyard(c.scene, c.FLOOR, o), woods: (c, o) => stage.woods(c.scene, c.FLOOR, o),
  mansion: (c, o) => stage.mansion(c.scene, c.FLOOR, o), pyramids: (c) => stage.pyramids(c.scene, c.FLOOR), ballroom: (c, o) => stage.ballroom(c.scene, c.FLOOR, o),
  lab: (c, o) => stage.lab(c.scene, c.FLOOR, o), cornfield: (c, o) => stage.cornfield(c.scene, c.FLOOR, o), cauldron: (c, o) => stage.cauldron(c.scene, c.FLOOR, o),
  spots: (c, o) => stage.spots(c.scene, c.FLOOR, o.colors, o), garland: (c, o) => stage.garland(c.scene, o.colors, o), bats: (c, o) => stage.bats(c.scene, o.n ?? 6),
  fog: (c, o) => stage.fog(c.scene, c.FLOOR, o.color, o), discoBall: (c, o) => stage.discoBall(c.scene, o),
};

export const partyScene = cfg => async (st, C) => {
  const { scene } = st, FLOOR = cfg.floorY ?? -3.4, ctx = { scene, FLOOR, C, st };
  scene.background = new THREE.Color(cfg.bg ?? 0x07010d); scene.fog = new THREE.FogExp2(...(cfg.fog ?? [cfg.bg ?? 0x07010d, 0.015]));
  const [bs, br, bt] = cfg.bloom ?? [0.42, 0.5, 0.86]; st.bloom.strength = bs; st.bloom.radius = br; st.bloom.threshold = bt;
  const K = createKit(scene, { floorY: FLOOR }), parts = [stage.lights(scene, cfg.lights ?? {})];
  for (const [name, o = {}] of cfg.stage ?? []) { const f = STAGE[name]; if (!f) throw new Error(`party: unknown stage part "${name}" (have: ${Object.keys(STAGE).join(' ')})`); parts.push(f(ctx, o)); }
  parts.push(stage.spectrum(scene, FLOOR, cfg.floor ?? {}));
  if (cfg.sign !== false) parts.push(stage.sign(scene, C, cfg.sign ?? {}));
  parts.push(stage.camera(st, cfg.camera));

  const make = (entry, i) => {
    if (!entry) return null;
    const [kind, o] = Array.isArray(entry) ? entry : [entry, {}], opts = typeof o === 'function' ? o(i) : o;
    const mk = MAKE[kind] || ((k, op) => k[kind]?.(op)); const d = mk(K, opts);
    if (!d) throw new Error(`party: unknown cast kind "${kind}"`); return { d, scale: SIZE[kind] ?? 1.2 };
  };
  (cfg.cast?.front ?? []).forEach((e, i) => { const m = make(e, i); if (m) K.place(m.d, (i - 3) * 3.5, 0, m.scale, (i * 0.37) % 4); });
  (cfg.cast?.back ?? []).forEach((e, i) => { const m = make(e, i + 7); if (m) K.place(m.d, (i - 2.5) * 3.9 + 0.5, -5.5, m.scale * BACK, (i * 0.53 + 1) % 4); });

  const p = cfg.particles ?? {};
  const pts = particles({ count: p.count ?? 230, seed: p.seed ?? 7, box: [34, p.height ?? 14, 16], center: [0, p.y ?? 1, -2], color: p.color ?? 0xffa040, size: p.size ?? 0.085, dir: [0, 1, 0], travel: p.travel ?? 14, sway: p.sway ?? 1.0, opacity: p.opacity ?? 0.8, H: C.H, cycles: [1, 2] });
  scene.add(pts);
  return { update(t) { const c = K.tick(t); parts.forEach(f => f(c)); pts.userData.u.uT.value = t; } };
};
