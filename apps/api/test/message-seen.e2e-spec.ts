import {
  createDepartment,
  createStaff,
  createTestApp,
  loginStaff,
  resetDatabase,
  TestContext,
} from './helpers';

describe('«Lo vi» (e2e)', () => {
  let ctx: TestContext;
  let emergencias: string;
  let uci: string;
  let carla: string;
  let ana: string;
  let pedro: string;
  let luis: string;
  let fromCarla: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const channel = (departmentId: string) => `/departments/${departmentId}/messages`;
  const seen = (departmentId: string, messageId: string) =>
    `${channel(departmentId)}/${messageId}/seen`;

  /** Cuántas personas lo vieron, leído desde la lista que ve la supervisora. */
  const seenCount = async (messageId: string) => {
    const list = await ctx.http().get(channel(emergencias)).set(auth(carla)).expect(200);
    const items = (list.body as { items: Array<{ id: string; seenCount: number }> }).items;
    return items.find((m) => m.id === messageId)?.seenCount;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    emergencias = await createDepartment(ctx.db, 'Emergencias');
    uci = await createDepartment(ctx.db, 'UCI');
    await createStaff(ctx.db, {
      code: 'SUP001',
      pin: '7391',
      role: 'SUPERVISOR',
      departmentIds: [emergencias],
    });
    await createStaff(ctx.db, { code: 'ENF001', pin: '2580', departmentIds: [emergencias] });
    await createStaff(ctx.db, { code: 'ENF003', pin: '9147', departmentIds: [emergencias] });
    await createStaff(ctx.db, { code: 'ENF002', pin: '4826', departmentIds: [uci] });
    [carla, ana, pedro, luis] = await Promise.all([
      loginStaff(ctx, 'SUP001', '7391'),
      loginStaff(ctx, 'ENF001', '2580'),
      loginStaff(ctx, 'ENF003', '9147'),
      loginStaff(ctx, 'ENF002', '4826'),
    ]);
    const sent = await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(carla))
      .send({ body: 'Revisen la cama 4', priority: 'URGENT' })
      .expect(201);
    fromCarla = (sent.body as { id: string }).id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('marcar dos veces no cuenta doble', async () => {
    const first = await ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201);
    const second = await ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201);

    // La segunda devuelve la confirmación original, no una nueva.
    expect(second.body).toEqual(first.body);
    expect(await seenCount(fromCarla)).toBe(1);
  });

  it('dos clics al mismo tiempo tampoco duplican (lo garantiza la base)', async () => {
    await Promise.all([
      ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201),
      ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201),
      ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201),
    ]);

    expect(await seenCount(fromCarla)).toBe(1);
  });

  it('cuenta personas distintas y cada una ve su propio «Lo vi»', async () => {
    await ctx.http().post(seen(emergencias, fromCarla)).set(auth(ana)).expect(201);
    await ctx.http().post(seen(emergencias, fromCarla)).set(auth(pedro)).expect(201);

    expect(await seenCount(fromCarla)).toBe(2);

    const asAna = await ctx.http().get(channel(emergencias)).set(auth(ana)).expect(200);
    const asCarla = await ctx.http().get(channel(emergencias)).set(auth(carla)).expect(200);
    expect((asAna.body as { items: Array<{ seenByMe: boolean }> }).items[0].seenByMe).toBe(true);
    expect((asCarla.body as { items: Array<{ seenByMe: boolean }> }).items[0].seenByMe).toBe(false);
  });

  it('solo quien pertenece al área puede marcar', async () => {
    await ctx.http().post(seen(emergencias, fromCarla)).set(auth(luis)).expect(403);

    expect(await seenCount(fromCarla)).toBe(0);
  });

  it('no se confirma un mensaje de otra área ni uno que no existe', async () => {
    // Ana es de Emergencias, pero el mensaje no está en UCI: 403 por no ser del área.
    await ctx.http().post(seen(uci, fromCarla)).set(auth(ana)).expect(403);
    await ctx
      .http()
      .post(seen(emergencias, '00000000-0000-4000-8000-000000000000'))
      .set(auth(ana))
      .expect(404);
  });

  it('no aplica a mensajes de personal ni al propio autor', async () => {
    const fromAna = await ctx
      .http()
      .post(channel(emergencias))
      .set(auth(ana))
      .send({ body: 'Voy para allá' })
      .expect(201);

    await ctx
      .http()
      .post(seen(emergencias, (fromAna.body as { id: string }).id))
      .set(auth(pedro))
      .expect(403);
    await ctx.http().post(seen(emergencias, fromCarla)).set(auth(carla)).expect(403);
  });
});
