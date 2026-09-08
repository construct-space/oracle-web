import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwind from '@tailwindcss/vite'
import ui from '@construct-space/ui-web/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.ORACLE_API_URL || 'http://localhost:4300'

  return {
    plugins: [vue(), tailwind(), ...ui()],
    esbuild: {
      drop: ['debugger'],
      pure: ['console.log', 'console.debug', 'console.info'],
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@core': fileURLToPath(new URL('./src', import.meta.url)),
        '@spaces': fileURLToPath(new URL('../spaces', import.meta.url)),
        '@spaces/types': fileURLToPath(new URL('../spaces/types.ts', import.meta.url)),
        '@spaces/accounts': fileURLToPath(new URL('../spaces/accounts/index.ts', import.meta.url)),
        '@spaces/admin': fileURLToPath(new URL('../spaces/admin/index.ts', import.meta.url)),
        '@spaces/billing': fileURLToPath(new URL('../spaces/billing/index.ts', import.meta.url)),
        '@spaces/blog': fileURLToPath(new URL('../spaces/blog/index.ts', import.meta.url)),
        '@spaces/delivery': fileURLToPath(new URL('../spaces/delivery/index.ts', import.meta.url)),
        '@spaces/developer': fileURLToPath(new URL('../spaces/developer/index.ts', import.meta.url)),
        '@spaces/domains': fileURLToPath(new URL('../spaces/domains/index.ts', import.meta.url)),
        '@spaces/marketplace': fileURLToPath(new URL('../spaces/marketplace/index.ts', import.meta.url)),
        '@spaces/provider': fileURLToPath(new URL('../spaces/provider/index.ts', import.meta.url)),
        '@spaces/source': fileURLToPath(new URL('../spaces/source/index.ts', import.meta.url)),
        '@spaces/telemetry': fileURLToPath(new URL('../spaces/telemetry/index.ts', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
