import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    fileParallelism: false,
    globalSetup: './src/tests/global-setup.ts',
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
