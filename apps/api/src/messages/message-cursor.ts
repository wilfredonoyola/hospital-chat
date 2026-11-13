import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Cursor opaco para paginar hacia atrás: la posición del último mensaje de la
 * página (fecha exacta + id como desempate). La fecha va como texto de
 * Postgres para conservar los microsegundos, que un Date de JavaScript pierde.
 *
 * Por qué cursor y no OFFSET: con OFFSET la base lee y descarta todas las
 * filas anteriores (más lento cuanto más atrás), y si llegan mensajes nuevos
 * entre páginas, se repiten o se saltan mensajes.
 */
export interface MessageCursor {
  createdAt: string;
  id: string;
}

const PG_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;

export function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString('base64url');
}

export function decodeCursor(value: string): MessageCursor {
  const [createdAt, id, ...rest] = Buffer.from(value, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !createdAt || !PG_TIMESTAMP.test(createdAt) || !id || !isUUID(id)) {
    throw new BadRequestException('Cursor inválido');
  }
  return { createdAt, id };
}
