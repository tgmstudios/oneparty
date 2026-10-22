<script setup>
import { ref, onMounted } from 'vue';
import { hub, cmd } from '../store.js';
const announcement = ref(null);
const busy = ref(false), message = ref('');
const devices = ref([]);
async function refresh() {
  try {
    const r = await fetch('/api/ha-kiosks'); const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Could not read kiosks');
    devices.value = data;
  } catch (e) { message.value = e.message; }
}
onMounted(refresh);
async function save() {
  const r = await cmd({ type: 'kioskDashboard', message: announcement.value ?? hub.S.kiosks?.message ?? '' });
  message.value = r.error || 'Dashboard message saved.';
}
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
    <div v-for="d in devices" :key="d.browserId">{{ d.name }} · {{ d.online ? 'online' : 'offline' }}<span class="mut"> · {{ hub.S.kiosks?.originals?.[d.browserId]?.path || d.path }}</span></div>
    <p v-if="!devices.length" class="mut">No named kiosks found.</p>
    <button :disabled="busy" @click="refresh">Refresh kiosks</button>
    <p class="mut">Devices must be online when the command is sent. Return to dashboards reveals each device's original dashboard.</p>
    <div class="row">
      <button :disabled="busy || !hub.S.ha.enabled" @click="toggle(true)">Take over all kiosks</button>
      <button :disabled="busy || !hub.S.ha.enabled" @click="toggle(false)">Return to dashboards</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
