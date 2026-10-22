<script setup>
import { computed, ref } from 'vue';
import { hub } from '../store.js';

// Every private address this PC answers on, so you can see where other devices should connect.
const props = defineProps({ page: { type: String, default: '' } });
const net = computed(() => hub.S.network);
const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const list = computed(() => (net.value?.urls || []).filter(u => isPrivate(u.ip)).map(u => ({ ...u, link: u.url + props.page })));
const copied = ref('');
const copy = async u => { try { await navigator.clipboard.writeText(u); copied.value = u; setTimeout(() => { copied.value = ''; }, 1500); } catch { /* insecure context: select by hand */ } };
</script>

<template>
  <div v-if="!net.lan" class="err">Only this computer can reach the hub (started without LAN). Restart with <code>npm run party</code>.</div>
  <div v-else-if="!list.length" class="mut" style="font-size:12px">No private network address found. Connect this PC to Wi-Fi or Ethernet.</div>
  <div v-else class="netlist">
    <div v-for="u in list" :key="u.ip" class="netrow" :class="{ virt: u.virtual }" title="Click to copy" @click="copy(u.link)">
      <code>{{ u.link }}</code>
      <span class="mut">{{ u.iface }}{{ u.virtual ? ' · virtual/VPN, probably unreachable' : '' }}</span>
      <span class="tag">{{ copied === u.link ? 'copied ✓' : 'copy' }}</span>
    </div>
  </div>
</template>
