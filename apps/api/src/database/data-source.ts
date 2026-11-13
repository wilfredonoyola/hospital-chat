import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env';
import { buildTypeOrmOptions } from './typeorm.options';

// Punto de entrada de la CLI de TypeORM (migraciones). La app no lo usa.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = validateEnv(process.env);

// Sin statement_timeout: una migración (p. ej. crear un índice sobre una tabla
// grande) puede tardar minutos y no debe cancelarse a la mitad. El límite de 5 s
// es para las peticiones de la app, no para operaciones de mantenimiento.
export default new DataSource(
  buildTypeOrmOptions(env.DATABASE_URL, { poolMax: 2, statementTimeoutMs: 0 }),
);
