/** Base de pruebas: TEST_DATABASE_URL en el CI; la de docker compose en local. Nunca la de desarrollo. */
export const BASE_TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://hospital_chat:hospital_chat@localhost:5432/hospital_chat_test';

/** hospital_chat_test → hospital_chat_test_<worker>. */
export function testDatabaseUrlForWorker(worker: number | string): string {
  const url = new URL(BASE_TEST_DATABASE_URL);
  url.pathname = `${url.pathname}_${worker}`;
  return url.toString();
}
