import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Escrita a mano: los CHECK, índices sobre expresiones y nombres de
 * restricciones no se pueden expresar en las entidades. Los nombres de
 * restricción importan: DatabaseExceptionFilter los traduce a mensajes claros.
 */
export class InitAuth1794528000000 implements MigrationInterface {
  name = 'InitAuth1794528000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('ADMIN', 'SUPERVISOR', 'STAFF')`);

    await queryRunner.query(`
      CREATE TABLE departments (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name        varchar(80)  NOT NULL,
        description varchar(255),
        is_active   boolean      NOT NULL DEFAULT true,
        created_at  timestamptz  NOT NULL DEFAULT now(),
        updated_at  timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT departments_name_not_blank CHECK (btrim(name) <> '')
      )`);
    // "UCI" y "uci" son la misma área.
    await queryRunner.query(
      `CREATE UNIQUE INDEX departments_name_unique ON departments (lower(name))`,
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name             varchar(120) NOT NULL,
        role                  user_role    NOT NULL,
        email                 varchar(254),
        password_hash         varchar(255),
        staff_code            varchar(12),
        pin_hash              varchar(255),
        is_active             boolean      NOT NULL DEFAULT true,
        failed_login_attempts smallint     NOT NULL DEFAULT 0,
        locked_until          timestamptz,
        token_version         integer      NOT NULL DEFAULT 0,
        created_at            timestamptz  NOT NULL DEFAULT now(),
        updated_at            timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT users_email_unique      UNIQUE (email),
        CONSTRAINT users_staff_code_unique UNIQUE (staff_code),
        -- Cada rol tiene exactamente su credencial, aunque el código tenga un bug.
        CONSTRAINT users_credentials_match_role CHECK (
          (role = 'ADMIN'
            AND email IS NOT NULL AND password_hash IS NOT NULL
            AND staff_code IS NULL AND pin_hash IS NULL)
          OR
          (role IN ('SUPERVISOR', 'STAFF')
            AND staff_code IS NOT NULL AND pin_hash IS NOT NULL
            AND email IS NULL AND password_hash IS NULL)
        ),
        CONSTRAINT users_staff_code_format CHECK (staff_code ~ '^[A-Z0-9]{3,12}$'),
        CONSTRAINT users_email_lowercase   CHECK (email = lower(email)),
        CONSTRAINT users_full_name_not_blank CHECK (btrim(full_name) <> ''),
        CONSTRAINT users_failed_attempts_non_negative CHECK (failed_login_attempts >= 0)
      )`);

    await queryRunner.query(`
      CREATE TABLE department_members (
        user_id       uuid NOT NULL,
        department_id uuid NOT NULL,
        PRIMARY KEY (user_id, department_id),
        CONSTRAINT department_members_user_fk
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        -- RESTRICT: un área con personal no se borra por accidente (se desactiva).
        CONSTRAINT department_members_department_fk
          FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT
      )`);
    // La PK cubre búsquedas por user_id; este índice cubre "quién está en el área X".
    await queryRunner.query(
      `CREATE INDEX department_members_department_idx ON department_members (department_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id    uuid,
        action      varchar(60) NOT NULL,
        entity_type varchar(40) NOT NULL,
        entity_id   uuid,
        metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
        ip          varchar(45),
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT audit_logs_actor_fk
          FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT
      )`);
    await queryRunner.query(
      `CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit_logs`);
    await queryRunner.query(`DROP TABLE department_members`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TABLE departments`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
