import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const gitCommit = process.env.VITE_GIT_COMMIT || (() => {
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      id: '/', name: 'Gym App', short_name: 'Gym App', start_url: '/', scope: '/',
      display: 'standalone', theme_color: '#09090b', background_color: '#09090b',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/gym.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,ico,svg,webmanifest}'],
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      skipWaiting: false,
      clientsClaim: true,
    },
  })],
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit),
    'import.meta.env.VITE_RELEASE_TAG': JSON.stringify(process.env.VITE_RELEASE_TAG || ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || loadEnv(mode, process.cwd(), 'VITE_').VITE_API_TARGET || 'http://localhost:80',
        changeOrigin: true,
      },
    },
  },
}))
