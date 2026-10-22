// YouTube (and anything yt-dlp understands) streamed THROUGH the hub: yt-dlp finds the media, ffmpeg remuxes it (no re-encode) into a
// fragmented MP4 that any display tab plays with a plain <video src="/api/ytstream?url=...">. Works for live streams and normal videos, needs no
// embed permission, and uses the hub's cookies.txt when YouTube asks for a sign-in. Runs on the host, so remote tabs only need to reach the hub.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const COOKIES_FILE = path.join(ROOT, 'cookies.txt');
const cookieArgs = () => (fs.existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : []);
const friendly = e => /Sign in to confirm|not a bot/i.test(e) ? 'YouTube wants a sign-in: sign in under Media > YouTube (cookies.txt)'
  : /not available|Video unavailable|private/i.test(e) ? 'That video is unavailable or private'
  : /is not a valid URL|Unsupported URL/i.test(e) ? 'yt-dlp does not recognise that link'
  : e.trim().split(/\r?\n/).pop().slice(0, 200);
const cache = new Map();   // "url|height" -> { at, info }   direct media URLs expire, so keep them only briefly

const run = (cmd, args, ms) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { windowsHide: true });
  let out = '', err = ''; const t = setTimeout(() => { p.kill(); reject(new Error('timed out')); }, ms);
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
  p.on('error', e => { clearTimeout(t); reject(new Error(e.code === 'ENOENT' ? cmd + ' not found - run: npm run doctor' : e.message)); });
  p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(friendly(err || 'exit ' + code))); });
});

/** Ask yt-dlp for the direct media URLs + title + whether it is live. Cached for 4 minutes. */
export async function probe(url, height = 1080) {
  const key = url + '|' + height, hit = cache.get(key);
  if (hit && Date.now() - hit.at < 240000) return hit.info;
  // h264 + aac first (plays everywhere without transcoding), then anything that is a single stream
  const fmt = `bv*[vcodec^=avc1][height<=${height}]+ba[acodec^=mp4a]/b[vcodec^=avc1][height<=${height}]/b[height<=${height}]/b`;
  const out = await run('yt-dlp', ['--no-playlist', '--no-warnings', '-f', fmt, '--print', '%(title)s', '--print', '%(is_live)s', '-g', ...cookieArgs(), url], 45000);
  const lines = out.split(/\r?\n/).filter(Boolean);
  const info = { title: lines[0] || url, live: lines[1] === 'True', urls: lines.slice(2).filter(l => /^https?:/.test(l)) };
  if (!info.urls.length) throw new Error('yt-dlp found no playable stream');
  cache.set(key, { at: Date.now(), info });
  return info;
}

export function youtubeAudioUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      !/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/.test(url.hostname)) {
    throw new Error('Paste a YouTube video or live stream link.');
  }
  return url.href;
}

/** Audio-only extraction: no video download or virtual audio routing needed. */
export async function probeAudio(url) {
  const key = url + '|audio', hit = cache.get(key);
  if (hit && Date.now() - hit.at < 240000) return hit.info;
  const out = await run('yt-dlp', ['--no-playlist', '--no-warnings', '-f', 'bestaudio/best',
    '--print', '%(title)s', '--print', '%(is_live)s', '-g', ...cookieArgs(), url], 45000);
  const lines = out.split(/\r?\n/).filter(Boolean);
  const info = { title: lines[0] || url, live: lines[1] === 'True', url: lines.slice(2).find(l => /^https?:/.test(l)) };
  if (!info.url) throw new Error('YouTube returned no playable audio.');
  cache.set(key, { at: Date.now(), info });
  return info;
}

export async function serveAudio(req, res, url, { probe = probeAudio, spawnProcess = spawn } = {}) {
  let ff, download, closed = false, started = false;
  const stop = () => { closed = true; download?.kill(); ff?.kill(); };
  res.on('close', stop);
  const fail = message => {
    if (closed) return;
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: message }));
    } else res.destroy();
  };
  try {
    const info = await probe(url);
    if (closed || res.destroyed) return;
    // Let yt-dlp transfer media too: its headers and chunked downloader are needed for some YouTube URLs.
    // Feeding a pipe to ffmpeg starts playback without waiting for a complete long video or writing a file.
    download = spawnProcess('yt-dlp', ['--no-playlist', '--no-progress', '--quiet', '--no-warnings',
      '-f', 'bestaudio/best', '-o', '-', ...cookieArgs(), url], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    ff = spawnProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error',
      '-readrate', '1', '-readrate_initial_burst', '5', '-i', 'pipe:0', '-vn', '-map', '0:a:0',
      '-c:a', 'libmp3lame', '-b:a', '192k', '-flush_packets', '1', '-write_xing', '0',
      '-f', 'mp3', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let err = '';
    download.stderr.on('data', d => { err = (err + d).slice(-4000); });
    ff.stderr.on('data', d => { err = (err + d).slice(-4000); });
    download.on('error', e => { fail(e.code === 'ENOENT' ? 'yt-dlp not found - run: npm run doctor' : e.message); stop(); });
    download.on('close', code => { if (code && !closed) { fail(friendly(err || 'YouTube audio download failed.')); stop(); } });
    ff.stdin.on('error', () => {}); // Closing/stopping a player can close ffmpeg's input while yt-dlp is still writing.
    download.stdout.pipe(ff.stdin);
    ff.on('error', e => fail(e.code === 'ENOENT' ? 'ffmpeg not found - run: npm run doctor' : e.message));
    // Wait for actual media before reporting success, so startup failures reach the player.
    ff.stdout.once('data', chunk => {
      if (closed) return;
      started = true;
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      res.write(chunk); ff.stdout.pipe(res);
    });
    ff.on('close', code => {
      if (closed) return;
      if (code || !started) fail(friendly(err || 'YouTube audio stopped before playback.'));
      else res.end();
      download?.kill();
    });
  } catch (e) { fail(e.message); }
}

/** GET /api/ytstream?url=&h= : pipe the remuxed stream to the response. */
export async function serve(req, res, url, height = 1080) {
  let info;
  try { info = await probe(url, height); }
  catch (e) { res.writeHead(502, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
  const inputs = info.urls.flatMap(u => ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', u]);
  const maps = info.urls.length === 2 ? ['-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0?', '-map', '0:a:0?'];
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-fflags', '+genpts', ...inputs, ...maps, '-c', 'copy', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let err = '';
  ff.stderr.on('data', d => { err += d; });
  ff.on('error', e => { if (!res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.code === 'ENOENT' ? 'ffmpeg not found - run: npm run doctor' : e.message })); } });
  res.writeHead(200, { 'content-type': 'video/mp4', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  ff.stdout.pipe(res);
  ff.on('close', code => { if (code && err) console.error('[ytstream]', friendly(err)); res.end(); });
  const stop = () => { try { ff.kill(); } catch { /* gone */ } };
  req.on('close', stop); res.on('close', stop);
}
