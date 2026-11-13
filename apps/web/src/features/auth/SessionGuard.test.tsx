import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useSession } from '@/lib/session-store';
import { SessionGuard } from './SessionGuard';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const logout = vi.fn<() => void>();
vi.mock('@/lib/logout', () => ({ logout: () => logout() }));

function renderGuarded(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionGuard>
        <p>contenido protegido</p>
      </SessionGuard>
    </QueryClientProvider>,
  );
}

function signIn(expiresIn = 1800) {
  useSession.getState().signIn({
    accessToken: 'jwt',
    tokenType: 'Bearer',
    expiresIn,
    user: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
  });
}

describe('SessionGuard', () => {
  beforeEach(() => {
    replace.mockReset();
    logout.mockReset();
    useSession.getState().signOut();
  });

  it('con sesión válida muestra el contenido', () => {
    signIn();
    renderGuarded();

    expect(screen.getByText('contenido protegido')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sin sesión no muestra nada y manda al login', () => {
    renderGuarded();

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('con la sesión vencida la cierra, vacía la caché de datos y manda al login', () => {
    signIn(-1);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['profile'], { fullName: 'Ana Martínez' });

    renderGuarded(queryClient);

    expect(useSession.getState().token).toBeNull();
    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('si la sesión se cierra mientras está en pantalla (logout, 401), sale del contenido', () => {
    signIn();
    const { rerender } = renderGuarded();

    useSession.getState().signOut();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SessionGuard>
          <p>contenido protegido</p>
        </SessionGuard>
      </QueryClientProvider>,
    );

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('cierra la sesión tras el tiempo sin actividad', () => {
    vi.useFakeTimers();
    signIn();
    renderGuarded();

    vi.advanceTimersByTime(10 * 60_000);

    expect(logout).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
