import { z } from 'zod';

/**
 * Variables de entorno de la API. Se validan una sola vez al arrancar:
 * si falta algo o está mal, el proceso no levanta (fail fast) en lugar de
 * fallar a mitad de una petición en producción.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Saltos de proxy de confianza (App Service / Front Door = 1). Con 0, req.ip es
  // la IP del socket; detrás de un proxy sería siempre la del balanceador y el
  // rate limit trataría a todo el mundo como un solo cliente.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  JWT_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  // Sesiones cortas: el personal usa PCs compartidas (ver docs/amenazas.md, A4).
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(1800),

  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${problems}`);
  }
  return result.data;
}
