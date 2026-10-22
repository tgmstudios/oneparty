<script setup>
import { computed, ref } from 'vue';
import { hub } from '../store.js';

// A big QR + address for one hub page (the control panel by default), on the best private address.
const props = defineProps({ page: { type: String, default: '/control.html' }, title: String, note: String });
const net = computed(() => hub.S.network);
const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const best = computed(() => { const l = (net.value?.urls || []).filter(u => isPrivate(u.ip)); return l.find(u => !u.virtual) || l[0]; });
const link = computed(() => (best.value ? best.value.url + props.page : ''));
const qr = computed(() => { try { const q = window.qrcode(0, 'M'); q.addData(link.value); q.make(); return q.createDataURL(6, 2); } catch { return ''; } });
const copied = ref(false);
const copy = async () => { try { await navigator.clipboard.writeText(link.value); copied.value = true; setTimeout(() => { copied.value = false; }, 1500); } catch { /* select by hand */ } };
</script>

<template>
  <div v-if="best && net.lan" class="join-main">
    <img v-if="qr" :src="qr" alt="QR code" class="join-qr">
    <div>
      <div v-if="title" class="mut" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase">{{ title }}</div>
      <div class="join-url" @click="copy">{{ link }}</div>
      <div class="mut" style="font-size:12px">{{ best.iface }} · {{ copied ? 'copied ✓' : 'tap to copy' }}<template v-if="note"> · {{ note }}</template></div>
    </div>
  </div>
  <div v-else class="err">{{ net.lan ? 'No private network address found.' : 'Hub is local-only. Restart with npm run party.' }}</div>
</template>
