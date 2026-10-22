<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { hub, cmd } from './store.js';
import { pages } from './router.js';
import StatusChips from './components/StatusChips.vue';
import SpeakerOutput from './components/SpeakerOutput.vue';
import NetworkAddresses from './components/NetworkAddresses.vue';
import Onboarding from './components/Onboarding.vue';

const S = computed(() => hub.S);
const onboarding = ref(false), ipOpen = ref(false);
const bestIp = computed(() => (S.value?.network?.urls || []).find(u => !u.virtual && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.ip)));
const route = useRoute(), speakerActive = ref(false), speakerPanel = ref(null);
const bg = computed(() => hub.track?.art ? `url(${hub.track.art})` : '');
const closeParty = () => { if (confirm('Close the party? This closes the kiosk prompts, returns all lights to normal, and closes every display window.')) cmd({ type: 'closeParty' }); };
const launch = () => fetch('/api/launch', { method: 'POST' });
</script>

<template>
  <div id="bg" :style="{ backgroundImage: bg }"></div>
  <template v-if="S">
    <header>
      <div class="brand"><b>{{ S.event.title }}</b><span>{{ S.event.subtitle }}</span></div>
      <StatusChips />
      <span class="sp"></span>
      <div class="hact">
      <span class="ip-chip">
        <button title="Addresses other devices connect to" @click="ipOpen = !ipOpen">{{ bestIp ? bestIp.ip + ':' + S.network.port : 'Network' }}</button>
        <div v-if="ipOpen" class="ip-pop card">
          <button class="ip-x" aria-label="Close" @click="ipOpen = false">✕</button>
          <b>Connect other devices</b>
          <div class="mut" style="font-size:12px;margin:4px 0 8px">Open on any device on this network. Click to copy.</div>
          <NetworkAddresses page="/join.html" />
        </div>
      </span>
      <button class="on" title="Guided setup: network, monitors, devices, zones, kiosks" @click="onboarding = true">Onboarding</button>
      <button title="Open any display windows that aren't open (existing ones are reused)" @click="launch">Open displays</button>
      <button id="wht" :class="{ on: S.whiteout }" @click="cmd({ type: 'whiteout', on: !S.whiteout })">{{ S.whiteout ? 'Whiteout ON' : 'Whiteout' }}</button>
      <button id="blk" :class="{ on: S.blackout }" @click="cmd({ type: 'blackout', on: !S.blackout })">{{ S.blackout ? 'Blackout ON' : 'Blackout' }}</button>
      <button id="close-party" title="Close kiosk prompts, restore normal lights, close all displays" @click="closeParty">Close</button>
      </div>
    </header>
    <nav class="tabs">
      <router-link v-for="p in pages" :key="p.path" :to="p.path">{{ p.name }}</router-link>
    </nav>
    <div v-if="speakerActive && route.path !== '/audio'" class="row" style="padding:10px 20px">
      <router-link to="/audio">Speaker audio controls</router-link>
      <button @click="speakerPanel?.stop()">Stop speaker</button>
    </div>
    <div v-show="route.path === '/audio'" style="max-width:960px;margin:16px auto;padding:0 16px">
      <SpeakerOutput ref="speakerPanel" @activity="speakerActive = $event" />
    </div>
    <router-view />
    <Onboarding v-if="onboarding" @close="onboarding = false" />
  </template>
  <p v-else class="mut" style="padding:40px">Connecting to the hub…</p>
</template>
