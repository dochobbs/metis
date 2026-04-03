import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9100,
    proxy: {
      // Oread - Patient Generation (port 9104)
      '/api/oread': {
        target: 'http://localhost:9104',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/oread/, '/api'),
      },
      // Syrinx - Encounter Scripts (port 9103)
      '/api/syrinx': {
        target: 'http://localhost:9103',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/syrinx/, '/api'),
      },
      // Mneme - EMR Interface (port 9102)
      '/api/mneme': {
        target: 'http://localhost:9102',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mneme/, '/api'),
      },
      // Echo - AI Tutor (port 9101) — Echo routes have no /api prefix
      '/api/echo': {
        target: 'http://localhost:9101',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/echo/, ''),
      },
      // Athena - Curriculum & Knowledge (port 9105)
      '/api/athena': {
        target: 'http://localhost:9105',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/athena/, '/api'),
      },
    },
  },
})
