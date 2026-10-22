<script setup>
import { computed } from 'vue';
import { hub } from '../store.js';
import ContestConnect from '../components/ContestConnect.vue';
import ContestControls from '../components/ContestControls.vue';
import ContestEntries from '../components/ContestEntries.vue';
import ContestBoard from '../components/ContestBoard.vue';
import ContestSongs from '../components/ContestSongs.vue';
import ContestPay from '../components/ContestPay.vue';

const connected = computed(() => hub.S.contest?.connected);
</script>

<template>
  <div v-if="hub.S.contest" class="cols">
    <div class="col"><ContestConnect /><ContestControls v-if="connected" /><ContestPay v-if="connected" /></div>
    <div class="col"><ContestEntries /><ContestBoard v-if="connected" /></div>
    <div class="col"><ContestSongs /></div>
  </div>
</template>
