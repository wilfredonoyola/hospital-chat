'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/messages-cache';
import { MessageItem } from './MessageItem';

/** La caché guarda del más reciente al más antiguo; en pantalla se lee de arriba abajo. */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const ordered = [...messages].reverse();
  const newestId = messages[0]?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [newestId]);

  if (messages.length === 0) {
    return <p className="empty">Todavía no hay mensajes en esta área.</p>;
  }

  return (
    <ol className="messages" aria-live="polite" aria-relevant="additions">
      {ordered.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </ol>
  );
}
