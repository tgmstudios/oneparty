<script setup>
import { computed, ref } from 'vue';
import { hub, cmd, refreshAssets } from '../store.js';

// Baking runs on the hub in a headless window, so it never appears over a display.
const msg = ref(''), baking = ref(''), missing = computed(() => hub.S.scenes.filter(s => !hub.cached.includes(s.id + '.webm')));
async function bake(scene) {
  baking.value = scene; msg.value = `baking ${scene}…`;
  try {
    const r = await cmd({ type: 'bake', scene });
    msg.value = r.ok ? 'done' : Object.entries(r.results || {}).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.error}`).join('; ') || r.error;
  } finally { baking.value = ''; refreshAssets(); }
}
</script>

<template>
  <section class="card">
    <h2>Bake <small>{{ hub.cached.length }} of {{ hub.S.scenes.length }} baked</small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:10px">A baked scene is an 8 s looping video: smooth on weak GPUs and playable as a "cached" display.</div>
    <div class="row">
      <button class="on" :disabled="!!baking || !missing.length" @click="bake('missing')">Bake {{ missing.length }} missing</button>
      <span class="mut" style="font-size:12px">{{ msg }}</span>
    </div>
    <div class="chips" style="margin:12px 0 0">
      <button v-for="s in hub.S.scenes" :key="s.id" class="chip" :disabled="!!baking" :title="hub.cached.includes(s.id + '.webm') ? 'Re-bake' : 'Bake'" @click="bake(s.id)">
        {{ s.id }} {{ s.title }} {{ hub.cached.includes(s.id + '.webm') ? '✓' : '' }}
      </button>
    </div>
  </section>
</template>
