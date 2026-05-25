import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // pdfjs worker is loaded dynamically; avoid eager prebundling
    exclude: ['pdfjs-dist/build/pdf.worker.min.mjs'],
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
});
