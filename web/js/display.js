// A display = one fullscreen window bound to a channel in the event config.
// Roles: 'visuals' (live three.js scenes) / 'videos' (clip playlist). Mode can flip live<->cached<->video at runtime.
import { connect, postAudio } from './bus.js';
import { createHud } from './hud.js';
import { startAudio } from './audio.js';
import { createBeatTracker } from './beat.js';
import { createHubAudio } from './hubaudio.js';
import { createWhiteout } from './whiteout.js';

const Q = new URLSearchParams(location.search), id = Q.get('id') || 'main';
let streamBusy = false, streamAt = 0;
function streamFrame(canvas) {
  if (!Q.has('kioskstream') || streamBusy || performance.now() - streamAt < 125) return;
  streamBusy = true; streamAt = performance.now();
  canvas.toBlob(blob => {
    if (!blob) { streamBusy = false; return; }
    fetch('/api/kiosk-frame', { method: 'POST', body: blob }).catch(() => {}).finally(() => { streamBusy = false; });
  }, 'image/jpeg', 0.6);
}
const $ = s => document.querySelector(s);
let errT = null;
// Errors never paint over the picture (displays can be on air): console + hub report only. Add ?debug to the display URL to see them on screen.
const err = m => { console.error(m); if (!Q.has('debug')) return; $('#err').textContent = String(m); clearTimeout(errT); errT = setTimeout(() => { $('#err').textContent = ''; }, 10000); };
// A scene that fails to build or throws while running is swapped for one that works, so a live display never sits on a frozen or blank frame.
const failedScenes = new Set(); let lastGood = null, fallingBack = false;
async function fallback(failed) {
  if (fallingBack) return; fallingBack = true; failedScenes.add(failed);
  try {
    const tries = [lastGood, ...(S?.scenes || []).map(s => s.id)].filter((s, i, a) => s && !failedScenes.has(s) && a.indexOf(s) === i);
    for (const s of tries) { try { await showLive(s); report({ scene: failed, error: `fell back to "${s}"` }); return; } catch (e) { failedScenes.add(s); console.error(e); } }
  } finally { fallingBack = false; }
}
let S = null, active = null, fontsP = null, loopPhase = 0, last = performance.now(), lastRender = 0, snapReq = null;
const reloadV = {};            // scene id -> cache-bust stamp, bumped when the agent rewrites a scene file
const report = b => fetch('/api/report', { method: 'POST', body: JSON.stringify({ channel: id, ...b }), keepalive: true }).catch(() => {});
const param = (k, d) => S?.channels[id]?.params?.[k] ?? d;
const maxH = () => +param('maxH', Q.get('maxh') || 1440), fpsCap = () => +param('fps', Q.get('fps') || 60);
const audio = { bass: 0, mid: 0, high: 0, level: 0, beat: false };
// per-channel reactivity: fast per-band envelopes (instant attack, ~100 ms release), per-band hits (onsets over a running baseline), and kick/snare/hat envelopes
const bEnv = new Float32Array(16), bHit = new Float32Array(16), bBase = new Float32Array(16); let bandsRef = null, kickE = 0, snareE = 0, hatE = 0;
function channels(dt) {
  const bs = audio.bands;
  let fk = 0, fs = 0, fh = 0;
  if (bs && bs.length >= 16 && bs !== bandsRef) {
    bandsRef = bs;
    for (let i = 0; i < 16; i++) { const v = bs[i], fl = Math.max(0, v - bBase[i]); bBase[i] += (v - bBase[i]) * 0.18; const h = Math.min(1, fl * 3.2); if (h > bHit[i]) bHit[i] = h; if (i < 3) fk = Math.max(fk, h); else if (i >= 4 && i < 10) fs = Math.max(fs, h); else if (i >= 11) fh = Math.max(fh, h); }
  }
  const rel = Math.exp(-dt / 0.1), hr = Math.exp(-dt / 0.13);
  for (let i = 0; i < 16; i++) { bEnv[i] = Math.max(bs && bs[i] || 0, bEnv[i] * rel); bHit[i] *= hr; }
  kickE = Math.max(fk, kickE * Math.exp(-dt / 0.2)); snareE = Math.max(fs, snareE * Math.exp(-dt / 0.15)); hatE = Math.max(fh, hatE * Math.exp(-dt / 0.08));
}
let beatEnv = 0, bassSm = 0, gridAt = 0, seenAt = 0;
const hud = createHud($('#hud'));
const tracker = createBeatTracker(); let barsDone = 0, lastBarPos = 0, bt = { locked: false }, hueOff = 0, hueOut = 0, lastMode = null;
const feedBeat = a => { if (a.onset !== undefined) tracker.push(performance.now(), a.onset, a.bflux || 0); };
const sstep = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// ---------- audio: capture if this display is flagged, otherwise follow the SSE stream ----------
let capture = null, lastTry = -1e9;
function maybeCapture() {
  if (!S) return;
  const me = S.channels[id]; if (!me) return;
  if (S.audioMode !== 'browser') return;                // the hub captures audio itself
  if (!me.audio) {                                    // toggled off in the control panel
    if (capture?.stop) { capture.stop(); report({ kind: 'audio', idle: true }); }
    capture = null; return;
  }
  if (capture || performance.now() - lastTry < 15000) return;
  lastTry = performance.now(); capture = {}; let n = 0;
  startAudio(a => { Object.assign(audio, a); feedBeat(a); if (++n % 2 === 0) postAudio(a); }, { source: me.audioSource || 'loopback' })
    .then(h => { if (!S.channels[id]?.audio) { h.stop(); capture = null; } else { capture = h; report({ kind: 'audio', source: h.kind, label: h.label }); } })
    .catch(e => { capture = null; err('audio capture: ' + e.message); report({ kind: 'audio', error: e.message }); });
}

