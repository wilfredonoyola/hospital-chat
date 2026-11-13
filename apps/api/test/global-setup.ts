import { DataSource } from 'typeorm';
import { BASE_TEST_DATABASE_URL, testDatabaseUrlForWorker } from './test-database';

/**
 * Crea una base de pruebas por worker de Jest (hospital_chat_test_1, _2, …).
 * Así las e2e corren en paralelo sin pisarse: cada archivo vacía y llena solo
 * la base de su worker. Las migraciones las aplica cada app de prueba al
 * levantar, así que una base nueva queda lista sola.
 */
export default async function globalSetup(globalConfig: { maxWorkers: number }): Promise<void> {
  const maintenance = new URL(BASE_TEST_DATABASE_URL);
  maintenance.pathname = '/postgres';
  const db = await new DataSource({ type: 'postgres', url: maintenance.toString() }).initialize();
  try {
    for (let worker = 1; worker <= globalConfig.maxWorkers; worker++) {
      const name = new URL(testDatabaseUrlForWorker(worker)).pathname.slice(1);
      const exists = await db.query<unknown[]>('SELECT 1 FROM pg_database WHERE datname = $1', [
        name,
      ]);
      if (exists.length === 0) {
        // El nombre sale de nuestra propia configuración, no de una entrada externa.
        await db.query(`CREATE DATABASE "${name}"`);
      }
    }
  } finally {
    await db.destroy();
  }
}
