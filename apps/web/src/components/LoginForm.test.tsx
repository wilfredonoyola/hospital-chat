import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from '@/lib/session-store';
import { LoginForm } from './LoginForm';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

async function fillAndSubmit(code: string, pin: string) {
  await userEvent.type(screen.getByLabelText('Código'), code);
  await userEvent.type(screen.getByLabelText('PIN'), pin);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    useSession.getState().signOut();
    replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('entra, guarda la sesión y va al chat', async () => {
    respond(200, {
      accessToken: 'jwt',
      tokenType: 'Bearer',
      expiresIn: 1800,
      user: { id: 'ana', fullName: 'Ana Martínez', role: 'STAFF' },
    });
    render(<LoginForm />);

    await fillAndSubmit('enf001', '2580');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/staff/login',
      expect.objectContaining({ body: JSON.stringify({ staffCode: 'ENF001', pin: '2580' }) }),
    );
    expect(useSession.getState().token).toBe('jwt');
    expect(replace).toHaveBeenCalledWith('/chat');
  });

  it('con credenciales incorrectas no dice si falló el código o el PIN', async () => {
    respond(401, { statusCode: 401, message: 'Credenciales inválidas' });
    render(<LoginForm />);

    await fillAndSubmit('ENF001', '9999');

    expect(await screen.findByRole('alert')).toHaveTextContent('Código o PIN incorrectos.');
    expect(screen.getByLabelText('PIN')).toHaveValue('');
    expect(useSession.getState().token).toBeNull();
  });

  it('explica el rate limit en lugar de un error genérico', async () => {
    respond(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' });
    render(<LoginForm />);

    await fillAndSubmit('ENF001', '2580');

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });

  it('no llama a la API si el PIN no tiene de 4 a 6 dígitos', async () => {
    respond(200, {});
    render(<LoginForm />);

    await fillAndSubmit('ENF001', '12');

    expect(screen.getByRole('alert')).toHaveTextContent('PIN de 4 a 6 dígitos');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('el campo de PIN solo acepta dígitos', async () => {
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText('PIN'), '12ab34');

    expect(screen.getByLabelText('PIN')).toHaveValue('1234');
  });
});
