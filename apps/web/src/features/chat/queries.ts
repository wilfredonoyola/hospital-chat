'use client';

import type { MessageView, SendMessageRequest, UserProfile } from '@hospital-chat/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { addMessage, confirmMessage, removeMessage, type ChatMessage } from './messages-cache';
import { useSession } from '@/lib/session-store';

export const queryKeys = {
  profile: ['profile'] as const,
  messages: (departmentId: string) => ['messages', departmentId] as const,
};

export function useProfile() {
  const token = useSession((state) => state.token);
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiFetch<UserProfile>('/auth/me'),
    enabled: !!token,
  });
}

export function useMessages(departmentId: string) {
  return useQuery({
    queryKey: queryKeys.messages(departmentId),
    queryFn: () => apiFetch<MessageView[]>(`/departments/${departmentId}/messages?limit=50`),
  });
}

/**
 * Envío con actualización optimista: el mensaje aparece al instante como
 * "enviando" y se reemplaza por el confirmado. Si falla, se quita y el
 * componente recupera el texto para no perderlo.
 */
export function useSendMessage(departmentId: string) {
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const key = queryKeys.messages(departmentId);

  return useMutation({
    mutationFn: (request: SendMessageRequest) =>
      apiFetch<MessageView>(`/departments/${departmentId}/messages`, {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    onMutate: async (request) => {
      // Cancela lecturas en curso para que no pisen el optimista.
      await queryClient.cancelQueries({ queryKey: key });
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        departmentId,
        body: request.body.trim(),
        priority: request.priority ?? 'NORMAL',
        createdAt: new Date().toISOString(),
        author: { id: user?.id ?? '', fullName: user?.fullName ?? '', role: user?.role ?? 'STAFF' },
        pending: true,
      };
      queryClient.setQueryData<ChatMessage[]>(key, (old) => addMessage(old, optimistic));
      return { tempId };
    },
    onSuccess: (confirmed, _request, context) => {
      queryClient.setQueryData<ChatMessage[]>(key, (old) =>
        confirmMessage(old, context.tempId, confirmed),
      );
    },
    onError: (_error, _request, context) => {
      if (context) {
        queryClient.setQueryData<ChatMessage[]>(key, (old) => removeMessage(old, context.tempId));
      }
    },
  });
}
