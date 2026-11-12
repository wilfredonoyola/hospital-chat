import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sin índice en (department_id, created_at) a propósito: en la fase 5 se mide
 * con EXPLAIN ANALYZE antes y después de crearlo, con datos de volumen real.
 */
export class CreateMessages1794614400000 implements MigrationInterface {
  name = 'CreateMessages1794614400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE message_priority AS ENUM ('NORMAL', 'URGENT')`);
    await queryRunner.query(`
      CREATE TABLE messages (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        department_id uuid             NOT NULL,
        author_id     uuid             NOT NULL,
        body          text             NOT NULL,
        priority      message_priority NOT NULL DEFAULT 'NORMAL',
        created_at    timestamptz      NOT NULL DEFAULT now(),
        CONSTRAINT messages_department_fk
          FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT,
        CONSTRAINT messages_author_fk
          FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT,
        -- R3 también en la base: ningún camino (bug, script, SQL directo) guarda un mensaje vacío.
        CONSTRAINT messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE messages`);
    await queryRunner.query(`DROP TYPE message_priority`);
  }
}
