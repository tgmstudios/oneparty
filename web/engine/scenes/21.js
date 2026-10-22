import { partyScene } from '../party.js';

// Harvest Hoedown: scarecrows and pumpkins in front of a cornfield under a low harvest moon, with fireflies and hay bales.
const shirts = [0xa83a22, 0x2a6a8a, 0x6a8a2a, 0x8a3a6a], pants = [0x3a5a8a, 0x5a4a2a, 0x2a4a3a];
const s = i => ({ shirt: shirts[i % 4], pants: pants[i % 3] });
export const build = partyScene({
  bg: 0x120820, fog: [0x2a1224, 0.012], bloom: [0.4, 0.5, 0.86],
  lights: { a: 0xff9a40, b: 0xff5a20, rim: 0xffd060, amb: 0x6a4a40 },
  stage: [
    ['sky', { stops: [[0, '#1a0a30'], [0.5, '#5a2a50'], [0.78, '#d06030'], [1, '#ffb050']], moon: 0xffa040, glow: 0xff8a30, moonPos: [14, 3, -64], moonR: 10 }],
    ['cornfield'],
    ['spots', { colors: [[0xffb040, -7], [0xff7a20, 0], [0xffe090, 7]] }],
    ['garland', { colors: [0xffc060, 0xff9a30, 0xff6a20, 0xffe090], y: 6.2 }],
    ['fog', { color: 0xd09060, n: 8, opacity: 0.09 }],
    ['bats', { n: 4 }],
  ],
  floor: { palette: [0xffa040, 0xff7a20, 0xffe090, 0xc83a22] },
  sign: { y: 3.6, z: -9, color: 0xffb040, emis: 0xe06a10, sub: 0xff6a4a, subEmis: 0xc83a22 },
  cast: {
    front: [['scarecrow', s], ['pumpkin', { face: 'grin' }], ['scarecrow', s], ['pumpkin', { face: 'smile', hat: true }], ['scarecrow', s], ['pumpkin', { face: 'oh' }], ['scarecrow', s]],
    back: [['pumpkin', { face: 'smile' }], ['scarecrow', i => s(i + 1)], ['pumpkin', { face: 'grin', hat: true }], ['scarecrow', i => s(i + 1)], ['pumpkin', { face: 'oh' }], ['scarecrow', i => s(i + 1)]],
  },
  particles: { color: 0xe8ff70, seed: 51, size: 0.1, height: 8, y: -1, travel: 5, sway: 1.8, opacity: 0.9, count: 200 },
});