let whiteout; const setWhiteout = on => { try { (whiteout ??= createWhiteout($('#white'))).set(on).catch(e => err('whiteout: ' + e.message)); } catch (e) { err('whiteout: ' + e.message); } };
// ---------- live scene ----------
async function loadFonts(THREE_lib) {
  fontsP ??= Promise.all([THREE_lib.loadFont('/assets/fonts/Lato-Black.ttf'), THREE_lib.loadFont('/assets/fonts/Z003-MediumItalic.otf')]).then(([block, script]) => ({ block, script }));
  return fontsP;
}
// Overlay visibility follows the scene that is actually on screen (not the one just requested), so a scene's hideOverlays flips exactly when its picture
// does and a switch between scenes with the same overlay needs leaves the HUD completely untouched.
function refreshHud() {
  const ch = S?.channels[id]; if (!ch) return;
  const shown = active?.sceneId ?? ch.scene, hide = S.scenes?.find(x => x.id === shown)?.hideOverlays || [];
  hud.update(hide.length ? { ...ch, overlays: ch.overlays.filter(o => !hide.includes(o)) } : ch, S);
}
async function showLive(sceneId) {
  const lib = await import('/engine/lib.js');
  const host = document.createElement('div'); host.className = 'layer'; host.style.opacity = 0; $('#stage').appendChild(host);
  const scale = Math.min(1, maxH() / innerHeight);
  const W = Math.round(innerWidth * scale), H = Math.round(innerHeight * scale);
  const stage = lib.makeStage(W, H, { host });
  { const gl = stage.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');   // prove it is the real GPU
    report({ kind: 'gpu', renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }); }
  const C = { W, H, q: new URLSearchParams(), fonts: await loadFonts(lib), event: S.event };
  let inst;
  try {
    const mod = await import(`/engine/scenes/${sceneId}.js?v=${reloadV[sceneId] || 0}`); inst = await mod.build(stage, C);
    // Dry run while still invisible: agents edit engine files while displays are live, so a scene must survive a few real frames before it replaces the one on air.
    for (const p of [0, 0.31, 0.67]) { inst.update(p, Math.floor(p * 900)); stage.composer.render(); }
  }
  catch (e) { try { stage.dispose(); } catch {} host.remove(); throw e; }   // a failed build must not leave a blank layer on top
  const base = { bloom: stage.bloom.strength, fov: stage.camera.fov, exp: stage.renderer.toneMappingExposure };
  const next = { kind: 'live', sceneId, host, stage, inst, base, resize: () => stage.resize(Math.round(innerWidth * scale), Math.round(innerHeight * scale)) };
  host.style.opacity = 1;
  retire(active); active = next; lastGood = sceneId; report({ scene: sceneId }); refreshHud();
}
function retire(a) {
  if (!a) return;
  a.host.style.opacity = 0;
  setTimeout(() => { a.stop?.(); a.stage?.dispose(); a.video?.pause(); a.host.remove(); }, 600);
}

