// One-click YouTube sign-in: opens a dedicated browser window (own profile, so it never touches your daily browser),
// watches it over the DevTools protocol, and the moment you are signed in writes cookies.txt (Netscape format) for
// yt-dlp and closes the window. Re-running it later refreshes the cookies (the profile stays signed in).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { findBrowser, killTree } from './displays.mjs';

export const COOKIES_FILE = path.join(ROOT, 'cookies.txt');
const PROFILE = path.join(ROOT, '.browser-profiles', 'yt-login');
const LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=' + encodeURIComponent('https://www.youtube.com/');
const AUTH_COOKIES = new Set(['SAPISID', '__Secure-3PAPISID', '__Secure-3PSID', 'LOGIN_INFO']);
const WANT = /(^|\.)(youtube\.com|google\.com|googlevideo\.com|youtube-nocookie\.com)$/i;

/** DevTools cookie objects -> Netscape cookies.txt text */
export function toNetscape(cookies) {
  const lines = ['# Netscape HTTP Cookie File', '# Written by oneparty (YouTube sign-in). Keep private.'];
  for (const c of cookies) {
    if (!WANT.test(c.domain.replace(/^\./, ''))) continue;
    const dom = c.domain.startsWith('.') ? c.domain : (c.domain.includes('.') ? '.' + c.domain : c.domain);
    lines.push([(c.httpOnly ? '#HttpOnly_' : '') + dom, 'TRUE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', c.expires > 0 ? Math.floor(c.expires) : 0, c.name, c.value].join('\t'));
  }
  return lines.join('\r\n').replace(/\r\n/g, '\n') + '\n';
}

async function cdpCookies(port) {
  const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(v.webSocketDebuggerUrl);
    const t = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } reject(new Error('cdp timeout')); }, 4000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Storage.getCookies' }));
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { clearTimeout(t); ws.close(); d.error ? reject(new Error(d.error.message)) : resolve(d.result.cookies || []); } };
    ws.onerror = () => { clearTimeout(t); reject(new Error('cdp connection failed')); };
  });
}

export function createYtLogin({ onChange, log = console.log }) {
  let st = { state: 'idle', message: '', port: null }, proc = null, timer = null, deadline = 0;
  const set = (patch) => { st = { ...st, ...patch }; onChange?.(); };
  const cookieInfo = () => { try { const s = fs.statSync(COOKIES_FILE); return { present: true, savedAt: s.mtimeMs }; } catch { return { present: false, savedAt: null }; } };

  function stop(closeWindow = true) {
    clearTimeout(timer); timer = null;
    if (closeWindow && proc?.pid) killTree(proc.pid);
    proc = null;
  }

  async function poll() {
    if (!proc) return;
    if (Date.now() > deadline) { stop(); return set({ state: 'error', message: 'Timed out waiting for sign-in. Click "Sign in" to try again.' }); }
    try {
      const cookies = await cdpCookies(st.port);
      if (cookies.some(c => AUTH_COOKIES.has(c.name) && WANT.test(c.domain.replace(/^\./, '')))) {
        set({ state: 'capturing', message: 'Signed in - saving cookies...' });
        await new Promise(r => setTimeout(r, 1500));            // let the post-login cookies (consent, visitor) settle
        const final = await cdpCookies(st.port).catch(() => cookies);
        fs.writeFileSync(COOKIES_FILE, toNetscape(final), { mode: 0o600 });
        stop();
        return set({ state: 'done', message: 'Signed in. Cookies saved - downloads will use them automatically.' });
      }
    } catch { /* browser still starting */ }
    timer = setTimeout(poll, 1500);
  }

  return {
    status: () => ({ ...st, cookies: cookieInfo() }),
    start() {
      if (proc) return { ok: true, note: 'already open' };
      const bin = findBrowser();
      if (!bin) return { error: 'No Chromium-based browser found (install Chrome/Edge or set BROWSER_PATH in .env)' };
      const port = 9300 + Math.floor(Math.random() * 90);
      fs.mkdirSync(PROFILE, { recursive: true });
      proc = spawn(bin, [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', '--window-size=560,820', '--new-window', LOGIN_URL], { stdio: 'ignore', detached: false, windowsHide: false });
      proc.on('exit', () => { if (proc && st.state === 'waiting') { proc = null; clearTimeout(timer); set({ state: 'idle', message: 'The sign-in window was closed before finishing.' }); } });
      proc.on('error', e => { proc = null; set({ state: 'error', message: e.message }); });
      deadline = Date.now() + 10 * 60 * 1000;
      set({ state: 'waiting', port, message: 'Sign in to YouTube in the window that just opened. It closes by itself when you are done.' });
      timer = setTimeout(poll, 2500);
      return { ok: true };
    },
    cancel() { stop(); set({ state: 'idle', message: '' }); return { ok: true }; },
    /** delete the saved cookies (and optionally the login profile) */
    forget(profileToo = true) {
      stop(); try { fs.rmSync(COOKIES_FILE, { force: true }); } catch { /* none */ }
      if (profileToo) try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* none */ }
      set({ state: 'idle', message: 'Signed out. Cookies deleted.' }); return { ok: true };
    },
  };
}
