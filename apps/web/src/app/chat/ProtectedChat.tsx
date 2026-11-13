'use client';

import { SessionGuard } from '@/features/auth/SessionGuard';
import { ChatScreen } from '@/features/chat/ChatScreen';

/**
 * La capa app/ es la única que compone features entre sí: el chat queda
 * protegido por el guard de auth sin que una feature importe a la otra.
 */
export function ProtectedChat() {
  return (
    <SessionGuard>
      <ChatScreen />
    </SessionGuard>
  );
}
