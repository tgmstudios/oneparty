<script setup>
import { computed } from 'vue';
import { g, act, rate } from '../store.js';
import EmptyCard from './EmptyCard.vue';
import Icon from './Icon.vue';

const n = computed(() => g.S.now), mine = computed(() => g.S.rating?.mine || 0), r = computed(() => g.S.rating);
const light = i => act(() => rate(n.value.id, i), 'The candle is lit!');
</script>

<template>
  <EmptyCard v-if="!n" icon="music" title="The speakers are silent" text="When the next banger drops, rate it here." />
  <div v-else class="card deck" :class="{ paused: !n.playing }">
    <div class="status"><i></i>{{ n.playing ? 'Now playing' : 'Paused' }}</div>
    <div class="platter">
      <div class="record"><div class="label"><img v-if="n.art" :src="n.art" alt=""><Icon v-else name="note" /></div></div>
      <div class="arm"></div>
    </div>
    <div class="song"><b>{{ n.title }}</b><span>{{ n.artists.join(', ') }}</span></div>
    <template v-if="g.S.config.ratingOpen">
      <div class="candles" role="group" aria-label="Rate this song">
        <button v-for="i in 5" :key="i" :class="{ on: i <= mine }" :aria-label="'Light ' + i + (i > 1 ? ' candles' : ' candle')" :aria-pressed="i <= mine" @click="light(i)"><Icon name="candle" /></button>
      </div>
      <p class="hint">{{ mine ? (r.count > 1 ? `Crowd average ${r.avg} of 5 from ${r.count} people` : 'Thanks for rating!') : 'Rate the banger: light up to five candles' }}</p>
    </template>
    <p v-else class="hint" style="margin-top:14px">The candles have been snuffed. Rating is closed.</p>
  </div>
</template>
