import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Hợp nhất cả biến môi trường hệ thống trên Vercel (process.env) và file cấu hình
  const merged: Record<string, string | undefined> = { ...process.env, ...env };

  const supabaseUrl = merged.VITE_SUPABASE_URL || merged.SUPABASE_URL || 'https://wsccqtgnwejupfucfqtg.supabase.co';
  const supabaseKey = merged.VITE_SUPABASE_ANON_KEY || merged.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzY2NxdGdud2VqdXBmdWNmcXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjAxMTYsImV4cCI6MjEwODIzNjExNn0.ILXlVuUZGPfVo9n2_IhpVQHIPJ8QkZHajAWAKMP1280';
  const judge0Url = merged.VITE_JUDGE0_API_URL || merged.JUDGE0_API_URL || 'http://103.149.170.5:2358';
  const judge0Token = merged.VITE_JUDGE0_API_TOKEN || merged.JUDGE0_API_TOKEN || 'faminh_secret_api_token';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api/judge0': {
          target: judge0Url,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/judge0/, ''),
        },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'import.meta.env.VITE_JUDGE0_API_URL': JSON.stringify(judge0Url),
      'import.meta.env.VITE_JUDGE0_API_TOKEN': JSON.stringify(judge0Token),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'process.env.VITE_JUDGE0_API_URL': JSON.stringify(judge0Url),
      'process.env.VITE_JUDGE0_API_TOKEN': JSON.stringify(judge0Token),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      'process.env.JUDGE0_API_URL': JSON.stringify(judge0Url),
      'process.env.JUDGE0_API_TOKEN': JSON.stringify(judge0Token),
    },
  };
});
