// Custom light shows: authored, per-song / per-scene lighting driven by the live beat, tempo and song position.
// Unlike Hue-style presets (a static palette spread over the lights), a show is a small program:
//   { id, name, palette:[#hex..], brightness, motion, step, every, period, spread, beat, depth, decay, flashColor, level, breathe,
//     effect, groups:{ <groupName|kind>: {...layer overrides} }, cues:[{ at: seconds, label, ...layer overrides, groups? }] }
// Layer fields (all optional except palette on the show itself):
//   palette    colors to cycle (1-12)
//   brightness base brightness 1-255
//   motion     static | chase (each light one color ahead) | alternate (odd/even) | same (all one color) | random | drift (smooth glide through the palette) | breathe (slow brightness swell)
//   step       what advances the palette: "beat" (every `every` beats) or "time" (every `period` s). drift/breathe use `period` s.
//   spread     drift: 0-1 phase offset between neighbouring lights
//   beat       none | pulse (brightness kick) | flash (kick + wash toward flashColor)
//   depth      0-1 kick strength; decay = kick tail seconds; level = 0-1 how much overall loudness lifts brightness
//   effect     WLED effect name for strip groups (e.g. "Fire 2012"); otherwise strips are put on Solid
// levels: { calm|build|drop: {...layer overrides, groups?} } applied automatically from live energy (quiet / rising / peak); "groove" = no override.
// Cues switch layers at a position in the song (needs Spotify progress), e.g. calm intro -> hard drop.
import fs from 'node:fs';
import { createBeatClock } from './beatclock.mjs';
import { createDDP } from './ddp.mjs';

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, a, b) => (v === undefined || v === null || v === '' || !Number.isFinite(+v)) ? undefined : clamp(+v, a, b);
const MOTIONS = ['static', 'chase', 'alternate', 'same', 'random', 'drift', 'breathe'];
const BEATS = ['none', 'pulse', 'flash'];

/** validate + clamp one layer; unknown fields dropped, bad ones reported via throw */
function layer(o = {}, where = 'show') {
  const out = {};
  if (o.palette !== undefined) {
    if (!Array.isArray(o.palette) || !o.palette.length || o.palette.length > 12 || !o.palette.every(c => HEX.test(c))) throw new Error(`${where}.palette must be 1-12 "#rrggbb" colors`);
    out.palette = o.palette.map(c => c.toLowerCase());
  }
  if (o.motion !== undefined) { if (!MOTIONS.includes(o.motion)) throw new Error(`${where}.motion must be one of ${MOTIONS.join('|')}`); out.motion = o.motion; }
  if (o.step !== undefined) { if (!['beat', 'time'].includes(o.step)) throw new Error(`${where}.step must be beat|time`); out.step = o.step; }
  if (o.beat !== undefined) { if (!BEATS.includes(o.beat)) throw new Error(`${where}.beat must be ${BEATS.join('|')}`); out.beat = o.beat; }
  if (o.flashColor !== undefined) { if (!HEX.test(o.flashColor)) throw new Error(`${where}.flashColor must be #rrggbb`); out.flashColor = o.flashColor.toLowerCase(); }
  if (o.effect !== undefined) out.effect = o.effect ? String(o.effect).slice(0, 40) : '';
  for (const [k, a, b] of [['brightness', 1, 255], ['every', 1, 32], ['period', 0.5, 300], ['spread', 0, 1], ['depth', 0, 1], ['decay', 0.05, 3], ['level', 0, 1]]) {
    const v = num(o[k], a, b); if (v !== undefined) out[k] = k === 'every' ? Math.round(v) : v;
  }
  return out;
}

