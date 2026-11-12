import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable website (PWA). The service worker caches the app itself so it opens without a connection;
    // business data is kept offline separately in IndexedDB (src/offline). It is only registered on the
    // website — the Android/iOS and desktop apps already ship the files (see src/components/PwaPrompt.tsx).
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Open CRM',
        short_name: 'Open CRM',
        description: 'Customers, field visits, tickets, leads and deals — English & తెలుగు',
        lang: 'en',
        theme_color: '#1d4ed8',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Map tiles already seen stay available offline (limited, so the cache cannot grow forever).
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true, // listen on your LAN IP too, so phones/tablets on the same Wi-Fi can open it
    port: 5173,
    proxy: {
      // In development the browser calls /api on the Vite server, which forwards to Spring Boot.
      // Same origin = no CORS issues, and it works from other devices on your network.
      '/api': 'http://localhost:8080',
    },
  },
  preview: { host: true, port: 4173, proxy: { '/api': 'http://localhost:8080' } },
})
