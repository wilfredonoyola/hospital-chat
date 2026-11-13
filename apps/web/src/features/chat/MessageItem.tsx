import type { ChatMessage } from '@/features/chat/messages-cache';
import { Avatar } from './Avatar';
import { SeenButton } from './SeenButton';

const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

const ROLE_LABEL = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', STAFF: 'Personal' } as const;

interface MessageItemProps {
  message: ChatMessage;
  /** Los mensajes propios se alinean a la derecha. */
  isMine?: boolean;
}

export function MessageItem({ message, isMine = false }: MessageItemProps) {
  const urgent = message.priority === 'URGENT';
  // Los mensajes de un supervisor piden confirmación de lectura a los demás (no a quien lo envió).
  const canAcknowledge = message.author.role === 'SUPERVISOR' && !isMine;
  const classes = [
    'message',
    urgent && 'message--urgent',
    message.pending && 'message--pending',
    isMine && 'message--mine',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={classes}
      aria-label={urgent ? `Mensaje urgente de ${message.author.fullName}` : undefined}
    >
      {!isMine && <Avatar id={message.author.id} fullName={message.author.fullName} />}
      <div className="message__bubble">
        {urgent && (
          <div className="message__urgent-banner">
            <span aria-hidden="true">⚠</span>
            <span className="badge badge--urgent">Urgente</span>
          </div>
        )}
        <div className="message__meta">
          <span className="message__author">{isMine ? 'Tú' : message.author.fullName}</span>
          <span className="message__role">{ROLE_LABEL[message.author.role]}</span>
          <time dateTime={message.createdAt}>
            {message.pending ? 'Enviando…' : time.format(new Date(message.createdAt))}
          </time>
        </div>
        {/* React escapa el texto: un mensaje con HTML se muestra, no se ejecuta. */}
        <p className="message__body">{message.body}</p>
        {isMine && message.author.role === 'SUPERVISOR' && !message.pending && (
          <p className="message__seen-count">
            {message.seenCount === 0 ? 'Nadie lo ha visto aún' : `Visto por ${message.seenCount}`}
          </p>
        )}
        {canAcknowledge && (
          <div className="message__actions">
            <SeenButton
              departmentId={message.departmentId}
              messageId={message.id}
              seen={message.seenByMe}
            />
          </div>
        )}
      </div>
    </li>
  );
}
