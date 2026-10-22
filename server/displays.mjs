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

export function findBrowser() {
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
// Main (non-helper) browser processes whose user-data-dir is ours for this id. Wildcards only, so no path-escaping pitfalls.
const winMatch = id => `$_.CommandLine -like '*browser-profiles*${id}*' -and $_.CommandLine -notlike '*--type=*'`;
export function windowPids(id) {
  if (process.platform !== 'win32' || isWSL) return [];
  try { return run('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { ${winMatch(id)} } | ForEach-Object { $_.ProcessId }`]).split(/\s+/).filter(Boolean).map(Number); } catch { return []; }
}
export function launchWindow({ url, screen, id, kiosk = false, size = null, force = false, screenCount = 1, hidden = false }) {
  const bin = findBrowser();
  if (!bin) return { error: 'No Chromium-based browser found. Install Chrome/Edge or set BROWSER_PATH in .env' };
  const winProfile = bin.endsWith('.exe') && isWSL ? `C:\\Temp\\oneparty-${id}` : path.join(ROOT, '.browser-profiles', id);
  const args = [
    `--user-data-dir=${winProfile}`, `--app=${url}`, ...(kiosk ? ['--kiosk'] : []), '--no-first-run', '--no-default-browser-check', '--test-type',
    '--autoplay-policy=no-user-gesture-required', `--auto-select-desktop-capture-source=${screenCount > 1 ? 'Screen 1' : 'Entire screen'}`,   // never --use-fake-ui-for-media-stream: it swaps real capture for a synthetic 'Fake audio' source
    '--disable-session-crashed-bubble',
    '--disable-infobars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=Translate', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy', '--enable-native-gpu-memory-buffers', '--enable-accelerated-video-decode', '--enable-features=CanvasOopRasterization', '--disable-software-rasterizer', ...(process.platform === 'win32' ? ['--use-gl=angle', '--use-angle=d3d11'] : []),
  ];
  if (hidden) {   // helper jobs (bake, preview): headless = no window exists, so it can never appear over or steal focus from a fullscreen display
    const i = args.findIndex(x => x.startsWith('--app=')); if (i > -1) args[i] = url;
    args.push('--headless=new', '--mute-audio', `--window-size=${size?.w ?? 1280},${size?.h ?? 720}`);
  } else if (screen && kiosk) args.push(`--window-position=${screen.x},${screen.y}`, `--window-size=${screen.w},${screen.h}`);
  else if (screen) {   // dev mode: a normal ~60% window on the chosen monitor
    const w = size?.w ?? Math.round(screen.w * 0.6), h = size?.h ?? Math.round(screen.h * 0.6);
    args.push(`--window-position=${screen.x + 40},${screen.y + 40}`, `--window-size=${w},${h}`);
  } else if (size) args.push(`--window-size=${size.w},${size.h}`);
  const open = windowPids(id);
  if (open.length && !force) return { reused: true, pid: open[0], bin };   // already open: it reconnects to the hub by itself
  open.forEach(pid => killTree(pid));                                       // force: replace it
  const p = spawn(bin, args, { stdio: 'ignore', detached: true });   // detached: windows outlive a hub restart
  p.unref(); p.on('error', () => {});
  children.push(p);
  return { pid: p.pid, bin };
}
export function killTree(pid) {
  try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); else process.kill(pid); } catch { /* gone */ }
}
export const closeAll = () => children.forEach(c => c.pid && killTree(c.pid));
