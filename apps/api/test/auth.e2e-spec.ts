import {
  createAdmin,
  createDepartment,
  createStaff,
  createTestApp,
  loginAdmin,
  loginStaff,
  resetDatabase,
  TestContext,
} from './helpers';

const ADMIN = { email: 'admin@hospital.test', password: 'contrasena-de-prueba-larga' };

describe('Autenticación (e2e)', () => {
  let ctx: TestContext;
  let emergenciasId: string;
  let staffId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    emergenciasId = await createDepartment(ctx.db, 'Emergencias');
    staffId = await createStaff(ctx.db, {
      code: 'ENF001',
      pin: '2580',
      departmentIds: [emergenciasId],
    });
    await createAdmin(ctx.db, ADMIN.email, ADMIN.password);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('login del personal', () => {
    it('devuelve un token y los datos básicos, sin hashes', async () => {
      const response = await ctx
        .http()
        .post('/auth/staff/login')
        .send({ staffCode: 'enf001', pin: '2580' })
        .expect(200);

      expect(response.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 1800,
        user: { id: staffId, role: 'STAFF' },
      });
      expect(JSON.stringify(response.body)).not.toMatch(/hash|\$argon2/i);
    });

    it('criterio 3: código inexistente, inactivo, bloqueado o PIN incorrecto dan el mismo 401', async () => {
      await createStaff(ctx.db, { code: 'INA001', pin: '2580' });
      await ctx.db.query(`UPDATE users SET is_active = false WHERE staff_code = 'INA001'`);
      await createStaff(ctx.db, { code: 'BLQ001', pin: '2580' });
      await ctx.db.query(
        `UPDATE users SET locked_until = now() + interval '10 minutes' WHERE staff_code = 'BLQ001'`,
      );

      const attempts = [
        { staffCode: 'NOEXISTE', pin: '2580' },
        { staffCode: 'INA001', pin: '2580' },
        { staffCode: 'BLQ001', pin: '2580' },
        { staffCode: 'ENF001', pin: '9999' },
      ];
      const bodies = [];
      for (const attempt of attempts) {
        const response = await ctx.http().post('/auth/staff/login').send(attempt).expect(401);
        bodies.push(response.body as unknown);
      }

      expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
      expect(bodies[0]).toMatchObject({ message: 'Credenciales inválidas' });
    });

    it('criterio 4: al quinto PIN incorrecto bloquea la cuenta, aunque luego use el PIN correcto', async () => {
      for (let i = 0; i < 5; i++) {
        await ctx
          .http()
          .post('/auth/staff/login')
          .send({ staffCode: 'ENF001', pin: '9999' })
          .expect(401);
      }

      await ctx
        .http()
        .post('/auth/staff/login')
        .send({ staffCode: 'ENF001', pin: '2580' })
        .expect(401);

      const [row] = await ctx.db.query<Array<{ locked: boolean }>>(
        `SELECT locked_until > now() AS locked FROM users WHERE id = $1`,
        [staffId],
      );
      expect(row.locked).toBe(true);
    });

    it('criterio 4: un login correcto reinicia el contador de intentos', async () => {
      const wrong = () =>
        ctx.http().post('/auth/staff/login').send({ staffCode: 'ENF001', pin: '9999' });

      for (let i = 0; i < 4; i++) await wrong().expect(401);
      await loginStaff(ctx, 'ENF001', '2580');
      for (let i = 0; i < 4; i++) await wrong().expect(401);

      // 8 fallos en total pero nunca 5 seguidos: sigue pudiendo entrar.
      await loginStaff(ctx, 'ENF001', '2580');
    });

    it('cuenta bien los intentos aunque lleguen en paralelo (UPDATE atómico)', async () => {
      await Promise.all(
        Array.from({ length: 4 }, () =>
          ctx.http().post('/auth/staff/login').send({ staffCode: 'ENF001', pin: '9999' }),
        ),
      );

      const [row] = await ctx.db.query<Array<{ failed_login_attempts: number }>>(
        'SELECT failed_login_attempts FROM users WHERE id = $1',
        [staffId],
      );
      expect(row.failed_login_attempts).toBe(4);
    });

    it('criterio 7: rechaza campos extra en el body', async () => {
      await ctx
        .http()
        .post('/auth/staff/login')
        .send({ staffCode: 'ENF001', pin: '2580', role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('login del admin', () => {
    it('acepta el email sin importar mayúsculas', async () => {
      const response = await ctx
        .http()
        .post('/auth/admin/login')
        .send({ email: 'ADMIN@Hospital.test', password: ADMIN.password })
        .expect(200);

      expect(response.body).toMatchObject({ user: { role: 'ADMIN' } });
    });

    it('el personal no puede entrar por el login de admin', async () => {
      await ctx
        .http()
        .post('/auth/admin/login')
        .send({ email: 'enf001@hospital.test', password: '2580' })
        .expect(401);
    });
  });

  describe('sesión', () => {
    it('criterio 1: sin token responde 401', async () => {
      await ctx.http().get('/auth/me').expect(401);
      await ctx.http().get('/admin/users').expect(401);
    });

    it('rechaza un token manipulado', async () => {
      const token = await loginStaff(ctx, 'ENF001', '2580');
      const [header, payload] = token.split('.');

      await ctx
        .http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.firma-falsa`)
        .expect(401);
    });

    it('/auth/me devuelve el perfil con solo las áreas activas', async () => {
      const uciId = await createDepartment(ctx.db, 'UCI');
      await ctx.db.query(
        'INSERT INTO department_members (user_id, department_id) VALUES ($1, $2)',
        [staffId, uciId],
      );
      await ctx.db.query('UPDATE departments SET is_active = false WHERE id = $1', [uciId]);
      const token = await loginStaff(ctx, 'ENF001', '2580');

      const response = await ctx
        .http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: staffId,
        fullName: 'Persona ENF001',
        role: 'STAFF',
        staffCode: 'ENF001',
        email: null,
        isActive: true,
        departments: [{ id: emergenciasId, name: 'Emergencias' }],
      });
    });

    it('criterio 6: logout invalida todos los tokens de la persona', async () => {
      const pcEnfermeria = await loginStaff(ctx, 'ENF001', '2580');
      const otraPc = await loginStaff(ctx, 'ENF001', '2580');

      await ctx
        .http()
        .post('/auth/logout')
        .set('Authorization', `Bearer ${pcEnfermeria}`)
        .expect(204);

      await ctx.http().get('/auth/me').set('Authorization', `Bearer ${pcEnfermeria}`).expect(401);
      await ctx.http().get('/auth/me').set('Authorization', `Bearer ${otraPc}`).expect(401);
    });
  });

  describe('autorización', () => {
    it.each(['STAFF', 'SUPERVISOR'] as const)(
      'criterio 2: un %s recibe 403 en administración',
      async (role) => {
        await createStaff(ctx.db, { code: 'ROL001', pin: '2580', role });
        const token = await loginStaff(ctx, 'ROL001', '2580');

        for (const path of ['/admin/users', '/admin/departments', '/admin/audit-logs']) {
          await ctx.http().get(path).set('Authorization', `Bearer ${token}`).expect(403);
        }
      },
    );

    it('el admin sí entra a administración', async () => {
      const token = await loginAdmin(ctx, ADMIN.email, ADMIN.password);

      await ctx.http().get('/admin/users').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('un cambio de rol aplica de inmediato, sin esperar a que venza el token', async () => {
      const token = await loginStaff(ctx, 'ENF001', '2580');
      // El token no lleva el rol: el guard lo lee de la base en cada petición.
      await ctx.db.query(`UPDATE users SET role = 'SUPERVISOR' WHERE id = $1`, [staffId]);

      const response = await ctx
        .http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body).toMatchObject({ role: 'SUPERVISOR' });
    });
  });
});
