import { partyScene } from '../party.js';

// Zombie Thriller: a graveyard crew of zombies shambling, clawing and stomping, green fog and a sickly moon.
const skins = [0x78a85a, 0x8ab070, 0x6a9a6a, 0x9ab07a], shirts = [0x5a3a6a, 0x6a2a2a, 0x2a4a6a, 0x6a5a2a, 0x3a3a3a, 0x7a3a5a, 0x2a5a4a];
const z = i => ({ skin: skins[i % 4], shirt: shirts[i % 7], hat: i === 3 || i === 8, eye: i % 2 ? 0xffee60 : 0xff6040 });
export const build = partyScene({
  bg: 0x030803, fog: [0x061006, 0.018], bloom: [0.4, 0.5, 0.86],
  lights: { a: 0x80ff40, b: 0xa040ff, rim: 0xff6a20, amb: 0x304a30 },
  stage: [
    ['sky', { stops: [[0, '#020402'], [0.55, '#0a1a0a'], [0.8, '#2a3a10'], [1, '#7a5010']], moon: 0xd0e878, glow: 0x60a030, moonPos: [-24, 10, -60], moonR: 7 }],
    ['graveyard', { n: 24, z: -36 }],
    ['spots', { colors: [[0x80ff40, -7], [0xa040ff, 0], [0xff8a20, 7]] }],
    ['fog', { color: 0x50ff70, n: 10, opacity: 0.07 }],
    ['bats', { n: 8 }],
  ],
  floor: { palette: [0x80ff40, 0x40c030, 0x8a2bff, 0xff6a10], hype: true },
  sign: { y: 3.6, z: -12, color: 0xff9a30, emis: 0xff5a00, sub: 0x80ff40, subEmis: 0x40c010 },
  cast: { front: Array.from({ length: 7 }, () => ['zombie', z]), back: Array.from({ length: 6 }, () => ['zombie', i => z(i + 3)]) },
  particles: { color: 0x90ff60, seed: 3, travel: 12, sway: 1.2 },
});
