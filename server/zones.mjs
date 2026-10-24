// Lighting zones: a zone is a set of lights tied to one display. Whatever scene that display shows, the zone's lights take on that scene's look
// (its Home Assistant preset, or its palette spread across the lights), and pulse on the beat. Lights in a zone are removed from the global
// light set (the shared groups/allLights arrays are edited in place, so the light-show engine and global controls just stop touching them).
//
// state.zones = [{ id, name, display, mode: 'follow'|'color'|'off', color, brightness, beat, dynamic, preset, lights: [entity ids] }]
//   display   channel id whose scene this zone mirrors (null -> the first channel)
//   mode      follow = match the display's scene; color = fixed color; off = lights off
//   dynamic   true/false = loop/still preset shuffle, null = same as the global Loop switch
//   preset    optional preset pinned to this zone (overrides the per-scene preset)

const MODES = ['follow', 'color', 'off'];
const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const slug = s => String(s || 'zone').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'zone';

export function createZones({ state, ha, baseGroups, groups, allLights, haCfg, resolvePreset, presetName, distinctColors, onChange = () => {}, log = console.log }) {
  const baseLights = baseGroups.flatMap(g => g.entities);
  const isLight = e => typeof e === 'string' && /^light\.[\w]+$/.test(e);
  const applied = new Map();       // zone id -> signature of what was last sent
  const lastBeat = new Map();
  state.zoneStatus = state.zoneStatus || {};

  const display = z => (z.display && state.channels[z.display] ? z.display : Object.keys(state.channels)[0]);
  // a zone named like a display ("Upstairs" <-> a display called Upstairs TV) follows that display by default; otherwise the first channel
  const guessDisplay = name => {
    const n = String(name).toLowerCase();
    const hit = Object.entries(state.channels).find(([id, c]) => c.role !== 'control' && (c.name || id) && ((c.name || id).toLowerCase().includes(n) || n.includes((c.name || id).toLowerCase())));
    return hit ? hit[0] : null;
  };
  const sceneOf = z => state.channels[display(z)]?.scene;

  function clean(z, prev = {}) {
    const m = { ...prev, ...z };
    return {
      id: prev.id || m.id || slug(m.name),
      name: String(m.name ?? prev.name ?? 'Zone').trim().slice(0, 30) || 'Zone',
      display: m.display && state.channels[m.display] ? m.display : (m.display === null ? null : prev.display ?? null),
      mode: MODES.includes(m.mode) ? m.mode : 'follow',
      color: hexOk(m.color) ? m.color : '#ff6a10',
      brightness: m.brightness == null || m.brightness === '' ? null : Math.max(1, Math.min(255, Math.round(+m.brightness))),
      beat: m.beat !== false,
      dynamic: m.dynamic == null ? null : !!m.dynamic,
      preset: m.preset ? String(m.preset) : null,
      lights: [...new Set((m.lights || []).filter(isLight))],
      link: m.link && ['area', 'floor'].includes(m.link.type) && m.link.id ? { type: m.link.type, id: String(m.link.id) } : null,   // Home Assistant area/floor this zone's lights come from
    };
  }
  /** called once state.zones is loaded/changed: removes zoned lights from the shared global arrays (in place) */
  function rebuild() {
    state.zones = (state.zones || []).map(z => clean(z, z));
    const taken = new Set();
    for (const z of state.zones) { z.lights = z.lights.filter(e => !taken.has(e)); z.lights.forEach(e => taken.add(e)); }   // a light belongs to one zone
    groups.length = 0;
    for (const g of baseGroups) { const entities = g.entities.filter(e => !taken.has(e)); if (entities.length) groups.push({ ...g, entities }); }
    allLights.length = 0; allLights.push(...groups.flatMap(g => g.entities));
  }
  // lights outside the active profile (e.g. from another floor) are treated as slow bulbs
  const zoneGroups = z => {
    const gs = baseGroups.map(g => ({ ...g, entities: g.entities.filter(e => z.lights.includes(e)) })).filter(g => g.entities.length);
    const covered = new Set(gs.flatMap(g => g.entities)), extra = z.lights.filter(e => !covered.has(e));
    if (extra.length) gs.push({ name: 'ha', kind: 'bulb', minGapMs: 1000, transition: 0.6, beat: true, entities: extra });
    return gs;
  };

  async function applyZone(z) {
    const id = z.id, st = { at: Date.now(), scene: sceneOf(z), display: display(z), mode: z.mode, lights: z.lights.length };
    state.zoneStatus[id] = st;
    if (!z.lights.length || !ha.enabled) { st.ok = true; st.note = z.lights.length ? 'Home Assistant not configured' : 'no lights in this zone'; return; }
    try {
      const tl = state.takeover && state.takeovers.find(d => d.id === state.takeover)?.lights;
      if (tl?.mode === 'color') { await ha.stopDynamic(z.lights); const r = await ha.lights(z.lights, { color: tl.color, brightness: tl.brightness, transition: 0.3 }, { key: 'zone:' + id, minGapMs: 0, urgent: true }); st.ok = !r?.error; st.via = state.takeover; return; }
      if (tl?.mode === 'off' || z.mode === 'off') { await ha.stopDynamic(z.lights); const r = await ha.off(z.lights); st.ok = !r?.error; st.via = tl?.mode === 'off' ? state.takeover : 'off'; return; }
      if (z.mode === 'color') {
        await ha.stopDynamic(z.lights);
        const r = await ha.lights(z.lights, { color: z.color, brightness: z.brightness ?? haCfg.brightness ?? 180, transition: 1 }, { key: 'zone:' + id, minGapMs: 0, urgent: true });
        st.ok = !r?.error; st.via = 'color'; return;
      }
      // follow: the display's scene decides the look
      const scene = sceneOf(z), sc = state.scenes.find(s => s.id === scene), bri = z.brightness ?? haCfg.brightness ?? 180;
      const pid = resolvePreset(z.preset) || resolvePreset(haCfg.presets?.[scene]);
      const dyn = z.dynamic ?? state.lights.dynamic;
      let r;
      if (pid) {
        r = dyn ? await ha.dynamic(z.lights, pid, { brightness: bri, interval: haCfg.interval ?? 2, transition: haCfg.dynTransition ?? 1 }) : (await ha.stopDynamic(z.lights), await ha.preset(z.lights, pid, { brightness: bri }));
        st.via = 'preset'; st.preset = presetName(pid);
      }
      if (!pid || r?.error) {   // no preset for this scene (or HA refused it): spread the scene's palette across the zone's lights ourselves
        await ha.stopDynamic(z.lights);
        const cols = distinctColors(sc?.palette || ['#ffffff'], z.lights.length);
        const rs = await Promise.all(z.lights.map((e, i) => ha.lights([e], { color: cols[i], brightness: Math.round(bri * (0.8 + 0.2 * ((i * 0.618) % 1))), transition: 1 }, { key: 'zone-spread:' + e, minGapMs: 0, urgent: true })));
        r = rs.find(x => x.error) || { ok: true }; st.via = 'palette'; st.preset = null;
      }
      for (const g of zoneGroups(z)) { const fx = g.effects?.[scene]; if (fx) ha.lights(g.entities, { effect: fx }, { key: 'zone-fx:' + id + g.name, minGapMs: 0 }); }
      st.ok = !r?.error; if (r?.error) st.error = r.error;
    } catch (e) { st.ok = false; st.error = e.message; log('[zones]', e.message); }
  }

  const signature = z => [display(z), sceneOf(z), z.mode, z.color, z.brightness, z.dynamic, state.lights.dynamic, z.preset, state.takeover, JSON.stringify(state.takeovers?.find(d => d.id === state.takeover)?.lights), z.lights.join(',')].join('|');
  /** apply every zone whose inputs changed since the last apply (cheap: call it after any command) */
  function sync(force = false) {
    if (state.lightsHold) return;
    for (const z of state.zones) {
      const sig = signature(z);
      if (!force && applied.get(z.id) === sig) continue;
      applied.set(z.id, sig);
      applyZone(z).then(onChange);
    }
    for (const id of Object.keys(state.zoneStatus)) if (!state.zones.some(z => z.id === id)) delete state.zoneStatus[id];
  }
  /** beat pulse: brighten the zone on each beat, rate-limited per light kind (slow bulbs vs fast strips) */
  function onBeat(a) {
    if (!a.beat || state.takeover || state.lightsHold) return;
    const now = Date.now(), base = haCfg.brightness ?? 180;
    for (const z of state.zones) {
      if (z.mode !== 'follow' || !z.beat || !z.lights.length) continue;
      for (const g of zoneGroups(z)) {
        const key = z.id + ':' + g.name;
        if (!g.beat || now - (lastBeat.get(key) || 0) < g.minGapMs) continue;
        lastBeat.set(key, now);
        ha.lights(g.entities, { brightness: Math.min(255, (z.brightness ?? base) + 90 * a.level), transition: g.transition }, { key: 'zone-beat:' + key, minGapMs: g.minGapMs });
      }
    }
  }

  /** { action: add|update|remove|assign|flash|apply, ... } -> { ok, ... } (caller re-applies the global lights afterwards) */
  function command(c) {
    const zs = state.zones;
    switch (c.action) {
      case 'add': {
        let id = slug(c.name), n = 2; while (zs.some(z => z.id === id)) id = slug(c.name) + '-' + n++;
        zs.push(clean({ id, name: c.name || 'Zone', display: c.display || null, lights: c.lights || [] }));
        rebuild(); return { ok: true, id };
      }
      case 'update': {
        const i = zs.findIndex(z => z.id === c.id); if (i < 0) return { error: 'unknown zone ' + c.id };
        const { action, id, ...patch } = c; if ('mode' in patch && !MODES.includes(patch.mode)) return { error: 'mode must be ' + MODES.join('|') };
        if (patch.display && !state.channels[patch.display]) return { error: 'unknown display ' + patch.display };
        zs[i] = clean(patch, zs[i]); rebuild(); applied.delete(c.id); return { ok: true };
      }
      case 'remove': {
        const i = zs.findIndex(z => z.id === c.id); if (i < 0) return { error: 'unknown zone ' + c.id };
        zs.splice(i, 1); applied.delete(c.id); rebuild(); return { ok: true };
      }
      case 'assign': {   // move one light into a zone (zone null/'' = back to the global lights)
        if (!isLight(c.light)) return { error: 'not a light entity: ' + c.light };
        if (c.zone && !zs.some(z => z.id === c.zone)) return { error: 'unknown zone ' + c.zone };
        for (const z of zs) { z.lights = z.lights.filter(e => e !== c.light); applied.delete(z.id); }
        if (c.zone) zs.find(z => z.id === c.zone).lights.push(c.light);
        rebuild(); return { ok: true };
      }
      case 'flash': {   // identify a zone: flash its lights
        const z = zs.find(x => x.id === c.id); if (!z) return { error: 'unknown zone ' + c.id };
        ha.lights(z.lights, { color: hexOk(c.color) ? c.color : '#ffffff', brightness: 255, transition: 0 }, { key: 'zone-flash:' + z.id, minGapMs: 0, urgent: true });
        setTimeout(() => { applied.delete(z.id); sync(); }, 900);   // then put the zone back to what it was doing
        return { ok: true };
      }
      case 'import': {   // { kind: 'area'|'floor', ids?: [...] | 'all', data: <ha.areas()> } -> create (or relink) a zone per area/floor
        const kind = c.kind === 'floor' ? 'floor' : 'area', pool = (kind === 'floor' ? c.data?.floors : c.data?.areas) || [];
        const want = c.ids === 'all' || !c.ids ? pool : pool.filter(x => c.ids.includes(x.id));
        const made = [], skipped = [];
        for (const t of want) {
          if (!t.lights.length) { skipped.push(t.name + ' (no lights)'); continue; }
          const ex = zs.find(z => z.link?.type === kind && z.link.id === t.id);
          if (ex) { ex.lights = t.lights.slice(); applied.delete(ex.id); made.push(ex.id); continue; }
          let id = slug(t.name), n = 2; while (zs.some(z => z.id === id)) id = slug(t.name) + '-' + n++;
          zs.push(clean({ id, name: t.name, display: guessDisplay(t.name), lights: t.lights, link: { type: kind, id: t.id } })); made.push(id);
        }
        rebuild(); return { ok: true, zones: made, skipped };
      }
      case 'sync': {   // re-read the lights of every linked zone (or one) from Home Assistant { id?, data }
        const changed = [];
        for (const z of zs) {
          if (!z.link || (c.id && z.id !== c.id)) continue;
          const t = (z.link.type === 'floor' ? c.data?.floors : c.data?.areas)?.find(x => x.id === z.link.id);
          if (!t) { state.zoneStatus[z.id] = { ...state.zoneStatus[z.id], linkNote: 'not found in Home Assistant any more' }; continue; }
          const same = t.lights.length === z.lights.length && t.lights.every(e => z.lights.includes(e));
          if (!same) { z.lights = t.lights.slice(); applied.delete(z.id); changed.push(z.id); }
          if (state.zoneStatus[z.id]?.linkNote) delete state.zoneStatus[z.id].linkNote;
        }
        if (changed.length) rebuild(); return { ok: true, changed };
      }
      case 'apply': for (const z of zs) if (!c.id || z.id === c.id) applied.delete(z.id); return { ok: true };
      default: return { error: 'action must be add|update|remove|assign|flash|apply' };
    }
  }
  return { rebuild, sync, onBeat, command, baseLights, get zonedLights() { return state.zones.flatMap(z => z.lights); } };
}
