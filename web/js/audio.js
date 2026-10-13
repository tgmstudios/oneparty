// Live audio analysis from the default input (mic / line-in / loopback). Spotify gives no audio samples,
// so route the party audio into an input device (see docs/AUDIO.md).
async function getStream(source) {
  const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (source === 'loopback') {
    try {
      // System audio ("what you hear"). The launcher auto-selects the screen so no picker appears.
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: raw });
      s.getVideoTracks().forEach(t => t.stop());
      if (s.getAudioTracks().length) return s;
    } catch (e) { console.warn('loopback unavailable, falling back to mic:', e.message); }
  }
  return navigator.mediaDevices.getUserMedia({ audio: raw });
}
export async function startAudio(onFrame, { source = 'loopback' } = {}) {
  const stream = await getStream(source);
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.6; src.connect(an);
  const bins = new Uint8Array(an.frequencyBinCount);
  const hz = ctx.sampleRate / an.fftSize;
  const avg = (lo, hi) => { let s = 0, n = 0; for (let i = Math.floor(lo / hz); i <= Math.ceil(hi / hz) && i < bins.length; i++) { s += bins[i]; n++; } return n ? s / n / 255 : 0; };
  let prevBass = 0, fluxAvg = 0, lastBeat = 0;
  const out = { bass: 0, mid: 0, high: 0, level: 0, beat: false };
  function tick() {
    an.getByteFrequencyData(bins);
    const bass = avg(30, 150), mid = avg(150, 2000), high = avg(2000, 8000);
    const flux = Math.max(0, bass - prevBass); prevBass = bass;
    fluxAvg = fluxAvg * 0.95 + flux * 0.05;
    const now = performance.now();
    const beat = flux > fluxAvg * 2.2 + 0.03 && bass > 0.35 && now - lastBeat > 220;
    if (beat) lastBeat = now;
    Object.assign(out, { bass, mid, high, level: (bass + mid + high) / 3, beat });
    onFrame(out);
  }
  setInterval(tick, 1000 / 40);
  return ctx;
}
