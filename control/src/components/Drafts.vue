<script setup>
import { ref } from 'vue';
import { hub, cmd, refreshAssets } from '../store.js';

// Scenes authored off-air (by an agent via the MCP server). They never reach a display until promoted.
const busy = ref(''), msg = ref('');
const run = async (id, label, fn) => {
  busy.value = id; msg.value = label + '…';
  try { const r = await fn(); msg.value = r.error || (r.verdict ? `${id}: ${r.verdict}${[...(r.problems || []), ...(r.warnings || [])].length ? ' - ' + [...(r.problems || []), ...(r.warnings || [])][0] : ''}` : `${id}: ok`); }
  finally { busy.value = ''; refreshAssets(); }
};
const preview = d => run(d.id, 'previewing ' + d.id, () => cmd({ type: 'preview', scene: d.id }));
const promote = d => run(d.id, 'promoting ' + d.id, () => cmd({ type: 'promote', id: d.id }));
const discard = d => run(d.id, 'removing ' + d.id, () => cmd({ type: 'draft', id: d.id, remove: true }));
</script>

<template>
  <section v-if="hub.drafts.length" class="card">
    <h2>Drafts <small>off-air</small></h2>
    <div class="dl-list">
      <div v-for="d in hub.drafts" :key="d.id" class="dl-job" :class="d.previewed ? 'done' : ''">
        <div class="t">{{ d.id }}</div>
        <span class="row">
          <button :disabled="busy === d.id" @click="preview(d)">Preview</button>
          <button :disabled="busy === d.id || !d.previewed" :class="{ on: d.previewed }" :title="d.previewed ? '' : 'Preview it first'" @click="promote(d)">Promote</button>
          <button class="del" title="Delete draft" @click="discard(d)">✕</button>
        </span>
        <div class="m">{{ d.previewed ? 'previewed OK' : 'not previewed' }} · {{ d.bytes }} bytes</div>
      </div>
    </div>
    <div class="mut" style="font-size:12px;margin-top:8px">{{ msg }}</div>
  </section>
</template>
