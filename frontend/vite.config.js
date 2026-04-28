import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = 'http://localhost:8000'

// Normaliza la ruta antes de enviarla al backend:
// inserta "/" antes de "?" o al final si el path no termina en "/" y no tiene extensión.
// Esto evita el redirect 307 de FastAPI que hace perder el header Authorization.
function normalizeSlash(proxyReq) {
  const orig = proxyReq.path
  const qIdx = orig.indexOf('?')
  const pathOnly = qIdx === -1 ? orig : orig.slice(0, qIdx)
  const qs = qIdx === -1 ? '' : orig.slice(qIdx)

  if (!pathOnly.endsWith('/') && !/\.[a-zA-Z0-9]{1,5}$/.test(pathOnly)) {
    proxyReq.path = pathOnly + '/' + qs
  }
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', normalizeSlash)
        },
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
