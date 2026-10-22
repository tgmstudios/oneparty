// oneparty guest app: costume contest entries + voting, and rating the music. Zero dependencies.
// Deployed on its own (cloud); the on-prem hub manages it through the key-protected /admin/* API.
//   guests : GET /api/public  GET /api/entries  GET /api/results  POST /api/entry  POST /api/vote  POST /api/rate
//   hub    : /admin/*  (header x-admin-key)
// A guest is identified by a server-issued cookie (a whole party shares one NAT'd IP, so IPs say nothing).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_JSON = 64 * 1024, MAX_IMAGE = 10 * 1024 * 1024, MAX_GUEST_PHOTO = 6 * 1024 * 1024;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const IMAGE_TYPES = [   // by magic bytes, never by the client's word (no SVG: it can carry script)
  { ext: '.jpg', ok: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', ok: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.webp', ok: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { ext: '.gif', ok: b => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')) },
];
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const httpsUrl = v => { try { const u = new URL(String(v)); return u.protocol === 'https:' ? u.href.slice(0, 500) : ''; } catch { return ''; } };
const DEFAULT_CONFIG = { title: 'Dawghouse Halloween', subtitle: 'Costume contest · music · drinks', accent: '#ff6a10', entriesOpen: true, votingOpen: false, ratingOpen: true, showResults: false, payTitle: 'Drinks & jungle juice', payUrl: '', payNote: '', payImage: null };

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

export function createApp({ dataDir, adminKey = '', webDir, trustProxy = false } = {}) {
  fs.mkdirSync(path.join(dataDir, 'img'), { recursive: true });
  const dbFile = path.join(dataDir, 'data.json'), imgDir = path.join(dataDir, 'img');
  let db = { config: { ...DEFAULT_CONFIG }, entries: {}, votes: {}, songs: {}, now: null, recent: [] };
  try { const saved = JSON.parse(fs.readFileSync(dbFile, 'utf8')); db = { ...db, ...saved, config: { ...DEFAULT_CONFIG, ...saved.config } }; } catch { /* first run */ }

  let saveT = null;
  const flush = () => { clearTimeout(saveT); saveT = null; const tmp = dbFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, dbFile); };
  const save = () => { saveT ??= setTimeout(() => { try { flush(); } catch (e) { console.error('[save]', e.message); } }, 250); saveT.unref?.(); };

  // ---------- small helpers ----------
  const bodyOf = (req, max) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', d => { n += d.length; if (n > max) { reject(new HttpError(413, 'too large')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
  const jsonBody = async req => { try { return JSON.parse((await bodyOf(req, MAX_JSON)).toString() || '{}') || {}; } catch (e) { throw e instanceof HttpError ? e : new HttpError(400, 'bad json'); } };
  const send = (res, code, o, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(o)); };
  const ipOf = req => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const buckets = new Map();   // key -> { n, reset }
  const limited = (key, max, windowMs = 60000) => {
    const now = Date.now(); let b = buckets.get(key);
    if (!b || now > b.reset) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
    return ++b.n > max;
  };
  setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60000).unref();

  const cookieOf = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, v.join('=')]));
  function guest(req, res) {   // existing id from the cookie, or a fresh one set on this response
    let id = cookieOf(req).g;
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
      id = crypto.randomBytes(16).toString('hex');
      const secure = trustProxy ? String(req.headers['x-forwarded-proto'] || '').startsWith('https') : req.socket.encrypted;
      res.setHeader('set-cookie', `g=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
    }
    return id;
  }
  const keyOk = req => {
    if (!adminKey) return false;
    const a = crypto.createHash('sha256').update(String(req.headers['x-admin-key'] || '')).digest(), b = crypto.createHash('sha256').update(adminKey).digest();
    return crypto.timingSafeEqual(a, b);
  };

  // ---------- views ----------
  const imageUrl = e => (e.image ? '/img/' + e.image : null);
  const counts = () => { const c = {}; for (const id of Object.values(db.votes)) c[id] = (c[id] || 0) + 1; return c; };
  const songStats = s => { const v = Object.values(s.ratings || {}); return { avg: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, count: v.length, dist: [1, 2, 3, 4, 5].map(n => v.filter(x => x === n).length) }; };
  const ranked = () => {
    const c = counts(), total = Object.values(c).reduce((a, b) => a + b, 0);
    return Object.values(db.entries).map(e => ({ id: e.id, name: e.name, costume: e.costume, image: imageUrl(e), votes: c[e.id] || 0, createdAt: e.createdAt }))
      .sort((a, b) => b.votes - a.votes || a.createdAt - b.createdAt)
      .reduce((out, e, i) => { out.push({ ...e, rank: i > 0 && out[i - 1].votes === e.votes ? out[i - 1].rank : i + 1, pct: total ? Math.round(e.votes / total * 100) : 0 }); return out; }, []);   // ties share a rank
  };
  const seeded = (arr, seed) => {   // stable per-guest order so the list does not reshuffle on every poll, and no entry always sits on top
    const h = s => crypto.createHash('md5').update(seed + s).digest('hex');
    return arr.map(x => [h(x.id), x]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(p => p[1]);
  };
  const trackView = t => t && { id: t.id, title: t.title, artists: t.artists, art: t.art };

  function publicView(g) {
    const mine = Object.values(db.entries).find(e => e.owner === g);
    const song = db.now && db.songs[db.now.id];
    const myStars = song?.ratings?.[g] || 0, st = song && songStats(song);
    return {
      config: (({ payImage, payUrl, payNote, payTitle, ...c }) => c)(db.config),
      pay: (c => (c.payUrl || c.payImage ? { title: c.payTitle, url: c.payUrl, note: c.payNote, image: c.payImage ? '/img/' + c.payImage : null } : null))(db.config),
      now: db.now ? { ...trackView(db.now), playing: db.now.playing !== false } : null,
      rating: db.now ? { mine: myStars, ...(myStars ? { avg: Math.round(st.avg * 10) / 10, count: st.count } : {}) } : null,
      me: { entry: mine ? { id: mine.id, name: mine.name, costume: mine.costume, image: imageUrl(mine) } : null, vote: db.votes[g] || null },
    };
  }

  // ---------- routes ----------
  async function guestApi(req, res, p) {
    const g = guest(req, res);
    if (limited('g:' + g, req.method === 'POST' ? 40 : 240)) throw new HttpError(429, 'slow down');
    const c = db.config;
    if (p === '/api/public' && req.method === 'GET') return send(res, 200, publicView(g));
    if (p === '/api/entries' && req.method === 'GET') {
      if (!c.votingOpen && !c.showResults) return send(res, 200, { entries: [] });
      const list = Object.values(db.entries).map(e => ({ id: e.id, name: e.name, costume: e.costume, image: imageUrl(e), mine: e.owner === g }));
      return send(res, 200, { entries: seeded(list, g) });
    }
    if (p === '/api/results' && req.method === 'GET') return c.showResults ? send(res, 200, { results: ranked() }) : send(res, 403, { error: 'results are not out yet' });
    if (p === '/api/entry' && req.method === 'POST') {
      const b = await jsonBody(req), name = clean(b.name, 40), costume = clean(b.costume, 80);
      if (!name || !costume) throw new HttpError(400, 'name and costume are both required');
      const mine = Object.values(db.entries).find(e => e.owner === g);
      if (!c.entriesOpen) throw new HttpError(403, 'entries are closed');
      if (mine) { mine.name = name; mine.costume = costume; }   // one entry per guest; sending again edits it
      else {
        if (Object.keys(db.entries).length >= 500) throw new HttpError(403, 'contest is full');
        const id = crypto.randomBytes(5).toString('hex');
        db.entries[id] = { id, owner: g, name, costume, image: null, createdAt: Date.now() };
      }
      save(); return send(res, 200, publicView(g));
    }
    if (p === '/api/photo' && (req.method === 'POST' || req.method === 'DELETE')) {   // a guest's own costume photo (the site shrinks it first): raw bytes, replaces the previous one
      const mine = Object.values(db.entries).find(e => e.owner === g);
      if (!mine) throw new HttpError(404, 'enter the contest first');
      if (!c.entriesOpen) throw new HttpError(403, 'entries are closed');
      if (req.method === 'DELETE') { dropImage(mine); save(); return send(res, 200, publicView(g)); }
      const buf = await bodyOf(req, MAX_GUEST_PHOTO), type = IMAGE_TYPES.find(t => buf.length > 16 && t.ok(buf));
      if (!type) throw new HttpError(415, 'jpg, png, webp or gif only');
      const file = crypto.randomBytes(8).toString('hex') + type.ext;
      fs.writeFileSync(path.join(imgDir, file), buf); dropImage(mine); mine.image = file; save();
      return send(res, 200, publicView(g));
    }
    if (p === '/api/vote' && req.method === 'POST') {
      const b = await jsonBody(req), e = db.entries[String(b.entryId)];
      if (!c.votingOpen) throw new HttpError(403, 'voting is closed');
      if (!e) throw new HttpError(404, 'no such entry');
      if (e.owner === g) throw new HttpError(403, "you can't vote for yourself");
      if (b.entryId === db.votes[g] || b.clear) delete db.votes[g]; else db.votes[g] = e.id;   // tapping your pick again clears it
      save(); return send(res, 200, publicView(g));
    }
    if (p === '/api/rate' && req.method === 'POST') {
      const b = await jsonBody(req), stars = Math.round(+b.stars), id = String(b.trackId || '');
      if (!c.ratingOpen) throw new HttpError(403, 'rating is closed');
      if (!(stars >= 1 && stars <= 5)) throw new HttpError(400, 'stars must be 1-5');
      const song = db.songs[id];
      if (!song || !db.recent.some(r => r.id === id && Date.now() - r.at < 4 * 60000)) throw new HttpError(409, 'that song is no longer playing');
      song.ratings[g] = stars; save(); return send(res, 200, publicView(g));
    }
    throw new HttpError(404, 'not found');
  }

  const adminState = () => {
    const c = counts();
    return {
      config: db.config, now: trackView(db.now), nowPlaying: db.now?.playing !== false,
      entries: Object.values(db.entries).sort((a, b) => a.createdAt - b.createdAt).map(e => ({ id: e.id, name: e.name, costume: e.costume, image: e.image, votes: c[e.id] || 0, createdAt: e.createdAt, host: e.owner === 'host' })),
      ranking: ranked(),
      songs: Object.values(db.songs).map(s => ({ id: s.id, title: s.title, artists: s.artists, art: s.art, plays: s.plays, firstAt: s.firstAt, ...songStats(s) })).sort((a, b) => b.avg - a.avg || b.count - a.count),
      totals: { entries: Object.keys(db.entries).length, votes: Object.keys(db.votes).length, ratings: Object.values(db.songs).reduce((n, s) => n + Object.keys(s.ratings).length, 0) },
    };
  };
  const dropImage = e => { if (e.image) { fs.rmSync(path.join(imgDir, e.image), { force: true }); e.image = null; } };

  async function adminApi(req, res, p, u) {
    if (!adminKey) throw new HttpError(503, 'admin disabled: set ADMIN_KEY on the server');
    const failKey = 'adminfail:' + ipOf(req);
    if ((buckets.get(failKey)?.n || 0) >= 20) throw new HttpError(429, 'too many bad keys, wait a minute');
    if (!keyOk(req)) { limited(failKey, 1e9); throw new HttpError(401, 'bad key'); }   // only wrong keys count
    const m = p.match(/^\/admin\/entries\/([a-f0-9]+)(\/image)?$/), e = m && db.entries[m[1]];
    if (p === '/admin/state' && req.method === 'GET') return send(res, 200, adminState());
    if (p === '/admin/config' && req.method === 'PUT') {
      const b = await jsonBody(req), c = db.config;
      if ('title' in b) c.title = clean(b.title, 60) || c.title;
      if ('subtitle' in b) c.subtitle = clean(b.subtitle, 80);
      if ('accent' in b && /^#[0-9a-f]{6}$/i.test(b.accent)) c.accent = b.accent;
      if ('payTitle' in b) c.payTitle = clean(b.payTitle, 60);
      if ('payNote' in b) c.payNote = clean(b.payNote, 200);
      if ('payUrl' in b) { const v = String(b.payUrl || '').trim(); if (v && !httpsUrl(v)) throw new HttpError(400, 'payment link must be an https:// link'); c.payUrl = v ? httpsUrl(v) : ''; }
      for (const k of ['entriesOpen', 'votingOpen', 'ratingOpen', 'showResults']) if (k in b) c[k] = !!b[k];
      save(); return send(res, 200, adminState());
    }
    if (p === '/admin/now' && req.method === 'PUT') {   // the hub reports what is playing: { track: {id,title,artists,art} | null, playing? }
      const b = await jsonBody(req), t = b.track;
      if (!t?.id) { db.now = null; save(); return send(res, 200, { ok: true }); }
      const id = clean(t.id, 80), prev = db.now;
      const meta = { id, title: clean(t.title, 120), artists: (Array.isArray(t.artists) ? t.artists : []).slice(0, 6).map(a => clean(a, 80)), art: httpsUrl(t.art) };
      db.now = { ...meta, playing: b.playing !== false };
      const s = (db.songs[id] ??= { id, ...meta, plays: 0, firstAt: Date.now(), ratings: {} });
      Object.assign(s, meta);
      if (prev?.id !== id) { s.plays++; db.recent = [{ id, at: Date.now() }, ...db.recent.filter(r => r.id !== id)].slice(0, 6); }
      else { const r = db.recent.find(x => x.id === id); if (r) r.at = Date.now(); }   // the playing song stays rateable
      save(); return send(res, 200, { ok: true });
    }
    if (p === '/admin/pay-image' && req.method === 'POST') {   // the Venmo QR picture
      const buf = await bodyOf(req, MAX_IMAGE), type = IMAGE_TYPES.find(t => buf.length > 16 && t.ok(buf));
      if (!type) throw new HttpError(415, 'jpg, png, webp or gif only');
      const file = crypto.randomBytes(8).toString('hex') + type.ext;
      fs.writeFileSync(path.join(imgDir, file), buf); if (db.config.payImage) fs.rmSync(path.join(imgDir, db.config.payImage), { force: true });
      db.config.payImage = file; save(); return send(res, 200, { ok: true, image: file, url: '/img/' + file });
    }
    if (p === '/admin/pay-image' && req.method === 'DELETE') { if (db.config.payImage) fs.rmSync(path.join(imgDir, db.config.payImage), { force: true }); db.config.payImage = null; save(); return send(res, 200, adminState()); }
    if (p === '/admin/entries' && req.method === 'POST') {   // add an entry for a guest without a phone
      const b = await jsonBody(req), name = clean(b.name, 40), costume = clean(b.costume, 80);
      if (!name || !costume) throw new HttpError(400, 'name and costume are required');
      const id = crypto.randomBytes(5).toString('hex');
      db.entries[id] = { id, owner: 'host', name, costume, image: null, createdAt: Date.now() };
      save(); return send(res, 200, adminState());
    }
    if (e && !m[2] && req.method === 'PATCH') {
      const b = await jsonBody(req);
      if ('name' in b) e.name = clean(b.name, 40) || e.name;
      if ('costume' in b) e.costume = clean(b.costume, 80) || e.costume;
      save(); return send(res, 200, adminState());
    }
    if (e && !m[2] && req.method === 'DELETE') {
      dropImage(e); delete db.entries[e.id];
      for (const [g, id] of Object.entries(db.votes)) if (id === e.id) delete db.votes[g];
      save(); return send(res, 200, adminState());
    }
    if (e && m[2] && req.method === 'POST') {   // raw image bytes in the body; the stored name is random so URLs cannot be guessed or collide
      const buf = await bodyOf(req, MAX_IMAGE), type = IMAGE_TYPES.find(t => buf.length > 16 && t.ok(buf));
      if (!type) throw new HttpError(415, 'jpg, png, webp or gif only');
      const file = crypto.randomBytes(8).toString('hex') + type.ext;
      fs.writeFileSync(path.join(imgDir, file), buf); dropImage(e); e.image = file; save();
      return send(res, 200, { ok: true, image: file, url: '/img/' + file });
    }
    if (e && m[2] && req.method === 'DELETE') { dropImage(e); save(); return send(res, 200, adminState()); }
    if (p === '/admin/reset' && req.method === 'POST') {
      const w = (await jsonBody(req)).what;
      if (w === 'votes' || w === 'all') db.votes = {};
      if (w === 'ratings' || w === 'all') for (const s of Object.values(db.songs)) s.ratings = {};
      if (w === 'entries' || w === 'all') { for (const x of Object.values(db.entries)) dropImage(x); db.entries = {}; db.votes = {}; }
      if (!['votes', 'ratings', 'entries', 'all'].includes(w)) throw new HttpError(400, 'what: votes | ratings | entries | all');
      save(); return send(res, 200, adminState());
    }
    throw new HttpError(404, 'not found');
  }

  function serveFile(res, dir, rel, headers = {}) {
    const f = path.resolve(dir, rel);
    if (!f.startsWith(dir + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', ...headers });
    fs.createReadStream(f).pipe(res);
  }
  const CSP = "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";

  const handler = async (req, res) => {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    try {
      if (limited('ip:' + ipOf(req), 6000)) throw new HttpError(429, 'slow down');
      if (p === '/healthz') return send(res, 200, { ok: true });
      if (p.startsWith('/api/')) return await guestApi(req, res, p);
      if (p.startsWith('/admin/')) return await adminApi(req, res, p, u);
      if (p.startsWith('/img/')) return serveFile(res, imgDir, decodeURIComponent(p.slice(5)), { 'cache-control': 'public, max-age=86400', 'content-security-policy': "default-src 'none'", 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' });   // costume photos are public; the hub's 3D leaderboard loads them as WebGL textures
      if (req.method !== 'GET') throw new HttpError(405, 'method not allowed');
      const rel = p === '/' ? 'index.html' : decodeURIComponent(p.slice(1));
      return serveFile(res, webDir, rel, { 'cache-control': 'no-cache', 'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' });
    } catch (e) {
      if (e instanceof HttpError) { if (!res.headersSent) send(res, e.code, { error: e.message }); else res.end(); }
      else { console.error('[error]', e); if (!res.headersSent) send(res, 500, { error: 'server error' }); }
    }
  };
  return { handler, flush, server: () => http.createServer(handler), _db: () => db };
}
