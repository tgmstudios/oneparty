<script setup>
import Icon from './Icon.vue';
defineProps({ title: String, text: String, icon: { type: String, default: 'mask' }, bob: Boolean });
</script>

<template>
  <div class="card empty">
    <Icon :name="icon" :class="{ bobbing: bob }" />
    <h3>{{ title }}</h3>
    <p v-if="text" class="mut">{{ text }}</p>
  </div>
</template>
