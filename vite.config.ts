import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api/judge0': {
          target: env.JUDGE0_API_URL || 'http://103.149.170.5:2358',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/judge0/, ''),
        },
      },
    },
    define: {
      'process.env': JSON.stringify(env),
    },
  };
});
