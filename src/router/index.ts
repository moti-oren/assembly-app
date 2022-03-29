import { createRouter, createWebHistory } from 'vue-router';

import MainLayout from '@/layouts/Main.vue';

import Home from '../views/Home.vue';
import Processor from '../views/Processor.vue';

const routes = [
  {
    path: '/',
    name: 'Main',
    component: MainLayout,
    children: [
      {
        path: '/',
        name: 'Home',
        component: Home
      },
      {
        path: '/processor',
        name: 'Processor',
        component: Processor
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
