<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';
import Seg from './Seg.vue';

const props = defineProps({ id: String, c: Object });
const S = computed(() => hub.S);
const gpu = computed(() => S.value.gpu?.[props.id]);
const status = computed(() => S.value.sceneStatus?.[props.c.scene]);
const video = computed(() => props.c.mode === 'video');
const param = (k, d) => props.c.params[k] ?? d;
const setParam = (key, value) => cmd({ type: 'param', channel: props.id, key, value: +value });
const setMode = mode => cmd({ type: 'mode', channel: props.id, mode });
const pickScene = s => cmd({ type: 'scene', channel: props.id, scene: s.id, mode: video.value ? 'live' : undefined });
const toggleOverlay = name => cmd({ type: 'overlay', channel: props.id, name, on: !props.c.overlays.includes(name) });
const pickClip = async f => { await cmd({ type: 'param', channel: props.id, key: 'clip', value: f }); setMode('video'); };
const shortName = f => f.replace(/\.[a-z0-9]+$/i, '').replace(/^.* - (\d+ - )/, '$1').replace(/\s+[｜|].*$/, '').replace(/\s{2,}/g, ' ').slice(0, 34);
const grad = s => { const p = s.palette?.length ? s.palette : ['#444', '#222']; return `linear-gradient(135deg,${p[0]},${p[1] || p[0]} 55%,${p[2] || p[1] || p[0]})`; };
const overlays = [['nowplaying', 'Now playing'], ['lyrics', 'Lyrics'], ['bubbles', 'Bubbles'], ['announcements', 'Announcements'], ['motion', 'Motion']];
const reactOpts = [{ v: 0, label: 'Steady' }, { v: 0.35, label: 'Subtle' }, { v: 1, label: 'Full' }];
</script>

<template>
  <section class="card chan">
    <div class="chan-h">
      <b>{{ id === 'controller-visual' ? 'Controller camera' : c.name || id }}</b><span class="role">{{ c.remote ? 'remote' : c.role }}</span><span v-if="c.remote" class="dot" :class="c.online ? 'ok' : ''" :title="c.online ? 'online' : 'offline'"></span><span class="grow"></span>
      <template v-if="video">
        <span class="seg"><button class="on">video</button></span>
        <button class="chip" title="Back to the live scenes" @click="setMode('live')">← Scenes</button>
      </template>
      <Seg v-else :options="['live', 'cached', 'video']" :model-value="c.mode" @update:model-value="setMode" />
    </div>

    <div v-if="!video && c.mode !== 'stream'" class="tiles">
      <button v-for="s in S.scenes" :key="s.id" class="tile" :class="{ on: c.scene === s.id }" :style="{ '--g': grad(s) }" @click="pickScene(s)">
        <span class="id">{{ s.id }}</span>
        <span v-if="hub.cached.includes(s.id + '.webm')" class="bk">baked</span>
        <span class="nm">{{ s.title }}</span>
      </button>
    </div>
    <div v-else class="clips">
      <span class="mut" style="font-size:12px">Clip</span>
      <button class="chip" :class="{ on: !c.params.clip }" @click="pickClip('')">All, in order</button>
      <button v-for="f in hub.media" :key="f" class="chip" :class="{ on: c.params.clip === f }" :title="f" @click="pickClip(f)">{{ shortName(f) }}</button>
      <span v-if="!hub.media.length" class="mut" style="font-size:12px">no finished downloads yet - baked scenes play instead</span>
    </div>

    <div v-if="c.mode === 'stream'" class="row"><span class="dot ok"></span><span class="mut grow" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Streaming: {{ c.params.stream }}</span><button @click="cmd({ type: 'stream', channel: id, off: true })">Stop stream</button></div>
    <div v-if="c.follow" class="mut" style="font-size:12px">Mirrors “{{ c.follow }}”: change the scene there.</div>
    <div v-if="status?.ok === false" class="err">{{ status.error }}</div>

    <div class="opts">
      <Switch v-for="[k, l] in overlays" :key="k" :on="c.overlays.includes(k)" @click="toggleOverlay(k)">{{ l }}</Switch>
      <span class="grow"></span>
      <Seg :options="reactOpts" :model-value="param('react', 1)" title="How much the picture flashes and zooms with the music" @update:model-value="setParam('react', $event)" />
      <template v-if="!video">
        <span class="mut" style="font-size:12px" title="Speed of the background motion">Speed</span>
        <Seg :options="[0.25, 0.5, 1, 2, 3].map(v => ({ v, label: v + '×' }))" :model-value="param('speed', 1)" @update:model-value="setParam('speed', $event)" />
        <Seg :options="[540, 720, 1080, 1440].map(v => ({ v, label: v + 'p' }))" :model-value="param('maxH', S.kiosk ? 1440 : 720)" @update:model-value="setParam('maxH', $event)" />
        <Seg :options="[24, 30, 60]" :model-value="param('fps', S.kiosk ? 60 : 30)" @update:model-value="setParam('fps', $event)" />
      </template>
    </div>
    <div v-if="gpu" class="gpu mut" :class="{ sw: gpu.software }">GPU · {{ gpu.renderer }}</div>
  </section>
</template>
