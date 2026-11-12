import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Env } from './config/env';

/**
 * Configuración HTTP de la app. Vive aparte de main.ts para que las pruebas
 * e2e levanten exactamente la misma app que corre en producción, no una copia
 * que se desincroniza con el tiempo.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });
  app.enableShutdownHooks();

  // whitelist + forbidNonWhitelisted: cualquier campo que no esté en el DTO
  // se rechaza con 400 (evita mass assignment, p. ej. mandar "role": "ADMIN").
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
