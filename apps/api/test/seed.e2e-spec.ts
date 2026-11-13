import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createTestApp, resetDatabase, TestContext } from './helpers';

const run = promisify(execFile);

describe('criterio 12: seed idempotente (e2e)', () => {
  let ctx: TestContext;

  const seed = () =>
    run('npx', ['ts-node', '--transpile-only', 'src/seed.ts'], {
      cwd: join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        ADMIN_EMAIL: 'Admin@Hospital.test',
        ADMIN_PASSWORD: 'contrasena-del-seed-larga',
      },
    });

  const counts = async () => {
    const [row] = await ctx.db.query<Array<Record<string, number>>>(
      `SELECT (SELECT count(*)::int FROM departments) AS departments,
              (SELECT count(*)::int FROM users WHERE role = 'ADMIN') AS admins,
              (SELECT count(*)::int FROM users WHERE role <> 'ADMIN') AS staff,
              (SELECT count(*)::int FROM department_members) AS memberships`,
    );
    return row;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.db);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('se puede correr dos veces sin duplicar nada', async () => {
    await seed();
    const first = await counts();
    await seed();

    expect(await counts()).toEqual(first);
    expect(first).toEqual({ departments: 5, admins: 1, staff: 5, memberships: 8 });
  }, 60_000);

  it('el admin y el personal de demostración pueden entrar', async () => {
    await ctx
      .http()
      .post('/auth/admin/login')
      .send({ email: 'admin@hospital.test', password: 'contrasena-del-seed-larga' })
      .expect(200);
    await ctx
      .http()
      .post('/auth/staff/login')
      .send({ staffCode: 'ENF001', pin: '2580' })
      .expect(200);
  });
});
