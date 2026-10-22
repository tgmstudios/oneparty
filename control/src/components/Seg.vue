<script setup>
// Segmented control: options are [{ v, label }] or plain values; emits the picked value.
defineProps({ options: { type: Array, required: true }, modelValue: null });
defineEmits(['update:modelValue']);
const val = o => (typeof o === 'object' ? o.v : o), label = o => (typeof o === 'object' ? o.label : o);
</script>

<template>
  <span class="seg">
    <button v-for="o in options" :key="val(o)" :class="{ on: modelValue == val(o) }" @click="$emit('update:modelValue', val(o))">{{ label(o) }}</button>
  </span>
</template>
