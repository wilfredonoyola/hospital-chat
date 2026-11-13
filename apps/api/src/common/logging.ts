import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Un id que llega de afuera se acepta solo si tiene forma razonable: evita inyectar basura en los logs. */
const VALID_REQUEST_ID = /^[\w.-]{8,128}$/;

export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

/** Campos que nunca deben quedar en un log, aunque alguien registre un objeto completo. */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'pin',
  'password',
  'accessToken',
  'token',
  '*.pin',
  '*.password',
  '*.accessToken',
  '*.token',
];

/**
 * Logs JSON de una línea por evento, listos para buscarse en Application
 * Insights / Log Analytics. Cada petición lleva un correlation id que aparece
 * en todos sus logs y vuelve al cliente en X-Request-Id: un usuario reporta
 * un error con ese id y se encuentra todo lo que pasó en esa petición.
 */
export function buildLoggerParams(env: Pick<Env, 'LOG_LEVEL'>): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
        res.setHeader('X-Request-Id', id);
        return id;
      },
      redact: { paths: REDACTED_PATHS, censor: '[redactado]' },
      // El balanceador llama a /health cada pocos segundos: sería puro ruido.
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Solo lo necesario de la petición: sin headers ni cuerpos.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
