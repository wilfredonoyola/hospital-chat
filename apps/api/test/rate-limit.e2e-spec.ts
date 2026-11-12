import type { TestContext } from './helpers';

/**
 * Archivo aparte: necesita un límite bajo y la configuración se valida una
 * vez al cargar AppModule. Jest aísla los módulos por archivo, así que aquí se
 * fija el límite antes de importar la app.
 */
describe('criterio 5: rate limit en login (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '3';
    const { createTestApp } = await import('./helpers');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('responde 429 al superar el límite por IP; cada endpoint de login lleva su propio contador', async () => {
    const attempt = () =>
      ctx.http().post('/auth/staff/login').send({ staffCode: 'ENF001', pin: '9999' });

    for (let i = 0; i < 3; i++) await attempt().expect(401);
    await attempt().expect(429);
    await ctx
      .http()
      .post('/auth/admin/login')
      .send({ email: 'admin@hospital.test', password: 'x' })
      .expect(401);
  });

  it('no limita el resto de la API', async () => {
    for (let i = 0; i < 5; i++) await ctx.http().get('/health').expect(200);
  });
});
