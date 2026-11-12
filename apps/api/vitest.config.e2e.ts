import { defineConfig } from 'vitest/config';

// Integration / e2e tests against a real PostgreSQL (and Redis) instance.
// Files run sequentially because they share one test database.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: ['./test/support/test-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/test-support/**',
        'src/main.ts',
        'src/database/data-source.ts',
      ],
    },
  },
});
