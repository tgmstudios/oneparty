<script setup>
import { computed } from 'vue';
import { g, setTab } from '../store.js';
import Icon from './Icon.vue';

const tabs = computed(() => {
  const c = g.S.config;
  return [['costume', 'mask', 'Costume'], ['vote', c.showResults ? 'trophy' : 'ballot', c.showResults ? 'Results' : 'Vote'], ['music', 'music', 'Music'], ...(g.S.pay ? [['pay', 'potion', 'Pay']] : [])];
});
</script>

<template>
  <nav id="tabs" aria-label="Sections">
    <button v-for="[id, ic, label] in tabs" :key="id" :class="{ on: id === g.tab }" :aria-current="id === g.tab ? 'page' : null" @click="setTab(id)">
      <Icon :name="ic" />{{ label }}
    </button>
  </nav>
</template>
