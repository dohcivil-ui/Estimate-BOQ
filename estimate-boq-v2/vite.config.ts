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
    proxy: {
      // Anthropic API ไม่รองรับ CORS → proxy ผ่าน dev server (ใช้กับ engine "Claude" Direct)
      '/anthropic-api': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic-api/, ''),
      },
    },
  },
});
