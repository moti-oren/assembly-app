import { App as IApp, createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

const vm: IApp = createApp(App);

vm
  .use(store)
  .use(router);

vm.mount('#app');
