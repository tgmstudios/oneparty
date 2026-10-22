// Party scene template (see web/engine/party.js for every option). Copy, edit, then:
//   node tools/op.mjs new <id> my-party.js --title "Name" --palette "#a,#b,#c" --show
// Cast kinds: skeleton zombie mummy pumpkin ghost witch vampire frank scarecrow cat. Stage parts: sky graveyard woods mansion pyramids ballroom lab cornfield cauldron spots garland bats fog discoBall.
// The floor is a music spectrogram (bass centre -> highs edges); the sign shows the event title. Dancers, floor and lights all follow the live beat.
import { partyScene } from '../party.js';

// Witches' Coven: witches and black cats dancing round a bubbling cauldron in a moonlit pine wood.
const dresses = [0x2a1048, 0x0a2a3a, 0x3a0a2a, 0x102a10], trims = [0xff3fa0, 0x40e0ff, 0xffc040, 0xc060ff];
const w = i => ({ dress: dresses[i % 4], trim: trims[i % 4], skin: [0x6aa84a, 0x8ab070, 0x5a9a6a][i % 3] });
export const build = partyScene({
  bg: 0x05020c, fog: [0x0a0414, 0.016], bloom: [0.42, 0.5, 0.86],
  lights: { a: 0x9a40ff, b: 0x40ff80, rim: 0xff8a20, amb: 0x40305a },
  stage: [
    ['sky', { stops: [[0, '#04020a'], [0.55, '#14082a'], [0.8, '#2a1048'], [1, '#5a2a70']], moon: 0xe8f0c0, glow: 0xa0c060, moonPos: [-27, 9, -60], moonR: 8 }],
    ['woods', { z: -32 }],
    ['spots', { colors: [[0x40ff80, -7], [0x9a40ff, 0], [0xff8a20, 7]] }],
    ['cauldron', { x: 0, z: -3.4, s: 1.1 }],
    ['fog', { color: 0x60ff90, n: 9, opacity: 0.1 }],
    ['bats', { n: 8 }],
  ],
  floor: { palette: [0x40ff80, 0x9a40ff, 0xff6ad0, 0x2a8a50] },
  sign: { y: 3.8, z: -12, color: 0xb8ff70, emis: 0x40c020, sub: 0xc060ff, subEmis: 0x9030e0 },
  cast: {
    front: [['witch', w], ['cat', { eye: 0x40ff90, hat: true }], ['witch', w], null, ['witch', w], ['cat', { eye: 0xffe040 }], ['witch', w]],
    back: [['cat', { eye: 0xffb030, bow: 0x40ff90 }], ['witch', i => w(i + 1)], ['cat', { eye: 0xffb030, bow: 0x40ff90 }], ['witch', i => w(i + 2)], ['witch', i => w(i + 3)], ['cat', { eye: 0xffe040 }]],
  },
  particles: { color: 0x80ffa0, seed: 21 },
});
