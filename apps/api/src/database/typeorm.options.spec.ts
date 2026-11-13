import { buildTypeOrmOptions } from './typeorm.options';

describe('buildTypeOrmOptions', () => {
  const options = buildTypeOrmOptions('postgres://user:pass@localhost:5432/db');

  // Si alguien activa synchronize "para probar algo", TypeORM podría borrar
  // columnas en producción. Esta prueba lo frena en el PR.
  it('nunca sincroniza el esquema ni corre migraciones al arrancar', () => {
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it('limita el pool, el tiempo de cada consulta y corre cada migración en su transacción', () => {
    const limited = buildTypeOrmOptions('postgres://u:p@localhost/db', {
      poolMax: 4,
      statementTimeoutMs: 1500,
    });

    expect(limited.extra).toMatchObject({ max: 4, statement_timeout: 1500 });
    expect(limited.migrationsTransactionMode).toBe('each');
  });

  it('busca entidades y migraciones tanto en .ts (CLI) como en .js (build)', () => {
    expect(options.entities).toEqual([expect.stringMatching(/\*\.entity\.\{ts,js\}$/)]);
    expect(options.migrations).toEqual([expect.stringMatching(/migrations[/\\]\*\.\{ts,js\}$/)]);
  });
});
