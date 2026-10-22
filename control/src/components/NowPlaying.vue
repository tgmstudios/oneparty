<script setup>
import { computed, ref } from 'vue';
import { hub, cmd, trackPosMs, fmt } from '../store.js';

const T = computed(() => hub.track);
const sp = computed(() => hub.S.spotify);
const pos = computed(() => (hub.now, T.value ? Math.min(T.value.durationMs, trackPosMs(T.value)) : 0));
const draggingVol = ref(null);
const vol = computed(() => draggingVol.value ?? T.value?.volume ?? 0);
const showReconnect = computed(() => sp.value.authed && (sp.value.canControl === false || /fresh login/.test(hub.playerErr)));

const player = (action, extra = {}) => cmd({ type: 'player', action, ...extra }).then(r => { hub.playerErr = r.error || ''; });
const seek = e => { if (!T.value) return; const r = e.currentTarget.getBoundingClientRect(); player('seek', { ms: (e.clientX - r.left) / r.width * T.value.durationMs }); };
const nextRepeat = () => ({ off: 'context', context: 'track', track: 'off' }[T.value?.repeat || 'off']);
const setVol = e => { player('volume', { percent: e.target.value }); draggingVol.value = null; };
</script>

<template>
  <section class="card hero">
    <img id="art" :src="T?.art" alt="">
    <div>
      <div id="ttl">{{ T?.title || 'Nothing playing' }}</div>
      <div class="mut">{{ T ? T.artists.join(', ') + (T.album ? ' · ' + T.album : '') : '' }}</div>
      <div class="mut" style="font-size:12px">{{ T?.device ? 'Playing on ' + T.device : '' }}</div>
    </div>
    <div>
      <div class="bar" @click="seek"><i :style="{ width: T ? pos / T.durationMs * 100 + '%' : 0 }"></i></div>
      <div class="times"><span>{{ fmt(pos) }}</span><span>{{ fmt(T?.durationMs || 0) }}</span></div>
    </div>
    <div class="tr">
      <button title="Shuffle" :class="{ on: T?.shuffle }" @click="player('shuffle', { on: !T?.shuffle })"><svg viewBox="0 0 24 24"><path d="M17 3h4v4l-1.5-1.5-4 4-1.4-1.4 4-4zM3 6h3c2 0 3.2.8 4.3 2.4l5.4 7.6c.7 1 1.5 1.5 2.8 1.5H17l-1.5-1.5 1.4-1.4L21 17.2l-4.1 4.1-1.4-1.4 1.5-1.5h-1.8c-2 0-3.2-.8-4.3-2.4L5.5 8.4C4.8 7.4 4.2 7 3 7z"/></svg></button>
      <button @click="player('prev')"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm3.5 7L19 5v14z"/></svg></button>
      <button id="pp" @click="player(T?.playing ? 'pause' : 'play')"><svg viewBox="0 0 24 24"><path :d="T?.playing ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 5v14l11-7z'"/></svg></button>
      <button @click="player('next')"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/></svg></button>
      <button title="Repeat" :class="{ on: T?.repeat && T.repeat !== 'off' }" @click="player('repeat', { mode: nextRepeat() })"><svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg></button>
    </div>
    <div class="row">
      <span class="mut">🔈</span>
      <input type="range" min="0" max="100" class="grow" :value="vol" @input="draggingVol = +$event.target.value" @change="setVol">
      <span class="mut" style="width:3.5ch;text-align:right">{{ vol }}%</span>
    </div>
    <div class="row" style="font-size:12px">
      <a v-if="!sp.authed" href="/auth/spotify/login" target="_blank">Connect Spotify</a>
      <a v-if="showReconnect" href="/auth/spotify/login" target="_blank">Reconnect Spotify for playback control</a>
      <span class="err">{{ hub.playerErr }}</span>
    </div>
  </section>
</template>
