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
const SCOPES = 'user-read-playback-state user-read-currently-playing';
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createSpotify({ clientId, redirectUri, onTrack, log = console.log }) {
  let tok = fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null;
  let verifier = null, lastId = null, timer = null, state = { authed: !!tok };

  const save = t => { tok = { ...tok, ...t, expires_at: Date.now() + (t.expires_in - 30) * 1000 }; fs.writeFileSync(TOKEN_FILE, JSON.stringify(tok), { mode: 0o600 }); };
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
    const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, code_challenge_method: 'S256', code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), scope: SCOPES });
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
            id: it.id, title: it.name, artists: (it.artists || []).map(a => a.name), album: it.album?.name, durationMs: it.duration_ms,
            art: it.album?.images?.[0]?.url, progressMs: j.progress_ms, playing: j.is_playing, device: j.device?.name, at: Date.now(),
          });
        }
      }
    } catch (e) { log('[spotify]', e.message); next = 10000; }
    timer = setTimeout(poll, next);
  }
  return { loginUrl, callback, start: () => { if (tok) poll(); }, get authed() { return state.authed; }, enabled: !!clientId };
}
