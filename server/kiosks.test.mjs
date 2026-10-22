import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kioskSongHue, kioskTheme, kioskPopup } from './kiosks.mjs';

const state = () => ({
  event: { title: 'Halloween', subtitle: 'Party', theme: {} },
  channels: { 'controller-visual': { scene: '01' } },
  scenes: [{ id: '01', palette: ['#ff6a10', '#8a2bff'] }, { id: '02', palette: ['#30d0ff'] }],
  kiosks: {}, hud: {}, track: { id: 'song-a', title: 'Track A', artists: ['Artist'], playing: true },
});
test('song colors stay stable across progress and pause updates', () => {
  const s = state(), before = kioskTheme(s);
  s.track.progressMs = 35000; s.track.playing = false;
  assert.deepEqual(kioskTheme(s), before);
});
test('successive songs have separated hues, including hash collisions', () => {
  let previous;
  for (let i = 0; i < 100; i++) {
    const hue = kioskSongHue({ id: `song-${i}` }, previous);
    if (previous !== undefined) assert.ok(Math.abs(((hue - previous + 540) % 360) - 180) >= 65);
    previous = hue;
  }
  assert.equal(kioskSongHue({ id: 'song-a' }, kioskSongHue({ id: 'song-a' })), (kioskSongHue({ id: 'song-a' }) + 137) % 360);
});
test('song change updates dashboard colors, and scene changes also affect them', () => {
  const s = state(); s.kiosks.songHue = kioskSongHue(s.track);
  const before = kioskTheme(s);
  s.track = { ...s.track, id: 'song-b' }; s.kiosks.songHue = kioskSongHue(s.track, s.kiosks.songHue);
  assert.notEqual(kioskTheme(s).accent, before.accent);
  const songColor = kioskTheme(s).accent; s.channels['controller-visual'].scene = '02';
  assert.notEqual(kioskTheme(s).accent, songColor);
});
test('no music follows the scene; malformed palettes use valid fallback colors', () => {
  const s = state(); s.track = null;
  const before = kioskTheme(s); s.channels['controller-visual'].scene = '02';
  assert.notEqual(kioskTheme(s).accent, before.accent);
  s.scenes[1].palette = 'broken';
  for (const color of Object.values(kioskTheme(s))) assert.match(color, /^#[0-9a-f]{6}$/i);
});
test('popup visibly uses the accent on the event heading and song title', () => {
  const s = state(), popup = kioskPopup(s);
  assert.ok(popup.content.includes(`--op-accent:${kioskTheme(s).accent}`));
  assert.match(popup.content, /<h1 style="[^"]*color:var\(--op-accent\)/);
  assert.match(popup.content, /<h2 style="color:var\(--op-accent\)[^"]*">Track A<\/h2>/);
});
