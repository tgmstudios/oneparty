<script setup>
defineProps({ on: Boolean });
</script>

<template>
  <button class="sw2" :class="{ on }"><i></i><slot /></button>
</template>
