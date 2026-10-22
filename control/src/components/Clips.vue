<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { cmd } from '../store.js';

const S = computed(() => hub.S);
const KEY = 'oneparty.dl';
const form = reactive({ pl: 'single', q: '1080', n: 5, s: '', e: '', c: 'auto' });
try { Object.assign(form, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* private mode */ }
watch(form, f => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignore */ } });

const urls = ref(''), dlMsg = ref('');
const jobs = computed(() => S.value.downloads || []);

async function add() {
  const list = urls.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!list.length) { dlMsg.value = 'paste at least one link'; return; }
  const r = await cmd({ type: 'dlAdd', urls: list, playlist: form.pl, first: +form.n, height: +form.q, cookies: form.c, start: form.s, end: form.e });
  dlMsg.value = r.error || `queued ${r.dl?.added}${r.dl?.rejected?.length ? ` (${r.dl.rejected.length} skipped: not a link)` : ''}`;
  if (!r.error) urls.value = '';
}
const jobName = j => (j.files?.length ? j.files[j.files.length - 1] : j.url);
const jobPart = j => (j.start || j.end ? ` · clip ${j.start || '0:00'}–${j.end || 'end'}` : '') + (j.playlist !== 'single' ? ` · playlist${j.playlist === 'first' ? ' (first ' + j.first + ')' : ''}` : '');
const jobStatus = j => ({
  downloading: `Downloading ${Math.round(j.pct)}%${j.items ? ` · ${j.item}/${j.items}` : ''}`,
  done: `Done · ${j.files.length} file${j.files.length === 1 ? '' : 's'}`,
  error: 'Failed: ' + j.error, canceled: 'Canceled',
}[j.status] || 'Queued');

// YouTube sign-in
const yt = computed(() => S.value.ytLogin || { state: 'idle', cookies: {} });
const ck = computed(() => yt.value.cookies || {});
const ago = computed(() => {
  const age = ck.value.savedAt ? Math.max(1, Math.round((Date.now() - ck.value.savedAt) / 60000)) : 0;
  return age < 90 ? `${age} min ago` : age < 2880 ? `${Math.round(age / 60)} h ago` : `${Math.round(age / 1440)} days ago`;
});
const ytClass = computed(() => (['waiting', 'capturing'].includes(yt.value.state) ? 'wait' : ck.value.present ? 'ok' : ''));
const ytTitle = computed(() => yt.value.state === 'waiting' ? 'Waiting for you to sign in…' : yt.value.state === 'capturing' ? 'Saving cookies…' : ck.value.present ? 'Signed in to YouTube' : 'Not signed in to YouTube');
const ytMsg = ref('');
const ytText = computed(() => ytMsg.value || yt.value.message || (ck.value.present ? `Cookies captured ${ago.value}. Downloads use them automatically.` : 'Click Sign in: a window opens, sign in once, and cookies are captured for you.'));
const ytSign = () => cmd({ type: 'ytLogin', action: yt.value.state === 'waiting' ? 'cancel' : 'start' }).then(r => { ytMsg.value = r.error || ''; });
const ytForget = () => { if (confirm('Delete the saved YouTube cookies and sign out?')) cmd({ type: 'ytLogin', action: 'forget' }); };

</script>

<template>
  <section class="card">
    <h2>Clip downloads</h2>
    <div class="yt-auth" :class="ytClass">
      <div><b>{{ ytTitle }}</b><div class="mut" style="font-size:12px">{{ ytText }}</div></div>
      <span class="row">
        <button @click="ytSign">{{ yt.state === 'waiting' ? 'Cancel' : ck.present ? 'Refresh' : 'Sign in' }}</button>
        <button v-if="ck.present && yt.state !== 'waiting'" title="Delete the saved cookies" @click="ytForget">Sign out</button>
      </span>
    </div>

    <textarea v-model="urls" rows="3" spellcheck="false" placeholder="One link per line (videos or playlists).&#10;Snippet for one link:  https://youtu.be/xxxx @ 1:20-2:10"></textarea>
    <div class="dl-opts">
      <label>Playlists
        <select v-model="form.pl"><option value="single">Just that video</option><option value="all">Whole playlist</option><option value="first">First N videos</option></select>
      </label>
      <label v-if="form.pl === 'first'">How many<input v-model="form.n" type="number" min="1" max="200"></label>
      <label>Quality
        <select v-model="form.q"><option value="720">720p</option><option value="1080">1080p</option><option value="1440">1440p</option><option value="2160">4K</option></select>
      </label>
      <label title="Applies to every link without its own @ range. Leave blank for the full video.">Snippet start<input v-model="form.s" placeholder="0:00"></label>
      <label>Snippet end<input v-model="form.e" placeholder="end"></label>
      <label title="YouTube often demands a sign-in. Auto uses cookies.txt from the project folder if present.">Cookies from
        <select v-model="form.c">
          <option value="auto">Auto (cookies.txt if present)</option><option value="none">None</option><option value="file">cookies.txt file</option>
          <option value="firefox">Firefox</option><option value="brave">Brave (close it first)</option><option value="edge">Edge (close it first)</option><option value="chrome">Chrome (close it first)</option>
        </select>
      </label>
    </div>
    <div class="row" style="margin:10px 0 6px">
      <button class="on" @click="add">Add to queue</button>
      <button @click="cmd({ type: 'dlClear' })">Clear finished</button>
      <span class="mut" style="font-size:12px">{{ dlMsg }}</span>
    </div>
    <div class="dl-list">
      <div v-for="j in jobs" :key="j.id" class="dl-job" :class="j.status">
        <div class="t" :title="j.url">{{ jobName(j) }}</div>
        <button v-if="['queued', 'downloading'].includes(j.status)" title="Cancel" @click="cmd({ type: 'dlCancel', id: j.id })">✕</button><span v-else></span>
        <div class="m">{{ jobStatus(j) }}{{ jobPart(j) }}</div>
        <div class="b"><i :style="{ width: (j.status === 'done' ? 100 : j.pct || 0) + '%' }"></i></div>
      </div>
    </div>
    <div class="mut" style="font-size:12px;margin:8px 0 14px">Saved to media/&lt;event&gt;/ and picked up by the video channels.</div>
  </section>
</template>
