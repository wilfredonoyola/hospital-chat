'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/session-store';
import type { ChatMessage } from './messages-cache';
import { MessageItem } from './MessageItem';

/** Distancia al fondo (px) a partir de la cual se considera que el usuario está leyendo arriba. */
const NEAR_BOTTOM_PX = 80;

/**
 * La caché guarda del más reciente al más antiguo; en pantalla se lee de
 * arriba abajo. Solo baja sola si el usuario ya estaba abajo o si el mensaje
 * es suyo: si estaba leyendo mensajes anteriores, no le mueve la pantalla y
 * le avisa que hay nuevos.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const userId = useSession((state) => state.user?.id);
  const listRef = useRef<HTMLOListElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [unseen, setUnseen] = useState(false);
  const ordered = [...messages].reverse();
  // Se compara por id (no por objeto): una recarga trae objetos nuevos con los mismos mensajes.
  const newestId = messages[0]?.id;
  const newestIsMine = messages[0]?.author.id === userId;
  const hasMessages = messages.length > 0;

  // El contenedor con scroll es el padre de la lista (.channel__body).
  useEffect(() => {
    const container = listRef.current?.parentElement;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      nearBottomRef.current = distance < NEAR_BOTTOM_PX;
      if (nearBottomRef.current) setUnseen(false);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
    // Se registra cuando la lista existe: si el canal empezó vacío, no había contenedor.
  }, [hasMessages]);

  useLayoutEffect(() => {
    if (!newestId) return;
    if (nearBottomRef.current || newestIsMine) {
      endRef.current?.scrollIntoView({ block: 'end' });
    } else {
      setUnseen(true);
    }
  }, [newestId, newestIsMine]);

  if (!hasMessages) {
    return <p className="empty">Todavía no hay mensajes en esta área.</p>;
  }

  return (
    <>
      <ol ref={listRef} className="messages" aria-live="polite" aria-relevant="additions">
        {ordered.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </ol>
      {unseen && (
        <button
          type="button"
          className="new-messages"
          onClick={() => {
            endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            setUnseen(false);
          }}
        >
          Mensajes nuevos ↓
        </button>
      )}
    </>
  );
}
