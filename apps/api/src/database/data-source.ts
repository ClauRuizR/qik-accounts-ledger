import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadConfig, loadEnvFile } from '../config/env.js';
import { buildDataSourceOptions } from './database.options.js';

/** Entry point for the TypeORM CLI only (`npm run migration:*`). */
loadEnvFile();
export default new DataSource(buildDataSourceOptions(loadConfig()));
