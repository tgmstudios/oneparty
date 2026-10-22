<script setup>
import { computed, ref } from 'vue';
import { hub, cmd } from '../store.js';

const S = computed(() => hub.S);
const sel = ref(null), draft = ref(null), msg = ref('');
const blank = () => ({ id: '', label: '', display: { type: 'color', color: '#ff00aa' }, popup: { color: '#ff00aa', html: '' }, lights: { mode: 'color', color: '#ff00aa', brightness: 255 } });
function pick(d) { sel.value = d.id; draft.value = JSON.parse(JSON.stringify(d)); msg.value = ''; }
function add() { sel.value = '+'; draft.value = blank(); msg.value = ''; }
function setType(t) { draft.value.display = t === 'whiteout3d' ? { type: t } : { type: t, color: draft.value.display.color || '#000000', html: draft.value.display.html || '' }; }
async function save() {
  const d = draft.value; if (sel.value === '+' && !d.id) d.id = d.label;
  const r = await cmd({ type: 'takeoverDef', action: 'upsert', def: d });
  msg.value = r.error || 'Saved. Live displays and kiosks pick it up now.'; if (!r.error) sel.value = r.id;
}
async function remove() {
  if (!confirm('Delete "' + draft.value.label + '"?')) return;
  const r = await cmd({ type: 'takeoverDef', action: 'remove', id: sel.value });
  msg.value = r.error || ''; if (!r.error) { sel.value = null; draft.value = null; }
}
async function reset() { const r = await cmd({ type: 'takeoverDef', action: 'reset', id: sel.value }); msg.value = r.error || 'Restored defaults.'; if (!r.error) pick(S.value.takeovers.find(d => d.id === sel.value)); }
const preview = computed(() => draft.value && (draft.value.display.type === 'html' ? draft.value.display.html : ''));
</script>

<template>
  <section class="card">
    <h2>Takeovers</h2>
    <p class="mut">Full-screen states that replace every display, Home Assistant kiosk popup and light at once (like Whiteout and Blackout). Add or change them any time — no restart. Active ones update live as you save.</p>
    <div class="row">
      <button v-for="d in S.takeovers" :key="d.id" :class="{ on: sel === d.id }" @click="pick(d)">{{ d.label }}<span v-if="S.takeover === d.id"> ●</span></button>
      <button :class="{ on: sel === '+' }" @click="add">+ New</button>
    </div>
    <div v-if="draft" style="margin-top:12px;display:grid;gap:10px">
      <label>Name <input v-model="draft.label" maxlength="40" /></label>
      <fieldset class="row" style="border:0;padding:0;margin:0">
        <legend class="mut">Displays show</legend>
        <button v-for="t in [['color', 'Solid color'], ['html', 'Custom HTML'], ['whiteout3d', '3D wordmark']]" :key="t[0]" :class="{ on: draft.display.type === t[0] }" @click="setType(t[0])">{{ t[1] }}</button>
        <input v-if="draft.display.type !== 'whiteout3d'" type="color" v-model="draft.display.color" title="Background" />
      </fieldset>
      <label v-if="draft.display.type === 'html'">Display HTML (no scripts)
        <textarea v-model="draft.display.html" rows="5" maxlength="20000" placeholder="<h1>Last call!</h1>"></textarea>
      </label>
      <label>Home Assistant popup HTML (blank = just the color; <code>&#123;&#123;title&#125;&#125;</code> and <code>&#123;&#123;subtitle&#125;&#125;</code> fill in)
        <textarea v-model="draft.popup.html" rows="3" maxlength="20000"></textarea>
      </label>
      <label class="row">Popup color <input type="color" v-model="draft.popup.color" /></label>
      <fieldset class="row" style="border:0;padding:0;margin:0">
        <legend class="mut">Lights</legend>
        <button v-for="m in [['none', 'Leave alone'], ['off', 'All off'], ['color', 'One color']]" :key="m[0]" :class="{ on: draft.lights.mode === m[0] }" @click="draft.lights = m[0] === 'color' ? { mode: 'color', color: draft.lights.color || '#ffffff', brightness: draft.lights.brightness || 255 } : { mode: m[0] }">{{ m[1] }}</button>
        <template v-if="draft.lights.mode === 'color'"><input type="color" v-model="draft.lights.color" /><input type="number" min="1" max="255" v-model.number="draft.lights.brightness" style="width:80px" title="Brightness 1-255" /></template>
      </fieldset>
      <div class="row">
        <button class="on" @click="save">Save</button>
        <button v-if="sel !== '+'" @click="cmd({ type: 'takeover', id: sel })">{{ S.takeover === sel ? 'Turn off' : 'Turn on' }}</button>
        <button v-if="sel !== '+' && draft.builtin" @click="reset">Reset to default</button>
        <button v-else-if="sel !== '+'" @click="remove">Delete</button>
      </div>
      <p v-if="msg" role="status">{{ msg }}</p>
    </div>
  </section>
</template>
