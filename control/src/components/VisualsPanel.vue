<script setup>
import { computed, ref, watch } from 'vue';
import { hub } from '../store.js';
import ChannelCard from './ChannelCard.vue';

// One display picker (pills) + one scene picker for the chosen display, instead of a full scene grid per display.
const channels = computed(() => Object.entries(hub.S.channels).filter(([, c]) => c.role !== 'control'));
const KEY = 'oneparty.visuals.display';
const saved = (() => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } })();
const sel = ref(saved);
const current = computed(() => channels.value.find(([id]) => id === sel.value) || channels.value[0]);
watch(() => current.value?.[0], id => { if (id && id !== sel.value) sel.value = id; });
const pick = id => { sel.value = id; try { localStorage.setItem(KEY, id); } catch { /* private mode */ } };
const label = (id, c) => (id === 'controller-visual' ? 'Controller camera' : c.name || id);
const sceneOf = c => hub.S.scenes.find(s => s.id === c.scene);
</script>

<template>
  <div class="vp">
    <div class="pills" role="tablist" aria-label="Display">
      <button v-for="[id, c] in channels" :key="id" class="pill" :class="{ on: current?.[0] === id }" role="tab" :aria-selected="current?.[0] === id" @click="pick(id)">
        <span v-if="c.remote" class="dot" :class="c.online ? 'ok' : ''"></span>
        <b>{{ label(id, c) }}</b>
        <small>{{ c.mode === 'video' ? 'video' : c.mode === 'stream' ? 'stream' : c.follow ? 'mirror' : sceneOf(c)?.title || c.scene }}</small>
      </button>
    </div>
    <ChannelCard v-if="current" :key="current[0]" :id="current[0]" :c="current[1]" />
  </div>
</template>
