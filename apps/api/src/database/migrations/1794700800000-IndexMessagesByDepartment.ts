import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice para leer el canal de un área: filtra por department_id y ya viene
 * ordenado como lo pide la consulta (created_at DESC, id DESC), así Postgres
 * lee solo las filas de la página en lugar de recorrer y ordenar el área.
 * Medición antes y después: docs/rendimiento/fase-5-indice-mensajes.md
 *
 * CONCURRENTLY: no bloquea las escrituras mientras se construye (en
 * producción la tabla sigue recibiendo mensajes). No puede correr dentro de
 * una transacción, por eso transaction = false.
 */
export class IndexMessagesByDepartment1794700800000 implements MigrationInterface {
  name = 'IndexMessagesByDepartment1794700800000';
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_department_created_idx
         ON messages (department_id, created_at DESC, id DESC)`,
    );
  }

  /**
   * Sin CONCURRENTLY: TypeORM siempre envuelve el revert en una transacción
   * (ignora transaction = false al deshacer) y DROP INDEX CONCURRENTLY no
   * puede correr dentro de una. Borrar un índice es casi instantáneo; el lock
   * es breve. Si la tabla estuviera muy cargada, se revierte a mano con
   * DROP INDEX CONCURRENTLY y se borra la fila de la tabla migrations.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS messages_department_created_idx`);
  }
}
