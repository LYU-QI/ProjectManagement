import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }

          if (id.includes('/framer-motion/') || id.includes('/lucide-react/')) {
            return 'ui-vendor';
          }

          if (
            id.includes('/react-markdown/') ||
            id.includes('/remark-gfm/') ||
            id.includes('/rehype-raw/') ||
            id.includes('/mdast-') ||
            id.includes('/micromark/') ||
            id.includes('/unified/') ||
            id.includes('/hast-') ||
            id.includes('/unist-')
          ) {
            return 'markdown-vendor';
          }

          if (id.includes('/html2canvas/')) {
            return 'export-vendor';
          }

          if (id.includes('/zustand/') || id.includes('/cmdk/')) {
            return 'app-vendor';
          }
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
});
