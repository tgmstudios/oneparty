import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { start } from './store.js';
import router from './router.js';

start();
createApp(App).use(router).mount('#app');
