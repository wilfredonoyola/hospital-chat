// Entorno fijo para las e2e: no lee .env, así el resultado es el mismo en
// cualquier máquina y en el CI, y nunca apunta a la base de desarrollo.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://hospital_chat:hospital_chat@localhost:5432/hospital_chat_test';
process.env.JWT_SECRET = 'e2e-secret-que-solo-existe-en-las-pruebas-0123456789';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Alto para que las pruebas no choquen con el rate limit; la prueba del
// rate limit levanta su propia app con un límite bajo.
process.env.LOGIN_RATE_LIMIT_PER_MINUTE ??= '1000';
