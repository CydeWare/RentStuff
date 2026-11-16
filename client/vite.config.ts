import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const API_URL = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // The API runs on its own port; proxying keeps cookies first-party in development.
    proxy: {
      '/api': { target: API_URL, changeOrigin: true },
      '/uploads': { target: API_URL, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: API_URL, changeOrigin: true },
      '/uploads': { target: API_URL, changeOrigin: true },
    },
  },
});
