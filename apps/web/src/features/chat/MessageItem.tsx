import type { ChatMessage } from '@/features/chat/messages-cache';

const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

const ROLE_LABEL = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', STAFF: 'Personal' } as const;

export function MessageItem({ message }: { message: ChatMessage }) {
  const urgent = message.priority === 'URGENT';

  return (
    <li
      className={`message${urgent ? ' message--urgent' : ''}${message.pending ? ' message--pending' : ''}`}
      aria-label={urgent ? `Mensaje urgente de ${message.author.fullName}` : undefined}
    >
      <div className="message__meta">
        <span className="message__author">{message.author.fullName}</span>
        <span className="message__role">{ROLE_LABEL[message.author.role]}</span>
        {urgent && <span className="badge badge--urgent">Urgente</span>}
        <time dateTime={message.createdAt}>
          {message.pending ? 'Enviando…' : time.format(new Date(message.createdAt))}
        </time>
      </div>
      {/* React escapa el texto: un mensaje con HTML se muestra, no se ejecuta. */}
      <p className="message__body">{message.body}</p>
    </li>
  );
}
