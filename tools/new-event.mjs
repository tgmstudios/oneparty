#!/usr/bin/env node
// usage: node tools/new-event.mjs <slug> --title "Name" [--subtitle "Sub"] [--bpm 120] [--from <existing-slug>]
// Scaffolds events/<slug>/event.json (+ assets/, media/<slug>/) by cloning an existing event or the default template.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listEvents } from '../server/env.mjs';
const a = process.argv.slice(2), slug = a[0];
const opt = (k, d) => { const i = a.indexOf('--' + k); return i > -1 ? a[i + 1] : d; };
if (!slug || slug.startsWith('--')) { console.error('usage: new-event.mjs <slug> --title "..." [--subtitle ".."] [--bpm N] [--from slug]'); process.exit(1); }
const dir = path.join(ROOT, 'events', slug);
if (fs.existsSync(dir)) { console.error('event already exists: ' + slug); process.exit(1); }
const from = opt('from', listEvents().at(-1));
const base = from ? JSON.parse(fs.readFileSync(path.join(ROOT, 'events', from, 'event.json'), 'utf8')) : {
  displays: [{ id: 'main', role: 'visuals', monitor: 'primary', scene: '05', overlays: ['nowplaying', 'lyrics'], audio: true, audioSource: 'loopback' }, { id: 'control', role: 'control', monitor: 'internal' }],
  scenes: [], homeassistant: { mode: 'sync', brightness: 180, groups: [] },
};
const ev = { ...base, title: opt('title', slug), subtitle: opt('subtitle', ''), bpm: +opt('bpm', base.bpm || 120) };
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'media', slug), { recursive: true });
fs.writeFileSync(path.join(dir, 'event.json'), JSON.stringify(ev, null, 2) + '\n');
console.log(`created events/${slug}/event.json (from ${from || 'template'}). Edit it, then: npm start -- --event ${slug}`);
