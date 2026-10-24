#!/usr/bin/env node
// MCP server for the oneparty hub: lets an AI read the song/lyrics/audio and author, show, bake and switch scenes, lights and playback.
// stdio transport; talks to the running hub over HTTP (ONEPARTY_URL, default http://127.0.0.1:8787). Registered in .mcp.json.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = process.env.ONEPARTY_URL || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (p, body) => {
  let r;
  try { r = await fetch(BASE + p, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }); }
  catch { throw new Error(`hub not reachable at ${BASE} - start it with: npm start (or npm run party)`); }
  return r.status === 204 ? {} : r.json();
};
const cmd = b => api('/api/cmd', b);
const text = o => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }], isError: !!(o && typeof o === 'object' && (o.error || o.ok === false)) });
const tool = (name, description, shape, fn) => server.registerTool(name, { description, inputSchema: shape }, async args => {
  try { return await fn(args); } catch (e) { return text({ error: e.message }); }
});

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
  return { ok: false, scene: id, error: `no display reported for channel "${ch}" - is a window open? (launch_displays)` };
}

// Sample the live audio features (bass/mid/high/beat/bpm) from the SSE bus for a moment.
async function sampleAudio(ms) {
  const ac = new AbortController(), samples = [];
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(BASE + '/api/events', { signal: ac.signal });
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        if (/^event: audio$/m.test(block)) { const d = block.match(/^data: (.*)$/m); if (d) try { samples.push(JSON.parse(d[1])); } catch { /* partial */ } }
      }
    }
  } catch (e) { if (e.name !== 'AbortError') throw e; } finally { clearTimeout(timer); }
  return samples;
}

const server = new McpServer({ name: 'oneparty', version: '0.1.0' });

tool('state', 'Summary of the whole hub: now playing, channels (what each display shows), scenes ([baked]/[ERROR]), lights, audio capture status, downloads. Call this first.', {}, async () => {
  const s = await api('/api/state'), cached = await api('/api/cache');
  return text({
    event: s.event?.title, mode: s.kiosk ? 'kiosk' : 'dev', bpm: s.bpm, blackout: s.blackout, whiteout: s.whiteout, takeover: s.takeover,
    track: s.track && { title: s.track.title, artists: s.track.artists, playing: s.track.playing, progressMs: s.track.progressMs, durationMs: s.track.durationMs },
    channels: s.channels,
    scenes: s.scenes.map(x => ({ id: x.id, title: x.title, baked: cached.includes(x.id + '.webm'), error: s.sceneStatus[x.id]?.ok === false ? s.sceneStatus[x.id].error : undefined })),
    audio: { status: s.audioStatus, device: s.audioDevice },
    lights: { ...s.lights, lightshows: s.lightshows }, downloads: s.downloads, gpu: s.gpu, hud: s.hudStatus,
  });
});

tool('now_playing', 'The current Spotify track plus its lyrics. For synced lyrics also returns the line being sung right now and the next one.', {}, async () => {
  const s = await api('/api/state'), t = s.track;
  if (!t) return text({ track: null, note: 'nothing playing (or Spotify not connected)' });
  const pos = t.progressMs + (t.playing ? Date.now() - t.at : 0), L = s.lyrics;
  let current = null, next = null;
  if (L?.synced) { const i = L.lines.findLastIndex(l => l.t <= pos); current = L.lines[i]?.text ?? null; next = L.lines[i + 1]?.text ?? null; }
  return text({ track: { id: t.id, title: t.title, artists: t.artists, album: t.album, playing: t.playing, positionMs: Math.round(pos), durationMs: t.durationMs, volume: t.volume }, bpm: s.bpm, bpmInfo: s.bpmInfo, lyrics: L ? { synced: L.synced, current, next, lines: L.lines } : null, queue: s.queue });
});

tool('queue_lyrics', 'Lyrics for the upcoming songs in the Spotify queue (title, artists, and synced or plain lines, or null if none found). Use it to prepare scenes/lights for what plays next.', { limit: z.number().int().min(1).max(15).default(5) }, async ({ limit }) => text(await api('/api/queue-lyrics?limit=' + limit)));

