import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { Argon2PasswordHasher } from './common/password-hasher';
import { buildTypeOrmOptions } from './database/typeorm.options';
import { pinProblem } from './users/pin-policy';

/**
 * Datos iniciales. Idempotente: se puede correr las veces que haga falta sin
 * duplicar nada (ON CONFLICT DO NOTHING). Nunca sobrescribe datos existentes:
 * si el admin ya existe, su contraseña no se toca.
 *
 * Uso: npm run migration:run && npm run seed
 */

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.url(),
    ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    ADMIN_PASSWORD: z.string().min(12, 'ADMIN_PASSWORD debe tener al menos 12 caracteres'),
  })
  .parse(process.env);

const DEPARTMENTS = [
  { name: 'Emergencias', description: 'Atención de urgencias 24 horas' },
  { name: 'UCI', description: 'Unidad de cuidados intensivos' },
  { name: 'Farmacia', description: 'Dispensación y control de medicamentos' },
  { name: 'Laboratorio', description: 'Análisis clínicos' },
  { name: 'Pediatría', description: 'Hospitalización pediátrica' },
];

// Solo fuera de producción. PINs que cumplen la política (sin secuencias ni repetidos).
const DEMO_STAFF = [
  {
    code: 'SUP001',
    name: 'Carla Rivas',
    role: 'SUPERVISOR',
    pin: '7391',
    areas: ['Emergencias', 'UCI'],
  },
  { code: 'ENF001', name: 'Ana Martínez', role: 'STAFF', pin: '2580', areas: ['Emergencias'] },
  {
    code: 'ENF002',
    name: 'Luis Hernández',
    role: 'STAFF',
    pin: '4826',
    areas: ['UCI', 'Pediatría'],
  },
  { code: 'FAR001', name: 'Sofía Campos', role: 'STAFF', pin: '6153', areas: ['Farmacia'] },
];

async function seed() {
  const hasher = new Argon2PasswordHasher();
  const dataSource = await new DataSource(buildTypeOrmOptions(env.DATABASE_URL)).initialize();

  try {
    const adminHash = await hasher.hash(env.ADMIN_PASSWORD);
    const staff = await Promise.all(
      DEMO_STAFF.map(async (person) => {
        const problem = pinProblem(person.pin);
        if (problem) throw new Error(`PIN de ${person.code}: ${problem}`);
        return { ...person, pinHash: await hasher.hash(person.pin) };
      }),
    );

    await dataSource.transaction(async (manager) => {
      for (const department of DEPARTMENTS) {
        await manager.query(
          `INSERT INTO departments (name, description) VALUES ($1, $2)
           ON CONFLICT ((lower(name))) DO NOTHING`,
          [department.name, department.description],
        );
      }

      await manager.query(
        `INSERT INTO users (full_name, role, email, password_hash)
         VALUES ('Administrador', 'ADMIN', $1, $2)
         ON CONFLICT (email) DO NOTHING`,
        [env.ADMIN_EMAIL, adminHash],
      );

      if (env.NODE_ENV === 'production') {
        return;
      }

      for (const person of staff) {
        await manager.query(
          `INSERT INTO users (full_name, role, staff_code, pin_hash)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (staff_code) DO NOTHING`,
          [person.name, person.role, person.code, person.pinHash],
        );
        await manager.query(
          `INSERT INTO department_members (user_id, department_id)
           SELECT u.id, d.id FROM users u, departments d
            WHERE u.staff_code = $1 AND d.name = ANY($2)
           ON CONFLICT DO NOTHING`,
          [person.code, person.areas],
        );
      }
    });

    console.log(`Seed listo: ${DEPARTMENTS.length} áreas, admin ${env.ADMIN_EMAIL}`);
    if (env.NODE_ENV !== 'production') {
      console.table(DEMO_STAFF.map(({ code, name, role, pin }) => ({ code, name, role, pin })));
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
