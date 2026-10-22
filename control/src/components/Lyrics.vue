<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { hub, trackPosMs } from '../store.js';

const box = ref(null), lines = ref([]);
const L = computed(() => hub.lyrics);
const cur = computed(() => {
  hub.now;
  if (!L.value?.synced || !hub.track) return -1;
  const pos = trackPosMs(hub.track); let i = -1;
  for (let k = 0; k < L.value.lines.length && L.value.lines[k].t <= pos; k++) i = k;
  return i;
});
watch(cur, async i => {
  await nextTick();
  const el = lines.value[i], b = box.value;
  if (el && b) b.scrollTop = el.offsetTop - b.clientHeight / 2 + el.clientHeight / 2;
});
</script>

<template>
  <section class="card">
    <h2>Lyrics</h2>
    <div id="lyr" ref="box">
      <span v-if="!hub.track || !L?.lines?.length" class="mut">{{ hub.track ? 'No lyrics found' : 'No lyrics' }}</span>
      <div v-for="(l, i) in L?.lines || []" :key="i" :ref="el => lines[i] = el" :class="{ cur: i === cur }">{{ l.text || '♪' }}</div>
    </div>
  </section>
</template>