/** full show definition -> normalized, or throws with a human message */
export function normalizeShow(s) {
  if (!s || typeof s !== 'object') throw new Error('show must be an object');
  const id = String(s.id || '').toLowerCase().replace(/[^\w-]/g, '').slice(0, 48);
  if (!id) throw new Error('show needs an id (letters, digits, - _)');
  const base = layer(s);
  if (!base.palette) throw new Error('show needs a palette');
  const out = { id, name: String(s.name || id).slice(0, 60), ...base };
  if (s.notes) out.notes = String(s.notes).slice(0, 400);
  if (s.groups) { out.groups = {}; for (const [k, v] of Object.entries(s.groups)) out.groups[k] = layer(v, `groups.${k}`); }
  if (s.levels) {
    out.levels = {};
    for (const k of ['calm', 'build', 'drop']) if (s.levels[k]) {
      out.levels[k] = layer(s.levels[k], `levels.${k}`);
      if (s.levels[k].groups) { out.levels[k].groups = {}; for (const [g, v] of Object.entries(s.levels[k].groups)) out.levels[k].groups[g] = layer(v, `levels.${k}.groups.${g}`); }
    }
  }
  if (s.cues !== undefined) {
    if (!Array.isArray(s.cues) || s.cues.length > 60) throw new Error('cues must be an array (max 60)');
    out.cues = s.cues.map((c, i) => {
      const at = num(c.at, 0, 36000); if (at === undefined) throw new Error(`cues[${i}].at (seconds) required`);
      const cue = { at, ...(c.label ? { label: String(c.label).slice(0, 40) } : {}), ...layer(c, `cues[${i}]`) };
      if (c.groups) { cue.groups = {}; for (const [k, v] of Object.entries(c.groups)) cue.groups[k] = layer(v, `cues[${i}].groups.${k}`); }
      return cue;
    }).sort((a, b) => a.at - b.at);
  }
  return out;
}

