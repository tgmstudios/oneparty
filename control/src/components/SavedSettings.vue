<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';

const st = computed(() => hub.S.settings);
const text = computed(() => st.value
  ? `Every change here is saved live to ${st.value.file}${st.value.savedAt ? ' (last saved ' + new Date(st.value.savedAt).toLocaleTimeString() + ')' : ' (nothing saved yet)'} and restored on restart. Delete that file, or reset, to clear it.`
  : '');
const reset = () => {
  if (confirm('Forget all live tweaks (scenes, overlays, quality, lights preset, BPM mode, stage text, audio device) and go back to the event defaults?')) cmd({ type: 'settingsReset' });
};
</script>

<template>
  <section class="card">
    <h2>Saved settings</h2>
    <div class="mut" style="font-size:12px">{{ text }}</div>
    <div class="row" style="margin-top:10px"><button @click="reset">Reset to event defaults</button></div>
  </section>
</template>
