import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // There was no test configuration at all, so `npm test` globbed the whole
  // project: it collected Playwright's e2e specs, which fail on sight under
  // vitest, and ran component tests in the default environment where every
  // render throws. The suite could not pass on any machine, and nothing
  // noticed because CI runs only build and lint for the frontend.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright owns e2e/; `npm run test:e2e` is its entry point.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'vendor';
          if (id.includes('node_modules/@radix-ui/')) return 'ui';
          if (id.includes('node_modules/recharts/')) return 'charts';
          return undefined;
        },
      },
    },
  },
});
