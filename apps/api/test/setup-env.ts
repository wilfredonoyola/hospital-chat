import { testDatabaseUrlForWorker } from './test-database';

// Entorno fijo para las e2e: no lee .env, así el resultado es el mismo en
// cualquier máquina y en el CI, y nunca apunta a la base de desarrollo.
process.env.NODE_ENV = 'test';
// Cada worker de Jest tiene su propia base (ver global-setup.ts).
process.env.DATABASE_URL = testDatabaseUrlForWorker(process.env.JEST_WORKER_ID ?? 1);
process.env.JWT_SECRET = 'e2e-secret-que-solo-existe-en-las-pruebas-0123456789';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Las pruebas verifican comportamiento, no logs; LOG_LEVEL=debug al diagnosticar una e2e.
process.env.LOG_LEVEL ??= 'silent';
// Alto para que las pruebas no choquen con el rate limit; la prueba del
// rate limit levanta su propia app con un límite bajo.
process.env.LOGIN_RATE_LIMIT_PER_MINUTE ??= '1000';