tool('audio_levels', 'Sample the live audio analysis for a moment: bass/mid/high/level (0-1), beat flags and tempo. Use it to check the visuals have a signal and what the music is doing.', { seconds: z.number().min(0.3).max(10).default(1.5) }, async ({ seconds }) => {
  const a = await sampleAudio(seconds * 1000);
  if (!a.length) return text({ error: 'no audio events received - capture is off or silent', hint: 'check state.audio and audio_devices' });
  const avg = k => +(a.reduce((x, s) => x + (s[k] || 0), 0) / a.length).toFixed(3), last = a[a.length - 1];
  return text({ samples: a.length, avg: { bass: avg('bass'), mid: avg('mid'), high: avg('high'), level: avg('level') }, peakBass: Math.max(...a.map(s => s.bass || 0)), beats: a.filter(s => s.beat).length, bpm: last.bpm, last });
});

tool('audio_devices', 'List Windows output devices the hub can loop back for audio reactivity, and which one is selected.', {}, async () => {
  const s = await api('/api/state');
  return text({ selected: s.audioDevice, status: s.audioStatus, devices: s.audioDevices });
});
tool('set_audio_device', 'Choose which Windows OUTPUT device the hub loops back for reactivity (name fragment e.g. "Voicemeeter Input", or null for the Windows default).', { device: z.string().nullable() }, async ({ device }) => text(await cmd({ type: 'audioDevice', device })));

tool('list_scenes', 'List scene ids/titles/baked status. Existing scene source lives in web/engine/scenes/<id>.js; tools/scene-template.js is the starting point.', {}, async () => {
  const s = await api('/api/state'), cached = await api('/api/cache');
  return text(s.scenes.map(x => ({ ...x, baked: cached.includes(x.id + '.webm'), error: s.sceneStatus[x.id]?.ok === false ? s.sceneStatus[x.id].error : undefined })));
});
const HYPE = z.object({ busy: z.number().min(0).max(10).describe('how much is going on at once: objects, particles, lights, dancers'), jumpy: z.number().min(0).max(10).describe('how hard it snaps to the beat: shake, hops, flashes, strobes') }).optional()
  .describe('REQUIRED for a new scene (kept on rewrites). 0-10 each, score = mean. 2-3 calm/ambient, 5 mid, 7-8 busy party, 9-10 rave. Auto-scene starts scenes whose score matches the music hype.');
