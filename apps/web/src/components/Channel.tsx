'use client';

import type { Role } from '@hospital-chat/shared';
import { useMessages, useSendMessage } from '@/lib/queries';
import { Composer } from './Composer';
import { MessageList } from './MessageList';

export function Channel({
  departmentId,
  name,
  role,
}: {
  departmentId: string;
  name: string;
  role: Role;
}) {
  const messages = useMessages(departmentId);
  const send = useSendMessage(departmentId);

  return (
    <section className="channel" aria-label={`Canal de ${name}`}>
      <header className="channel__header">
        <h2>{name}</h2>
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
