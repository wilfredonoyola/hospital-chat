import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Argon2PasswordHasher } from '../src/common/password-hasher';

export interface TestContext {
  app: INestApplication<App>;
  db: DataSource;
  http: () => ReturnType<typeof request>;
  /** URL base cuando la app escucha en un puerto real (necesario para Socket.IO). */
  url: string;
}

/** Levanta la app real (mismos módulos y configuración HTTP que producción) contra la base de pruebas. */
export async function createTestApp(options: { listen?: boolean } = {}): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  let url = '';
  if (options.listen) {
    await app.listen(0, '127.0.0.1');
    url = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  } else {
    await app.init();
  }

  const db = app.get(DataSource);
  await db.runMigrations();
  await resetDatabase(db);

  return { app, db, url, http: () => request(app.getHttpServer()) };
}

export async function resetDatabase(db: DataSource): Promise<void> {
  await db.query(
    'TRUNCATE messages, audit_logs, department_members, users, departments RESTART IDENTITY CASCADE',
  );
}

const hasher = new Argon2PasswordHasher();

export async function createDepartment(db: DataSource, name: string): Promise<string> {
  const [row] = await db.query<Array<{ id: string }>>(
    'INSERT INTO departments (name) VALUES ($1) RETURNING id',
    [name],
  );
  return row.id;
}

export async function createStaff(
  db: DataSource,
  data: { code: string; pin: string; role?: 'STAFF' | 'SUPERVISOR'; departmentIds?: string[] },
): Promise<string> {
  const [row] = await db.query<Array<{ id: string }>>(
    `INSERT INTO users (full_name, role, staff_code, pin_hash)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [`Persona ${data.code}`, data.role ?? 'STAFF', data.code, await hasher.hash(data.pin)],
  );
  for (const departmentId of data.departmentIds ?? []) {
    await db.query('INSERT INTO department_members (user_id, department_id) VALUES ($1, $2)', [
      row.id,
      departmentId,
    ]);
  }
  return row.id;
}

export async function createAdmin(
  db: DataSource,
  email: string,
  password: string,
): Promise<string> {
  const [row] = await db.query<Array<{ id: string }>>(
    `INSERT INTO users (full_name, role, email, password_hash)
     VALUES ('Admin', 'ADMIN', $1, $2) RETURNING id`,
    [email, await hasher.hash(password)],
  );
  return row.id;
}

export async function loginStaff(
  ctx: TestContext,
  staffCode: string,
  pin: string,
): Promise<string> {
  const response = await ctx.http().post('/auth/staff/login').send({ staffCode, pin }).expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

export async function loginAdmin(
  ctx: TestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await ctx.http().post('/auth/admin/login').send({ email, password }).expect(200);
  return (response.body as { accessToken: string }).accessToken;
}
