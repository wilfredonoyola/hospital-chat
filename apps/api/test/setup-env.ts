import { existsSync } from 'node:fs';
import { join } from 'node:path';

// En local se usa apps/api/.env; en el CI las variables llegan del workflow.
const envFile = join(__dirname, '..', '.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
process.env.NODE_ENV = 'test';
