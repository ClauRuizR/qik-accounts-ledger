import { defineConfig } from 'vitest/config';

// Unit tests: fast, no I/O. Live next to the code as *.spec.ts.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/database/migrations/**'],
    },
  },
});
