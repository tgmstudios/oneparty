// A direct media element output, independent of Windows' default and the hub analysis capture.
export function createYoutubeAudio({ audio, onState = () => {}, fetchInfo = fetch }) {
  let generation = 0, request, enabled = false, selection = null;
  audio.preload = 'none'; audio.muted = true; audio.loop = false;
  const state = (name, message) => onState(name, message);
  audio.addEventListener('playing', () => { if (enabled) state('playing', 'Playing YouTube on the selected speaker.'); });
  audio.addEventListener('pause', () => { if (enabled) state('paused', 'Paused.'); });
  audio.addEventListener('waiting', () => { if (enabled) state('buffering', 'Buffering YouTube audio… playback will continue automatically.'); });
  audio.addEventListener('stalled', () => { if (enabled) state('buffering', 'Waiting for more YouTube audio…'); });
  audio.addEventListener('ended', () => {
    if (!enabled || !selection) return;
    // The response is a forward-only stream: reopen it instead of trying to seek the old request.
    const { url, sink } = selection;
    void player.play(url, sink, true);
  });
  audio.addEventListener('error', () => {
    if (!enabled) return;
    enabled = false; audio.muted = true;
    state('error', 'YouTube audio could not play. Try the link again; if sign-in is required, connect YouTube under Media.');
  });
  function stop() {
    generation++; enabled = false; selection = null; request?.abort(); audio.pause(); audio.muted = true;
    audio.removeAttribute('src'); audio.load(); state('off', 'Stopped.');
  }
  const player = {
    stop,
    setVolume(value) { audio.volume = Math.max(0, Math.min(1, value)); },
    async play(url, sink, repeat = false) {
      stop();
      const mine = generation;
      try {
        if (!sink) throw new Error('Select a speaker first.');
        if (!audio.setSinkId) throw new Error('Use Chrome or Edge on localhost to choose a speaker.');
        state('loading', repeat ? 'Looping YouTube audio…' : 'Opening YouTube audio…');
        // Keep the element muted and without a source until the explicit output is accepted.
        await audio.setSinkId(sink);
        if (mine !== generation) return;
        request = new AbortController();
        const response = await fetchInfo('/api/ytaudio?info=1&url=' + encodeURIComponent(url), { signal: request.signal });
        if (response.status === 404) throw new Error('Restart oneparty to load the YouTube audio update, then try this link again.');
        const info = await response.json();
        if (!response.ok) throw new Error(info.error || 'Could not open YouTube audio.');
        if (mine !== generation) return;
        audio.src = '/api/ytaudio?url=' + encodeURIComponent(url) + (repeat ? '&repeat=' + mine : '');
        selection = { url, sink };
        enabled = true;
        audio.muted = false;
        state('ready', info.title + (info.live ? ' · LIVE' : ''));
        await audio.play();
      } catch (e) {
        if (mine !== generation || e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') state('blocked', 'Click the audio player’s Play button to enable sound.');
        else { enabled = false; audio.muted = true; state('error', e.message); }
      }
    },
  };
  return player;
}
