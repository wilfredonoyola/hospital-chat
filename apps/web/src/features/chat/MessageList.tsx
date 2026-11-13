'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/session-store';
import type { ChatMessage } from './messages-cache';
import { MessageItem } from './MessageItem';

/** Distancia al fondo (px) a partir de la cual se considera que el usuario está leyendo arriba. */
const NEAR_BOTTOM_PX = 80;

interface MessageListProps {
  /** Del más reciente al más antiguo (como vienen de la caché). */
  messages: ChatMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

/**
 * En pantalla se lee de arriba abajo. Solo baja sola si el usuario ya estaba
 * abajo o si el mensaje es suyo; si estaba leyendo mensajes anteriores, no le
 * mueve la pantalla y le avisa que hay nuevos. Al cargar mensajes anteriores
 * arriba, conserva la posición de lectura.
 */
export function MessageList({ messages, hasOlder, loadingOlder, onLoadOlder }: MessageListProps) {
  const userId = useSession((state) => state.user?.id);
  const listRef = useRef<HTMLOListElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  /** Alto del contenido antes de cargar mensajes anteriores, para compensar el scroll. */
  const heightBeforeLoadRef = useRef<number | null>(null);
  const [unseen, setUnseen] = useState(false);
  const ordered = [...messages].reverse();
  // Se compara por id (no por objeto): una recarga trae objetos nuevos con los mismos mensajes.
  const newestId = messages[0]?.id;
  const newestIsMine = messages[0]?.author.id === userId;
  const oldestId = messages.at(-1)?.id;
  const hasMessages = messages.length > 0;
  const container = () => listRef.current?.parentElement ?? null;

  // El contenedor con scroll es el padre de la lista (.channel__body).
  useEffect(() => {
    const element = container();
    if (!element) return;
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      nearBottomRef.current = distance < NEAR_BOTTOM_PX;
      if (nearBottomRef.current) setUnseen(false);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
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

  // Al llegar mensajes anteriores arriba, se compensa el scroll para que el
  // usuario siga viendo lo mismo en lugar de saltar.
  useLayoutEffect(() => {
    const element = container();
    if (element && heightBeforeLoadRef.current !== null) {
      element.scrollTop += element.scrollHeight - heightBeforeLoadRef.current;
      heightBeforeLoadRef.current = null;
    }
  }, [oldestId]);

  if (!hasMessages) {
    return <p className="empty">Todavía no hay mensajes en esta área.</p>;
  }

  return (
    <>
      <ol ref={listRef} className="messages" aria-live="polite" aria-relevant="additions">
        {hasOlder && (
          <li className="load-older">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={() => {
                heightBeforeLoadRef.current = container()?.scrollHeight ?? null;
                onLoadOlder();
              }}
            >
              {loadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores'}
            </button>
          </li>
        )}
        {ordered.map((message) => (
          <MessageItem key={message.id} message={message} isMine={message.author.id === userId} />
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
