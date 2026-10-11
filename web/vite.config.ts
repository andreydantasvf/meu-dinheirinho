import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  // Bind to 0.0.0.0, not just localhost — required both inside Docker (the container's
  // localhost isn't reachable from the host) and for testing on a physical iPhone over LAN.
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest (não generateSW): o SW customizado em src/sw.ts precisa dos
      // handlers `push`/`notificationclick` dos lembretes.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-32x32.png',
        'icon-180.png',
        'logo.png',
      ],
      // No runtimeCaching rules on purpose: the backend lives on a different origin
      // (VITE_API_URL), so the generated service worker only precaches this app's own
      // static assets — API responses (account balances, transactions) are never cached
      // and always hit the network.
      manifest: {
        name: 'Meu Dinheirinho',
        short_name: 'Dinheirinho',
        description: 'Controle financeiro pessoal',
        theme_color: '#0f766e',
        background_color: '#0f766e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
