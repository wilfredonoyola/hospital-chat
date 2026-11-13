import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env';

async function bootstrap() {
  // bufferLogs: los logs de arranque esperan a que pino esté listo, así también salen en JSON.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = app.get(ConfigService<Env, true>);

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Hospital Chat API').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
