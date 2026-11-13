import type { TestContext } from './helpers';

/**
 * Archivo aparte: necesita un statement_timeout bajo, y la configuración se
 * valida al cargar AppModule (como la prueba del rate limit).
 */
describe('statement_timeout (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.DB_STATEMENT_TIMEOUT_MS = '200';
    const { createTestApp } = await import('./helpers');
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('una consulta que excede el límite se cancela en la base en lugar de retener la conexión', async () => {
    const started = Date.now();

    await expect(ctx.db.query('SELECT pg_sleep(2)')).rejects.toMatchObject({
      driverError: { code: '57014' },
    });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('la conexión queda libre para la siguiente petición', async () => {
    await ctx.http().get('/health').expect(200);
  });
});
