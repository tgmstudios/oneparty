// Audio analysis in Node: PCM -> bass/mid/high, beat flag, tempo estimate. Mirrors what the browser AnalyserNode path did
// (FFT 1024, Blackman window, 0.6 smoothing, -100..-30 dB byte mapping) so levels and thresholds behave the same.
const N = 1024, RATE = 40;                     // fft size, analysis frames per second
const SMOOTH = 0.6, MIN_DB = -100, MAX_DB = -30;
const NB = 16, EDGES = Array.from({ length: NB + 1 }, (_, i) => 40 * Math.pow(12000 / 40, i / NB));   // 40 Hz .. 12 kHz, log-spaced

const win = new Float64Array(N);
{ const a = 0.16, a0 = (1 - a) / 2, a1 = 0.5, a2 = a / 2; for (let i = 0; i < N; i++) win[i] = a0 - a1 * Math.cos(2 * Math.PI * i / N) + a2 * Math.cos(4 * Math.PI * i / N); }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }
const rev = new Uint16Array(N);
for (let i = 0; i < N; i++) { let r = 0, x = i; for (let b = 0; b < 10; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
function fft(re, im) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size) for (let k = 0; k < half; k++) {
      const wr = cosT[k * step], wi = sinT[k * step], a = i + k, b = a + half;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}

export function createAnalyzer({ sampleRate, onFrame }) {
  const hop = Math.round(sampleRate / RATE), hz = sampleRate / N;
  const ring = new Float32Array(N); let ringW = 0, sinceHop = 0, frames = 0;
  const re = new Float64Array(N), im = new Float64Array(N), smooth = new Float64Array(N / 2), bins = new Uint8Array(N / 2);
  let prevBass = 0, lastBeat = 0, peak = 0.2, prev = null;
  const fh = new Float32Array(RATE); let fhI = 0;
  // tempo: autocorrelation of the spectral-flux onset envelope over 8 s, octave-biased toward 125 BPM
  const ENV = RATE * 8, env = new Float32Array(ENV); let envI = 0, envFilled = 0; const recent = [];
  const out = { bass: 0, mid: 0, high: 0, level: 0, beat: false, bpm: 0, bands: new Array(NB).fill(0) };

  const avg = (lo, hi) => { let s = 0, n = 0; for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) { s += bins[i]; n++; } return n ? s / n / 255 : 0; };

  function estimateBpm() {
    const x = new Float32Array(ENV); let mean = 0;
    for (let i = 0; i < ENV; i++) { x[i] = env[(envI + i) % ENV]; mean += x[i]; } mean /= ENV;
    let v0 = 0; for (let i = 0; i < ENV; i++) { x[i] -= mean; v0 += x[i] * x[i]; }
    if (v0 < 1e-6) return 0;
    let best = 0, bestScore = 0, bestR = 0;
    for (let bpm = 75; bpm <= 175; bpm += 0.5) {
      const lag = RATE * 60 / bpm, l0 = Math.floor(lag), f = lag - l0; let r = 0;
      for (let i = 0; i + l0 + 1 < ENV; i++) r += x[i] * (x[i + l0] * (1 - f) + x[i + l0 + 1] * f);
      r /= v0; const score = r * Math.exp(-Math.pow(Math.log2(bpm / 125), 2) / (2 * 0.4 * 0.4));
      if (score > bestScore) { bestScore = score; best = bpm; bestR = r; }
    }
    return bestR > 0.12 ? best : 0;
  }

  function frame(nowMs) {
    for (let i = 0; i < N; i++) { re[i] = ring[(ringW + i) % N] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) {
      const mag = Math.hypot(re[k], im[k]) / N;
      smooth[k] = SMOOTH * smooth[k] + (1 - SMOOTH) * mag;
      const db = 20 * Math.log10(smooth[k] + 1e-12);
      bins[k] = Math.max(0, Math.min(255, Math.round((db - MIN_DB) / (MAX_DB - MIN_DB) * 255)));
    }
    let bass = avg(30, 150), mid = avg(150, 2000), high = avg(2000, 8000);
    const rawMax = Math.max(bass, mid, high);
    let gain = 0;
    if (rawMax < 0.04) { bass = mid = high = 0; }                  // noise gate: silence reads as exactly zero
    else {
      peak = Math.max(peak * 0.998, rawMax, 0.2);                 // slow-decay peak: auto gain, capped at 4x
      const g = Math.min(4, 0.8 / peak); gain = g; bass = Math.min(1, bass * g); mid = Math.min(1, mid * g); high = Math.min(1, high * g);
    }
    for (let b = 0; b < NB; b++) out.bands[b] = gain ? Math.round(Math.min(1, avg(EDGES[b], EDGES[b + 1]) * gain) * 100) / 100 : 0;
    // onset strength for tempo
    let onset = 0; if (prev) for (let i = 1; i < 100; i++) { const d = bins[i] - prev[i]; if (d > 0) onset += d; } prev = Uint8Array.from(bins);
    env[envI] = onset; envI = (envI + 1) % ENV; envFilled = Math.min(ENV, envFilled + 1);
    if (++frames % RATE === 0 && envFilled === ENV) {
      const e = estimateBpm(); if (e) { recent.push(e); if (recent.length > 7) recent.shift(); } else if (recent.length) recent.shift();
      out.bpm = recent.length >= 4 ? [...recent].sort((a, b) => a - b)[recent.length >> 1] : 0;
    }
    // beat = bass flux well above its own recent level (adaptive: mean + 1.1 sigma over ~1 s), >=230 ms apart
    const flux = Math.max(0, bass - prevBass); prevBass = bass;
    fh[fhI] = flux; fhI = (fhI + 1) % fh.length;
    let fm = 0; for (let i = 0; i < fh.length; i++) fm += fh[i]; fm /= fh.length;
    let fs = 0; for (let i = 0; i < fh.length; i++) fs += (fh[i] - fm) * (fh[i] - fm); fs = Math.sqrt(fs / fh.length);
    const beat = flux > fm + 1.1 * fs + 0.02 && bass > 0.12 && nowMs - lastBeat > 230;
    if (beat) lastBeat = nowMs;
    Object.assign(out, { bass, mid, high, level: (bass + mid + high) / 3, beat, onset: Math.round(onset), bflux: Math.round(flux * 1000) / 1000 });   // onset/bflux feed the display's predictive beat tracker
    onFrame(out);
  }

  return {
    /** @param {Float32Array} samples mono PCM at sampleRate */
    push(samples, nowMs = Date.now()) {
      for (let i = 0; i < samples.length; i++) {
        ring[ringW] = samples[i]; ringW = (ringW + 1) % N;
        if (++sinceHop >= hop) { sinceHop = 0; frame(nowMs); }
      }
    },
  };
}
