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
  if (state.whiteout) return { title: 'Home Assistant Controllers', tag: 'oneparty-kiosks', initial_style: 'fullscreen', dismissable: false, content: '<main data-oneparty-whiteout style="position:fixed;inset:0;width:100%;height:100%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vmin;font:900 system-ui;color:#111;"><div style="font-size:5vmin;letter-spacing:.1em;">HALLOWEEN @ THE</div><div style="font-size:12vmin;color:#ff7a10;">DAWGHOUSE</div></main>' };
  if (state.blackout) return { title: 'Home Assistant Controllers', tag: 'oneparty-kiosks', initial_style: 'fullscreen', dismissable: false, content: '<main data-oneparty-blackout style="position:fixed;inset:0;width:100%;height:100%;background:#000;"></main>' };
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
          ${announcements || jam || visual ? `<section data-oneparty-announcements style="min-width:0;"><h2 style="${caption}font-weight:normal;margin:0 0 18px;">Announcements</h2>${announcements}${jam}${visual}</section>` : ''}
        </div>
        ${welcome.length ? `<aside style="border-top:1px solid var(--op-border);padding-top:24px;display:flex;flex-wrap:wrap;gap:16px 40px;">${welcome.map(w => `<p style="margin:0;white-space:pre-wrap;font-size:clamp(18px,2.8vmin,26px);line-height:1.4;color:var(--op-muted);">${escape(w)}</p>`).join('')}</aside>` : ''}
        ${picture('portrait')}
      </div>
    </main>`,
  };
}
