import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting to reduce bundle size and prevent OOM
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database', 'firebase/storage'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand'],
          'ai': ['@google/generative-ai'],
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
