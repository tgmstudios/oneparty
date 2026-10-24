#!/usr/bin/env node
// oneparty hub: static web app + SSE state bus + Spotify/lyrics/Home Assistant + display launcher.
// usage: node server/index.mjs [--event <slug>] [--launch] [--lan] [--port 8787]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { checkStartup } from './startup.mjs';
import { lanUrls, addressToward } from './network.mjs';
import { createAudioStream } from './audiostream.mjs';
import { createZones } from './zones.mjs';
import * as ytstream from './ytstream.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { ROOT, loadEnv, listEvents, loadEvent } from './env.mjs';
import { createSpotify } from './spotify.mjs';
import { getLyrics } from './lyrics.mjs';
import { getBpm } from './bpm.mjs';
import { createAudioCapture, listOutputs } from './audiocap.mjs';
import { createDownloads } from './downloads.mjs';
import { createYtLogin } from './ytlogin.mjs';
import { PRESETS, resolvePreset, presetName } from './presets.mjs';
import { createHA } from './ha.mjs';
import { kioskPopup, kioskSongHue, paymentPopup } from './kiosks.mjs';
import { createKioskStream } from './kioskstream.mjs';
import { qrDataUri } from './qr.mjs';
import { BUILTIN_TAKEOVERS, normalizeTakeover } from './takeovers.mjs';
const kioskStream = createKioskStream();
let kioskRenderer = null, kioskStreamPath = '', kioskTokenAt = 0, kioskRendererAt = 0;
// The kiosk <img> holds one long-lived MJPEG connection that dies with the hub. A popup with an unchanged URL doesn't reload it, so the URL carries an
// epoch that is bumped whenever frames (re)start after a gap; the changed popup makes every kiosk reconnect.
let kioskStreamEpoch = Date.now();
function dashboardPopup() { return kioskPopup({ ...state, kioskStreamPath: kioskStreamPath && kioskStreamPath + '&v=' + kioskStreamEpoch }); }
function kioskFrame(bytes) {
  const gap = Date.now() - kioskStream.status().at, ok = kioskStream.push(bytes);
  if (ok && gap > 8000) { kioskStreamEpoch = Date.now(); refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message)); }
  return ok;
}
// Keep HA's MJPEG camera pointed at this PC's current IP (DHCP changes it across restarts). Re-checked every 10 min, immediately when the IP changes.
let cameraSync = { ip: '', at: 0, busy: false };
async function ensureCameraUrl() {
  const entity = state.kiosks.cameraEntity;
  if (!entity || !ha.enabled || cameraSync.busy) return;
  cameraSync.busy = true;
  try {
    const target = state.haLocal || process.env.HA_URL || '';
    let u; try { u = new URL(/^https?:\/\//i.test(target) ? target : 'http://' + target); } catch { return; }
    const ip = await addressToward(u.hostname, u.port || (u.protocol === 'https:' ? 443 : 80)) || lanUrls(PORT)[0]?.ip;
    if (!ip || (ip === cameraSync.ip && Date.now() - cameraSync.at < 600000)) return;
    const r = await ha.syncMjpegCamera(entity, `http://${ip}:${PORT}`);
    if (r.error) return console.error('[camera] ' + r.error);
    cameraSync = { ...cameraSync, ip, at: Date.now() };
    if (r.changed) console.log(`[camera] ${entity}: ${r.from} -> ${r.to}`);
  } catch (e) { console.error('[camera]', e.message); }
  finally { cameraSync.busy = false; }
}
setInterval(() => ensureCameraUrl(), 30000).unref();
setTimeout(() => ensureCameraUrl(), 3000).unref();
async function prepareKioskStream() {
  if (!state.kiosks.cameraEntity) return;
  await ensureCameraUrl();
  if (!kioskStreamPath || Date.now() - kioskTokenAt > 300000) { kioskStreamPath = await ha.cameraStreamPath(state.kiosks.cameraEntity); kioskTokenAt = Date.now(); }
  if (!kioskRenderer || Date.now() - Math.max(kioskStream.status().at, kioskRendererAt) > 15000) {
    kioskRenderer = launchWindow({ url: `http://127.0.0.1:${PORT}/display.html?id=controller-visual&kioskstream=1`, id: 'ha-controller-renderer', hidden: true, force: true, size: { w: 480, h: 270 } });
    if (kioskRenderer.error) throw new Error(kioskRenderer.error);
    kioskRendererAt = Date.now();
  }
}
import { createLightShows, generateShow, distinctColors } from './lightshow.mjs';
import { createAutoScene, AUTO_DEFAULTS } from './autoscene.mjs';
import { createContest } from './contest.mjs';
import { detectScreens, pickScreen, launchWindow, closeAll, killTree, windowPids } from './displays.mjs';

loadEnv();
const argv = process.argv.slice(2);
const flag = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const PORT = +(opt('port', process.env.PORT || 8787));
const HOST = flag('lan') ? '0.0.0.0' : '127.0.0.1';
// Dev mode (default): normal windows, lower render cost. --kiosk (or ONEPARTY_KIOSK=1) = borderless fullscreen for the real party.
const KIOSK = flag('kiosk') || process.env.ONEPARTY_KIOSK === '1';

const slug = opt('event', listEvents().at(-1));
if (!slug) { console.error('No events found. Create one with the /new-event command (see events/).'); process.exit(1); }
try {
  const startup = await checkStartup({ port: PORT, host: HOST, slug, launch: flag('launch') });
  if (startup.reuse) {
    console.log(`oneparty is already running on port ${PORT}. Control panel: ${startup.controlUrl}`);
    if (flag('launch')) console.log('Display launch requested from the running hub.');
    process.exit(0);
  }
} catch (error) {
  console.error(`oneparty could not start: ${error.message}`);
  process.exit(1);
}
const event = loadEvent(slug);
const cacheDir = path.join(ROOT, 'cache', slug); fs.mkdirSync(cacheDir, { recursive: true });
const mediaDir = path.join(ROOT, 'media', slug); fs.mkdirSync(mediaDir, { recursive: true });

// ---------- authored defaults (event.json) vs. live settings (events/<slug>/settings.local.json) ----------
const initChannels = () => ({ ...Object.fromEntries((event.displays || []).map(d => [d.id, { role: d.role, scene: d.scene || event.scenes[0]?.id, overlays: [...(d.overlays || [])], audio: !!d.audio, audioSource: d.audioSource, mode: d.mode || 'live', params: {} }])), 'controller-visual': { name: 'Controller camera', role: 'visuals', scene: event.scenes[0]?.id, overlays: [], audio: false, mode: 'live', params: { maxH: 270, fps: 12, hubAudio: false, autoRotate: false } } });
// Remote displays: any browser that opens /join.html registers once (by a device id kept in its localStorage) and gets its own channel.
// Channels carry remote:true + name/deviceId, and are persisted in settings.local.json so they survive a hub restart.
const REMOTE_ROLES = ['visuals', 'videos'];
const remoteDefaults = (name, deviceId, extra = {}) => ({ role: 'visuals', scene: event.scenes[0]?.id, overlays: [], audio: false, mode: 'live', params: { maxH: 1080, fps: 30 }, remote: true, name, deviceId, follow: null, lastSeen: 0, ...extra });
const slugId = s => String(s || 'display').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'display';
function addRemote(key, name, extra, rename = false) {
  const found = Object.entries(state.channels).find(([, c]) => c.remote && c.deviceId === key);
  if (found) { if (rename && name && found[1].name !== name) found[1].name = name; return found[0]; }   // a reload keeps its channel and the name set on the control panel
  const base = name || 'Display', taken = new Set(Object.values(state.channels).map(c => c.name));
  let nm = base, k = 2; while (taken.has(nm)) nm = base + ' ' + k++;
  const used = new Set(Object.values(state.channels).map(c => c.scene));
  const scene = event.scenes.find(s => !used.has(s.id))?.id || event.scenes[0]?.id;
  let id = 'remote-' + slugId(nm), n = 2; while (state.channels[id]) id = 'remote-' + slugId(nm) + '-' + n++;
  state.channels[id] = remoteDefaults(nm, key, { scene, ...extra });
  state.channels[id].params.hubAudio = true;   // remote displays play the hub audio by default (turn it off per display if several tabs on one device echo)
  return id;
}
// Local displays: extra windows on this PC's monitors, added from the control panel (channel.local = true, channel.monitor = { index, name }).
const newLocal = (name, monitor, extra = {}) => ({ role: 'visuals', scene: event.scenes[0]?.id, overlays: [...(Object.values(initChannels())[0]?.overlays || [])], audio: false, mode: 'live', params: {}, local: true, name, monitor, fullscreen: null, follow: null, lastSeen: 0, ...extra });
function addLocal(name, monitor, extra) {
  const base = String(name || 'Monitor').trim().slice(0, 40) || 'Monitor', taken = new Set(Object.values(state.channels).map(c => c.name));
  let nm = base, k = 2; while (taken.has(nm)) nm = base + ' ' + k++;
  const used = new Set(Object.values(state.channels).map(c => c.scene));
  const scene = event.scenes.find(x => !used.has(x.id))?.id || event.scenes[0]?.id;
  let id; do { id = 'local-' + slugId(nm) + '-' + Math.random().toString(36).slice(2, 6); } while (state.channels[id]);   // fixed-length suffix: no id is a prefix of another (window lookup is by substring)
  state.channels[id] = newLocal(nm, monitor, { scene, ...extra });
  return id;
}
const initHud = () => ({ bubbles: [...(event.hud?.bubbles || [`Welcome to ${event.subtitle || 'the party'} @ the ${event.title}`])], announcements: [...(event.hud?.announcements || [])], jam: { ...(event.hud?.jam || { url: '', on: false, pin: false }) }, contest: { url: process.env.PARTY_PUBLIC_URL || '', on: false, pin: false, title: 'Costume contest', sub: 'Enter, vote & rate the music', ...(event.hud?.contest || {}) }, bubbleSeconds: event.hud?.bubbleSeconds || 6, announceSeconds: event.hud?.announceSeconds || 8, quietSeconds: event.hud?.quietSeconds ?? 12 });
function initTakeovers() {
  const defs = new Map(BUILTIN_TAKEOVERS.map(d => [d.id, d]));
  for (const raw of event.takeovers || []) { const r = normalizeTakeover(raw, defs.get(String(raw?.id))); if (r.def) defs.set(r.def.id, r.def); }
  return [...defs.values()];
}
const settingsFile = path.join(ROOT, 'events', slug, 'settings.local.json');

// ---------- state ----------
const state = {
  event: { slug, title: event.title, subtitle: event.subtitle, theme: event.theme || {} },
  scenes: event.scenes,
  channels: initChannels(),
  haLocal: process.env.HA_LOCAL_IP || '',   // LAN address of Home Assistant, used instead of HA_URL when set
  kiosks: { url: '', roles: {}, payment: { url: '', title: 'Pay here', note: '' }, lastCommand: null, originals: {}, message: 'Welcome to the party!', cameraEntity: null },
  zones: [], zoneStatus: {},   // lighting zones (server/zones.mjs)
  bpmAuto: true, bpmInfo: null,
  auto: { ...AUTO_DEFAULTS, ...(event.autoScene || {}) },
  hud: initHud(),
  hudStatus: {},
  audioMode: 'backend', audioDevices: [], audioDevice: event.audioDevice || null,
  track: null, lyrics: null, queue: [], sceneStatus: {}, audioStatus: null, gpu: {}, bpm: event.bpm || 120, blackout: false, whiteout: false,   // blackout/whiteout mirror `takeover` for old consumers
  takeovers: initTakeovers(), takeover: null,   // user-editable full-screen states (server/takeovers.mjs); takeover = active id
  lights: { mode: event.homeassistant?.mode || 'sync', color: null, preset: null, pin: null, autopilot: event.homeassistant?.autopilot !== false, dynamic: event.homeassistant?.dynamic !== false, last: null },
};
// Cloud guest app (public/): costume contest, music ratings, pay info. See server/contest.mjs.
const contestDir = path.join(cacheDir, 'contest');
const contest = createContest({ imgDir: contestDir, onChange: () => broadcast('state', publicState()), getTrack: () => state.track });
// Everything set from the control panel / agents is mirrored to settingsFile (debounced) and re-applied on boot.
let saveTimer = null, savedAt = null;
function snapshotSettings() {
  return {
    channels: Object.fromEntries(Object.entries(state.channels).map(([id, c]) => [id, { scene: c.scene, mode: c.mode, overlays: c.overlays, params: c.params, ...(c.remote && { role: c.role, follow: c.follow }) }])),
    locals: Object.fromEntries(Object.entries(state.channels).filter(([, c]) => c.local).map(([id, c]) => [id, { name: c.name, role: c.role, monitor: c.monitor, fullscreen: c.fullscreen, follow: c.follow }])),
    remotes: Object.fromEntries(Object.entries(state.channels).filter(([, c]) => c.remote).map(([id, c]) => [id, { name: c.name, deviceId: c.deviceId, role: c.role, follow: c.follow }])),
    lights: { mode: state.lights.mode, preset: state.lights.preset, pin: state.lights.pin, autopilot: state.lights.autopilot, dynamic: state.lights.dynamic },
    bpm: state.bpmAuto ? { auto: true } : { auto: false, value: state.bpm },
    kiosks: { url: state.kiosks.url, roles: state.kiosks.roles, payment: state.kiosks.payment, originals: state.kiosks.originals, message: state.kiosks.message, cameraEntity: state.kiosks.cameraEntity, lastCommand: state.kiosks.lastCommand },
    haLocal: state.haLocal,
    auto: state.auto,
    contest: contest.settings(),
    hud: state.hud, audioDevice: state.audioDevice, zones: state.zones, takeovers: state.takeovers,
    sceneOpts: Object.fromEntries(state.scenes.filter(s => s.hideOverlays?.length).map(s => [s.id, { hideOverlays: s.hideOverlays }])),
  };
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(settingsFile, JSON.stringify(snapshotSettings(), null, 2)); savedAt = Date.now(); } catch (e) { console.error('[settings]', e.message); } }, 300);
}
function applySettings(saved) {
  if (typeof saved.haLocal === 'string') state.haLocal = saved.haLocal;
  if (typeof saved.kiosks?.cameraEntity === 'string') state.kiosks.cameraEntity = saved.kiosks.cameraEntity;
  if (typeof saved.kiosks?.message === 'string') state.kiosks.message = saved.kiosks.message;
  if (typeof saved.kiosks?.url === 'string') state.kiosks.url = saved.kiosks.url;
  if (saved.kiosks?.roles && typeof saved.kiosks.roles === 'object') state.kiosks.roles = saved.kiosks.roles;
  if (saved.kiosks?.payment && typeof saved.kiosks.payment === 'object') Object.assign(state.kiosks.payment, saved.kiosks.payment);
  if (saved.kiosks?.originals) state.kiosks.originals = saved.kiosks.originals;
  if (saved.kiosks?.lastCommand) state.kiosks.lastCommand = saved.kiosks.lastCommand;
  for (const [id, l] of Object.entries(saved.locals || {})) if (!state.channels[id]) state.channels[id] = newLocal(l.name, l.monitor, { role: REMOTE_ROLES.includes(l.role) ? l.role : 'visuals', fullscreen: l.fullscreen ?? null, follow: l.follow || null });
  for (const [id, r] of Object.entries(saved.remotes || {})) if (!state.channels[id]) state.channels[id] = remoteDefaults(r.name, r.deviceId, { role: REMOTE_ROLES.includes(r.role) ? r.role : 'visuals', follow: r.follow || null });
  for (const [id, c] of Object.entries(saved.channels || {})) {
    const ch = state.channels[id]; if (!ch) continue;
    if (state.scenes.some(s => s.id === c.scene)) ch.scene = c.scene;
    if (c.mode) ch.mode = c.mode;
    if ((ch.remote || ch.local) && REMOTE_ROLES.includes(c.role)) ch.role = c.role;
    if (Array.isArray(c.overlays)) ch.overlays = c.overlays;
    if (c.params && typeof c.params === 'object') ch.params = c.params;
  }
  if (saved.lights) Object.assign(state.lights, { mode: saved.lights.mode ?? state.lights.mode, preset: saved.lights.preset ?? null, pin: saved.lights.pin ?? null, autopilot: saved.lights.autopilot ?? state.lights.autopilot, dynamic: saved.lights.dynamic ?? state.lights.dynamic });
  if (saved.bpm) { state.bpmAuto = saved.bpm.auto !== false; if (!state.bpmAuto && saved.bpm.value) { state.bpm = +saved.bpm.value; state.bpmInfo = { bpm: state.bpm, source: 'manual' }; } }
  if (saved.auto) state.auto = { ...state.auto, ...saved.auto };
  if (saved.hud) state.hud = { ...state.hud, ...saved.hud, jam: { ...state.hud.jam, ...(saved.hud.jam || {}) }, contest: { ...state.hud.contest, ...(saved.hud.contest || {}) } };
  contest.restore(saved.contest);
  if ('audioDevice' in saved) state.audioDevice = saved.audioDevice || null;
  if (Array.isArray(saved.zones)) state.zones = saved.zones;
  for (const raw of saved.takeovers || []) { const r = normalizeTakeover(raw, state.takeovers.find(d => d.id === raw?.id)); if (r.def) setTakeoverDef(r.def); }
  for (const [id, o] of Object.entries(saved.sceneOpts || {})) { const sc = state.scenes.find(s => s.id === id); if (sc && Array.isArray(o.hideOverlays)) sc.hideOverlays = o.hideOverlays; }
}
function resetSettings() {
  fs.rmSync(settingsFile, { force: true }); savedAt = null;
  const keep = Object.entries(state.channels).filter(([, c]) => c.remote);
  state.takeovers = initTakeovers();
  state.zones = []; try { zones.rebuild(); } catch { /* not created yet */ }
  const keepLocal = Object.entries(state.channels).filter(([, c]) => c.local);
  state.channels = initChannels(); for (const [id, c] of keep) state.channels[id] = remoteDefaults(c.name, c.deviceId, { role: c.role });
  for (const [id, c] of keepLocal) state.channels[id] = newLocal(c.name, c.monitor, { role: c.role, fullscreen: c.fullscreen });
  state.hud = initHud();
  Object.assign(state.lights, { mode: event.homeassistant?.mode || 'sync', preset: null, pin: null, dynamic: event.homeassistant?.dynamic !== false });
  state.bpmAuto = true; state.bpmInfo = null; state.audioDevice = event.audioDevice || null; state.auto = { ...AUTO_DEFAULTS, ...(event.autoScene || {}) };
}
try { if (fs.existsSync(settingsFile)) { applySettings(JSON.parse(fs.readFileSync(settingsFile, 'utf8'))); savedAt = fs.statSync(settingsFile).mtimeMs; console.log('settings: restored from ' + path.relative(ROOT, settingsFile)); } }
catch (e) { console.error('[settings] ignoring unreadable settings file:', e.message); }
const clients = new Set();
const send = (res, type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (type, data) => clients.forEach(c => send(c, type, data));

const ha = createHA({ url: process.env.HA_URL, token: process.env.HA_TOKEN, host: process.env.HA_HOST || '' });
if (state.haLocal) ha.connectLocal(state.haLocal).then(r => console.log('[ha] local ' + state.haLocal + ': ' + (r.error || (r.test?.ok ? 'ok via ' + r.base : r.test?.error))), e => console.error('[ha]', e.message));
const haCfg = event.homeassistant || {};
ha.setLightOverrides({ stepped: haCfg.steppedLights, smooth: haCfg.smoothLights, gapMs: haCfg.steppedGapMs, minDelta: haCfg.steppedMinDelta });   // optional event.json overrides for lights HA misreports
ha.lightCaps().then(c => { const n = Object.entries(c).filter(([e, v]) => !v && allLights.includes(e)).map(([e]) => e); if (n.length) console.log('[ha] no fade support, throttled: ' + n.join(', ')); }, () => {});
const sceneColor = id => state.scenes.find(s => s.id === id)?.palette?.[0];
// Light groups let slow bulbs (Kasa/Matter) and fast WLED strips behave differently. Legacy flat `lights` = one bulb group.
const profile = opt('lights', haCfg.profile);
const groups = (haCfg.profiles?.[profile] || haCfg.groups || (haCfg.lights?.length ? [{ name: 'lights', kind: 'bulb', entities: haCfg.lights }] : []))
  .map(g => ({ minGapMs: g.kind === 'wled' ? 120 : 1000, transition: g.kind === 'wled' ? 0.1 : 0.6, beat: true, ...g }));
const allLights = groups.flatMap(g => g.entities);
const baseGroups = groups.map(g => ({ ...g, entities: [...g.entities] }));   // every light in the profile; zones take lights out of groups/allLights in place
// Authored light shows (events/<slug>/lightshows.json): per-song / per-scene programs that follow the beat, see server/lightshow.mjs
const trackPos = () => { const t = state.track; return t && t.playing ? (t.progressMs || 0) + (Date.now() - (t.at || Date.now())) : null; };
const shows = createLightShows({
  ha, groups, file: path.join(ROOT, 'events', slug, 'lightshows.json'),
  getPos: trackPos, getBpm: () => state.bpm, getPlaying: () => !!state.track?.playing,
  onChange: () => broadcast('state', publicState()),
});

setInterval(() => {   // remote displays whose tab closed more than 12 h ago are forgotten
  let changed = false;
  for (const [id, c] of Object.entries(state.channels)) if (c.remote && c.goneAt && Date.now() - c.goneAt > 12 * 3600e3) { delete state.channels[id]; changed = true; }
  if (changed) { scheduleSave(); broadcast('state', publicState()); }
}, 600000).unref();
let onlineSig = '';
setInterval(() => { const sig = Object.entries(state.channels).map(([k, c]) => k + (c.lastSeen && Date.now() - c.lastSeen < 15000 ? '1' : '0')).join(); if (sig !== onlineSig) { onlineSig = sig; broadcast('state', publicState()); } }, 4000).unref();
const autoScene = createAutoScene({ state, setScene: c => command(c) });
setInterval(() => autoScene.tick(), 1000).unref();

const spotify = createSpotify({
  clientId: process.env.SPOTIFY_CLIENT_ID, redirectUri: `http://127.0.0.1:${PORT}/auth/spotify/callback`,
  async onTrack(t) {
    const changed = (t?.id || null) !== (state.track?.id || null);
    if (changed && t) state.kiosks.songHue = kioskSongHue(t, state.kiosks.songHue);
    state.track = t;
    refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message));
    if (changed) {
      state.lyrics = null; broadcast('track', { track: t, lyrics: null }); autoScene.onSong();
      if (t && state.lights.mode === 'sync' && !state.takeover && (shows.hasSong(t.id) || shows.running()?.source === 'song')) lightsDone('song ' + t.title, applyLights(Object.values(state.channels)[0]?.scene));
      if (t) {
        syncBpm(t); spotify.queue().then(q => { state.queue = q; broadcast('queue', q); });
        state.lyrics = await getLyrics(t); broadcast('track', { track: state.track, lyrics: state.lyrics });
        // lookup came back empty (network blip / LRCLIB 503): try again a few times while the same song is still playing
        for (const wait of [15000, 45000, 120000]) { if (state.lyrics) break; await new Promise(r => setTimeout(r, wait)); if (state.track?.id !== t.id) break; state.lyrics = await getLyrics(t); if (state.lyrics) broadcast('track', { track: state.track, lyrics: state.lyrics }); }
      }
      else { state.queue = []; broadcast('queue', []); }
    }
    else broadcast('progress', t);
  },
});

