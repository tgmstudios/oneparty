// Predictive beat clock: a metronome at the song's tempo whose phase is nudged toward detected onsets (a phase-locked loop).
// Detected beats are noisy and late; the clock is steady, survives drops/breaks, and can be read AHEAD of now so slow
// lights (HA round-trip + bulb ramp) land on the beat instead of after it.
// Half/double-time detections are tolerated: an onset only corrects the phase if it lands near a predicted beat.
export function createBeatClock({ getBpm }) {
  let anchor = null;          // ms timestamp of some past predicted beat
  let period = 500;           // ms per beat
  let lastBpm = 0, lastHit = 0, conf = 0, errEma = 0;

  const syncPeriod = () => {
    const bpm = getBpm();
    if (bpm && bpm !== lastBpm) { lastBpm = bpm; period = 60000 / bpm; conf = Math.min(conf, 2); }   // new tempo: keep phase, re-earn trust
  };

  return {
    /** feed a detected beat (ms timestamp; subtract capture latency before calling if known) */
    hit(t = Date.now()) {
      syncPeriod();
      if (anchor == null) { anchor = t; lastHit = t; conf = 1; return; }
      const k = Math.round((t - anchor) / period), err = t - (anchor + k * period);
      if (Math.abs(err) > period * 0.22) {                      // off-grid: syncopation, hi-hat, or the clock is wrong
        if (conf <= 0 && t - lastHit > period * 6) { anchor = t; conf = 1; }   // lost for 6+ beats: relock on this one
        else conf = Math.max(0, conf - 0.5);
        return;
      }
      lastHit = t; conf = Math.min(8, conf + 1);
      errEma = errEma * 0.8 + err * 0.2;
      const gain = conf < 3 ? 0.5 : 0.18;                      // lock fast, then stay steady
      anchor += k * period + err * gain;
      // the same error, sustained one way, means the tempo is a little off: trim the period (bounded to 10% of nominal: database tempos are often a few BPM off)
      const nominal = lastBpm ? 60000 / lastBpm : period;
      period = Math.min(nominal * 1.10, Math.max(nominal * 0.90, period + (k !== 0 ? (err * 0.08) / Math.abs(k) : 0)));
    },
    /** beat position at time t (default now): { k: whole beats since anchor, phase: 0..1, sinceMs } */
    at(t = Date.now()) {
      syncPeriod();
      if (anchor == null) return null;
      const x = (t - anchor) / period, k = Math.floor(x);
      return { k, phase: x - k, sinceMs: (x - k) * period };
    },
    status() {
      const now = Date.now();
      return { bpm: anchor == null ? null : Math.round(60000 / period * 10) / 10, locked: anchor != null && conf >= 3 && now - lastHit < period * 4, conf, errMs: Math.round(errEma), lastHitAgoMs: lastHit ? now - lastHit : null };
    },
    reset() { anchor = null; conf = 0; errEma = 0; },
  };
}
