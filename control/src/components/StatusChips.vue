<script setup>
import { computed } from 'vue';
import { hub } from '../store.js';

const S = computed(() => hub.S);
const sp = computed(() => S.value.spotify);
const spText = computed(() => !sp.value.enabled ? 'Spotify: no client id' : sp.value.authed ? 'Spotify' : 'Spotify: not connected');
const haState = computed(() => S.value.ha.enabled && S.value.ha.lights.length ? (S.value.lights.last && !S.value.lights.last.ok ? 'bad' : 'ok') : 'bad');
const haText = computed(() => S.value.ha.enabled ? `${S.value.ha.lights.length} lights · ${S.value.ha.groups.map(g => g.name).join(', ')}` : 'Lights: not configured');
const live = computed(() => hub.now - hub.audioAt < 2000);
const A = computed(() => S.value.audioStatus);
const auText = computed(() => A.value?.error ? `Audio failed: ${A.value.error}` : live.value ? `Audio · ${A.value?.device || 'Windows output'}` : A.value ? 'Audio: no signal' : 'Audio: starting…');
const gpu = computed(() => Object.values(S.value.gpu || {})[0]);
const gpuName = computed(() => {
  const g = gpu.value; if (!g) return '';
  if (g.software) return 'SOFTWARE RENDERING';
  return (g.renderer.match(/(NVIDIA|AMD|Intel)[^,(]*?(RTX|GTX|Radeon|Iris|UHD|Arc)[^,(]*/i) || [g.renderer])[0].replace(/\(.*/, '').trim();
});
</script>

<template>
  <div class="chips">
    <span class="chip"><span class="dot" :class="sp.authed ? 'ok' : 'bad'"></span>{{ spText }}</span>
    <span class="chip"><span class="dot" :class="haState"></span>{{ haText }}</span>
    <span class="chip"><span class="dot" :class="A?.error ? 'bad' : live ? 'ok' : ''"></span>{{ auText }}</span>
    <span v-if="gpu" class="chip"><span class="dot" :class="gpu.software ? 'bad' : 'ok'"></span>{{ gpuName }}</span>
  </div>
</template>
