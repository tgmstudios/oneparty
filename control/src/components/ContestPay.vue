<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';

// "Pay for jungle juice and stuff": a Pay tab on the guest app with a payment link (Venmo) and its QR.
// Upload your Venmo QR screenshot; with no image the app draws a QR from the link.
const C = computed(() => hub.S.contest), cfg = computed(() => C.value.config || {});
const f = reactive({ payTitle: '', payUrl: '', payNote: '' });
const err = ref(''), busy = ref(false), saved = ref(false);
watch(cfg, c => { if (!document.activeElement?.closest?.('#ct-pay')) Object.assign(f, { payTitle: c.payTitle || '', payUrl: c.payUrl || '', payNote: c.payNote || '' }); }, { immediate: true, deep: true });

async function save() {
  err.value = ''; const r = await cmd({ type: 'contest', action: 'config', ...f });
  if (r.error) err.value = r.error; else { saved.value = true; setTimeout(() => { saved.value = false; }, 1500); }
}
async function upload(ev) {
  const file = ev.target.files?.[0]; ev.target.value = ''; if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { err.value = 'Pick a jpg, png, webp or gif'; return; }
  busy.value = true; err.value = '';
  try { const r = await (await fetch('/api/contest/image?id=pay', { method: 'POST', headers: { 'content-type': file.type }, body: file })).json(); if (r.error) err.value = r.error; } catch (e) { err.value = e.message; }
  busy.value = false;
}
</script>

<template>
  <section v-if="C.config" id="ct-pay" class="card">
    <h2>Payments <small class="mut">{{ saved ? 'saved ✓' : 'Pay tab on phones' }}</small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:8px">For jungle juice and other drinks. Guests see a Pay tab once a link or QR image is set; clear both to hide it.</div>
    <label class="ob-f">Heading<input v-model="f.payTitle" maxlength="60" placeholder="Drinks &amp; jungle juice" @change="save"></label>
    <label class="ob-f" style="margin-top:8px">Venmo link<input v-model="f.payUrl" inputmode="url" autocapitalize="off" placeholder="https://venmo.com/u/your-name" @change="save"></label>
    <label class="ob-f" style="margin-top:8px">Note<input v-model="f.payNote" maxlength="200" placeholder="Jungle juice $3 a cup, please add 'Dawghouse' in the note" @change="save"></label>
    <div class="row" style="margin-top:12px;align-items:flex-start">
      <img v-if="C.payImageUrl" :src="C.payImageUrl" alt="Payment QR" style="width:110px;height:110px;border-radius:10px;background:#fff;object-fit:contain">
      <div>
        <button :disabled="busy" @click="$refs.file.click()">{{ C.payImageUrl ? 'Replace Venmo QR' : 'Upload Venmo QR' }}</button>
        <input ref="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="upload">
        <button v-if="C.payImageUrl" style="margin-left:6px" @click="cmd({ type: 'contest', action: 'removeImage', id: 'pay' })">Remove</button>
        <div class="mut" style="font-size:11px;margin-top:6px">{{ C.payImageUrl ? 'Your uploaded image is shown.' : f.payUrl ? 'No image: a QR is drawn from the link.' : 'Add a link or an image.' }}</div>
      </div>
    </div>
    <p v-if="err" class="err" role="alert" style="margin:8px 0 0">{{ err }}</p>
  </section>
</template>
