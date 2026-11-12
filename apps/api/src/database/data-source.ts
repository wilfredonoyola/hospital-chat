import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env';
import { buildTypeOrmOptions } from './typeorm.options';

// Punto de entrada de la CLI de TypeORM (migraciones). La app no lo usa.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = validateEnv(process.env);

export default new DataSource(buildTypeOrmOptions(env.DATABASE_URL));
