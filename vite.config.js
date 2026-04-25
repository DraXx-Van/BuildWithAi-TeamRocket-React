import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting to reduce bundle size and prevent OOM
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('@google/generative-ai')) return 'ai';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    // Prevent HMR memory leaks
    hmr: {
      overlay: true,
    },
  },
})
