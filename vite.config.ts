import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  envDir: __dirname,
  publicDir: 'public',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    proxy: {
      // Dev: connect from the Vite origin, e.g. `ws://${location.host}/blotter-stream`
      '/blotter-stream': {
        // Match server default `PORT` (8000); override PORT on the server if you change this.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
      '/orders': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
