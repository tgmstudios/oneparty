// Predictive beat tracker (phase-locked loop on the onset stream).
// Input: onset strength frames (~40/s) with timestamps. Tempo comes from a hint (Deezer BPM / autocorrelation, +-6%) and is refined here.
// Every 250 ms a comb filter scores candidate (period, phase) pairs against the last ~10 s of onsets (recent onsets weigh more);
// the winning phase nudges the running clock, so the clock keeps ticking between onsets and predicts every future beat.
// A per-position bass-energy tally over the last bars picks the downbeat, so bar position (0..3) is predicted too.
const WIN = 10000, SIGMA = 40, STEPS = 32, FIT_EVERY = 250;

export function createBeatTracker() {
  let ev = [];                           // {t, v, b} recent onsets (v: all-band onset, b: bass flux)
  let P = 500, t0 = 0, locked = false, conf = 0, hintBpm = 120, lastFit = 0, good = 0, bad = 0;
  let beatIdx = 0, lastIdx = null, down = 0, pending = [];
  const tally = new Float64Array(4);

  function fit(now) {
    if (ev.length < 24) return;
    let mean = 0, n = 0; for (const e of ev) { mean += e.v; n++; } mean /= n;
    const pts = ev.map(e => ({ t: e.t, w: Math.max(0, e.v - mean) * Math.exp(-(now - e.t) / 6000) })).filter(p => p.w > 0);
    if (pts.length < 8) return;
    const base = locked ? [P] : [], cands = [];
    const p0 = 60000 / hintBpm;
    for (let k = -6; k <= 6; k++) cands.push(p0 * (1 + k / 100));
    if (locked) for (let k = -2; k <= 2; k++) cands.push(P * (1 + k / 100));
    let best = { s: -1 }, tot = 0, cnt = 0;
    for (const p of cands) {
      const sc = new Float64Array(STEPS);
      for (const q of pts) for (let k = 0; k < STEPS; k++) {
        let d = ((q.t - k * p / STEPS) % p + p) % p; if (d > p / 2) d -= p;
        sc[k] += q.w * Math.exp(-d * d / (2 * SIGMA * SIGMA));
      }
      let m = 0; for (let k = 0; k < STEPS; k++) m += sc[k]; m /= STEPS; tot += m; cnt++;
      for (let k = 0; k < STEPS; k++) if (sc[k] > best.s) best = { s: sc[k], p, k, m };
    }
    base.length = 0;
    const ratio = best.s / (best.m + 1e-9);
    conf = Math.max(0, Math.min(1, (ratio - 1.6) / 1.6));
    const phi = best.k * best.p / STEPS, nt0 = now - ((now - phi) % best.p + best.p) % best.p;
    if (!locked) {
      if (conf > 0.35) { if (++good >= 3) { locked = true; P = best.p; t0 = nt0; bad = 0; } } else good = 0;
    } else if (conf > 0.2) {
      let err = ((nt0 - t0) % P + P) % P; if (err > P / 2) err -= P;       // phase error to the nearest predicted beat
      t0 += 0.3 * err; P += 0.15 * (best.p - P); bad = 0;
    } else if (++bad >= 8) { locked = false; good = 0; }                   // ~2 s of mush: let go
  }

  return {
    /** feed one analysis frame. t in ms (performance.now), onset: summed positive spectral flux, bass: bass-band flux */
    push(t, onset, bassFlux = 0) {
      ev.push({ t, v: onset, b: bassFlux }); while (ev.length && t - ev[0].t > WIN) ev.shift();
      if (t - lastFit >= FIT_EVERY) { lastFit = t; fit(t); }
    },
    hint(bpm) { if (bpm > 40) hintBpm = bpm; },
    reset() { ev = []; locked = false; good = bad = 0; conf = 0; tally.fill(0); pending = []; lastIdx = null; },
    /** lead: ms to shift ahead so visuals land with the sound as heard (capture + transport latency) */
    update(now, lead = 60) {
      if (!locked) return { locked: false, conf, fired: false };
      const x = (now + lead - t0) / P, idx = Math.floor(x), phase = x - idx;
      let fired = false;
      if (lastIdx !== null && idx > lastIdx) { fired = true; pending.push({ idx, at: t0 + idx * P }); }
      lastIdx = idx;
      // downbeat: after each beat, tally the bass onset energy found within +-70 ms of it against its position mod 4
      while (pending.length && now > pending[0].at + 90) {
        const b = pending.shift(); let e = 0;
        for (const q of ev) if (Math.abs(q.t - b.at) < 70) e += q.b;
        const pos = ((b.idx % 4) + 4) % 4; for (let i = 0; i < 4; i++) tally[i] *= 0.995; tally[pos] += e;
        let m = 0; for (let i = 1; i < 4; i++) if (tally[i] > tally[m]) m = i; down = m;
      }
      const barPos = ((((idx - down) % 4) + 4) % 4) + phase;
      return { locked: true, conf, fired, period: P, bpm: 60000 / P, phase, beat: idx, barPos, bar: Math.floor(barPos),
        until: (1 - phase) * P, next: [1, 2, 3, 4].map(k => now + (1 - phase) * P + (k - 1) * P) };
    },
  };
}
