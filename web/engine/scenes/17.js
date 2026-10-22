import { partyScene } from '../party.js';

// Monster Ball: the whole crew in a gothic ballroom with swinging chandeliers.
export const build = partyScene({
  bg: 0x0a0410, fog: [0x140618, 0.012], bloom: [0.4, 0.5, 0.86],
  lights: { a: 0xff8040, b: 0xc030ff, rim: 0x40a0ff, amb: 0x6a4a70 },
  stage: [
    ['ballroom'],
    ['spots', { colors: [[0xff3fa0, -7], [0xffc040, 0], [0x40a0ff, 7]] }],
    ['garland', { colors: [0xffc040, 0xff3fa0, 0x9a4bff, 0x40a0ff], y: 6.4, z: -9 }],
    ['fog', { color: 0xb070d0, n: 7, opacity: 0.1 }],
    ['bats', { n: 4 }],
  ],
  floor: { palette: [0xc01838, 0xe02048, 0xffc040, 0x8a50ff], hype: true },
  sign: { y: 3.6, z: -12.4, color: 0xffd060, emis: 0xe09010, sub: 0xff3fa0, subEmis: 0xff2f90 },
  cast: {
    front: [['skeleton', { hat: true, eye: 0xff3fa0 }], ['zombie', { shirt: 0x6a2a2a }], ['ghost', { hat: true }], ['pumpkin', { face: 'grin', hat: true }], ['mummy', { eye: 0x40ffd0 }], ['ghost', { tint: 0xffd8f0 }], ['skeleton', { eye: 0x40c8ff }]],
    back: [['pumpkin', { face: 'smile' }], 'mummy', ['zombie', { skin: 0x8ab070 }], ['skeleton', { eye: 0x40ff9a }], ['ghost', { tint: 0xc8ffe8 }], ['pumpkin', { face: 'oh', hat: true }]],
  },
  particles: { color: 0xffb0e0, seed: 13, opacity: 0.7 },
});
