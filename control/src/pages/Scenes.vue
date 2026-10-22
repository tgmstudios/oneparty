<script setup>
import AutoScenes from '../components/AutoScenes.vue';
import Drafts from '../components/Drafts.vue';
import Bake from '../components/Bake.vue';
</script>

<template>
  <div class="cols two">
    <div class="col"><AutoScenes /></div>
    <div class="col"><Drafts /><Bake /></div>
  </div>
</template>
