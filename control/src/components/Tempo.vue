<script setup>
import { computed, ref } from 'vue';
import { hub, cmd } from '../store.js';

const S = computed(() => hub.S);
const bpmInput = ref(null), editing = ref(false), held = ref('');   // while typing, the live tempo must not overwrite the field
const bpmText = computed(() => S.value.bpmAuto ? (+S.value.bpm).toFixed(1) : Math.round(S.value.bpm));
const per = computed(() => (60 / Math.max(40, S.value.bpm)).toFixed(3) + 's');
const src = computed(() => {
  const I = S.value.bpmInfo; if (!I) return '';
  if (I.source === 'manual') return 'manual';
  if (I.source === 'audio') return 'listening' + (I.raw ? ` · heard ${I.raw}` : '…');
  return I.raw ? `${I.source.replace('deezer-', 'Deezer ')}${I.raw !== I.bpm ? ` · ${I.raw} → ${I.bpm}` : ''}` : I.source;
});

let taps = [];
const tap = () => {
  const n = performance.now(); taps = taps.filter(t => n - t < 3000); taps.push(n);
  if (taps.length > 3) cmd({ type: 'bpm', bpm: Math.round(60000 / ((taps.at(-1) - taps[0]) / (taps.length - 1))) });
};
</script>

<template>
  <section class="card">
    <h2>Tempo <small>{{ src }}</small></h2>
    <div class="bpm">
      <input id="bpm" ref="bpmInput" type="number" min="40" max="220" step="0.1" aria-label="BPM"
        :value="editing ? held : bpmText" @focus="held = $event.target.value; editing = true" @blur="editing = false" @change="cmd({ type: 'bpm', bpm: $event.target.value })">
      <span class="u">BPM</span><span id="beat" :style="{ '--per': per }"></span>
    </div>
    <div class="row" style="margin-top:14px">
      <button :class="{ on: S.bpmAuto }" @click="cmd({ type: 'bpmAuto', on: !S.bpmAuto })">Follow song</button>
      <button @click="tap">Tap tempo</button>
    </div>
  </section>
</template>
