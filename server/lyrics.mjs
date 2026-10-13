// Time-synced lyrics from LRCLIB (https://lrclib.net) - free, no key. Spotify exposes no lyrics API.
const cache = new Map();
export function parseLrc(lrc) {
  const out = [];
  for (const line of lrc.split(/\r?\n/)) {
    const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) out.push({ t: Math.round((+m[1] * 60 + +m[2]) * 1000), text: m[3].trim() });
  }
  return out.sort((a, b) => a.t - b.t);
}
export async function getLyrics(track) {
  if (!track) return null;
  if (cache.has(track.id)) return cache.get(track.id);
  const q = new URLSearchParams({ track_name: track.title, artist_name: track.artists[0] || '', album_name: track.album || '', duration: String(Math.round(track.durationMs / 1000)) });
  let res = null;
  try {
    const r = await fetch('https://lrclib.net/api/get?' + q, { headers: { 'user-agent': 'oneparty/0.1' } });
    if (r.ok) { const j = await r.json(); if (j.syncedLyrics) res = { synced: true, lines: parseLrc(j.syncedLyrics) }; else if (j.plainLyrics) res = { synced: false, lines: j.plainLyrics.split('\n').map(text => ({ t: null, text })) }; }
  } catch { /* offline: no lyrics */ }
  cache.set(track.id, res);
  return res;
}
