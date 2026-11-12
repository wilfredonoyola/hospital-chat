import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Opciones compartidas por la app (TypeOrmModule) y por la CLI de migraciones
 * (data-source.ts), para que ambas vean exactamente las mismas entidades.
 *
 * `synchronize` está apagado siempre: el esquema solo cambia con migraciones
 * revisadas en un Pull Request.
 */
export function buildTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
  };
}