// ---------- streams: YouTube (live or not) / HLS / plain video URL ----------
const ytId = u => { try { const x = new URL(u); if (/youtu\.be$/.test(x.hostname)) return x.pathname.slice(1, 12); if (!/youtube(-nocookie)?\.com$/.test(x.hostname)) return null;
  return x.searchParams.get('v') || (x.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{11})/) || [])[1] || null; } catch { return null; } };
let streamEl = null;
const forceEmbed = new Set();   // YouTube URLs whose hub stream failed on this page: use the embed instead
async function showStream(url, token) {
  const host = document.createElement('div'); host.className = 'layer'; host.style.opacity = 0; $('#stage').appendChild(host);
  const sound = !!param('streamSound', false), id11 = ytId(url);
  let media;
  if (id11 && (param('streamVia', 'hub') === 'embed' || forceEmbed.has(url))) {
    media = document.createElement('iframe'); streamEl = { kind: 'yt', el: media };
    media.allow = 'autoplay; encrypted-media; picture-in-picture'; media.referrerPolicy = 'strict-origin-when-cross-origin';
    media.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';   // clicks fall through to the page: they are the gesture that unmutes
    media.src = 'https://www.youtube-nocookie.com/embed/' + id11 + '?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&enablejsapi=1&loop=1&playlist=' + id11 + '&origin=' + encodeURIComponent(location.origin);
  } else {
    const v = media = document.createElement('video'); streamEl = { kind: 'video', el: v };
    v.autoplay = true; v.playsInline = true; v.muted = true; v.loop = !id11 && !/\.m3u8/i.test(url);
    if (id11) {   // played through the hub (yt-dlp + ffmpeg there): works for live and VOD, no embed limits
      v.onerror = () => { if (streamEl?.el !== v) return; forceEmbed.add(url); err('hub stream failed, using the YouTube embed'); applied = ''; apply(); };
      v.onended = () => { if (streamEl?.el === v) { v.src = v.src; v.play().catch(() => {}); } };   // a normal video that finished: start it again
    }
    if (/\.m3u8(\?|$)/i.test(url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      if (!window.Hls) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = '/vendor/hls.min.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
      if (token !== applyToken) return host.remove();
      const h = new window.Hls({ lowLatencyMode: true }); h.loadSource(url); h.attachMedia(v);
      h.on(window.Hls.Events.ERROR, (_, d) => { if (d.fatal) err('stream error: ' + d.details); });
      streamEl.hls = h;
    } else v.src = id11 ? '/api/ytstream?url=' + encodeURIComponent(url) + '&h=' + param('streamH', Math.min(1080, maxH())) : url;
    v.play().catch(() => {});
  }
  host.appendChild(media); host.style.opacity = 1;
  const next = { kind: 'stream', host, stop: () => { streamEl?.hls?.destroy(); streamEl = null; } };
  retire(active); active = next; if (sound) pendingUnmute = true; unlockAll();
}
// Browsers only allow sound after a gesture on this page: any click/tap/key (or double-click for fullscreen) unmutes and resumes audio.
let pendingUnmute = false;
const unlockAll = () => {
  hubAudio.unlock();
  if (!streamEl || !param('streamSound', false)) return;
  if (streamEl.kind === 'yt') { const w = streamEl.el.contentWindow, cmd = (func, args = []) => w?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); cmd('unMute'); cmd('setVolume', [100]); cmd('playVideo'); }
  else { streamEl.el.muted = false; streamEl.el.play().catch(() => {}); }
  pendingUnmute = false; syncSoundHint();
};
['pointerdown', 'keydown', 'dblclick'].forEach(ev => addEventListener(ev, unlockAll));
// Hub audio: this device plays what the hub plays (channel param hubAudio). Suppressed while a stream with its own sound is up.
let audioState = 'off';
const hubAudio = createHubAudio({ onState: (s, error) => { audioState = s; syncSoundHint(); report({ kind: 'hubaudio', state: s, error }); } });   // the control panel shows this per display
const hint = document.createElement('div');
hint.style.cssText = 'position:fixed;left:2vw;bottom:2vh;z-index:50;padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;font:600 14px system-ui;display:none;pointer-events:none';
hint.textContent = '🔇 Tap or click anywhere to enable sound'; document.body.appendChild(hint);
function syncSoundHint() { hint.style.display = (audioState === 'blocked' || pendingUnmute) ? 'block' : 'none'; }
// Sound outputs this browser can play to, reported so the panel can offer them (labels need a one-time microphone permission in Chrome).
let outputsAt = 0, outputsAsked = false;
async function reportOutputs(mayAsk) {
  if (!navigator.mediaDevices?.enumerateDevices || Date.now() - outputsAt < 30000) return; outputsAt = Date.now();
  try {
    let list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    if (mayAsk && !outputsAsked && list.length && list.every(d => !d.label)) {   // no labels without a permission: ask once, release at once
      outputsAsked = true;
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput'); } catch { /* denied: ids only */ }
    }
    report({ kind: 'audiodevices', outputs: list.map(d => ({ id: d.deviceId, label: d.label })) });
  } catch { /* unsupported */ }
}
function syncHubAudio(ch) {
  const wants = !!ch.params?.hubAudio && !(ch.mode === 'stream' && ch.params?.streamSound);
  hubAudio.setSource(ch.params?.hubSource); hubAudio.setSink(ch.params?.hubSink);
  if (ch.params?.hubAudio) reportOutputs(!!ch.local);
  hubAudio.setVolume(ch.params?.hubVol ?? 1); hubAudio.setBuffer(ch.params?.hubBuffer ?? 3);
  if (wants && !hubAudio.active) hubAudio.start(); else if (!wants && hubAudio.active) hubAudio.stop();
}

