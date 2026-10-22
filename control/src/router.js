import { createRouter, createWebHashHistory } from 'vue-router';
import Live from './pages/Live.vue';
import Audio from './pages/Audio.vue';
import Scenes from './pages/Scenes.vue';
import Lights from './pages/Lights.vue';
import Stage from './pages/Stage.vue';
import Media from './pages/Media.vue';
import Displays from './pages/Displays.vue';
import Zones from './pages/Zones.vue';

// Hash routing: the hub serves one static page, so /control.html#/audio just works (and survives refreshes).
export const pages = [
  { path: '/', name: 'Live', component: Live },
  { path: '/audio', name: 'Audio', component: Audio },
  { path: '/scenes', name: 'Scenes', component: Scenes },
  { path: '/lights', name: 'Lights', component: Lights },
  { path: '/zones', name: 'Zones', component: Zones },
  { path: '/stage', name: 'Stage', component: Stage },
  { path: '/displays', name: 'Displays', component: Displays },
  { path: '/media', name: 'Media', component: Media },
];
export default createRouter({ history: createWebHashHistory(), routes: pages });
