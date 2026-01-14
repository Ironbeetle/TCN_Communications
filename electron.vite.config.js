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
    plugins: [react()]
  }
})
