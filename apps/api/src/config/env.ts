import { existsSync } from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_HOST: z.string().min(1).default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),
  DATABASE_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SUMMARY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),

  CORS_ORIGINS: z.string().default(''),
});

export type AppConfig = z.infer<typeof envSchema>;

/** DI token for the validated configuration object. */
export const APP_CONFIG = Symbol('APP_CONFIG');

let envFileLoaded = false;

/** Loads `.env` from the current working directory once, if it exists. */
export function loadEnvFile(): void {
  if (envFileLoaded) return;
  envFileLoaded = true;
  if (existsSync('.env')) process.loadEnvFile('.env');
}

/**
 * Validates process.env and returns a typed config. Fails fast with a readable
 * message (variable names only — never values) when something is missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
