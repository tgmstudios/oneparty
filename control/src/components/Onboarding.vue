<script setup>
import { computed, onMounted, ref } from 'vue';
import { hub, cmd } from '../store.js';
import NetworkAddresses from './NetworkAddresses.vue';
import ConnectCard from './ConnectCard.vue';
import HaConnection from './HaConnection.vue';
import AddressQR from './AddressQR.vue';
import AddMonitor from './AddMonitor.vue';
import HaAreas from './HaAreas.vue';
import Seg from './Seg.vue';

const emit = defineEmits(['close']);
const S = computed(() => hub.S);
const steps = ['Network', 'This PC', 'Other devices', 'Zones', 'Kiosks', 'Done'];
const step = ref(0);
const msg = ref('');

const displays = computed(() => Object.entries(S.value.channels).filter(([, c]) => c.role !== 'control').map(([id, c]) => ({ id, ...c })));
const remote = computed(() => displays.value.filter(d => d.remote));
const roles = [{ v: 'visuals', label: 'Visuals' }, { v: 'videos', label: 'Videos' }];
const configure = (id, patch) => cmd({ type: 'display', action: 'configure', id, ...patch });
const forget = id => cmd({ type: 'display', action: 'remove', id });
const prune = () => cmd({ type: 'display', action: 'prune' });

const zones = computed(() => S.value.zones || []);
const haOk = computed(() => S.value.ha.enabled && S.value.ha.lights.length);
const zoneFor = id => zones.value.find(z => z.display === id)?.id || '';
async function setZone(displayId, zoneId) {
  const main = Object.keys(S.value.channels)[0];
  for (const z of zones.value) if (z.display === displayId && z.id !== zoneId) await cmd({ type: 'zone', action: 'update', id: z.id, display: main });
  if (zoneId) await cmd({ type: 'zone', action: 'update', id: zoneId, display: displayId });
}
async function newZone(d) {
  const r = await cmd({ type: 'zone', action: 'add', name: d.name || d.id, display: d.id });
  msg.value = r.error || '';
}
const flash = id => cmd({ type: 'zone', action: 'flash', id });

