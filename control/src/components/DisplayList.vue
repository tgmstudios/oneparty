<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { hub, cmd } from '../store.js';
import Seg from './Seg.vue';
import Switch from './Switch.vue';

const entries = computed(() => Object.entries(hub.S.channels).filter(([, c]) => c.role !== 'control'));
const offlineCount = computed(() => entries.value.filter(([, c]) => c.remote && !c.online).length);
const names = reactive({});   // in-progress renames, so a state push doesn't overwrite typing
const urls = reactive({}), streamMsg = reactive({}), busy = reactive({});
const screens = ref([]);
onMounted(() => fetch('/api/screens').then(r => r.json()).then(s => { screens.value = s; }).catch(() => {}));

const custom = c => c.remote || c.local;                       // added from the panel / joined: fully configurable
const setParam = (id, key, value) => cmd({ type: 'param', channel: id, key, value });
const configure = (id, patch) => cmd({ type: 'display', action: 'configure', id, ...patch });
const via = reactive({});   // per display: 'hub' (yt-dlp on the hub) | 'embed' (YouTube's own player)
const isYt = u => /youtu(.be|be.com|be-nocookie.com)/i.test(u || '');
const saved = reactive({});
const saveToLibrary = async (id, c) => { const r = await cmd({ type: 'dlAdd', urls: [c.params.stream], playlist: 'single', height: 1080 }); saved[id] = r.error || 'queued: see Media > Clip downloads'; };
const startStream = async (id, c, sound = !!c.params.streamSound) => {
  const url = (urls[id] ?? c.params.stream ?? '').trim(); if (!url) { streamMsg[id] = 'paste a link first'; return; }
  busy[id] = true; streamMsg[id] = 'looking it up…';
  const r = await cmd({ type: 'stream', channel: id, url, sound, via: via[id] ?? c.params.streamVia ?? 'hub' }); busy[id] = false;
  streamMsg[id] = r.error || ''; if (!r.error) delete urls[id];
};
const stopStream = id => cmd({ type: 'stream', channel: id, off: true });

// What this display's browser says about playing the hub audio (reported by the display page itself).
const audio = c => {
  if (!c.online) return { cls: '', text: 'offline', hint: '' };
  if (!c.caps?.includes('hubaudio')) return { cls: 'bad', text: 'old page: reload that tab', hint: 'This page loaded before audio streaming existed. Reload it.' };
  const a = c.hubAudioState;
  if (!a) return { cls: '', text: 'starting…', hint: '' };
  if (a.state === 'playing') return { cls: 'ok', text: 'playing', hint: '' };
  if (a.state === 'blocked') return { cls: 'warn', text: 'tap/click that screen to enable sound', hint: 'Browsers keep sound off until you interact with the page on that device.' };
  if (a.state === 'error') return { cls: 'bad', text: 'error: ' + (a.error || 'could not reach the hub'), hint: '' };
  return { cls: '', text: a.state, hint: '' };
};
const mainIds = computed(() => entries.value.filter(([, c]) => !custom(c)).map(([id]) => id));
const hubOutputs = computed(() => hub.S.audioDevices || []);
// A display playing to the very device the hub is capturing would feed back into itself.
const feedback = c => {
  const sink = (c.audioOutputs || []).find(o => o.id === c.params.hubSink)?.label?.toLowerCase(), want = (c.params.hubSource ? '' : hub.S.audioDevice || '').toLowerCase();
  const dev = hubOutputs.value.find(d => want && d.name.toLowerCase().includes(want))?.name?.toLowerCase();
  return !!(sink && dev && (sink.includes(dev) || dev.includes(sink)));
};

// One selector covers the three behaviours a display can have.
const typeOf = c => (c.follow ? 'mirror' : c.role);
const setType = (id, t) => configure(id, t === 'mirror' ? { follow: mainIds.value[0] || 'main' } : { role: t, follow: null });
const rename = (id, name) => { if (name.trim()) configure(id, { name }); delete names[id]; };
const remove = (id, c) => { if (confirm(c.local ? `Remove "${c.name}" and close its window?` : `Remove "${c.name}"? It re-registers itself if that device opens /join.html again.`)) cmd({ type: 'display', action: 'remove', id }); };
const seen = c => (c.online ? 'online' : c.lastSeen ? 'offline · seen ' + Math.max(1, Math.round((hub.now - c.lastSeen) / 60000)) + ' min ago' : 'not seen yet');
const types = [{ v: 'visuals', label: 'Visuals' }, { v: 'mirror', label: 'Mirror main' }, { v: 'videos', label: 'Videos' }];
const overlayList = [['nowplaying', 'Now playing'], ['lyrics', 'Lyrics'], ['bubbles', 'Bubbles'], ['announcements', 'Announcements'], ['motion', 'Motion']];
const toggleOverlay = (id, c, name) => cmd({ type: 'overlay', channel: id, name, on: !c.overlays.includes(name) });
const screenLabel = s => `${s.index + 1}: ${s.name} ${s.w}×${s.h}${s.primary ? ' (primary)' : ''}`;
</script>