// Tempo follows the current song (Deezer lookup) while bpmAuto is on; manual BPM/tap tempo turns it off.
let bpmFromAudio = false, lastBpmPush = 0;
async function syncBpm(t, force) {
  if (!state.bpmAuto && !force) return;
  const r = await getBpm(t);
  if (t.id !== state.track?.id || !state.bpmAuto) return;
  bpmFromAudio = !r;   // no database tempo for this song -> follow the beat detected in the audio
  if (r) { state.bpm = r.bpm; state.bpmInfo = r; if (shows.running()?.source === 'auto' && state.lights.mode === 'sync' && !state.takeover) applyLights(Object.values(state.channels)[0]?.scene); } else state.bpmInfo = { bpm: state.bpm, source: 'audio', raw: 0 };
  broadcast('state', publicState());
}

// ---------- commands (the single mutation path: control panel, agent, MIDI, whatever) ----------
// Lighting the way the Hue app does it: one preset's palette spread across ALL lights (smart-shuffled), optionally looping.
// Per-scene presets live in event.json homeassistant.presets {sceneId: presetName|uuid}; state.lights.preset overrides.
const sceneLights = sceneId => resolvePreset(state.lights.preset) || resolvePreset(haCfg.presets?.[sceneId]);
async function applyLights(sceneId) {
  if (!ha.enabled || !allLights.length) return { skipped: 'no lights' };
  if (shows.running()?.source === 'try') return { ok: true, show: shows.running().id, source: 'try', note: 'draft stays until replaced or lightshow auto' };
  // precedence: pinned show > explicitly chosen preset > show bound to this song > show bound to this scene > scene preset
  const hit = state.lights.pin && shows.get(state.lights.pin) ? { id: state.lights.pin, source: 'manual' } : state.lights.preset ? null : shows.resolve(sceneId, state.track);
  if (hit) { await ha.stopDynamic(allLights); shows.start(hit.id, hit.source); return { ok: true, show: hit.id, source: hit.source }; }
  if (state.lights.autopilot && !state.lights.preset) {   // nothing authored for this moment: generate a show from the scene's palette + the song's tempo
    const sc = state.scenes.find(s => s.id === sceneId), cs = shows.running(), bpm = Math.round(state.bpm);
    if (!(cs?.source === 'auto' && cs.id === 'auto-' + sceneId && Math.abs((cs.bpm || 0) - bpm) < 4)) { await ha.stopDynamic(allLights); shows.start(generateShow({ id: 'auto-' + sceneId, name: 'Autopilot: ' + (sc?.title || sceneId), palette: sc?.palette, bpm }), 'auto'); shows.running().bpm = bpm; }
    return { ok: true, show: 'auto-' + sceneId, source: 'auto', bpm };
  }
  shows.stop();
  const bri = haCfg.brightness ?? 180, pid = sceneLights(sceneId);
  let r;
  if (pid) {
    r = state.lights.dynamic
      ? await ha.dynamic(allLights, pid, { brightness: bri, interval: haCfg.interval ?? 2, transition: haCfg.dynTransition ?? 1 })
      : await ha.preset(allLights, pid, { brightness: bri });
    if (r.error) r = { ...r, hint: 'scene_presets call failed; falling back to palette spread' };
  }
  if (!pid || r.error) {   // fallback: hand each light a different palette color ourselves
    const pal = state.scenes.find(s => s.id === sceneId)?.palette || ['#ffffff'];
    const cols = distinctColors(pal, allLights.length);
    const rs = await Promise.all(allLights.map((e, i) => ha.lights([e], { color: cols[i], brightness: Math.round(150 + 105 * ((i * 0.618) % 1)), transition: 1 }, { key: 'spread:' + e, minGapMs: 0, urgent: true })));
    r = rs.find(x => x.error) || { ok: true, via: 'palette-spread' };
  }
  groups.forEach(g => { const fx = g.effects?.[sceneId]; if (fx) ha.lights(g.entities, { effect: fx }, { key: 'fx:' + g.name, minGapMs: 0 }); });
  return { ...r, preset: pid ? presetName(pid) : null };
}
const lightsDone = (what, p) => Promise.resolve(p).then(r => { state.lights.last = { what, at: Date.now(), ok: !r?.error, ...(r || {}) }; broadcast('state', publicState()); return r; });

