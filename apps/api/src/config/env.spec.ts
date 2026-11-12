import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

  it('aplica valores por defecto', () => {
    const env = validateEnv(base);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('convierte PORT a número y separa los orígenes de CORS', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      CORS_ORIGINS: 'https://a.example, https://b.example',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falla al arrancar si falta DATABASE_URL o no es de Postgres', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });
});
