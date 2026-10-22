import { partyScene } from '../party.js';

// Mummy Mosh: stiff bandaged mummies (and a couple of pumpkins) walk like Egyptians under pyramids and torchlight.
export const build = partyScene({
  bg: 0x07030f, fog: [0x120618, 0.015], bloom: [0.42, 0.5, 0.86],
  lights: { a: 0xffa030, b: 0x30c0c0, rim: 0xff4080, amb: 0x6a4a50 },
  stage: [
    ['sky', { stops: [[0, '#05010f'], [0.5, '#1a0a2a'], [0.78, '#6a2a40'], [1, '#e08a30']], moon: 0xffd080, glow: 0xff9a40, moonPos: [-27, 5, -62], moonR: 8 }],
    ['pyramids'],
    ['spots', { colors: [[0xffb030, -7], [0x30d0d0, 0], [0xff3fa0, 7]] }],
    ['fog', { color: 0xd09050, n: 8, opacity: 0.12 }],
    ['bats', { n: 5 }],
  ],
  floor: { palette: [0xe0a030, 0xff6a10, 0x20b0b0, 0x8a2bff], hype: true },
  sign: { y: 3.8, z: -14, color: 0xffc850, emis: 0xe08a10, sub: 0x30d0d0, subEmis: 0x10a0a0 },
  cast: {
    front: [['mummy', { eye: 0x40ffd0 }], ['mummy', { eye: 0xffc030 }], ['pumpkin', { face: 'grin', hat: true }], ['mummy', { eye: 0xffc030, hat: true }], ['pumpkin', { face: 'smile' }], ['mummy', { eye: 0x40ffd0 }], ['mummy', { eye: 0xffc030 }]],
    back: Array.from({ length: 6 }, () => ['mummy', { eye: 0xffc030 }]),
  },
  particles: { color: 0xffc060, seed: 11 },
});