// Home Assistant areas/floors (cached 60 s): the source for creating/syncing zones
let areaCache = { at: 0, data: { areas: [], floors: [] } };
async function haAreas(force = false) {
  if (!ha.enabled) return { areas: [], floors: [] };
  if (force || Date.now() - areaCache.at > 60000) areaCache = { at: Date.now(), data: await ha.areas() };
  return areaCache.data;
}
const zones = createZones({ state, ha, baseGroups, groups, allLights, haCfg, resolvePreset, presetName, distinctColors, onChange: () => broadcast('state', publicState()) });
zones.rebuild();
const syncZoneLinks = () => { if (ha.enabled && state.zones.some(z => z.link)) command({ type: 'zone', action: 'sync' }).catch(() => {}); };
setTimeout(syncZoneLinks, 8000).unref(); setInterval(syncZoneLinks, 300000).unref();

// youtube.com/@name/live (or /channel/ID/live) has no video id in it: ask yt-dlp which stream is live right now and use its watch URL.
function resolveYoutube(url) {
  let u; try { u = new URL(url); } catch { return Promise.resolve({ error: 'not a valid url' }); }
  if (!/(^|\.)youtube\.com$/.test(u.hostname) || u.searchParams.get('v') || /^\/(live|embed|shorts)\/[\w-]{11}/.test(u.pathname)) return Promise.resolve(url);
  return new Promise(resolve => {
    const p = spawn('yt-dlp', ['--get-id', '--playlist-items', '1', '--no-warnings', url], { windowsHide: true });
    let out = '', err = ''; const t = setTimeout(() => { p.kill(); resolve({ error: 'timed out asking YouTube which stream is live' }); }, 25000);
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('error', () => { clearTimeout(t); resolve({ error: 'yt-dlp not found - run: npm run doctor' }); });
    p.on('close', () => { clearTimeout(t); const id = out.trim().split(/\s+/)[0]; resolve(/^[\w-]{11}$/.test(id) ? 'https://www.youtube.com/watch?v=' + id : { error: 'no live stream found at that address' + (err ? ': ' + err.trim().split(/\r?\n/)[0].slice(0, 160) : '') }); });
  });
}
// Mirrors follow another channel's scene and mode (e.g. the upstairs screen shows whatever "main" shows).
function mirrorFrom(src) {
  const s = state.channels[src]; if (!s) return;
  for (const f of Object.values(state.channels)) if (f.follow === src) { f.scene = s.scene; f.mode = s.mode === 'video' ? 'live' : s.mode; if (s.mode === 'stream') { f.params.stream = s.params.stream; f.params.streamSound = s.params.streamSound; } }
}
// Display management: { action: 'configure', id, name?, role?: 'visuals'|'videos', follow?: channel|null, params? } | { action: 'remove', id } (remote displays only)
function displayCmd(c) {
  if (c.action === 'addLocal') {   // { name, monitor: screen index, role?: visuals|videos, follow?: channel, fullscreen? } - a window on one of this PC's monitors
    const screens = detectScreens(), idx = Number.isInteger(+c.monitor) ? +c.monitor : 0, sc = screens[idx];
    if (!sc) return { error: 'no monitor with index ' + c.monitor + ' (found ' + screens.length + ')' };
    const id = addLocal(c.name, { index: idx, name: sc.name }, { fullscreen: typeof c.fullscreen === 'boolean' ? c.fullscreen : null });
    if (c.role) displayCmd({ action: 'configure', id, role: c.role });
    if (c.follow) displayCmd({ action: 'configure', id, follow: c.follow });
    return { ok: true, id, launched: launchLocal(id, true) };
  }
  if (c.action === 'reload') { broadcast('refresh', { channel: c.id || null }); return { ok: true }; }   // ask a display page (or all of them) to reload itself, e.g. to pick up new code
  if (c.action === 'prune') {   // drop every remote display that is offline (closed tabs, retired devices)
    const gone = []; for (const [id, ch] of Object.entries(state.channels)) if (ch.remote && !(ch.lastSeen && Date.now() - ch.lastSeen < 15000)) { delete state.channels[id]; delete state.gpu[id]; delete state.hudStatus[id]; gone.push(id); }
    return { ok: true, removed: gone };
  }
  const ch = state.channels[c.id]; let relaunch = false;
  if (!ch) return { error: 'unknown display ' + c.id };
  if (c.action === 'launch') return ch.local ? { ok: true, ...launchLocal(c.id, true) } : { error: 'only local monitors added from the panel can be opened here' };
  if (c.action === 'close') { if (!ch.local) return { error: 'not a local display' }; windowPids(c.id).forEach(killTree); return { ok: true }; }
  if (c.action === 'remove') {
    if (!ch.remote && !ch.local) return { error: 'only added displays can be removed (the built-in ones come from event.json)' };
    if (ch.local) windowPids(c.id).forEach(killTree);
    delete state.channels[c.id]; delete state.gpu[c.id]; delete state.hudStatus[c.id]; return { ok: true, removed: c.id };
  }
  if (c.action !== 'configure') return { error: 'action must be configure|remove' };
  if (c.monitor !== undefined && ch.local) { const sc = detectScreens()[+c.monitor]; if (!sc) return { error: 'no monitor ' + c.monitor }; ch.monitor = { index: +c.monitor, name: sc.name }; relaunch = true; }
  if (typeof c.fullscreen === 'boolean' && ch.local) { ch.fullscreen = c.fullscreen; relaunch = true; }
  if (typeof c.name === 'string' && c.name.trim() && (ch.remote || ch.local)) ch.name = c.name.trim().slice(0, 40);
  if (c.role) {
    if (!REMOTE_ROLES.includes(c.role)) return { error: 'role must be ' + REMOTE_ROLES.join('|') };
    ch.role = c.role; ch.mode = c.role === 'videos' ? 'video' : 'live';
    if (c.role === 'videos') ch.follow = null;
  }
  if ('follow' in c) {
    if (c.follow && (!state.channels[c.follow] || c.follow === c.id)) return { error: 'cannot follow ' + c.follow };
    ch.follow = c.follow || null; if (ch.follow) { ch.role = 'visuals'; mirrorFrom(ch.follow); }
  }
  if (c.params && typeof c.params === 'object') Object.assign(ch.params, c.params);
  if (relaunch) launchLocal(c.id, true);   // monitor or fullscreen changed: reopen its window
  return { ok: true };
}
let kioskDashboardSignature = '';
let kioskDashboardBusy = false, kioskDashboardDirty = false;
// Each kiosk has a role (state.kiosks.roles): 'dashboard' (default; all share one popup) or 'payment' (its own popup: payment link + that kiosk's live front camera, never recorded).
const kioskRole = d => (state.kiosks.roles[d.browserId] === 'payment' ? 'payment' : 'dashboard');
function payQrData() {   // the uploaded payment QR as a data: URI (the kiosk page is https, the hub is http)
  const f = contest.view().payImageUrl; if (!f?.startsWith('/contest/')) return '';
  try { const file = path.join(contestDir, path.basename(f)), ext = path.extname(file).slice(1).toLowerCase(); return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(file).toString('base64'); } catch { return ''; }
}
async function kioskPlan(devices) {   // [{ ids, popup }]: dashboards share a popup, each payment kiosk gets its own. A takeover overrides every role.
  const named = devices.filter(d => d.browserId), pay = state.takeover ? [] : named.filter(d => kioskRole(d) === 'payment'), dash = named.filter(d => !pay.includes(d));
  const plan = dash.length ? [{ ids: dash.map(d => d.browserId), popup: dashboardPopup() }] : [];
  for (const d of pay) {
    const pay = { ...state.kiosks.payment, url: state.kiosks.payment.url || contest.view().config?.payUrl || '' };   // uploaded QR image wins, else a QR of the link
    plan.push({ ids: [d.browserId], popup: paymentPopup({ ...state, payQr: payQrData() || (pay.url ? qrDataUri(pay.url) : ''), kiosks: { ...state.kiosks, payment: pay } }) });
  }
  return plan;
}
async function pushKioskPopups(devices) {
  const plan = await kioskPlan(devices);
  if (!plan.length) return null;
  for (const { ids, popup } of plan) await ha.call('browser_mod', 'popup', { ...popup, browser_id: ids });
  return JSON.stringify(plan);
}
async function refreshKioskDashboard() {
  if (!(state.kiosks.lastCommand?.on || state.takeover) || !ha.enabled) return;
  if (kioskDashboardBusy) { kioskDashboardDirty = true; return; }
  kioskDashboardBusy = true;
  try {
    if (!state.takeover) await prepareKioskStream();
    const devices = await ha.kiosks(), plan = JSON.stringify(await kioskPlan(devices));
    if (plan === kioskDashboardSignature) return;
    kioskDashboardSignature = (await pushKioskPopups(devices)) || '';
  } finally {
    kioskDashboardBusy = false;
    if (kioskDashboardDirty) { kioskDashboardDirty = false; refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message)); }
  }
}
// Blackout: kiosks go solid black (even if the dashboard was never on); lifting it restores the dashboard, or clears the popup.
function setTakeoverDef(def) { const i = state.takeovers.findIndex(d => d.id === def.id); if (i < 0) state.takeovers.push(def); else state.takeovers[i] = def; }
// Activate takeover `id` (or clear with null): displays, kiosk popups and every light follow its definition; edits to the active one re-apply live.
function applyTakeover(id) {
  const def = id && state.takeovers.find(d => d.id === id);
  state.takeover = def ? def.id : null; state.blackout = state.takeover === 'blackout'; state.whiteout = state.takeover === 'whiteout';
  if (def) shows.stop();
  kioskBlackout(!!def).catch(e => console.error('[kiosk takeover]', e.message));
  if (!allLights.length) return;
  const L = def?.lights;
  if (!def) return lightsDone('lights back', applyLights(Object.values(state.channels)[0]?.scene));
  if (L.mode === 'off') return lightsDone(def.id, ha.stopDynamic(allLights).then(() => ha.off(allLights)));
  if (L.mode === 'color') return lightsDone(def.id, ha.stopDynamic(allLights).then(() => ha.lights(allLights, { color: L.color, brightness: L.brightness, transition: 0.3 }, { minGapMs: 0, key: 'takeover', urgent: true })));
}
async function kioskBlackout(on) {
  if (!ha.enabled) return;
  if (on || state.kiosks.lastCommand?.on) return refreshKioskDashboard();
  const browser_id = (await ha.kiosks()).map(d => d.browserId).filter(Boolean);
  kioskDashboardSignature = '';
  if (browser_id.length) await ha.call('browser_mod', 'close_popup', { tag: 'oneparty-kiosks', browser_id });
}
setInterval(() => refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message)), 15000).unref();
async function command(c) {
  let out = { ok: true };
  switch (c.type) {
    case 'haConnection': {   // { localIp: '192.168.1.50' | '192.168.1.50:8123' | '' }  talk to Home Assistant on the LAN (Host header = HA_URL's host / HA_HOST) instead of HA_URL; {test:true} only checks
      if (typeof c.localIp === 'string') {
        const prev = state.haLocal, r = await ha.connectLocal(c.localIp); if (r.error) return r;
        state.haLocal = c.localIp.trim();
        const t = r.test || await ha.test(); out.test = t;
        if (!t.ok && c.localIp.trim() && !c.keep) { state.haLocal = prev; ha.setLocal(prev); return { error: 'Home Assistant did not answer on ' + c.localIp.trim() + ': ' + t.error + '. Not changed.', test: t }; }
      } else out.test = await ha.test();
      break;
    }
    case 'kioskStream': {
      if (!/^camera[.][a-z0-9_]+$/.test(c.entity || '')) return { error: 'Expected a camera entity' };
      state.kiosks.cameraEntity = c.entity;
      await refreshKioskDashboard();
      break;
    }
    case 'kioskRole': {   // { browserId, role: 'dashboard'|'payment' }
      if (!c.browserId || !['dashboard', 'payment'].includes(c.role)) return { error: 'browserId and role (dashboard|payment) required' };
      if (c.role === 'payment') state.kiosks.roles[c.browserId] = 'payment'; else delete state.kiosks.roles[c.browserId];
      await refreshKioskDashboard(); break; }
    case 'kioskPayment': {   // { url?, title?, note? } : what payment kiosks show (url falls back to the guest app's payUrl)
      const p = state.kiosks.payment, str = (v, n) => String(v ?? '').slice(0, n);
      if ('url' in c) { const u = str(c.url, 300).trim(); if (u && !u.match(/^https?:[/][/]/i)) return { error: 'url must start with http(s)://' }; p.url = u; }
      if ('title' in c) p.title = str(c.title, 60); if ('note' in c) p.note = str(c.note, 300);
      await refreshKioskDashboard(); break; }
    case 'kioskAdd': {   // { browserId, name, role? } : name an unnamed Browser Mod browser "Kiosk - <name>" in Home Assistant so it becomes a kiosk
      const name = String(c.name || '').trim().slice(0, 40); if (!name) return { error: 'name required' };
      const r = await ha.nameKiosk(c.browserId, name); if (r.error) return r;
      if (c.role === 'payment') state.kiosks.roles[c.browserId] = 'payment';
      await refreshKioskDashboard(); break; }
    case 'kioskReload': {   // { browserId? } reload the kiosk browser page(s) (all named kiosks if omitted); the popup comes back a few seconds later
      if (!ha.enabled) return { error: 'Home Assistant is not configured' };
      const devices = (await ha.kiosks()).filter(d => d.browserId && (!c.browserId || d.browserId === c.browserId));
      if (!devices.length) return { error: 'kiosk not found' };
      try { await ha.call('browser_mod', 'refresh', { browser_id: devices.map(d => d.browserId) }); } catch (e) { return { error: 'Reload failed: ' + e.message }; }
      kioskDashboardSignature = ''; setTimeout(() => refreshKioskDashboard().catch(e => console.error('[kiosk reload]', e.message)), 6000).unref();
      out.reloaded = devices.map(d => d.name); break; }
    case 'kioskDashboard': {
      if (typeof c.message !== 'string' || c.message.length > 500) return { error: 'Message must be at most 500 characters' };
      state.kiosks.message = c.message;
      await refreshKioskDashboard();
      break;
    }
    case 'kiosks': {
      if (!ha.enabled) return { error: 'Home Assistant is not configured' };
      if (typeof c.on !== 'boolean') return { error: 'on must be true or false' };
      try {
        const devices = await ha.kiosks();
        const browser_id = devices.map(d => d.browserId).filter(Boolean);
        if (!browser_id.length) return { error: 'No kiosks found. Name Browser Mod devices "Kiosk - Room name" in Home Assistant first.' };
        if (c.on) {
          await prepareKioskStream();
          for (const d of devices) if (d.online && d.path && !['unknown', 'unavailable'].includes(d.path)) state.kiosks.originals[d.browserId] = { name: d.name, path: d.path, savedAt: Date.now() };
          // Save recovery information before any device receives the takeover command.
          fs.writeFileSync(settingsFile, JSON.stringify(snapshotSettings(), null, 2));
          savedAt = Date.now();
          kioskDashboardSignature = (await pushKioskPopups(devices)) || '';
        } else await ha.call('browser_mod', 'close_popup', { tag: 'oneparty-kiosks', browser_id });
        out.devices = devices;
        state.kiosks.lastCommand = { on: c.on, at: Date.now() };
      } catch (e) { return { error: 'Kiosk command failed: ' + e.message }; }
      break;
    }
    case 'scene': { const ch = state.channels[c.channel]; if (!ch) return { error: 'unknown channel' }; ch.scene = c.scene; ch.mode = c.mode || 'live'; mirrorFrom(c.channel); autoScene.noteSwitch(c.channel);
      if (c.channel === Object.keys(state.channels)[0] && state.lights.mode === 'sync' && !state.takeover) lightsDone('scene ' + c.scene, applyLights(c.scene));
      break; }
    case 'autoscene': {   // { on?, channel?, pool?: ["02","05"]|null, bars?, minSec?, onSong?, onDrop?, shuffle?, hypeMatch?, hypeSpread?, mode?: "live|cached", now?: true }
      const a = state.auto, num = (v, lo, hi) => Math.min(hi, Math.max(lo, +v));
      if ('on' in c) { a.on = !!c.on; autoScene.reset(); }
      if ('channel' in c) { if (c.channel && !state.channels[c.channel]) return { error: 'unknown channel' }; a.channel = c.channel || null; }
      if ('pool' in c) { const ids = Array.isArray(c.pool) ? c.pool.map(String) : []; if (ids.some(i => !state.scenes.some(s => s.id === i))) return { error: 'unknown scene in pool' }; a.pool = ids.length ? ids : null; }
      if ('bars' in c) a.bars = num(c.bars, 1, 64); if ('minSec' in c) a.minSec = num(c.minSec, 2, 300);
      if ('cooldown' in c) a.cooldown = num(c.cooldown, 0, 600);
      if ('sens' in c) a.sens = num(c.sens, 1, 10);
      if ('hypeSpread' in c) a.hypeSpread = num(c.hypeSpread, 0.5, 6);
      for (const k of ['onSong', 'onDrop', 'shuffle', 'hypeMatch']) if (k in c) a[k] = !!c[k];
      if (c.mode === 'live' || c.mode === 'cached') a.mode = c.mode;
      break; }
    case 'mode': state.channels[c.channel].mode = c.mode; mirrorFrom(c.channel); break;           // live | cached | video
    case 'param': state.channels[c.channel].params[c.key] = c.value; break;
    case 'sceneOpts': {   // per-scene options: hideOverlays = overlay names (nowplaying|lyrics|bubbles|announcements|motion) that are hidden while this scene shows
      const sc = state.scenes.find(s => s.id === String(c.scene)); if (!sc) return { error: 'unknown scene ' + c.scene };
      if ('hideOverlays' in c) { const ok = ['nowplaying', 'lyrics', 'bubbles', 'announcements', 'motion']; const arr = (Array.isArray(c.hideOverlays) ? c.hideOverlays : []).filter(o => ok.includes(o)); if (arr.length) sc.hideOverlays = arr; else delete sc.hideOverlays; }
      break; }
    case 'closeParty': {   // end of night: kiosk prompts closed, lights back to normal, every display window closed
      out.steps = {};
      try {
        if (ha.enabled) {
          const browser_id = (await ha.kiosks()).map(d => d.browserId).filter(Boolean);
          if (browser_id.length) await ha.call('browser_mod', 'close_popup', { tag: 'oneparty-kiosks', browser_id });
        }
        state.kiosks.lastCommand = { on: false, at: Date.now() }; kioskDashboardSignature = '';
        out.steps.kiosks = 'closed';
      } catch (e) { out.steps.kiosks = 'failed: ' + e.message; }
      // Halt every automatic light change first (shows, dynamic loops, sync, zones, autoscene), then set the normal scenes.
      state.takeover = null; state.blackout = false; state.whiteout = false; state.auto.on = false; state.lightsHold = true;
      shows.stop(); state.lights.pin = null; state.lights.preset = null; state.lights.mode = 'manual';
      if (ha.enabled) {
        try {
          await ha.stopDynamic([...allLights, ...state.zones.flatMap(z => z.lights)]);
          const scenes = haCfg.normalScenes || ['scene.normal', 'scene.aiden_lights_normal'];
          out.steps.lights = await lightsDone('close', Promise.all(scenes.map(sc => ha.scene(sc))).then(rs => rs.find(r => r?.error) || { ok: true, scenes }));
        } catch (e) { out.steps.lights = { error: e.message }; }
      }
      for (const id of Object.keys(state.channels)) windowPids(id).forEach(killTree);
      closeAll(); out.steps.displays = 'closed';
      break; }
    case 'takeover': {   // { id, on? } toggle (or set with on) a takeover; { id: null } clears. 'whiteout' / 'blackout' below are shortcuts for the built-ins
      if (c.id && !state.takeovers.some(d => d.id === c.id)) return { error: 'unknown takeover ' + c.id };
      const on = c.id && (c.on ?? state.takeover !== c.id);
      if (!on && c.id && state.takeover !== c.id) break;   // turning off one that isn't showing: leave the active one alone
      applyTakeover(on ? c.id : null); break; }
    case 'takeoverDef': {   // { action: 'upsert', def } | { action: 'remove', id } | { action: 'reset', id? } : add, edit and delete takeovers without a restart
      if (c.action === 'upsert') {
        const r = normalizeTakeover(c.def, state.takeovers.find(d => d.id === String(c.def?.id || '').trim().toLowerCase())); if (r.error) return r;
        setTakeoverDef(r.def); out.id = r.def.id; if (state.takeover === r.def.id) applyTakeover(r.def.id);
      } else if (c.action === 'remove') {
        const d = state.takeovers.find(x => x.id === c.id); if (!d) return { error: 'unknown takeover ' + c.id }; if (d.builtin) return { error: d.label + ' is built in; use reset to restore its defaults' };
        if (state.takeover === c.id) applyTakeover(null);
        state.takeovers = state.takeovers.filter(x => x.id !== c.id);
      } else if (c.action === 'reset') {
        const ids = c.id ? [c.id] : BUILTIN_TAKEOVERS.map(d => d.id), b = ids.map(id => BUILTIN_TAKEOVERS.find(d => d.id === id));
        if (b.includes(undefined)) return { error: 'only built-in takeovers can be reset' };
        b.forEach(setTakeoverDef); if (ids.includes(state.takeover)) applyTakeover(state.takeover);
      } else return { error: 'action must be upsert, remove or reset' };
      break; }
    case 'whiteout': return command({ type: 'takeover', id: 'whiteout', on: !!c.on });
    case 'blackout': return command({ type: 'takeover', id: 'blackout', on: !!c.on });
    case 'bpm': state.bpm = Math.min(220, Math.max(40, +c.bpm || state.bpm)); state.bpmAuto = false; state.bpmInfo = { bpm: state.bpm, source: 'manual' }; break;
    case 'bpmAuto': state.bpmAuto = !!c.on; if (c.on && state.track) await syncBpm(state.track, true); break;
    case 'lights': {
      if (c.mode === 'manual' || c.mode === 'off' || c.color) { shows.stop(); await ha.stopDynamic(allLights); }   // a fixed color must not be re-shuffled
      Object.assign(state.lights, { mode: c.mode ?? state.lights.mode });
      if ('dynamic' in c) state.lights.dynamic = !!c.dynamic;
      if ('autopilot' in c) { state.lights.autopilot = !!c.autopilot; if (shows.running()?.source === 'auto') shows.stop(); }
      if ('preset' in c) {
        if (c.preset && !resolvePreset(c.preset)) return { error: 'unknown preset ' + c.preset + ' (GET /api/state -> presets)' };
        state.lights.preset = c.preset || null; state.lights.mode = 'sync'; if (c.preset) { state.lights.pin = null; if (shows.running()?.source === 'try') shows.stop(); }
      }
      if (c.mode === 'off') out.ha = await lightsDone('off', ha.off(allLights));
      else if (c.color || c.brightness != null) { state.lights.color = c.color ?? state.lights.color; out.ha = await lightsDone('color', ha.lights(allLights, { color: c.color, brightness: c.brightness }, { minGapMs: 0, urgent: true })); }
      else if ('preset' in c || 'dynamic' in c || 'autopilot' in c || c.mode === 'sync' || c.apply) out.ha = await lightsDone('preset', applyLights(Object.values(state.channels)[0]?.scene));
      if (c.haScene) out.ha = await lightsDone('ha scene', ha.scene(c.haScene));
      break; }
    case 'lightshow': {   // { action: put|try|play|auto|rm|bind|unbind|read }  - see docs/AGENT.md "Light shows"
      try {
        switch (c.action) {
          case 'put': { const s = shows.put(c.show); out.show = s; if (c.play) { state.lights.pin = s.id; state.lights.preset = null; state.lights.mode = 'sync'; shows.start(s.id, 'manual'); } break; }
          case 'try': { shows.start(c.show, 'try'); state.lights.mode = 'sync'; break; }                     // unsaved draft, does not persist or pin
          case 'play': { if (!shows.get(c.id)) return { error: 'unknown show ' + c.id }; state.lights.pin = c.id; state.lights.preset = null; state.lights.mode = 'sync'; shows.start(c.id, 'manual'); break; }
          case 'auto': shows.stop(); state.lights.pin = null; state.lights.preset = null; state.lights.mode = 'sync'; out.ha = await lightsDone('auto', applyLights(Object.values(state.channels)[0]?.scene)); break;
          case 'rm': if (!shows.remove(c.id)) return { error: 'unknown show ' + c.id }; if (state.lights.pin === c.id) state.lights.pin = null; break;
          case 'bind': {   // { id, scene:"08" } and/or { id, song:true|"<spotify track id>", label? } (song:true = what is playing now)
            if (c.scene) shows.bindScene(String(c.scene), c.id);
            if (c.song) { const tid = c.song === true ? state.track?.id : String(c.song); if (!tid) return { error: 'no track playing' }; shows.bindSong(tid, c.id, c.label || (c.song === true && state.track ? `${state.track.title} - ${state.track.artists.join(', ')}` : '')); }
            if (!c.scene && !c.song) return { error: 'bind needs scene and/or song' };
            if (!state.lights.pin && state.lights.mode === 'sync' && !state.takeover) out.ha = await lightsDone('bind', applyLights(Object.values(state.channels)[0]?.scene)); break; }
          case 'unbind': if (c.scene) shows.unbindScene(String(c.scene)); if (c.song) shows.unbindSong(c.song === true ? state.track?.id : String(c.song)); break;
          case 'keep': {   // save the running autopilot show under a song-specific id and bind it to the current song, so it can be hand-tuned
            const cur = shows.current(); if (!cur || shows.running().source !== 'auto') return { error: 'no autopilot show running' };
            const tid = state.track?.id, nm = state.track ? `${state.track.title} - ${state.track.artists.join(', ')}` : 'kept';
            const saved = shows.put({ ...cur, id: c.id || ('song-' + (tid || Date.now())), name: nm }); if (tid) shows.bindSong(tid, saved.id, nm); out.show = saved; break; }
          case 'read': out.lights = await shows.readback(allLights); out.running = shows.running(); return out;   // what HA says the lights are doing now
          default: return { error: 'lightshow action: put|try|play|auto|rm|bind|unbind|read' };
        }
      } catch (e) { return { error: e.message }; }
      break; }
    case 'overlay': {   // toggle one overlay on one channel: { channel, name: 'nowplaying'|'lyrics', on }
      const ch = state.channels[c.channel]; if (!ch) return { error: 'unknown channel' };
      ch.overlays = ch.overlays.filter(n => n !== c.name); if (c.on) ch.overlays.push(c.name); break; }
    case 'channelAudio': {   // audio capture runs on exactly one display (the primary); turning it on elsewhere moves it
      if (!state.channels[c.channel]) return { error: 'unknown channel' };
      if (c.on) for (const ch of Object.values(state.channels)) ch.audio = false;
      state.channels[c.channel].audio = !!c.on; if (!c.on) state.audioStatus = null; break; }
    case 'refreshAudioDevices': { state.audioDevices = listOutputs(); break; }
    case 'audioDevice': {   // which Windows OUTPUT to loop back: a name fragment, an endpoint id, or null = Windows default
      state.audioDevice = c.device || null;
      capture.start(state.audioDevice); audioStream.deviceChanged(); break; }
    case 'hud': {   // live announcement/bubble/jam editor: { bubbles?:[str], announcements?:[{title,detail}], jam?:{url,on,pin}, bubbleSeconds?, announceSeconds? }
      const h = state.hud;
      if (Array.isArray(c.bubbles)) h.bubbles = c.bubbles.map(x => String(x).trim()).filter(Boolean).slice(0, 30);
      if (Array.isArray(c.announcements)) h.announcements = c.announcements.map(a => ({ title: String(a.title || '').trim(), detail: String(a.detail || '').trim(), category: String(a.category || '').trim().slice(0, 24), price: String(a.price || '').trim().slice(0, 16) })).filter(a => a.title).slice(0, 30);
      if (c.jam) h.jam = { ...h.jam, ...c.jam, url: String(c.jam.url ?? h.jam.url ?? '').trim() };
      if (c.contest) { const k = c.contest; h.contest = { ...h.contest, ...(k.on != null && { on: !!k.on }), ...(k.pin != null && { pin: !!k.pin }), ...(k.url != null && { url: String(k.url).trim().slice(0, 500) }), ...(k.title != null && { title: String(k.title).trim().slice(0, 40) }), ...(k.sub != null && { sub: String(k.sub).trim().slice(0, 60) }) }; }
      if (c.bubbleSeconds) h.bubbleSeconds = Math.min(30, Math.max(3, +c.bubbleSeconds));
      if (c.quietSeconds != null) h.quietSeconds = Math.min(120, Math.max(0, +c.quietSeconds || 0));
      if (c.announceSeconds) h.announceSeconds = Math.min(60, Math.max(3, +c.announceSeconds));
      break; }
    case 'contest': { const r = await contest.command(c); if (r.error) return r; break; }   // cloud guest app: {action:'connect|refresh|config|addEntry|editEntry|removeEntry|removeImage|reset|board',...}
    case 'settingsReset': {   // forget every live tweak and go back to what event.json authored
      resetSettings(); shows.stop(); capture.start(state.audioDevice);
      for (const g of groups) ha.stopDynamic(g.entities);
      break; }
    case 'ytLogin': {   // { action: 'start' | 'cancel' | 'forget' }
      const r = c.action === 'cancel' ? ytlogin.cancel() : c.action === 'forget' ? ytlogin.forget() : ytlogin.start();
      if (r.error) return r; break; }
    case 'dlAdd': {   // { urls: ["https://... @ 1:20-2:10", ...], playlist: 'single'|'all'|'first', first: 5, height: 1080, start, end }
      const urls = Array.isArray(c.urls) ? c.urls : String(c.urls || '').split(/\r?\n/);
      const r = downloads.add(urls, c); if (!r.ok) return { error: r.rejected.length ? 'not a link: ' + r.rejected[0] : 'nothing to download' }; out.dl = r; break; }
    case 'dlCancel': { const r = downloads.cancel(c.id); if (r.error) return r; break; }
    case 'dlClear': downloads.clearFinished(); break;
    case 'overlays': { const ch = state.channels[c.channel]; if (!ch) return { error: 'unknown channel' }; ch.overlays = c.overlays || []; break; }
    case 'bake': {   // awaits the render; { scene: '07' } | { scene: 'all' | 'missing' }
      const ids = c.scene === 'all' ? state.scenes.map(s => s.id) : c.scene === 'missing' ? state.scenes.map(s => s.id).filter(i => !fs.existsSync(path.join(cacheDir, i + '.webm'))) : [String(c.scene)];
      const results = {}; for (const id of ids) results[id] = await bake(id, c);
      return { ok: Object.values(results).every(r => r.ok), results }; }
    case 'draft': {   // { id, source } writes an OFF-AIR draft (web/engine/drafts/<id>.js); { id, remove:true } deletes it; {} lists
      if (!c.id) return { drafts: listDrafts() };
      return putDraft(c); }
    case 'preview': return preview(String(c.scene || c.id), c);   // render a draft (or live scene) off-air: contact sheet + metrics + verdict
    case 'promote': return promoteDraft(c);                          // draft -> real scene; refuses unless the current draft source passed a preview
    case 'stream': {   // { channel, url, sound? } show a YouTube / HLS / video URL on a display; { channel, off:true } goes back to scenes
      const ch = state.channels[c.channel]; if (!ch) return { error: 'unknown channel' };
      if (c.off) { ch.mode = ch.role === 'videos' ? 'video' : 'live'; mirrorFrom(c.channel); break; }
      if (!/^https?:\/\//i.test(String(c.url || ''))) return { error: 'url must start with http(s)://' };
      const url = await resolveYoutube(String(c.url).trim()); if (url.error) return url;
      const isYt = /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(url), via = c.via === 'embed' ? 'embed' : 'hub';
      delete ch.params.streamTitle; delete ch.params.streamLive;
      if (isYt && via === 'hub') { try { const i = await ytstream.probe(url, ch.params.streamH = Math.min(1080, +ch.params.maxH || 1080)); ch.params.streamTitle = i.title; ch.params.streamLive = i.live; } catch (e) { return { error: e.message + ' (you can still try Play via: YouTube embed)' }; } }
      ch.params.streamVia = isYt ? via : 'direct';
      ch.params.stream = url; ch.params.streamSound = !!c.sound; ch.mode = 'stream'; mirrorFrom(c.channel); break; }
    case 'zone': {   // { action: add|update|remove|assign|flash|apply, ... }  per-region lighting tied to displays, see server/zones.mjs
      let data; if (c.action === 'import' || c.action === 'sync') { try { data = await haAreas(true); } catch (e) { return { error: 'could not read areas from Home Assistant: ' + (e.message || e) }; } }
      const r = zones.command({ ...c, data }); if (r.error) return r;
      if (['add', 'remove', 'assign', 'import'].includes(c.action) || r.changed?.length) lightsDone('zones', applyLights(Object.values(state.channels)[0]?.scene));   // lights moved in/out of the global set
      out = { ...out, ...r }; break; }
    case 'display': { const r = displayCmd(c); if (r.error) return r; out = { ...out, ...r }; break; }
    case 'snapshot': return snapshot(c.channel);
    case 'player': { const r = await spotify.control(c); if (r.error) return r; break; }
    case 'flash': out.ha = await lightsDone('flash', ha.lights(allLights, { color: c.color || '#ffffff', brightness: 255, transition: 0 }, { minGapMs: 0, key: 'flash', urgent: true })); break;
    default: return { error: 'unknown command ' + c.type };
  }
  if (['hud', 'settingsReset', 'scene', 'autoscene', 'display'].includes(c.type)) refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message));
  broadcast('state', publicState());
  if (state.lightsHold && ['lights', 'zone', 'lightshow', 'blackout', 'whiteout', 'takeover', 'scene'].includes(c.type)) state.lightsHold = false;
  zones.sync();   // any command may have changed a display's scene: bring zone lights along
  if (c.type !== 'settingsReset') scheduleSave(); else { try { fs.rmSync(settingsFile, { force: true }); } catch { /* none */ } }
  return out;
}
const withPresence = () => Object.fromEntries(Object.entries(state.channels).map(([k, c]) => [k, { ...c, online: !!c.lastSeen && Date.now() - c.lastSeen < 15000 }]));
const audioListeners = () => audioStream.count;
const networkInfo = () => ({ lan: HOST !== '127.0.0.1', port: PORT, urls: lanUrls(PORT) });
const publicState = () => ({ ...state, channels: withPresence(), network: networkInfo(), audioListeners: audioListeners(), presets: PRESETS, lightshows: { ...shows.list(), running: shows.running() }, ha: { enabled: ha.enabled, conn: { ...ha.info(), localIp: state.haLocal, hostEnv: process.env.HA_HOST || '' }, scenePresets: haCfg.presets || {}, lights: zones.baseLights, baseGroups: baseGroups.map(g => ({ name: g.name, kind: g.kind, entities: g.entities })), groups: baseGroups.map(g => ({ name: g.name, kind: g.kind, n: g.entities.length })) }, contest: contest.view(), downloads: downloads.list(), ytLogin: ytlogin.status(), settings: { file: path.relative(ROOT, settingsFile).split(path.sep).join('/'), savedAt }, spotify: { enabled: spotify.enabled, authed: spotify.authed, canControl: spotify.canControl }, kiosk: KIOSK });

