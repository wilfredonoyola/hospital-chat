import { validateEnv } from './env';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('aplica valores por defecto', () => {
    const env = validateEnv(base);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.JWT_TTL_SECONDS).toBe(1800);
    expect(env.LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(env.TRUST_PROXY).toBe(0);
  });

  it('convierte números y separa los orígenes de CORS', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      CORS_ORIGINS: 'https://a.example, https://b.example',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('falla al arrancar si falta DATABASE_URL o no es de Postgres', () => {
    expect(() => validateEnv({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rechaza un JWT_SECRET corto: un secreto débil permite falsificar tokens', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'secreto' })).toThrow(/JWT_SECRET/);
  });
});
