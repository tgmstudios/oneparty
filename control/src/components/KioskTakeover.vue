<script setup>
import { ref, onMounted } from 'vue';
import { hub, cmd } from '../store.js';
const announcement = ref(null);
const busy = ref(false), message = ref('');
const devices = ref([]);
async function refresh() {
  scan();
  try {
    const r = await fetch('/api/ha-kiosks'); const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not read kiosks');
    devices.value = data;
  } catch (e) { message.value = e.message; }
}
const found = ref([]), names = ref({});
async function scan() { try { const r = await fetch('/api/ha-browsers'); const d = await r.json(); if (!r.ok) throw new Error(d.error); found.value = d; } catch (e) { message.value = e.message; } }
async function addKiosk(b, role) { const r = await cmd({ type: 'kioskAdd', browserId: b.browserId, name: names.value[b.browserId], role }); message.value = r.error || 'Added as a kiosk.'; if (!r.error) { await Promise.all([refresh(), scan()]); } }
onMounted(() => { refresh(); scan(); });
async function save() {
  const r = await cmd({ type: 'kioskDashboard', message: announcement.value ?? hub.S.kiosks?.message ?? '' });
  message.value = r.error || 'Dashboard message saved.';
}
const pay = ref(null);
const payForm = () => (pay.value ??= { url: hub.S.kiosks?.payment?.url || '', title: hub.S.kiosks?.payment?.title || '', note: hub.S.kiosks?.payment?.note || '' });
async function savePay() { const r = await cmd({ type: 'kioskPayment', ...payForm() }); message.value = r.error || 'Payment screen saved.'; }
async function setRole(d, role) { const r = await cmd({ type: 'kioskRole', browserId: d.browserId, role }); if (r.error) message.value = r.error; else d.role = role; }
async function reload(d) { const r = await cmd({ type: 'kioskReload', browserId: d?.browserId }); message.value = r.error || 'Reload sent to ' + r.reloaded.join(', ') + '. The screen returns in a few seconds.'; }
async function toggle(on) {
  busy.value = true; message.value = '';
  try {
    const r = await cmd({ type: 'kiosks', on });
    if (r.devices) devices.value = r.devices;
    message.value = r.error || (on ? 'Takeover sent to named kiosks.' : 'Return to dashboards sent.');
  } catch (e) { message.value = e.message; }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="card">
    <h2>Home Assistant Controllers</h2>
    <p class="mut">A simple fullscreen dashboard for portrait and landscape kiosks. Live now playing, announcements, and welcome messages from Stage text. A small stream sits below announcements in landscape and at the bottom in portrait. Accent colors change with each song and blend with the Controller camera scene palette.</p>
    <label>Dashboard message
      <textarea :value="announcement ?? hub.S.kiosks?.message" maxlength="500" @input="announcement = $event.target.value" style="width:100%;box-sizing:border-box;margin:8px 0" rows="3"></textarea>
    </label>
    <button @click="save">Save message</button>
    <div v-for="d in devices" :key="d.browserId" class="row" style="margin:6px 0">
      <span class="grow">{{ d.name }} · {{ d.online ? 'online' : 'offline' }}<span class="mut"> · {{ hub.S.kiosks?.originals?.[d.browserId]?.path || d.path }}</span></span>
      <select :value="d.role || 'dashboard'" @change="setRole(d, $event.target.value)" title="What this kiosk shows"><option value="dashboard">Dashboard</option><option value="payment">Payment</option></select>
      <button :disabled="!hub.S.ha.enabled" @click="reload(d)">Reload</button>
    </div>
    <p v-if="!devices.length" class="mut">No named kiosks found.</p>
    <div v-for="b in found" :key="b.browserId" class="row" style="margin:6px 0">
      <span class="grow">New browser <code>{{ b.browserId }}</code><span class="mut"> · {{ b.path }}</span></span>
      <input v-model="names[b.browserId]" placeholder="Name, e.g. Jungle Juice" maxlength="40" style="width:200px" />
      <button :disabled="!names[b.browserId]" @click="addKiosk(b, 'dashboard')">Add kiosk</button>
      <button :disabled="!names[b.browserId]" @click="addKiosk(b, 'payment')">Add as payment</button>
    </div>
    <div class="row"><button :disabled="busy" @click="refresh">Refresh kiosks</button><button :disabled="!hub.S.ha.enabled || !devices.length" @click="reload()">Reload all</button></div>
    <h3>Payment screen</h3>
    <p class="mut">Kiosks with the Payment role show this link, the payment QR from Contest (if uploaded) and prices from Stage announcements and a live view of their own front camera as a deterrent (the device's camera, shown directly; nothing is recorded). Android may ask for camera permission once on that device. Leave the link blank to use the Contest pay link.</p>
    <div style="display:grid;gap:8px">
      <input :value="payForm().url" @input="pay.url = $event.target.value" placeholder="Payment URL (https://venmo.com/u/…)" />
      <input :value="payForm().title" @input="pay.title = $event.target.value" maxlength="60" placeholder="Heading" />
      <textarea :value="payForm().note" @input="pay.note = $event.target.value" maxlength="300" rows="2" placeholder="Note, e.g. $5 a cup"></textarea>
      <div><button @click="savePay">Save payment screen</button></div>
    </div>
    <p class="mut">Devices must be online when the command is sent. Return to dashboards reveals each device's original dashboard.</p>
    <div class="row">
      <button :disabled="busy || !hub.S.ha.enabled" @click="toggle(true)">Take over all kiosks</button>
      <button :disabled="busy || !hub.S.ha.enabled" @click="toggle(false)">Return to dashboards</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
