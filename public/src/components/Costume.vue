<script setup>
import { computed, watch } from 'vue';
import { g, act, saveEntry, uploadPhoto, removePhoto } from '../store.js';
import EmptyCard from './EmptyCard.vue';
import Icon from './Icon.vue';

const c = computed(() => g.S.config), mine = computed(() => g.S.me.entry);
// pre-fill from the saved entry until the guest starts editing
watch(mine, m => { if (m && !g.draft.touched) Object.assign(g.draft, { name: m.name, costume: m.costume }); }, { immediate: true });
const save = () => act(saveEntry, mine.value ? 'Disguise updated' : 'You have entered the crypt!');
const pick = ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) act(() => uploadPhoto(f), 'Photo captured!'); };
</script>

<template>
  <EmptyCard v-if="!c.entriesOpen && !mine" icon="skull" title="The crypt is sealed" text="Entries are closed. Creep over to the Vote tab when voting opens!" />
  <template v-else>
    <div v-if="mine" class="card" style="text-align:center">
      <div class="badge">You haunt the contest</div>
      <h3>{{ mine.costume }}</h3>
      <p class="mut" style="margin:6px 0 0">{{ c.entriesOpen ? 'Frightfully good. You can still change your entry below.' : 'Entries are closed. May the best monster win!' }}</p>
      <div class="selfie">
        <div class="selfie-pic">
          <img v-if="mine.image" :src="mine.image" alt="Your costume photo">
          <div v-else class="ghost"><Icon name="mask" /></div>
        </div>
        <template v-if="c.entriesOpen">
          <label class="btn photo-btn">{{ mine.image ? 'Retake photo' : 'Add a photo of your costume' }}
            <input type="file" accept="image/*" hidden :disabled="g.busy" @change="pick">
          </label>
          <button v-if="mine.image" type="button" class="link" :disabled="g.busy" @click="act(removePhoto, 'Photo removed')">Remove photo</button>
          <p v-else class="lead">Your photo is shown when everyone votes and on the big screen.</p>
        </template>
      </div>
    </div>
    <form class="card" @submit.prevent="c.entriesOpen && save()">
      <h3>{{ mine ? 'Reshape your disguise' : 'Enter the crypt' }}</h3>
      <p v-if="!mine" class="lead" style="margin-top:6px">Tell us who lurks beneath the costume, and what you came as.</p>
      <label for="f-name">Your name</label>
      <input id="f-name" v-model="g.draft.name" maxlength="40" autocomplete="name" placeholder="Your name" @input="g.draft.touched = true">
      <label for="f-costume">Your costume</label>
      <input id="f-costume" v-model="g.draft.costume" maxlength="80" placeholder="e.g. Haunted toaster" @input="g.draft.touched = true">
      <button v-if="c.entriesOpen" class="btn full" type="submit">{{ mine ? 'Update my entry' : 'Enter the crypt' }}</button>
    </form>
  </template>
</template>
