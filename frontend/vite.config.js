import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on 0.0.0.0 (required for Docker)
    port: 5173,
    watch: {
      usePolling: true, // Polling for Docker volumes (no inotify)
      interval: 1000,
    },
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
});
