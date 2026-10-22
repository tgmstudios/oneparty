// Hub side of the cloud guest app (public/): costume contest + music ratings + payment info.
// The hub is the manager: it reports the playing song, mirrors the admin state (entries, votes, song scores) into hub state,
// and forwards edits/uploads using the app's admin key. The key never leaves this process (not in state, not in broadcasts).
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
export const normalizeUrl = v => {
  const s = String(v || '').trim().replace(/\/+$/, ''); if (!s) return '';
  try { const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); return u.origin + u.pathname.replace(/\/+$/, ''); } catch { return ''; }
};

export function createContest({ imgDir, onChange, getTrack, env = process.env, fetchImpl = fetch }) {
  fs.mkdirSync(imgDir, { recursive: true });
  const cfg = { url: normalizeUrl(env.PARTY_API_URL), key: env.PARTY_API_KEY || '' };   // runtime edits (control panel) override the .env defaults
  const board = { on: false, reveal: 0, top: 5 };
  let data = null, error = '', at = 0, pushed = '', timer = null, sig = '';

  async function call(method, route, body, { raw, type } = {}) {
    if (!cfg.url || !cfg.key) throw new Error('not connected: set the guest app URL and admin key');
    const r = await fetchImpl(cfg.url + route, {
      method, signal: AbortSignal.timeout(15000),
      headers: { 'x-admin-key': cfg.key, ...(raw ? { 'content-type': type } : body ? { 'content-type': 'application/json' } : {}) },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 401 ? 'the guest app rejected the admin key' : j.error || 'guest app answered ' + r.status);
    return j;
  }

  const imageUrl = file => (!file ? null : fs.existsSync(path.join(imgDir, file)) ? '/contest/' + file : cfg.url + '/img/' + file);   // local copy first: works if the internet drops mid-party
  const view = () => {
    const d = data;
    const ranking = (d?.ranking || []).map(r => ({ ...r, image: r.image ? imageUrl(r.image.replace(/^\/img\//, '')) : null }));
    const entries = (d?.entries || []).map(e => ({ ...e, imageUrl: imageUrl(e.image) }));
    return {
      url: cfg.url, keySet: !!cfg.key, connected: !!d && !error, error, at,
      config: d?.config || null, now: d?.now || null, totals: d?.totals || null, songs: d?.songs || [],
      entries, ranking, board: { ...board, shown: Math.min(board.reveal, board.top) },
      payImageUrl: d?.config?.payImage ? imageUrl(d.config.payImage) : null,
    };
  };
  const publish = () => { const s = JSON.stringify({ ...view(), at: 0 });   // the poll timestamp alone is not a change
    if (s !== sig) { sig = s; onChange(); } };

  async function pushNow() {   // report the song to the guest app whenever it differs from what the app already has
    const t = getTrack(), key = t ? t.id + (t.playing ? '1' : '0') : '';
    if (key === pushed && !(data && (data.now?.id || '') !== (t?.id || ''))) return;
    await call('PUT', '/admin/now', { track: t ? { id: t.id, title: t.title, artists: t.artists, art: t.art } : null, playing: !!t?.playing });
    pushed = key;
  }
  async function refresh() {
    if (!cfg.url || !cfg.key) { data = null; error = ''; publish(); return; }
    try { await pushNow(); data = await call('GET', '/admin/state'); error = ''; at = Date.now(); }
    catch (e) { error = String(e.message || e).replace(cfg.key, '***'); }
    publish();
    mirrorImages();
  }
  const mirroring = new Set();
  function mirrorImages() {   // guests upload their own photos to the cloud app: keep a local copy of each so the leaderboard survives the venue internet dropping
    for (const file of [...(data?.entries || []).map(e => e.image), data?.config?.payImage]) {
      if (!/^[a-f0-9]+\.(jpg|png|webp|gif)$/.test(file || '') || mirroring.has(file) || fs.existsSync(path.join(imgDir, file))) continue;
      mirroring.add(file);
      fetchImpl(cfg.url + '/img/' + file, { signal: AbortSignal.timeout(20000) })
        .then(async r => { if (!r.ok) throw new Error(r.status); fs.writeFileSync(path.join(imgDir, file), Buffer.from(await r.arrayBuffer())); publish(); })
        .catch(() => { /* retried on a later poll */ }).finally(() => mirroring.delete(file));
    }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => refresh().finally(schedule), board.on ? 2000 : 5000); timer.unref?.(); };

  const send = async (fn) => { try { await fn(); } catch (e) { return { error: String(e.message || e).replace(cfg.key || '\u0000', '***') }; } await refresh(); return { ok: true }; };
  const num = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v) || 0));

  const api = {
    start() { refresh().finally(schedule); },
    refresh, view, pushNow,
    settings: () => ({ url: cfg.url, key: cfg.key, board: { ...board } }),   // for settings.local.json only
    restore(s) { if (!s) return; if (s.url) cfg.url = normalizeUrl(s.url); if (s.key) cfg.key = String(s.key); if (s.board) Object.assign(board, { on: !!s.board.on, reveal: num(s.board.reveal, 0, 50), top: num(s.board.top, 1, 10) || 5 }); },
    async saveImage(kind, id, buf, type) {   // kind: 'entry' | 'pay'. Forwards to the guest app and keeps a local copy for the displays.
      const ext = IMAGE_EXT[String(type).split(';')[0].trim()];
      if (!ext) return { error: 'jpg, png, webp or gif only' };
      if (!/^[a-f0-9]+$/.test(String(id || '')) && kind === 'entry') return { error: 'bad entry id' };
      try {
        const r = await call('POST', kind === 'pay' ? '/admin/pay-image' : `/admin/entries/${id}/image`, null, { raw: buf, type });
        if (/^[a-f0-9]+\.(jpg|png|webp|gif)$/.test(r.image || '')) fs.writeFileSync(path.join(imgDir, r.image), buf);
      } catch (e) { return { error: String(e.message || e) }; }
      await refresh(); return { ok: true };
    },
    async command(c) {   // { action, ... } from POST /api/cmd {type:'contest'}
      switch (c.action) {
        case 'connect': {
          if (typeof c.url === 'string') cfg.url = normalizeUrl(c.url);
          if (typeof c.key === 'string' && c.key.trim()) cfg.key = c.key.trim();
          data = null; error = ''; pushed = '';
          await refresh();
          return error ? { error } : { ok: true }; }
        case 'refresh': await refresh(); return error ? { error } : { ok: true };
        case 'config': { const { title, subtitle, accent, entriesOpen, votingOpen, ratingOpen, showResults, payTitle, payUrl, payNote } = c; return send(() => call('PUT', '/admin/config', { title, subtitle, accent, entriesOpen, votingOpen, ratingOpen, showResults, payTitle, payUrl, payNote })); }
        case 'addEntry': return send(() => call('POST', '/admin/entries', { name: c.name, costume: c.costume }));
        case 'editEntry': return send(() => call('PATCH', `/admin/entries/${encodeURIComponent(c.id)}`, { name: c.name, costume: c.costume }));
        case 'removeEntry': return send(() => call('DELETE', `/admin/entries/${encodeURIComponent(c.id)}`));
        case 'removeImage': return send(() => c.id === 'pay' ? call('DELETE', '/admin/pay-image') : call('DELETE', `/admin/entries/${encodeURIComponent(c.id)}/image`));
        case 'reset': return send(() => call('POST', '/admin/reset', { what: c.what }));
        case 'board': {   // leaderboard on the displays: { on?, top?, reveal?: n | 'next' | 'all' | 'none' }
          if (c.top != null) board.top = num(c.top, 1, 10) || 5;
          if (c.reveal === 'next') board.reveal = Math.min(board.top, board.reveal + 1);
          else if (c.reveal === 'all') board.reveal = board.top;
          else if (c.reveal === 'none') board.reveal = 0;
          else if (c.reveal != null) board.reveal = num(c.reveal, 0, board.top);
          if (c.on != null) { board.on = !!c.on; if (board.on && c.reveal == null && board.reveal > board.top) board.reveal = 0; }
          schedule(); if (board.on) await refresh(); else publish();
          return { ok: true }; }
        default: return { error: 'unknown contest action ' + c.action };
      }
    },
  };
  return api;
}
