// Song tempo lookup. Spotify's audio-features endpoint is closed to new apps (Nov 2024) and the BPM shown in the
// Spotify app is not exposed by the Web API, so we use Deezer's public track API (no key): ISRC match first, then search.
const cache = new Map();
const H = { headers: { 'user-agent': 'oneparty/0.1' } };
const getJson = async url => { const r = await fetch(url, H); return r.ok ? r.json() : null; };

/** @returns {Promise<{bpm:number, raw:number, source:string}|null>} bpm is folded into 75-175 so one loop stays 16 beats at a sane speed */
export async function getBpm(track) {
  if (!track?.id) return null;
  if (cache.has(track.id)) return cache.get(track.id);
  let raw = 0, source = null;
  try {
    if (track.isrc) {
      const d = await getJson('https://api.deezer.com/track/isrc:' + encodeURIComponent(track.isrc));
      if (d?.bpm > 0) { raw = d.bpm; source = 'deezer-isrc'; }
    }
    if (!raw) {
      const q = encodeURIComponent(`${track.artists[0] || ''} ${track.title.replace(/\s*[\(\[].*$/, '')}`);
      const s = await getJson('https://api.deezer.com/search?limit=5&q=' + q);
      for (const hit of s?.data || []) {
        const d = await getJson('https://api.deezer.com/track/' + hit.id);
        if (d?.bpm > 0 && Math.abs((d.duration || 0) - track.durationMs / 1000) < 8) { raw = d.bpm; source = 'deezer-search'; break; }   // same length = same recording
      }
    }
  } catch { /* offline */ }
  let bpm = raw; if (bpm) { while (bpm < 75) bpm *= 2; while (bpm > 175) bpm /= 2; }
  const res = raw ? { bpm: Math.round(bpm * 10) / 10, raw, source } : null;
  cache.set(track.id, res);
  return res;
}
