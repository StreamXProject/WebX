/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      quoteStyle: 'single',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-tanstack'
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-virtuoso')) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/@material/material-color-utilities')) {
            return 'vendor-color'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/tracks': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/browse': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/playlists': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/favourites': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/jam': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
      '/friends': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/presence': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/access': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/cover': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/topics': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/albums': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/artists': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/search': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/recaps': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/share': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes('text/html') ? req.url : undefined),
      },
      '/sources': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/logs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/discord': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/soundcloud': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/yt_dlp': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/webapp': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/channelids': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/daily-playlist': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    // material-color-utilities ships extension-less ESM imports; let Vite resolve them
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
})
