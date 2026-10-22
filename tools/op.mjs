#!/usr/bin/env node
// Operator CLI for a running hub - the one-liner interface for agent loops (and humans).
//   node tools/op.mjs state                         summary: now playing, channels, scenes (baked?), light status, errors
//   node tools/op.mjs new <id> <file> --busy N --jumpy N [--title T] [--palette #a,#b,#c] [--show]   write/replace a scene (hype score required when new) (hot reloads)
//   node tools/op.mjs rm <id>                       delete a scene (file, registry, bake)
//   node tools/op.mjs show <id> [--ch main] [--cached]   put a scene on a channel and wait until it built (prints errors)
//   node tools/op.mjs snap [--ch main]              screenshot the live canvas -> prints a .jpg path (Read it)
//   node tools/op.mjs bake <id|all|missing> [--dur 8]
//   node tools/op.mjs lights <preset name|uuid>|off|loop|still|--color #rrggbb
//   node tools/op.mjs lightshow list|put <file.json> [--play]|try <file.json>|play <id>|auto|keep [id]|rm <id>|read|bind <id> [--scene 08] [--song]|unbind [--scene 08] [--song]   authored custom lighting (docs/AGENT.md)
//   node tools/op.mjs play|pause|next|prev|vol <0-100>
//   node tools/op.mjs autoscene on|off [--bars 8 --min 10 --pool 02,05 --ordered --no-drop --no-song --cached]   music-driven scene cuts
//   node tools/op.mjs dl <url ...> [--start 1:20 --end 2:10] [--playlist all|first --first 5] [--height 1080] [--cookies auto|none|file|firefox|brave|edge|chrome]   queue downloads (url @ 1:20-2:10 also works)
//   node tools/op.mjs ytlogin [cancel|forget]       open the YouTube sign-in window (cookies captured automatically)
//   node tools/op.mjs launch [--force]              open the display windows (existing ones are reused; --force replaces)
//   node tools/op.mjs cmd '<json>'                  raw command (see GET /api/help)
import fs from 'node:fs';

const BASE = process.env.ONEPARTY_URL || 'http://127.0.0.1:8787';
const [verb, ...rest] = process.argv.slice(2);
const flags = {}, pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const nx = rest[i + 1]; if (nx && !nx.startsWith('--')) { flags[k] = nx; i++; } else flags[k] = true; } else pos.push(rest[i]); }