// audio frames come from whichever display captures audio; drive lights from them
const lastBeat = new Map();
function onAudio(a) {
  broadcast('audio', a);
  autoScene.onAudio(a);
  shows.onAudio(a);
  zones.onBeat(a);
  if (shows.running()) return;   // an authored show owns the lights (it handles beats itself)
  if (a.bpm && bpmFromAudio && state.bpmAuto) {   // smoothed audio tempo, no more than one state push per 2 s
    const next = Math.round((state.bpm + (a.bpm - state.bpm) * 0.35) * 10) / 10;
    if (Math.abs(next - state.bpm) >= 0.3 && Date.now() - lastBpmPush > 2000) {
      lastBpmPush = Date.now(); state.bpm = next; state.bpmInfo = { bpm: next, raw: a.bpm, source: 'audio' }; broadcast('state', publicState());
    }
  }
  if (!a.beat || state.lights.mode !== 'sync' || !groups.length || state.takeover) return;
  const main = Object.values(state.channels)[0];
  const pal = state.scenes.find(s => s.id === main?.scene)?.palette || ['#ffffff'];
  const now = Date.now(); const base = haCfg.brightness ?? 180;
  for (const g of groups) {
    if (!g.beat || now - (lastBeat.get(g.name) || 0) < g.minGapMs) continue;
    lastBeat.set(g.name, now);
    ha.lights(g.entities, { brightness: Math.min(255, base + 90 * a.level), transition: g.transition }, { key: 'beat:' + g.name, minGapMs: g.minGapMs });
  }
}

