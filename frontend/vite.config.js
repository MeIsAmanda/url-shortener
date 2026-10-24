import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const backend = process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': backend,
      '/s/': backend,
      '/oauth2': backend,
      '/login/oauth2': backend,
    },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    clearMocks: true,
  },
});
