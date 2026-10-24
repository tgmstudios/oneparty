// Music-driven scene switching. Cuts the main channel to another scene on (remote visuals displays rotate with it, each to a different scene):
//   - a phrase boundary: every `bars` bars (4 beats each) of real, detected beats, landing on a beat
//   - a drop: the kick/bass comes back after a breakdown (no kicks or the bass collapsing for ~1.5 s), or the energy
//     surges well above its own recent average. The overall level is nearly flat on loud, compressed music, so it is not used alone.
//   - a new song
// With no audio frames (nothing capturing), it falls back to the tempo clock so it still cuts in time.
// HYPE: the song's intensity is tracked live as state.hype = { now, target } (0..10): loudness + bass relative to the song's own peak,
// tempo, how much the energy swings, and a bump after each drop. Each scene carries an agent-judged hype score (event.json scenes[].hype.score =
// mean of busy [how much is going on] and jumpy [how hard it snaps to the beat]); picks favour scenes whose score is near the song's hype,
// and a sustained mismatch (hype far from the current scene's) forces a cut.
// Config lives in state.auto and is persisted with the other live settings.
export const AUTO_DEFAULTS = { on: false, channel: null, pool: null, bars: 16, minSec: 25, cooldown: 30, onSong: true, onDrop: true, sens: 4, shuffle: true, hypeMatch: true, hypeSpread: 1.8, mode: 'live' };   // sens 1 (calm) .. 10 (cuts on any hint of a drop)

