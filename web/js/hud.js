// Stage HUD. Per-display toggles are channel overlays: nowplaying | lyrics | bubbles | announcements | motion
//   right, centre : now-playing card + lyrics
//   bottom right  : one rotating slot -> message bubbles, announcements, and "Next up" (same card format as now playing)
//   left          : Spotify Jam QR + guest-app (costume contest) QR (pin them, or let them come and go)
import { trackPosMs } from './bus.js';

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function createHud(root) {
  root.innerHTML = `
    <div class="left">
      <div class="jam" hidden><img class="qr" alt=""><div class="j-t">Scan to join the Jam</div><div class="j-s">Spotify Jam</div></div>
      <div class="jam ct" hidden><img class="qr" alt=""><div class="j-t"></div><div class="j-s"></div></div>
    </div>
    <div class="panel">
      <div class="np" hidden>
        <img class="art" alt="">
        <div class="meta"><div class="ttl"></div><div class="art-name"></div><div class="bar"><i></i></div><div class="tm"><span class="t0"></span><span class="t1"></span></div></div>
        <canvas class="viz"></canvas>
      </div>
      <div class="lyr empty" hidden><div class="vp"><div class="lines"></div></div></div>
    </div>
    <div class="bubbles" hidden><div class="slot"></div></div>
    <div class="bubbles top" hidden><div class="slot top"></div></div>`;
  const $ = s => root.querySelector(s);
  const np = $('.np'), lyr = $('.lyr'), lines = $('.lines'), jam = $('.jam:not(.ct)'), ct = $('.ct'), ctQr = ct.querySelector('.qr'), bubbles = $('.bubbles'), slot = $('.slot'), topWrap = $('.bubbles.top'), topSlot = $('.slot.top'), qr = $('.qr');
  const viz = root.querySelector('.viz');
  const npTtl = np.querySelector('.ttl'), npArtist = np.querySelector('.art-name'), npArt = np.querySelector('.art'), npBar = np.querySelector('.bar i');

  let track = null, lyrics = null, queue = [], lastIdx = -2, els = [];
  let posOffset = 0;   // ms: lyrics/progress shift for this display (buffered hub audio plays late, so its lyrics must too)
  let flags = { nowplaying: false, lyrics: false, bubbles: false, announcements: false, motion: false };
  let cfg = { bubbles: [], announcements: [], jam: {}, bubbleSeconds: 6, announceSeconds: 8, quietSeconds: 12 };
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  const mark = i => { for (let k = Math.max(0, i - 4); k <= Math.min(els.length - 1, i + 4); k++) { const d = Math.abs(k - i); els[k].className = 'ln' + (d === 0 ? ' c' : d === 1 ? ' n' : d === 2 ? ' m' : ''); } };
  const quietMs = () => (cfg.quietSeconds || 0) * 1000 * (0.7 + Math.random() * 0.6);   // jittered so it never feels like a metronome

  // ---------- spectrum visualizer: 8 bands (from the analyzer's 16), fast attack / slow release, falling peak caps, beat-reactive glow ----------
  const NB = 8, sm = new Float32Array(NB), pk = new Float32Array(NB), pv = new Float32Array(NB);
  let vizAcc = '#ff6a10', vizAccAt = 0;
  const bandsFrom = a => {   // browser-audio fallback: spread bass/mid/high across the bands
    const out = new Array(NB), t = performance.now() / 1000;
    for (let i = 0; i < NB; i++) { const u = i / (NB - 1), v = u < 0.5 ? a.bass + (a.mid - a.bass) * u * 2 : a.mid + (a.high - a.mid) * (u - 0.5) * 2; out[i] = Math.max(0, v * (0.85 + 0.15 * Math.sin(t * 7 + i * 1.7))); }
    return out;
  };
  function drawViz(a, beat) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(viz.clientWidth * dpr)), h = Math.max(2, Math.round(viz.clientHeight * dpr));
    if (viz.width !== w || viz.height !== h) { viz.width = w; viz.height = h; }
    const now = performance.now();
    if (now - vizAccAt > 1000) { vizAcc = getComputedStyle(root).getPropertyValue('--accent').trim() || vizAcc; vizAccAt = now; }
    const g = viz.getContext('2d'); g.clearRect(0, 0, w, h);
    const src = a.bands && a.bands.length === NB * 2 ? Array.from({ length: NB }, (_, i) => (a.bands[2 * i] + a.bands[2 * i + 1]) / 2) : bandsFrom(a);   // 16 analyzer bands -> 8 drawn
    const gap = w / NB * 0.3, bw = (w - gap * (NB - 1)) / NB, top = h * 0.94;
    for (let i = 0; i < NB; i++) {
      const v = Math.min(1, src[i] || 0);
      sm[i] += (v - sm[i]) * (v > sm[i] ? 0.55 : 0.12);
      if (sm[i] >= pk[i]) { pk[i] = sm[i]; pv[i] = 0; } else { pv[i] += 0.0008; pk[i] = Math.max(sm[i], pk[i] - pv[i]); }
      const x = i * (bw + gap), bh = Math.max(bw * 0.9, sm[i] * top);
      const grad = g.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, vizAcc); grad.addColorStop(1, '#ffffff');
      g.shadowColor = vizAcc; g.shadowBlur = h * (0.08 + 0.22 * beat + 0.2 * sm[i]);
      g.fillStyle = grad; g.beginPath(); g.roundRect(x, h - bh, bw, bh, bw / 2); g.fill();
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.9)';
      g.fillRect(x, Math.min(h - bw * 0.4, h - pk[i] * top - bw * 0.7), bw, Math.max(1.5, bw * 0.28));
    }
  }

  // ---------- bottom-right rotation: messages + announcements + next up ----------
  let bubCount = 0, poolIdx = 0, bubTimer = 0, bubCur = null, nextUpShownFor = null;
  const nextTrack = () => queue.find(Boolean);
  function pickBubble() {
    const nx = flags.bubbles ? nextTrack() : null;
    const pool = [
      ...(flags.bubbles ? cfg.bubbles.filter(Boolean).map(text => ({ kind: 'msg', text })) : []),
      ...(flags.announcements ? cfg.announcements.filter(a => a?.title).map(a => ({ kind: 'ann', ...a })) : []),
    ];
    const remaining = track ? track.durationMs - trackPosMs(track, posOffset) : Infinity;
    if (nx && track && remaining < 25000 && nextUpShownFor !== track.id) { nextUpShownFor = track.id; return { kind: 'next', nx }; }
    bubCount++;
    if (nx && (bubCount % 3 === 0 || !pool.length)) return { kind: 'next', nx };
    if (!pool.length) return null;
    return pool[poolIdx++ % pool.length];
  }
  function showBubble(b) {
    const el = document.createElement('div');
    el.className = 'bub ' + b.kind;
    if (b.kind === 'next') {
      el.innerHTML = `<img class="art" src="${esc(b.nx.art || '')}" alt=""><div class="meta"><div class="lab">NEXT UP</div><div class="ttl">${esc(b.nx.title)}</div><div class="art-name">${esc((b.nx.artists || []).join(', '))}</div></div>`;
    } else if (b.kind === 'ann') {
      const price = b.price || (!b.detail || b.detail.length > 9 ? '' : b.detail);        // older entries used a short detail as the price
      const desc = b.price ? b.detail : (price ? '' : b.detail);
      el.innerHTML = `<div class="a-main"><div class="a-tag"><i></i>${esc((b.category || 'SPECIAL').toUpperCase())}</div><div class="a-t">${esc(b.title)}</div>${desc ? `<div class="a-d">${esc(desc)}</div>` : ''}</div>${price ? `<div class="a-price">${esc(price)}</div>` : ''}`;
    } else el.innerHTML = `<span class="spark">✦</span><div class="bt">${esc(b.text)}</div>`;
    (b.kind === 'msg' ? topSlot : slot).appendChild(el); bubCur = el;   // messages drop in from the top; next-up / announcements stay bottom-right
    const hold = b.kind === 'next' ? 7000 : b.kind === 'ann' ? cfg.announceSeconds * 1000 : Math.min(9000, 3200 + b.text.length * 70) * (cfg.bubbleSeconds / 6);
    return hold;
  }
  function hideBubble(el) { if (!el) return; el.classList.add('out'); setTimeout(() => el.remove(), 900); }
  function bubbleTick(now) {
    if (!flags.bubbles && !flags.announcements) { if (bubCur) { hideBubble(bubCur); bubCur = null; } return; }
    if (now < bubTimer) return;
    if (bubCur) { hideBubble(bubCur); bubCur = null; bubTimer = now + Math.max(1400, quietMs()); return; }   // nothing on screen for a while
    const b = pickBubble();
    bubTimer = now + (b ? showBubble(b) : 2500);
  }

  // ---------- Jam QR (left) ----------
  const qrCard = (card, img, label) => {   // one QR card with its own come-and-go cycle (or pinned)
    let qrFor = null, phase = 'idle', timer = 0;
    const setQr = url => {   // retried until it actually renders; a failure is never cached
      if (!url) { img.removeAttribute('src'); qrFor = null; return false; }
      if (qrFor === url && img.getAttribute('src')) return true;
      if (!window.qrcode) return false;
      try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); img.src = q.createDataURL(8, 2); qrFor = url; return true; }
      catch (e) { console.warn(label + ' qr:', e.message); return false; }
    };
    return (now, url, pin) => {
      if (!(flags.announcements && url)) { card.hidden = true; phase = 'idle'; return; }
      if (!setQr(url)) { card.hidden = true; return; }
      if (pin) { card.hidden = false; card.classList.remove('out'); phase = 'show'; return; }
      if (now < timer) return;
      if (phase === 'show') { card.classList.add('out'); phase = 'out'; timer = now + 700; return; }
      if (phase === 'out') { card.hidden = true; phase = 'gap'; timer = now + Math.max(quietMs() * 4, 60000); return; }   // left-side QRs: rare (>= 1 min apart)
      card.classList.remove('out'); card.hidden = false; phase = 'show'; timer = now + cfg.announceSeconds * 1000;
    };
  };
  const jamCard = qrCard(jam, qr, 'jam'), contestCard = qrCard(ct, ctQr, 'contest');
  let contestUrl = '', lastS = null;
  const jamTick = now => jamCard(now, cfg.jam?.on && cfg.jam.url, cfg.jam?.pin);
  const contestTick = now => {   // the link is configurable (hud.contest.url); falls back to the connected guest app
    const k = cfg.contest || {}, url = k.on ? (k.url || lastS?.contest?.url || '') : '';
    ct.querySelector('.j-t').textContent = k.title || 'Costume contest'; ct.querySelector('.j-s').textContent = k.sub || 'Enter, vote & rate the music';
    contestUrl = url; contestCard(now, url, k.pin);
  };

  return {
    /** channel = state.channels[id], S = full state */
    update(channel, S) {
      const ov = new Set(channel?.overlays || []);
      const p = channel?.params || {};
      posOffset = (p.hubAudio && !(channel.mode === 'stream' && p.streamSound) ? -((p.hubBuffer ?? 3) * 1000 + 80) : 0) + (+p.lyricsOffset || 0);
      for (const k of Object.keys(flags)) flags[k] = ov.has(k);
      np.hidden = !flags.nowplaying; lyr.hidden = !flags.lyrics; bubbles.hidden = !(flags.bubbles || flags.announcements); topWrap.hidden = !flags.bubbles;
      root.classList.toggle('motion', flags.motion);
      const h = S.hud || {};
      lastS = S; cfg = { bubbles: h.bubbles || [], announcements: h.announcements || [], jam: h.jam || {}, contest: h.contest || {}, bubbleSeconds: h.bubbleSeconds || 6, announceSeconds: h.announceSeconds || 8, quietSeconds: h.quietSeconds ?? 12 };
      if (S.queue) queue = S.queue;
    },
    setQueue(q) { queue = q || []; },
    setTrack(t, l) {
      track = t; lyrics = l; lastIdx = -2;
      if (l && !l.synced && l.lines.length > 4 && t?.durationMs) {   // unsynced lyrics: pace the lines across the song
        const ls = l.lines.filter(x => x.text.trim());
        lyrics = { synced: true, plain: true, lines: ls.map((x, i) => ({ t: t.durationMs * (0.06 + 0.86 * i / ls.length), text: x.text })) };
      }
      setText(npTtl, t?.title || ''); setText(npArtist, t ? t.artists.join(', ') : '');
      if (t?.art && npArt.getAttribute('src') !== t.art) npArt.src = t.art;
      root.classList.toggle('idle', !t); root.classList.toggle('playing', !!t?.playing);
      const synced = !!lyrics?.synced && lyrics.lines.length > 0;
      lyr.classList.toggle('empty', !synced);
      lines.innerHTML = synced ? lyrics.lines.map(x => `<div class="ln">${esc(x.text) || '♪'}</div>`).join('') : '';
      lines.style.transform = ''; els = [...lines.children];
    },
    setProgress(t) { track = { ...track, ...t }; root.classList.toggle('playing', !!t?.playing); },
    /** per frame: audio bands (0..1) and beat envelope (0..1) drive the motion layer */
    audio(a, beatEnv) {
      if (!flags.motion) return;
      root.style.setProperty('--beat', beatEnv.toFixed(3));
      drawViz(a, beatEnv);
    },
    /** what is actually on screen - reported to the hub so it can be checked without a screenshot */
    status() {
      return {
        flags: Object.keys(flags).filter(k => flags[k]),
        jam: { configured: !!(cfg.jam?.on && cfg.jam.url), pinned: !!cfg.jam?.pin, visible: !jam.hidden, qrRendered: !!qr.getAttribute('src'), qrLib: !!window.qrcode },
        geo: (() => { if (jam.hidden) return null; const r = jam.getBoundingClientRect(), c = $('.left').getBoundingClientRect(), q = qr.getBoundingClientRect(); return { cardOffsetXFromColumnCenter: Math.round((r.left + r.right) / 2 - (c.left + c.right) / 2), qrOffsetXFromCardCenter: Math.round((q.left + q.right) / 2 - (r.left + r.right) / 2), cardOffsetYFromScreenCenter: Math.round((r.top + r.bottom) / 2 - innerHeight / 2) }; })(),
        contest: { configured: !!contestUrl, visible: !ct.hidden, qrRendered: !!ctQr.getAttribute('src') },
        slot: bubCur ? { kind: bubCur.className.replace('bub ', '').replace(' out', ''), text: bubCur.textContent.slice(0, 40) } : null,
        announcements: cfg.announcements.length, messages: cfg.bubbles.length,
      };
    },
    tick() {
      const now = performance.now();
      bubbleTick(now); jamTick(now); contestTick(now);
      if (!track) { window.oneLyrics = null; return; }
      const pos = Math.max(0, Math.min(track.durationMs, trackPosMs(track, posOffset)));
      // lyrics for scenes (window.oneLyrics): synced lines [{t ms, text}], current index (-1 before the first line), and playback position in ms
      { const L = lyrics?.synced ? lyrics.lines : []; let ci = -1; for (let k = 0; k < L.length && L[k].t <= pos; k++) ci = k;
        window.oneLyrics = { title: track.title, artist: track.artists.join(', '), lines: L, idx: ci, pos, plain: !!lyrics?.plain, playing: !!track.playing }; }
      const pct = (pos / track.durationMs * 100) + '%';
      if (!np.hidden) { npBar.style.width = pct; setText($('.t0'), fmt(pos)); setText($('.t1'), fmt(track.durationMs)); }
      if (lyr.hidden || !els.length) return;
      let i = -1; for (let k = 0; k < lyrics.lines.length && lyrics.lines[k].t <= pos; k++) i = k;
      if (i === lastIdx) return; lastIdx = i;
      if (i < 0) { els.slice(0, 5).forEach(e => (e.className = 'ln n')); lines.style.transform = ''; return; }
      mark(i);
      const el = els[i], vp = $('.vp');
      lines.style.transform = `translateY(${vp.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2)}px)`;
    },
  };
}