// ---------- video playlist (user clips from media/<event>/ + baked scene loops from cache/<event>/) ----------
async function showVideo(src, loop) {
  const host = document.createElement('div'); host.className = 'layer'; host.style.opacity = 0;
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.loop = loop; v.src = src;
  host.appendChild(v); $('#stage').appendChild(host);
  try { await v.play(); }
  catch (e) { host.remove(); err('skipped an unplayable clip: ' + decodeURIComponent(src.split('/').pop()) + ' (' + e.message + ')'); return null; }
  host.style.opacity = 1;
  const next = { kind: 'video', host, video: v };
  retire(active); active = next; return v;
}
async function playlist() {
  const [media, cache] = await Promise.all([fetch('/api/media').then(r => r.json()), fetch('/api/cache').then(r => r.json())]);
  return [...media.map(f => '/media/' + encodeURIComponent(f)), ...cache.map(f => '/cache/' + encodeURIComponent(f))];
}
async function runPlaylist(token) {
  let list = (await playlist()), i = 0, fails = 0;
  const clip = param('clip', '');
  if (clip) { const hit = list.filter(u => decodeURIComponent(u.split('/').pop()) === clip); if (hit.length) list = hit; }   // a chosen clip loops on its own
  if (!list.length) { err('no clips yet: drop files in media/<event>/ or bake scenes from the control panel'); return showLive(S.channels[id].scene); }
  while (token === applyToken) {
    if (i > 0 && i % list.length === 0) { const fresh = await playlist(), c2 = param('clip', ''); const hit = c2 ? fresh.filter(u => decodeURIComponent(u.split('/').pop()) === c2) : fresh; if (hit.length) list = hit; }   // new downloads join at the end of a lap
    const v = await showVideo(list[i++ % list.length], list.length === 1);
    if (!v) { if (++fails >= list.length) { err('no playable clips - showing the live scene'); return showLive(S.channels[id].scene); } continue; }
    fails = 0;
    if (list.length === 1) return;
    await new Promise(r => { v.onended = r; v.onerror = r; setTimeout(r, 120000); });
  }
}

