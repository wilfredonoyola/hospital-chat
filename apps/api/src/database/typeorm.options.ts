import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

export interface DatabaseLimits {
  /** Tope de conexiones del pool por instancia de la API. */
  poolMax: number;
  /** Una consulta que tarde más se cancela en el servidor (no retiene la conexión). */
  statementTimeoutMs: number;
}

const DEFAULT_LIMITS: DatabaseLimits = { poolMax: 10, statementTimeoutMs: 5000 };

/**
 * Opciones compartidas por la app (TypeOrmModule) y por la CLI de migraciones
 * (data-source.ts), para que ambas vean exactamente las mismas entidades.
 *
 * `synchronize` está apagado siempre: el esquema solo cambia con migraciones
 * revisadas en un Pull Request.
 */
export function buildTypeOrmOptions(
  databaseUrl: string,
  limits: DatabaseLimits = DEFAULT_LIMITS,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
    // Cada migración en su propia transacción: permite migraciones sin
    // transacción (CREATE INDEX CONCURRENTLY) y que una falla no revierta las anteriores.
    migrationsTransactionMode: 'each',
    extra: {
      max: limits.poolMax,
      statement_timeout: limits.statementTimeoutMs,
      // Esperar una conexión libre tampoco puede ser infinito.
      connectionTimeoutMillis: limits.statementTimeoutMs,
    },
  };
}
