<script setup>
import { computed, reactive, ref } from 'vue';
import { hub, cmd } from '../store.js';

// Entries: edit text, attach a photo (shown on the leaderboard), delete, or add one for a guest without a phone.
const C = computed(() => hub.S.contest);
const edit = reactive({}), busy = ref(''), err = ref(''), add = reactive({ name: '', costume: '' });
const rankOf = id => C.value.ranking.find(r => r.id === id)?.rank;
const sorted = computed(() => [...C.value.entries].sort((a, b) => (rankOf(a.id) || 99) - (rankOf(b.id) || 99)));
const run = async (key, fn) => { busy.value = key; err.value = ''; try { const r = await fn(); if (r?.error) err.value = r.error; } catch (e) { err.value = e.message; } busy.value = ''; };
const save = e => run(e.id, async () => { const r = await cmd({ type: 'contest', action: 'editEntry', id: e.id, ...edit[e.id] }); delete edit[e.id]; return r; });
const del = e => confirm(`Remove "${e.costume}" (${e.name}) and its votes?`) && run(e.id, () => cmd({ type: 'contest', action: 'removeEntry', id: e.id }));
const upload = (id, ev) => {
  const file = ev.target.files?.[0]; ev.target.value = ''; if (!file) return;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { err.value = 'Pick a jpg, png, webp or gif'; return; }
  if (file.size > 10 * 1024 * 1024) { err.value = 'That image is over 10 MB'; return; }
  run(id, async () => (await fetch('/api/contest/image?id=' + id, { method: 'POST', headers: { 'content-type': file.type }, body: file })).json());
};
const addEntry = () => run('add', async () => { const r = await cmd({ type: 'contest', action: 'addEntry', ...add }); if (!r.error) { add.name = ''; add.costume = ''; } return r; });
</script>

<template>
  <section class="card">
    <h2>Costume entries <small class="mut">{{ C.entries.length }} · {{ C.totals?.votes ?? 0 }} votes</small></h2>
    <p v-if="err" class="err" role="alert" style="margin:0 0 8px">{{ err }}</p>
    <div v-if="!C.connected" class="mut">Connect the guest app first.</div>
    <div v-else-if="!C.entries.length" class="mut" style="font-size:12px">No entries yet. Guests add theirs from the QR code.</div>
    <div v-for="e in sorted" :key="e.id" class="ct-entry">
      <label class="ct-photo" :title="e.imageUrl ? 'Replace photo' : 'Add photo'">
        <img v-if="e.imageUrl" :src="e.imageUrl" alt="">
        <span v-else>＋<br>photo</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden :disabled="busy === e.id" @change="upload(e.id, $event)">
      </label>
      <div class="grow">
        <template v-if="edit[e.id]">
          <input v-model="edit[e.id].costume" maxlength="80" placeholder="Costume"><input v-model="edit[e.id].name" maxlength="40" placeholder="Name" style="margin-top:4px">
          <div class="row" style="margin-top:6px"><button class="on" :disabled="busy === e.id" @click="save(e)">Save</button><button @click="delete edit[e.id]">Cancel</button></div>
        </template>
        <template v-else>
          <b>{{ e.costume }}</b> <span v-if="e.host" class="mut">(added by you)</span>
          <div class="mut" style="font-size:12px">{{ e.name }}</div>
        </template>
      </div>
      <div class="ct-votes"><b>{{ e.votes }}</b><span class="mut">vote{{ e.votes === 1 ? '' : 's' }}</span><span v-if="rankOf(e.id)" class="mut">#{{ rankOf(e.id) }}</span></div>
      <span v-if="!edit[e.id]" class="ctl">
        <button title="Edit" @click="edit[e.id] = { name: e.name, costume: e.costume }">✎</button>
        <button v-if="e.image" title="Remove photo" @click="run(e.id, () => cmd({ type: 'contest', action: 'removeImage', id: e.id }))">🖼✕</button>
        <button class="del" title="Remove entry" @click="del(e)">✕</button>
      </span>
    </div>
    <div v-if="C.connected" class="ed-h" style="margin-top:14px"><b>Add an entry</b><span class="mut">for a guest without a phone</span></div>
    <div v-if="C.connected" class="row">
      <input v-model="add.name" class="grow" placeholder="Name" maxlength="40" @keyup.enter="addEntry">
      <input v-model="add.costume" class="grow" placeholder="Costume" maxlength="80" @keyup.enter="addEntry">
      <button :disabled="busy === 'add' || !add.name.trim() || !add.costume.trim()" @click="addEntry">Add</button>
    </div>
  </section>
</template>

<style scoped>
.ct-entry{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.ct-photo{flex:none;width:64px;height:64px;border-radius:12px;border:1px dashed var(--line);display:grid;place-items:center;text-align:center;font-size:11px;color:var(--mut);cursor:pointer;overflow:hidden;background:rgba(0,0,0,.25)}
.ct-photo img{width:100%;height:100%;object-fit:cover}
.ct-votes{display:flex;flex-direction:column;align-items:center;font-size:11px;min-width:44px}.ct-votes b{font-size:20px}
.ctl{display:flex;gap:4px}
</style>
