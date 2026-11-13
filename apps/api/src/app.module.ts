import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { buildLoggerParams } from './common/logging';
import { Env, validateEnv } from './config/env';
import { buildTypeOrmOptions } from './database/typeorm.options';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildLoggerParams({ LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }) }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        buildTypeOrmOptions(config.get('DATABASE_URL', { infer: true })),
    }),
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    MessagesModule,
    HealthModule,
  ],
})
export class AppModule {}
