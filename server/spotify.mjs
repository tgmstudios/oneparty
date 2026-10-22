// Spotify now-playing via the Web API, Authorization Code + PKCE (no client secret needed).
// Works with the desktop app or any device on the account, including when that device is in a Jam:
// /me/player reflects what the account's active device is playing.
// NOTE: Spotify removed audio-analysis/audio-features for new apps (Nov 2024) - audio reactivity comes from
// live audio capture in the browser, not from Spotify.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const TOKEN_FILE = path.join(ROOT, '.spotify-token.json');
const SCOPES = 'user-read-playback-state user-read-currently-playing user-modify-playback-state';
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createSpotify({ clientId, redirectUri, onTrack, log = console.log }) {
  let tok = fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null;
  let verifier = null, lastId = null, timer = null, state = { authed: !!tok };

  const save = t => { tok = { ...tok, ...t, scope: t.scope ?? tok?.scope, expires_at: Date.now() + (t.expires_in - 30) * 1000 }; fs.writeFileSync(TOKEN_FILE, JSON.stringify(tok), { mode: 0o600 }); };
  async function tokenReq(body) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, ...body }) });
    if (!r.ok) throw new Error('spotify token ' + r.status + ' ' + await r.text());
    return r.json();
  }
  async function access() {
    if (!tok) return null;
    if (Date.now() > tok.expires_at) save(await tokenReq({ grant_type: 'refresh_token', refresh_token: tok.refresh_token }));
    return tok.access_token;
  }

  function loginUrl() {
    verifier = b64u(crypto.randomBytes(48));
    const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, code_challenge_method: 'S256', code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), scope: SCOPES, show_dialog: 'true' });
    return 'https://accounts.spotify.com/authorize?' + q;
  }
  async function callback(code) {
    save(await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }));
    state.authed = true; poll();
  }

  async function poll() {
    clearTimeout(timer);
    let next = 4000;
    try {
      const at = await access();
      if (at) {
        const r = await fetch('https://api.spotify.com/v1/me/player?additional_types=track', { headers: { authorization: 'Bearer ' + at } });
        if (r.status === 429) next = (+r.headers.get('retry-after') || 10) * 1000;
        else if (r.status === 204) onTrack(null);
        else if (r.ok) {
          const j = await r.json(); const it = j.item;
          if (it) onTrack({
            id: it.id, isrc: it.external_ids?.isrc, title: it.name, artists: (it.artists || []).map(a => a.name), album: it.album?.name, durationMs: it.duration_ms,
            art: it.album?.images?.[0]?.url, progressMs: j.progress_ms, playing: j.is_playing, device: j.device?.name, volume: j.device?.volume_percent, shuffle: j.shuffle_state, repeat: j.repeat_state, at: Date.now(),
          });
        }
      }
    } catch (e) { log('[spotify]', e.message); next = 10000; }
    timer = setTimeout(poll, next);
  }
  const slim = it => ({ id: it.id, title: it.name, artists: (it.artists || []).map(a => a.name), art: it.album?.images?.at(-1)?.url, durationMs: it.duration_ms });
  const canControl = () => tok?.scope ? tok.scope.includes('user-modify-playback-state') : null;   // null = unknown (token predates scope tracking)
  const RELOGIN = 'Spotify needs a fresh login to allow playback control: open http://127.0.0.1:8787/auth/spotify/login and approve';
  async function api(method, url, retry = true) {
    const at = await access(); if (!at) return { error: 'Spotify not connected' };
    const r = await fetch('https://api.spotify.com/v1' + url, { method, headers: { authorization: 'Bearer ' + at } });
    if (r.ok || r.status === 204) return { ok: true, json: r.status === 200 ? await r.json().catch(() => null) : null };
    if (r.status === 401 && retry) { tok.expires_at = 0; return api(method, url, false); }   // stale token: refresh once
    if (r.status === 401 || r.status === 403) return { error: canControl() === true ? 'Spotify refused the command (playback control needs Premium)' : RELOGIN };
    if (r.status === 404) return { error: 'No active Spotify device - start playback somewhere first' };
    return { error: 'Spotify ' + r.status };
  }
  async function queue() {
    const r = await api('GET', '/me/player/queue').catch(() => null);
    return r?.json ? (r.json.queue || []).filter(Boolean).slice(0, 15).map(slim) : [];
  }
  const ACTIONS = {
    play: () => api('PUT', '/me/player/play'), pause: () => api('PUT', '/me/player/pause'),
    next: () => api('POST', '/me/player/next'), prev: () => api('POST', '/me/player/previous'),
    seek: c => api('PUT', `/me/player/seek?position_ms=${Math.max(0, Math.round(+c.ms) || 0)}`),
    volume: c => api('PUT', `/me/player/volume?volume_percent=${Math.min(100, Math.max(0, Math.round(+c.percent) || 0))}`),
    shuffle: c => api('PUT', `/me/player/shuffle?state=${!!c.on}`),
    repeat: c => api('PUT', `/me/player/repeat?state=${['off', 'track', 'context'].includes(c.mode) ? c.mode : 'off'}`),
  };
  async function control(c) {
    const fn = ACTIONS[c.action]; if (!fn) return { error: 'unknown player action ' + c.action };
    if (canControl() === false) return { error: RELOGIN };
    const r = await fn(c); setTimeout(poll, 400);   // refresh state right after a change
    return r.error ? { error: r.error } : { ok: true };
  }
  return { loginUrl, callback, queue, control, start: () => { if (tok) poll(); }, get authed() { return state.authed; }, get canControl() { return canControl(); }, enabled: !!clientId };
}
