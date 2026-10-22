// Takeovers: full-screen states (whiteout, blackout, anything the user adds) that replace what every display, kiosk popup and light is doing.
// Definitions live in state.takeovers (persisted in settings.local.json, seeded from event.json `takeovers`), so they can be added, edited and
// removed through the `takeoverDef` command while the hub runs. The active one is state.takeover (an id or null).
//
//   { id, label, builtin?,
//     display: { type: 'color', color }          solid screen
//            | { type: 'whiteout3d' }            white with the spinning 3D DAWGHOUSE
//            | { type: 'html', html, color? }    your markup in a sandboxed (script-free) frame
//     popup:   { html?, color? }                 Home Assistant kiosk popup; no html = solid color. {{title}} {{subtitle}} are filled in
//     lights:  { mode: 'off' | 'color' | 'none', color?, brightness? } }
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_HTML = 20000;

const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const BUILTIN_TAKEOVERS = [
  {
    id: 'whiteout', label: 'Whiteout', builtin: true,
    display: { type: 'whiteout3d' },
    popup: { color: '#ffffff', html: '<div style="font-size:5vmin;letter-spacing:.1em;">{{subtitle}} @ THE</div><div style="font-size:12vmin;color:#ff7a10;">{{title}}</div>' },
    lights: { mode: 'color', color: '#ffffff', brightness: 255 },
  },
  {
    id: 'blackout', label: 'Blackout', builtin: true,
    display: { type: 'color', color: '#000000' },
    popup: { color: '#000000' },
    lights: { mode: 'off' },
  },
];

const hex = (v, fallback) => (HEX.test(v || '') ? v.toLowerCase() : fallback);
const html = v => (typeof v === 'string' ? v.slice(0, MAX_HTML) : '');

// Validate and clean a definition from the outside world. Returns { def } or { error }.
export function normalizeTakeover(raw, existing) {
  if (!raw || typeof raw !== 'object') return { error: 'def must be an object' };
  const id = String(raw.id || existing?.id || raw.label || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!id) return { error: 'def.id is required (letters, numbers, - _)' };
  const base = { ...existing, ...raw };
  const dt = base.display?.type;
  if (!['color', 'whiteout3d', 'html'].includes(dt)) return { error: 'display.type must be color, whiteout3d or html' };
  const display = dt === 'whiteout3d' ? { type: dt } : dt === 'html' ? { type: dt, html: html(base.display.html), color: hex(base.display.color, '#000000') } : { type: dt, color: hex(base.display.color, '#000000') };
  const popup = { color: hex(base.popup?.color, display.color || '#ffffff'), html: html(base.popup?.html) };
  const lm = ['off', 'color', 'none'].includes(base.lights?.mode) ? base.lights.mode : 'none';
  const lights = lm === 'color' ? { mode: lm, color: hex(base.lights.color, '#ffffff'), brightness: Math.min(255, Math.max(1, Math.round(+base.lights.brightness || 255))) } : { mode: lm };
  return { def: { id, label: String(base.label || id).slice(0, 40), ...(existing?.builtin && { builtin: true }), display, popup, lights } };
}

// What the Home Assistant kiosk popup shows while `def` is active.
export function takeoverPopup(def, state) {
  const fill = s => s.replace(/\{\{(title|subtitle)\}\}/g, (_, k) => escape(String(state.event?.[k] ?? '').toUpperCase()));
  const inner = def.popup.html ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vmin;width:100%;height:100%;font:900 system-ui;color:#111;text-align:center;">${fill(def.popup.html)}</div>` : '';
  return {
    title: 'Home Assistant Controllers', tag: 'oneparty-kiosks', initial_style: 'fullscreen', dismissable: false,
    content: `<main data-oneparty-takeover="${escape(def.id)}" style="position:fixed;inset:0;width:100%;height:100%;background:${def.popup.color};">${inner}</main>`,
  };
}
