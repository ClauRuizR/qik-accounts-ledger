import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { APP_CONFIG, type AppConfig, loadEnvFile } from './config/env.js';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.listen(config.PORT);
  const url = await app.getUrl();
  Logger.log(`GraphQL: ${url}/graphql · REST docs: ${url}/docs`, 'Bootstrap');
}

await bootstrap();
