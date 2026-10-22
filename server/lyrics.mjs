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
const H = { headers: { 'user-agent': 'oneparty/0.1' } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** GET json with retries on 5xx/network errors. -> { json|null, failed } (a plain 404 is a clean "not found", not a failure) */
async function lrc(path, params) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://lrclib.net/api/' + path + '?' + new URLSearchParams(params), H);
      if (r.ok) return { json: await r.json(), failed: false };
      if (r.status === 404) return { json: null, failed: false };
    } catch { /* retry */ }
    await sleep(350 * (i + 1));
  }
  return { json: null, failed: true };
}
const baseTitle = t => t.replace(/\s*[-–]\s*[^-–]*\b(remix|mix|edit|version|remaster(ed)?|radio|extended|live|vip|bootleg|rework|flip)\b.*$/i, '').replace(/\s*[\(\[][^\)\]]*\b(remix|mix|edit|version|remaster(ed)?|radio|extended|live|vip|bootleg|rework|flip|feat\.?|with)\b[^\)\]]*[\)\]]/gi, '').trim() || t;
const fromEntry = (x, want) => {   // synced preferred; if the recording is a different length, stretch the timestamps to fit (approximate but readable)
  if (x.syncedLyrics) {
    const lines = parseLrc(x.syncedLyrics), k = x.duration && want && Math.abs(x.duration - want) > 6 ? want / x.duration : 1;
    return { synced: true, approx: k !== 1, lines: k === 1 ? lines : lines.map(l => ({ ...l, t: Math.round(l.t * k) })) };
  }
  if (x.plainLyrics) return { synced: false, lines: x.plainLyrics.split('\n').map(text => ({ t: null, text })) };
  return null;
};
export async function getLyrics(track) {
  if (!track) return null;
  if (cache.has(track.id)) return cache.get(track.id);
  const want = track.durationMs / 1000, titles = [...new Set([track.title, baseTitle(track.title)])], artists = [...new Set([track.artists[0] || '', track.artists.slice(0, 2).join(' ')])].filter(Boolean);
  let res = null, failed = false, best = null;
  // 1) exact lookup (title + artist + album + length)
  { const r = await lrc('get', { track_name: track.title, artist_name: artists[0] || '', album_name: track.album || '', duration: String(Math.round(want)) }); failed ||= r.failed; if (r.json) res = fromEntry(r.json, want); }
  // 2) search the title variants; prefer a synced entry whose length matches this recording, then the closest-length synced one (stretched), then plain text
  if (!res?.synced) for (const t of titles) for (const a of artists) {
    const r = await lrc('search', { track_name: t, artist_name: a }); failed ||= r.failed; if (!r.json?.length) continue;
    const byLen = r.json.slice().sort((x, y) => Math.abs((x.duration || 0) - want) - Math.abs((y.duration || 0) - want));
    const near = byLen.find(x => x.syncedLyrics && Math.abs((x.duration || 0) - want) <= 6);
    if (near) { res = fromEntry(near, want); break; }
    best ||= byLen.find(x => x.syncedLyrics && Math.abs((x.duration || 0) - want) <= 45) || (!res ? byLen.find(x => x.plainLyrics) : null);
  }
  if (!res?.synced && best) res = fromEntry(best, want) || res;
  if (res || !failed) cache.set(track.id, res);   // never cache a failed lookup - the hub retries
  return res;
}
