#!/usr/bin/env node
// oneparty hub: static web app + SSE state bus + Spotify/lyrics/Home Assistant + display launcher.
// usage: node server/index.mjs [--event <slug>] [--launch] [--lan] [--port 8787]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, loadEnv, listEvents, loadEvent } from './env.mjs';
import { createSpotify } from './spotify.mjs';
import { getLyrics } from './lyrics.mjs';
import { createHA } from './ha.mjs';
import { detectScreens, pickScreen, launchWindow, closeAll } from './displays.mjs';

loadEnv();
const argv = process.argv.slice(2);
const flag = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const PORT = +(opt('port', process.env.PORT || 8787));
const HOST = flag('lan') ? '0.0.0.0' : '127.0.0.1';

const slug = opt('event', listEvents().at(-1));
if (!slug) { console.error('No events found. Create one with the /new-event command (see events/).'); process.exit(1); }
const event = loadEvent(slug);
const cacheDir = path.join(ROOT, 'cache', slug); fs.mkdirSync(cacheDir, { recursive: true });
const mediaDir = path.join(ROOT, 'media', slug); fs.mkdirSync(mediaDir, { recursive: true });

// ---------- state ----------
const state = {
  event: { slug, title: event.title, subtitle: event.subtitle, theme: event.theme || {} },
  scenes: event.scenes,
  channels: Object.fromEntries((event.displays || []).map(d => [d.id, { role: d.role, scene: d.scene || event.scenes[0]?.id, overlays: d.overlays || [], audio: !!d.audio, audioSource: d.audioSource, mode: d.mode || 'live', params: {} }])),
  track: null, lyrics: null, bpm: event.bpm || 120, blackout: false,
  lights: { mode: event.homeassistant?.mode || 'sync', color: null },
};
const clients = new Set();
const send = (res, type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
const broadcast = (type, data) => clients.forEach(c => send(c, type, data));

const ha = createHA({ url: process.env.HA_URL, token: process.env.HA_TOKEN });
const haCfg = event.homeassistant || {};
const sceneColor = id => state.scenes.find(s => s.id === id)?.palette?.[0];
// Light groups let slow bulbs (Kasa/Matter) and fast WLED strips behave differently. Legacy flat `lights` = one bulb group.
const profile = opt('lights', haCfg.profile);
const groups = (haCfg.profiles?.[profile] || haCfg.groups || (haCfg.lights?.length ? [{ name: 'lights', kind: 'bulb', entities: haCfg.lights }] : []))
  .map(g => ({ minGapMs: g.kind === 'wled' ? 120 : 1000, transition: g.kind === 'wled' ? 0.1 : 0.6, beat: true, ...g }));
const allLights = groups.flatMap(g => g.entities);

const spotify = createSpotify({
  clientId: process.env.SPOTIFY_CLIENT_ID, redirectUri: `http://127.0.0.1:${PORT}/auth/spotify/callback`,
  async onTrack(t) {
    const changed = (t?.id || null) !== (state.track?.id || null);
    state.track = t; 
    if (changed) { state.lyrics = null; broadcast('track', { track: t, lyrics: null }); if (t) { state.lyrics = await getLyrics(t); broadcast('track', { track: state.track, lyrics: state.lyrics }); } }
    else broadcast('progress', t);
  },
});

// ---------- commands (the single mutation path: control panel, agent, MIDI, whatever) ----------
async function command(c) {
  switch (c.type) {
    case 'scene': { const ch = state.channels[c.channel]; if (!ch) return { error: 'unknown channel' }; ch.scene = c.scene; ch.mode = c.mode || 'live';
      if (c.channel === Object.keys(state.channels)[0] && state.lights.mode === 'sync' && !state.blackout) {
        const sc = state.scenes.find(x => x.id === c.scene);
        groups.forEach(g => ha.lights(g.entities, { color: sc?.palette?.[0], brightness: haCfg.brightness, effect: g.effects?.[c.scene] }, { key: 'scene:' + g.name, minGapMs: 0 }));
      }
      break; }
    case 'mode': state.channels[c.channel].mode = c.mode; break;           // live | cached | video
    case 'param': state.channels[c.channel].params[c.key] = c.value; break;
    case 'blackout': state.blackout = !!c.on; if (allLights.length) (c.on ? ha.off(allLights) : ha.lights(allLights, { brightness: haCfg.brightness }, { minGapMs: 0 })).catch(() => {}); break;
    case 'bpm': state.bpm = +c.bpm; break;
    case 'lights': {
      Object.assign(state.lights, { mode: c.mode ?? state.lights.mode });
      if (c.color || c.brightness != null) { state.lights.color = c.color ?? state.lights.color; await ha.lights(allLights, { color: c.color, brightness: c.brightness }, { minGapMs: 0 }); }
      if (c.haScene) await ha.scene(c.haScene);
      break; }
    case 'flash': ha.lights(allLights, { color: c.color || '#ffffff', brightness: 255, transition: 0 }, { minGapMs: 0, key: 'flash' }); break;
    default: return { error: 'unknown command ' + c.type };
  }
  broadcast('state', publicState());
  return { ok: true };
}
const publicState = () => ({ ...state, ha: { enabled: ha.enabled, lights: allLights, groups: groups.map(g => ({ name: g.name, kind: g.kind, n: g.entities.length })) }, spotify: { enabled: spotify.enabled, authed: spotify.authed } });

// audio frames come from whichever display captures audio; drive lights from them
const lastBeat = new Map();
function onAudio(a) {
  broadcast('audio', a);
  if (!a.beat || state.lights.mode !== 'sync' || !groups.length || state.blackout) return;
  const main = Object.values(state.channels)[0];
  const pal = state.scenes.find(s => s.id === main?.scene)?.palette || ['#ffffff'];
  const now = Date.now(); const base = haCfg.brightness ?? 180;
  for (const g of groups) {
    if (!g.beat || now - (lastBeat.get(g.name) || 0) < g.minGapMs) continue;
    lastBeat.set(g.name, now);
    ha.lights(g.entities, { color: pal[Math.floor(Math.random() * pal.length)], brightness: Math.min(255, base + 60 * a.level), transition: g.transition }, { key: 'beat:' + g.name, minGapMs: g.minGapMs });
  }
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.otf': 'font/otf', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.png': 'image/png' };
const mounts = [['/cache/', cacheDir], ['/media/', mediaDir], ['/event/', path.join(ROOT, 'events', slug, 'assets')], ['/', path.join(ROOT, 'web')]];
const body = req => new Promise((res, rej) => { const b = []; req.on('data', d => b.push(d)); req.on('end', () => res(Buffer.concat(b))); req.on('error', rej); });
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };

