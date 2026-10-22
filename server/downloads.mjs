// Video download queue on top of yt-dlp: many links, playlists, and snippets (start/end), one job at a time.
// Files land in media/<event>/ where the video channels pick them up automatically.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killTree } from './displays.mjs';
import { ROOT } from './env.mjs';

const COOKIES_FILE = path.join(ROOT, 'cookies.txt');
const BROWSERS = new Set(['brave', 'edge', 'chrome', 'firefox', 'chromium', 'opera', 'vivaldi']);

const TIME = /^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/;      // 90, 1:30, 1:02:03, 12.5
const HEIGHTS = new Set([480, 720, 1080, 1440, 2160]);
const clean = t => { t = String(t ?? '').trim(); return TIME.test(t) ? t : ''; };

/** "https://... @ 1:20-2:10"  ->  { url, start, end }  (start/end optional, either side may be empty) */
export function parseLine(line) {
  const [u, range = ''] = String(line).split(/\s+@\s+/);
  const out = { url: u.trim() };
  const m = range.match(/^\s*([^-\s]*)\s*-\s*([^-\s]*)\s*$/);
  if (m) { out.start = clean(m[1]); out.end = clean(m[2]); }
  return out;
}

export function createDownloads({ mediaDir, onChange, onDone, log = console.log }) {
  const jobs = [];
  let seq = 0, current = null, proc = null;

  const friendly = e => /Sign in to confirm|not a bot/i.test(e) ? 'YouTube wants a sign-in: put a cookies.txt in the project folder, or pick your browser under "YouTube sign-in"'
    : /Could not copy .*cookie/i.test(e) ? 'Could not read that browser\'s cookies (Chromium locks them while open): close the browser, or use a cookies.txt file'
    : /could not find .* cookies database/i.test(e) ? 'That browser has no cookie database on this PC - pick another under "YouTube sign-in"'
    : e.slice(0, 200);
  const publicJob = j => ({ id: j.id, url: j.url, status: j.status, pct: j.pct, item: j.item, items: j.items, files: j.files, error: j.error, cookies: j.cookies, start: j.start, end: j.end, playlist: j.playlist, first: j.first, height: j.height });
  const list = () => jobs.map(publicJob);

  function buildArgs(j) {
    const clip = j.start || j.end ? ` (clip ${(j.start || '0').replace(/:/g, '.')}-${(j.end || 'end').replace(/:/g, '.')})` : '';
    const name = j.playlist === 'single'
      ? `%(title).80s${clip}.%(ext)s`
      : `%(playlist_title).30s - %(playlist_index)02d - %(title).60s${clip}.%(ext)s`;
    const a = ['--newline', '--no-colors', '--windows-filenames', '-S', `vcodec:h264,res:${j.height},acodec:aac`, '--merge-output-format', 'mp4', '-o', path.join(mediaDir, name)];
    if (j.playlist === 'single') a.push('--no-playlist');
    else { a.push('--yes-playlist'); if (j.playlist === 'first') a.push('--playlist-items', `1:${j.first}`); }
    const useFile = j.cookies === 'file' || (j.cookies === 'auto' && fs.existsSync(COOKIES_FILE));
    if (useFile) a.push('--cookies', COOKIES_FILE); else if (BROWSERS.has(j.cookies)) a.push('--cookies-from-browser', j.cookies);
    if (j.start || j.end) a.push('--download-sections', `*${j.start || '0'}-${j.end || 'inf'}`, '--force-keyframes-at-cuts');
    a.push(j.url);
    return a;
  }

  function pump() {
    if (current) return;
    const j = jobs.find(x => x.status === 'queued'); if (!j) return;
    current = j; j.status = 'downloading'; j.pct = 0; onChange();
    let err = '';
    proc = spawn('yt-dlp', buildArgs(j), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const onLine = line => {
      let m;
      if ((m = line.match(/\[download\]\s+([\d.]+)%/))) j.pct = Math.min(100, +m[1]);
      else if ((m = line.match(/Downloading (?:item|video) (\d+) of (\d+)/))) { j.item = +m[1]; j.items = +m[2]; j.pct = 0; }
      else if ((m = line.match(/\[download\] Destination: (.+)$/))) j.files.push(path.basename(m[1]));
      else if ((m = line.match(/\[Merger\] Merging formats into "(.+)"$/))) { j.files.pop(); j.files.push(path.basename(m[1])); }
      else if ((m = line.match(/\[download\] (.+) has already been downloaded/))) j.files.push(path.basename(m[1]));
      else if (/^ERROR:/.test(line)) err = friendly(line.replace(/^ERROR:\s*/, ''));
      else return;
      onChange();
    };
    const split = d => String(d).split(/\r?\n/).filter(Boolean).forEach(onLine);
    proc.stdout.on('data', split);
    proc.stderr.on('data', d => { split(d); });
    proc.on('error', () => { j.status = 'error'; j.error = 'yt-dlp not found - run: npm run doctor'; finish(); });
    proc.on('close', code => {
      if (j.status === 'canceled') return finish();
      if (code === 0) { j.status = 'done'; j.pct = 100; } else { j.status = 'error'; j.error = err || 'yt-dlp exit ' + code; }
      finish();
    });
    function finish() { const ok = j.status === 'done'; current = null; proc = null; onChange(); if (ok) onDone?.(j); pump(); }
  }

  return {
    list,
    /** @param {string[]} lines  @param {{playlist?:'single'|'all'|'first', first?:number, height?:number, start?:string, end?:string}} opts defaults for every line */
    add(lines, opts = {}) {
      const added = [], rejected = [];
      for (const raw of lines) {
        if (!String(raw).trim()) continue;
        const p = parseLine(raw);
        if (!/^https?:\/\//i.test(p.url)) { rejected.push(String(raw).trim().slice(0, 60)); continue; }
        const j = {
          id: ++seq, url: p.url, status: 'queued', pct: 0, item: null, items: null, files: [], error: null,
          start: p.start ?? clean(opts.start), end: p.end ?? clean(opts.end),
          playlist: ['single', 'all', 'first'].includes(opts.playlist) ? opts.playlist : 'single',
          first: Math.min(200, Math.max(1, Math.round(+opts.first) || 5)),
          height: HEIGHTS.has(+opts.height) ? +opts.height : 1080,
          cookies: opts.cookies === 'file' || opts.cookies === 'none' || BROWSERS.has(opts.cookies) ? opts.cookies : 'auto',
        };
        jobs.push(j); added.push(j.id);
      }
      onChange(); pump();
      return { ok: added.length > 0, added: added.length, rejected };
    },
    cancel(id) {
      const j = jobs.find(x => x.id === +id); if (!j) return { error: 'unknown download' };
      if (j.status === 'queued') { jobs.splice(jobs.indexOf(j), 1); }
      else if (j.status === 'downloading') { j.status = 'canceled'; if (proc?.pid) killTree(proc.pid); }
      onChange(); return { ok: true };
    },
    clearFinished() { for (let i = jobs.length - 1; i >= 0; i--) if (['done', 'error', 'canceled'].includes(jobs[i].status)) jobs.splice(i, 1); onChange(); return { ok: true }; },
  };
}
