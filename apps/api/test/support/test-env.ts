import { loadEnvFile } from '../../src/config/env.js';

/**
 * Points every test process at the dedicated test database, never the
 * development one. Runs before any test file imports application code.
 */
export function applyTestEnv(): void {
  loadEnvFile();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_NAME =
    process.env.DATABASE_TEST_NAME ??
    `${process.env.DATABASE_NAME ?? 'qik_ledger'}_test`;
  process.env.DATABASE_LOGGING = 'false';
  process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-characters';
}

applyTestEnv();
