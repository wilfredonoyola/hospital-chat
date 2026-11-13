import type { MessageView } from '@hospital-chat/shared';
import type { InfiniteData } from '@tanstack/react-query';

/** Mensaje en pantalla: puede ser optimista (aún sin confirmar por el servidor). */
export type ChatMessage = MessageView & { pending?: boolean };

/** Página del canal en la caché (misma forma que MessagePage, con mensajes optimistas). */
export interface ChatPage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export type ChannelCache = InfiniteData<ChatPage, string | null>;

const newestFirst = (a: ChatMessage, b: ChatMessage) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/**
 * Agrega un mensaje sin duplicarlo. El mismo mensaje puede llegar dos veces:
 * por la respuesta del POST y por el evento del socket, en cualquier orden.
 */
export function addMessage(list: ChatMessage[] = [], message: ChatMessage): ChatMessage[] {
  if (list.some((existing) => existing.id === message.id)) {
    return list;
  }
  return [...list, message].sort(newestFirst);
}

/**
 * Reemplaza el mensaje optimista por el confirmado. Si el socket ya trajo el
 * confirmado, solo se quita el optimista.
 */
export function confirmMessage(
  list: ChatMessage[] = [],
  tempId: string,
  confirmed: MessageView,
): ChatMessage[] {
  return addMessage(
    list.filter((message) => message.id !== tempId),
    confirmed,
  );
}

export function removeMessage(list: ChatMessage[] = [], id: string): ChatMessage[] {
  return list.filter((message) => message.id !== id);
}

/**
 * Los mensajes nuevos (enviados o recibidos por socket) siempre van a la
 * página más reciente: pages[0]. Las páginas anteriores no cambian.
 */
export function updateNewestPage(
  cache: ChannelCache | undefined,
  update: (items: ChatMessage[]) => ChatMessage[],
): ChannelCache | undefined {
  if (!cache?.pages.length) {
    return cache;
  }
  const [newest, ...older] = cache.pages;
  return { ...cache, pages: [{ ...newest, items: update(newest.items) }, ...older] };
}

/**
 * Marca "Lo vi" en la caché. A diferencia de los mensajes nuevos, el
 * confirmado puede estar en cualquier página, así que se recorren todas.
 */
export function markSeenInCache(
  cache: ChannelCache | undefined,
  messageId: string,
): ChannelCache | undefined {
  if (!cache) {
    return cache;
  }
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      items: page.items.map((message) =>
        message.id === messageId ? { ...message, seenByMe: true } : message,
      ),
    })),
  };
}

/** Todos los mensajes cargados, del más reciente al más antiguo. */
export function flattenPages(cache: ChannelCache | undefined): ChatMessage[] {
  return cache?.pages.flatMap((page) => page.items) ?? [];
}