/** Autopilot: build a complete adaptive show from a palette and tempo. No authoring needed. */
export function generateShow({ id = 'auto', name = 'Autopilot', palette, bpm = 120 }) {
  const pal = (palette?.length ? palette : ['#ff6a10', '#ff2fa0', '#7a1d8a']).slice(0, 6), beat = 60 / clamp(bpm, 60, 200);
  const glide = clamp(Math.round(beat * 16), 8, 40);   // bulbs: one palette pass per ~4 bars
  return normalizeShow({
    id, name, palette: pal, brightness: 150, motion: 'chase', step: 'beat', every: bpm >= 150 ? 2 : 1, beat: 'pulse', depth: 0.45, decay: Math.min(0.4, beat * 0.7), level: 0.2,
    groups: { bulb: { motion: 'drift', period: glide, spread: 0.5, beat: 'none', brightness: 170 } },
    levels: {
      calm: { brightness: 80, motion: 'drift', period: glide * 1.5, beat: 'none', depth: 0.15, level: 0.1, groups: { bulb: { brightness: 110, period: glide * 2 } } },
      build: { brightness: 140, every: 1, depth: 0.6, level: 0.3, groups: { bulb: { period: Math.max(6, glide / 2), brightness: 190 } } },
      drop: { brightness: 210, motion: 'alternate', every: 1, beat: 'flash', flashColor: '#fff4e8', depth: 0.95, decay: Math.min(0.3, beat * 0.55), level: 0.35, groups: { bulb: { motion: 'alternate', step: 'beat', every: 2, brightness: 235, beat: 'none' } } },
    },
  });
}

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Colors for N lights that are all different: the palette (padded with hue-shifted copies when it is short) is blended
// around a loop into >= N steps, and lights take steps a coprime stride apart, so neighbours contrast and none repeat.
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; }
function hsl2rgb([h, s, l]) { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const PALETTE_COLORS = 9;
export function wheel(pal, n) {
  // each scene gets 9 distinct colors: its own first, then fill with whichever candidate hue is farthest from every color so far
  const base = (pal.length ? pal : [[255, 255, 255]]).slice(0, PALETTE_COLORS), p = base.slice();
  const cand = []; for (let h = 0; h < 360; h += 15) for (const l of [0.5, 0.62]) cand.push(hsl2rgb([h, 0.95, l]));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  while (p.length < PALETTE_COLORS) { let best = null, bd = -1; for (const c of cand) { const d = Math.min(...p.map(q => dist(c, q))); if (d > bd) { bd = d; best = c; } } p.push(best); }
  const W = Math.max(n, p.length), out = [];
  for (let j = 0; j < W; j++) { const f = j / W * p.length, a = Math.floor(f); out.push(mix(p[a], p[(a + 1) % p.length], f - a)); }
  let st = n <= p.length ? 1 : Math.max(1, Math.round(W * 0.382)); while (gcd(st, W) !== 1) st++;   // <= 9 lights: the 9 colors in order (scene colors first)
  return { colors: out, W, st, at: (i, shift = 0) => out[(((i * st + shift) % W) + W) % W] };
}
export const distinctColors = (palHex, n) => { const w = wheel(palHex.map(hex), n); return Array.from({ length: n }, (_, i) => toHex(w.at(i))); };
const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

export function createLightShows({ ha, groups, file, getPos, getBpm, getPlaying, log = console.log, onChange = () => {} }) {
  let store = { shows: {}, songs: {}, scenes: {} };
  try { if (file && fs.existsSync(file)) store = { ...store, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) { log('[lightshow] unreadable', file, e.message); }
  const save = () => { if (file) fs.writeFileSync(file, JSON.stringify(store, null, 2) + '\n'); };

  // ---- runtime ----
  let cur = null;                       // { show, source, startedAt }
  // live energy -> calm | build | drop | groove. Judged against THIS song's own recent history (rolling median over ~3 min),
  // so a steady club track reads as groove, a quiet intro/breakdown as calm, a rise as build, a jump above the norm as drop.
  const energy = { fast: 0, state: 'groove', cand: 'groove', candSince: 0, hist: [], lastSample: 0 };
  function trackEnergy(a) {
    const x = 0.6 * (a.level || 0) + 0.4 * (a.bass || 0), now = Date.now();
    energy.fast += (x - energy.fast) * (1 - Math.exp(-0.05 / 1.0));
    if (now - energy.lastSample >= 500) { energy.lastSample = now; energy.hist.push(energy.fast); if (energy.hist.length > 360) energy.hist.shift(); }
    const h = energy.hist; let cand = 'groove';
    if (h.length >= 30) {                                        // 15 s of music before judging
      const med = [...h].sort((p, q) => p - q)[h.length >> 1], ago = h[Math.max(0, h.length - 13)];   // value 6 s ago
      cand = (energy.fast < 0.1 || energy.fast < med * 0.6) ? 'calm' : (energy.fast > med * 1.25 && energy.fast > 0.3) ? 'drop' : (energy.fast - ago > Math.max(0.05, med * 0.12) && energy.fast > 0.12) ? 'build' : 'groove';
    }
    if (cand !== energy.cand) { energy.cand = cand; energy.candSince = now; }
    if (cand !== energy.state && now - energy.candSince > (cand === 'drop' ? 1000 : 3000)) energy.state = cand;
  }
  const clock = createBeatClock({ getBpm });
  const ddp = createDDP({ log });
  // strips with a known IP (group.realtime = [{entity, ip, leds}]) are driven over DDP at ~30 fps; everything else goes through Home Assistant
  const rt = new Map(); for (const g of groups) for (const r of g.realtime || []) rt.set(r.entity, r);
  const fast = rt.size > 0;
  let level = 0, timer = null;
  const sent = new Map();               // entity -> { c, b, at }
  const gateAt = new Map();             // group -> last send
  const lightIdx = new Map(); let n = 0;
  for (const g of groups) for (const e of g.entities) lightIdx.set(e, n++);

  function layerAt(show, g, pos) {
    let L = { palette: show.palette, brightness: 180, motion: 'chase', step: 'beat', every: 1, period: 8, spread: 0.25, beat: 'pulse', depth: 0.5, decay: 0.35, level: 0.2, effect: '' };
    const apply = o => { if (o) Object.assign(L, o); };
    const pickGroup = gs => gs && (gs[g.name] || gs[g.kind]);
    apply(show); apply(pickGroup(show.groups));
    const lv = show.levels?.[energy.state]; if (lv) { apply(lv); apply(pickGroup(lv.groups)); }
    if (pos != null && show.cues) {
      let cue = null; for (const c of show.cues) if (c.at * 1000 <= pos) cue = c; else break;
      if (cue) { apply(cue); apply(pickGroup(cue.groups)); }
    }
    return L;
  }

  function tick(force) {
    if (!cur || !ha.enabled) return;
    const now = Date.now(), el = (now - cur.startedAt) / 1000, pos = getPos();
    const live = getPlaying() || (clock.status().lastHitAgoMs ?? 1e9) < 2000;   // no music, no beats
    for (const g of groups) {
      const allRt = g.entities.every(e => rt.has(e));
      if (now - (gateAt.get(g.name) || 0) < (allRt ? 30 : g.minGapMs)) continue;   // slow bulbs/bridges keep their own pace, beats included
      const L = layerAt(cur.show, g, pos), pal = L.palette.map(hex), np = pal.length, wh = wheel(pal, n);
      // read the beat clock AHEAD by this group's latency so the light lands on the beat, not after it
      const bp = live ? clock.at(now + (g.lead ?? (g.kind === 'wled' ? 40 : 300))) : null;
      const stepIdx = L.step === 'time' ? Math.floor(el / L.period) : Math.floor(Math.max(0, bp?.k ?? 0) / L.every);
      const env = L.beat === 'none' || !bp ? 0 : Math.exp(-(bp.sinceMs / 1000) / L.decay);
      const jobs = new Map();           // "color|bri|tr" -> entities (identical targets share one HA call)
      g.entities.forEach((e, k) => {
        const i = lightIdx.get(e) ?? k;
        let c, bri = L.brightness;
        switch (L.motion) {
          case 'static': c = wh.at(i); break;
          case 'same': c = wh.at(i, stepIdx); break;                       // every light always has its own color
          case 'alternate': c = wh.at(i, stepIdx * 2); break;
          case 'random': c = wh.at(i, Math.floor(hash(stepIdx * 31) * wh.W)); break;
          case 'drift': { const f = (((i * wh.st) % wh.W) + (el / L.period) * wh.W) % wh.W, a = Math.floor(f); c = mix(wh.colors[a], wh.colors[(a + 1) % wh.W], f - a); break; }   // own slot per light, whole wheel glides
          case 'breathe': c = pal[(Math.floor(el / L.period) + i) % np]; bri *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (el / L.period) + i)); break;
          default: c = wh.at(i, stepIdx);   // chase
        }
        // every light has its own brightness, always in the high range (150-255) and wandering over time; beats and energy lift it toward 255
        bri = 150 + 105 * (0.5 + 0.5 * Math.sin(el * (0.5 + 0.13 * (i % 5)) + i * 2.399 + hash(i) * 6.28));
        bri += (255 - bri) * clamp(L.depth * env + L.level * level, 0, 1);
        if (L.beat === 'flash' && env > 0.02) c = mix(c, hex(L.flashColor || '#ffffff'), clamp(env * L.depth * 0.5, 0, 0.4));   // light touch so each light keeps its own color
        bri = clamp(Math.round(bri), 140, 255); const col = toHex(c);
        const r = rt.get(e);
        if (r) { const k = bri / 255; ddp.solid(r.ip, r.leds || 60, c.map(v => v * k)); return; }   // realtime: no dedupe, the stream is the state
        const prev = sent.get(e);
        if (!force && prev && prev.c === col && Math.abs(prev.b - bri) < 8) return;
        sent.set(e, { c: col, b: bri, at: now });
        const tr = L.motion === 'drift' ? Math.round(g.minGapMs * 1.2) / 1000 : (env > 0.6 ? 0 : g.transition);
        const key = `${col}|${bri}|${tr}`; (jobs.get(key) || jobs.set(key, []).get(key)).push(e);
      });
      if (jobs.size) gateAt.set(g.name, now);
      for (const [key, ents] of jobs) { const [color, b, tr] = key.split('|'); ha.lights(ents, { color, brightness: +b, transition: +tr }, { key: `show:${g.name}:${key}`, minGapMs: 0 }); }
    }
  }

  function applyEffects() {
    for (const g of groups) {
      if (g.kind !== 'wled') continue;
      const fx = layerAt(cur.show, g, getPos()).effect;
      ha.lights(g.entities, { effect: fx || 'Solid' }, { key: 'showfx:' + g.name, minGapMs: 0 });
    }
  }

  const api = {
    list: () => store,
    get: id => store.shows[id],
    current: () => cur?.show,
    put(s) { const show = normalizeShow(s); store.shows[show.id] = show; save(); if (cur?.show.id === show.id) { cur.show = show; applyEffects(); } onChange(); return show; },
    remove(id) {
      if (!store.shows[id]) return false;
      delete store.shows[id];
      for (const m of ['songs', 'scenes']) for (const [k, v] of Object.entries(store[m])) if ((v.show || v) === id) delete store[m][k];
      if (cur?.show.id === id) api.stop();
      save(); onChange(); return true;
    },
    /** start a stored show by id, or an unsaved draft object ("try"); source = manual|song|scene|try */
    start(idOrDraft, source = 'manual') {
      const show = typeof idOrDraft === 'string' ? store.shows[idOrDraft] : normalizeShow(idOrDraft);
      if (!show) throw new Error('unknown show ' + idOrDraft);
      if (cur?.show.id !== show.id || cur.show !== show) { sent.clear(); gateAt.clear(); }
      cur = { show, source, startedAt: Date.now() };
      applyEffects(); tick(true);
      if (!timer) timer = setInterval(() => tick(false), fast ? 33 : 80);
      onChange(); return show;
    },
    stop() { if (!cur) return false; cur = null; clearInterval(timer); timer = null; sent.clear(); gateAt.clear(); onChange(); return true; },
    running: () => cur && { id: cur.show.id, name: cur.show.name, source: cur.source, beat: clock.status(), energy: { state: energy.state, level: +energy.fast.toFixed(2) } },
    onAudio(a) {
      level = level * 0.7 + (a.level || 0) * 0.3; trackEnergy(a);
      if (a.beat) clock.hit(Date.now() - 20);   // frames are batched ~50 ms; the clock smooths the rest
    },
    /** which show should light this moment: song binding > scene binding > none */
    resolve(sceneId, track) {
      const sb = track?.id && store.songs[track.id]; if (sb && store.shows[sb.show]) return { id: sb.show, source: 'song' };
      const cb = store.scenes[sceneId]; if (cb && store.shows[cb]) return { id: cb, source: 'scene' };
      return null;
    },
    bindScene(sceneId, id) { if (!store.shows[id]) throw new Error('unknown show ' + id); store.scenes[sceneId] = id; save(); onChange(); },
    unbindScene(sceneId) { delete store.scenes[sceneId]; save(); onChange(); },
    bindSong(trackId, id, label) { if (!store.shows[id]) throw new Error('unknown show ' + id); store.songs[trackId] = { show: id, label: label || '' }; save(); onChange(); },
    unbindSong(trackId) { delete store.songs[trackId]; save(); onChange(); },
    hasSong: trackId => !!store.songs[trackId],
    /** what the lights are actually doing right now, from HA */
    async readback(entities) {
      const all = await ha.states();
      return all.filter(s => entities.includes(s.entity_id)).map(s => ({ entity: s.entity_id, state: s.state, rgb: s.attributes?.rgb_color, bri: s.attributes?.brightness, effect: s.attributes?.effect }));
    },
  };
  return api;
}
