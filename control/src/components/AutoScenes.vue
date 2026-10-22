<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';
import Seg from './Seg.vue';

const S = computed(() => hub.S);
const A = computed(() => S.value.auto);
const pool = computed(() => A.value?.pool || S.value.scenes.map(s => s.id));
const remotes = computed(() => Object.values(S.value.channels).filter(c => c.remote && c.online && c.role === 'visuals' && !c.follow && ['live', 'cached'].includes(c.mode) && c.params.autoRotate !== false).length);
const status = computed(() => !A.value.on ? 'off' : (A.value.last ? `last: ${A.value.last.scene} (${A.value.last.why})` : 'listening for the beat') + (remotes.value ? ` · +${remotes.value} remote` : ''));
const set = patch => cmd({ type: 'autoscene', ...patch });
const toggleScene = id => {
  const next = pool.value.includes(id) ? pool.value.filter(x => x !== id) : [...pool.value, id];
  if (next.length) set({ pool: next.length === S.value.scenes.length ? null : next });
};
</script>

<template>
  <section v-if="A" class="card">
    <h2>Auto scenes <small>{{ status }}</small></h2>
    <div class="row">
      <Switch :on="A.on" @click="set({ on: !A.on })">On</Switch>
      <Switch :on="A.onSong" title="Cut when the song changes" @click="set({ onSong: !A.onSong })">New song</Switch>
      <Switch :on="A.onDrop" title="Cut when the music drops back in after a quiet bit" @click="set({ onDrop: !A.onDrop })">Drops</Switch>
      <Switch :on="A.shuffle" title="Random order (off = in order)" @click="set({ shuffle: !A.shuffle })">Shuffle</Switch>
    </div>
    <div class="opts" style="margin-top:12px">
      <label>Every <input type="number" min="1" max="64" step="1" style="width:64px" :value="A.bars" @change="set({ bars: +$event.target.value })"> bars</label>
      <label>Min <input type="number" min="2" max="300" step="1" style="width:64px" :value="A.minSec" @change="set({ minSec: +$event.target.value })"> sec</label>
      <Seg :options="[{ v: 'live', label: 'Live' }, { v: 'cached', label: 'Baked' }]" :model-value="A.mode" @update:model-value="set({ mode: $event })" />
    </div>
    <div class="mut" style="font-size:12px;margin:12px 0 6px">Scenes to rotate through <a href="#" style="margin-left:8px" @click.prevent="set({ pool: null })">all</a></div>
    <div class="chips" style="margin-left:0">
      <button v-for="s in S.scenes" :key="s.id" class="chip" :class="{ on: pool.includes(s.id) }"
        :style="pool.includes(s.id) ? 'border-color:var(--acc);color:var(--fg)' : 'opacity:.5'" @click="toggleScene(s.id)">
        {{ s.id }} {{ s.title }}{{ S.sceneStatus?.[s.id]?.ok === false ? ' ⚠' : '' }}
      </button>
    </div>
  </section>
</template>
