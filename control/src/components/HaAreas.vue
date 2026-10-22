<script setup>
import { computed, onMounted, ref } from 'vue';
import { hub, cmd } from '../store.js';

// Home Assistant areas and floors (e.g. Upstairs / Downstairs / Kitchen), one click each into a lighting zone that stays in sync.
const data = ref({ areas: [], floors: [] }), loading = ref(false), err = ref(''), msg = ref('');
async function load(refresh = false) {
  loading.value = true; err.value = '';
  try { const r = await fetch('/api/ha-areas' + (refresh ? '?refresh=1' : '')); const j = await r.json(); if (j.error) throw new Error(j.error); data.value = j; }
  catch (e) { err.value = 'Could not read Home Assistant areas: ' + e.message; }
  loading.value = false;
}
onMounted(() => load());
const zones = computed(() => hub.S.zones || []);
const linked = (kind, id) => zones.value.find(z => z.link?.type === kind && z.link.id === id);
const withLights = list => list.filter(x => x.lights.length);
const floorOf = id => data.value.floors.find(f => f.id === id)?.name;
async function make(kind, ids) {
  const r = await cmd({ type: 'zone', action: 'import', kind, ids }); msg.value = r.error || `${r.zones?.length || 0} zone(s) ready${r.skipped?.length ? ' · skipped ' + r.skipped.join(', ') : ''}`;
}
const syncAll = async () => { const r = await cmd({ type: 'zone', action: 'sync' }); msg.value = r.error || (r.changed?.length ? 'updated ' + r.changed.join(', ') : 'everything already matches Home Assistant'); };
const anyLinked = computed(() => zones.value.some(z => z.link));
</script>

<template>
  <section class="card">
    <h2>Home Assistant <small>areas &amp; floors</small></h2>
    <div class="mut" style="font-size:12px;margin-bottom:10px">Create a zone straight from a Home Assistant floor or area. Its lights are copied in and re-checked every 5 minutes, so moving a light in Home Assistant moves it here.</div>
    <div class="row" style="margin-bottom:8px">
      <button :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Refresh' }}</button>
      <button v-if="anyLinked" @click="syncAll">Sync linked zones now</button>
      <span class="mut" style="font-size:12px">{{ msg }}</span>
    </div>
    <div v-if="err" class="err" style="font-size:12px">{{ err }}</div>

    <template v-if="data.floors.length">
      <div class="ed-h" style="margin-top:6px"><b>Floors</b><span class="mut">all lights on the floor</span>
        <span class="grow"></span><a href="#" style="font-size:12px" @click.prevent="make('floor', 'all')">Create all</a></div>
      <div class="ha-list">
        <div v-for="f in data.floors" :key="f.id" class="ha-row">
          <div><b>{{ f.name }}</b><div class="mut" style="font-size:12px">{{ f.areas.length }} area{{ f.areas.length === 1 ? '' : 's' }} · {{ f.lights.length }} light{{ f.lights.length === 1 ? '' : 's' }}</div></div>
          <button v-if="linked('floor', f.id)" disabled>Zone: {{ linked('floor', f.id).name }}</button>
          <button v-else-if="f.lights.length" class="on" @click="make('floor', [f.id])">Create zone</button>
          <span v-else class="mut" style="font-size:12px">no lights</span>
        </div>
      </div>
    </template>

    <div class="ed-h" style="margin-top:16px"><b>Areas</b><span class="mut">rooms</span>
      <span class="grow"></span><a href="#" style="font-size:12px" @click.prevent="make('area', 'all')">Create all</a></div>
    <div class="ha-list">
      <div v-for="a in withLights(data.areas)" :key="a.id" class="ha-row">
        <div><b>{{ a.name }}</b><div class="mut" style="font-size:12px">{{ a.lights.length }} light{{ a.lights.length === 1 ? '' : 's' }}{{ a.floor ? ' · ' + floorOf(a.floor) : '' }}</div></div>
        <button v-if="linked('area', a.id)" disabled>Zone: {{ linked('area', a.id).name }}</button>
        <button v-else class="on" @click="make('area', [a.id])">Create zone</button>
      </div>
      <div v-if="!withLights(data.areas).length && !loading && !err" class="mut" style="font-size:12px">No areas with lights found in Home Assistant.</div>
    </div>
  </section>
</template>
