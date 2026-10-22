<script setup>
import { computed, reactive, watch } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';

const C = computed(() => hub.S.contest), cfg = computed(() => C.value.config || {});
const f = reactive({ title: '', subtitle: '', accent: '#ff6a10' });
watch(cfg, c => { if (!document.activeElement?.closest?.('#ct-ctl')) Object.assign(f, { title: c.title || '', subtitle: c.subtitle || '', accent: c.accent || '#ff6a10' }); }, { immediate: true, deep: true });
const set = body => cmd({ type: 'contest', action: 'config', ...body });
const phase = body => set(body);
const resetting = what => { if (confirm(`Clear ${what === 'all' ? 'EVERYTHING (entries, votes, ratings)' : what}? This can't be undone.`)) cmd({ type: 'contest', action: 'reset', what }); };
</script>

<template>
  <section v-if="C.config" id="ct-ctl" class="card">
    <h2>Contest controls</h2>
    <div class="row">
      <Switch :on="!!cfg.entriesOpen" @click="set({ entriesOpen: !cfg.entriesOpen })">Entries open</Switch>
      <Switch :on="!!cfg.votingOpen" @click="set({ votingOpen: !cfg.votingOpen })">Voting open</Switch>
      <Switch :on="!!cfg.ratingOpen" @click="set({ ratingOpen: !cfg.ratingOpen })">Song rating</Switch>
      <Switch :on="!!cfg.showResults" @click="set({ showResults: !cfg.showResults })">Results on phones</Switch>
    </div>
    <div class="row" style="margin-top:10px">
      <button @click="phase({ entriesOpen: true, votingOpen: false, showResults: false })">Phase: entries</button>
      <button @click="phase({ entriesOpen: false, votingOpen: true, showResults: false })">Phase: voting</button>
      <button @click="phase({ entriesOpen: false, votingOpen: false })">Close both</button>
    </div>
    <div class="ed-h" style="margin-top:18px"><b>Guest app look</b></div>
    <div class="row">
      <input v-model="f.title" class="grow" placeholder="Title" maxlength="60" @change="set({ title: f.title })">
      <input v-model="f.subtitle" class="grow" placeholder="Subtitle" maxlength="80" @change="set({ subtitle: f.subtitle })">
      <input v-model="f.accent" type="color" title="Accent color" @change="set({ accent: f.accent })">
    </div>
    <div class="ed-h" style="margin-top:18px"><b>Reset</b><span class="mut">careful</span></div>
    <div class="row">
      <button @click="resetting('votes')">Clear votes</button>
      <button @click="resetting('ratings')">Clear song ratings</button>
      <button class="del" @click="resetting('all')">Clear everything</button>
    </div>
  </section>
</template>
