import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/cli.ts', 'src/mcp.ts', 'src/index.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
    },
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
