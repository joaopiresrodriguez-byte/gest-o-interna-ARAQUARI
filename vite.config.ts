import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        // 'autoUpdate' garante que o SW se atualiza sem precisar fechar o app
        registerType: 'autoUpdate',
        // Injetar o manifesto no index.html automaticamente
        injectRegister: 'auto',
        // O SW gerado pelo Workbox fica em /sw.js
        filename: 'sw.js',

        manifest: {
          id: '/',
          name: 'Gestão Interna CBMSC Araquari',
          short_name: 'CBMSC ARA',
          description: 'Sistema de gestão operacional do 2º Pelotão de Bombeiros Militar de Araquari — missões, conferências, patrimônio e pessoal.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait-primary',
          background_color: '#111827',
          theme_color: '#cc0000',
          lang: 'pt-BR',
          dir: 'ltr',
          categories: ['productivity', 'utilities', 'government'],
          prefer_related_applications: false,
          icons: [
            {
              src: '/icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
            },
            {
              src: '/icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
            },
            {
              src: '/icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
            },
            {
              src: '/icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
            },
            {
              src: '/icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
          shortcuts: [
            {
              name: 'Avisos',
              short_name: 'Avisos',
              description: 'Painel de avisos e passagem de plantão',
              url: '/avisos',
              icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
            },
            {
              name: 'Operacional',
              short_name: 'Operacional',
              description: 'Missões e conferências diárias',
              url: '/operacional',
              icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
            },
            {
              name: 'B4 – Logística',
              short_name: 'B4',
              description: 'Gestão de patrimônio e viaturas',
              url: '/b4',
              icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
            },
          ],
        },

        workbox: {
          // Precache todos os assets gerados pelo build (JS, CSS, HTML, ícones)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/node_modules/**', '**/pdf.worker.min*'],

          // Estratégias de cache por tipo de rota
          runtimeCaching: [
            {
              // Fontes do Google: Cache first com validade de 1 ano
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Material Symbols: Cache first, 1 ano
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/css.*Material/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'material-icons-cache',
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Supabase API: Network Only — nunca cachear dados do backend
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Imagens do app: Stale While Revalidate, max 60 entradas
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Demais assets estáticos: Stale While Revalidate
              urlPattern: /\.(?:js|css|woff|woff2)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
                },
              },
            },
          ],

          // Ao receber novo SW: skipWaiting e clientsClaim automáticos
          skipWaiting: true,
          clientsClaim: true,

          // Ignorar rotas de extrato público (abertas sem autenticação no QR Code)
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },

        devOptions: {
          // Habilitar PWA em modo dev para testar
          enabled: false,
          type: 'module',
        },
      }),
    ],
    define: {
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'node',
      envFile: '.env.test',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});
