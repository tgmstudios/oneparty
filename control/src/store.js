// Hub state for the whole panel: one SSE connection, one reactive object, one command helper.
import { reactive } from 'vue';

export const hub = reactive({
  S: null,            // full hub state (/api/state, re-pushed on every change)
  track: null, lyrics: null, queue: [],
  cached: [], media: [], drafts: [],
  audioAt: 0, levels: { bass: 0, mid: 0, high: 0, level: 0, beat: false, bpm: 0, bands: [] },
  now: Date.now(),    // ticks so progress bars and the audio-live dot update between events
  playerErr: '', busy: {},
});

export const cmd = body => fetch('/api/cmd', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());

export async function refreshAssets() {
  const [cached, media, drafts] = await Promise.all([
    fetch('/api/cache').then(r => r.json()), fetch('/api/media').then(r => r.json()), cmd({ type: 'draft' }).then(r => r.drafts || []),
  ]);
  Object.assign(hub, { cached, media, drafts });
}

export const trackPosMs = t => (t ? t.progressMs + (t.playing ? Date.now() - t.at : 0) : 0);
export const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function start() {
  const on = (es, type, fn) => es.addEventListener(type, e => fn(JSON.parse(e.data)));
  const open = () => {
    const es = new EventSource('/api/events');
    on(es, 'state', s => { hub.S = s; if (!hub.track && s.track) { hub.track = s.track; hub.lyrics = s.lyrics; hub.queue = s.queue; } document.title = `${s.event.title} · control`; document.documentElement.style.setProperty('--acc', s.event.theme?.accent || '#ff6a10'); });
    on(es, 'track', ({ track, lyrics }) => { hub.track = track; hub.lyrics = lyrics; });
    on(es, 'progress', t => { if (t) hub.track = t; });
    on(es, 'queue', q => { hub.queue = q; });
    on(es, 'audio', a => { hub.audioAt = Date.now(); hub.levels = { bass: a.bass, mid: a.mid, high: a.high, level: a.level, beat: !!a.beat, bpm: a.bpm, bands: a.bands || [] }; });
    on(es, 'cache', refreshAssets);
    es.onerror = () => { es.close(); setTimeout(open, 1500); };
  };
  open();
  refreshAssets();
  setInterval(() => { hub.now = Date.now(); }, 250);
}
