<script setup>
import { computed, ref } from 'vue';
import { hub, cmd } from '../store.js';
import Seg from './Seg.vue';

const S = computed(() => hub.S);
const color = ref('#ff6a10');
const preset = ref('');
const cats = computed(() => [...new Set(S.value.presets.map(p => p.category))]);
const last = computed(() => { const l = S.value.lights.last; return l ? `${l.preset || l.what}: ${l.ok ? 'sent' : 'FAILED ' + (l.error || '')}` : ''; });
</script>

<template>
  <section class="card">
    <h2>Lights <small class="mut">{{ last }}</small></h2>
    <div v-if="S.zones?.some(z => z.lights.length)" class="mut" style="font-size:12px;margin:-4px 0 10px">Lights assigned to a <router-link to="/zones">zone</router-link> follow their display instead of these controls.</div>
    <div class="row" style="margin-bottom:12px">
      <Seg :options="['sync', 'manual', 'off']" :model-value="S.lights.mode" @update:model-value="cmd({ type: 'lights', mode: $event })" />
      <button :class="{ on: S.lights.dynamic }" title="Re-shuffle the preset colors every few seconds" @click="cmd({ type: 'lights', dynamic: !S.lights.dynamic })">Loop</button>
    </div>
    <div class="row">
      <select v-model="preset" class="grow">
        <option value="">Per-scene preset (from event)</option>
        <optgroup v-for="c in cats" :key="c" :label="c">
          <option v-for="p in S.presets.filter(x => x.category === c)" :key="p.id" :value="p.id">{{ p.name }}</option>
        </optgroup>
      </select>
      <button @click="cmd({ type: 'lights', preset: preset || null, apply: true })">Apply</button>
    </div>
    <div class="row" style="margin-top:12px">
      <input v-model="color" type="color">
      <button @click="cmd({ type: 'lights', mode: 'manual', color })">Set color</button>
      <button @click="cmd({ type: 'flash', color })">Flash</button>
    </div>
  </section>
</template>