// ---------- agent surface: bake + snapshot + scene authoring ----------
const jobs = new Map();      // key -> resolver, settled by /api/bake, /api/snapshot or /api/report
let bakeChain = Promise.resolve();
function bake(id, { dur, w, h } = {}) {
  if (!/^[\w-]+$/.test(id) || !state.scenes.some(s => s.id === id)) return Promise.resolve({ error: 'unknown scene ' + id });
  const run = () => new Promise(resolve => {
    let win; const key = 'bake:' + id;
    const finish = r => { clearTimeout(t); jobs.delete(key); setTimeout(() => win?.pid && killTree(win.pid), 400); resolve(r); };
    const t = setTimeout(() => finish({ error: 'bake timed out (GPU busy? close other displays and retry)' }), 60000 + (dur || 8) * 2000);
    jobs.set(key, finish);
    const q = new URLSearchParams({ scene: id, ...(dur && { dur }), ...(w && { w }), ...(h && { h }) });
    win = launchWindow({ url: `http://127.0.0.1:${PORT}/bake.html?${q}`, id: 'bake-' + id, size: { w: 1920, h: 1080 }, force: true, hidden: true });
    if (win.error) finish(win);
  });
  const p = bakeChain.then(run); bakeChain = p.catch(() => {}); return p;
}
function snapshot(channel) {
  const ch = channel || Object.keys(state.channels).find(k => state.channels[k].role === 'visuals');
  if (!state.channels[ch]) return Promise.resolve({ error: 'unknown channel' });
  return new Promise(resolve => {
    const req = String(Date.now()), key = 'snap:' + req;
    const t = setTimeout(() => { jobs.delete(key); resolve({ error: `no display answered for channel "${ch}" (is its window open? POST /api/launch)` }); }, 10000);
    jobs.set(key, r => { clearTimeout(t); jobs.delete(key); resolve(r); });
    broadcast('snapshot', { req, channel: ch });
  });
}
// ---- off-air drafts: author + verify a scene without it ever reaching a display ----
const draftDir = path.join(ROOT, 'web', 'engine', 'drafts'), previewDir = path.join(cacheDir, 'previews');
const draftPath = id => path.join(draftDir, id + '.js'), cleanId = id => String(id || '').replace(/[^\w-]/g, '');
const srcHash = src => crypto.createHash('sha1').update(src).digest('hex').slice(0, 12);
const previewPassed = new Map();       // draft id -> source hash that passed a preview with verdict ok
const listDrafts = () => fs.existsSync(draftDir) ? fs.readdirSync(draftDir).filter(f => f.endsWith('.js')).map(f => { const id = f.slice(0, -3), src = fs.readFileSync(draftPath(id), 'utf8'); return { id, bytes: src.length, previewed: previewPassed.get(id) === srcHash(src) }; }) : [];
function putDraft({ id, source, remove }) {
  id = cleanId(id);
  if (!id) return { error: 'need id' };
  if (remove) { fs.rmSync(draftPath(id), { force: true }); previewPassed.delete(id); return { ok: true, removed: id }; }
  if (typeof source !== 'string') return { error: 'need source' };
  const tmp = path.join(os.tmpdir(), `oneparty-draft-${id}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, source);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { return { error: 'syntax error: ' + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n') }; }
  finally { fs.rmSync(tmp, { force: true }); }
  fs.mkdirSync(draftDir, { recursive: true }); fs.writeFileSync(draftPath(id), source); previewPassed.delete(id);
  return { ok: true, id, draft: true, note: 'off-air; run preview, then promote' };
}
let previewChain = Promise.resolve();
const previewAudio = ['synth', 'silent', 'quiet', 'loud'];
function preview(id, { draft = true, frames, w, h, audio = 'synth' } = {}) {
  id = cleanId(id);
  const file = draft ? draftPath(id) : path.join(ROOT, 'web', 'engine', 'scenes', id + '.js');
  if (!fs.existsSync(file)) return Promise.resolve({ error: (draft ? 'no draft ' : 'no scene ') + id + (draft ? ' (write one with draft, or pass draft:false for a live scene)' : '') });
  if (!previewAudio.includes(audio)) return Promise.resolve({ error: 'audio must be one of ' + previewAudio.join('|') });
  const ts = (Array.isArray(frames) && frames.length ? frames : [0, 0.25, 0.5, 0.75]).slice(0, 8).map(Number).filter(x => x >= 0 && x < 1);
  const hash = srcHash(fs.readFileSync(file, 'utf8'));
  const run = () => new Promise(resolve => {
    let win; const job = String(Date.now()), key = 'preview:' + job, dir = path.join(previewDir, job); fs.mkdirSync(dir, { recursive: true });
    const finish = r => { clearTimeout(t); jobs.delete(key); setTimeout(() => win?.pid && killTree(win.pid), 400); resolve(r); };
    const t = setTimeout(() => finish({ ok: false, verdict: 'fail', problems: ['preview timed out (build hung, GPU busy, or the window failed to open)'] }), 45000);
    jobs.set(key, m => finish(judgePreview(id, draft, hash, dir, m)));
    const q = new URLSearchParams({ job, scene: id, draft: draft ? '1' : '0', t: ts.join(','), audio, ...(w && { w }), ...(h && { h }) });
    win = launchWindow({ url: `http://127.0.0.1:${PORT}/preview.html?${q}`, id: 'preview', size: { w: 1280, h: 720 }, force: true, hidden: true });
    if (win.error) finish({ ok: false, verdict: 'fail', problems: [win.error] });
  });
  const p = previewChain.then(run); previewChain = p.catch(() => {}); return p;
}
// Turn raw page measurements into a pass/warn/fail verdict an agent can act on.
function judgePreview(id, draft, hash, dir, m) {
  const problems = [], warnings = [];
  if (!m.ok) problems.push('build failed: ' + String(m.error).split('\n').slice(0, 6).join(' | '));
  for (const e of m.errors || []) (/uncaught|unhandled|update\(\)|TypeError|ReferenceError|not a function|NaN/i.test(e) ? problems : warnings).push(e);
  if (m.ok) {
    const fr = m.frames || [];
    if (fr.length && fr.every(f => f.dark > 0.97)) problems.push('blank: every frame is ~black (camera pointing away, nothing lit, or materials not rendering)');
    else if (fr.some(f => f.dark > 0.97)) warnings.push('some frames are ~black: ' + fr.filter(f => f.dark > 0.97).map(f => 't=' + f.t).join(', '));
    if (fr.some(f => f.hot > 0.6)) warnings.push('blown out: >60% of pixels are pure white in ' + fr.filter(f => f.hot > 0.6).map(f => 't=' + f.t).join(', ') + ' (lower bloom/exposure; the host adds more on beats)');
    if (fr.length > 1 && m.motion < 0.002) warnings.push('static: frames barely change across t, so nothing animates over the loop');
    if (m.seam > 0.04) warnings.push('loop seam: t=0 and t~1 differ by ' + m.seam + ' - something is not periodic in t, so it will jump when it loops/bakes');
    if (m.msPerFrame > 33) warnings.push('slow: ' + m.msPerFrame + ' ms/frame at ' + m.w + 'x' + m.h + ' (over 30 fps budget)' + (/swiftshader|llvmpipe|software/i.test(m.renderer || '') ? ' - and this is a SOFTWARE renderer, so a real GPU will be faster' : ''));
    else if (m.msPerFrame > 16.6) warnings.push('heavy: ' + m.msPerFrame + ' ms/frame at ' + m.w + 'x' + m.h + ' (misses 60 fps; fine for 30)');
  }
  const verdict = problems.length ? 'fail' : warnings.length ? 'warn' : 'pass';
  if (draft && verdict !== 'fail') previewPassed.set(id, hash); else if (draft) previewPassed.delete(id);
  const rel = f => path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/');
  return { ok: verdict !== 'fail', verdict, scene: id, draft, problems, warnings, metrics: { w: m.w, h: m.h, audio: m.audio, buildMs: m.buildMs, msPerFrame: m.msPerFrame, seam: m.seam, motion: m.motion, renderer: m.renderer, frames: m.frames },
    sheet: rel('sheet.jpg'), frameFiles: (m.frames || []).map((_, i) => rel('frame-' + i + '.jpg')), sheetAbs: path.join(dir, 'sheet.jpg'), next: verdict === 'fail' ? 'fix the problems and preview again' : draft ? 'look at the sheet, then promote (and show_scene)' : 'ok' };
}
function promoteDraft({ id, title, palette, force, hype }) {
  id = cleanId(id);
  const f = draftPath(id); if (!fs.existsSync(f)) return { error: 'no draft ' + id };
  const source = fs.readFileSync(f, 'utf8');
  if (!force && previewPassed.get(id) !== srcHash(source)) return { error: 'this draft source has not passed a preview (it changed, or never ran). Run preview first, or pass force:true.' };
  const r = putScene({ id, title, palette, source, hype });
  if (r.ok) { fs.rmSync(f, { force: true }); previewPassed.delete(id); }
  return r;
}
function removeScene(id) {
  const i = event.scenes.findIndex(s => s.id === id);
  if (i < 0) return { error: 'unknown scene ' + id };
  if (event.scenes.length === 1) return { error: 'cannot remove the last scene' };
  event.scenes.splice(i, 1);
  const { slug: _s, ...onDisk } = event;
  fs.writeFileSync(path.join(ROOT, 'events', slug, 'event.json'), JSON.stringify(onDisk, null, 2) + '\n');
  fs.rmSync(path.join(ROOT, 'web', 'engine', 'scenes', id + '.js'), { force: true }); fs.rmSync(path.join(cacheDir, id + '.webm'), { force: true });
  state.scenes = event.scenes; delete state.sceneStatus[id];
  for (const ch of Object.values(state.channels)) if (ch.scene === id) ch.scene = event.scenes[0].id;
  broadcast('cache', { scene: id }); broadcast('state', publicState());
  return { ok: true, removed: id };
}
// hype: { busy, jumpy } (0-10, agent-judged; score = mean, filled in here). Accepts a bare number as the score too.
function normHype(h) {
  if (h == null) return null;
  const n = v => Math.min(10, Math.max(0, Math.round(Number(v) * 2) / 2));
  if (typeof h === 'number' || typeof h === 'string') { const s = n(h); return Number.isFinite(s) ? { busy: s, jumpy: s, score: s } : null; }
  const busy = n(h.busy ?? h.score), jumpy = n(h.jumpy ?? h.score);
  return Number.isFinite(busy) && Number.isFinite(jumpy) ? { busy, jumpy, score: (busy + jumpy) / 2 } : null;
}
function putScene({ id, title, palette, source, remove, hype }) {   // hype kept across rewrites unless given; REQUIRED for a new scene
  id = String(id || '').replace(/[^\w-]/g, '');
  if (remove) return removeScene(id);
  if (!id || typeof source !== 'string') return { error: 'need id and source' };
  hype = normHype(hype);
  if (!hype && !event.scenes.some(s => s.id === id && s.hype)) return { error: 'new scenes need a hype score: hype:{busy:0-10, jumpy:0-10}. busy = how much is going on at once, jumpy = how hard it snaps to the beat. Auto-scene uses it to start hotter scenes when the music gets hype (see docs/AGENT.md "Hype scores"). Judge honestly: 2-3 calm, 5 mid, 8-10 a rave.' };
  const tmp = path.join(os.tmpdir(), `oneparty-${id}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, source);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { return { error: 'syntax error: ' + String(e.stderr || e.message).split('\n').slice(0, 6).join('\n') }; }
  finally { fs.rmSync(tmp, { force: true }); }
  fs.writeFileSync(path.join(ROOT, 'web', 'engine', 'scenes', id + '.js'), source);
  const i = event.scenes.findIndex(s => s.id === id), prev = event.scenes[i];
  const entry = { id, title: title || prev?.title || 'Scene ' + id, palette: palette || prev?.palette || ['#ffffff'], ...(prev?.hideOverlays ? { hideOverlays: prev.hideOverlays } : {}), ...((hype || prev?.hype) ? { hype: hype || prev.hype } : {}) };
  if (i >= 0) event.scenes[i] = entry; else event.scenes.push(entry);
  const { slug: _s, ...onDisk } = event;
  fs.writeFileSync(path.join(ROOT, 'events', slug, 'event.json'), JSON.stringify(onDisk, null, 2) + '\n');
  state.scenes = event.scenes; delete state.sceneStatus[id];
  if (fs.existsSync(path.join(cacheDir, id + '.webm'))) { fs.rmSync(path.join(cacheDir, id + '.webm')); broadcast('cache', { scene: id }); }   // stale bake
  broadcast('reload', { scene: id }); broadcast('state', publicState());
  return { ok: true, id, created: i < 0 };
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.png': 'image/png' };
const mounts = [['/contest/', contestDir], ['/cache/', cacheDir], ['/media/', mediaDir], ['/event/', path.join(ROOT, 'events', slug, 'assets')], ['/', path.join(ROOT, 'web')]];
const body = req => new Promise((res, rej) => { const b = []; req.on('data', d => b.push(d)); req.on('end', () => res(Buffer.concat(b))); req.on('error', rej); });
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };

function serveStatic(req, res, pathname) {
  if (/^\/control(\.html|\/)?$/.test(pathname) && fs.existsSync(path.join(ROOT, 'web', 'control', 'index.html'))) pathname = '/control/index.html';   // the Vue panel (control/, built to web/control); control.html is the fallback
  for (const [prefix, dir] of mounts) {
    if (!pathname.startsWith(prefix)) continue;
    const rel = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
    const p = path.resolve(dir, rel);
    if (!p.startsWith(dir + path.sep) && p !== dir) break;
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) continue;
    const st = fs.statSync(p), type = MIME[path.extname(p)] || 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);   // video seeking
    if (range) {
      const s = +range[1] || 0, e = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${s}-${e}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 });
      return fs.createReadStream(p, { start: s, end: e }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    return fs.createReadStream(p).pipe(res);
  }
  res.writeHead(404); res.end('not found');
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  try {
    if (p === '/api/contest/image' && req.method === 'POST') {   // raw image bytes -> guest app (entry photo or the Venmo QR); ?id=<entry id>|pay
      const r = await contest.saveImage(u.searchParams.get('id') === 'pay' ? 'pay' : 'entry', u.searchParams.get('id'), await body(req), req.headers['content-type']);
      return json(res, r.error ? 400 : 200, r);
    }
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      clients.add(res); req.on('close', () => clients.delete(res));
      send(res, 'state', publicState()); if (state.track) send(res, 'track', { track: state.track, lyrics: state.lyrics });
      return;
    }
    if (p === '/api/state') return json(res, 200, publicState());
    if (p === '/api/queue-lyrics') {   // lyrics for the upcoming Spotify queue (?limit=1..15, default 5), looked up from LRCLIB in parallel
      const limit = Math.min(15, Math.max(1, +u.searchParams.get('limit') || 5));
      const q = await spotify.queue().catch(() => null); if (q) { state.queue = q; broadcast('queue', q); }
      const tracks = (state.queue || []).slice(0, limit);
      return json(res, 200, { tracks: await Promise.all(tracks.map(async t => ({ id: t.id, title: t.title, artists: t.artists, durationMs: t.durationMs, lyrics: await getLyrics(t).catch(() => null) }))) });
    }
    if (p === '/api/cmd' && req.method === 'POST') return json(res, 200, await command(JSON.parse((await body(req)).toString())));
    if (p === '/api/audio' && req.method === 'POST') { onAudio(JSON.parse((await body(req)).toString())); res.writeHead(204); return res.end(); }
    if (p === '/api/cache') return json(res, 200, fs.readdirSync(cacheDir).filter(f => /\.(webm|mp4)$/.test(f)));
    if (p === '/api/media') return json(res, 200, fs.readdirSync(mediaDir).filter(f => {
      if (!/\.(webm|mp4|mov)$/i.test(f) || /\.f\d+\.(webm|mp4|mov)$/i.test(f)) return false;     // finished files only: no yt-dlp format parts
      try { const st = fs.statSync(path.join(mediaDir, f)); return st.size > 0 && Date.now() - st.mtimeMs > 4000; } catch { return false; }
    }));
    if (p === '/api/bake' && req.method === 'POST') {   // posted by web/bake.html; body = webm bytes
      const id = (u.searchParams.get('scene') || '').replace(/[^\w-]/g, '');
      if (!id) return json(res, 400, { error: 'scene' });
      fs.writeFileSync(path.join(cacheDir, id + '.webm'), await body(req)); broadcast('cache', { scene: id });
      jobs.get('bake:' + id)?.({ ok: true, scene: id, file: `cache/${slug}/${id}.webm` });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/scene' && req.method === 'POST') { const r = putScene(JSON.parse((await body(req)).toString())); return json(res, r.error ? 400 : 200, r); }
    if (p === '/api/ytaudio' && req.method === 'GET') {
      let target;
      try { target = ytstream.youtubeAudioUrl(u.searchParams.get('url') || ''); }
      catch { return json(res, 400, { error: 'Paste a YouTube video or live stream link.' }); }
      if (u.searchParams.has('info')) {
        try { const info = await ytstream.probeAudio(target); return json(res, 200, { title: info.title, live: info.live }); }
        catch (e) { return json(res, 502, { error: e.message }); }
      }
      return ytstream.serveAudio(req, res, target);
    }
    if (p === '/api/ytstream') {   // a YouTube/yt-dlp URL played THROUGH the hub: yt-dlp + ffmpeg on this machine, tabs just play the result
      const target = u.searchParams.get('url') || '';
      if (!/^https?:\/\//i.test(target)) return json(res, 400, { error: 'url must start with http(s)://' });
      return ytstream.serve(req, res, target, Math.min(2160, +u.searchParams.get('h') || 1080));
    }
    if (p === '/api/kiosk-frame' && req.method === 'POST') { if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) { res.writeHead(403); return res.end(); } const ok = kioskFrame(await body(req)); res.writeHead(ok ? 204 : 400); return res.end(); }
    if (p === '/api/kiosk.jpg') return kioskStream.still(res);
    if (p === '/api/kiosk.mjpeg') return kioskStream.stream(req, res);
    if (p === '/api/kiosk-stream') return json(res, 200, kioskStream.status());
    if (p === '/api/ha-browsers') { try { return json(res, 200, await ha.unnamedBrowsers()); } catch (e) { return json(res, 502, { error: e.message }); } }
    if (p === '/api/ha-kiosks') { try { return json(res, 200, (await ha.kiosks()).map(d => ({ ...d, role: kioskRole(d) }))); } catch (e) { return json(res, 502, { error: e.message }); } }
    if (p === '/api/ha-areas') { try { return json(res, 200, await haAreas(u.searchParams.has('refresh'))); } catch (e) { return json(res, 502, { error: String(e.message || e) }); } }   // HA areas + floors, for the zone importer
    if (p === '/api/screens') return json(res, 200, detectScreens().map((sc, index) => ({ index, ...sc })));   // this PC's monitors, for "add a monitor"
    if (p === '/api/audio-stream' && req.method === 'GET') return audioStream.add(req, res, (u.searchParams.get('device') || '').slice(0, 120));   // displays play the hub's audio from here
    if (p === '/api/register' && req.method === 'POST') {   // a browser joins as a display: { deviceId, name, role?, follow? } -> { id }
      const b = JSON.parse((await body(req)).toString());
      if (!b.deviceId || typeof b.deviceId !== 'string') return json(res, 400, { error: 'need deviceId' });
      const key = b.deviceId.slice(0, 48) + (b.tabId ? ':' + String(b.tabId).slice(0, 24) : '');   // one display per browser tab
      const fresh = !Object.values(state.channels).some(c => c.remote && c.deviceId === key);
      const id = addRemote(key, String(b.name || '').trim().slice(0, 40) || 'Display', {}, !!b.reconfigure);
      if ((fresh || b.reconfigure) && b.role) displayCmd({ action: 'configure', id, role: b.role });
      if ((fresh || b.reconfigure) && 'follow' in b) displayCmd({ action: 'configure', id, follow: b.follow || null });
      state.channels[id].lastSeen = Date.now(); scheduleSave(); broadcast('state', publicState());
      return json(res, 200, { id, role: state.channels[id].role, name: state.channels[id].name, isNew: fresh });
    }
    if (p === '/api/report' && req.method === 'POST') {   // displays/baker report scene build results and errors
      const b = JSON.parse((await body(req)).toString());
      if (b.channel && state.channels[b.channel]) state.channels[b.channel].lastSeen = Date.now();   // any report doubles as a heartbeat
      if (b.channel && state.channels[b.channel]) delete state.channels[b.channel].goneAt;
      if (b.kind === 'ping') { /* heartbeat only */ }
      else if (b.kind === 'hello') { if (state.channels[b.channel]) { state.channels[b.channel].caps = Array.isArray(b.caps) ? b.caps.slice(0, 8) : []; broadcast('state', publicState()); } }   // which features this page's code has
      else if (b.kind === 'audiodevices') { const ch = state.channels[b.channel]; if (ch && Array.isArray(b.outputs)) { ch.audioOutputs = b.outputs.slice(0, 30).map(o => ({ id: String(o.id).slice(0, 200), label: String(o.label || '').slice(0, 120) })); broadcast('state', publicState()); } }   // sound outputs this display's browser can play to
      else if (b.kind === 'hubaudio') { const ch = state.channels[b.channel]; if (ch) { ch.hubAudioState = { state: String(b.state).slice(0, 20), error: b.error ? String(b.error).slice(0, 160) : undefined, at: Date.now() }; broadcast('state', publicState()); } }   // this device's hub-audio playback state
      else if (b.kind === 'bye') { const ch = state.channels[b.channel]; if (ch) { ch.lastSeen = 0; ch.goneAt = Date.now(); broadcast('state', publicState()); } }
      else if (b.kind === 'hud') { state.hudStatus[b.channel] = b.status; }
      else if (b.kind === 'gpu') { state.gpu[b.channel] = { renderer: b.renderer, software: /swiftshader|llvmpipe|software|basic render/i.test(b.renderer || '') }; broadcast('state', publicState()); }
      else if (b.kind === 'audio' && state.audioMode === 'browser') { state.audioStatus = b.idle ? null : { channel: b.channel, source: b.source, label: b.label, error: b.error, at: Date.now() }; broadcast('state', publicState()); }
      else if (b.kind === 'bake') jobs.get('bake:' + b.scene)?.({ error: 'bake failed: ' + b.error });
      else if (b.scene) { state.sceneStatus[b.scene] = b.error ? { ok: false, error: String(b.error).slice(0, 600), channel: b.channel, at: Date.now() } : { ok: true, channel: b.channel, at: Date.now() }; broadcast('state', publicState()); }
      res.writeHead(204); return res.end();
    }
    if (p === '/api/snapshot' && req.method === 'POST') {   // body = jpeg bytes from the display's canvas
      const scene = (u.searchParams.get('scene') || 'unknown').replace(/[^\w-]/g, ''), dir = path.join(cacheDir, 'snapshots'); fs.mkdirSync(dir, { recursive: true });
      const buf = await body(req); fs.writeFileSync(path.join(dir, scene + '.jpg'), buf); fs.writeFileSync(path.join(dir, 'latest.jpg'), buf);
      jobs.get('snap:' + u.searchParams.get('req'))?.({ ok: true, scene, file: `cache/${slug}/snapshots/${scene}.jpg`, abs: path.join(dir, scene + '.jpg') });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/preview' && req.method === 'POST') {   // posted by web/preview.html: ?job&sheet=1 | frame=i (jpeg) | final=1 (json metrics)
      const job = (u.searchParams.get('job') || '').replace(/[^\w-]/g, ''), dir = path.join(previewDir, job); fs.mkdirSync(dir, { recursive: true });
      const buf = await body(req);
      if (u.searchParams.get('sheet')) fs.writeFileSync(path.join(dir, 'sheet.jpg'), buf);
      else if (u.searchParams.has('frame')) fs.writeFileSync(path.join(dir, 'frame-' + (+u.searchParams.get('frame')) + '.jpg'), buf);
      else if (u.searchParams.get('final')) jobs.get('preview:' + job)?.(JSON.parse(buf.toString()));
      res.writeHead(204); return res.end();
    }
    if (p === '/api/help') return json(res, 200, HELP);
    if (p === '/api/fetch' && req.method === 'POST') return json(res, 200, downloads.add([JSON.parse((await body(req)).toString()).url]));
    if (p === '/api/launch' && req.method === 'POST') return json(res, 200, launchDisplays(JSON.parse((await body(req)).toString() || '{}').force));
    if (p === '/auth/spotify/login') { if (!spotify.enabled) return json(res, 400, { error: 'Set SPOTIFY_CLIENT_ID in .env' }); res.writeHead(302, { location: spotify.loginUrl() }); return res.end(); }
    if (p === '/auth/spotify/callback') { await spotify.callback(u.searchParams.get('code')); broadcast('state', publicState()); res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h2>Spotify connected. You can close this tab.</h2>'); }
    serveStatic(req, res, p);
  } catch (e) { console.error(e); json(res, 500, { error: String(e.message || e) }); }
});

// ---------- YouTube sign-in (cookie capture, see ytlogin.mjs) ----------
const ytlogin = createYtLogin({ onChange: () => broadcast('state', publicState()) });

// ---------- clip downloads (yt-dlp queue, see downloads.mjs) ----------
let dlTimer = null;
const downloads = createDownloads({
  mediaDir,
  onChange: () => { if (!dlTimer) dlTimer = setTimeout(() => { dlTimer = null; broadcast('state', publicState()); }, 250); },
  onDone: () => broadcast('cache', {}),          // video channels re-read the media folder
});

// ---------- displays ----------
// Resolve a local display's monitor (by name first, then index) and open its window.
function launchLocal(id, force = true) {
  const ch = state.channels[id]; if (!ch?.local) return { error: 'not a local display' };
  const screens = detectScreens(), m = ch.monitor || {};
  const screen = screens.find(sc => m.name && sc.name === m.name) || screens[m.index] || screens.find(sc => sc.primary) || screens[0];
  const kiosk = ch.fullscreen ?? KIOSK, q = 'id=' + id + (kiosk ? '' : '&maxh=720&fps=30');
  const r = launchWindow({ url: 'http://127.0.0.1:' + PORT + '/display.html?' + q, screen, id, kiosk, force, screenCount: screens.length });
  return { id, screen: screen?.name || null, ...r };
}
function launchDisplays(force = false) {
  const screens = detectScreens(); const used = new Set(); const out = [];
  console.log('screens:', screens.map(s => `${s.name} ${s.w}x${s.h}@${s.x},${s.y}${s.primary ? ' (primary)' : ''}`).join(' | ') || 'none detected');
  for (const d of event.displays || []) {
    const screen = pickScreen(screens, d.monitor ?? 'primary', used);
    if (screen) used.add(screen);
    const page = d.role === 'control' ? 'control.html' : 'display.html';
    const q = `id=${d.id}` + (KIOSK ? '' : '&maxh=720&fps=30');   // dev windows render lighter
    const r = launchWindow({ url: `http://127.0.0.1:${PORT}/${page}?${q}`, screen, id: d.id, kiosk: KIOSK, force, screenCount: screens.length });
    out.push({ id: d.id, role: d.role, screen: screen?.name || null, ...r });
    console.log(`  ${d.id} (${d.role}) -> ${screen ? screen.name : 'NO MATCHING MONITOR'}${r.error ? ' ERROR ' + r.error : ''}`);
  }
  for (const [id, c] of Object.entries(state.channels)) if (c.local) out.push({ ...launchLocal(id, force), role: c.role });   // extra monitors added from the control panel
  return out;
}

