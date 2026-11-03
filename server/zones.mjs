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
      exclude: [...new Set((m.exclude || []).filter(isLight))],   // lights removed by hand from a linked zone: the HA area sync must not re-add them
      extra: [...new Set((m.extra || []).filter(isLight))],   // lights pinned by hand to a linked zone (not in its HA area): kept across area re-syncs
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

  // ---- effect lights: strips / string lights / lamps with their own built-in scene list. In follow mode these run a rotating effect
  // (picked by the music's live hype) instead of a static colour; the rest of the zone still uses presets / palette spread.
  let fxLists = {}, fxAt = 0, scCtl = {}, scAt = 0, dirFlip = false;
  const sceneOnly = e => !!scCtl[e];   // lights that drop their scene as soon as colour/brightness is sent (Brizlabs): effect-only commands, no beat pulse
  const lastFx = new Map();   // entity -> last effect sent (never repeat back-to-back)
  const refreshFx = async (force) => { if (!ha.enabled || (!force && Date.now() - fxAt < 300000)) return; fxAt = Date.now(); try { fxLists = await ha.effectLists(); scCtl = await ha.sceneControls(); scAt = Date.now(); } catch (e) { log('[zones] effect discovery:', e.message); } };
  const HOT = /strobe|flash|jump|chase|race|run|shoot|laser|rainbow|energy|rock|pop|kpop|jazz|random|colorful|cycle|loop|wave|marquee|flush|magic|circulate|flicker|shuttle|rebound|fall|pile|flow|music|party|comet|scan|sparkle|twinkle|meteor|fire|blink|bounce/i;
  const CALM = /breath|fade|gradual|gradient|aurora|ocean|calm|solid|classical|cross fade|pride|sunrise|sunset|glow|pulse|slow|float|flutter|drift/i;
  const BAD = /^(solid|off|static)$/i;
  /** pick an effect for a light: hot ones when the music is hyped, calm ones in lulls, never the one already playing */
  function pickEffect(entity) {
    const list = (fxLists[entity] || []).filter(e => !BAD.test(e)); if (!list.length) return null;
    const hype = state.hype?.now ?? 5, hot = list.filter(e => HOT.test(e) && !CALM.test(e)), calm = list.filter(e => CALM.test(e) && !HOT.test(e)), mid = list.filter(e => !hot.includes(e) && !calm.includes(e));
    const pool = hype >= 6.5 ? (hot.length ? hot : list) : hype <= 3.5 ? (calm.length ? calm : mid.length ? mid : list) : (mid.length ? [...mid, ...hot] : list);
    const prev = lastFx.get(entity), opts = pool.filter(e => e !== prev), pick = (opts.length ? opts : pool)[Math.floor(Math.random() * (opts.length || pool.length))];
    lastFx.set(entity, pick); return pick;
  }
  const fxOf = z => z.lights.filter(e => fxLists[e]);
  // Brizlabs-style scene controls: speed follows the music's hype, palette follows the scene's colours, direction alternates each rotation
  const hueName = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40) return 'White'; let h = mx === r ? (g - b) / (mx - mn) * 60 : mx === g ? 120 + (b - r) / (mx - mn) * 60 : 240 + (r - g) / (mx - mn) * 60; h = (h + 360) % 360; return h < 20 || h >= 340 ? 'Red' : h < 45 ? 'Orange' : h < 75 ? 'Yellow' : h < 165 ? 'Green' : h < 200 ? 'Cyan' : h < 265 ? 'Blue' : 'Purple'; };
  const pickPalette = (cols, opts) => {
    const names = [...new Set((cols || []).map(hueName))], has = n => opts.find(o => o === n);
    if (names.length >= 4) return opts.find(o => /^Rainbow/.test(o)) ? opts.filter(o => /^Rainbow/.test(o))[Math.floor(Math.random() * opts.filter(o => /^Rainbow/.test(o)).length)] : null;
    const combo = opts.find(o => names.length > 1 && names.slice(0, 3).every(n => o.includes(n)) && o.split(/[+,]/).length === Math.min(names.length, 3)) || opts.find(o => names.length > 1 && names.slice(0, 2).every(n => o.includes(n)));
    return combo || has(names[0]) || null;
  };
  async function applySceneControls(ents, palette) {
    if (Date.now() - scAt > 300000) { scAt = Date.now(); scCtl = await ha.sceneControls(); }
    dirFlip = !dirFlip; const hype = state.hype?.now ?? 5;
    setTimeout(() => { for (const e of ents) { const c = scCtl[e]; if (!c) continue;   // the controls only come online once the scene effect is running
      ha.states().then(all => { const o = all.find(s => s.entity_id === c.palette)?.attributes?.options || []; return ha.setSceneControls(c, { speed: 25 + hype * 7, palette: pickPalette(palette, o), direction: dirFlip ? 'Left' : 'Right' }); }).catch(() => {}); } }, 2500).unref?.();
  }
  async function applyEffects(z, ents, cols, bri) {
    applySceneControls(ents, state.scenes.find(s => s.id === sceneOf(z))?.palette);
    const rs = await Promise.all(ents.map((e, i) => ha.lights([e], sceneOnly(e) ? { effect: pickEffect(e) } : { effect: pickEffect(e), color: cols[i % cols.length], brightness: Math.round(bri * (0.85 + 0.15 * ((i * 0.618) % 1))), transition: 0.4 }, { key: 'zone-fxrot:' + e, minGapMs: 0, urgent: true })));
    return rs.find(r => r?.error) || { ok: true };
  }
  /** rotate the effects of every follow-mode zone on a timer (haCfg.effectRotateSec, default 24s) */
  function rotateEffects(force) {
    if (!ha.enabled || state.takeover || state.lightsHold) return;
    for (const z of state.zones) {
      if (z.mode !== 'follow' || !fxOf(z).length) continue;
      const sc = state.scenes.find(s => s.id === sceneOf(z)), ents = fxOf(z);
      applyEffects(z, ents, distinctColors(sc?.palette || ['#ffffff'], ents.length), z.brightness ?? haCfg.brightness ?? 180).then(r => { if (state.zoneStatus[z.id]) state.zoneStatus[z.id].effects = Object.fromEntries(ents.map(e => [e, lastFx.get(e)])); });
    }
  }
  setInterval(rotateEffects, Math.max(8, haCfg.effectRotateSec ?? 24) * 1000).unref?.();
  refreshFx(true).then(() => state.zones?.length && sync(true));

  async function applyZone(z) {
    await refreshFx();
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
      const dyn = false;   // the beat-driven colour stepping (stepColours) replaces the preset shuffle loop, which would fight it
      const fx = fxOf(z), plain = z.lights.filter(e => !fx.includes(e));   // effect-capable lights always get a rotating effect (preferred over static looks)
      let r = { ok: true };
      if (fx.length) { await ha.stopDynamic(fx); r = await applyEffects(z, fx, distinctColors(sc?.palette || ['#ffffff'], fx.length), bri); st.effects = Object.fromEntries(fx.map(e => [e, lastFx.get(e)])); st.via = 'effects'; if (r.error) plain.push(...fx); }
      if (plain.length) {
        let r2;
        if (pid) {
          r2 = dyn ? await ha.dynamic(plain, pid, { brightness: bri, interval: haCfg.interval ?? 2, transition: haCfg.dynTransition ?? 1 }) : (await ha.stopDynamic(plain), await ha.preset(plain, pid, { brightness: bri }));
          st.via = (fx.length ? 'effects+' : '') + 'preset'; st.preset = presetName(pid);
        }
        if (!pid || r2?.error) {   // no preset for this scene (or HA refused it): spread the scene's palette across the remaining lights ourselves
          await ha.stopDynamic(plain);
          const cols = distinctColors(sc?.palette || ['#ffffff'], plain.length);
          const rs = await Promise.all(plain.map((e, i) => ha.lights([e], { color: cols[i], brightness: Math.round(bri * (0.8 + 0.2 * ((i * 0.618) % 1))), transition: 1 }, { key: 'zone-spread:' + e, minGapMs: 0, urgent: true })));
          r2 = rs.find(x => x.error) || { ok: true }; st.via = (fx.length ? 'effects+' : '') + 'palette'; st.preset = null;
        }
        r = r2;
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
  // Plain (non-effect) lights - Matter/TP-Link bulbs that fade - hop to a new palette colour on the beat (every beat when the music is hot, every 2nd/4th when calmer),
  // with a transition sized to the beat so they glide instead of snapping. The colours are the scene's palette plus hue-shifted variants so there's always something new.
  const colStep = new Map(), colAt = new Map();
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const t = k > 0 ? 255 : 0, f = Math.abs(k); r = Math.round(r + (t - r) * f); g = Math.round(g + (t - g) * f); b = Math.round(b + (t - b) * f); return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); };
  function stepColours(z, a, force) {
    const plain = z.lights.filter(e => !fxLists[e]); if (!plain.length) return;
    const now = Date.now(), hype = state.hype?.now ?? 5, every = hype >= 7 ? 1 : hype >= 4 ? 2 : 4;
    const n = (colStep.get(z.id) || 0) + 1; colStep.set(z.id, n); if (!force && n % every) return;
    if (now - (colAt.get(z.id) || 0) < 380) return; colAt.set(z.id, now);
    const sc = state.scenes.find(s => s.id === sceneOf(z)), base = sc?.palette?.length ? sc.palette : ['#ffffff'];
    const pool = [...distinctColors(base, Math.max(plain.length, 4)), ...base.map(c => shade(c, 0.35)), ...base.map(c => shade(c, -0.35))], bpm = state.bpm || 120;
    const tr = Math.max(0.25, Math.min(1.2, (60 / bpm) * every * 0.7)), bri = z.brightness ?? haCfg.brightness ?? 180, off = Math.floor(Math.random() * pool.length);
    plain.forEach((e, i) => ha.lights([e], { color: pool[(off + i * 2 + n) % pool.length], brightness: Math.min(255, Math.round(bri * (0.75 + 0.25 * Math.random()) + 70 * (a?.level ?? 0.5))), transition: tr }, { key: 'zone-col:' + e, minGapMs: 300 }));
  }
  setInterval(() => { if (state.takeover || state.lightsHold) return; for (const z of state.zones) if (z.mode === 'follow' && z.lights.length) stepColours(z, null, Date.now() - (colAt.get(z.id) || 0) > 3500); }, 1500).unref?.();   // no beat? still drift every few seconds
  function onBeat(a) {
    if (!a.beat || state.takeover || state.lightsHold) return;
    const now = Date.now(), base = haCfg.brightness ?? 180;
    for (const z of state.zones) {
      if (z.mode !== 'follow' || !z.beat || !z.lights.length) continue;
      for (const g0 of zoneGroups(z)) {
        const g = { ...g0, entities: g0.entities.filter(e => fxLists[e] && !sceneOnly(e)) }; if (!g.entities.length) continue;   // plain lights are colour-stepped below instead
        const key = z.id + ':' + g.name;
        if (!g.beat || now - (lastBeat.get(key) || 0) < g.minGapMs) continue;
        lastBeat.set(key, now);
        ha.lights(g.entities, { brightness: Math.min(255, (z.brightness ?? base) + 90 * a.level), transition: g.transition }, { key: 'zone-beat:' + key, minGapMs: g.minGapMs });
      }
      stepColours(z, a);
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
        for (const z of zs) { if (z.link && z.lights.includes(c.light) && c.zone !== z.id) z.exclude = [...new Set([...(z.exclude || []), c.light])]; z.lights = z.lights.filter(e => e !== c.light); applied.delete(z.id); }
        if (c.zone) { const z = zs.find(z => z.id === c.zone); z.exclude = (z.exclude || []).filter(e => e !== c.light); }
        for (const z of zs) z.extra = (z.extra || []).filter(e => e !== c.light);
        if (c.zone) { const z = zs.find(z => z.id === c.zone); z.lights.push(c.light); if (z.link) z.extra = [...(z.extra || []), c.light]; }
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
          if (ex) { ex.lights = [...new Set([...t.lights.filter(e => !(ex.exclude || []).includes(e)), ...(ex.extra || [])])]; applied.delete(ex.id); made.push(ex.id); continue; }
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
          const want = [...new Set([...t.lights.filter(e => !(z.exclude || []).includes(e)), ...(z.extra || [])])], same = want.length === z.lights.length && want.every(e => z.lights.includes(e));
          if (!same) { z.lights = want; applied.delete(z.id); changed.push(z.id); }
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
