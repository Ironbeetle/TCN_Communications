import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    // Main process config
  },
  preload: {
    // Preload scripts config
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching and lazy loading
          manualChunks: {
            // Vendor chunks - rarely change, cached separately
            'react-vendor': ['react', 'react-dom'],
            'quill': ['react-quill-new', 'quill'],
            'state': ['zustand']
          }
        }
      },
      // Increase chunk size warning limit for Electron (local loading)
      chunkSizeWarningLimit: 1000
    }
  }
})
