<script setup>
import { ICONS } from '../icons.js';
defineProps({ name: { type: String, required: true } });
</script>

<template>
  <!-- static markup from the ICONS table only -->
  <span class="ic" v-html="ICONS[name]"></span>
</template>
