// Shared client plumbing: SSE subscription + command helper.
export function connect(handlers) {
  let es;
  const open = () => {
    es = new EventSource('/api/events');
    for (const [type, fn] of Object.entries(handlers)) es.addEventListener(type, e => fn(JSON.parse(e.data)));
    es.onerror = () => { es.close(); setTimeout(open, 1500); };
  };
  open();
}
export const cmd = body => fetch('/api/cmd', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
export const postAudio = a => fetch('/api/audio', { method: 'POST', body: JSON.stringify(a), keepalive: true }).catch(() => {});

// Where in the current track are we right now? (server timestamps each sample; we extrapolate)
export function trackPosMs(track, offsetMs = 0) {
  if (!track) return 0;
  return track.progressMs + (track.playing ? Date.now() - track.at : 0) + offsetMs;
}
