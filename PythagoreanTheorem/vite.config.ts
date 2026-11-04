import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Inline the small Brain font so the CSS is self-contained.
    assetsInlineLimit: 8192,
  },
});