// ---------- apply channel state ----------
let applyToken = 0, applied = '';
async function apply() {
  const ch = S.channels[id]; if (!ch) { if (Q.get('remote')) return location.replace('/join.html'); return err(`no channel "${id}" in event`); }   // a remote display the hub forgot re-registers itself
  syncHubAudio(ch);
  const key = `${ch.mode}|${ch.scene}|${maxH()}|${ch.params?.clip || ''}|${ch.mode === 'stream' ? ch.params?.stream + '|' + !!ch.params?.streamSound : ''}`;
  if (key === applied) return; applied = key; const token = ++applyToken;
  try {
    if (ch.mode === 'stream' && ch.params?.stream) return showStream(ch.params.stream, token);
    if (ch.mode === 'video' || ch.role === 'videos' && ch.mode !== 'live') return runPlaylist(token);
    if (ch.mode === 'cached') { const c = await fetch('/api/cache').then(r => r.json()); if (c.includes(ch.scene + '.webm')) return showVideo(`/cache/${ch.scene}.webm`, true); }
    await showLive(ch.scene);
  } catch (e) { err(e.stack || e); report({ scene: ch.scene, error: String(e.stack || e) }); if (ch.mode !== 'stream' && token === applyToken) fallback(ch.scene); }
}

// ---------- frame loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // beat bump: real onsets snap a tempo grid; between them the grid keeps pumping at the song's BPM so every beat bumps
  tracker.hint(S?.bpm); bt = tracker.update(now, +param('beatLead', 60));
  if (bt.locked) { if (bt.barPos < lastBarPos - 2) barsDone++; lastBarPos = bt.barPos; }
  const trackLock = bt.locked && bt.conf > 0.3;
  { const period = 60000 / Math.max(60, S?.bpm || 120), live = audio.level > 0.05;
    if (trackLock && live) { audio.beat = false; if (bt.fired) beatEnv = Math.max(beatEnv, bt.bar === 0 ? 1 : 0.85); gridAt = now; seenAt = now; }   // predicted beat: lands on time even if the onset detector lags or misses it
    else if (audio.beat) { audio.beat = false; beatEnv = 1; gridAt = now; seenAt = now; }
    else if (live && seenAt && now - seenAt < 6000 && now - gridAt >= period * 1.02) { beatEnv = Math.max(beatEnv, 0.85); gridAt += period; if (now - gridAt > period) gridAt = now; } }
  beatEnv *= Math.pow(0.001, dt);            // ~0.5 s decay
  bassSm += (audio.bass - bassSm) * Math.min(1, dt * 12); channels(dt);
  try { hud.tick(); hud.audio(audio, beatEnv); } catch (e) { if (!hudErr) { hudErr = true; console.error('hud:', e); report({ kind: 'hud', status: { error: String(e.stack || e) } }); } }   // the HUD must never stop the scene from rendering
  $('#veil').classList.toggle('on', !!S?.blackout);
  setWhiteout(!!S?.whiteout);
  const a = active; if (!a) return;
  const R = Math.max(0, Math.min(1, +param('react', 1)));                         // music reactivity of the picture: 0 off .. 1 full
  if (a.kind === 'stream') return;
  if (a.kind === 'video') { a.video.style.filter = R ? `brightness(${1 + (0.15 * beatEnv + 0.08 * bassSm) * R})` : ''; return; }
  const dur = Math.max(2, 16 * 60 / (S.bpm || 120));            // one loop = 16 beats
  loopPhase = (loopPhase + dt / dur) % 1;
  if (now - lastRender < 1000 / fpsCap() - 2) return;     // fps cap (dev windows default to 30)
  lastRender = now;
  const { stage, inst, base } = a;
  if (a.broken) return;
  // music for scenes (absent in bakes; lib2.music(t) synthesizes the same shape from t). The beat clock is the tracker's prediction when locked,
  // otherwise the loop grid (16 beats per loop, 4 bars). hue steps a quarter turn per bar and the step finishes exactly on the downbeat.
  { let phase, bar, hueRaw; const mode = trackLock ? 1 : 0;
    if (trackLock) { phase = bt.phase; bar = bt.bar; hueRaw = 0.25 * (barsDone + sstep((bt.barPos / 4 - 0.85) / 0.15)); }
    else { const b = loopPhase * 16; phase = b % 1; bar = Math.floor(b) % 4; hueRaw = 0.25 * (Math.floor(b / 4) + sstep(((b % 4) / 4 - 0.85) / 0.15)); }
    if (lastMode !== null && mode !== lastMode) { hueOff = hueOut - hueRaw; hueOff -= Math.round(hueOff); } lastMode = mode;
    hueOff -= hueOff * Math.min(1, dt * 1.5); hueOut = hueRaw + hueOff;
    window.oneAudio = { bass: bassSm * R, mid: audio.mid * R, high: audio.high * R, level: audio.level * R, bands: audio.bands, env: bEnv.map(v => v * R), hit: bHit.map(v => v * R), kick: kickE * R, snare: snareE * R, hat: hatE * R, beat: beatEnv * R,
      phase, bar, anticipate: sstep((phase - 0.7) / 0.3) * R, hue: hueOut, locked: trackLock, conf: bt.conf || 0, speed: Math.max(0.1, +param('speed', 1)), bpm: trackLock ? bt.bpm : (S?.bpm || 120), until: trackLock ? bt.until : (1 - phase) * 60000 / (S?.bpm || 120) }; }
  try { inst.update(loopPhase, Math.floor(loopPhase * 30 * dur)); }
  catch (e) { a.broken = true; err(e.stack || e); report({ scene: a.sceneId, error: 'update(): ' + (e.stack || e) }); return fallback(a.sceneId); }
  stage.bloom.strength = base.bloom * (1 + (0.3 * bassSm + 0.18 * beatEnv) * R);       // audio -> look, applied by the host so every scene reacts
  stage.renderer.toneMappingExposure = base.exp * (1 + 0.05 * beatEnv * R);
  stage.camera.zoom = 1 + 0.02 * beatEnv * R; stage.camera.updateProjectionMatrix();
  stage.dither.uniforms.uF.value = (stage.dither.uniforms.uF.value + 1) % 97;
  stage.composer.render();
  streamFrame(stage.renderer.domElement);
  if (snapReq) sendSnapshot(a.stage.renderer.domElement, a.sceneId);   // same frame, so the drawing buffer is still valid
}
function sendSnapshot(canvas, scene) {
  const req = snapReq; snapReq = null;
  const url = canvas.toDataURL('image/jpeg', 0.85);
  fetch(url).then(r => r.blob()).then(blob => fetch(`/api/snapshot?scene=${encodeURIComponent(scene)}&req=${req}`, { method: 'POST', body: blob })).catch(() => {});
}

