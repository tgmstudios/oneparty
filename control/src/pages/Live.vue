<script setup>
import NowPlaying from '../components/NowPlaying.vue';
import UpNext from '../components/UpNext.vue';
import VisualsPanel from '../components/VisualsPanel.vue';
import Lyrics from '../components/Lyrics.vue';
import KioskTakeover from '../components/KioskTakeover.vue';
</script>

<template>
  <div class="cols two">
    <div class="col"><NowPlaying /><UpNext /></div>
    <div class="col">
      <VisualsPanel />
      <KioskTakeover />
      <Lyrics />
    </div>
  </div>
</template>
