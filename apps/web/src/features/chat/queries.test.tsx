import type { MessageView } from '@hospital-chat/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session-store';
import type { ChannelCache } from './messages-cache';
import { queryKeys, useSendMessage } from './queries';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) as unknown }));

const existing: MessageView = {
  id: 'm1',
  departmentId: 'emergencias',
  body: 'anterior',
  priority: 'NORMAL',
  createdAt: '2026-11-12T08:00:00.000Z',
  author: { id: 'carla', fullName: 'Carla Rivas', role: 'SUPERVISOR' },
};

describe('useSendMessage (envío optimista)', () => {
  let queryClient: QueryClient;
  const key = queryKeys.messages('emergencias');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const newestItems = () => queryClient.getQueryData<ChannelCache>(key)?.pages[0].items ?? [];

  beforeEach(() => {
    apiFetch.mockReset();
    queryClient = new QueryClient();
    queryClient.setQueryData<ChannelCache>(key, {
      pages: [{ items: [existing], nextCursor: null }],
      pageParams: [null],
    });
    useSession.getState().signIn({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 1800,
      user: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
    });
  });

  it('muestra el mensaje al instante como pendiente y lo reemplaza por el confirmado', async () => {
    let resolve: (value: MessageView) => void = () => undefined;
    apiFetch.mockReturnValue(new Promise<MessageView>((r) => (resolve = r)));
    const { result } = renderHook(() => useSendMessage('emergencias'), { wrapper });

    act(() => result.current.mutate({ body: '  Cama 4 lista  ' }));

    await waitFor(() => expect(newestItems()).toHaveLength(2));
    expect(newestItems()[0]).toMatchObject({
      body: 'Cama 4 lista',
      pending: true,
      author: { id: 'ana', fullName: 'Ana Martínez' },
    });

    const confirmed = {
      ...existing,
      id: 'm2',
      body: 'Cama 4 lista',
      createdAt: '2026-11-12T08:01:00.000Z',
    };
    await act(() => {
      resolve(confirmed);
      return Promise.resolve();
    });

    await waitFor(() => expect(newestItems().map((m) => m.id)).toEqual(['m2', 'm1']));
    expect(newestItems()[0].pending).toBeUndefined();
  });

  it('si el envío falla, quita el optimista y deja el canal como estaba', async () => {
    apiFetch.mockRejectedValue(new Error('No tienes acceso a esta área'));
    const { result } = renderHook(() => useSendMessage('emergencias'), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ body: 'hola' })).rejects.toThrow(
        'No tienes acceso a esta área',
      );
    });

    expect(newestItems()).toEqual([existing]);
  });

  it('envía al endpoint del área con el cuerpo tal cual (el servidor recorta y valida)', async () => {
    apiFetch.mockResolvedValue({ ...existing, id: 'm2' });
    const { result } = renderHook(() => useSendMessage('emergencias'), { wrapper });

    await act(() => result.current.mutateAsync({ body: 'hola', priority: 'NORMAL' }));

    expect(apiFetch).toHaveBeenCalledWith('/departments/emergencias/messages', {
      method: 'POST',
      body: JSON.stringify({ body: 'hola', priority: 'NORMAL' }),
    });
  });
});
