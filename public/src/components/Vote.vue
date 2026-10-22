<script setup>
import { computed } from 'vue';
import { g, act, castVote } from '../store.js';
import EmptyCard from './EmptyCard.vue';
import Icon from './Icon.vue';

const c = computed(() => g.S.config), picked = computed(() => g.S.me.vote);
const vote = e => act(() => castVote(e.id), picked.value === e.id ? 'Vote removed' : 'Vote cast. Muahaha!');
</script>

<template>
  <EmptyCard v-if="!c.votingOpen" icon="ballot" title="The ballot box is still sealed" text="Check back soon. Meanwhile, enter your own costume!" />
  <EmptyCard v-else-if="!g.entries.length" icon="skull" title="Nothing lurks here yet" text="Be the first to enter a costume." />
  <template v-else>
    <h2>Cast your vote</h2>
    <p class="lead">Choose the most terrifying costume. Tap again to undo, or tap another to switch.</p>
    <div class="cards">
      <button v-for="e in g.entries" :key="e.id" class="tcard" :class="{ picked: picked === e.id }" :disabled="e.mine" :aria-pressed="picked === e.id" @click="vote(e)">
        <div v-if="picked === e.id" class="seal" title="Your vote"><Icon name="check" /></div>
        <div v-if="e.mine" class="ribbon">YOU</div>
        <div class="in">
          <div class="pic">
            <img v-if="e.image" :src="e.image" alt="" loading="lazy">
            <div v-else class="ghost"><Icon name="mask" /></div>
          </div>
          <div class="plate"><b>{{ e.costume }}</b><span>{{ e.name }}</span></div>
        </div>
      </button>
    </div>
  </template>
</template>
