<script setup>
import { computed } from 'vue';
import { g } from '../store.js';
import EmptyCard from './EmptyCard.vue';
import Icon from './Icon.vue';

const list = computed(() => g.results || []);
const top = computed(() => list.value.slice(0, 3)), rest = computed(() => list.value.slice(3));
const max = computed(() => Math.max(1, ...list.value.map(r => r.votes)));
const place = i => 'r' + (i + 1);   // pillar height follows the position on the podium, the medal shows the (possibly tied) rank
</script>

<template>
  <p v-if="!g.results" class="mut" style="text-align:center">Raising the results from the grave…</p>
  <EmptyCard v-else-if="!list.length" icon="skull" title="A graveyard of entries" text="Nobody entered the contest." />
  <template v-else>
    <h2 style="text-align:center">The monsters of the night</h2>
    <div class="card">
      <div class="podium" :style="{ gridTemplateColumns: `repeat(${top.length},minmax(0,1fr))` }">
        <div v-for="(r, i) in top" :key="r.id" class="pod" :class="place(i)">
          <div v-if="i === 0" class="crown"><Icon name="crown" /></div>
          <div class="face">
            <img v-if="r.image" :src="r.image" alt="">
            <div v-else class="ghost"><Icon name="mask" /></div>
            <div class="medal">{{ r.rank }}</div>
          </div>
          <b>{{ r.costume }}</b><small>{{ r.name }}</small>
          <div class="pillar"><div><i>{{ r.votes }}</i><span>{{ r.votes === 1 ? 'vote' : 'votes' }}</span></div></div>
        </div>
      </div>
    </div>
    <div v-if="rest.length" class="card">
      <div class="rest">
        <div v-for="r in rest" :key="r.id" class="rrow">
          <div class="n">{{ r.rank }}</div>
          <img v-if="r.image" :src="r.image" alt="">
          <div v-else class="ghost"><Icon name="mask" /></div>
          <div class="t">
            <b>{{ r.costume }}</b>
            <div class="mut">{{ r.name }} · {{ r.votes }} vote{{ r.votes === 1 ? '' : 's' }}</div>
            <div class="bar"><i :style="{ width: Math.round(r.votes / max * 100) + '%' }"></i></div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
