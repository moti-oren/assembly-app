import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// The deploy builds from a commit, which says exactly what a piece of feedback was written on.
const commit = process.env.GITHUB_SHA?.slice(0, 7);

export default defineConfig({
  // GitHub Pages serves the site from /assembly-app/
  base: '/assembly-app/',
  plugins: [vue(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(commit ? `${version}+${commit}` : version)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']
  }
});
