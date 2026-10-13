#!/usr/bin/env node
// Checks the machine for everything oneparty can use and prints the one-line install for what's missing.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { ROOT } from '../server/env.mjs';
import path from 'node:path';
const win = process.platform === 'win32', mac = process.platform === 'darwin';
const has = (cmd, args = ['--version']) => { try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; } };
const hint = { win: { 'yt-dlp': 'winget install yt-dlp.yt-dlp', ffmpeg: 'winget install Gyan.FFmpeg', chrome: 'winget install Google.Chrome' },
  mac: { 'yt-dlp': 'brew install yt-dlp', ffmpeg: 'brew install ffmpeg', chrome: 'brew install --cask google-chrome' },
  other: { 'yt-dlp': 'pipx install yt-dlp', ffmpeg: 'sudo apt install ffmpeg', chrome: 'sudo apt install chromium' } }[win ? 'win' : mac ? 'mac' : 'other'];
const chromeAt = win ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'] : mac ? ['/Applications/Google Chrome.app'] : [];
const checks = [
  ['node >= 20', +process.versions.node.split('.')[0] >= 20, 'install Node LTS from nodejs.org'],
  ['Chrome or Edge', chromeAt.some(fs.existsSync) || has('google-chrome') || has('chromium') || !!process.env.BROWSER_PATH, hint.chrome],
  ['yt-dlp (clip download)', has('yt-dlp'), hint['yt-dlp']],
  ['ffmpeg (optional, clip transcode)', has('ffmpeg', ['-version']), hint.ffmpeg],
  ['.env file', fs.existsSync(path.join(ROOT, '.env')), 'copy .env.example to .env and fill it in'],
];
let bad = 0;
for (const [name, ok, fix] of checks) { console.log(`${ok ? 'ok  ' : 'MISSING'}  ${name}${ok ? '' : '  ->  ' + fix}`); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
