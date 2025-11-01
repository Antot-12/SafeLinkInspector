import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/SafeLinkInspector/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/live': { target: 'http://localhost:4000', changeOrigin: true },
      '/asset': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  preview: {
    port: 5173
  }
})