<template>
  <section class="card">
    <h2>Displays <small>{{ entries.length }} total</small></h2>
    <div v-if="offlineCount" class="row" style="margin-bottom:10px">
      <button title="Forget every remote display that is offline (closed tabs, retired devices)" @click="cmd({ type: 'display', action: 'prune' })">Remove {{ offlineCount }} offline</button>
    </div>
    <div class="disp-list">
      <div v-for="[id, c] in entries" :key="id" class="disp">
        <div class="disp-h">
          <span class="dot" :class="c.online ? 'ok' : ''"></span>
          <input v-if="custom(c)" class="disp-name" :value="names[id] ?? c.name" @input="names[id] = $event.target.value" @change="rename(id, $event.target.value)">
          <b v-else class="disp-name">{{ id }}</b>
          <span class="role">{{ c.remote ? 'remote' : c.local ? 'monitor' : 'this PC' }}</span>
          <span class="grow"></span>
          <span class="mut" style="font-size:12px">{{ seen(c) }}</span>
          <button v-if="c.remote && c.online" title="Reload that page on the device" @click="cmd({ type: 'display', action: 'reload', id })">Reload</button>
          <template v-if="c.local">
            <button v-if="!c.online" @click="cmd({ type: 'display', action: 'launch', id })">Open window</button>
            <button v-else title="Close its window (the display stays configured)" @click="cmd({ type: 'display', action: 'close', id })">Close</button>
          </template>
          <button v-if="custom(c)" class="del" title="Remove" @click="remove(id, c)">✕</button>
        </div>

        <div v-if="c.local" class="row">
          <span class="mut" style="font-size:12px">Monitor</span>
          <select :value="c.monitor?.index ?? 0" @change="configure(id, { monitor: +$event.target.value })">
            <option v-for="s in screens" :key="s.index" :value="s.index">{{ screenLabel(s) }}</option>
          </select>
          <Switch :on="c.fullscreen ?? hub.S.kiosk" title="Borderless fullscreen on that monitor (off = a normal window)" @click="configure(id, { fullscreen: !(c.fullscreen ?? hub.S.kiosk) })">Fullscreen</Switch>
        </div>

        <div class="row">
          <span class="mut" style="font-size:12px">Type</span>
          <Seg v-if="custom(c)" :options="types" :model-value="typeOf(c)" @update:model-value="setType(id, $event)" />
          <span v-else class="role">{{ c.role }}</span>
          <template v-if="custom(c) && c.role !== 'videos'">
            <span class="mut" style="font-size:12px;margin-left:8px">Quality</span>
            <Seg :options="[540, 720, 1080, 1440].map(v => ({ v, label: v + 'p' }))" :model-value="c.params.maxH ?? (c.local ? 1080 : 1080)" @update:model-value="configure(id, { params: { maxH: $event } })" />
            <Seg :options="[24, 30, 60]" :model-value="c.params.fps ?? 30" @update:model-value="configure(id, { params: { fps: $event } })" />
          </template>
        </div>

        <div class="row">
          <span class="mut" style="font-size:12px">On screen</span>
          <Switch v-for="[k, l] in overlayList" :key="k" :on="c.overlays.includes(k)" @click="toggleOverlay(id, c, k)">{{ l }}</Switch>
          <template v-if="c.overlays.includes('lyrics')">
            <span class="mut" style="font-size:12px;margin-left:6px" title="Nudge the lyrics earlier (−) or later (+). Audio delay is already accounted for.">Lyrics timing</span>
            <Seg :options="[-1000, -500, 0, 500, 1000].map(v => ({ v, label: v > 0 ? '+' + v / 1000 + 's' : v / 1000 + 's' }))" :model-value="c.params.lyricsOffset ?? 0" @update:model-value="setParam(id, 'lyricsOffset', $event)" />
          </template>
        </div>

        <div v-if="custom(c) && c.role === 'visuals' && !c.follow" class="row">
          <Switch :on="c.params.autoRotate !== false" title="Takes part in Auto scenes: switches scene along with the main display, always to a different scene" @click="setParam(id, 'autoRotate', c.params.autoRotate === false)">Auto-rotate scenes</Switch>
        </div>

        <div v-if="custom(c)" class="aud-box">
          <div class="row">
            <Switch :on="!!c.params.hubAudio" title="Plays audio from the hub on this display (buffered, so a few seconds behind)" @click="setParam(id, 'hubAudio', !c.params.hubAudio)">Play audio here</Switch>
            <span v-if="c.params.hubAudio" class="aud-st" :class="audio(c).cls" :title="audio(c).hint">{{ audio(c).text }}</span>
          </div>
          <template v-if="c.params.hubAudio">
            <div class="row">
              <span class="mut" style="font-size:12px">Audio source</span>
              <select class="grow" :value="c.params.hubSource || ''" title="Which Windows output the hub captures and sends to this display" @change="setParam(id, 'hubSource', $event.target.value)">
                <option value="">Same as the visuals' analysis source</option>
                <option v-for="d in hubOutputs" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
            <div v-if="c.local" class="row">
              <span class="mut" style="font-size:12px">Play through</span>
              <select class="grow" :value="c.params.hubSink || ''" title="Which sound device this window plays to (e.g. the monitor's speakers or HDMI audio)" @change="setParam(id, 'hubSink', $event.target.value)">
                <option value="">Windows default output</option>
                <option v-for="o in c.audioOutputs || []" :key="o.id" :value="o.id">{{ o.label || o.id.slice(0, 8) }}</option>
              </select>
            </div>
            <div v-if="feedback(c)" class="err" style="font-size:12px">This display plays to the same device the hub is capturing: the sound will feed back into itself. Pick a different output or source.</div>
            <div class="row">
              <span class="mut" style="font-size:12px">Volume</span>
              <input type="range" min="0" max="1" step="0.05" style="width:130px" :value="c.params.hubVol ?? 1" @change="setParam(id, 'hubVol', +$event.target.value)">
              <span class="mut" style="font-size:12px;width:3.5ch">{{ Math.round((c.params.hubVol ?? 1) * 100) }}%</span>
              <span class="mut" style="font-size:12px;margin-left:6px" title="How far behind the hub the sound plays. Bigger = smoother on weak Wi-Fi. Visuals and lyrics are delayed by the same amount.">Delay</span>
              <Seg :options="[1, 2, 3, 5, 8, 12].map(v => ({ v, label: v + 's' }))" :model-value="c.params.hubBuffer ?? 3" @update:model-value="setParam(id, 'hubBuffer', $event)" />
            </div>
          </template>
        </div>

        <div class="stream-box">
          <div v-if="c.mode === 'stream' && c.params.streamTitle" class="row"><span class="tag">{{ c.params.streamLive ? 'LIVE' : 'video' }}</span><b style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.params.streamTitle }}</b></div>
          <div v-if="c.mode === 'stream'" class="row">
            <span class="dot ok"></span><span class="mut grow" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="c.params.stream">Streaming: {{ c.params.stream }}</span>
            <Switch :on="!!c.params.streamSound" title="Needs one tap on that device to start sound" @click="startStream(id, c, !c.params.streamSound)">Stream sound</Switch>
            <button @click="stopStream(id)">Stop</button>
          </div>
          <div class="row">
            <input class="grow" :value="urls[id] ?? ''" placeholder="Stream a YouTube link, live channel, .m3u8 or video URL" @input="urls[id] = $event.target.value" @keyup.enter="startStream(id, c)">
            <button :disabled="busy[id]" @click="startStream(id, c)">{{ c.mode === 'stream' ? 'Change' : 'Stream' }}</button>
          </div>
          <div v-if="isYt(urls[id] ?? c.params.stream)" class="row">
            <span class="mut" style="font-size:12px" title="Hub = yt-dlp + ffmpeg run on this PC and the tab just plays the result (works for live, no embed limits). Embed = YouTube's own player inside the tab.">Play via</span>
            <Seg :options="[{ v: 'hub', label: 'Hub (yt-dlp)' }, { v: 'embed', label: 'YouTube embed' }]" :model-value="via[id] ?? c.params.streamVia ?? 'hub'" @update:model-value="via[id] = $event" />
            <button v-if="c.mode === 'stream' && isYt(c.params.stream) && !c.params.streamLive" title="Download this video to the hub's clip library (media folder)" @click="saveToLibrary(id, c)">Save to library</button>
            <span v-if="saved[id]" class="mut" style="font-size:12px">{{ saved[id] }}</span>
          </div>
          <div v-if="streamMsg[id]" class="err" style="font-size:12px">{{ streamMsg[id] }}</div>
        </div>
        <div v-if="custom(c) && c.follow" class="mut" style="font-size:12px">Shows whatever “{{ c.follow }}” shows.</div>
        <div v-else-if="custom(c)" class="mut" style="font-size:12px">Pick its scene on the Live page.{{ c.remote ? ' This device does the rendering, so use 720p / 30 on a weak GPU.' : '' }}</div>
      </div>
      <div v-if="!entries.some(([, c]) => custom(c))" class="mut" style="font-size:12px">Nothing added yet. Add a monitor of this PC, or open the join address on another device; every extra tab there becomes its own display.</div>
    </div>
  </section>
</template>
