import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfig } from './config/env.js';

/**
 * App-wide setup shared by `main.ts` and the e2e tests, so tests exercise the
 * same pipes and settings as the running server.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = config.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : config.NODE_ENV !== 'production',
  });

  if (config.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Qik Accounts & Ledger — REST')
        .setDescription(
          'Operational REST endpoints. The business API is GraphQL at /graphql.',
        )
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();
}
