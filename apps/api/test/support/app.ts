import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { APP_CONFIG, type AppConfig } from '../../src/config/env.js';

export interface TestApp {
  app: INestApplication<App>;
  /** HTTP server to pass to supertest's `request()`. */
  http: App;
  dataSource: DataSource;
  close: () => Promise<void>;
}

/** Boots the real AppModule (real Postgres) with production app settings. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: ['error', 'warn'],
  });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    dataSource: app.get(DataSource),
    close: () => app.close(),
  };
}
