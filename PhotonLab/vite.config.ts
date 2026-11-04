/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The shareable build is served from a sub-path, so assets must use relative URLs.
  base: mode === 'sandboxed' ? './' : '/',
  build: mode === 'sandboxed' ? { outDir: 'dist-share', assetsInlineLimit: 65536 } : undefined,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
