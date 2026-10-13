// Home Assistant control over the REST API. Calls are rate-limited per entity group so audio-driven
// colour changes can't flood bulbs/bridges.
export function createHA({ url, token, log = console.log }) {
  const enabled = !!(url && token);
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  const last = new Map();

  async function call(domain, service, data) {
    if (!enabled) return { skipped: 'homeassistant not configured' };
    const r = await fetch(`${url.replace(/\/$/, '')}/api/services/${domain}/${service}`, { method: 'POST', headers, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`HA ${domain}.${service} -> ${r.status}`);
    return { ok: true };
  }
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  return {
    enabled,
    call,
    // lights: entity ids. opts: {color:'#rrggbb', brightness:0-255, transition:s}
    async lights(lights, { color, brightness, transition = 0.4, effect } = {}, { minGapMs = 250, key = 'default' } = {}) {
      const now = Date.now();
      if (now - (last.get(key) || 0) < minGapMs) return { skipped: 'rate-limited' };
      last.set(key, now);
      const data = { entity_id: lights, transition };
      if (color) data.rgb_color = hex(color);
      if (effect) data.effect = effect;
      if (brightness != null) data.brightness = Math.max(1, Math.min(255, Math.round(brightness)));
      try { return await call('light', 'turn_on', data); } catch (e) { log('[ha]', e.message); return { error: e.message }; }
    },
    async scene(entity_id) { return call('scene', 'turn_on', { entity_id }); },
    async off(lights) { return call('light', 'turn_off', { entity_id: lights }); },
    async states() {
      if (!enabled) return [];
      const r = await fetch(`${url.replace(/\/$/, '')}/api/states`, { headers }); return r.ok ? r.json() : [];
    },
  };
}