const kiosks = ref([]), kioskMsg = ref(''), kioskBusy = ref(false);
const camera = ref(S.value.kiosks?.cameraEntity || ''), message = ref(S.value.kiosks?.message || '');
async function loadKiosks() {
  try { const r = await fetch('/api/ha-kiosks'); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not read kiosks'); kiosks.value = j; kioskMsg.value = ''; }
  catch (e) { kioskMsg.value = e.message; }
}
async function saveKiosk() {
  kioskBusy.value = true;
  let r = await cmd({ type: 'kioskDashboard', message: message.value });
  if (!r.error && camera.value.trim()) r = await cmd({ type: 'kioskStream', entity: camera.value.trim() });
  kioskMsg.value = r.error || 'Saved.'; kioskBusy.value = false;
}
async function takeover(on) {
  kioskBusy.value = true;
  const r = await cmd({ type: 'kiosks', on });
  if (r.devices) kiosks.value = r.devices;
  kioskMsg.value = r.error || (on ? 'Takeover sent.' : 'Returned to dashboards.'); kioskBusy.value = false;
}
onMounted(() => { if (S.value.ha.enabled) loadKiosks(); });

const openAll = () => fetch('/api/launch', { method: 'POST' });
const next = () => { step.value = Math.min(steps.length - 1, step.value + 1); };
const back = () => { step.value = Math.max(0, step.value - 1); };
</script>

<template>
  <div class="ob-back" @click.self="emit('close')">
    <div class="ob card" role="dialog" aria-label="Onboarding">
      <div class="ob-h">
        <b>Party setup</b>
        <span class="grow"></span>
        <button @click="emit('close')">Close</button>
      </div>
      <div class="ob-steps">
        <button v-for="(s, i) in steps" :key="s" :class="{ on: i === step, done: i < step }" @click="step = i"><i>{{ i + 1 }}</i>{{ s }}</button>
      </div>

      <div class="ob-body">
        <template v-if="step === 0">
          <h2>Where other devices connect</h2>
          <p class="mut">Phones, tablets and other computers on the same Wi-Fi open one of these addresses. Each browser tab registers itself as a display.</p>
          <AddressQR page="/control.html" title="Control panel" note="Scan with your phone to run the party from it." />
          <NetworkAddresses page="/control.html" />
          <h2 style="margin-top:8px">Display join page</h2>
          <ConnectCard />
          <p class="mut" style="font-size:12px">The first time, Windows asks to allow Node on private networks: allow it.</p>
        </template>

        <template v-else-if="step === 1">
          <h2>Monitors on this PC</h2>
          <p class="mut">Add a display window for each extra monitor plugged into this computer.</p>
          <AddMonitor />
          <div class="row"><button @click="openAll">Open any closed displays</button></div>
          <div v-for="d in displays.filter(x => x.local)" :key="d.id" class="ob-row">
            <b>{{ d.name || d.id }}</b><span class="mut">monitor {{ (d.monitor?.index ?? 0) + 1 }}</span>
            <span class="grow"></span>
            <button @click="cmd({ type: 'display', action: 'launch', id: d.id })">Open</button>
            <button class="del" @click="forget(d.id)">Remove</button>
          </div>
        </template>

        <template v-else-if="step === 2">
          <h2>Other devices</h2>
          <p class="mut">Open the join address on each device. They appear here live; name them and say what they show.</p>
          <NetworkAddresses page="/join.html" />
          <div v-for="d in remote" :key="d.id" class="ob-row">
            <span class="dot" :class="d.online ? 'ok' : ''" :title="d.online ? 'online' : 'offline'"></span>
            <input :value="d.name" placeholder="Name" @change="configure(d.id, { name: $event.target.value })">
            <Seg :options="roles" :model-value="d.role" @update:model-value="configure(d.id, { role: $event })" />
            <span class="grow"></span>
            <button class="del" @click="forget(d.id)">Remove</button>
          </div>
          <p v-if="!remote.length" class="mut">Waiting for a device to connect…</p>
          <div v-if="remote.some(d => !d.online)" class="row"><a href="#" @click.prevent="prune">Remove all offline devices</a></div>
        </template>

        <template v-else-if="step === 3">
          <h2>Zones</h2>
          <p class="mut">A zone is a set of lights that matches one display. Pick the zone for each display, or create one.</p>
          <HaConnection />
          <div v-if="!haOk" class="mut">Home Assistant isn't configured with any lights, so there's nothing to zone. Skip this step.</div>
          <template v-else>
            <div v-for="d in displays" :key="d.id" class="ob-row">
              <b>{{ d.name || d.id }}</b>
              <span class="grow"></span>
              <select :value="zoneFor(d.id)" @change="setZone(d.id, $event.target.value)">
                <option value="">No zone</option>
                <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }} ({{ z.lights.length }} lights)</option>
              </select>
              <button @click="newZone(d)">+ New zone</button>
              <button v-if="zoneFor(d.id)" title="Flash these lights to find them" @click="flash(zoneFor(d.id))">Flash</button>
            </div>
            <div v-if="msg" class="err">{{ msg }}</div>
            <HaAreas />
            <p class="mut" style="font-size:12px">Assign individual lights on the <router-link to="/zones" @click="emit('close')">Zones page</router-link>.</p>
          </template>
        </template>

        <template v-else-if="step === 4">
          <h2>Kiosks</h2>
          <p class="mut">Home Assistant wall tablets (Browser Mod devices named "Kiosk - Room") can show the party dashboard.</p>
          <div v-if="!S.ha.enabled" class="mut">Home Assistant isn't connected. Set HA_URL and HA_TOKEN in .env. Skip this step.</div>
          <template v-else>
            <div v-for="k in kiosks" :key="k.browserId" class="ob-row">
              <span class="dot" :class="k.online ? 'ok' : ''"></span><b>{{ k.name }}</b><span class="mut">{{ k.online ? 'online' : 'offline' }}</span>
            </div>
            <p v-if="!kiosks.length" class="mut">No kiosks found. Name Browser Mod devices "Kiosk - Room name" in Home Assistant.</p>
            <label class="ob-f">Dashboard message
              <textarea v-model="message" maxlength="500" rows="2"></textarea>
            </label>
            <label class="ob-f">Camera for the small stream (optional)
              <input v-model="camera" placeholder="camera.front_door">
            </label>
            <div class="row">
              <button :disabled="kioskBusy" @click="saveKiosk">Save</button>
              <button :disabled="kioskBusy" @click="loadKiosks">Refresh kiosks</button>
              <button :disabled="kioskBusy" @click="takeover(true)">Test takeover</button>
              <button :disabled="kioskBusy" @click="takeover(false)">Return to dashboards</button>
            </div>
            <p v-if="kioskMsg" role="status" class="mut">{{ kioskMsg }}</p>
          </template>
        </template>

        <template v-else>
          <h2>Ready</h2>
          <ul class="ob-sum">
            <li>{{ displays.length }} display{{ displays.length === 1 ? '' : 's' }} ({{ remote.filter(d => d.online).length }} remote online)</li>
            <li>{{ zones.length }} zone{{ zones.length === 1 ? '' : 's' }}</li>
            <li>{{ kiosks.length }} kiosk{{ kiosks.length === 1 ? '' : 's' }} found</li>
          </ul>
          <div class="row"><button class="on" @click="emit('close')">Start the party</button><button @click="step = 0">Review from the start</button></div>
        </template>
      </div>

      <div class="ob-f2">
        <button :disabled="step === 0" @click="back">Back</button>
        <span class="grow"></span>
        <button v-if="step < steps.length - 1" class="on" @click="next">Next</button>
      </div>
    </div>
  </div>
</template>
