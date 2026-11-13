'use client';

import { useMarkSeen } from './queries';

interface SeenButtonProps {
  departmentId: string;
  messageId: string;
  /** Ya confirmado (viene de la API o de un clic anterior). */
  seen: boolean;
}

/** Botón "Lo vi": confirma la lectura de un mensaje de supervisor. */
export function SeenButton({ departmentId, messageId, seen }: SeenButtonProps) {
  const markSeen = useMarkSeen(departmentId);
  const done = seen || markSeen.isSuccess;

  return (
    <button
      type="button"
      className="message__button-see"
      disabled={done || markSeen.isPending}
      onClick={() => markSeen.mutate(messageId)}
    >
      {done ? 'Visto ✓' : markSeen.isError ? 'Reintentar' : 'Lo vi'}
    </button>
  );
}
