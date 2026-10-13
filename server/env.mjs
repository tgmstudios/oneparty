import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tiny .env loader (no dependency). Real environment variables win.
export function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function listEvents() {
  const d = path.join(ROOT, 'events');
  return fs.existsSync(d) ? fs.readdirSync(d).filter(n => fs.existsSync(path.join(d, n, 'event.json'))) : [];
}

export function loadEvent(slug) {
  const f = path.join(ROOT, 'events', slug, 'event.json');
  return { slug, ...JSON.parse(fs.readFileSync(f, 'utf8')) };
}