const api = async (p, body) => {
  let r;
  try { r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }); }
  catch { console.error(`hub not reachable at ${BASE} - start it with: npm start`); process.exit(2); }
  return r.status === 204 ? {} : r.json();
};
const cmd = b => api('/api/cmd', b);
const out = o => { console.log(typeof o === 'string' ? o : JSON.stringify(o, null, 2)); if (o?.error || o?.ok === false) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function show(id, ch = 'main', mode = 'live') {
  const t0 = Date.now(), before = await api('/api/state');
  const same = before.channels[ch]?.scene === id && before.channels[ch]?.mode === mode && before.sceneStatus?.[id];   // already showing: display won't re-report
  if (same) { await cmd({ type: 'scene', channel: ch, scene: id, mode }); return same.ok ? { ok: true, scene: id, channel: ch, note: 'already showing' } : { ok: false, scene: id, error: same.error }; }
  const r = await cmd({ type: 'scene', channel: ch, scene: id, mode });
  if (r.error) return r;
  for (let i = 0; i < 30; i++) {            // wait for the display to report build ok/error
    await sleep(500);
    const st = (await api('/api/state')).sceneStatus?.[id];
    if (st && st.at >= t0) return st.ok ? { ok: true, scene: id, channel: ch } : { ok: false, scene: id, error: st.error };
  }
  return { ok: false, scene: id, error: `no display reported for channel "${ch}" - is a window open? (node tools/op.mjs launch)` };
}

switch (verb) {
  case 'state': {
    const s = await api('/api/state'), cached = await api('/api/cache');
    out({
      mode: s.kiosk ? 'kiosk' : 'dev', track: s.track && `${s.track.title} - ${s.track.artists.join(', ')} ${s.track.playing ? '(playing)' : '(paused)'}`,
      channels: Object.fromEntries(Object.entries(s.channels).map(([k, c]) => [k, `${c.role} scene=${c.scene} mode=${c.mode}`])),
      scenes: s.scenes.map(x => `${x.id} ${x.title}${cached.includes(x.id + '.webm') ? ' [baked]' : ''}${s.sceneStatus[x.id]?.ok === false ? ' [ERROR: ' + s.sceneStatus[x.id].error.split('\n')[0] + ']' : ''}`),
      downloads: (s.downloads || []).map(d => `#${d.id} ${d.status}${d.status === 'downloading' ? ' ' + Math.round(d.pct) + '%' : ''} ${d.url}${d.error ? ' - ' + d.error : ''}`),
      gpu: s.gpu, audio: s.audioStatus, hud: s.hudStatus,
      lightshow: { running: s.lightshows?.running, pinned: s.lights.pin, scenes: s.lightshows?.scenes, songs: Object.fromEntries(Object.entries(s.lightshows?.songs || {}).map(([k, v]) => [v.label || k, v.show])), shows: Object.keys(s.lightshows?.shows || {}) },
      lights: { mode: s.lights.mode, preset: s.lights.preset, loop: s.lights.dynamic, last: s.lights.last, scenePresets: s.ha.scenePresets }, spotify: s.spotify,
    }); break; }
  case 'new': {
    const [id, file] = pos; if (!id || !file) { console.error('usage: new <id> <file.js> --busy 0-10 --jumpy 0-10 [--title T] [--palette #a,#b] [--show]'); process.exit(1); }
    const r = await api('/api/scene', { id, source: fs.readFileSync(file, 'utf8'), title: flags.title, palette: flags.palette?.split(','), hype: flags.busy != null || flags.jumpy != null ? { busy: +flags.busy, jumpy: +flags.jumpy } : flags.hype != null ? +flags.hype : undefined });
    out(r.error || !flags.show ? r : { ...r, show: await show(id, flags.ch) }); break; }
  case 'rm': out(await api('/api/scene', { id: pos[0], remove: true })); break;
  case 'show': out(await show(pos[0], flags.ch, flags.cached ? 'cached' : 'live')); break;
  case 'snap': out(await cmd({ type: 'snapshot', channel: flags.ch })); break;
  case 'bake': out(await cmd({ type: 'bake', scene: pos[0] || 'missing', dur: flags.dur && +flags.dur })); break;
  case 'lights':
    if (flags.color) out(await cmd({ type: 'lights', color: flags.color }));
    else if (pos[0] === 'off') out(await cmd({ type: 'lights', mode: 'off' }));
    else if (pos[0] === 'loop' || pos[0] === 'still') out(await cmd({ type: 'lights', dynamic: pos[0] === 'loop' }));
    else out(await cmd({ type: 'lights', preset: pos.join(' ') || null, apply: true }));
    break;
  case 'lightshow': {
    const [act, arg] = pos, readShow = f => JSON.parse(fs.readFileSync(f, 'utf8'));
    if (act === 'list') { const s = await api('/api/state'); out(s.lightshows); }
    else if (act === 'put') out(await cmd({ type: 'lightshow', action: 'put', show: readShow(arg), play: !!flags.play }));
    else if (act === 'try') out(await cmd({ type: 'lightshow', action: 'try', show: readShow(arg) }));
    else if (act === 'play' || act === 'rm') out(await cmd({ type: 'lightshow', action: act, id: arg }));
    else if (act === 'auto' || act === 'read' || act === 'keep') out(await cmd({ type: 'lightshow', action: act, id: arg }));
    else if (act === 'bind') out(await cmd({ type: 'lightshow', action: 'bind', id: arg, scene: flags.scene, song: flags.song === true ? true : flags.song, label: flags.label }));
    else if (act === 'unbind') out(await cmd({ type: 'lightshow', action: 'unbind', scene: flags.scene, song: flags.song === true ? true : flags.song }));
    else { console.error('usage: lightshow list|put <file>|try <file>|play <id>|auto|rm <id>|read|bind <id> [--scene 08] [--song]|unbind'); process.exit(1); }
    break; }
  case 'play': case 'pause': case 'next': case 'prev': out(await cmd({ type: 'player', action: verb })); break;
  case 'autoscene': {   // autoscene on|off [--bars 8 --min 10 --pool 02,05 --ordered --no-drop --no-song --cached]
    const c = { type: 'autoscene' }; if (pos[0]) c.on = pos[0] !== 'off';
    if (flags.bars) c.bars = +flags.bars; if (flags.min) c.minSec = +flags.min; if (flags.pool) c.pool = String(flags.pool).split(',');
    if (flags.ordered) c.shuffle = false; if (flags['no-drop']) c.onDrop = false; if (flags['no-song']) c.onSong = false; if (flags.cached) c.mode = 'cached';
    out(await cmd(c)); break; }
  case 'vol': out(await cmd({ type: 'player', action: 'volume', percent: +pos[0] })); break;
  case 'dl': out(await cmd({ type: 'dlAdd', urls: pos, start: flags.start, end: flags.end, playlist: flags.playlist, first: flags.first, height: flags.height, cookies: flags.cookies })); break;
  case 'ytlogin': out(await cmd({ type: 'ytLogin', action: pos[0] || 'start' })); break;
  case 'launch': out(await api('/api/launch', { force: !!flags.force })); break;
  case 'cmd': out(await cmd(JSON.parse(pos.join(' ')))); break;
  default: console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
}
