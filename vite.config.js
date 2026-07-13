import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// IMPORTANT:
// React ecosystem (react, react-dom, react-router, react-query)
// must stay in the same vendor chunk.
//
// Splitting them into different manualChunks causes multiple runtime
// initialization paths and can produce:
//
// Cannot read properties of undefined (reading 'exports')
//
// Do not move these packages into separate chunks unless the whole
// chunking strategy is redesigned.

/** React core must live in a single chunk — never split react / react-dom / query. */
function isReactCorePackage(id) {
  return (
    /[\\/]node_modules[\\/](react|react-dom|react-router-dom|react-router|scheduler)[\\/]/.test(
      id,
    ) ||
    id.includes('@tanstack/react-query') ||
    id.includes('@tanstack/query-core')
  )
}

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Must run before @radix-ui / lucide — they depend on react
          if (isReactCorePackage(id)) {
            return 'vendor-react'
          }
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'vendor-ui'
          }
          if (
            id.includes('recharts') ||
            id.includes('moment') ||
            id.includes('date-fns')
          ) {
            return 'vendor-charts'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
