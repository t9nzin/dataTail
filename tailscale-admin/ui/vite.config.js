import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Forward all /api calls to the main dataTail server
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
