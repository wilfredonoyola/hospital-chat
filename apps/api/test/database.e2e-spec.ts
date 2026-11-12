import { createTestApp, resetDatabase, TestContext } from './helpers';

/** Reglas que viven en la base: se cumplen aunque el código tenga un bug. */
describe('Restricciones y migraciones de la base (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('criterio 9: cada rol tiene exactamente su credencial', () => {
    it.each([
      [
        'un admin con PIN',
        `INSERT INTO users (full_name, role, email, password_hash, staff_code, pin_hash)
         VALUES ('X', 'ADMIN', 'x@h.test', 'hash', 'ADM001', 'hash')`,
      ],
      [
        'un admin sin contraseña',
        `INSERT INTO users (full_name, role, email) VALUES ('X', 'ADMIN', 'x@h.test')`,
      ],
      [
        'personal con email y contraseña',
        `INSERT INTO users (full_name, role, email, password_hash)
         VALUES ('X', 'STAFF', 'x@h.test', 'hash')`,
      ],
      [
        'personal sin PIN',
        `INSERT INTO users (full_name, role, staff_code) VALUES ('X', 'STAFF', 'ENF009')`,
      ],
    ])('rechaza %s', async (_case, sql) => {
      await expect(ctx.db.query(sql)).rejects.toMatchObject({
        driverError: { constraint: 'users_credentials_match_role' },
      });
    });

    it('rechaza un código con minúsculas o símbolos', async () => {
      await expect(
        ctx.db.query(
          `INSERT INTO users (full_name, role, staff_code, pin_hash) VALUES ('X', 'STAFF', 'enf-1', 'h')`,
        ),
      ).rejects.toMatchObject({ driverError: { constraint: 'users_staff_code_format' } });
    });

    it('rechaza un email con mayúsculas (evita duplicados por mayúsculas)', async () => {
      await expect(
        ctx.db.query(
          `INSERT INTO users (full_name, role, email, password_hash) VALUES ('X', 'ADMIN', 'A@h.test', 'h')`,
        ),
      ).rejects.toMatchObject({ driverError: { constraint: 'users_email_lowercase' } });
    });
  });

  it('todas las migraciones se revierten en orden y se vuelven a aplicar', async () => {
    await resetDatabase(ctx.db);
    const userTables = () =>
      ctx.db
        .query<Array<{ table_name: string }>>(
          `SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name <> 'migrations' ORDER BY table_name`,
        )
        .then((rows) => rows.map((row) => row.table_name));

    for (let i = 0; i < ctx.db.migrations.length; i++) {
      await ctx.db.undoLastMigration();
    }
    expect(await userTables()).toEqual([]);

    await ctx.db.runMigrations();
    expect(await userTables()).toEqual([
      'audit_logs',
      'department_members',
      'departments',
      'messages',
      'users',
    ]);
  });
});
