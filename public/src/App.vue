<script setup>
import { computed, onMounted, watchEffect } from 'vue';
import { g, startPolling } from './store.js';
import Atmosphere from './components/Atmosphere.vue';
import Masthead from './components/Masthead.vue';
import Tabs from './components/Tabs.vue';
import Costume from './components/Costume.vue';
import Vote from './components/Vote.vue';
import Results from './components/Results.vue';
import Music from './components/Music.vue';
import Pay from './components/Pay.vue';
import EmptyCard from './components/EmptyCard.vue';
import Icon from './components/Icon.vue';

onMounted(startPolling);
const tab = computed(() => {
  const ids = ['costume', g.S?.config.showResults ? 'results' : 'vote', 'music', ...(g.S?.pay ? ['pay'] : [])];
  const t = g.tab === 'vote' && g.S?.config.showResults ? 'results' : g.tab;
  return ids.includes(t) ? t : 'costume';
});
const views = { costume: Costume, vote: Vote, results: Results, music: Music, pay: Pay };
watchEffect(() => {
  if (!g.S) return;
  document.documentElement.style.setProperty('--accent', g.S.config.accent || '#ff7a1a');
  document.title = g.S.config.title || 'Dawghouse Halloween';
});
// a tab that disappeared (pay removed) falls back to the first one
watchEffect(() => { if (g.S && g.tab === 'pay' && !g.S.pay) g.tab = 'costume'; });
</script>

<template>
  <Atmosphere />
  <div class="shell">
    <Masthead />
    <main id="view" aria-live="polite">
      <component :is="views[tab]" v-if="g.S" :key="tab" />
      <EmptyCard v-else-if="g.offline" icon="skull" title="The spirits are not answering" text="We could not reach the party. Retrying…" />
      <EmptyCard v-else icon="pumpkin" title="Summoning the spirits…" bob />
    </main>
    <footer class="foot"><Icon name="pumpkin" /><span>Dawghouse Halloween 2026</span><small>Enter at your own risk</small></footer>
  </div>
  <Tabs v-if="g.S" />
  <div id="toast" role="status" :class="{ on: g.toast.on, err: g.toast.err }">{{ g.toast.msg }}</div>
</template>
