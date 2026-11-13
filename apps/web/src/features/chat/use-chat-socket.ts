'use client';

import type { ClientToServerEvents, JoinResult, ServerToClientEvents } from '@hospital-chat/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { useSession } from '@/lib/session-store';
import { addMessage, updateNewestPage, type ChannelCache } from './messages-cache';
import { queryKeys } from './queries';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ChatSocketState {
  status: ConnectionStatus;
  /** Si unirse a la sala del área falló, el motivo; los mensajes no llegarían en tiempo real. */
  joinError: string | null;
}

/**
 * Socket del chat: solo recibe. Los mensajes nuevos entran a la caché de
 * TanStack Query con setQueryData, deduplicados por id. Al reconectar se
 * vuelve a leer por HTTP lo que pudo llegar mientras no había conexión.
 */
export function useChatSocket(departmentId: string | null): ChatSocketState {
  const token = useSession((state) => state.token);
  const signOut = useSession((state) => state.signOut);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [joinError, setJoinError] = useState<string | null>(null);
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
        void joinRoom(socket, departmentRef.current, setJoinError);
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
      // Si el canal aún no se cargó, updateNewestPage no crea una caché parcial: se leerá por HTTP.
      queryClient.setQueryData<ChannelCache>(queryKeys.messages(message.departmentId), (old) =>
        updateNewestPage(old, (items) => addMessage(items, message)),
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
      void joinRoom(socket, departmentId, setJoinError);
    }
  }, [departmentId]);

  return { status, joinError };
}

async function joinRoom(
  socket: ChatSocket,
  departmentId: string,
  setJoinError: (message: string | null) => void,
): Promise<void> {
  const result: JoinResult = await socket.emitWithAck('department:join', { departmentId });
  setJoinError(result.ok ? null : result.message);
}