tool('write_scene', 'Create or replace a three.js scene DIRECTLY (hot-reloads; if it is on a display it changes on air at once - prefer draft_scene + preview_scene + promote_scene). Pass the JS source inline or a file path. Optionally show it right away; build errors are returned.', {
  id: z.string(), source: z.string().optional(), file: z.string().optional().describe('path to a .js scene file, instead of source'),
  title: z.string().optional(), palette: z.array(z.string()).optional().describe('3 hex colours, used for lights'), hype: HYPE, show: z.boolean().default(false), channel: z.string().default('main'),
}, async ({ id, source, file, title, palette, hype, show: doShow, channel }) => {
  if (!source && !file) return text({ error: 'give source or file' });
  const r = await api('/api/scene', { id, source: source ?? fs.readFileSync(file, 'utf8'), title, palette, hype });
  return text(r.error || !doShow ? r : { ...r, show: await show(id, channel) });
});
tool('draft_scene', 'Write a scene as an OFF-AIR draft: syntax-checked and saved to web/engine/drafts/<id>.js, never shown on any display and not in the scene list. Use this to author in the background. Then preview_scene, then promote_scene.', {
  id: z.string(), source: z.string().optional(), file: z.string().optional().describe('path to a .js scene file, instead of source'),
}, async ({ id, source, file }) => {
  if (!source && !file) return text({ error: 'give source or file' });
  return text(await cmd({ type: 'draft', id, source: source ?? fs.readFileSync(file, 'utf8') }));
});
tool('list_drafts', 'List off-air drafts and whether the current source has passed a preview.', {}, async () => text(await cmd({ type: 'draft' })));
tool('delete_draft', 'Delete an off-air draft.', { id: z.string() }, async ({ id }) => text(await cmd({ type: 'draft', id, remove: true })));
tool('preview_scene', 'VERIFY a scene before it goes on air. Renders a draft (or an existing scene with draft:false) in its own hidden-ish window, never on a display channel. Returns a pass/warn/fail verdict (build errors, console errors, blank frames, blown-out frames, static scene, loop seam, ms per frame) plus a contact sheet image of several loop positions so you can SEE it. Fix problems and re-run until verdict is pass or an acceptable warn.', {
  id: z.string(), draft: z.boolean().default(true), frames: z.array(z.number().min(0).max(0.999)).max(8).optional().describe('loop positions t to render, default [0,0.25,0.5,0.75]'),
  audio: z.enum(['synth', 'silent', 'quiet', 'loud']).default('synth').describe('audio profile fed to the scene: synth = built-in beat grid (like a bake), silent/quiet/loud simulate live reactivity'),
  width: z.number().optional(), height: z.number().optional(), show_frames: z.boolean().default(false).describe('also return each frame full-size'),
}, async ({ id, draft, frames, audio, width, height, show_frames }) => {
  const r = await cmd({ type: 'preview', scene: id, draft, frames, audio, w: width, h: height });
  const content = [{ type: 'text', text: JSON.stringify({ ...r, sheetAbs: undefined }, null, 2) }];
  const add = f => { try { if (f && fs.existsSync(f)) content.push({ type: 'image', data: fs.readFileSync(f).toString('base64'), mimeType: 'image/jpeg' }); } catch { /* skip */ } };
  add(r.sheetAbs);
  if (show_frames) for (const f of r.frameFiles || []) add(fileURLToPath(new URL('../' + f, import.meta.url)));
  return { content, isError: r.verdict === 'fail' || !!r.error };
});
tool('promote_scene', 'Turn a previewed draft into a real scene (hot-reloads into the scene list; still not on air until show_scene). Refuses unless the exact draft source passed preview_scene, unless force.', {
  id: z.string(), title: z.string().optional(), palette: z.array(z.string()).optional(), hype: HYPE, force: z.boolean().default(false), show: z.boolean().default(false), channel: z.string().default('main'),
}, async ({ id, title, palette, hype, force, show: doShow, channel }) => {
  const r = await cmd({ type: 'promote', id, title, palette, hype, force });
  return text(r.error || !doShow ? r : { ...r, show: await show(id, channel) });
});
tool('delete_scene', 'Delete a scene (file, registry entry and bake).', { id: z.string() }, async ({ id }) => text(await api('/api/scene', { id, remove: true })));
tool('show_scene', 'Put a scene on a display channel and wait until it built (returns build errors). mode "cached" plays the baked loop.', { id: z.string(), channel: z.string().default('main'), mode: z.enum(['live', 'cached']).default('live') }, async ({ id, channel, mode }) => text(await show(id, channel, mode)));
tool('snapshot', 'Screenshot a display channel\'s live canvas and return it as an image so you can see what the scene looks like.', { channel: z.string().default('main') }, async ({ channel }) => {
  const r = await cmd({ type: 'snapshot', channel });
  const f = r.abs || r.path || r.file;
  if (!f || !fs.existsSync(f)) return text(r);
  return { content: [{ type: 'image', data: fs.readFileSync(f).toString('base64'), mimeType: 'image/jpeg' }, { type: 'text', text: JSON.stringify(r) }] };
});
tool('bake', 'Render a scene (or "all"/"missing") to a looping video for smooth playback.', { scene: z.string().default('missing'), seconds: z.number().optional() }, async ({ scene, seconds }) => text(await cmd({ type: 'bake', scene, dur: seconds })));

tool('player', 'Spotify playback control.', { action: z.enum(['play', 'pause', 'next', 'prev', 'volume']), percent: z.number().min(0).max(100).optional() }, async ({ action, percent }) => text(await cmd({ type: 'player', action, percent })));
tool('lights', 'Home Assistant lights: apply a preset by name/uuid, a colour, turn off, or toggle the dynamic preset loop.', {
  preset: z.string().optional(), color: z.string().optional().describe('#rrggbb'), off: z.boolean().optional(), loop: z.boolean().optional(),
}, async ({ preset, color, off, loop }) => {
  if (color) return text(await cmd({ type: 'lights', color }));
  if (off) return text(await cmd({ type: 'lights', mode: 'off' }));
  if (loop !== undefined) return text(await cmd({ type: 'lights', dynamic: loop }));
  return text(await cmd({ type: 'lights', preset: preset || null, apply: true }));
});
tool('lightshow', 'Authored light shows (see docs/AGENT.md "Light shows"). actions: put/try take `show`; play/rm/keep take `id`; bind takes id + scene and/or song; unbind; auto; read; list.', {
  action: z.enum(['list', 'put', 'try', 'play', 'rm', 'auto', 'keep', 'read', 'bind', 'unbind']),
  show: z.any().optional(), id: z.string().optional(), scene: z.string().optional(), song: z.union([z.boolean(), z.string()]).optional(), play: z.boolean().optional(), label: z.string().optional(),
}, async ({ action, ...rest }) => action === 'list' ? text((await api('/api/state')).lightshows) : text(await cmd({ type: 'lightshow', action, ...rest })));

