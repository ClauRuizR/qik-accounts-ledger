import type { DataSourceOptions } from 'typeorm';
import type { AppConfig } from '../config/env.js';
import { ORM_ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

/**
 * Single source of truth for TypeORM connection options, shared by the Nest
 * app, the TypeORM CLI and the integration tests. Migrations and entities are
 * listed explicitly (no globs) so they resolve identically from `src/` under
 * Vitest and from `dist/` at runtime.
 */
export function buildDataSourceOptions(config: AppConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    username: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    database: config.DATABASE_NAME,
    entities: ORM_ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
    migrationsRun: false,
    logging: config.DATABASE_LOGGING,
    extra: { max: 20 },
  };
}
