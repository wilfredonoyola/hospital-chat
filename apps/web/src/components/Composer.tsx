'use client';

import type { MessagePriority, Role, SendMessageRequest } from '@hospital-chat/shared';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useChatStore } from '@/lib/chat-store';

interface ComposerProps {
  departmentId: string;
  role: Role;
  onSend: (request: SendMessageRequest) => Promise<unknown>;
}

export function Composer({ departmentId, role, onSend }: ComposerProps) {
  const draft = useChatStore((state) => state.drafts[departmentId] ?? '');
  const setDraft = useChatStore((state) => state.setDraft);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSendUrgent = role === 'SUPERVISOR';
  const empty = draft.trim().length === 0;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (empty) {
      return;
    }
    const body = draft;
    const priority: MessagePriority = urgent ? 'URGENT' : 'NORMAL';
    setError(null);
    setDraft(departmentId, '');
    setUrgent(false);
    try {
      await onSend({ body, priority });
    } catch (sendError) {
      // Si falla, se devuelve el texto para que no se pierda.
      setDraft(departmentId, body);
      setError(sendError instanceof Error ? sendError.message : 'No se pudo enviar');
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className="composer" onSubmit={(event) => void submit(event)}>
      {error && (
        <p role="alert" className="composer__error">
          {error}
        </p>
      )}
      <textarea
        aria-label="Mensaje"
        placeholder="Escribe un mensaje… (Enter envía, Shift+Enter salta de línea)"
        value={draft}
        maxLength={2000}
        rows={2}
        onChange={(event) => setDraft(departmentId, event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer__actions">
        {canSendUrgent && (
          <label className="composer__urgent">
            <input
              type="checkbox"
              checked={urgent}
              onChange={(event) => setUrgent(event.target.checked)}
            />
            Urgente
          </label>
        )}
        <button type="submit" disabled={empty}>
          Enviar
        </button>
      </div>
    </form>
  );
}
