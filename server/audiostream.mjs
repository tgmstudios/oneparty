// Streams audio from Windows output devices (WASAPI loopback) to displays as raw 16-bit PCM over chunked HTTP.
// Each distinct source ("" = the hub's analysis device, or a device name fragment such as "Voicemeeter AUX") has its own capture helper,
// running only while somebody listens, so different displays can be sent different audio.
// Wire format: int32 sampleRate, int32 channels (=2), then interleaved s16le frames.
import { spawn } from 'node:child_process';
import { EXE, ensureBuilt } from './audiocap.mjs';

const MAX_BACKLOG = 256 * 1024;   // a client that falls this far behind skips audio instead of building up latency

export function createAudioStream({ getDevice, onChange = () => {} }) {
  const sources = new Map();       // key -> { clients:Set, child, head, gen, stopTimer }
  const device = key => key || getDevice() || null;

  function spawnHelper(key, src) {
    try { ensureBuilt(); } catch (e) { console.error('[audio-stream]', e.message); return; }
    const my = ++src.gen, dev = device(key);
    const p = spawn(EXE, ['--stereo', ...(dev ? ['--device', dev] : [])], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    src.child = p; src.head = null;
    let buf = Buffer.alloc(0), headBuf = Buffer.alloc(0);
    p.stderr.on('data', () => {});
    p.stdout.on('data', chunk => {
      if (!src.head) {
        headBuf = Buffer.concat([headBuf, chunk]); if (headBuf.length < 8) return;
        src.head = headBuf.subarray(0, 8); chunk = headBuf.subarray(8);
        for (const c of src.clients) if (!c.started) { c.res.write(src.head); c.started = true; }   // clients that joined before the helper was ready
      }
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      const whole = buf.length - (buf.length % 8);                    // whole stereo float32 frames only
      if (!whole) return;
      const f32 = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + whole));
      buf = Buffer.from(buf.subarray(whole));
      const out = Buffer.allocUnsafe(f32.length * 2);
      for (let i = 0; i < f32.length; i++) { const v = Math.max(-1, Math.min(1, f32[i])); out.writeInt16LE((v < 0 ? v * 0x8000 : v * 0x7fff) | 0, i * 2); }
      for (const c of src.clients) if (c.started && c.res.writableLength < MAX_BACKLOG) c.res.write(out);
    });
    p.on('exit', () => { if (my !== src.gen) return; src.child = null; src.head = null; if (src.clients.size) setTimeout(() => { if (src.clients.size && !src.child) spawnHelper(key, src); }, 2000); });   // device unplugged: retry
    p.on('error', e => console.error('[audio-stream]', e.message));
  }
  function stopHelper(src) { src.gen++; if (src.child) { try { src.child.kill(); } catch { /* gone */ } } src.child = null; src.head = null; }
  const count = () => [...sources.values()].reduce((n, s) => n + s.clients.size, 0);

  return {
    get count() { return count(); },
    /** listeners per source key, for the control panel */
    get sources() { return [...sources].filter(([, s]) => s.clients.size).map(([key, s]) => ({ source: key, device: device(key), listeners: s.clients.size })); },
    add(req, res, key = '') {
      let src = sources.get(key); if (!src) { src = { clients: new Set(), child: null, head: null, gen: 0, stopTimer: null }; sources.set(key, src); }
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      const c = { res, started: false };
      src.clients.add(c); clearTimeout(src.stopTimer);
      if (src.head) { res.write(src.head); c.started = true; }
      if (!src.child) spawnHelper(key, src);
      onChange(count());
      req.on('close', () => {
        src.clients.delete(c); onChange(count());
        if (!src.clients.size) src.stopTimer = setTimeout(() => { if (!src.clients.size) { stopHelper(src); sources.delete(key); } }, 5000);   // brief grace so a page reload does not respawn the helper
      });
    },
    /** the hub's analysis device changed: re-open the helpers that follow it */
    deviceChanged() { const src = sources.get(''); if (src?.clients.size) { stopHelper(src); spawnHelper('', src); } },
    stop() { for (const [, s] of sources) { stopHelper(s); for (const c of s.clients) c.res.end(); s.clients.clear(); } sources.clear(); },
  };
}
