// Now-playing + synced-lyrics overlay.
import { trackPosMs } from './bus.js';
export function createHud(root, overlays) {
  root.innerHTML = `
    <div class="np" hidden><img class="art"><div class="meta"><div class="ttl"></div><div class="art-name"></div><div class="bar"><i></i></div></div></div>
    <div class="lyr" hidden><div class="l prev"></div><div class="l cur"></div><div class="l next"></div></div>`;
  const $ = s => root.querySelector(s);
  const np = $('.np'), lyr = $('.lyr');
  let track = null, lyrics = null, offset = 0, lastIdx = -2;
  np.hidden = !overlays.includes('nowplaying'); lyr.hidden = !overlays.includes('lyrics');
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  return {
    setTrack(t, l) {
      track = t; lyrics = l; lastIdx = -2;
      $('.ttl').textContent = t?.title || ''; $('.art-name').textContent = t ? t.artists.join(', ') : '';
      if (t?.art) $('.art').src = t.art;
      root.classList.toggle('idle', !t);
    },
    setProgress(t) { track = { ...track, ...t }; },
    tick() {
      if (!track) return;
      const pos = trackPosMs(track, offset);
      $('.bar i').style.width = Math.min(100, pos / track.durationMs * 100) + '%';
      if (lyr.hidden) return;
      if (!lyrics?.synced) { ['.prev', '.cur', '.next'].forEach(k => setText($(k), '')); return; }
      let i = -1; for (let k = 0; k < lyrics.lines.length && lyrics.lines[k].t <= pos; k++) i = k;
      if (i === lastIdx) return; lastIdx = i;
      setText($('.prev'), lyrics.lines[i - 1]?.text || ''); setText($('.cur'), lyrics.lines[i]?.text || '♪'); setText($('.next'), lyrics.lines[i + 1]?.text || '');
    },
  };
}