let lastHud = '', hudErr = false;
setInterval(() => { const st = hud.status(), j = JSON.stringify(st); if (j !== lastHud) { lastHud = j; report({ kind: 'hud', status: st }); } }, 1500);
addEventListener('pagehide', () => navigator.sendBeacon?.('/api/report', JSON.stringify({ channel: id, kind: 'bye' })));   // closed tab: show it offline right away
report({ kind: 'hello', caps: ['hubaudio', 'stream'] });   // lets the control panel tell an out-of-date tab (needs a reload) from a working one
setInterval(() => report({ kind: 'ping' }), 5000); report({ kind: 'ping' });   // presence: the control panel shows who is online
addEventListener('resize', () => active?.resize?.());
addEventListener('dblclick', () => document.documentElement.requestFullscreen?.().catch(() => {}));
connect({
  state: s => { S = s; document.documentElement.style.setProperty('--accent', s.event.theme?.accent || '#ff6a10'); refreshHud(); apply(); maybeCapture(); },
  refresh: ({ channel }) => { if (!channel || channel === id) location.reload(); },
  track: ({ track, lyrics }) => hud.setTrack(track, lyrics),
  progress: t => hud.setProgress(t),
  queue: q => { if (S) S.queue = q; hud.setQueue(q); },
  audio: a => { if (capture?.stop) return;
    // while this display plays the (buffered) hub audio, the visuals' audio feed is held back by the same amount so the picture matches what is heard
    const d = hubAudio.active ? hubAudio.buffer * 1000 + 80 : 0;
    if (d) setTimeout(() => { Object.assign(audio, a); feedBeat(a); }, d); else { Object.assign(audio, a); feedBeat(a); } },
  cache: () => { const ch = S?.channels[id]; if (ch && (ch.mode === 'video' || (ch.role === 'videos' && ch.mode !== 'live'))) return; applied = ''; if (S) apply(); },   // playlists pick new files up themselves
  reload: ({ scene }) => { reloadV[scene] = Date.now(); failedScenes.delete(scene); if (S?.channels[id]?.scene === scene) { applied = ''; apply(); } },
  snapshot: ({ req, channel }) => {
    if (channel !== id) return;
    if (active?.kind === 'live') snapReq = req;
    else if (active?.kind === 'video') { const v = active.video, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); snapReq = req; sendSnapshot(c, 'video'); }
  },
});
requestAnimationFrame(frame);
