<script setup>
import ConnectCard from '../components/ConnectCard.vue';
import DisplayList from '../components/DisplayList.vue';
import AddMonitor from '../components/AddMonitor.vue';
import KioskTakeover from '../components/KioskTakeover.vue';
</script>

<template>
  <div class="cols two">
    <div class="col"><KioskTakeover /><AddMonitor /><ConnectCard /></div>
    <div class="col"><DisplayList /></div>
  </div>
</template>
