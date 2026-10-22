<script setup>
// Moon, fog, cobwebs, bats and embers behind everything. Hidden by CSS under prefers-reduced-motion.
const r = (a, b) => a + Math.random() * (b - a);
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const bats = reduced ? [] : Array.from({ length: 5 }, () => ({ style: { top: r(6, 38) + 'vh', '--s': r(22, 44) + 'px', '--d': r(16, 30) + 's', '--w': -r(0, 28) + 's' } }));
const embers = reduced ? [] : Array.from({ length: 16 }, () => ({ style: { left: r(0, 100) + '%', '--s': r(2, 5) + 'px', '--d': r(9, 18) + 's', '--w': -r(0, 18) + 's', '--x': r(-40, 40) + 'px' } }));
</script>

<template>
  <div class="sky" aria-hidden="true">
    <div class="moon"></div>
    <div class="fog f1"></div><div class="fog f2"></div>
    <svg class="web web-l" viewBox="0 0 120 120"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><path d="M0 0 L120 0 M0 0 L0 120 M0 0 L104 62 M0 0 L62 104 M0 0 L120 24 M0 0 L24 120"/><path d="M26 0 Q22 22 0 26 M52 0 Q42 42 0 52 M78 0 Q62 62 0 78 M104 0 Q82 82 0 104"/></g></svg>
    <svg class="web web-r" viewBox="0 0 120 120"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><path d="M0 0 L120 0 M0 0 L0 120 M0 0 L104 62 M0 0 L62 104 M0 0 L120 24 M0 0 L24 120"/><path d="M26 0 Q22 22 0 26 M52 0 Q42 42 0 52 M78 0 Q62 62 0 78 M104 0 Q82 82 0 104"/></g></svg>
    <div id="bats">
      <div v-for="(b, i) in bats" :key="i" class="bat" :style="b.style">
        <svg viewBox="0 0 64 28"><path fill="currentColor" d="M32 6c2 0 3 2 4 4 3-3 7-5 12-5 5 0 10 2 16 7-4 0-7 1-9 4-2-2-5-3-8-2 1 2 0 4-1 6-2-2-4-3-6-3-1 4-3 7-6 9-3-2-5-5-6-9-2 0-4 1-6 3-1-2-2-4-1-6-3-1-6 0-8 2-2-3-5-4-9-4 6-5 11-7 16-7 5 0 9 2 12 5 1-2 2-4 4-4z"/></svg>
      </div>
    </div>
    <div id="embers"><i v-for="(e, i) in embers" :key="i" class="ember" :style="e.style"></i></div>
    <div class="ground"></div>
  </div>
</template>