const HELP = {
  note: 'Everything goes through POST /api/cmd {type,...}. See docs/AGENT.md and tools/op.mjs.',
  commands: {
    scene: '{type:"scene",channel:"main",scene:"05",mode:"live|cached"}', mode: '{type:"mode",channel,mode:"live|cached|video"}',
    param: '{type:"param",channel,key:"maxH|fps",value}  (render height cap / fps cap)', overlays: '{type:"overlays",channel,overlays:["nowplaying","lyrics"]}',
    hud: '{type:"hud",bubbles:["Welcome..."],announcements:[{category?:str,price?:str,title:"Jungle Juice",detail:"$3"}],jam:{url,on,pin}}  (overlays to enable per display: bubbles, announcements, motion)',
    contest: '{type:"contest",action:"connect",url,key}  |  {action:"config",entriesOpen?,votingOpen?,ratingOpen?,showResults?,title?,payUrl?,payNote?,payTitle?}  |  {action:"addEntry|editEntry|removeEntry|removeImage|reset",id?,name?,costume?,what?:"votes|ratings|entries|all"}  |  {action:"board",on?,top?,reveal?:n|"next"|"all"|"none"} (leaderboard on displays). Images: POST /api/contest/image?id=<entry|pay> raw bytes. Guest app QR: hud {contest:{url,on,pin}}',
    settingsReset: '{type:"settingsReset"}  (forget live tweaks; back to event.json defaults)',
    dlAdd: '{type:"dlAdd",urls:["https://... @ 1:20-2:10"],playlist:"single|all|first",first:5,height:1080,start?,end?}  (queue; one at a time)',
    ytLogin: '{type:"ytLogin",action:"start|cancel|forget"}  (opens a sign-in window; cookies.txt is written automatically)',
    dlCancel: '{type:"dlCancel",id}', dlClear: '{type:"dlClear"}',
    overlay: '{type:"overlay",channel,name:"nowplaying|lyrics",on:true}', channelAudio: '{type:"channelAudio",channel,on:true}  (audio capture + beat detection runs on one display)',
    bake: '{type:"bake",scene:"07"|"all"|"missing",dur?:8}  (awaits; returns file)', draft: '{type:"draft",id,source}  (OFF-AIR scene draft in web/engine/drafts; {id,remove:true} deletes; no id lists)', preview: '{type:"preview",scene:"09",draft?:true,frames?:[0,0.25,0.5,0.75],audio?:"synth|silent|quiet|loud",w?,h?}  (renders off-air in its own window; returns verdict + contact sheet path)', promote: '{type:"promote",id,title?,palette?,force?}  (draft -> real scene; needs a passing preview of the exact source)',
    snapshot: '{type:"snapshot",channel?}  (awaits; returns jpg path to Read)',
    autoscene: '{type:"autoscene",on:true,bars?:8,minSec?:10,cooldown?:30,onSong?:true,onDrop?:true,sens?:5,shuffle?:true,pool?:["02","05"]|null,channel?,mode?:"live|cached"}  (music-driven scene cuts: every N bars on the beat, on drops, on new songs)',
    bpm: '{type:"bpm",bpm:128}  (manual; turns auto off)', bpmAuto: '{type:"bpmAuto",on:true}  (follow the song tempo via Deezer)', whiteout: '{type:"whiteout",on:true}  (all lights white, displays show only a spinning 3D DAWGHOUSE; kiosks go white)', blackout: '{type:"blackout",on:true}  (also blacks out the HA kiosks)', closeParty: '{type:"closeParty"}  (close kiosk prompts, normal lights, close all displays; scenes: homeassistant.normalScenes, default scene.normal + scene.aiden_lights_normal)', lights: '{type:"lights",mode:"sync|manual|off",color?,brightness?,preset?,dynamic?}', flash: '{type:"flash",color}',
    lightshow: '{type:"lightshow",action:"put|try|play|auto|keep|rm|bind|unbind|read", show?:{...}, id?, scene?, song?}  (authored per-song/scene light programs, see docs/AGENT.md)',
    stream: '{type:"stream",channel,url:"https://youtube.com/watch?v=...|.m3u8|.mp4",sound?:false}  |  {type:"stream",channel,off:true}  (show a YouTube/HLS/video URL; remote displays can also play the hub audio via param hubAudio:true,hubVol:0-1)',
    zoneSync: '{type:"zone",action:"import",kind:"area|floor",ids?:["upstairs"]|"all"}  create/relink a zone per Home Assistant area or floor  |  {action:"sync",id?}  re-read linked zones lights from HA  (GET /api/ha-areas lists them)',
    haConnection: '{type:"haConnection",localIp:"192.168.1.50[:8123]"|""}  use Home Assistant at its LAN address instead of HA_URL (Host header = HA_URL host or HA_HOST); empty = back to HA_URL;  {type:"haConnection"} just tests',
    zone: '{type:"zone",action:"add",name,display?,lights?:[entity]}  |  update {id,name?,display?,mode?:"follow|color|off",color?,brightness?,beat?,dynamic?,preset?}  |  remove {id}  |  assign {light,zone|null}  |  flash {id}  |  apply {id?}  (a zone = lights that match the scene on one display)',
    displayLocal: '{type:"display",action:"addLocal",name,monitor:<index from GET /api/screens>,role?:"visuals|videos",follow?,fullscreen?}  |  {action:"launch|close|remove",id}  (extra windows on monitors of this PC)',
    display: '{type:"display",action:"configure",id:"remote-surface",name?,role?:"visuals|videos",follow?:"main"|null,params?:{maxH,fps}}  |  {type:"display",action:"remove",id}  (remote displays register themselves at /join.html)',
    player: '{type:"player",action:"play|pause|next|prev|seek|volume|shuffle|repeat",ms?,percent?,on?,mode?}',
  },
  http: { 'POST /api/scene': '{id,title,palette,source} write+register+hot-reload a scene (syntax-checked); {id,remove:true} deletes it', 'POST /api/report': 'display/baker -> scene status', 'GET /api/state': 'state incl. sceneStatus errors', 'POST /api/launch': 'open the display windows' },
};
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `oneparty could not start: port ${PORT} became occupied. Retry, or use --port ${PORT + 1}.`
    : `oneparty could not listen on ${HOST}:${PORT}: ${error.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  contest.start();
  console.log(`oneparty: ${KIOSK ? 'KIOSK (fullscreen)' : 'dev (windowed)'} "${event.title}" [${slug}] on http://127.0.0.1:${PORT}  (control: /control.html)`);
  if (HOST !== '127.0.0.1') { const u = lanUrls(PORT); console.log('  LAN: other devices open ' + (u[0] ? u[0].url + '/join.html' : 'http://<this-pc-ip>:' + PORT + '/join.html') + (u.length > 1 ? '   (also: ' + u.slice(1).map(x => x.url).join(', ') + ')' : '')); }
  else console.log('  LAN: off (this hub only answers on 127.0.0.1). Restart with --lan to let a Surface/other screens join.');
  console.log(`  spotify: ${spotify.enabled ? (spotify.authed ? 'connected' : `not connected - open http://127.0.0.1:${PORT}/auth/spotify/login`) : 'disabled (no SPOTIFY_CLIENT_ID)'}`);
  console.log(`  home assistant: ${ha.enabled ? 'configured' : 'disabled (no HA_URL/HA_TOKEN)'}${groups.length ? ` - profile "${profile}": ${groups.map(g => g.name + ' x' + g.entities.length).join(', ')}` : ''}`);
  spotify.start();
  if (state.kiosks.lastCommand?.on) setTimeout(() => refreshKioskDashboard().catch(e => console.error('[kiosk dashboard]', e.message)), 500);
  if (flag('launch')) setTimeout(() => launchDisplays(), 500);
  // Restored settings only set state: with lights on sync/auto, start the show again instead of waiting for the next scene change.
  if (ha.enabled && state.lights.mode === 'sync' && !state.takeover) setTimeout(() => { if (state.lights.mode === 'sync' && !state.takeover) lightsDone('resume', applyLights(Object.values(state.channels)[0]?.scene)); }, 3000);
});
// ---------- audio stream to remote displays (raw PCM over HTTP; the helper only runs while someone listens) ----------
const audioStream = createAudioStream({ getDevice: () => state.audioDevice, onChange: () => broadcast('state', publicState()) });
// ---------- audio: the hub itself loops back the Windows output (no browser involved) ----------
const capture = createAudioCapture({
  onAudio,
  onStatus: s => { state.audioStatus = { channel: 'hub', ...s, at: Date.now() }; broadcast('state', publicState()); },
});
if (!flag('browser-audio') && event.audioMode !== 'browser') {
  setTimeout(() => { state.audioDevices = listOutputs(); capture.start(state.audioDevice); }, 300);
} else state.audioMode = 'browser';
process.on('SIGINT', () => { capture.stop(); closeAll(); process.exit(0); });
