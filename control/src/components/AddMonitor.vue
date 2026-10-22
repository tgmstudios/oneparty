<script setup>
import { computed, onMounted, ref } from 'vue';
import { hub, cmd } from '../store.js';
import Seg from './Seg.vue';
import Switch from './Switch.vue';

// Add a window on one of THIS computer's monitors as a display of its own (own scene, overlays, audio).
const screens = ref([]), loading = ref(false), msg = ref('');
const name = ref(''), type = ref('visuals'), fullscreen = ref(true), pick = ref(0);
const load = async () => { loading.value = true; try { screens.value = await fetch('/api/screens').then(r => r.json()); } catch { screens.value = []; } loading.value = false; };
onMounted(load);
const onScreen = idx => Object.values(hub.S.channels).filter(c => c.role !== 'control' && (c.local ? c.monitor?.index === idx : false)).length;
const types = [{ v: 'visuals', label: 'Visuals' }, { v: 'mirror', label: 'Mirror main' }, { v: 'videos', label: 'Videos' }];
async function add() {
  const sc = screens.value[pick.value];
  const r = await cmd({ type: 'display', action: 'addLocal', name: name.value.trim() || (sc ? 'Monitor ' + (sc.index + 1) : 'Monitor'), monitor: pick.value, fullscreen: fullscreen.value,
    ...(type.value === 'mirror' ? { follow: Object.keys(hub.S.channels)[0] } : { role: type.value }) });
  msg.value = r.error || (r.launched?.error ? 'Added, but the window did not open: ' + r.launched.error : '');
  if (!r.error) name.value = '';
}
const screensOk = computed(() => screens.value.length > 0);
</script>

<template>
  <section class="card">
    <h2>Add a monitor <small>this computer</small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:10px">Open another display window on one of this PC's monitors. It gets its own scene, overlays, lyrics and audio settings below.</div>
    <div v-if="loading" class="mut">Looking for monitors…</div>
    <div v-else-if="!screensOk" class="mut" style="font-size:12px">No monitors detected. <a href="#" @click.prevent="load">Try again</a></div>
    <template v-else>
      <div class="mon-grid">
        <button v-for="s in screens" :key="s.index" class="mon" :class="{ on: pick === s.index }" @click="pick = s.index">
          <b>{{ s.index + 1 }}</b><span>{{ s.name }}</span><span class="mut">{{ s.w }}×{{ s.h }}{{ s.primary ? ' · primary' : '' }}</span>
          <span v-if="onScreen(s.index)" class="tag">{{ onScreen(s.index) }} added</span>
        </button>
      </div>
      <div class="row" style="margin-top:12px"><input class="grow" v-model="name" placeholder="Name, e.g. Bar TV" @keyup.enter="add"></div>
      <div class="row" style="margin-top:8px"><Seg :options="types" v-model="type" /><Switch :on="fullscreen" @click="fullscreen = !fullscreen">Fullscreen</Switch></div>
      <div class="row" style="margin-top:10px"><button class="on" @click="add">Add display on monitor {{ pick + 1 }}</button><a href="#" class="mut" style="font-size:12px" @click.prevent="load">Rescan</a></div>
      <div v-if="msg" class="err" style="font-size:12px;margin-top:6px">{{ msg }}</div>
    </template>
  </section>
</template>
