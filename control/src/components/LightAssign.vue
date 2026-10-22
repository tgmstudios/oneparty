<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';

defineProps({ colors: Object });   // zone id -> color
const S = computed(() => hub.S);
const zones = computed(() => S.value.zones || []);
const owner = light => zones.value.find(z => z.lights.includes(light))?.id || '';
const pretty = id => id.replace(/^light\./, '').replace(/_/g, ' ');
const assign = (light, zone) => cmd({ type: 'zone', action: 'assign', light, zone: zone || null });
</script>

<template>
  <section class="card">
    <h2>Lights <small>{{ S.ha.lights.length }} total</small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:10px">Give each light to a zone. Lights left on “Global” keep following the main lighting.</div>
    <div v-for="g in S.ha.baseGroups" :key="g.name" class="lg">
      <div class="lg-h"><b>{{ g.name }}</b><span class="role">{{ g.kind }}</span></div>
      <div v-for="l in g.entities" :key="l" class="lg-row">
        <span class="zone-dot" :style="{ '--zc': colors[owner(l)] || 'transparent', opacity: owner(l) ? 1 : .25 }"></span>
        <span class="lg-name">{{ pretty(l) }}</span>
        <select :value="owner(l)" @change="assign(l, $event.target.value)">
          <option value="">Global</option>
          <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
        </select>
      </div>
    </div>
  </section>
</template>
