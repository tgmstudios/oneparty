import test from 'node:test';
import assert from 'node:assert/strict';
import { createHubAudio } from '../web/js/hubaudio.js';

test('speaker routing waits for the selected output and fails without default playback', async t => {
  for (const rejectSink of [false, true]) {
    await t.test(rejectSink ? 'unavailable speaker' : 'selected speaker', async t => {
      const calls = [];
      let resolveSink, reportState;
      const reported = new Promise(resolve => { reportState = resolve; });
      const selection = new Promise((resolve, reject) => { resolveSink = () => rejectSink ? reject(new Error('Speaker disconnected')) : resolve(); });
      class Context {
        state = 'running';
        async setSinkId(id) { calls.push(['sink', id]); await selection; }
        createGain() { calls.push(['gain']); return { gain: {}, connect() { calls.push(['connect']); } }; }
        async close() { calls.push(['close']); }
      }
      t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
        let first = true;
        return { body: { getReader: () => ({ read() {
          if (first) {
            first = false;
            const header = new Uint8Array(8), view = new DataView(header.buffer);
            view.setInt32(0, 48000, true); view.setInt32(4, 2, true);
            return Promise.resolve({ value: header, done: false });
          }
          return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }));
        } }) } };
      });
      const previous = globalThis.AudioContext;
      globalThis.AudioContext = Context;
      const player = createHubAudio({ onState: (state, error) => { if (['playing', 'error'].includes(state)) reportState({ state, error }); } });
      try {
        player.setSink('soundcore-output'); player.start();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls, [['sink', 'soundcore-output']]);
        resolveSink();
        const result = await reported;
        assert.equal(result.state, rejectSink ? 'error' : 'playing');
        assert.equal(calls.some(([name]) => name === 'connect'), !rejectSink);
        if (rejectSink) assert.match(result.error, /Speaker disconnected/);
      } finally {
        player.stop();
        globalThis.AudioContext = previous;
      }
    });
  }
});

test('each speaker has an independent configurable buffer', () => {
  const live = createHubAudio({ buffer: 0.08 }), display = createHubAudio();
  assert.equal(live.buffer, 0.08); assert.equal(display.buffer, 3);
  live.setBuffer(0.3); assert.equal(live.buffer, 0.3); assert.equal(display.buffer, 3);
  live.setBuffer(0); assert.equal(live.buffer, 0.06);
  live.setBuffer(100); assert.equal(live.buffer, 15);
  live.setBuffer(NaN); assert.equal(live.buffer, 3);
});

test('changing the buffer immediately cancels old scheduled audio and starts with the new delay', async t => {
  const contexts = [], starts = [], stops = [];
  class Context {
    state = 'running'; currentTime = 10;
    constructor() { contexts.push(this); }
    async setSinkId() {}
    async resume() {}
    async close() { this.closed = true; }
    createGain() { return { gain: {}, connect() {} }; }
    createBuffer(channels, frames, rate) { return { duration: frames / rate, getChannelData: () => new Float32Array(frames) }; }
    createBufferSource() { const ctx = this; return { connect() {}, start(time) { starts.push({ ctx, time }); }, stop() { stops.push(ctx); } }; }
  }
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    let first = true;
    return { ok: true, body: { getReader: () => ({ read() {
      if (first) {
        first = false; const value = new Uint8Array(8 + 2048 * 4), view = new DataView(value.buffer);
        view.setInt32(0, 48000, true); view.setInt32(4, 2, true);
        return Promise.resolve({ value, done: false });
      }
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }));
    } }) } };
  });
  const previous = globalThis.AudioContext; globalThis.AudioContext = Context;
  const player = createHubAudio({ buffer: 3 });
  try {
    player.start(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(starts[0].time, 13);
    player.setBuffer(0.08); await new Promise(resolve => setImmediate(resolve));
    assert.equal(contexts.length, 2); assert.equal(contexts[0].closed, true);
    assert.ok(stops.includes(contexts[0]));
    assert.equal(starts.find(start => start.ctx === contexts[1]).time, 10.08);
    assert.equal(player.active, true);
  } finally { player.stop(); globalThis.AudioContext = previous; }
});
