<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';
import { createHubAudio } from '../../../web/js/hubaudio.js';
import { createYoutubeAudio } from '../../../web/js/youtubeaudio.js';
const emit = defineEmits(['activity']);

const outputs = ref([]), sink = ref(''), source = ref(''), volume = ref(0.5);
let savedBuffer = 80;
try { savedBuffer = Math.max(60, Math.min(15000, Number(localStorage.getItem('oneparty.speakerBufferMs') ?? 80) || 80)); } catch { /* storage disabled */ }
const bufferMs = ref(savedBuffer);
const mode = ref('youtube'), youtubeUrl = ref(''), media = ref(null), youtubeTitle = ref('');
let youtube;
const active = ref(false), status = ref('Discover outputs to select the Bluetooth speaker.'), busy = ref(false);
watch(active, value => emit('activity', value));
const supported = !!window.AudioContext?.prototype.setSinkId && !!navigator.mediaDevices?.enumerateDevices;
const devices = computed(() => hub.S?.audioDevices || []);
const player = createHubAudio({ buffer: bufferMs.value / 1000, onState(state, error) {
  status.value = error || ({ connecting: 'Connecting…', playing: `Playing on the selected speaker (${bufferMs.value} ms buffer).`, blocked: 'Click Enable sound to allow playback.', off: 'Stopped.' }[state] || state);
} });
let toneContext;
function closeTone() { toneContext?.close().catch(() => {}); toneContext = null; }
function stop() { player.stop(); youtube?.stop(); active.value = false; closeTone(); }
defineExpose({ stop });
function setVolume() { player.setVolume(volume.value); youtube?.setVolume(volume.value); }
function setBuffer(value) {
  bufferMs.value = Math.max(60, Math.min(15000, Number(value) || 60));
  player.setBuffer(bufferMs.value / 1000);
  try { localStorage.setItem('oneparty.speakerBufferMs', String(bufferMs.value)); } catch { /* storage disabled */ }
}
onMounted(() => {
  youtube = createYoutubeAudio({ audio: media.value, onState(state, message) {
    if (state === 'ready') youtubeTitle.value = message;
    status.value = message;
    active.value = ['loading', 'ready', 'playing', 'paused', 'blocked', 'buffering'].includes(state);
  } });
  youtube.setVolume(volume.value);
  discover(false);
});
async function playYoutube() {
  stop(); youtubeTitle.value = '';
  let url;
  try {
    url = new URL(youtubeUrl.value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || !/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)$/.test(url.hostname)) throw new Error();
  } catch { status.value = 'Paste a YouTube video or live stream link.'; return; }
  await youtube.play(url.href, sink.value);
}
async function discover(ask = true) {
  busy.value = true;
  try {
    if (!supported) throw new Error('Open this panel in Chrome or Edge at http://localhost:8787/control/ to select an output.');
    let listed = await navigator.mediaDevices.enumerateDevices();
    let permissionError;
    if (ask && !listed.some(d => d.kind === 'audiooutput' && d.label && !['default', 'communications'].includes(d.deviceId))) {
      // Never reopen a microphone when named outputs are already available (especially on Bluetooth).
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (e) { permissionError = e; }
      listed = await navigator.mediaDevices.enumerateDevices();
    }
    outputs.value = listed.filter(d => d.kind === 'audiooutput' && d.deviceId && !['default', 'communications'].includes(d.deviceId));
    if (sink.value && !outputs.value.some(d => d.deviceId === sink.value)) { stop(); sink.value = ''; }
    if (!sink.value) sink.value = outputs.value.find(d => /soundcore/i.test(d.label))?.deviceId || '';
    if (ask || !active.value) status.value = outputs.value.length ? 'Select a speaker, paste a YouTube link, and press Play.'
      : permissionError ? 'Speaker access was blocked. Allow microphone permission for this site using the address bar settings, then refresh speakers.'
        : 'Click Discover / refresh speakers to reveal your speaker names.';
    if (ask) await cmd({ type: 'refreshAudioDevices' });
  } catch (e) { status.value = e.message; }
  finally { busy.value = false; }
}
function changed() { stop(); }
async function test() {
  stop();
  try {
    if (!sink.value) throw new Error('Select a speaker first.');
    const ctx = toneContext = new AudioContext();
    await ctx.setSinkId(sink.value);
    await ctx.resume();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume.value * 0.15, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.75);
    osc.onended = () => { ctx.close().catch(() => {}); if (toneContext === ctx) toneContext = null; };
    status.value = 'Test tone sent to ' + outputs.value.find(d => d.deviceId === sink.value)?.label;
  } catch (e) { closeTone(); status.value = e.message; }
}
function play() {
  stop();
  if (!sink.value || !source.value) { status.value = 'Select both a source and a speaker.'; return; }
  const input = devices.value.find(d => d.id === source.value);
  const output = outputs.value.find(d => d.deviceId === sink.value);
  if (input && output?.label.toLowerCase().includes(input.name.toLowerCase())) {
    status.value = 'Select a different source from the playback speaker to prevent audio feedback.'; return;
  }
  player.setSink(sink.value); player.setSource(source.value); player.setVolume(volume.value);
  active.value = true; player.start();
}
const deviceChanged = () => discover(false);
navigator.mediaDevices?.addEventListener('devicechange', deviceChanged);
onBeforeUnmount(() => { stop(); navigator.mediaDevices?.removeEventListener('devicechange', deviceChanged); });
</script>

