'use client';

import type { Role } from '@hospital-chat/shared';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useMessages, useSendMessage } from './queries';

interface ChannelProps {
  departmentId: string;
  name: string;
  role: Role;
  /** Si el socket no pudo unirse al área, los mensajes nuevos no llegarán solos. */
  realtimeError: string | null;
}

export function Channel({ departmentId, name, role, realtimeError }: ChannelProps) {
  const messages = useMessages(departmentId);
  const send = useSendMessage(departmentId);

  return (
    <section className="channel" aria-label={`Canal de ${name}`}>
      <header className="channel__header">
        <h2>{name}</h2>
        {realtimeError && (
          <p role="status" className="channel__warning">
            Sin tiempo real en esta área ({realtimeError}). Recarga la página para ver mensajes
            nuevos.
          </p>
        )}
      </header>
      <div className="channel__body">
        {messages.isPending && <p className="empty">Cargando mensajes…</p>}
        {messages.isError && (
          <p role="alert" className="empty">
            No se pudieron cargar los mensajes. {messages.error.message}
          </p>
        )}
        {messages.data && <MessageList messages={messages.data} />}
      </div>
      <Composer departmentId={departmentId} role={role} onSend={send.mutateAsync} />
    </section>
  );
}
