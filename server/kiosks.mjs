import { takeoverPopup } from './takeovers.mjs';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const caption = 'font:14px ui-monospace,monospace;color:var(--op-muted);';
const rgb = h => h.slice(1).match(/../g).map(v => parseInt(v, 16));
const blend = (a, b, amount) => '#' + rgb(a).map((v, i) => Math.round(v * amount + rgb(b)[i] * (1 - amount)).toString(16).padStart(2, '0')).join('');
// Stable during progress/pause updates; consecutive songs get clearly separated hues.
export function kioskSongHue(track, previous) {
  if (!track) return previous;
  const key = track.id || `${track.title || ''}|${(track.artists || []).join('|')}`;
  let hash = 2166136261;
  for (const ch of key) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  let hue = hash % 360;
  if (Number.isFinite(previous) && Math.abs(((hue - previous + 540) % 360) - 180) < 65) hue = (previous + 137) % 360;
  return hue;
}
const hueColor = hue => {
  const h = ((hue % 360) + 360) % 360 / 60, c = 0.72, x = c * (1 - Math.abs(h % 2 - 1));
  const parts = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)];
  return '#' + parts.map(v => Math.round((v + 0.18) * 255).toString(16).padStart(2, '0')).join('');
};
export function kioskTheme(state) {
  const channel = state.channels?.['controller-visual'];
  const scene = state.scenes?.find(s => s.id === channel?.scene);
  const palette = (Array.isArray(scene?.palette) ? scene.palette : []).filter(c => /^#[0-9a-f]{6}$/i.test(c));
  const primary = palette[0] || (/^#[0-9a-f]{6}$/i.test(state.event?.theme?.accent) ? state.event.theme.accent : '#d1b78f');
  const secondary = palette[1] || primary;
  const hue = Number.isFinite(state.kiosks?.songHue) ? state.kiosks.songHue : kioskSongHue(state.track);
  const accent = state.track ? blend(hueColor(hue), primary, 0.72) : primary;
  return { background: blend(accent, '#121412', 0.10), text: blend(primary, '#f3f3ed', 0.07), muted: blend(secondary, '#b8b8b0', 0.18), accent: blend(accent, '#ffffff', 0.85), border: blend(accent, '#383a36', 0.4) };
}


// Text stays static; each orientation fetches only its own low-resolution stream.
export function kioskPopup(state) {
  const takeover = state.takeover && state.takeovers?.find(d => d.id === state.takeover);
  if (takeover) return takeoverPopup(takeover, state);
  const track = state.track, hud = state.hud || {}, theme = kioskTheme(state);
  const welcome = [...new Set([...(hud.bubbles || []), state.kiosks.message].filter(v => typeof v === 'string' && v.trim()))];
  const announcements = (hud.announcements || []).filter(a => a?.title).map(a => `
    <article style="padding:22px 0;border-top:1px solid var(--op-border);">
      ${a.category ? `<p style="${caption}margin:0 0 10px;">${escape(a.category)}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:24px;">
        <h3 style="margin:0;font-size:clamp(25px,4vmin,40px);font-weight:500;line-height:1.2;">${escape(a.title)}</h3>
        ${a.price ? `<span style="font-size:clamp(25px,4vmin,40px);white-space:nowrap;font-variant-numeric:tabular-nums;">${escape(a.price)}</span>` : ''}
      </div>
      ${a.detail ? `<p style="margin:12px 0 0;white-space:pre-wrap;color:var(--op-muted);font-size:clamp(17px,2.5vmin,24px);line-height:1.5;">${escape(a.detail)}</p>` : ''}
    </article>`).join('');
  const jam = hud.jam?.on && /^https?:\/\//i.test(hud.jam.url || '') ? `<a href="${escape(hud.jam.url)}" target="_blank" rel="noopener noreferrer" style="display:block;padding:22px 0;border-top:1px solid var(--op-border);color:var(--op-accent);font-size:20px;">Join Spotify Jam &#8599;</a>` : '';
  const picture = orientation => state.kioskStreamPath ? `<picture class="op-visual-${orientation}" style="margin-top:28px;margin-left:auto;width:min(100%,760px,68vh);"><source media="(orientation:${orientation})" srcset="${escape(state.kioskStreamPath)}"><img data-oneparty-visual alt="" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:var(--op-bg);" /></picture>` : '';
  const cq = state.contestQr;   // guest-app QR (costume contest / voting / song ratings), same link as the display QR card
  const contestBlock = cq?.img ? `<div data-oneparty-contest-qr style="display:flex;align-items:center;gap:clamp(18px,3vmin,32px);padding:22px 0;border-top:1px solid var(--op-border);"><img alt="" src="${escape(cq.img)}" style="width:min(30vmin,220px);aspect-ratio:1;background:#fff;padding:8px;border-radius:12px;flex:none;" /><div><h3 style="margin:0;font-size:clamp(25px,4vmin,40px);font-weight:500;color:var(--op-accent);">${escape(cq.title || 'Costume contest')}</h3><p style="margin:10px 0 0;color:var(--op-muted);font-size:clamp(17px,2.5vmin,24px);line-height:1.4;">${escape(cq.sub || 'Scan to enter, vote & rate the music')}</p></div></div>` : '';
  const visual = picture('landscape');
  return {
    title: 'Home Assistant Controllers', tag: 'oneparty-kiosks', initial_style: 'fullscreen', dismissable: false,
    content: `<main data-oneparty-dashboard="noticeboard" style="--op-bg:${theme.background};--op-text:${theme.text};--op-muted:${theme.muted};--op-accent:${theme.accent};--op-border:${theme.border};position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;height:100dvh;overflow:auto;background:var(--op-bg);color:var(--op-text);padding:clamp(24px,5vmin,56px);font-family:Arial,Helvetica,sans-serif;overflow-wrap:anywhere;">
      <style>.op-visual-landscape,.op-visual-portrait {display:none} @media (orientation:landscape) {.op-visual-landscape {display:block}} @media (orientation:portrait) {.op-visual-portrait {display:block;width:100% !important;max-width:640px;margin:0 auto !important}.op-noticeboard-shell {gap:24px !important}.op-noticeboard-body {gap:24px !important}}</style>
      <div class="op-noticeboard-shell" style="max-width:1360px;min-height:100%;margin:auto;display:flex;flex-direction:column;gap:clamp(30px,6vmin,64px);">
        <header style="border-bottom:2px solid var(--op-border);padding-bottom:24px;display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px 32px;">
          <h1 style="margin:0;color:var(--op-accent);font:normal clamp(40px,7vmin,76px)/1.05 Georgia,serif;letter-spacing:-.035em;">${escape(state.event.title)}</h1>
          ${state.event.subtitle ? `<span style="font:italic clamp(22px,4vmin,36px)/1.2 Georgia,serif;color:var(--op-accent);">${escape(state.event.subtitle)}</span>` : ''}
        </header>
        <div class="op-noticeboard-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-content:start;gap:clamp(32px,7vmin,80px);flex:1;">
          <section data-oneparty-now-playing style="min-width:0;">
            <p style="${caption}margin:0 0 20px;color:var(--op-accent);">${track?.playing ? 'Now playing' : track ? 'Paused' : 'Music'}</p>
            <h2 style="color:var(--op-accent);font-size:clamp(30px,5.5vmin,58px);font-weight:500;line-height:1.1;margin:0;letter-spacing:-.025em;">${escape(track?.title || 'Nothing playing')}</h2>
            ${track?.artists?.length ? `<p style="font-size:clamp(21px,3.4vmin,34px);line-height:1.3;margin:18px 0 0;color:var(--op-muted);">${escape(track.artists.join(', '))}</p>` : ''}
            ${track?.album ? `<p style="font-size:clamp(15px,2vmin,20px);margin:14px 0 0;color:var(--op-muted);line-height:1.4;">${escape(track.album)}</p>` : ''}
          </section>
          ${announcements || jam || visual || contestBlock ? `<section data-oneparty-announcements style="min-width:0;"><h2 style="${caption}font-weight:normal;margin:0 0 18px;">Announcements</h2>${contestBlock}${announcements}${jam}${visual}</section>` : ''}
        </div>
        ${welcome.length ? `<aside style="border-top:1px solid var(--op-border);padding-top:24px;display:flex;flex-wrap:wrap;gap:16px 40px;">${welcome.map(w => `<p style="margin:0;white-space:pre-wrap;font-size:clamp(18px,2.8vmin,26px);line-height:1.4;color:var(--op-muted);">${escape(w)}</p>`).join('')}</aside>` : ''}
        ${picture('portrait')}
      </div>
    </main>`,
  };
}

// Payment screen taped to a drink station: prices, payment QR + link, and a live view of the kiosk's own front camera as a deterrent.
// The camera is the device's own getUserMedia inside an iframe (Browser Mod renders popup html via innerHTML, where a bare <script> would not run but an iframe's
// document does). Nothing is recorded or sent anywhere. state.kiosks.payment = { url, title, note }, state.payQr = data: URI or ''.
const cameraDoc = '<body style="margin:0;background:#111"><video id=v autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video><script>navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false}).then(function(s){v.srcObject=s;v.play()}).catch(function(){document.body.style.background="#2a2a2a"})</script></body>';
export function paymentPopup(state) {
  const p = state.kiosks.payment || {}, url = String(p.url || '').trim(), theme = kioskTheme(state);
  const shown = url.replace(/^https?:[/][/]/i, '').replace(/[/]$/, '');
  // Prices come from the announcements (Stage text): every announcement with a title, price on the right when it has one.
  const menu = ((state.hud || {}).announcements || []).filter(a => a?.title).map(a => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding:10px 0;border-top:1px solid ${theme.border};">
      <span style="font-size:clamp(22px,4.2vmin,40px);text-align:left;">${escape(a.title)}</span>
      ${a.price ? `<span style="font-size:clamp(22px,4.2vmin,40px);font-variant-numeric:tabular-nums;white-space:nowrap;color:${theme.accent};">${escape(a.price)}</span>` : ''}
    </div>`).join('');
  return {
    title: 'Home Assistant Controllers', tag: 'oneparty-kiosks', initial_style: 'fullscreen', dismissable: false,
    content: `<main data-oneparty-payment style="position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;background:${theme.background};color:${theme.text};padding:clamp(16px,3.5vmin,40px);font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;gap:clamp(12px,2.2vmin,26px);text-align:center;overflow:auto;">
      <h1 style="margin:0;color:${theme.accent};font:normal clamp(36px,8vmin,84px)/1.05 Georgia,serif;">${escape(p.title || 'Pay here')}</h1>
      ${menu ? `<div style="width:min(100%,640px);">${menu}</div>` : ''}
      ${state.payQr ? `<img data-oneparty-qr alt="" src="${escape(state.payQr)}" style="width:min(62vmin,380px);aspect-ratio:1;background:#fff;padding:10px;border-radius:12px;" />` : ''}
      ${shown ? `<div style="font-size:clamp(20px,4.4vmin,44px);font-weight:700;overflow-wrap:anywhere;">${escape(shown)}</div>` : ''}
      ${p.note ? `<p style="margin:0;font-size:clamp(16px,2.8vmin,28px);color:${theme.muted};white-space:pre-wrap;">${escape(p.note)}</p>` : ''}
      <div style="margin-top:auto;"><iframe data-oneparty-camera allow="camera" srcdoc="${escape(cameraDoc)}" style="border:2px solid ${theme.border};border-radius:12px;width:min(34vmin,260px);aspect-ratio:3/4;display:block;background:#111;"></iframe><p style="${caption}margin:6px 0 0;">Live camera</p></div>
    </main>`,
  };
}
