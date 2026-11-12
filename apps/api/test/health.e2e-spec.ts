import { createTestApp, TestContext } from './helpers';

describe('GET /health (e2e, Postgres real)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('responde 200 sin token con la base de datos arriba', async () => {
    const response = await ctx.http().get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('aplica los headers de seguridad de helmet', async () => {
    const response = await ctx.http().get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('solo permite CORS a los orígenes configurados', async () => {
    const allowed = await ctx.http().get('/health').set('Origin', 'http://localhost:3000');
    const blocked = await ctx
      .http()
      .get('/health')
      .set('Origin', 'https://sitio-malicioso.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
