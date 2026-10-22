import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
      allowedHosts: ['.trycloudflare.com', '.loca.lt', '.localtunnel.me', '.lhr.life', '.tunnelmole.net'],
      hmr: false,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
