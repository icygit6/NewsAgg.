import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Routers are mounted directly in tests; patch them the same way index.ts does.
    setupFiles: ['src/lib/asyncRoutes.ts'],
  },
})
