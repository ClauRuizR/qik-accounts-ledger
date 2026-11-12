import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { CacheStore } from '../../src/common/cache/cache-store.js';
import type { RedisCacheStore } from '../../src/common/cache/redis-cache-store.js';
import { APP_CONFIG, type AppConfig } from '../../src/config/env.js';

export interface TestApp {
  app: INestApplication<App>;
  /** HTTP server to pass to supertest's `request()`. */
  http: App;
  dataSource: DataSource;
  cache: RedisCacheStore;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /** Override the Redis URL, e.g. to simulate Redis being unavailable. */
  redisUrl?: string;
}

/** Boots the real AppModule (real Postgres + Redis) with production app settings. */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const originalRedisUrl = process.env.REDIS_URL;
  if (options.redisUrl) process.env.REDIS_URL = options.redisUrl;
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: ['error', 'warn'],
    });
    configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();

    const cache = app.get<RedisCacheStore>(CacheStore);
    if (!options.redisUrl)
      await waitFor(() => cache.isHealthy(), 'Redis to be ready');

    return {
      app,
      http: app.getHttpServer(),
      dataSource: app.get(DataSource),
      cache,
      close: () => app.close(),
    };
  } finally {
    process.env.REDIS_URL = originalRedisUrl;
  }
}

async function waitFor(
  check: () => Promise<boolean>,
  what: string,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `Timed out waiting for ${what}. Is \`docker compose up -d\` running?`,
  );
}
