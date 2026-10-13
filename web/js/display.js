// A display = one fullscreen window bound to a channel in the event config.
// Roles: 'visuals' (live three.js scenes) / 'videos' (clip playlist). Mode can flip live<->cached<->video at runtime.
import { connect, postAudio } from './bus.js';
import { createHud } from './hud.js';
import { startAudio } from './audio.js';

const id = new URLSearchParams(location.search).get('id') || 'main';
const $ = s => document.querySelector(s);
const err = m => { $('#err').textContent = String(m); console.error(m); };
let S = null, active = null, fontsP = null, loopPhase = 0, last = performance.now();
const audio = { bass: 0, mid: 0, high: 0, level: 0, beat: false };
let beatEnv = 0, bassSm = 0;
const hud = createHud($('#hud'), []);

// ---------- audio: capture if this display is flagged, otherwise follow the SSE stream ----------
let capturing = false;
function maybeCapture() {
  if (capturing || !S) return;
  const me = S.channels[id]; if (!me) return;
  if (!me.audio) return;
  capturing = true; let n = 0;
  startAudio(a => { Object.assign(audio, a); if (++n % 2 === 0) postAudio(a); }, { source: me.audioSource || 'loopback' }).catch(e => { capturing = false; err('audio capture: ' + e.message); });
}

// ---------- live scene ----------
async function loadFonts(THREE_lib) {
  fontsP ??= Promise.all([THREE_lib.loadFont('/assets/fonts/Lato-Black.ttf'), THREE_lib.loadFont('/assets/fonts/Z003-MediumItalic.otf')]).then(([block, script]) => ({ block, script }));
  return fontsP;
}
async function showLive(sceneId) {
  const lib = await import('/engine/lib.js');
  const host = document.createElement('div'); host.className = 'layer'; host.style.opacity = 0; $('#stage').appendChild(host);
  const maxH = 1440, scale = Math.min(1, maxH / innerHeight);
  const W = Math.round(innerWidth * scale), H = Math.round(innerHeight * scale);
  const stage = lib.makeStage(W, H, { host });
  const C = { W, H, q: new URLSearchParams(), fonts: await loadFonts(lib), event: S.event };
  const mod = await import(`/engine/scenes/${sceneId}.js`);
  const inst = await mod.build(stage, C);
  const base = { bloom: stage.bloom.strength, fov: stage.camera.fov, exp: stage.renderer.toneMappingExposure };
  const next = { kind: 'live', sceneId, host, stage, inst, base, resize: () => stage.resize(Math.round(innerWidth * scale), Math.round(innerHeight * scale)) };
  host.style.opacity = 1;
  retire(active); active = next;
}
function retire(a) {
  if (!a) return;
  a.host.style.opacity = 0;
  setTimeout(() => { a.stage?.dispose(); a.video?.pause(); a.host.remove(); }, 600);
}

// ---------- video playlist (user clips from media/<event>/ + baked scene loops from cache/<event>/) ----------
async function showVideo(src, loop) {
  const host = document.createElement('div'); host.className = 'layer'; host.style.opacity = 0;
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.loop = loop; v.src = src;
  host.appendChild(v); $('#stage').appendChild(host);
  await v.play().catch(e => err('video: ' + e.message));
  host.style.opacity = 1;
  const next = { kind: 'video', host, video: v };
  retire(active); active = next; return v;
}
async function playlist() {
  const [media, cache] = await Promise.all([fetch('/api/media').then(r => r.json()), fetch('/api/cache').then(r => r.json())]);
  return [...media.map(f => '/media/' + encodeURIComponent(f)), ...cache.map(f => '/cache/' + encodeURIComponent(f))];
}
async function runPlaylist(token) {
  const list = (await playlist()); let i = 0;
  if (!list.length) { err('no clips yet: drop files in media/<event>/ or bake scenes from the control panel'); return showLive(S.channels[id].scene); }
  while (token === applyToken) {
    const v = await showVideo(list[i++ % list.length], list.length === 1);
    if (list.length === 1) return;
    await new Promise(r => { v.onended = r; v.onerror = r; setTimeout(r, 120000); });
  }
}

// ---------- apply channel state ----------
let applyToken = 0, applied = '';
async function apply() {
  const ch = S.channels[id]; if (!ch) return err(`no channel "${id}" in event`);
  const key = `${ch.mode}|${ch.scene}`;
  if (key === applied) return; applied = key; const token = ++applyToken;
  try {
    if (ch.mode === 'video' || ch.role === 'videos' && ch.mode !== 'live') return runPlaylist(token);
    if (ch.mode === 'cached') { const c = await fetch('/api/cache').then(r => r.json()); if (c.includes(ch.scene + '.webm')) return showVideo(`/cache/${ch.scene}.webm`, true); }
    await showLive(ch.scene);
  } catch (e) { err(e.stack || e); }
}

// ---------- frame loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (audio.beat) { beatEnv = 1; audio.beat = false; }
  beatEnv *= Math.pow(0.001, dt);            // ~0.5 s decay
  bassSm += (audio.bass - bassSm) * Math.min(1, dt * 12);
  hud.tick();
  $('#veil').classList.toggle('on', !!S?.blackout);
  const a = active; if (!a) return;
  if (a.kind === 'video') { a.video.style.filter = `brightness(${1 + 0.35 * beatEnv + 0.2 * bassSm})`; return; }
  const dur = Math.max(2, 16 * 60 / (S.bpm || 120));            // one loop = 16 beats
  loopPhase = (loopPhase + dt / dur) % 1;
  const { stage, inst, base } = a;
  inst.update(loopPhase, Math.floor(loopPhase * 30 * dur));
  stage.bloom.strength = base.bloom * (1 + 0.9 * bassSm + 0.6 * beatEnv);       // audio -> look, applied by the host so every scene reacts
  stage.renderer.toneMappingExposure = base.exp * (1 + 0.18 * beatEnv);
  stage.camera.zoom = 1 + 0.035 * beatEnv; stage.camera.updateProjectionMatrix();
  stage.dither.uniforms.uF.value = (stage.dither.uniforms.uF.value + 1) % 97;
  stage.composer.render();
}

addEventListener('resize', () => active?.resize?.());
addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(() => {}));
connect({
  state: s => { S = s; document.documentElement.style.setProperty('--accent', s.event.theme?.accent || '#ff6a10'); hudOverlays(); apply(); maybeCapture(); },
  track: ({ track, lyrics }) => hud.setTrack(track, lyrics),
  progress: t => hud.setProgress(t),
  audio: a => { if (!capturing) Object.assign(audio, a); },
  cache: () => { applied = ''; if (S) apply(); },
});
function hudOverlays() { const ch = S.channels[id]; if (ch) { const r = $('#hud'); r.dataset.ov = ch.overlays.join(','); r.querySelector('.np').hidden = !ch.overlays.includes('nowplaying'); r.querySelector('.lyr').hidden = !ch.overlays.includes('lyrics'); } }
requestAnimationFrame(frame);
