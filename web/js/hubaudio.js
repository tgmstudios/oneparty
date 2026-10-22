// Plays interleaved PCM from a Windows output. Each player has its own buffer and output.
export function createHubAudio({ onState = () => {}, buffer = 3 } = {}) {
  let target = clampBuffer(buffer), volume = 1, source = '', sink = '', wanted = false;
  let session = null, retry = null;
  function clampBuffer(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0.06, Math.min(15, n)) : 3;
  }
  function dispose(s) {
    if (!s) return;
    s.controller.abort();
    s.ctx.onstatechange = null;
    for (const node of s.nodes) { try { node.stop(); } catch { /* ended */ } }
    s.nodes.clear();
    try { s.ctx.close().catch(() => {}); } catch { /* closed */ }
  }
  function launch() {
    clearTimeout(retry);
    const old = session; session = null; dispose(old);
    if (!wanted) return;
    let ctx;
    try {
      // Create/resume synchronously from Play so ordinary browsers receive the user's gesture.
      ctx = new AudioContext({ latencyHint: 'interactive' });
      ctx.resume?.().catch(() => {});
    } catch (e) { wanted = false; onState('error', e.message); return; }
    const s = session = { ctx, controller: new AbortController(), nodes: new Set(), gain: null, next: 0 };
    onState('connecting');
    run(s);
  }
  async function run(s) {
    const { ctx, controller } = s;
    const current = () => session === s && !controller.signal.aborted;
    try {
      if (sink && !ctx.setSinkId) throw new Error('Use Chrome or Edge on localhost to choose an audio output.');
      await ctx.setSinkId?.(sink || '');
      if (!current()) return;
      const res = await fetch('/api/audio-stream' + (source ? '?device=' + encodeURIComponent(source) : ''), { signal: controller.signal });
      if (!current()) return;
      if (res.ok === false || !res.body) throw new Error('The live audio source could not be opened.');
      const reader = res.body.getReader();
      let header = new Uint8Array(0), rate = 0, channels = 0, carry = new Uint8Array(0), batches = [], frames = 0;
      const report = () => { if (current()) onState(ctx.state === 'running' ? 'playing' : 'blocked'); };
      const flush = () => {
        if (!frames || !current()) return;
        const data = ctx.createBuffer(channels, frames, rate); let offset = 0;
        for (const pcm of batches) {
          for (let c = 0; c < channels; c++) {
            const dest = data.getChannelData(c);
            for (let i = 0; i < pcm.length / channels; i++) dest[offset + i] = pcm[i * channels + c] / 32768;
          }
          offset += pcm.length / channels;
        }
        batches = []; frames = 0;
        const now = ctx.currentTime;
        const tolerance = Math.max(0.08, Math.min(1, target * 0.25));
        if (s.next > now + target + tolerance) {
          // After a network burst, discard stale queued sound instead of retaining a growing delay.
          for (const node of s.nodes) { try { node.stop(); } catch { /* ended */ } }
          s.nodes.clear(); s.next = 0;
        }
        if (s.next < now + 0.01) s.next = now + target;
        const node = ctx.createBufferSource(); node.buffer = data; node.connect(s.gain);
        s.nodes.add(node); node.onended = () => s.nodes.delete(node);
        node.start(s.next); s.next += data.duration;
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (!current()) return;
        if (done) throw new Error('Live audio disconnected. Reconnecting…');
        let data = value;
        if (!rate) {
          const joined = new Uint8Array(header.length + data.length); joined.set(header); joined.set(data, header.length);
          if (joined.length < 8) { header = joined; continue; }
          const view = new DataView(joined.buffer);
          rate = view.getInt32(0, true); channels = view.getInt32(4, true);
          if (rate < 8000 || rate > 384000 || channels < 1 || channels > 8) throw new Error('Invalid live audio stream.');
          s.gain = ctx.createGain(); s.gain.gain.value = volume; s.gain.connect(ctx.destination);
          ctx.onstatechange = report; report(); data = joined.subarray(8);
        }
        if (carry.length) { const joined = new Uint8Array(carry.length + data.length); joined.set(carry); joined.set(data, carry.length); data = joined; }
        const whole = data.length - data.length % (2 * channels);
        carry = data.slice(whole);
        if (!whole) continue;
        const pcm = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + whole));
        const batchSize = target <= 0.3 ? 512 : 2048;
        for (let offset = 0; offset < pcm.length;) {
          const count = Math.min(batchSize - frames, (pcm.length - offset) / channels);
          batches.push(pcm.subarray(offset, offset + count * channels)); frames += count; offset += count * channels;
          if (frames >= batchSize) flush();
        }
      }
    } catch (e) {
      if (current() && e.name !== 'AbortError') onState('error', e.message || String(e));
    } finally {
      if (session === s) {
        session = null; dispose(s);
        if (wanted) retry = setTimeout(launch, 1500);
      }
    }
  }
  return {
    start() { if (wanted) return; wanted = true; launch(); },
    stop() { wanted = false; clearTimeout(retry); const old = session; session = null; dispose(old); onState('off'); },
    /** Reopen immediately to discard the old queue when the delay changes. */
    setBuffer(value) { const next = clampBuffer(value); if (next === target) return; target = next; if (wanted) launch(); },
    get buffer() { return target; },
    setSource(value) { value = value || ''; if (value === source) return; source = value; if (wanted) launch(); },
    setSink(value) { value = value || ''; if (value === sink) return; sink = value; if (wanted) launch(); },
    setVolume(value) { volume = Math.max(0, Math.min(1, +value)); if (session?.gain) session.gain.gain.value = volume; },
    unlock() { session?.ctx.resume?.().catch(() => {}); },
    get active() { return wanted; },
  };
}
