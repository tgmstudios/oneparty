<script setup>
import { computed, ref } from 'vue';
import { hub } from '../store.js';

const net = computed(() => hub.S.network);
const urls = computed(() => (net.value?.urls || []).map(u => ({ ...u, join: u.url + '/join.html' })));
const best = computed(() => urls.value.find(u => !u.virtual) || urls.value[0]);
const showAll = ref(false);
const shown = computed(() => (showAll.value ? urls.value : urls.value.filter(u => !u.virtual).slice(0, 2)));
const qr = u => { try { const q = window.qrcode(0, 'M'); q.addData(u); q.make(); return q.createDataURL(5, 2); } catch { return ''; } };
const copied = ref('');
const copy = async u => { try { await navigator.clipboard.writeText(u); copied.value = u; setTimeout(() => { copied.value = ''; }, 1500); } catch { /* insecure context: select and copy by hand */ } };
</script>

<template>
  <section class="card">
    <h2>Connect a display</h2>
    <div v-if="!net.lan" class="yt-auth wait">
      <div><b>Only this computer can reach the hub right now</b>
        <div class="mut" style="font-size:12px">Restart it with <code>npm run party</code> (or <code>party.bat</code>, which already does). Windows will ask to allow Node on private networks: allow it.</div></div>
    </div>
    <template v-else>
      <div class="mut" style="font-size:12px;margin-bottom:10px">On the other device (same Wi-Fi), open this address. It registers itself as a new display, and you set what it is below.</div>
      <div v-if="best" class="join-main">
        <img :src="qr(best.join)" alt="QR code" class="join-qr">
        <div>
          <div class="join-url" @click="copy(best.join)">{{ best.join }}</div>
          <div class="mut" style="font-size:12px">{{ best.iface }}{{ copied === best.join ? ' · copied ✓' : ' · tap to copy' }}</div>
        </div>
      </div>
      <div v-for="u in shown.filter(x => x !== best)" :key="u.url" class="mut join-alt" @click="copy(u.join)">{{ u.join }} <span>({{ u.iface }})</span></div>
      <a v-if="urls.length > shown.length" href="#" class="mut" style="font-size:12px" @click.prevent="showAll = true">Other addresses (VPN / virtual adapters)</a>
    </template>
  </section>
</template>
