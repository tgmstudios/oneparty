import { partyScene } from '../party.js';

// Ghost Disco: floating ghosts and top-hat skeletons under a spinning mirror ball, in front of a haunted mansion.
const tints = [0xdff4ff, 0xc8ffe8, 0xffd8f0, 0xe0d8ff];
export const build = partyScene({
  bg: 0x04061a, fog: [0x05071e, 0.017], bloom: [0.42, 0.5, 0.86],
  lights: { a: 0x40a0ff, b: 0xc040ff, rim: 0xff80c0, amb: 0x4050a0 },
  stage: [
    ['sky', { stops: [[0, '#03040e'], [0.55, '#0e1240'], [0.8, '#2a1a6a'], [1, '#6a3aa0']], moon: 0xcfe0ff, glow: 0x6a90ff, moonPos: [-26, 12, -60], moonR: 6 }],
    ['mansion', { x: 12, z: -46, glow: 0xffd070 }],
    ['graveyard', { n: 14, z: -40 }],
    ['spots', { colors: [[0x40c8ff, -7], [0xff3fa0, 0], [0xa060ff, 7]] }],
    ['discoBall', { y: 6.4, z: -6, r: 1.4 }],
    ['fog', { color: 0x6a80ff, n: 8, opacity: 0.14 }],
    ['bats', { n: 5 }],
  ],
  floor: { palette: [0x2fb8ff, 0x8a50ff, 0xff3fa0, 0x30e0c0], hype: true },
  sign: { y: 3.2, z: -12, color: 0x9ad8ff, emis: 0x3a90ff, sub: 0xff80d0, subEmis: 0xff40a0 },
  cast: {
    front: [['ghost', i => ({ tint: tints[i % 4] })], ['skeleton', { eye: 0x40c8ff, hat: true }], ['ghost', { tint: tints[2], hat: true }], ['ghost', { tint: tints[3] }], ['skeleton', { eye: 0xff3fa0, hat: true }], ['ghost', { tint: tints[1], hat: true }], ['ghost', { tint: tints[0] }]],
    back: [['ghost', { tint: tints[1] }], ['ghost', { tint: tints[2] }], ['skeleton', { eye: 0x40ff9a }], ['ghost', { tint: tints[3] }], ['ghost', { tint: tints[0] }], ['ghost', { tint: tints[1] }]],
  },
  particles: { color: 0x90b8ff, seed: 9 },
});