tool('download', 'Queue video downloads (YouTube etc) into the event media folder for the video channels. Optional "url @ 1:20-2:10" clipping.', { urls: z.array(z.string()), start: z.string().optional(), end: z.string().optional(), height: z.number().optional() }, async a => text(await cmd({ type: 'dlAdd', ...a })));
tool('launch_displays', 'Open the display windows (existing ones are reused).', { force: z.boolean().default(false) }, async ({ force }) => text(await api('/api/launch', { force })));
tool('list_displays', 'List every display (this PC and remote devices that joined via /join.html): type, online, scene/mode, stream, hub-audio setting, plus the LAN join URLs.', {}, async () => {
  const s = await api('/api/state');
  return text({ join: s.network?.lan ? s.network.urls.filter(u => !u.virtual).map(u => u.url + '/join.html') : 'LAN off - restart the hub with --lan', audioListeners: s.audioListeners,
    displays: Object.entries(s.channels).filter(([, c]) => c.role !== 'control').map(([id, c]) => ({ id, name: c.name || id, remote: !!c.remote, online: c.online, role: c.role, mirrors: c.follow || undefined, scene: c.scene, mode: c.mode, stream: c.mode === 'stream' ? c.params.stream : undefined, hubAudio: !!c.params.hubAudio, quality: c.remote ? { maxH: c.params.maxH, fps: c.params.fps } : undefined })) });
});
tool('configure_display', 'Change a remote display: name, type (visuals|videos), mirror another display, quality, play-the-hub-audio on/off + volume, or remove it.', {
  id: z.string(), name: z.string().optional(), role: z.enum(['visuals', 'videos']).optional(), follow: z.string().nullable().optional().describe('channel id to mirror, or null to stop mirroring'),
  maxH: z.number().optional(), fps: z.number().optional(), hubAudio: z.boolean().optional(), hubVol: z.number().min(0).max(1).optional(), hubBuffer: z.number().min(0.3).max(15).optional().describe('seconds of audio delay/buffer behind the hub (default 3)'), remove: z.boolean().optional(),
}, async ({ id, remove, hubAudio, hubVol, hubBuffer, maxH, fps, ...cfg }) => {
  if (remove) return text(await cmd({ type: 'display', action: 'remove', id }));
  const out = {};
  const params = { ...(maxH && { maxH }), ...(fps && { fps }) };
  if (Object.keys(cfg).length || Object.keys(params).length) out.configure = await cmd({ type: 'display', action: 'configure', id, ...cfg, ...(Object.keys(params).length && { params }) });
  if (hubAudio !== undefined) out.hubAudio = await cmd({ type: 'param', channel: id, key: 'hubAudio', value: hubAudio });
  if (hubBuffer !== undefined) out.hubBuffer = await cmd({ type: 'param', channel: id, key: 'hubBuffer', value: hubBuffer });
  if (hubVol !== undefined) out.hubVol = await cmd({ type: 'param', channel: id, key: 'hubVol', value: hubVol });
  return text(out);
});
tool('list_monitors', 'The monitors of the PC running the hub (index, size, primary), for add_monitor.', {}, async () => text(await api('/api/screens')));
tool('add_monitor', 'Open a new display window on one of the hub PC\'s monitors as its own display (own scene, overlays, audio). Remove it with configure_display remove:true.', {
  name: z.string(), monitor: z.number().describe('index from list_monitors'), role: z.enum(['visuals', 'videos']).default('visuals'), follow: z.string().optional().describe('channel id to mirror instead'), fullscreen: z.boolean().optional(),
}, async ({ name, monitor, role, follow, fullscreen }) => text(await cmd({ type: 'display', action: 'addLocal', name, monitor, ...(follow ? { follow } : { role }), ...(fullscreen !== undefined && { fullscreen }) })));
tool('set_display_overlays', 'Choose which overlays a display shows: nowplaying, lyrics, bubbles, announcements, motion. lyricsOffsetMs nudges lyric timing.', {
  channel: z.string(), overlays: z.array(z.enum(['nowplaying', 'lyrics', 'bubbles', 'announcements', 'motion'])), lyricsOffsetMs: z.number().optional(),
}, async ({ channel, overlays, lyricsOffsetMs }) => text({ overlays: await cmd({ type: 'overlays', channel, overlays }), ...(lyricsOffsetMs !== undefined && { lyricsOffset: await cmd({ type: 'param', channel, key: 'lyricsOffset', value: lyricsOffsetMs }) }) }));
tool('set_display_audio', 'Audio sent to a display: on/off, volume (0-1), delay in seconds (buffer), which hub capture/Windows output it gets (source, a device name fragment; empty = the analysis source) and, for local monitors, which sound device it plays through (sink = a browser device id from list_displays audioOutputs).', {
  channel: z.string(), on: z.boolean().optional(), volume: z.number().min(0).max(1).optional(), delaySeconds: z.number().min(0.3).max(15).optional(), source: z.string().optional(), sink: z.string().optional(),
}, async ({ channel, on, volume, delaySeconds, source, sink }) => {
  const set = (key, value) => cmd({ type: 'param', channel, key, value });
  const out = {};
  if (on !== undefined) out.on = await set('hubAudio', on);
  if (volume !== undefined) out.volume = await set('hubVol', volume);
  if (delaySeconds !== undefined) out.delay = await set('hubBuffer', delaySeconds);
  if (source !== undefined) out.source = await set('hubSource', source);
  if (sink !== undefined) out.sink = await set('hubSink', sink);
  return text(out);
});
tool('stream_display', 'Show a YouTube video, the current live stream of a YouTube channel (youtube.com/@name/live), an .m3u8 (HLS) or a video URL on a display. off:true returns it to scenes. sound:true needs one tap on that device to unmute.', {
  channel: z.string(), url: z.string().optional(), sound: z.boolean().default(false), off: z.boolean().default(false), via: z.enum(['hub', 'embed']).default('hub').describe('hub = yt-dlp + ffmpeg on the hub PC, the tab plays the result (default); embed = YouTube player in the tab'),
}, async ({ channel, url, sound, off, via }) => text(off ? await cmd({ type: 'stream', channel, off: true }) : await cmd({ type: 'stream', channel, url, sound, via })));
tool('list_zones', 'Lighting zones: each ties a set of lights to one display so the lights match that display\'s scene. Returns zones, their status, and every light with the zone it belongs to.', {}, async () => {
  const s = await api('/api/state');
  return text({ zones: s.zones.map(z => ({ ...z, status: s.zoneStatus?.[z.id] })), lights: s.ha.baseGroups.map(g => ({ group: g.name, kind: g.kind, lights: g.entities.map(e => ({ id: e, zone: s.zones.find(z => z.lights.includes(e))?.id || null })) })) });
});
tool('configure_zone', 'Create, change or delete a lighting zone, or move lights between zones. action: add (name, display, lights) | update (id + fields) | remove | assign (light, zone or null for global) | flash (identify the zone) .', {
  action: z.enum(['add', 'update', 'remove', 'assign', 'flash', 'import', 'sync']), kind: z.enum(['area', 'floor']).optional().describe('import: create a zone per Home Assistant area or floor'), ids: z.union([z.array(z.string()), z.literal('all')]).optional(), id: z.string().optional(), name: z.string().optional(), display: z.string().optional().describe('display/channel id whose scene the zone matches'),
  lights: z.array(z.string()).optional(), light: z.string().optional(), zone: z.string().nullable().optional(), mode: z.enum(['follow', 'color', 'off']).optional(), color: z.string().optional(),
  brightness: z.number().min(1).max(255).optional(), beat: z.boolean().optional(), dynamic: z.boolean().nullable().optional(), preset: z.string().nullable().optional(),
}, async args => text(await cmd({ type: 'zone', ...args })));
tool('command', 'Raw hub command (escape hatch). Use `help` to see every command shape.', { command: z.record(z.any()) }, async ({ command }) => text(await cmd(command)));
tool('help', 'List every hub command and its JSON shape.', {}, async () => text(await api('/api/help')));

await server.connect(new StdioServerTransport());
