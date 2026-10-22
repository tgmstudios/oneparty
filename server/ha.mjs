// Home Assistant control over a persistent WebSocket (REST fallback). Calls are rate-limited per entity group so audio-driven
// color changes can't flood bulbs/bridges.
// url = the Home Assistant address from HA_URL (often a proxied/public hostname). localIp (optional) = HA's address on the LAN:
// requests then go straight to it, with the Host header set to HA_URL's host (or `host`) so HA / a proxy in front of it still answers as that site.
import http from 'node:http';
import https from 'node:https';
import WebSocket from 'ws';

export function createHA({ url, token, localIp = '', host = '', log = console.log }) {
  const enabled = !!(url && token);
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  let local = null;   // { base, host } while a local address is in use
  const trim = u => String(u).replace(/\/$/, '');
  const base = () => (local ? local.base : trim(url));
  // fetch() won't let us set the Host header, so local-address requests go through node:http and come back as a Response
  function hfetch(target, init = {}) {
    if (!local || !target.startsWith(local.base)) return fetch(target, init);
    return new Promise((resolve, reject) => {
      const u = new URL(target), lib = u.protocol === 'https:' ? https : http, body = init.body;
      const req = lib.request(u, { method: init.method || 'GET', headers: { ...init.headers, ...(body != null && { 'content-length': Buffer.byteLength(body) }) }, signal: init.signal, ...(u.protocol === 'https:' && { rejectUnauthorized: false, servername: local.host.split(':')[0] }) }, res => {
        const chunks = []; res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(new Response([204, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
        res.on('error', reject);
      });
      req.on('error', reject); if (body != null) req.write(body); req.end();
    });
  }
  function setLocal(value) {
    value = String(value || '').trim(); delete headers.host; local = null; wsReset();
    if (!value) return { ok: true, via: 'url' };
    let u; try { u = new URL(/^https?:\/\//i.test(value) ? value : 'http://' + value); } catch { return { error: 'Not a valid address: ' + value }; }
    if (!u.port && u.protocol === 'http:' && !/^https?:\/\//i.test(value)) u.port = '8123';
    let h = host; if (!h) { try { h = new URL(url).host; } catch { h = ''; } }
    local = { base: trim(u.origin), host: h };
    if (h) headers.host = h;
    return { ok: true, via: 'local', base: local.base, host: h };
  }
  async function test() {
    if (!enabled) return { ok: false, error: 'HA_URL / HA_TOKEN not set' };
    const t = Date.now();
    try { const r = await hfetch(base() + '/api/', { headers, signal: AbortSignal.timeout(6000) }); return { ok: r.ok, status: r.status, ms: Date.now() - t, via: local ? 'local' : 'url', error: r.ok ? undefined : r.status === 401 ? 'Token rejected (401)' : 'HTTP ' + r.status }; }
    catch (e) { return { ok: false, ms: Date.now() - t, via: local ? 'local' : 'url', error: String(e.cause?.code || e.message) }; }
  }
  // No scheme given: try http, then https (HA behind a TLS proxy on 443/8443 is common) and keep the first that answers.
  async function connectLocal(value) {
    value = String(value || '').trim();
    if (!value || /^https?:\/\//i.test(value)) { const r = setLocal(value); return r.error ? r : { ...r, test: await test() }; }
    let first = null;
    for (const scheme of ['http://', 'https://']) {
      const r = setLocal(scheme + value); if (r.error) return r;
      const t = await test(); first ||= { ...r, test: t };
      if (t.ok) return { ...r, test: t };
    }
    setLocal(value); return first;
  }
  const last = new Map();

  // Persistent WebSocket (/api/websocket): service calls skip the per-request HTTP/TLS/auth cost and replies are matched by id.
  // Opened lazily on the first call; while it is down (connecting, dropped, auth failed) calls fall back to REST.
  const wsOn = process.env.HA_WS === '1';   // opt-in: measured no faster than REST on this setup
  let sock = null, wsReady = false, wsTimer = null, wsBackoff = 1000, msgId = 0;
  const pending = new Map(), transportErr = m => Object.assign(new Error(m), { transport: true });
  const wsStats = { sent: 0, fallback: 0, reconnects: 0, lastError: '' };
  function wsOpen() {
    if (!enabled || !wsOn || sock) return;
    const target = trim(base()).replace(/^http/, 'ws') + '/api/websocket';
    const opts = local ? { headers: local.host ? { host: local.host } : {}, ...(target.startsWith('wss:') && { rejectUnauthorized: false, servername: local.host.split(':')[0] }) } : {};
    let s; try { s = new WebSocket(target, opts); } catch (e) { wsStats.lastError = e.message; return wsRetry(); }
    sock = s;
    s.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === 'auth_required') s.send(JSON.stringify({ type: 'auth', access_token: token }));
      else if (m.type === 'auth_ok') { wsReady = true; wsBackoff = 1000; log('[ha] websocket connected'); }
      else if (m.type === 'auth_invalid') { wsStats.lastError = 'auth_invalid'; log('[ha] websocket token rejected; staying on REST'); s.close(); }
      else if (m.type === 'result' && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer);
        m.success ? p.resolve() : p.reject(new Error(m.error?.message || m.error?.code || 'ws error'));
      }
    });
    s.on('error', e => { wsStats.lastError = e.message; });
    s.on('close', () => {
      if (sock !== s) return;
      sock = null; wsReady = false;
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(transportErr('ws closed')); }
      pending.clear(); wsRetry();
    });
  }
  function wsRetry() {
    if (wsTimer) return;
    wsStats.reconnects++;
    wsTimer = setTimeout(() => { wsTimer = null; wsOpen(); }, wsBackoff); wsTimer.unref?.();
    wsBackoff = Math.min(wsBackoff * 2, 30000);
  }
  function wsReset() { const s = sock; sock = null; wsReady = false; wsBackoff = 1000; if (s) { try { s.close(); } catch {} } }
  const wsCall = (domain, service, data) => new Promise((resolve, reject) => {
    const { entity_id, ...service_data } = data, id = ++msgId;
    const msg = { id, type: 'call_service', domain, service, service_data };
    if (entity_id !== undefined) msg.target = { entity_id };
    if (data.targets) { delete msg.target; msg.service_data = data; }   // scene_presets takes its own `targets` field inside service_data
    const timer = setTimeout(() => { pending.delete(id); reject(transportErr('ws timeout')); }, 8000);
    pending.set(id, { resolve, reject, timer });
    sock.send(JSON.stringify(msg), e => { if (e) { pending.delete(id); clearTimeout(timer); reject(transportErr(e.message)); } });
  });

  if (localIp) setLocal(localIp);

  async function call(domain, service, data) {
    if (!enabled) return { skipped: 'homeassistant not configured' };
    wsOpen();
    if (wsReady && sock?.readyState === 1) {
      try { await wsCall(domain, service, data); wsStats.sent++; return { ok: true }; }
      catch (e) { if (!e.transport) throw new Error(`HA ${domain}.${service} -> ${e.message}`); wsStats.fallback++; }
    } else wsStats.fallback++;
    const r = await hfetch(`${base()}/api/services/${domain}/${service}`, { method: 'POST', headers, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`HA ${domain}.${service} -> ${r.status}`);
    return { ok: true };
  }
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  return {
    enabled,
    call,
    setLocal,
    connectLocal,
    test,
    info: () => ({ ws: { on: wsOn, ready: wsReady, ...wsStats }, url: url || '', via: local ? 'local' : 'url', local: local ? local.base : '', host: local?.host || '' }),
    async cameraStreamPath(entity) {
      if (!/^camera\.[a-z0-9_]+$/.test(entity)) throw new Error('Invalid camera entity');
      const r = await hfetch(base() + '/api/states/' + entity, { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HA camera -> ' + r.status);
      const camera = await r.json(), token = camera.attributes?.access_token;
      if (!token) throw new Error('Camera stream token not available');
      return '/api/camera_proxy_stream/' + entity + '?token=' + encodeURIComponent(token);
    },
    // The camera entity is HA's MJPEG integration pulling this hub's /api/kiosk.mjpeg, so its URL goes stale whenever the PC's IP changes.
    // Re-point it at hubBase ('http://ip:port') through the entry's options flow. Returns { ok, changed, from?, to? } or { skipped|error }.
    async syncMjpegCamera(entity, hubBase) {
      if (!enabled) return { skipped: 'homeassistant not configured' };
      if (!/^camera\.[a-z0-9_]+$/.test(entity || '')) return { skipped: 'no camera entity' };
      const jh = (path, init = {}) => hfetch(base() + path, { ...init, headers, signal: AbortSignal.timeout(10000) });
      const t = await jh('/api/template', { method: 'POST', body: JSON.stringify({ template: `{{ config_entry_id('${entity}') or '' }}` }) });
      if (!t.ok) return { error: 'HA template -> ' + t.status };
      const entryId = (await t.text()).trim();
      if (!entryId) return { skipped: entity + ' has no config entry' };
      const list = await jh('/api/config/config_entries/entry?domain=mjpeg');
      if (!list.ok) return { error: 'HA config entries -> ' + list.status };
      if (!(await list.json()).some(e => e.entry_id === entryId)) return { skipped: entity + ' is not an MJPEG camera' };
      const flow = await jh('/api/config/config_entries/options/flow', { method: 'POST', body: JSON.stringify({ handler: entryId }) });
      if (!flow.ok) return { error: 'HA options flow -> ' + flow.status };
      const form = await flow.json(), field = n => form.data_schema?.find(f => f.name === n);
      const cur = field('mjpeg_url')?.default || '', want = hubBase + '/api/kiosk.mjpeg';
      if (cur === want) { await jh('/api/config/config_entries/options/flow/' + form.flow_id, { method: 'DELETE' }).catch(() => {}); return { ok: true, changed: false }; }
      const data = { mjpeg_url: want, still_image_url: hubBase + '/api/kiosk.jpg', verify_ssl: field('verify_ssl')?.default ?? true };
      const user = field('username')?.description?.suggested_value; if (user) data.username = user;
      const r = await jh('/api/config/config_entries/options/flow/' + form.flow_id, { method: 'POST', body: JSON.stringify(data) });
      if (!r.ok) return { error: 'HA options flow submit -> ' + r.status };
      const out = await r.json();
      return out.type === 'create_entry' ? { ok: true, changed: true, from: cur, to: want } : { error: 'HA rejected camera URL: ' + JSON.stringify(out.errors || out.type) };
    },
    // Browser Mod browsers that are online but not named "Kiosk - …" yet (so kiosks() ignores them).
    async unnamedBrowsers() {
      if (!enabled) return [];
      const template = "{% set ns=namespace(items=[]) %}{% for e in integration_entities('browser_mod') %}{% if e.endswith('_browser_id') %}{% set d=device_id(e) %}{% set name=device_attr(d,'name_by_user') or '' %}{% if not name.startswith('Kiosk - ') and states(e) not in ['unknown','unavailable'] %}{% set ns.items=ns.items+[{'browserId':device_attr(d,'name'),'name':name,'path':states(e[:-3] ~ '_path'),'camera':(device_entities(d)|select('match','camera[.]')|first|default(''))}] %}{% endif %}{% endif %}{% endfor %}{{ ns.items|tojson }}";
      const r = await hfetch(base() + '/api/template', { method: 'POST', headers, body: JSON.stringify({ template }), signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HA browser discovery -> ' + r.status);
      return r.json();
    },
    // Give a Browser Mod browser the device name "Kiosk - <name>" (device registry update over a one-shot WebSocket) so kiosks() finds it.
    async nameKiosk(browserId, name) {
      if (!enabled) return { error: 'Home Assistant is not configured' };
      if (!/^browser_mod_[a-zA-Z0-9_-]+$/.test(browserId || '')) return { error: 'Invalid browser id' };
      const r = await hfetch(base() + '/api/template', { method: 'POST', headers, body: JSON.stringify({ template: "{% for e in integration_entities('browser_mod') %}{% if e.endswith('_browser_id') and device_attr(device_id(e),'name') == '" + browserId + "' %}{{ device_id(e) }}{% endif %}{% endfor %}" }), signal: AbortSignal.timeout(10000) });
      const deviceId = r.ok ? (await r.text()).trim() : '';
      if (!deviceId) return { error: 'HA has no such Browser Mod device' };
      const target = trim(base()).replace(/^http/, 'ws') + '/api/websocket';
      const opts = local ? { headers: local.host ? { host: local.host } : {}, ...(target.startsWith('wss:') && { rejectUnauthorized: false, servername: local.host.split(':')[0] }) } : {};
      return new Promise(resolve => {
        const s = new WebSocket(target, opts), done = v => { clearTimeout(t); try { s.close(); } catch {} resolve(v); }, t = setTimeout(() => done({ error: 'HA websocket timeout' }), 10000);
        s.on('error', e => done({ error: e.message }));
        s.on('message', raw => {
          let m; try { m = JSON.parse(raw); } catch { return; }
          if (m.type === 'auth_required') s.send(JSON.stringify({ type: 'auth', access_token: token }));
          else if (m.type === 'auth_ok') s.send(JSON.stringify({ id: 1, type: 'config/device_registry/update', device_id: deviceId, name_by_user: 'Kiosk - ' + name }));
          else if (m.type === 'auth_invalid') done({ error: 'HA rejected the token' });
          else if (m.type === 'result') done(m.success ? { ok: true } : { error: m.error?.message || 'HA refused the rename (the token needs admin rights)' });
        });
      });
    },
    async kiosks() {
      if (!enabled) return [];
      const template = `{% set ns=namespace(items=[]) %}{% for e in integration_entities('browser_mod') %}{% set d=device_id(e) %}{% set name=device_attr(d,'name_by_user') or '' %}{% if e.endswith('_browser_id') and name.startswith('Kiosk - ') %}{% set ns.items=ns.items+[{'name':name,'browserId':device_attr(d,'name'),'online':states(e) not in ['unknown','unavailable'],'path':states(e[:-3] ~ '_path'),'camera':(device_entities(d)|select('match','camera[.]')|first|default(''))}] %}{% endif %}{% endfor %}{{ ns.items|tojson }}`;
      const r = await hfetch(base() + '/api/template', { method: 'POST', headers, body: JSON.stringify({ template }), signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HA kiosk discovery -> ' + r.status);
      return r.json();
    },
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
    // scene_presets integration (Hypfer/hass-scene_presets): spreads a Hue-style preset's colors across the lights,
    // smart-shuffled so neighbours blend. apply_preset = once; dynamic = loop that re-shuffles every `interval` s.
    async preset(lights, presetId, { brightness, transition = 1.5 } = {}) {
      const data = { preset_id: presetId, targets: { entity_id: lights }, transition, shuffle: true, smart_shuffle: true };
      if (brightness != null) data.brightness = Math.round(brightness);
      try { return await call('scene_presets', 'apply_preset', data); } catch (e) { log('[ha]', e.message); return { error: e.message }; }
    },
    async dynamic(lights, presetId, { brightness, transition = 1, interval = 2 } = {}) {
      const data = { preset_id: presetId, targets: { entity_id: lights }, transition, interval };
      if (brightness != null) data.brightness = Math.round(brightness);
      try { return await call('scene_presets', 'start_dynamic_scene', data); } catch (e) { log('[ha]', e.message); return { error: e.message }; }
    },
    async stopDynamic(lights) {
      try { return await call('scene_presets', 'stop_dynamic_scenes_for_targets', { targets: { entity_id: lights } }); } catch (e) { return { error: e.message }; }
    },
    // Home Assistant areas + floors with the lights in each (rendered server-side with a Jinja template). WLED "segment" sub-lights are left out:
    // zones control the parent strip, and driving 25 segments individually would swamp the strip.
    async areas() {
      if (!enabled) return { areas: [], floors: [] };
      const render = async tpl => { const r = await hfetch(base() + '/api/template', { method: 'POST', headers, body: JSON.stringify({ template: tpl }) }); if (!r.ok) throw new Error('HA template -> ' + r.status); return r.text(); };
      const lights = "(area_entities(a) | select('match', 'light[.]') | reject('match', '.*_segment_[0-9]+$') | list)";
      const withFloors = "{% set ns = namespace(a=[]) %}{% for a in areas() %}{% set fid = floor_id(a) %}{% set ns.a = ns.a + [{'id': a, 'name': area_name(a), 'floor': fid, 'floor_name': (floor_name(fid) if fid else none), 'lights': " + lights + "}] %}{% endfor %}{{ ns.a | tojson }}";
      const noFloors = "{% set ns = namespace(a=[]) %}{% for a in areas() %}{% set ns.a = ns.a + [{'id': a, 'name': area_name(a), 'floor': none, 'floor_name': none, 'lights': " + lights + "}] %}{% endfor %}{{ ns.a | tojson }}";
      let list; try { list = JSON.parse(await render(withFloors)); } catch { list = JSON.parse(await render(noFloors)); }   // floors need HA 2024.4+
      const floors = new Map();
      for (const a of list) if (a.floor) { const f = floors.get(a.floor) || { id: a.floor, name: a.floor_name || a.floor, areas: [], lights: [] }; f.areas.push(a.id); f.lights.push(...a.lights); floors.set(a.floor, f); }
      return { areas: list.map(({ floor_name, ...a }) => a), floors: [...floors.values()].map(f => ({ ...f, lights: [...new Set(f.lights)] })) };
    },
    async scene(entity_id) { return call('scene', 'turn_on', { entity_id }); },
    async off(lights) { return call('light', 'turn_off', { entity_id: lights }); },
    async states() {
      if (!enabled) return [];
      const r = await hfetch(`${base()}/api/states`, { headers }); return r.ok ? r.json() : [];
    },
  };
}
