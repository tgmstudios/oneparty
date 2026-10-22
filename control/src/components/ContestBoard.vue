<script setup>
import { computed } from 'vue';
import { hub, cmd } from '../store.js';
import Switch from './Switch.vue';

// Leaderboard on the party displays. Reveal counts up from the last place of the top N so the winner lands last.
const C = computed(() => hub.S.contest), b = computed(() => C.value.board);
const n = computed(() => Math.min(b.value.top, C.value.ranking.length));
const board = body => cmd({ type: 'contest', action: 'board', ...body });
const present = () => board({ on: true, reveal: 'none' });
</script>

<template>
  <section class="card">
    <h2>Leaderboard <small class="mut">on the displays</small></h2>
    <div class="row">
      <button class="on" :disabled="!C.connected" @click="present">Present (hidden)</button>
      <Switch :on="b.on" @click="board({ on: !b.on })">On screen</Switch>
    </div>
    <div class="row" style="margin-top:10px">
      <label class="mut" style="font-size:12px">Places shown
        <input type="number" min="1" max="10" :value="b.top" style="width:64px" @change="board({ top: $event.target.value })">
      </label>
      <button :disabled="!b.on || b.reveal >= n" @click="board({ reveal: 'next' })">Reveal next ▶</button>
      <button :disabled="!b.on" @click="board({ reveal: 'all' })">Reveal all</button>
      <button :disabled="!b.on" @click="board({ reveal: 'none' })">Hide all</button>
    </div>
    <div class="mut" style="font-size:12px;margin-top:8px">
      Revealed {{ Math.min(b.reveal, n) }} of {{ n }}. Once revealed, bars keep updating live as votes come in. Shows on every display.
    </div>
    <ol v-if="C.ranking.length" style="margin:10px 0 0;padding-left:20px;font-size:13px">
      <li v-for="r in C.ranking.slice(0, b.top)" :key="r.id"><b>{{ r.costume }}</b> <span class="mut">{{ r.name }} · {{ r.votes }}</span></li>
    </ol>
  </section>
</template>
