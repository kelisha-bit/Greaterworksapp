import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'pwa-icon.png'],
        manifest: {
          name: 'Greater Works CMS',
          short_name: 'Greater Works',
          description: 'Greater Works CMS',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Don't precache API calls
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
              handler: 'NetworkOnly',
            },
          ],
          // Allow all navigation to fall back to index.html for SPA routing
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^\/(?!api\/)/],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
