<script setup>
import { computed } from 'vue';
import { hub } from '../store.js';

const live = computed(() => hub.now - hub.audioAt < 2000);
const L = computed(() => hub.levels);
const bands = computed(() => (live.value && L.value.bands.length ? L.value.bands : Array(16).fill(0)));
const h = v => Math.max(3, Math.min(100, v * 100)) + '%';
const groups = [['bass', 'BASS'], ['mid', 'MID'], ['high', 'HIGH'], ['level', 'LEVEL']];
</script>

<template>
  <section class="card">
    <h2>Live audio <small>{{ live ? 'receiving' : 'no signal' }}</small></h2>
    <div class="spec" :class="{ off: !live }"><i v-for="(b, i) in bands" :key="i" :style="{ height: h(b) }"></i></div>
    <div class="lbl"><span>LOW</span><span>HIGH</span></div>
    <div class="vu">
      <div v-for="[k, label] in groups" :key="k" class="vu-row">
        <span class="mut">{{ label }}</span>
        <div class="vu-bar"><i :style="{ width: live ? h(L[k]) : '3%' }"></i></div>
        <span class="mut num">{{ live ? Math.round(L[k] * 100) : 0 }}</span>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <span class="chip"><span class="dot" :class="L.beat && live ? 'ok' : ''"></span>beat</span>
      <span class="chip">{{ live && L.bpm ? Math.round(L.bpm) + ' bpm heard' : 'no tempo yet' }}</span>
    </div>
  </section>
</template>
