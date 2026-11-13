import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { CorsIoAdapter } from './common/cors-io.adapter';
import { DatabaseExceptionFilter } from './common/database-exception.filter';
import { Env } from './config/env';

/**
 * Configuración HTTP de la app. Vive aparte de main.ts para que las pruebas
 * e2e levanten exactamente la misma app que corre en producción, no una copia
 * que se desincroniza con el tiempo.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  // Todos los logs de Nest (incluidos los de arranque) salen por pino en JSON.
  app.useLogger(app.get(Logger));

  // Detrás de App Service / Front Door, req.ip debe ser la IP del cliente
  // (X-Forwarded-For) y no la del balanceador: de eso dependen el rate limit
  // y la IP que se guarda en la auditoría.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy > 0) {
    (app as NestExpressApplication).set('trust proxy', trustProxy);
  }

  app.use(helmet());
  const origins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({ origin: origins });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.enableShutdownHooks();

  // whitelist + forbidNonWhitelisted: cualquier campo que no esté en el DTO
  // se rechaza con 400 (evita mass assignment, p. ej. mandar "role": "ADMIN").
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DatabaseExceptionFilter());
}
