import {
  createDepartment,
  createStaff,
  createTestApp,
  resetDatabase,
  TestContext,
} from './helpers';

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
      // Igual que la CLI (migrationsTransactionMode: 'each').
      await ctx.db.undoLastMigration({ transaction: 'each' });
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

  it('la lectura del canal usa el índice: sin recorrer ni ordenar la tabla', async () => {
    // Con la tabla vacía el planificador elige cualquier cosa: hace falta volumen.
    await resetDatabase(ctx.db);
    const departmentId = await createDepartment(ctx.db, 'Emergencias');
    const otherId = await createDepartment(ctx.db, 'UCI');
    const authorId = await createStaff(ctx.db, { code: 'ENF001', pin: '2580' });
    await ctx.db.query(
      `INSERT INTO messages (department_id, author_id, body, created_at)
       SELECT CASE WHEN g % 2 = 0 THEN $1::uuid ELSE $2::uuid END, $3, 'm' || g,
              now() - g * interval '1 second'
         FROM generate_series(1, 20000) g`,
      [departmentId, otherId, authorId],
    );
    await ctx.db.query('ANALYZE messages');

    const [{ 'QUERY PLAN': plan }] = await ctx.db.query<Array<{ 'QUERY PLAN': unknown }>>(
      `EXPLAIN (FORMAT JSON)
       SELECT id FROM messages
        WHERE department_id = $1
        ORDER BY created_at DESC, id DESC LIMIT 51`,
      [departmentId],
    );
    const text = JSON.stringify(plan);

    expect(text).toContain('messages_department_created_idx');
    expect(text).not.toContain('"Node Type":"Sort"');
  });
});
