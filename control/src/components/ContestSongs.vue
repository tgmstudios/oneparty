<script setup>
import { computed, ref } from 'vue';
import { hub } from '../store.js';

// Song scores from guest ratings (1-5 stars).
const C = computed(() => hub.S.contest);
const sort = ref('avg');
const songs = computed(() => [...C.value.songs].sort((a, b) => sort.value === 'count' ? b.count - a.count || b.avg - a.avg : sort.value === 'plays' ? b.plays - a.plays : sort.value === 'low' ? (a.count ? a.avg : 9) - (b.count ? b.avg : 9) : b.avg - a.avg || b.count - a.count));
const nowId = computed(() => C.value.now?.id);
const stars = v => '★'.repeat(Math.round(v)) + '☆'.repeat(5 - Math.round(v));
const rated = computed(() => songs.value.filter(s => s.count));
</script>

<template>
  <section class="card">
    <h2>Song scores <small class="mut">{{ C.totals?.ratings ?? 0 }} ratings · {{ C.songs.length }} songs</small></h2>
    <div class="row" style="margin-bottom:8px">
      <button v-for="[k, l] in [['avg', 'Best'], ['low', 'Worst'], ['count', 'Most rated'], ['plays', 'Most played']]" :key="k" :class="{ on: sort === k }" @click="sort = k">{{ l }}</button>
    </div>
    <div v-if="!C.connected" class="mut">Connect the guest app first.</div>
    <div v-else-if="!C.songs.length" class="mut" style="font-size:12px">No songs yet. They show up as the music plays.</div>
    <div v-for="s in songs" :key="s.id" class="ct-song" :class="{ now: s.id === nowId }">
      <img v-if="s.art" :src="s.art" alt="" loading="lazy">
      <div class="grow" style="min-width:0">
        <b class="ellip">{{ s.title }}</b>
        <div class="mut ellip" style="font-size:12px">{{ s.artists.join(', ') }}<template v-if="s.id === nowId"> · <span style="color:var(--acc)">now playing</span></template></div>
      </div>
      <div class="ct-score" :title="s.dist.map((n, i) => (i + 1) + '★: ' + n).join('  ')">
        <template v-if="s.count"><b>{{ s.avg.toFixed(1) }}</b><span class="stars">{{ stars(s.avg) }}</span><span class="mut">{{ s.count }} rating{{ s.count === 1 ? '' : 's' }}</span></template>
        <span v-else class="mut">unrated</span>
      </div>
    </div>
    <div v-if="rated.length > 1 && sort === 'avg'" class="mut" style="font-size:11px;margin-top:8px">Tip: sort by “Most rated” to ignore songs only one person voted on.</div>
  </section>
</template>

<style scoped>
.ct-song{display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}
.ct-song img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none}
.ct-song.now{background:linear-gradient(90deg,rgba(255,255,255,.06),transparent)}
.ct-score{display:flex;flex-direction:column;align-items:flex-end;font-size:11px;white-space:nowrap}.ct-score b{font-size:18px}
.stars{color:#ffc933;letter-spacing:1px}
.ellip{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
