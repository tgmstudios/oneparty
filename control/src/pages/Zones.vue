<script setup>
import { computed, ref } from 'vue';
import { hub, cmd } from '../store.js';
import ZoneCard from '../components/ZoneCard.vue';
import LightAssign from '../components/LightAssign.vue';
import HaConnection from '../components/HaConnection.vue';
import HaAreas from '../components/HaAreas.vue';

const S = computed(() => hub.S);
const zones = computed(() => S.value.zones || []);
const COLORS = ['#ff6a10', '#37d67a', '#4a9dff', '#ff4fd8', '#ffd23a', '#9a6bff', '#2fe0d0', '#ff5468'];
const colors = computed(() => Object.fromEntries(zones.value.map((z, i) => [z.id, COLORS[i % COLORS.length]])));
const newName = ref('');
const msg = ref('');
async function add() {
  const name = newName.value.trim() || 'Zone ' + (zones.value.length + 1);
  const main = Object.keys(S.value.channels)[0];
  const r = await cmd({ type: 'zone', action: 'add', name, display: main });
  msg.value = r.error || ''; if (!r.error) newName.value = '';
}
const noHa = computed(() => !S.value.ha.enabled || !S.value.ha.lights.length);
</script>

<template>
  <div v-if="noHa" class="cols two"><div class="col"><HaConnection /></div><div class="col"><div class="card"><h2>Zones</h2><p class="mut" style="margin:0">Home Assistant isn't reachable or has no lights listed, so there are no lights to put in zones. Set HA_URL and HA_TOKEN in .env (and a local IP here if it's on your network) and list lights in the event config.</p></div></div></div>
  <div v-else class="cols two">
    <div class="col">
      <section class="card">
        <h2>Zones <small>{{ zones.length }}</small></h2>
        <div class="mut" style="font-size:12px;margin-bottom:10px">A zone is a set of lights tied to one display. Whatever that display shows, those lights match: the scene's preset or palette, plus a pulse on the beat. Use it for an upstairs screen, the bathroom, a bar.</div>
        <div class="row">
          <input class="grow" v-model="newName" placeholder="New zone name, e.g. Upstairs" @keyup.enter="add">
          <button class="on" @click="add">Add zone</button>
        </div>
        <div v-if="msg" class="err" style="font-size:12px;margin-top:6px">{{ msg }}</div>
      </section>
      <HaConnection />
      <HaAreas />
      <LightAssign :colors="colors" />
    </div>
    <div class="col">
      <ZoneCard v-for="z in zones" :key="z.id" :zone="z" :color="colors[z.id]" />
      <section v-if="!zones.length" class="card"><p class="mut" style="margin:0">No zones yet. Add one, then assign lights to it from the list.</p></section>
    </div>
  </div>
</template>
