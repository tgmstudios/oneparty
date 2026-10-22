<script setup>
import { computed } from 'vue';
import { g } from '../store.js';

const p = computed(() => g.S.pay);
// uploaded QR image, else a QR drawn from the link (qrcode.js is a classic script that defines window.qrcode)
const qr = computed(() => {
  const pay = p.value; if (!pay) return '';
  if (pay.image) return pay.image;
  if (pay.url && window.qrcode) { try { const q = window.qrcode(0, 'M'); q.addData(pay.url); q.make(); return q.createDataURL(8, 2); } catch { /* link too long for a QR */ } }
  return '';
});
</script>

<template>
  <div v-if="p" class="card tavern">
    <div class="badge">The cauldron is bubbling</div>
    <h3>{{ p.title || 'Pay' }}</h3>
    <p v-if="p.note" class="lead" style="margin-top:8px">{{ p.note }}</p>
    <div v-if="qr" class="qrframe"><img :src="qr" alt="Payment QR code"></div>
    <a v-if="p.url" class="btn full" :href="p.url" target="_blank" rel="noopener noreferrer">Open payment link</a>
  </div>
</template>
