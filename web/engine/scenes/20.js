import { partyScene } from '../party.js';

// Dracula's Disco: caped vampires (and a few black cats) under a mirror ball, a blood moon and a towering castle.
const capes = [0xa00a20, 0x4a0a6a, 0x0a3a5a, 0x14101c, 0x8a1a50];
const v = i => ({ cape: capes[i % 5], eye: i % 2 ? 0xff3030 : 0xffa030 });
const cat = ['cat', { fur: 0x14101c, eye: 0xff3030, bow: 0xff2040 }];
export const build = partyScene({
  bg: 0x0a0206, fog: [0x180510, 0.014], bloom: [0.42, 0.5, 0.86],
  lights: { a: 0xff2040, b: 0x9a30ff, rim: 0xff8040, amb: 0x704050 },
  stage: [
    ['sky', { stops: [[0, '#0a0004'], [0.55, '#2a0610'], [0.8, '#6a0a20'], [1, '#a02030']], moon: 0xff3a30, glow: 0xff2a20, moonPos: [22, 8, -62], moonR: 9 }],
    ['mansion', { x: -8, z: -48, glow: 0xff5a30, scale: 1.7 }],
    ['graveyard', { n: 14, z: -38 }],
    ['spots', { colors: [[0xff2040, -7], [0x9a30ff, 0], [0xffd0d0, 7]] }],
    ['discoBall', { y: 6.4, z: -6, r: 1.4 }],
    ['garland', { colors: [0xff2040, 0xff8a20, 0x9a30ff, 0xff4080], y: 6.6 }],
    ['fog', { color: 0xc03050, n: 8, opacity: 0.1 }],
    ['bats', { n: 12 }],
  ],
  floor: { palette: [0xff2040, 0xc01030, 0x9a30ff, 0xff8a20], hype: true },
  sign: { y: 3.2, z: -12, color: 0xff5a6a, emis: 0xc01020, sub: 0xffd0d0, subEmis: 0xff8090 },
  cast: {
    front: Array.from({ length: 7 }, () => ['vampire', v]),
    back: [['vampire', i => v(i + 2)], cat, ['vampire', i => v(i + 2)], ['vampire', i => v(i + 2)], cat, ['vampire', i => v(i + 2)]],
  },
  particles: { color: 0xff5a50, seed: 41 },
});
