import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { loadConfig } from '../../src/config/env.js';
import { buildDataSourceOptions } from '../../src/database/database.options.js';
import { applyTestEnv } from './test-env.js';

/**
 * Runs once before the integration suite:
 *  1. creates the test database if it does not exist;
 *  2. drops and recreates the `public` schema (clean slate);
 *  3. applies all migrations — the same ones production uses.
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  const config = loadConfig();

  const admin = new Client({
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    database: 'postgres',
  });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach PostgreSQL at ${config.DATABASE_HOST}:${config.DATABASE_PORT}. ` +
        'Start it with `docker compose up -d` from the repository root.',
      { cause: error },
    );
  }
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [config.DATABASE_NAME],
  );
  if (exists.rowCount === 0) {
    // Identifier comes from local config, not user input; quoted defensively.
    await admin.query(
      `CREATE DATABASE "${config.DATABASE_NAME.replace(/"/g, '""')}"`,
    );
  }
  await admin.end();

  const dataSource = new DataSource(buildDataSourceOptions(config));
  await dataSource.initialize();
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.runMigrations({ transaction: 'each' });
  await dataSource.destroy();
}
