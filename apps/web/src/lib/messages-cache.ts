import type { MessageView } from '@hospital-chat/shared';

/** Mensaje en pantalla: puede ser optimista (aún sin confirmar por el servidor). */
export type ChatMessage = MessageView & { pending?: boolean };

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
