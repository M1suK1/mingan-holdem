import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nightSugarCardsPlugin } from './scripts/night-sugar-cards.mjs';
import { p2pSignalingPlugin } from './scripts/p2p-signaling.mjs';

export default defineConfig({
  base: './',
  plugins: [react(), nightSugarCardsPlugin(), p2pSignalingPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5178,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});