export function createAutoScene({ state, setScene }) {
  const cfg = () => state.auto;
  let beats = 0, lastSwitch = Date.now(), lastAudio = 0, lastTick = Date.now();
  let eMed = 0, bMed = 0, ePeak = 0.3, bPeak = 0.3, hype = 5, dropBoost = 0, lastHypeCut = 0;
  const recent = [];
  const sceneHype = id => state.scenes.find(s => s.id === id)?.hype?.score ?? 5;
  let bFast = 0, bSlow = 0, eFast = 0, eSlow = 0, eVar = 0.001, lastKick = 0, quietSince = 0;

  const channelId = () => cfg().channel && state.channels[cfg().channel] ? cfg().channel : Object.keys(state.channels)[0];
  const eligible = () => {
    const ok = id => state.sceneStatus[id]?.ok !== false;
    const ids = (cfg().pool?.length ? cfg().pool : state.scenes.map(s => s.id)).filter(id => state.scenes.some(s => s.id === id));
    return ids.filter(ok);
  };
  // shuffle = a bag: every eligible scene plays once in random order before any repeats; refilled when empty
  // (never starting the new round with the scene that just played). Sorted order when shuffle is off.
  let bag = [];
  function pick() {
    const cur = state.channels[channelId()]?.scene, all = eligible();
    if (!all.length || (all.length === 1 && all[0] === cur)) return null;
    if (!cfg().shuffle) return all[(all.indexOf(cur) + 1) % all.length];
    bag = bag.filter(id => all.includes(id) && id !== cur);
    if (!bag.length) {
      bag = all.filter(id => id !== cur);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    return bag.shift();
  }
  // hype-weighted draw: gaussian around the target hype, the last few scenes excluded (variety), the current one never repeated
  function pickHype(bias = 0) {
    const cur = state.channels[channelId()]?.scene, all = eligible();
    if (!all.length || (all.length === 1 && all[0] === cur)) return null;
    const target = Math.min(10, Math.max(0, hype + bias)), sd = Math.max(0.5, cfg().hypeSpread || 1.8);
    let pool = all.filter(id => id !== cur && !recent.includes(id));
    if (!pool.length) pool = all.filter(id => id !== cur);
    const w = pool.map(id => Math.exp(-((sceneHype(id) - target) ** 2) / (2 * sd * sd)) + 0.02);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= w[i]) > 0) i++;
    return pool[i];
  }
  async function cut(why, bias = 0) {
    if (since() < (cfg().cooldown ?? 0)) return;   // hard cooldown after any scene change on the channel (manual or auto), applies to every trigger
    const useHype = cfg().hypeMatch !== false && Date.now() - lastAudio < 3000;
    const id = useHype ? pickHype(bias) : pick(); if (!id) return;
    recent.push(id); if (recent.length > 3) recent.shift();
    beats = 0; lastSwitch = Date.now();
    cfg().last = { scene: id, why, at: Date.now(), hype: +hype.toFixed(1), sceneHype: sceneHype(id) };
    await setScene({ type: 'scene', channel: channelId(), scene: id, mode: cfg().mode === 'cached' ? 'cached' : 'live' });
    // remote displays rotate on the same cut, each landing on a scene nobody else is showing
    const used = new Set([id]);
    for (const [cid, ch] of Object.entries(state.channels)) {
      if (!rotates(cid, ch)) continue;
      const sid = pickFor(cid, used); if (!sid) continue;
      used.add(sid);
      await setScene({ type: 'scene', channel: cid, scene: sid, mode: ch.mode });
    }
  }
  // which remote displays take part: online, showing live/baked scenes, not mirroring, not opted out (param autoRotate:false)
  const rotates = (cid, ch) => cid !== channelId() && (ch.remote || ch.local) && ch.role === 'visuals' && !ch.follow && (ch.mode === 'live' || ch.mode === 'cached')
    && ch.params?.autoRotate !== false && !!ch.lastSeen && Date.now() - ch.lastSeen < 15000;
  // another display's scene: hype-weighted like the main pick, but never its own current scene, and preferably one no other screen has
  function pickFor(cid, used) {
    const cur = state.channels[cid]?.scene, all = eligible().filter(s => s !== cur);
    let pool = all.filter(s => !used.has(s)); if (!pool.length) pool = all;
    if (!pool.length) return null;
    if (cfg().hypeMatch === false || Date.now() - lastAudio >= 3000) return pool[Math.floor(Math.random() * pool.length)];
    const sd = Math.max(0.5, cfg().hypeSpread || 1.8), w = pool.map(s => Math.exp(-((sceneHype(s) - hype) ** 2) / (2 * sd * sd)) + 0.02);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= w[i]) > 0) i++;
    return pool[i];
  }
  const since = () => (Date.now() - lastSwitch) / 1000;

  return {
    onAudio(a) {
      const now = Date.now(), dt = Math.min(1, (now - lastTick) / 1000); lastTick = now; lastAudio = now;
      const e = (a.bass || 0) * 0.6 + (a.level || 0) * 0.4, k = t => Math.min(1, dt / t);
      bFast += (a.bass - bFast) * k(0.3); bSlow += (a.bass - bSlow) * k(8);
      eFast += (e - eFast) * k(0.5); eVar += ((e - eSlow) ** 2 - eVar) * k(8); eSlow += (e - eSlow) * k(8);
      if (a.beat) { beats++; lastKick = now; }
      // ---- hype (always tracked, so the panel/agents can read it even with auto off)
      eMed += (e - eMed) * k(5); bMed += (a.bass - bMed) * k(5);
      ePeak = Math.max(eMed, ePeak - dt * ePeak / 120); bPeak = Math.max(bMed, bPeak - dt * bPeak / 120);   // peaks forget over ~2 min
      dropBoost = Math.max(0, dropBoost - dt / 10);
      const clamp01 = v => Math.min(1, Math.max(0, v));
      const en = clamp01(0.65 * eMed / 0.7 + 0.35 * eMed / Math.max(0.45, ePeak)), bs = clamp01(0.65 * bMed / 0.7 + 0.35 * bMed / Math.max(0.45, bPeak));
      const tempo = clamp01(((state.bpm || 120) - 80) / 90), dyn = clamp01(Math.sqrt(eVar) / Math.max(0.05, eSlow) / 0.5);
      hype += (10 * (0.35 * en + 0.25 * bs + 0.15 * tempo + 0.15 * dyn + 0.10 * dropBoost) - hype) * k(5);
      state.hype = { now: +hype.toFixed(2), target: +Math.min(10, hype + (dropBoost > 0.5 ? 1.5 : 0)).toFixed(2) };
      if (!cfg().on) return;
      const sens = Math.min(10, Math.max(1, cfg().sens || 5));
      // breakdown: kicks stop or the bass collapses; drop: they come back hard
      const quiet = (lastKick && now - lastKick > 1800) || bFast < bSlow * 0.5;
      let drop = false;
      if (quiet) quietSince = quietSince || now;
      else if (quietSince) { const len = now - quietSince; quietSince = 0; drop = len >= 1500 - sens * 60 && (a.beat || bFast > bSlow * 0.8); }
      // surge: energy well above what it has been (z-score against its own recent spread)
      if (!drop && (eFast - eSlow) / Math.max(0.025, Math.sqrt(eVar)) > 3.6 - sens * 0.22) drop = true;
      if (drop) dropBoost = 1;
      if (cfg().onDrop && drop && since() >= Math.max(12, cfg().minSec * 0.6)) return cut('drop', 1.5);
      // sustained mismatch: the music's hype is far from this scene's (a hot scene in a lull, a calm one at a peak)
      const cur = state.channels[channelId()]?.scene;
      if (cfg().hypeMatch !== false && a.beat && (hype - sceneHype(cur) > 2.2 || sceneHype(cur) - hype > 3.2) && since() >= Math.max(cfg().minSec * 0.7, 14) && now - lastHypeCut > 20000) { lastHypeCut = now; return cut('hype'); }
      if (a.beat && beats >= cfg().bars * 4 && since() >= cfg().minSec) return cut('phrase');
    },
    onSong() { if (cfg().on && cfg().onSong && state.track) cut('song'); },
    // no audio frames: keep time from the tempo
    tick() {
      if (!cfg().on || Date.now() - lastAudio < 3000 || !state.track?.playing) return;
      if (since() >= Math.max(cfg().minSec, cfg().bars * 4 * 60 / Math.max(40, state.bpm))) cut('clock');
    },
    reset() { beats = 0; lastSwitch = Date.now(); },
    // a scene changed on the auto channel (e.g. picked by hand): restart the cooldown and phrase count
    noteSwitch(channel) { if (channel === channelId()) { beats = 0; lastSwitch = Date.now(); } },
  };
}
