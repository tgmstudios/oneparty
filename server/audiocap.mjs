// Backend audio capture: Windows output loopback (WASAPI) via tools/loopback/loopback.exe, analysed in Node.
// What it hears is exactly what the chosen playback device plays, with no browser permissions, pickers or fake sources.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { createAnalyzer } from './analyzer.mjs';

const DIR = path.join(ROOT, 'tools', 'loopback');
const SRC = path.join(DIR, 'Loopback.cs');
export const EXE = path.join(DIR, 'loopback.exe');

export function ensureBuilt() {
  if (process.platform !== 'win32') throw new Error('backend audio capture is Windows-only (WASAPI loopback)');
  if (fs.existsSync(EXE) && fs.statSync(EXE).mtimeMs >= fs.statSync(SRC).mtimeMs) return;
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  if (!fs.existsSync(csc)) throw new Error('csc.exe (.NET Framework 4) not found - cannot build the loopback helper');
  execFileSync(csc, ['/nologo', '/optimize', '/target:exe', '/platform:x64', '/out:' + EXE, SRC], { stdio: 'pipe' });
}

export function listOutputs() {
  try { ensureBuilt(); return JSON.parse(execFileSync(EXE, ['--list'], { encoding: 'utf8', timeout: 8000 })); } catch { return []; }
}

/** @param {{onAudio:(a:object)=>void, onStatus:(s:object)=>void, log?:Function}} o */
export function createAudioCapture({ onAudio, onStatus, log = console.log }) {
  let child = null, wanted = null, retry = null, gen = 0, lastData = 0, stopping = false;

  function start(device = null) {
    stop(); wanted = device; stopping = false; const my = ++gen;
    try { ensureBuilt(); } catch (e) { onStatus({ error: e.message }); return; }
    const args = device ? ['--device', device] : [];
    const p = spawn(EXE, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child = p;
    let head = Buffer.alloc(0), analyzer = null, carry = Buffer.alloc(0), n = 0, err = '', pendBeat = false;
    p.stderr.on('data', d => { err += d; });
    p.stdout.on('data', chunk => {
      lastData = Date.now();
      if (!analyzer) {
        head = Buffer.concat([head, chunk]); if (head.length < 8) return;
        const rate = head.readInt32LE(0); chunk = head.subarray(8); analyzer = createAnalyzer({
          sampleRate: rate,
          onFrame: a => { onAudio({ ...a, bands: a.bands.slice() }); },   // full 40 Hz: per-channel reactivity needs the fast frames   // 20 Hz to clients; a beat on a skipped frame is carried over, never dropped
        });
        onStatus({ ok: true, source: 'wasapi-loopback', device: device || 'default output', sampleRate: rate });
      }
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const whole = buf.length - (buf.length % 4);
      carry = Buffer.from(buf.subarray(whole));
      if (whole) analyzer.push(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + whole)));
    });
    p.on('exit', code => {
      if (my !== gen || stopping) return;
      onStatus({ error: `loopback helper exited (${code})${err ? ': ' + err.trim().split('\n')[0] : ''}` });
      retry = setTimeout(() => start(wanted), 3000);          // device unplugged / driver reset: try again
    });
    p.on('error', e => onStatus({ error: e.message }));
  }
  function stop() { stopping = true; clearTimeout(retry); gen++; if (child) { try { child.kill(); } catch { /* gone */ } child = null; } }

  return { start, stop, restart: d => start(d ?? wanted), get lastDataAt() { return lastData; } };
}
