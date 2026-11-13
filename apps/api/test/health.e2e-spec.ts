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

describe('Correlation ID (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('toda respuesta trae X-Request-Id, también los errores', async () => {
    const ok = await ctx.http().get('/health');
    const unauthorized = await ctx.http().get('/auth/me');

    expect(ok.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(ok.headers['x-request-id']).not.toBe(unauthorized.headers['x-request-id']);
  });

  it('respeta el id que manda un proxy (Front Door) y descarta uno inválido', async () => {
    const forwarded = await ctx.http().get('/health').set('X-Request-Id', 'front-door-abc12345');
    const invalid = await ctx.http().get('/health').set('X-Request-Id', 'no válido {}');

    expect(forwarded.headers['x-request-id']).toBe('front-door-abc12345');
    expect(invalid.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
