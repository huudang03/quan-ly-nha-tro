import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // Quan trọng để chạy đúng qua ngrok
    base: './',

    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(
        process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''
      ),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      open: true,

      allowedHosts: [
        'jonie-undepicted-eighthly.ngrok-free.dev',
      ],

      hmr: {
        clientPort: 443,
      },
    },
  };
});