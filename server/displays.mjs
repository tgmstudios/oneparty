// Find monitors and open one borderless fullscreen browser window on each, per OS.
// Each window gets its own --user-data-dir so Chromium treats it as a separate process and honours --window-position.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './env.mjs';

const isWSL = process.platform === 'linux' && /microsoft/i.test(os.release());
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 8000 });

/** @returns {{x:number,y:number,w:number,h:number,primary:boolean,name:string}[]} */
export function detectScreens() {
  try {
    if (process.platform === 'win32' || isWSL) {
      const ps = process.platform === 'win32' ? 'powershell' : 'powershell.exe';
      const out = run(ps, ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { "$($_.Bounds.X),$($_.Bounds.Y),$($_.Bounds.Width),$($_.Bounds.Height),$($_.Primary),$($_.DeviceName)" }']);
      return out.trim().split(/\r?\n/).map(l => { const [x, y, w, h, p, ...n] = l.trim().split(','); return { x: +x, y: +y, w: +w, h: +h, primary: p === 'True', name: n.join(',') }; });
    }
    if (process.platform === 'darwin') {
      const js = "ObjC.import('AppKit');const s=$.NSScreen.screens;const o=[];const H=s.objectAtIndex(0).frame.size.height;for(let i=0;i<s.count;i++){const f=s.objectAtIndex(i).frame;o.push([f.origin.x,H-(f.origin.y+f.size.height),f.size.width,f.size.height,i==0,ObjC.unwrap(s.objectAtIndex(i).localizedName)].join(','))};o.join('\\n')";
      return run('osascript', ['-l', 'JavaScript', '-e', js]).trim().split('\n').map(l => { const [x, y, w, h, p, ...n] = l.split(','); return { x: +x, y: +y, w: +w, h: +h, primary: p === 'true', name: n.join(',') }; });
    }
    const out = run('xrandr', ['--query']);
    return [...out.matchAll(/^(\S+) connected (primary )?(\d+)x(\d+)\+(\d+)\+(\d+)/gm)].map(m => ({ name: m[1], primary: !!m[2], w: +m[3], h: +m[4], x: +m[5], y: +m[6] }));
  } catch { return []; }
}

/** Resolve an event display's `monitor` ("primary" | "internal" | "secondary" | index) against the detected screens. */
export function pickScreen(screens, monitor, used = new Set()) {
  const free = screens.filter(s => !used.has(s));
  const primary = screens.find(s => s.primary) || screens[0];
  if (monitor === 'primary') return primary;
  if (monitor === 'internal') return free.find(s => /eDP|LVDS|DSI|Built-?in|DISPLAY\d+$/i.test(s.name) && s !== primary) || free.slice().sort((a, b) => a.w * a.h - b.w * b.h).find(s => s !== primary);
  if (monitor === 'secondary') return free.find(s => s !== primary);
  if (Number.isInteger(monitor)) return screens[monitor];
  return free[0];
}

function findBrowser() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const c = isWSL ? [
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe', '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
  ] : process.platform === 'win32' ? [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const p of c) {
    if (p.includes('/') || p.includes('\\')) { if (fs.existsSync(p)) return p; }
    else { try { run('which', [p]); return p; } catch { /* next */ } }
  }
  return null;
}

const children = [];
export function launchWindow({ url, screen, id }) {
  const bin = findBrowser();
  if (!bin) return { error: 'No Chromium-based browser found. Install Chrome/Edge or set BROWSER_PATH in .env' };
  const winProfile = bin.endsWith('.exe') && isWSL ? `C:\\Temp\\oneparty-${id}` : path.join(ROOT, '.browser-profiles', id);
  const args = [
    `--user-data-dir=${winProfile}`, `--app=${url}`, '--kiosk', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=Entire screen', '--disable-session-crashed-bubble',
    '--disable-infobars', '--disable-features=Translate', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  ];
  if (screen) args.push(`--window-position=${screen.x},${screen.y}`, `--window-size=${screen.w},${screen.h}`);
  const p = spawn(bin, args, { stdio: 'ignore', detached: false });
  p.on('error', () => {});
  children.push(p);
  return { pid: p.pid, bin };
}
export const closeAll = () => children.forEach(c => { try { c.kill(); } catch { /* gone */ } });
