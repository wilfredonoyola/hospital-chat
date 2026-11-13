import {
  createDepartment,
  createStaff,
  createTestApp,
  loginStaff,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Mensajes (e2e)', () => {
  let ctx: TestContext;
  let emergencias: string;
  let uci: string;
  let ana: string;
  let carla: string;
  let luis: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const channel = (departmentId: string) => `/departments/${departmentId}/messages`;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    emergencias = await createDepartment(ctx.db, 'Emergencias');
    uci = await createDepartment(ctx.db, 'UCI');
    await createStaff(ctx.db, { code: 'ENF001', pin: '2580', departmentIds: [emergencias] });
    await createStaff(ctx.db, {
      code: 'SUP001',
      pin: '7391',
      role: 'SUPERVISOR',
      departmentIds: [emergencias],
    });
    await createStaff(ctx.db, { code: 'ENF002', pin: '4826', departmentIds: [uci] });
    [ana, carla, luis] = await Promise.all([
      loginStaff(ctx, 'ENF001', '2580'),
      loginStaff(ctx, 'SUP001', '7391'),
      loginStaff(ctx, 'ENF002', '4826'),
    ]);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('criterio 1: un miembro envía un mensaje y lo ve con su nombre y rol', async () => {
    const sent = await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(ana))
      .send({ body: '  Cama 4 pide analgesia  ' })
      .expect(201);

    expect(sent.body).toMatchObject({
      departmentId: emergencias,
      body: 'Cama 4 pide analgesia',
      priority: 'NORMAL',
    });

    const list = await ctx.http().get(channel(emergencias)).set(auth(carla)).expect(200);
    expect((list.body as { items: unknown[] }).items).toEqual([
      expect.objectContaining({
        id: (sent.body as { id: string }).id,
        body: 'Cama 4 pide analgesia',
        author: expect.objectContaining({ fullName: 'Persona ENF001', role: 'STAFF' }),
      }),
    ]);
  });

  it('criterio 2: el empleado curioso no puede leer ni escribir en un área ajena', async () => {
    await ctx.http().post(channel(emergencias)).set(auth(ana)).send({ body: 'dato clínico' });

    const read = await ctx.http().get(channel(emergencias)).set(auth(luis)).expect(403);
    await ctx.http().post(channel(emergencias)).set(auth(luis)).send({ body: 'hola' }).expect(403);

    expect(JSON.stringify(read.body)).not.toMatch(/dato clínico/);
  });

  it('criterio 2: un área inexistente responde igual que una ajena (no revela si existe)', async () => {
    const missing = await ctx
      .http()
      .get(channel('00000000-0000-4000-8000-000000000000'))
      .set(auth(ana))
      .expect(403);
    const foreign = await ctx.http().get(channel(uci)).set(auth(ana)).expect(403);

    expect(missing.body).toEqual(foreign.body);
  });

  it('criterio 3: un área desactivada no acepta lecturas ni escrituras', async () => {
    await ctx.db.query('UPDATE departments SET is_active = false WHERE id = $1', [emergencias]);

    await ctx.http().get(channel(emergencias)).set(auth(ana)).expect(403);
    await ctx.http().post(channel(emergencias)).set(auth(ana)).send({ body: 'hola' }).expect(403);
  });

  it('criterio 4: STAFF no puede enviar urgentes; SUPERVISOR sí', async () => {
    const denied = await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(ana))
      .send({ body: 'Código azul', priority: 'URGENT' })
      .expect(403);
    expect(denied.body).toMatchObject({
      message: 'Solo un supervisor puede enviar mensajes urgentes',
    });

    await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(carla))
      .send({ body: 'Código azul en sala 3', priority: 'URGENT' })
      .expect(201);
  });

  it('criterio 5: del más reciente al más antiguo, respetando limit', async () => {
    for (const body of ['uno', 'dos', 'tres']) {
      await ctx.http().post(channel(emergencias)).set(auth(ana)).send({ body }).expect(201);
    }

    const response = await ctx
      .http()
      .get(`${channel(emergencias)}?limit=2`)
      .set(auth(ana))
      .expect(200);

    expect((response.body as { items: Array<{ body: string }> }).items.map((m) => m.body)).toEqual([
      'tres',
      'dos',
    ]);
  });

  it.each([
    ['texto vacío', { body: '   ' }],
    ['prioridad inexistente', { body: 'hola', priority: 'CRITICAL' }],
    ['campo extra', { body: 'hola', authorId: '00000000-0000-4000-8000-000000000000' }],
    ['texto que no es string', { body: 123 }],
  ])('responde 400 con %s', async (_case, payload) => {
    await ctx.http().post(channel(emergencias)).set(auth(ana)).send(payload).expect(400);
  });

  it('el autor sale del token, no del body: nadie escribe en nombre de otro', async () => {
    const response = await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(ana))
      .send({ body: 'hola' })
      .expect(201);

    const [{ staff_code }] = await ctx.db.query<Array<{ staff_code: string }>>(
      'SELECT u.staff_code FROM messages m JOIN users u ON u.id = m.author_id WHERE m.id = $1',
      [(response.body as { id: string }).id],
    );
    expect(staff_code).toBe('ENF001');
  });

  it('limit fuera de rango responde 400', async () => {
    await ctx
      .http()
      .get(`${channel(emergencias)}?limit=500`)
      .set(auth(ana))
      .expect(400);
  });

  it('criterio 6: la base rechaza un mensaje vacío aunque se inserte por SQL', async () => {
    const [{ id }] = await ctx.db.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE staff_code = 'ENF001'`,
    );

    await expect(
      ctx.db.query(`INSERT INTO messages (department_id, author_id, body) VALUES ($1, $2, '  ')`, [
        emergencias,
        id,
      ]),
    ).rejects.toMatchObject({ driverError: { constraint: 'messages_body_length' } });
  });

  describe('paginación por cursor (fase 5b)', () => {
    type Page = { items: Array<{ body: string }>; nextCursor: string | null };
    const read = async (query: string) =>
      (
        await ctx
          .http()
          .get(`${channel(emergencias)}${query}`)
          .set(auth(ana))
          .expect(200)
      ).body as Page;

    it('recorre el canal hacia atrás sin repetir ni saltar, aunque lleguen mensajes nuevos', async () => {
      for (let i = 1; i <= 7; i++) {
        await ctx
          .http()
          .post(channel(emergencias))
          .set(auth(ana))
          .send({ body: `m${i}` });
      }

      const first = await read('?limit=3');
      // Llega un mensaje nuevo mientras el usuario pagina: con OFFSET, "m4" se repetiría.
      await ctx.http().post(channel(emergencias)).set(auth(carla)).send({ body: 'nuevo' });
      const second = await read(`?limit=3&before=${first.nextCursor}`);
      const third = await read(`?limit=3&before=${second.nextCursor}`);

      expect(first.items.map((m) => m.body)).toEqual(['m7', 'm6', 'm5']);
      expect(second.items.map((m) => m.body)).toEqual(['m4', 'm3', 'm2']);
      expect(third.items.map((m) => m.body)).toEqual(['m1']);
      expect(third.nextCursor).toBeNull();
    });

    it('sin más mensajes, nextCursor es null', async () => {
      await ctx.http().post(channel(emergencias)).set(auth(ana)).send({ body: 'único' });

      expect(await read('?limit=5')).toMatchObject({ nextCursor: null });
    });

    it('un cursor inválido responde 400', async () => {
      await ctx
        .http()
        .get(`${channel(emergencias)}?before=esto-no-es-un-cursor`)
        .set(auth(ana))
        .expect(400);
    });
  });
});
