'use client';

import type {
  MessagePage,
  MessageSeenView,
  MessageView,
  SendMessageRequest,
  UserProfile,
} from '@hospital-chat/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  addMessage,
  confirmMessage,
  markSeenInCache,
  removeMessage,
  updateNewestPage,
  type ChannelCache,
  type ChatMessage,
  type ChatPage,
} from './messages-cache';
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

/**
 * Canal paginado por cursor: la primera página son los más recientes y
 * fetchNextPage trae los anteriores (`before`). Ver docs/rendimiento/.
 */
export function useMessages(departmentId: string) {
  return useInfiniteQuery<
    ChatPage,
    Error,
    ChannelCache,
    ReturnType<typeof queryKeys.messages>,
    string | null
  >({
    queryKey: queryKeys.messages(departmentId),
    queryFn: ({ pageParam }) =>
      apiFetch<MessagePage>(
        `/departments/${departmentId}/messages?limit=50${pageParam ? `&before=${pageParam}` : ''}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/** "Lo vi" en un mensaje de supervisor. La API no falla si se confirma dos veces. */
export function useMarkSeen(departmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch<MessageSeenView>(`/departments/${departmentId}/messages/${messageId}/seen`, {
        method: 'POST',
      }),
    // Se guarda en la caché: el "Visto ✓" sigue ahí al cambiar de área y volver.
    onSuccess: (_seen, messageId) => {
      queryClient.setQueryData<ChannelCache>(queryKeys.messages(departmentId), (old) =>
        markSeenInCache(old, messageId),
      );
    },
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
        seenByMe: false,
        seenCount: 0,
        pending: true,
      };
      queryClient.setQueryData<ChannelCache>(key, (old) =>
        updateNewestPage(old, (items) => addMessage(items, optimistic)),
      );
      return { tempId };
    },
    onSuccess: (confirmed, _request, context) => {
      queryClient.setQueryData<ChannelCache>(key, (old) =>
        updateNewestPage(old, (items) => confirmMessage(items, context.tempId, confirmed)),
      );
    },
    onError: (_error, _request, context) => {
      if (context) {
        queryClient.setQueryData<ChannelCache>(key, (old) =>
          updateNewestPage(old, (items) => removeMessage(items, context.tempId)),
        );
      }
    },
  });
}
