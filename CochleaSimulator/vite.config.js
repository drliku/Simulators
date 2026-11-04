import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1000, // three.js alone is ~700 kB
    assetsInlineLimit: 32 * 1024, // embeds the Brain font in the CSS (needed for the shared single-page build)
  },
});
