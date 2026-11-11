import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En Docker sobre Windows los cambios de archivos no llegan como eventos: hay que sondear
    watch: process.env.VITE_USE_POLLING ? { usePolling: true } : undefined,
    proxy: {
      // /api/auth/registro -> http://localhost:8000/auth/registro
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
