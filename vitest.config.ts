import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@ai-novel-engine/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      'next/server': path.resolve(__dirname, './tests/mocks/next-server.ts')
    }
  }
})