function serveStatic(req, res, pathname) {
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
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      clients.add(res); req.on('close', () => clients.delete(res));
      send(res, 'state', publicState()); if (state.track) send(res, 'track', { track: state.track, lyrics: state.lyrics });
      return;
    }
    if (p === '/api/state') return json(res, 200, publicState());
    if (p === '/api/cmd' && req.method === 'POST') return json(res, 200, await command(JSON.parse((await body(req)).toString())));
    if (p === '/api/audio' && req.method === 'POST') { onAudio(JSON.parse((await body(req)).toString())); res.writeHead(204); return res.end(); }
    if (p === '/api/cache') return json(res, 200, fs.readdirSync(cacheDir).filter(f => /\.(webm|mp4)$/.test(f)));
    if (p === '/api/media') return json(res, 200, fs.readdirSync(mediaDir).filter(f => /\.(webm|mp4|mov)$/i.test(f)));
    if (p === '/api/bake' && req.method === 'POST') {   // posted by web/bake.html; body = webm bytes
      const id = (u.searchParams.get('scene') || '').replace(/[^\w-]/g, '');
      if (!id) return json(res, 400, { error: 'scene' });
      fs.writeFileSync(path.join(cacheDir, id + '.webm'), await body(req)); broadcast('cache', { scene: id });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/fetch' && req.method === 'POST') return json(res, 200, fetchVideo(JSON.parse((await body(req)).toString()).url));
    if (p === '/api/launch' && req.method === 'POST') return json(res, 200, launchDisplays());
    if (p === '/auth/spotify/login') { if (!spotify.enabled) return json(res, 400, { error: 'Set SPOTIFY_CLIENT_ID in .env' }); res.writeHead(302, { location: spotify.loginUrl() }); return res.end(); }
    if (p === '/auth/spotify/callback') { await spotify.callback(u.searchParams.get('code')); broadcast('state', publicState()); res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<h2>Spotify connected. You can close this tab.</h2>'); }
    serveStatic(req, res, p);
  } catch (e) { console.error(e); json(res, 500, { error: String(e.message || e) }); }
});

// ---------- clip download (yt-dlp) ----------
function fetchVideo(url) {
  if (!/^https?:\/\//.test(url || '')) return { error: 'need an http(s) url' };
  const args = ['-S', 'vcodec:h264,res:1080,acodec:aac', '--merge-output-format', 'mp4', '--no-playlist', '-o', path.join(mediaDir, '%(title).80s.%(ext)s'), url];
  const p = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', d => broadcast('fetch', { url, line: d.toString().trim().split('\n').pop() }));
  p.on('error', () => broadcast('fetch', { url, error: 'yt-dlp not found - run: npm run doctor' }));
  p.on('close', c => broadcast('fetch', { url, done: c === 0, error: c ? 'yt-dlp exit ' + c : null }));
  return { started: true };
}

// ---------- displays ----------
function launchDisplays() {
  const screens = detectScreens(); const used = new Set(); const out = [];
  console.log('screens:', screens.map(s => `${s.name} ${s.w}x${s.h}@${s.x},${s.y}${s.primary ? ' (primary)' : ''}`).join(' | ') || 'none detected');
  for (const d of event.displays || []) {
    const screen = pickScreen(screens, d.monitor ?? 'primary', used);
    if (screen) used.add(screen);
    const page = d.role === 'control' ? 'control.html' : 'display.html';
    const r = launchWindow({ url: `http://127.0.0.1:${PORT}/${page}?id=${d.id}`, screen, id: d.id });
    out.push({ id: d.id, role: d.role, screen: screen?.name || null, ...r });
    console.log(`  ${d.id} (${d.role}) -> ${screen ? screen.name : 'NO MATCHING MONITOR'}${r.error ? ' ERROR ' + r.error : ''}`);
  }
  return out;
}

server.listen(PORT, HOST, () => {
  console.log(`oneparty: "${event.title}" [${slug}] on http://127.0.0.1:${PORT}  (control: /control.html)`);
  console.log(`  spotify: ${spotify.enabled ? (spotify.authed ? 'connected' : `not connected - open http://127.0.0.1:${PORT}/auth/spotify/login`) : 'disabled (no SPOTIFY_CLIENT_ID)'}`);
  console.log(`  home assistant: ${ha.enabled ? 'configured' : 'disabled (no HA_URL/HA_TOKEN)'}${groups.length ? ` - profile "${profile}": ${groups.map(g => g.name + ' x' + g.entities.length).join(', ')}` : ''}`);
  spotify.start();
  if (flag('launch')) setTimeout(launchDisplays, 500);
});
process.on('SIGINT', () => { closeAll(); process.exit(0); });
