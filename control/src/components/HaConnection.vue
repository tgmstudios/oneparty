<script setup>
import { computed, ref, watch } from 'vue';
import { hub, cmd } from '../store.js';

// Where the hub reaches Home Assistant: HA_URL (maybe a proxied/public hostname), or HA's LAN address with HA_URL's host sent as the Host header.
const conn = computed(() => hub.S.ha.conn || {});
const ip = ref(conn.value.localIp || '');
watch(() => conn.value.localIp, v => { ip.value = v || ''; });
const busy = ref(false), res = ref(null);
const run = async body => { busy.value = true; res.value = null; try { res.value = await cmd({ type: 'haConnection', ...body }); } catch (e) { res.value = { error: e.message }; } busy.value = false; };
const save = () => run({ localIp: ip.value.trim() });
const test = () => run({});
const hostName = computed(() => conn.value.host || conn.value.hostEnv || (() => { try { return new URL(conn.value.url).host; } catch { return ''; } })());
</script>

<template>
  <section class="card">
    <h2>Home Assistant connection <small><span class="dot" :class="hub.S.ha.enabled ? 'ok' : 'bad'"></span></small></h2>
    <div v-if="!hub.S.ha.enabled" class="mut" style="font-size:12px">Set <code>HA_URL</code> and <code>HA_TOKEN</code> in <code>.env</code> and restart. The local address below is used on top of those.</div>
    <div class="mut" style="font-size:12px;margin-bottom:8px">
      Hub talks to <b>{{ conn.via === 'local' ? conn.local : conn.url || 'nothing yet' }}</b>
      <template v-if="conn.via === 'local'"> with Host <code>{{ hostName }}</code> (from <code>{{ conn.hostEnv ? 'HA_HOST' : 'HA_URL' }}</code>)</template>.
    </div>
    <label class="ob-f">Local / proxy IP (optional)
      <input v-model="ip" placeholder="192.168.1.50 or 192.168.1.50:8123" inputmode="url" autocapitalize="off" autocomplete="off" @keyup.enter="save">
    </label>
    <div class="mut" style="font-size:12px;margin:6px 0">When set, the hub skips the proxied <code>HA_URL</code> and connects straight to this address on your network, still identifying as <code>{{ hostName || 'the HA_URL host' }}</code>. Default port 8123, plain http. Leave empty to use <code>HA_URL</code>.</div>
    <div class="row">
      <button class="on" :disabled="busy" @click="save">{{ ip.trim() ? 'Save &amp; test' : 'Use HA_URL' }}</button>
      <button :disabled="busy" @click="test">Test connection</button>
    </div>
    <p v-if="res" role="status" :class="res.error || res.test?.ok === false ? 'err' : 'mut'" style="margin:8px 0 0">
      {{ res.error || (res.test?.ok ?? res.ok ? `Connected via ${res.test?.via || res.via} in ${res.test?.ms ?? res.ms} ms.` : res.test?.error || res.error) }}
    </p>
  </section>
</template>
