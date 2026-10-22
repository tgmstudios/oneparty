// Guest state, the API contract (GET /api/public /api/entries /api/results, POST /api/entry /api/vote /api/rate) and polling.
// Auth is the server-issued cookie; nothing here ever builds HTML from guest text.
import { reactive } from 'vue';

const TABS = ['costume', 'vote', 'music', 'pay'];
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };   // storage can be blocked
const hashTab = () => { const h = location.hash.slice(1); return TABS.includes(h) ? h : null; };   // /#vote deep links

export const g = reactive({
  S: null,                       // /api/public
  entries: [], results: null,    // vote list / final results
  busy: false, offline: false,
  tab: hashTab() || (TABS.includes(read('tab')) ? read('tab') : 'costume'),
  draft: { name: '', costume: '', touched: false },
  toast: { msg: '', err: false, on: false },
});

let toastT;
export function toast(msg, err = false) {
  g.toast = { msg, err, on: true }; clearTimeout(toastT);
  toastT = setTimeout(() => { g.toast.on = false; }, 2400);
}

export async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'something went wrong');
  return j;
}

// run a write; the server answers with the fresh /api/public view
export async function act(fn, ok) {
  if (g.busy) return; g.busy = true;
  try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, true); }
  g.busy = false;
}
export const saveEntry = () => api('/api/entry', { name: g.draft.name, costume: g.draft.costume }).then(S => { g.S = S; g.draft.touched = false; });
export const castVote = id => api('/api/vote', { entryId: id }).then(S => { g.S = S; });
export const rate = (trackId, stars) => api('/api/rate', { trackId, stars }).then(S => { g.S = S; });

// Costume photo: shrunk in the browser (phone photos are huge, and EXIF rotation is applied) then sent as a JPEG.
async function shrink(file, max = 1280) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error("That photo format isn't supported. Try a JPG or PNG."); }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('Could not read that photo'))), 'image/jpeg', 0.85));
}
export async function uploadPhoto(file) {
  const blob = await shrink(file);
  const r = await fetch('/api/photo', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'upload failed');
  g.S = j;
}
export const removePhoto = () => fetch('/api/photo', { method: 'DELETE' }).then(r => r.json()).then(j => { if (j.error) throw new Error(j.error); g.S = j; });

// Everything a screen needs is fetched BEFORE it is shown, so a switch (tab change, voting -> results) never flashes the previous or an empty screen.
async function load(tab) {
  const S = await api('/api/public'), out = { S };
  if (tab === 'vote') {
    if (S.config.showResults) out.results = (await api('/api/results')).results;
    else if (S.config.votingOpen) out.entries = (await api('/api/entries')).entries;
  }
  return out;
}
export async function setTab(id) {
  try { Object.assign(g, await load(id), { offline: false }); } catch { g.offline = true; }
  g.tab = id; try { localStorage.setItem('tab', id); } catch { /* ignore */ }
}

export async function refresh() {
  try { const next = await load(g.tab); if (!g.busy) Object.assign(g, next); g.offline = false; }
  catch { g.offline = true; /* later blips keep what is on screen */ }
}

export function startPolling() {
  refresh();
  setInterval(() => { if (!document.hidden && !g.busy) refresh(); }, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
