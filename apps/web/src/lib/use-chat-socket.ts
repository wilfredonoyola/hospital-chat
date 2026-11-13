'use client';

import type { ClientToServerEvents, ServerToClientEvents } from '@hospital-chat/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';
import { addMessage, type ChatMessage } from './messages-cache';
import { queryKeys } from './queries';
import { useSession } from './session-store';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Socket del chat: solo recibe. Los mensajes nuevos entran a la caché de
 * TanStack Query con setQueryData, deduplicados por id. Al reconectar se
 * vuelve a leer por HTTP lo que pudo llegar mientras no había conexión.
 */
export function useChatSocket(departmentId: string | null): ConnectionStatus {
  const token = useSession((state) => state.token);
  const signOut = useSession((state) => state.signOut);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<ChatSocket | null>(null);
  const departmentRef = useRef(departmentId);

  useEffect(() => {
    if (!token) {
      return;
    }
    const socket: ChatSocket = io(`${API_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    let connectedBefore = false;

    socket.on('connect', () => {
      setStatus('online');
      if (departmentRef.current) {
        void socket.emitWithAck('department:join', { departmentId: departmentRef.current });
      }
      if (connectedBefore) {
        // Reconexión: lo que se perdió mientras tanto se recupera por HTTP.
        void queryClient.invalidateQueries({ queryKey: ['messages'] });
      }
      connectedBefore = true;
    });
    socket.on('disconnect', () => setStatus('offline'));
    socket.on('connect_error', (error) => {
      setStatus('offline');
      if (error.message === 'Sesión inválida') {
        signOut();
      }
    });
    socket.on('session:invalid', () => signOut());
    socket.on('message:new', (message) => {
      queryClient.setQueryData<ChatMessage[]>(queryKeys.messages(message.departmentId), (old) =>
        // Si el canal aún no se cargó, no se crea una caché parcial: se leerá completo por HTTP.
        old ? addMessage(old, message) : old,
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, signOut, queryClient]);

  useEffect(() => {
    const socket = socketRef.current;
    const previous = departmentRef.current;
    departmentRef.current = departmentId;
    if (!socket?.connected) {
      return;
    }
    if (previous && previous !== departmentId) {
      void socket.emitWithAck('department:leave', { departmentId: previous });
    }
    if (departmentId) {
      void socket.emitWithAck('department:join', { departmentId });
    }
  }, [departmentId]);

  return status;
}
