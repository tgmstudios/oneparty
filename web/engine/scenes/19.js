import { partyScene } from '../party.js';

// Frankenstein's Lab: monsters and electrified skeletons dancing between two tesla coils throwing lightning.
const suits = [0x2a2a3a, 0x3a2a2a, 0x2a3a2a, 0x2a2a4a];
const f = i => ({ suit: suits[i % 4], skin: [0x8ab870, 0x7aa860, 0x9ac880][i % 3] });
export const build = partyScene({
  bg: 0x060a12, fog: [0x0a1220, 0.012], bloom: [0.45, 0.5, 0.86],
  lights: { a: 0x60c8ff, b: 0x80ff60, rim: 0xffffff, amb: 0x304050 },
  stage: [
    ['lab'],
    ['spots', { colors: [[0x40c8ff, -7], [0xffffff, 0], [0x80ff60, 7]] }],
    ['fog', { color: 0x80c0ff, n: 7, opacity: 0.08 }],
  ],
  floor: { palette: [0x40e0ff, 0x80ffb0, 0xffffff, 0x2a6aff], hype: true },
  sign: { y: 4.4, z: -12, color: 0xaee8ff, emis: 0x2a9aff, sub: 0x80ff60, subEmis: 0x30c030 },
  cast: {
    front: [['frank', f], ['skeleton', { eye: 0x80ffff }], ['frank', f], ['frank', f], ['skeleton', { eye: 0x80ffff }], ['frank', f], ['frank', f]],
    back: [['frank', i => f(i + 1)], ['skeleton', { eye: 0xaaff80 }], ['frank', i => f(i + 1)], ['skeleton', { eye: 0xaaff80 }], ['frank', i => f(i + 1)], ['frank', i => f(i + 1)]],
  },
  particles: { color: 0xa0e0ff, seed: 31, size: 0.07, opacity: 0.85 },
});
