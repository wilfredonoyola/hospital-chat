import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './message-cursor';

describe('cursor de mensajes', () => {
  const cursor = {
    createdAt: '2026-11-12 18:03:00.123456-06',
    id: '5e2e8b12-2110-4581-8fce-16e85531519b',
  };

  it('ida y vuelta conserva los microsegundos', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('es opaco: no expone la estructura en la URL', () => {
    expect(encodeCursor(cursor)).toMatch(/^[\w-]+$/);
  });

  it.each([
    ['basura', 'no-es-un-cursor'],
    ['fecha inválida', Buffer.from(`ayer|${cursor.id}`).toString('base64url')],
    ['id inválido', Buffer.from(`${cursor.createdAt}|123`).toString('base64url')],
    [
      'inyección',
      Buffer.from(`${cursor.createdAt}'; DROP TABLE messages;--|${cursor.id}`).toString(
        'base64url',
      ),
    ],
    ['partes de más', Buffer.from(`${cursor.createdAt}|${cursor.id}|x`).toString('base64url')],
  ])('rechaza un cursor con %s', (_case, value) => {
    expect(() => decodeCursor(value)).toThrow(BadRequestException);
  });
});
