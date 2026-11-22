import { createApp } from 'vue';
import App from './App.vue';
import { dismissSplash } from './ui/splash';
import { useAppError } from './ui/useAppError';
import './ui/styles.css';

const app = createApp(App);
const { reportAppError } = useAppError();
// Without these a bug would leave the page half-updated with nothing on screen to say so.
app.config.errorHandler = reportAppError;
// Running a program steps on timers, outside Vue's own handlers.
window.addEventListener('error', (event) => reportAppError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => reportAppError(event.reason));
app.mount('#app');
dismissSplash();
