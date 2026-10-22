<script setup>
import { computed, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';
import Seg from './Seg.vue';
import Switch from './Switch.vue';

const props = defineProps({ zone: Object, color: String });
const S = computed(() => hub.S);
const z = computed(() => props.zone);
const status = computed(() => S.value.zoneStatus?.[z.value.id]);

const displays = computed(() => Object.entries(S.value.channels).filter(([, c]) => c.role !== 'control').map(([id, c]) => ({ id, label: c.name || id, remote: !!c.remote, online: c.online })));
const shown = computed(() => {
  const id = z.value.display && S.value.channels[z.value.display] ? z.value.display : Object.keys(S.value.channels)[0];
  const ch = S.value.channels[id], sc = S.value.scenes.find(s => s.id === ch?.scene);
  return { id, ch, scene: sc };
});
const grad = computed(() => { const p = shown.value.scene?.palette?.length ? shown.value.scene.palette : ['#444', '#222']; return `linear-gradient(135deg,${p[0]},${p[1] || p[0]} 55%,${p[2] || p[1] || p[0]})`; });

const update = patch => cmd({ type: 'zone', action: 'update', id: z.value.id, ...patch });
const name = ref(z.value.name); watch(() => z.value.name, v => { name.value = v; });
const bri = ref(z.value.brightness ?? 180); watch(() => z.value.brightness, v => { bri.value = v ?? 180; });
const loopOpts = [{ v: 'auto', label: 'Auto' }, { v: 'loop', label: 'Loop' }, { v: 'still', label: 'Still' }];
const loopVal = computed(() => (z.value.dynamic == null ? 'auto' : z.value.dynamic ? 'loop' : 'still'));
const setLoop = v => update({ dynamic: v === 'auto' ? null : v === 'loop' });
const remove = () => { if (confirm(`Delete zone "${z.value.name}"? Its lights go back to the global lighting.`)) cmd({ type: 'zone', action: 'remove', id: z.value.id }); };
const pretty = id => id.replace(/^light\./, '').replace(/_/g, ' ');
const modeNote = computed(() => {
  if (z.value.mode === 'off') return 'Lights off';
  if (z.value.mode === 'color') return 'Fixed color';
  const s = status.value;
  return s?.via === 'preset' ? `${s.preset} preset` : s?.via === 'palette' ? 'palette of the scene' : '…';
});
</script>

<template>
  <section class="card zone" :style="{ '--zc': color }">
    <div class="zone-h">
      <span class="zone-dot"></span>
      <input class="zone-name" v-model="name" @change="update({ name })">
      <span class="grow"></span>
      <button title="Flash this zone's lights to find them" @click="cmd({ type: 'zone', action: 'flash', id: z.id })">Flash</button>
      <button class="del" title="Delete zone" @click="remove">✕</button>
    </div>

    <div v-if="z.link" class="zone-link">
      <span>⛓ Home Assistant {{ z.link.type }}: <b>{{ z.link.id.replace(/_/g, ' ') }}</b> · {{ z.lights.length }} light{{ z.lights.length === 1 ? '' : 's' }}</span>
      <span v-if="status?.linkNote" class="err">{{ status.linkNote }}</span>
      <span class="grow"></span>
      <a href="#" @click.prevent="cmd({ type: 'zone', action: 'sync', id: z.id })">Sync now</a>
      <a href="#" @click.prevent="update({ link: null })">Unlink</a>
    </div>
    <div class="zone-show" :style="{ '--g': grad }">
      <div class="zone-show-t">
        <span class="mut" style="font-size:11px;letter-spacing:.1em">FOLLOWS</span>
        <select :value="z.display || shown.id" @change="update({ display: $event.target.value })">
          <option v-for="d in displays" :key="d.id" :value="d.id">{{ d.label }}{{ d.remote ? ' (remote' + (d.online ? '' : ', offline') + ')' : '' }}</option>
        </select>
      </div>
      <div class="zone-scene"><b>{{ shown.scene ? shown.scene.id + ' ' + shown.scene.title : '—' }}</b><span>{{ shown.ch?.mode === 'stream' ? 'streaming (keeps last scene look)' : shown.ch?.mode }}</span></div>
    </div>

    <div class="row">
      <Seg :options="[{ v: 'follow', label: 'Match visuals' }, { v: 'color', label: 'Fixed color' }, { v: 'off', label: 'Off' }]" :model-value="z.mode" @update:model-value="update({ mode: $event })" />
      <input v-if="z.mode === 'color'" type="color" :value="z.color" @change="update({ color: $event.target.value })">
    </div>

    <div v-if="z.mode === 'follow'" class="row">
      <Switch :on="z.beat" title="Brighten these lights on every beat" @click="update({ beat: !z.beat })">Beat pulse</Switch>
      <span class="mut" style="font-size:12px">Colors</span>
      <Seg :options="loopOpts" :model-value="loopVal" @update:model-value="setLoop" />
    </div>
    <div v-if="z.mode !== 'off'" class="row">
      <span class="mut" style="font-size:12px">Brightness</span>
      <input type="range" min="20" max="255" class="grow" v-model="bri" @change="update({ brightness: +bri })">
      <span class="mut num" style="width:3ch">{{ Math.round(bri / 2.55) }}%</span>
    </div>
    <div v-if="z.mode === 'follow'" class="row">
      <span class="mut" style="font-size:12px">Preset</span>
      <select class="grow" :value="z.preset || ''" @change="update({ preset: $event.target.value || null })">
        <option value="">Per-scene preset (automatic)</option>
        <optgroup v-for="c in [...new Set(S.presets.map(p => p.category))]" :key="c" :label="c">
          <option v-for="p in S.presets.filter(x => x.category === c)" :key="p.id" :value="p.id">{{ p.name }}</option>
        </optgroup>
      </select>
    </div>

    <div class="zone-lights">
      <span v-for="l in z.lights" :key="l" class="chip" :title="'Click to remove from this zone'" @click="cmd({ type: 'zone', action: 'assign', light: l, zone: null })">{{ pretty(l) }} ✕</span>
      <span v-if="!z.lights.length" class="mut" style="font-size:12px">No lights yet: assign some from the list.</span>
    </div>
    <div class="mut" style="font-size:12px">
      <span class="dot" :class="status ? (status.ok ? 'ok' : 'bad') : ''"></span>
      {{ modeNote }}{{ status && !status.ok ? ' · ' + (status.error || 'failed') : '' }}
    </div>
  </section>
</template>
