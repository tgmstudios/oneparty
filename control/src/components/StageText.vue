<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';

// Local copy of the announcements/bubbles so typing is never clobbered by a state push; every edit auto-saves after a short pause.
const ed = reactive({ bubbles: [], announcements: [], jam: '', quiet: 12, bsec: 6, asec: 8 });
const root = ref(null), status = ref('');
let touched = 0, saveT = null, loaded = false;
const hud = computed(() => hub.S.hud);
const qr = ref('');

const size = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
const sizeAll = () => requestAnimationFrame(() => root.value?.querySelectorAll('textarea').forEach(size));

const shortPrice = d => !!d && d.length <= 9;
function load(force) {
  const h = hud.value; if (!h) return;
  const el = document.activeElement, typing = el && root.value?.contains(el) && el.tagName !== 'BUTTON';
  if (!force && loaded && (typing || Date.now() - touched < 6000)) return;
  loaded = true;
  ed.bubbles = h.bubbles.slice();
  ed.announcements = h.announcements.map(a => {
    const n = { category: a.category || '', title: a.title || '', price: a.price || '', detail: a.detail || '' };
    if (!n.price && shortPrice(n.detail)) { n.price = n.detail; n.detail = ''; }   // older "Title | $3" entries
    return n;
  });
  ed.jam = h.jam.url || ''; ed.quiet = h.quietSeconds ?? 12; ed.bsec = h.bubbleSeconds ?? 6; ed.asec = h.announceSeconds ?? 8;
}
watch(hud, () => { load(); nextTick(sizeAll); }, { immediate: true, deep: true });

watch(() => ed.jam, u => {
  if (u && window.qrcode) { try { const q = window.qrcode(0, 'M'); q.addData(u); q.make(); qr.value = q.createDataURL(4, 2); } catch { qr.value = ''; } } else qr.value = '';
}, { immediate: true });


function save(extra = {}) {
  clearTimeout(saveT);
  const num = v => (v === '' || v == null ? undefined : +v);
  return cmd({
    type: 'hud', bubbles: ed.bubbles.filter(t => t.trim()), announcements: ed.announcements.filter(a => a.title.trim()),
    quietSeconds: num(ed.quiet), bubbleSeconds: num(ed.bsec), announceSeconds: num(ed.asec), jam: { url: ed.jam, ...extra },
  }).then(() => { touched = Date.now(); status.value = 'saved ✓'; setTimeout(() => { status.value = ''; }, 1500); });
}
function queueSave() { touched = Date.now(); status.value = 'editing…'; clearTimeout(saveT); saveT = setTimeout(() => save(), 600); }
function move(list, i, d) { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; queueSave(); }
function remove(list, i) { list.splice(i, 1); queueSave(); }
async function add(list, blank, sel) { list.push(blank); touched = Date.now(); await nextTick(); sizeAll(); root.value.querySelector(sel)?.focus(); }
</script>

<template>
  <section v-if="hud" id="stage-card" ref="root" class="card">
    <h2>Stage text <small class="mut">{{ status }}</small></h2>

    <div class="ed-h"><b>Announcements</b><span class="mut">bottom-right rotation</span></div>
    <div class="ed-list">
      <div v-for="(a, i) in ed.announcements" :key="i" class="ann-row">
        <input v-model="a.category" data-f="category" placeholder="Category (SPECIAL)" @input="queueSave">
        <input v-model="a.price" data-f="price" placeholder="Price" @input="queueSave">
        <span class="ctl">
          <button title="Move up" @click="move(ed.announcements, i, -1)">↑</button>
          <button title="Move down" @click="move(ed.announcements, i, 1)">↓</button>
          <button class="del" title="Remove" @click="remove(ed.announcements, i)">✕</button>
        </span>
        <textarea v-model="a.title" class="full" data-f="title" rows="1" placeholder="Title, e.g. Jungle Juice" @input="size($event.target); queueSave()"></textarea>
        <textarea v-model="a.detail" class="full" data-f="detail" rows="1" placeholder="Description (optional) - Enter adds a line" @input="size($event.target); queueSave()"></textarea>
      </div>
      <div v-if="!ed.announcements.length" class="mut" style="font-size:12px">No announcements yet.</div>
    </div>
    <button class="ed-add" @click="add(ed.announcements, { category: '', title: '', price: '', detail: '' }, '.ann-row:last-child [data-f=title]')">+ Add announcement</button>

    <div class="ed-h" style="margin-top:20px"><b>Bubbles</b><span class="mut">short messages</span></div>
    <div class="ed-list">
      <div v-for="(t, i) in ed.bubbles" :key="i" class="bub-row">
        <textarea v-model="ed.bubbles[i]" rows="1" placeholder="Message - Enter adds a line" @input="size($event.target); queueSave()"></textarea>
        <span class="ctl">
          <button title="Move up" @click="move(ed.bubbles, i, -1)">↑</button>
          <button title="Move down" @click="move(ed.bubbles, i, 1)">↓</button>
          <button class="del" title="Remove" @click="remove(ed.bubbles, i)">✕</button>
        </span>
      </div>
      <div v-if="!ed.bubbles.length" class="mut" style="font-size:12px">No bubbles yet.</div>
    </div>
    <button class="ed-add" @click="add(ed.bubbles, '', '.bub-row:last-child textarea')">+ Add bubble</button>

    <div class="ed-h" style="margin-top:20px"><b>Spotify Jam</b><span class="mut">QR on the left</span></div>
    <div class="row">
      <input v-model="ed.jam" placeholder="Paste the Jam link from the Spotify app" class="grow" @change="save()">
      <img v-if="qr" :src="qr" alt="" style="width:72px;height:72px;border-radius:8px;background:#fff;image-rendering:pixelated">
    </div>
    <div class="row" style="margin-top:8px">
      <Switch :on="!!hud.jam.on" @click="save({ on: !hud.jam.on })">Show QR</Switch>
      <Switch :on="!!hud.jam.pin" @click="save({ pin: !hud.jam.pin })">Pin</Switch>
    </div>

    <div class="ed-h" style="margin-top:20px"><b>Timing</b><span class="mut">seconds</span></div>
    <div class="ed-time">
      <label title="Nothing on screen between bubbles/announcements (0 = always something)">Quiet gap<input v-model="ed.quiet" type="number" min="0" max="120" @change="save()"></label>
      <label>Bubble hold<input v-model="ed.bsec" type="number" min="3" max="30" @change="save()"></label>
      <label>Announcement hold<input v-model="ed.asec" type="number" min="3" max="60" @change="save()"></label>
    </div>
  </section>
</template>
