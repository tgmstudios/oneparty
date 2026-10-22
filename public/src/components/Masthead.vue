<script setup>
import { computed } from 'vue';
import { g } from '../store.js';

// The DAWGHOUSE sign is the wordmark, so the headline carries the rest of the configured title.
const name = computed(() => g.S?.config.title || 'Dawghouse Halloween');
const rest = computed(() => name.value.replace(/^dawghouse\s*/i, '').trim() || name.value);
</script>

<template>
  <header class="masthead">
    <div class="eyebrow"><span></span>Est. 2026 · Haunted house party<span></span></div>
    <div class="sign" role="img" aria-label="Dawghouse">
      <i class="chain c1"></i><i class="chain c2"></i>
      <div class="plank"><b>DAWGHOUSE</b></div>
    </div>
    <h1>{{ rest }}</h1>
    <p v-if="g.S?.config.subtitle" id="subtitle">{{ g.S.config.subtitle }}</p>
  </header>
</template>
