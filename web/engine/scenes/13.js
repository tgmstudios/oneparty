import { partyScene } from '../party.js';

// Monster Mash: skeletons and pumpkins on a spectrum floor in front of a graveyard moon.
export const build = partyScene({
  bg: 0x07010d, fog: [0x07010d, 0.016], bloom: [0.4, 0.5, 0.88],
  lights: { a: 0xff7a20, b: 0xff3fa0, rim: 0x40ff9a, amb: 0x6a4aa0 },
  stage: [
    ['sky', { stops: [[0, '#05010a'], [0.55, '#1a0830'], [0.8, '#5a1a50'], [1, '#c8501a']], moon: 0xffb060, glow: 0xff8a30, moonPos: [0, 7, -60], moonR: 7 }],
    ['graveyard', { n: 16, z: -42 }],
    ['spots', { colors: [[0xff8a20, -7], [0xff3fa0, 0], [0x40ff9a, 7]] }],
    ['garland', { colors: [0xff7a20, 0xff3fa0, 0x9a4bff, 0x40ff9a], y: 6.2 }],
    ['bats', { n: 7 }],
  ],
  floor: { palette: [0xff6a10, 0xff2fa0, 0x8a2bff, 0x30e090], hype: true },
  sign: { y: 3.6, z: -12 },
  cast: {
    front: [['skeleton', { eye: 0x40ff9a, hat: true }], ['pumpkin', { face: 'grin' }], ['skeleton', { eye: 0xff3fa0 }], ['pumpkin', { face: 'smile', hat: true }], ['skeleton', { eye: 0x40c8ff, hat: true }], ['pumpkin', { face: 'oh' }], ['skeleton', { eye: 0xffb020 }]],
    back: [['pumpkin', { face: 'smile', hat: true }], 'skeleton', ['pumpkin', { face: 'grin' }], ['skeleton', { eye: 0x40c8ff, hat: true }], ['pumpkin', { face: 'oh' }], 'skeleton'],
  },
  particles: { color: 0xffa040, seed: 5 },
});
