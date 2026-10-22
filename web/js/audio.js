// Live audio analysis from the default input (mic / line-in / loopback). Spotify gives no audio samples,
// so route the party audio into an input device (see docs/AUDIO.md).
async function getStream(source) {
  const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (source === 'mic') return { stream: await navigator.mediaDevices.getUserMedia({ audio: raw }), kind: 'mic' };
  // Windows audio OUTPUT (WASAPI loopback of the default playback device = exactly what you hear). The launcher
  // auto-selects the screen so no picker appears. No fallback: a silent mic would look like it works but would not.
  const s = await navigator.mediaDevices.getDisplayMedia({ video: { width: 2, height: 2, frameRate: 1 }, audio: { ...raw, suppressLocalAudioPlayback: false }, systemAudio: 'include' });
  const vt = s.getVideoTracks()[0], info = vt ? `${vt.getSettings().displaySurface || '?'} "${vt.label}"` : 'no video track';
  s.getVideoTracks().forEach(t => t.stop());
  if (!s.getAudioTracks().length) { s.getTracks().forEach(t => t.stop()); throw new Error('capture has no system audio (auto-selected ' + info + ')'); }
  return { stream: s, kind: 'loopback' };
}
export async function startAudio(onFrame, { source = 'loopback' } = {}) {
  const { stream, kind } = await getStream(source);
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.6; src.connect(an);
  const bins = new Uint8Array(an.frequencyBinCount);
  const hz = ctx.sampleRate / an.fftSize;
  const avg = (lo, hi) => { let s = 0, n = 0; for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) { s += bins[i]; n++; } return n ? s / n / 255 : 0; };
  let prevBass = 0, fluxAvg = 0, lastBeat = 0, peak = 0.2;
  const out = { bass: 0, mid: 0, high: 0, level: 0, beat: false, bpm: 0 };
  // Tempo estimate: autocorrelation of the spectral-flux onset envelope (8 s window, fractional lags), octave-biased toward 125 BPM.
  const RATE = 40, N = RATE * 8, ring = new Float32Array(N); let ringI = 0, filled = 0, ticks = 0, prev = null; const recent = [];
  function estimateBpm() {
    const x = new Float32Array(N); let mean = 0;
    for (let i = 0; i < N; i++) { x[i] = ring[(ringI + i) % N]; mean += x[i]; } mean /= N;
    let v0 = 0; for (let i = 0; i < N; i++) { x[i] -= mean; v0 += x[i] * x[i]; }
    if (v0 < 1e-6) return 0;
    let best = 0, bestScore = 0, bestR = 0;
    for (let bpm = 75; bpm <= 175; bpm += 0.5) {
      const lag = RATE * 60 / bpm, l0 = Math.floor(lag), f = lag - l0; let r = 0;
      for (let i = 0; i + l0 + 1 < N; i++) r += x[i] * (x[i + l0] * (1 - f) + x[i + l0 + 1] * f);
      r /= v0; const score = r * Math.exp(-Math.pow(Math.log2(bpm / 125), 2) / (2 * 0.4 * 0.4));
      if (score > bestScore) { bestScore = score; best = bpm; bestR = r; }
    }
    return bestR > 0.12 ? best : 0;
  }
  function tick() {
    an.getByteFrequencyData(bins);
    let bass = avg(30, 150), mid = avg(150, 2000), high = avg(2000, 8000);
    const rawMax = Math.max(bass, mid, high);
    if (rawMax < 0.04) { bass = mid = high = 0; }                       // noise gate: paused/silent system audio reads as exactly zero
    else {
      peak = Math.max(peak * 0.998, rawMax, 0.2);                      // slow-decay peak (~17 s half-life): auto gain, capped at 4x
      const g = Math.min(4, 0.8 / peak); bass = Math.min(1, bass * g); mid = Math.min(1, mid * g); high = Math.min(1, high * g);
    }
    let onset = 0;
    { if (prev) for (let i = 1; i < 100; i++) { const d = bins[i] - prev[i]; if (d > 0) onset += d; } prev = Uint8Array.from(bins);
      ring[ringI] = onset; ringI = (ringI + 1) % N; filled = Math.min(N, filled + 1);
      if (++ticks % RATE === 0 && filled === N) { const e = estimateBpm(); if (e) { recent.push(e); if (recent.length > 7) recent.shift(); } else if (recent.length) recent.shift();
        out.bpm = recent.length >= 4 ? [...recent].sort((a, b) => a - b)[recent.length >> 1] : 0; } }
    const flux = Math.max(0, bass - prevBass); prevBass = bass;
    fluxAvg = fluxAvg * 0.95 + flux * 0.05;
    const now = performance.now();
    const beat = flux > fluxAvg * 2.2 + 0.03 && bass > 0.35 && now - lastBeat > 220;
    if (beat) lastBeat = now;
    Object.assign(out, { bass, mid, high, level: (bass + mid + high) / 3, beat, onset: Math.round(onset), bflux: Math.round(flux * 1000) / 1000 });
    onFrame(out);
  }
  const timer = setInterval(tick, 1000 / 40);
  return { ctx, kind, label: stream.getAudioTracks()[0]?.label || '', stop() { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => {}); } };
}
