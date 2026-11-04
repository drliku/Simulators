import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app works from any folder (or straight from disk).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020' },
});
