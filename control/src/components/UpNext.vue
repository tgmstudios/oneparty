<script setup>
import { hub } from '../store.js';
</script>

<template>
  <section class="card">
    <h2>Up next</h2>
    <div class="q">
      <span v-if="!hub.queue?.length" class="mut">Nothing queued</span>
      <div v-for="(t, i) in hub.queue" :key="t.id + i">
        <span class="n">{{ i + 1 }}</span>
        <img v-if="t.art" :src="t.art" alt="">
        <span class="t"><b>{{ t.title }}</b><span class="mut">{{ t.artists.join(', ') }}</span></span>
      </div>
    </div>
  </section>
</template>
