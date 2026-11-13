import type { MessageView } from '@hospital-chat/shared';
import {
  addMessage,
  confirmMessage,
  flattenPages,
  removeMessage,
  updateNewestPage,
  type ChannelCache,
  type ChatMessage,
} from './messages-cache';

function message(id: string, createdAt: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    departmentId: 'emergencias',
    body: `mensaje ${id}`,
    priority: 'NORMAL',
    createdAt,
    author: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
    ...extra,
  };
}

describe('caché de mensajes', () => {
  it('ordena del más reciente al más antiguo', () => {
    let list = addMessage([], message('a', '2026-11-12T08:00:00.000Z'));
    list = addMessage(list, message('c', '2026-11-12T08:02:00.000Z'));
    list = addMessage(list, message('b', '2026-11-12T08:01:00.000Z'));

    expect(list.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('no duplica un mensaje que llega por HTTP y por el socket', () => {
    const fromSocket = message('m1', '2026-11-12T08:00:00.000Z');
    const list = addMessage(addMessage([], fromSocket), { ...fromSocket });

    expect(list).toHaveLength(1);
  });

  it('reemplaza el optimista por el confirmado', () => {
    const optimistic = message('temp-1', '2026-11-12T08:00:00.000Z', { pending: true });
    const confirmed: MessageView = message('m1', '2026-11-12T08:00:01.000Z');

    const list = confirmMessage([optimistic], 'temp-1', confirmed);

    expect(list).toEqual([confirmed]);
  });

  it('si el socket llegó antes que la respuesta del POST, no queda duplicado', () => {
    const optimistic = message('temp-1', '2026-11-12T08:00:00.000Z', { pending: true });
    const confirmed = message('m1', '2026-11-12T08:00:01.000Z');
    const afterSocket = addMessage([optimistic], confirmed);

    const list = confirmMessage(afterSocket, 'temp-1', confirmed);

    expect(list.map((m) => m.id)).toEqual(['m1']);
  });

  it('quita un optimista que falló', () => {
    const list = removeMessage([message('temp-1', '2026-11-12T08:00:00.000Z')], 'temp-1');

    expect(list).toEqual([]);
  });

  describe('caché paginada', () => {
    const cache: ChannelCache = {
      pages: [
        { items: [message('m3', '2026-11-12T08:03:00.000Z')], nextCursor: 'c1' },
        { items: [message('m1', '2026-11-12T08:01:00.000Z')], nextCursor: null },
      ],
      pageParams: [null, 'c1'],
    };

    it('un mensaje nuevo va a la página más reciente y no toca las anteriores', () => {
      const updated = updateNewestPage(cache, (items) =>
        addMessage(items, message('m4', '2026-11-12T08:04:00.000Z')),
      );

      expect(updated?.pages[0].items.map((m) => m.id)).toEqual(['m4', 'm3']);
      expect(updated?.pages[1]).toBe(cache.pages[1]);
      expect(updated?.pageParams).toBe(cache.pageParams);
    });

    it('no crea caché si el canal no se cargó', () => {
      expect(updateNewestPage(undefined, (items) => items)).toBeUndefined();
    });

    it('aplana las páginas del más reciente al más antiguo', () => {
      expect(flattenPages(cache).map((m) => m.id)).toEqual(['m3', 'm1']);
    });
  });
});
