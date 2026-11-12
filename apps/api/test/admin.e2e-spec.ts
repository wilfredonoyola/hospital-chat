import {
  createAdmin,
  createDepartment,
  createTestApp,
  loginAdmin,
  loginStaff,
  resetDatabase,
  TestContext,
} from './helpers';

const ADMIN = { email: 'admin@hospital.test', password: 'contrasena-de-prueba-larga' };

describe('Administración (e2e)', () => {
  let ctx: TestContext;
  let adminId: string;
  let adminToken: string;
  let emergenciasId: string;
  let uciId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const newStaff = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'Ana Martínez',
    role: 'STAFF',
    staffCode: 'enf001',
    pin: '2580',
    departmentIds: [emergenciasId],
    ...overrides,
  });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    emergenciasId = await createDepartment(ctx.db, 'Emergencias');
    uciId = await createDepartment(ctx.db, 'UCI');
    adminId = await createAdmin(ctx.db, ADMIN.email, ADMIN.password);
    adminToken = await loginAdmin(ctx, ADMIN.email, ADMIN.password);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('personal', () => {
    it('crea a una persona con sus áreas y puede entrar con su PIN', async () => {
      const response = await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ departmentIds: [emergenciasId, uciId] }))
        .expect(201);

      expect(response.body).toMatchObject({
        fullName: 'Ana Martínez',
        role: 'STAFF',
        staffCode: 'ENF001',
        isActive: true,
        departments: [
          { id: emergenciasId, name: 'Emergencias' },
          { id: uciId, name: 'UCI' },
        ],
      });
      expect(JSON.stringify(response.body)).not.toMatch(/pin|hash/i);
      await loginStaff(ctx, 'ENF001', '2580');
    });

    it('criterio 7: no se puede crear un ADMIN por API', async () => {
      const response = await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ role: 'ADMIN' }))
        .expect(400);

      expect(JSON.stringify(response.body)).toMatch(/SUPERVISOR o STAFF/);
    });

    it('criterio 7: rechaza campos que no están en el DTO (mass assignment)', async () => {
      await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ isAdmin: true }))
        .expect(400);
      await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ email: 'colado@hospital.test' }))
        .expect(400);
    });

    it.each(['1234', '0000', '12'])('rechaza el PIN débil %s', async (pin) => {
      await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff({ pin })).expect(400);
    });

    it('criterio 8: código duplicado responde 409', async () => {
      await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff()).expect(201);

      const response = await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ fullName: 'Otra persona', staffCode: 'ENF001' }))
        .expect(409);

      expect(response.body).toMatchObject({ message: 'Ya existe una persona con ese código' });
    });

    it('criterio 8: área inexistente responde 400 y no deja nada a medias', async () => {
      const response = await ctx
        .http()
        .post('/admin/users')
        .set(asAdmin())
        .send(newStaff({ departmentIds: ['00000000-0000-4000-8000-000000000000'] }))
        .expect(400);

      expect(response.body).toMatchObject({ message: 'Alguna de las áreas indicadas no existe' });
      // La transacción se revirtió: ni usuario ni auditoría.
      const [{ users, logs }] = await ctx.db.query<Array<{ users: number; logs: number }>>(
        `SELECT (SELECT count(*)::int FROM users WHERE role <> 'ADMIN') AS users,
                (SELECT count(*)::int FROM audit_logs) AS logs`,
      );
      expect({ users, logs }).toEqual({ users: 0, logs: 0 });
    });

    it('criterio 6: desactivar a alguien corta su sesión al instante', async () => {
      const { body } = await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());
      const staffToken = await loginStaff(ctx, 'ENF001', '2580');

      await ctx
        .http()
        .patch(`/admin/users/${(body as { id: string }).id}`)
        .set(asAdmin())
        .send({ isActive: false })
        .expect(200);

      await ctx.http().get('/auth/me').set('Authorization', `Bearer ${staffToken}`).expect(401);
    });

    it('criterio 6: resetear el PIN desbloquea la cuenta y cierra sus sesiones', async () => {
      const { body } = await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());
      const userId = (body as { id: string }).id;
      const staffToken = await loginStaff(ctx, 'ENF001', '2580');
      await ctx.db.query(
        `UPDATE users SET locked_until = now() + interval '10 minutes', failed_login_attempts = 3
          WHERE id = $1`,
        [userId],
      );

      await ctx
        .http()
        .post(`/admin/users/${userId}/reset-pin`)
        .set(asAdmin())
        .send({ pin: '7391' })
        .expect(204);

      await ctx.http().get('/auth/me').set('Authorization', `Bearer ${staffToken}`).expect(401);
      await loginStaff(ctx, 'ENF001', '7391');
    });

    it('cambia el rol y reemplaza las áreas', async () => {
      const { body } = await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());

      const response = await ctx
        .http()
        .patch(`/admin/users/${(body as { id: string }).id}`)
        .set(asAdmin())
        .send({ role: 'SUPERVISOR', departmentIds: [uciId] })
        .expect(200);

      expect(response.body).toMatchObject({
        role: 'SUPERVISOR',
        departments: [{ id: uciId, name: 'UCI' }],
      });
    });

    it('no permite gestionar a un administrador por API', async () => {
      await ctx
        .http()
        .patch(`/admin/users/${adminId}`)
        .set(asAdmin())
        .send({ isActive: false })
        .expect(404);
      await ctx
        .http()
        .post(`/admin/users/${adminId}/reset-pin`)
        .set(asAdmin())
        .send({ pin: '7391' })
        .expect(404);
    });

    it('un id mal formado responde 400, no 500', async () => {
      await ctx.http().patch('/admin/users/no-es-un-uuid').set(asAdmin()).send({}).expect(400);
    });

    it('la lista no incluye administradores ni hashes', async () => {
      await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());

      const response = await ctx.http().get('/admin/users').set(asAdmin()).expect(200);

      expect(response.body).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toMatch(/hash|admin@/i);
    });
  });

  describe('áreas', () => {
    it('crea, renombra y desactiva un área', async () => {
      const created = await ctx
        .http()
        .post('/admin/departments')
        .set(asAdmin())
        .send({ name: '  Farmacia  ', description: 'Medicamentos' })
        .expect(201);
      const id = (created.body as { id: string }).id;
      expect(created.body).toMatchObject({ name: 'Farmacia', isActive: true });

      const updated = await ctx
        .http()
        .patch(`/admin/departments/${id}`)
        .set(asAdmin())
        .send({ name: 'Farmacia central', isActive: false })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Farmacia central', isActive: false });
    });

    it('criterio 8: nombre duplicado sin importar mayúsculas responde 409', async () => {
      const response = await ctx
        .http()
        .post('/admin/departments')
        .set(asAdmin())
        .send({ name: 'emergencias' })
        .expect(409);

      expect(response.body).toMatchObject({ message: 'Ya existe un área con ese nombre' });
    });
  });

  describe('auditoría', () => {
    it('criterio 11: registra cada acción con actor e IP, sin el PIN', async () => {
      const { body } = await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());
      const userId = (body as { id: string }).id;
      await ctx
        .http()
        .post(`/admin/users/${userId}/reset-pin`)
        .set(asAdmin())
        .send({ pin: '7391' });
      await ctx.http().patch(`/admin/users/${userId}`).set(asAdmin()).send({ fullName: 'Ana M.' });

      const response = await ctx.http().get('/admin/audit-logs').set(asAdmin()).expect(200);
      const logs = response.body as Array<Record<string, unknown>>;

      expect(logs.map((log) => log.action)).toEqual([
        'user.updated',
        'user.pin_reset',
        'user.created',
      ]);
      expect(logs.every((log) => log.actorId === adminId && log.entityId === userId)).toBe(true);
      expect(logs[0]).toMatchObject({
        metadata: { fullName: { from: 'Ana Martínez', to: 'Ana M.' } },
      });
      expect(logs.every((log) => typeof log.ip === 'string')).toBe(true);
      expect(JSON.stringify(logs)).not.toMatch(/2580|7391|argon2/);
    });

    it('un cambio sin diferencias no ensucia la auditoría', async () => {
      const { body } = await ctx.http().post('/admin/users').set(asAdmin()).send(newStaff());

      await ctx
        .http()
        .patch(`/admin/users/${(body as { id: string }).id}`)
        .set(asAdmin())
        .send({ fullName: 'Ana Martínez', departmentIds: [emergenciasId] })
        .expect(200);

      const [{ count }] = await ctx.db.query<Array<{ count: number }>>(
        'SELECT count(*)::int AS count FROM audit_logs',
      );
      expect(count).toBe(1);
    });
  });
});
