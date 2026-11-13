import type { MessageView } from '@hospital-chat/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session-store';
import type { ChannelCache } from './messages-cache';
import { queryKeys } from './queries';
import { useChatSocket } from './use-chat-socket';

/** Socket falso: registra handlers y permite disparar eventos del servidor. */
class FakeSocket {
  connected = false;
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  emitWithAck = vi.fn().mockResolvedValue({ ok: true });
  disconnect = vi.fn();

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  serverEmits(event: string, ...args: unknown[]) {
    if (event === 'connect') this.connected = true;
    if (event === 'disconnect') this.connected = false;
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }
}

let socket: FakeSocket;
vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

function message(id: string, departmentId = 'emergencias'): MessageView {
  return {
    id,
    departmentId,
    body: `mensaje ${id}`,
    priority: 'NORMAL',
    createdAt: '2026-11-12T08:00:00.000Z',
    author: { id: 'carla', fullName: 'Carla Rivas', role: 'SUPERVISOR' },
    seenByMe: false,
    seenCount: 0,
  };
}

describe('useChatSocket', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    socket = new FakeSocket();
    queryClient = new QueryClient();
    useSession.getState().signIn({
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 1800,
      user: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
    });
  });

  it('al conectar queda en línea y se une a la sala del área activa', async () => {
    const { result } = renderHook(() => useChatSocket('emergencias'), { wrapper });
    expect(result.current.status).toBe('connecting');

    act(() => socket.serverEmits('connect'));

    expect(result.current.status).toBe('online');
    expect(socket.emitWithAck).toHaveBeenCalledWith('department:join', {
      departmentId: 'emergencias',
    });
    await waitFor(() => expect(result.current.joinError).toBeNull());
  });

  it('un mensaje nuevo entra a la caché del área, sin duplicarse', () => {
    queryClient.setQueryData<ChannelCache>(queryKeys.messages('emergencias'), {
      pages: [{ items: [], nextCursor: 'cursor-anterior' }],
      pageParams: [null],
    });
    renderHook(() => useChatSocket('emergencias'), { wrapper });

    act(() => {
      socket.serverEmits('message:new', message('m1'));
      socket.serverEmits('message:new', message('m1'));
    });

    expect(queryClient.getQueryData(queryKeys.messages('emergencias'))).toEqual({
      pages: [{ items: [message('m1')], nextCursor: 'cursor-anterior' }],
      pageParams: [null],
    });
  });

  it('no crea una caché parcial para un canal que todavía no se cargó', () => {
    renderHook(() => useChatSocket('emergencias'), { wrapper });

    act(() => socket.serverEmits('message:new', message('m1', 'uci')));

    expect(queryClient.getQueryData(queryKeys.messages('uci'))).toBeUndefined();
  });

  it('al reconectar vuelve a leer los mensajes por HTTP, pero no en la primera conexión', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useChatSocket('emergencias'), { wrapper });

    act(() => socket.serverEmits('connect'));
    expect(invalidate).not.toHaveBeenCalled();

    act(() => socket.serverEmits('disconnect'));
    expect(result.current.status).toBe('offline');

    act(() => socket.serverEmits('connect'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messages'] });
  });

  it('avisa si no pudo unirse a la sala', async () => {
    socket.emitWithAck.mockResolvedValue({ ok: false, message: 'No tienes acceso a esta área' });
    const { result } = renderHook(() => useChatSocket('emergencias'), { wrapper });

    act(() => socket.serverEmits('connect'));

    await waitFor(() => expect(result.current.joinError).toBe('No tienes acceso a esta área'));
  });

  it('al cambiar de área sale de la anterior y entra a la nueva', () => {
    const { rerender } = renderHook(({ id }) => useChatSocket(id), {
      wrapper,
      initialProps: { id: 'emergencias' },
    });
    act(() => socket.serverEmits('connect'));
    socket.emitWithAck.mockClear();

    rerender({ id: 'uci' });

    expect(socket.emitWithAck).toHaveBeenNthCalledWith(1, 'department:leave', {
      departmentId: 'emergencias',
    });
    expect(socket.emitWithAck).toHaveBeenNthCalledWith(2, 'department:join', {
      departmentId: 'uci',
    });
  });

  it('si el servidor invalida la sesión, se cierra la sesión local', () => {
    renderHook(() => useChatSocket('emergencias'), { wrapper });

    act(() => socket.serverEmits('session:invalid', 'La sesión ya no es válida'));

    expect(useSession.getState().token).toBeNull();
  });

  it('cierra el socket al desmontar', () => {
    const { unmount } = renderHook(() => useChatSocket('emergencias'), { wrapper });

    unmount();

    expect(socket.disconnect).toHaveBeenCalled();
  });
});
