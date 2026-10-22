<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';

// Which Windows OUTPUT the hub loops back to drive beats, tempo and the lights. Virtual buses (Voicemeeter, VB-Cable) are listed first and
// tagged, because routing the music (and only the music) to a virtual bus is how you keep other audio out of the analysis.
const S = computed(() => hub.S);
const live = computed(() => hub.now - hub.audioAt < 2000);
const isVirtual = d => /voicemeeter|vb-audio|cable|virtual/i.test(d.name);
const selectedId = computed(() => {
  const want = S.value.audioDevice?.toLowerCase();
  return want ? S.value.audioDevices?.find(d => d.name.toLowerCase().includes(want))?.id : null;
});
const sorted = computed(() => [...(S.value.audioDevices || [])].sort((a, b) => isVirtual(b) - isVirtual(a) || a.name.localeCompare(b.name)));
const pick = d => cmd({ type: 'audioDevice', device: d ? d.name : null });
const status = computed(() => {
  const A = S.value.audioStatus;
  return A?.error ? { cls: 'bad', text: A.error } : live.value ? { cls: 'ok', text: `Hearing ${A?.device || 'the default output'}` } : { cls: '', text: A ? 'No signal on this device' : 'Starting…' };
});
</script>

<template>
  <section class="card">
    <h2>Analysis source <small>what the visuals and lights listen to</small></h2>
    <div class="yt-auth" :class="status.cls">
      <div><b><span class="dot" :class="status.cls"></span> {{ status.text }}</b>
        <div class="mut" style="font-size:12px">Play the music to the device you pick here. Anything else playing on it also reaches the analysis.</div></div>
    </div>
    <div class="src-list">
      <button class="src" :class="{ on: !S.audioDevice }" @click="pick(null)">
        <b>Windows default output</b><span class="mut">follows whatever Windows is playing to</span>
      </button>
      <button v-for="d in sorted" :key="d.id" class="src" :class="{ on: selectedId === d.id }" @click="pick(d)">
        <b>{{ d.name }}</b>
        <span class="mut">
          <span v-if="isVirtual(d)" class="tag">virtual bus</span>
          <span v-if="d.default" class="tag">Windows default</span>
        </span>
      </button>
    </div>
  </section>
</template>
