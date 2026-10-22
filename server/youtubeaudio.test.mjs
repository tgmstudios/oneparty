import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { youtubeAudioUrl, serveAudio } from './ytstream.mjs';
import { createYoutubeAudio } from '../web/js/youtubeaudio.js';

test('accepts YouTube video and live links, rejects other destinations', () => {
  for (const link of ['https://youtu.be/abc', 'https://www.youtube.com/watch?v=abc', 'https://youtube.com/@channel/live', 'https://music.youtube.com/watch?v=abc']) assert.equal(youtubeAudioUrl(link), link);
  for (const link of ['file:///test', 'https://youtube.com.example.org/video', 'https://example.org', 'https://user:pass@youtube.com/watch?v=abc']) assert.throws(() => youtubeAudioUrl(link));
});

function media() {
  const calls = [], listeners = {};
  return { calls, muted: false, src: '', volume: 1,
    addEventListener(name, fn) { listeners[name] = fn; },
    emit(name) { listeners[name]?.(); },
    async setSinkId(id) { calls.push(['sink', id]); },
    pause() {}, load() {}, removeAttribute() { this.src = ''; },
    async play() { calls.push(['play', this.src, this.muted]); },
  };
}
test('YouTube selects its output before loading and playing audio', async () => {
  const audio = media();
  const player = createYoutubeAudio({ audio, fetchInfo: async () => {
    assert.deepEqual(audio.calls, [['sink', 'bluetooth']]);
    assert.equal(audio.muted, true); assert.equal(audio.src, '');
    return { ok: true, json: async () => ({ title: 'Live set', live: true }) };
  } });
  await player.play('https://youtu.be/abc', 'bluetooth');
  assert.deepEqual(audio.calls[1], ['play', '/api/ytaudio?url=https%3A%2F%2Fyoutu.be%2Fabc', false]);
  player.stop(); assert.equal(audio.muted, true); assert.equal(audio.src, '');
});
test('unavailable output never fetches media or plays through the default', async () => {
  const audio = media(), states = [];
  audio.setSinkId = async () => { throw new Error('Speaker disconnected'); };
  const player = createYoutubeAudio({ audio, onState: (state, message) => states.push([state, message]), fetchInfo: () => assert.fail('must not fetch') });
  await player.play('https://youtu.be/abc', 'missing');
  assert.equal(audio.calls.length, 0); assert.equal(audio.muted, true);
  assert.deepEqual(states.at(-1), ['error', 'Speaker disconnected']);
});
test('YouTube repeats with a fresh stream and preserves its speaker and volume', async () => {
  const audio = media(); let probes = 0;
  const player = createYoutubeAudio({ audio, fetchInfo: async () => { probes++; return { ok: true, json: async () => ({ title: 'Mix' }) }; } });
  player.setVolume(0.4);
  await player.play('https://youtu.be/abc', 'bluetooth');
  const original = audio.src;
  for (let repeat = 0; repeat < 2; repeat++) {
    audio.emit('ended'); await new Promise(resolve => setImmediate(resolve));
    assert.notEqual(audio.src, original); assert.match(audio.src, /&repeat=\d+$/);
    assert.deepEqual(audio.calls.filter(([name]) => name === 'sink').at(-1), ['sink', 'bluetooth']);
    assert.equal(audio.volume, 0.4); assert.equal(audio.muted, false);
  }
  assert.equal(probes, 3); assert.equal(audio.calls.filter(([name]) => name === 'play').length, 3);
  player.stop(); audio.emit('ended'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(probes, 3); assert.equal(audio.src, '');
});
test('Stop cancels a repeat that is still opening', async () => {
  const audio = media(); let finish, probes = 0;
  const response = { ok: true, json: async () => ({ title: 'Mix' }) };
  const player = createYoutubeAudio({ audio, fetchInfo: async () => ++probes === 1 ? response : new Promise(resolve => { finish = resolve; }) });
  await player.play('https://youtu.be/abc', 'bluetooth');
  audio.emit('ended'); await new Promise(resolve => setImmediate(resolve));
  player.stop(); finish(response); await new Promise(resolve => setImmediate(resolve));
  assert.equal(audio.calls.filter(([name]) => name === 'play').length, 1);
  assert.equal(audio.src, ''); assert.equal(audio.muted, true);
});
test('an older hub requests a restart instead of using the broken video fallback', async () => {
  const audio = media(), states = [];
  const player = createYoutubeAudio({ audio, onState: (state, message) => states.push([state, message]), fetchInfo: async () => ({ status: 404, ok: false }) });
  await player.play('https://youtu.be/abc', 'bluetooth');
  assert.equal(audio.src, '');
  assert.equal(audio.calls.some(([name]) => name === 'play'), false);
  assert.equal(states.at(-1)[0], 'error'); assert.match(states.at(-1)[1], /Restart oneparty/);
});
test('a pause event cannot hide a media playback error', async () => {
  const audio = media(), states = [];
  const player = createYoutubeAudio({ audio, onState: (state, message) => states.push([state, message]), fetchInfo: async () => ({ ok: true, json: async () => ({ title: 'Test' }) }) });
  await player.play('https://youtu.be/abc', 'bluetooth');
  audio.emit('error'); audio.emit('pause');
  assert.equal(states.at(-1)[0], 'error'); assert.equal(audio.muted, true);
});
test('stopping while YouTube is opening prevents late playback', async () => {
  const audio = media(); let finish;
  const player = createYoutubeAudio({ audio, fetchInfo: () => new Promise(resolve => { finish = resolve; }) });
  const pending = player.play('https://youtu.be/abc', 'bluetooth');
  await new Promise(resolve => setImmediate(resolve));
  player.stop(); finish({ ok: true, json: async () => ({ title: 'Late response' }) }); await pending;
  assert.equal(audio.calls.some(([name]) => name === 'play'), false); assert.equal(audio.src, '');
});
test('YouTube extraction errors are visible and leave media muted', async () => {
  const audio = media(), states = [];
  const player = createYoutubeAudio({ audio, onState: (state, message) => states.push([state, message]), fetchInfo: async () => ({ ok: false, json: async () => ({ error: 'YouTube wants a sign-in' }) }) });
  await player.play('https://youtu.be/abc', 'bluetooth');
  assert.deepEqual(states.at(-1), ['error', 'YouTube wants a sign-in']);
  assert.equal(audio.muted, true); assert.equal(audio.calls.some(([name]) => name === 'play'), false);
});
test('disconnected clients do not start an audio transcoder after extraction', async () => {
  const res = new EventEmitter(); let finish;
  const pending = serveAudio({}, res, 'https://youtu.be/abc', {
    probe: () => new Promise(resolve => { finish = resolve; }), spawnProcess: () => assert.fail('must not spawn'),
  });
  res.emit('close'); finish({ url: 'https://media.example/audio' }); await pending;
});
test('audio streaming strips video and stops ffmpeg when the player disconnects', async () => {
  const res = new PassThrough(), ff = new EventEmitter(), download = new EventEmitter(); let killed = false, downloadKilled = false;
  const commands = [];
  ff.stdin = new PassThrough(); ff.stdout = new PassThrough(); ff.stderr = new PassThrough(); ff.kill = () => { killed = true; };
  download.stdout = new PassThrough(); download.stderr = new PassThrough(); download.kill = () => { downloadKilled = true; };
  res.writeHead = (status, headers) => { assert.equal(status, 200); assert.equal(headers['content-type'], 'audio/mpeg'); res.headersSent = true; };
  await serveAudio({}, res, 'https://youtu.be/abc', {
    probe: async () => ({ url: 'https://media.example/audio' }), spawnProcess: (cmd, args) => { commands.push({ cmd, args }); return cmd === 'yt-dlp' ? download : ff; },
  });
  const args = commands.find(c => c.cmd === 'ffmpeg').args;
  assert.ok(args.includes('-vn')); assert.ok(args.includes('libmp3lame')); assert.ok(args.includes('-flush_packets'));
  assert.equal(args[args.indexOf('-i') + 1], 'pipe:0');
  const downloadArgs = commands.find(c => c.cmd === 'yt-dlp').args;
  assert.equal(downloadArgs[downloadArgs.indexOf('-o') + 1], '-');
  assert.equal(downloadArgs.at(-1), 'https://youtu.be/abc');
  download.stdout.write(Buffer.from('partial media')); assert.equal(ff.stdin.read().toString(), 'partial media');
  // Playback begins from partial data while the downloader is still running.
  ff.stdout.write(Buffer.from('MP3')); assert.equal(res.headersSent, true);
  res.emit('close'); assert.equal(killed, true); assert.equal(downloadKilled, true);
});
