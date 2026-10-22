<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';

// Connection to the cloud guest app (public/) + the QR/link shown on the displays. The admin key is write-only: it is sent to the hub and never read back.
const C = computed(() => hub.S.contest);
const hud = computed(() => hub.S.hud.contest || {});
const f = reactive({ url: '', key: '', qrUrl: '', title: '', sub: '' });
const busy = ref(false), res = ref(null);
watch(() => C.value.url, u => { if (document.activeElement?.id !== 'ct-url') f.url = u || ''; }, { immediate: true });
watch(hud, h => { if (!document.activeElement?.closest?.('#ct-qr')) { f.qrUrl = h.url || ''; f.title = h.title || ''; f.sub = h.sub || ''; } }, { immediate: true, deep: true });

async function connect() {
  busy.value = true; res.value = null;
  try { res.value = await cmd({ type: 'contest', action: 'connect', url: f.url, key: f.key }); if (!res.value.error) f.key = ''; } catch (e) { res.value = { error: e.message }; }
  busy.value = false;
}
const saveQr = (extra = {}) => cmd({ type: 'hud', contest: { url: f.qrUrl, title: f.title, sub: f.sub, ...extra } });
const effective = computed(() => hud.value.url || C.value.url || '');
const qr = computed(() => { try { const q = window.qrcode(0, 'M'); q.addData(effective.value); q.make(); return q.createDataURL(5, 2); } catch { return ''; } });
</script>

<template>
  <section class="card">
    <h2>Guest app <small><span class="dot" :class="C.connected ? 'ok' : 'bad'"></span> <span class="mut">{{ C.connected ? 'connected' : C.error || 'not connected' }}</span></small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:8px">The public costume-contest / music-rating app runs in the cloud (<code>public/</code>). This panel manages it with its admin key.</div>
    <label class="ob-f">App URL
      <input id="ct-url" v-model="f.url" placeholder="https://party.example.com" inputmode="url" autocapitalize="off" autocomplete="off" @keyup.enter="connect">
    </label>
    <label class="ob-f" style="margin-top:8px">Admin key <span v-if="C.keySet" class="mut">(saved, type to replace)</span>
      <input v-model="f.key" type="password" :placeholder="C.keySet ? '••••••••' : 'ADMIN_KEY of the guest app'" autocomplete="off" @keyup.enter="connect">
    </label>
    <div class="row" style="margin-top:10px">
      <button class="on" :disabled="busy || !f.url" @click="connect">Save &amp; connect</button>
      <a v-if="C.url" :href="C.url" target="_blank" rel="noopener">Open guest app ↗</a>
    </div>
    <p v-if="res" role="status" :class="res.error ? 'err' : 'mut'" style="margin:8px 0 0">{{ res.error || 'Connected.' }}</p>
    <div v-else-if="C.error && C.keySet" class="err" style="margin-top:8px;font-size:12px">{{ C.error }}</div>

    <div id="ct-qr" class="ed-h" style="margin-top:20px"><b>Party screen QR</b><span class="mut">shown next to the Jam QR</span></div>
    <div class="row">
      <input v-model="f.qrUrl" class="grow" :placeholder="C.url ? 'Defaults to ' + C.url : 'Link guests scan (https://…)'" inputmode="url" autocapitalize="off" @change="saveQr()">
      <img v-if="qr" :src="qr" alt="QR preview" style="width:72px;height:72px;border-radius:8px;background:#fff;image-rendering:pixelated">
    </div>
    <div class="row" style="margin-top:8px">
      <input v-model="f.title" class="grow" placeholder="Card title" maxlength="40" @change="saveQr()">
      <input v-model="f.sub" class="grow" placeholder="Card subtitle" maxlength="60" @change="saveQr()">
    </div>
    <div class="row" style="margin-top:8px">
      <Switch :on="!!hud.on" @click="saveQr({ on: !hud.on })">Show QR</Switch>
      <Switch :on="!!hud.pin" @click="saveQr({ pin: !hud.pin })">Pin</Switch>
    </div>
    <div class="mut" style="font-size:11px;margin-top:6px">Needs the Announcements overlay on the display, like the Jam QR. Leave the link empty to use the app URL above.</div>
  </section>
</template>
