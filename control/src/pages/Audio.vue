<script setup>
import Tempo from '../components/Tempo.vue';
import AudioSources from '../components/AudioSources.vue';
import Spectrum from '../components/Spectrum.vue';
import NowPlaying from '../components/NowPlaying.vue';
</script>

<template>
  <div class="cols">
    <div class="col"><NowPlaying /></div>
    <div class="col"><Spectrum /><AudioSources /></div>
    <div class="col"><Tempo /></div>
  </div>
</template>
