import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Local dev: forward /api to the Azure Functions host (`npm run dev:api`).
    proxy: {
      '/api': 'http://localhost:7071',
    },
  },
});
