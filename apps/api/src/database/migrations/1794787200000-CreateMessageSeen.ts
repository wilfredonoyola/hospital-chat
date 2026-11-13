import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Confirmaciones de lectura ("Lo vi"). La llave primaria (message_id, user_id)
 * impide confirmar dos veces y además sirve de índice para buscar por mensaje.
 */
export class CreateMessageSeen1794787200000 implements MigrationInterface {
  name = 'CreateMessageSeen1794787200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE message_seen (
        message_id uuid        NOT NULL,
        user_id    uuid        NOT NULL,
        seen_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT message_seen_pk PRIMARY KEY (message_id, user_id),
        CONSTRAINT message_seen_message_fk
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
        CONSTRAINT message_seen_user_fk
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE message_seen`);
  }
}