<template>
  <section class="card">
    <h2>Separate speaker output</h2>
    <p class="mut">Play YouTube through your Bluetooth speaker with its own volume. Audio starts while the rest loads and keeps playing as you use other screens. Keep this browser tab open.</p>
    <button :disabled="busy" @click="discover(true)">{{ busy ? 'Discovering…' : 'Discover / refresh speakers' }}</button>
    <p class="mut" style="font-size:12px">Chrome may ask for microphone permission to reveal speaker names. The microphone is released immediately.</p>
    <div class="row">
      <label for="speaker-output">Play through</label>
      <select id="speaker-output" v-model="sink" class="grow" @change="changed">
        <option value="">Select speaker…</option>
        <option v-for="d in outputs" :key="d.deviceId" :value="d.deviceId">{{ d.label || 'Unnamed output' }}</option>
      </select>
      <button :disabled="!sink" @click="test">Test tone</button>
    </div>
    <div class="row">
      <label for="speaker-mode">Play from</label>
      <select id="speaker-mode" v-model="mode" class="grow" @change="changed">
        <option value="youtube">YouTube link</option>
        <option value="windows">Windows audio source</option>
      </select>
    </div>
    <form v-if="mode === 'youtube'" @submit.prevent="playYoutube">
      <label for="speaker-youtube">YouTube video or live stream</label>
      <div class="row">
        <input id="speaker-youtube" v-model="youtubeUrl" type="url" required class="grow" placeholder="https://www.youtube.com/watch?v=…" aria-label="YouTube link">
        <button type="submit" :disabled="!sink || !youtubeUrl.trim()">Play on speaker</button>
      </div>
      <p v-if="youtubeTitle" style="font-size:13px">{{ youtubeTitle }}</p>
      <p class="mut" style="font-size:12px">Loops automatically when the video ends, including in the background. Press Stop to end playback.</p>
    </form>
    <audio v-show="mode === 'youtube'" ref="media" controls style="width:100%;margin:12px 0" aria-label="YouTube audio playback"></audio>
    <div v-if="mode === 'windows'" class="row">
      <label for="speaker-source">Audio source</label>
      <select id="speaker-source" v-model="source" class="grow" @change="changed">
        <option value="">Select Windows source…</option>
        <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
    </div>
    <p v-if="mode === 'windows'" class="mut" style="font-size:12px">Play music into the selected source (for example, a Voicemeeter bus). Choose a different source from the speaker output.</p>
    <template v-if="mode === 'windows'">
      <div class="row">
        <label for="speaker-buffer">Audio buffer</label>
        <input id="speaker-buffer" :value="bufferMs" type="number" min="60" max="15000" step="10" style="width:90px" @change="setBuffer($event.target.value)">
        <span class="mut">ms</span>
        <button @click="setBuffer(80)">Live</button>
        <button @click="setBuffer(300)">Smooth</button>
        <button @click="setBuffer(3000)">Buffered</button>
      </div>
      <p class="mut" style="font-size:12px">Changes apply immediately. A smaller buffer reduces delay; increase it if audio breaks up. Bluetooth adds its own delay.</p>
    </template>
    <div class="row">
      <label for="speaker-volume">Volume</label>
      <input id="speaker-volume" v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="setVolume">
      <button v-if="mode === 'windows'" :disabled="!sink || !source || active" @click="play">Play on speaker</button>
      <button :disabled="!active" @click="stop">Stop</button>
      <button v-if="active && mode === 'windows'" @click="player.unlock()">Enable sound</button>
    </div>
    <p role="status" class="mut">{{ status }}</p>
  </section>
</template>
